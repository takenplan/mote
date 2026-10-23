#!/usr/bin/env python3
"""Bounded offline ASR/diarization HTTP worker. See docs/file-processing.md."""
import argparse
import hmac
import json
import math
import importlib.util
import shutil
import multiprocessing
import os
from pathlib import Path
import signal
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from tempfile import TemporaryDirectory
from mote_execution_facts import ExecutionFacts, execution_status, erase_execution


def recognize(path, stage, settings, budget, speakers, sender):
    try:
        if hasattr(os, 'setsid'):
            os.setsid()
        from mote_audio import offline_process, normalize, transcribe, diarize
        offline_process()
        with TemporaryDirectory(prefix='mote-normalized-') as temporary:
            wav = Path(temporary) / 'normalized.wav'
            normalize(path, wav, budget, settings['timeout'])
            if stage == 'transcribe':
                body = transcribe(wav, settings['model'], settings['threads'])
            else:
                body = diarize(wav, settings['segmentation_model'], settings['speaker_model'], speakers, settings['threads'], settings.get('speaker_range'), settings.get('embedding', '3d-speaker'))
            result = json.dumps({'status': 200, 'body': body}, ensure_ascii=False).encode()
            if len(result) > 32 * 1024 * 1024:
                raise OverflowError('output limit')
            sender.send_bytes(result)
    except OverflowError:
        sender.send_bytes(b'{"status":413,"failureCode":"unsupported_input"}')
    except ValueError:
        sender.send_bytes(b'{"status":422,"failureCode":"unsupported_input"}')
    except Exception:
        sender.send_bytes(b'{"status":422,"failureCode":"processing_failed"}')
    finally:
        sender.close()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--model', required=True, help='Local faster-whisper model directory')
    parser.add_argument('--segmentation-model', default='', help='Local pyannote segmentation ONNX file')
    parser.add_argument('--speaker-model', default='', help='Local 3D-Speaker embedding ONNX file')
    parser.add_argument('--wespeaker-model', default='', help='Optional pinned WeSpeaker Chinese embedding ONNX file')
    parser.add_argument('--port', type=int, default=9009)
    parser.add_argument('--threads', type=int, default=4)
    parser.add_argument('--timeout', type=int, default=600)
    args = parser.parse_args()
    if not 1 <= args.threads <= 32 or not 1 <= args.timeout <= 3600 or not 1 <= args.port <= 65535:
        parser.error('Invalid threads, timeout or port')
    # The control endpoint stays available while models are being installed.
    settings = vars(args)
    secret = os.environ.get('MOTE_MEDIA_WORKER_TOKEN') or os.environ.get('MOTE_TRANSCRIPTION_TOKEN', '')
    mp = multiprocessing.get_context('spawn')
    busy = threading.BoundedSemaphore(1)
    facts = ExecutionFacts(Path(args.model).parent / 'execution-facts', 'asr')

    class Handler(BaseHTTPRequestHandler):
        def end_headers(self):
            if getattr(self, 'receipt_id', None):
                self.send_header('X-Mote-Receipt-Id', self.receipt_id)
            super().end_headers()

        def log_message(self, *_):
            pass

        def authorized(self):
            return not secret or hmac.compare_digest(self.headers.get('Authorization', ''), 'Bearer ' + secret)

        def json_response(self, body):
            data = json.dumps(body, ensure_ascii=False).encode()
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('X-Mote-Execution', 'local')
            self.send_header('Content-Length', str(len(data)))
            self.end_headers()
            self.wfile.write(data)

        def dependencies(self):
            return {'ffmpeg': bool(shutil.which('ffmpeg')),
                    'faster_whisper': importlib.util.find_spec('faster_whisper') is not None,
                    'sherpa_onnx': importlib.util.find_spec('sherpa_onnx') is not None}

        def reject_before_execution(self, status, message, retry_after=None):
            # A transport fact for the host's issued-call ledger, never a guess
            # from an HTTP status or provider's free-form error text.
            data = json.dumps({'error': message, 'executionStarted': False}).encode()
            self.send_response(status)
            self.send_header('Content-Type', 'application/json')
            self.send_header('X-Mote-Execution', 'local')
            self.send_header('X-Mote-Execution-Started', 'false')
            if retry_after is not None:
                self.send_header('Retry-After', str(retry_after))
            self.send_header('Content-Length', str(len(data)))
            self.end_headers()
            self.wfile.write(data)

        def do_GET(self):
            if not self.authorized():
                self.send_error(401)
            elif self.path.startswith('/executions/') and not secret:
                self.send_error(401)
            elif execution_status(self, facts):
                pass
            elif self.path == '/health':
                dependencies = self.dependencies()
                runtime = dependencies['ffmpeg'] and dependencies['faster_whisper']
                self.json_response({'version': 2, 'execution': 'local', 'dependencies': dependencies, 'missingDependencies': [name for name, ready in dependencies.items() if not ready], 'asr': bool(runtime and Path(args.model).is_dir() and Path(args.model, 'model.bin').is_file()),
                                    'wespeaker': bool(runtime and dependencies['sherpa_onnx'] and Path(args.wespeaker_model).is_file() and Path(args.segmentation_model).is_file()),
                                    'diarization': bool(runtime and importlib.util.find_spec('sherpa_onnx') and args.segmentation_model and args.speaker_model and
                                                        Path(args.segmentation_model).is_file() and Path(args.speaker_model).is_file())})
            else:
                self.send_error(404)

        def do_POST(self):
            if self.path not in ('/transcribe', '/diarize'):
                self.send_error(404)
                return
            if not self.authorized():
                self.send_error(401)
                return
            request_id, scope = self.headers.get('X-Mote-Request-Id', ''), self.headers.get('X-Mote-Request-Scope', '')
            if request_id and (not secret or not facts.identity(request_id, scope)):
                self.reject_before_execution(401 if not secret else 400, 'Invalid execution identity')
                return
            if not Path(args.model, 'model.bin').is_file() or not shutil.which('ffmpeg') or importlib.util.find_spec('faster_whisper') is None:
                self.reject_before_execution(503, 'Local ASR model or runtime unavailable')
                return
            embedding = self.headers.get('X-Mote-Speaker-Model', '3d-speaker')
            if embedding not in ('3d-speaker', 'wespeaker-zh'):
                self.reject_before_execution(400, 'Unknown speaker model')
                return
            selected_model = args.wespeaker_model if embedding == 'wespeaker-zh' else args.speaker_model
            if self.path == '/diarize' and (not Path(args.segmentation_model).is_file() or not Path(selected_model).is_file() or importlib.util.find_spec('sherpa_onnx') is None):
                self.reject_before_execution(503, 'Local diarization model unavailable')
                return
            if not busy.acquire(blocking=False):
                # Recheck cadence, not an estimate of when this call will finish.
                self.reject_before_execution(429, 'Local worker busy', retry_after=5)
                return
            worker = None
            receiver = sender = None
            released = False
            receipt_owned = False
            failure_code = 'unsupported_input'
            failure_status = 422
            disconnected = False
            try:
                requested_timeout = self.headers.get('X-Mote-Processing-Timeout-Ms')
                if requested_timeout is not None and (len(requested_timeout) > 7 or not requested_timeout.isascii() or not requested_timeout.isdecimal() or not 1000 <= int(requested_timeout) <= 3600000):
                    self.send_error(400, 'Invalid processing timeout')
                    return
                timeout = min(args.timeout, int(requested_timeout) / 1000) if requested_timeout is not None else args.timeout
                self.connection.settimeout(timeout)
                length = int(self.headers.get('Content-Length', '-1'))
                budget = min(float(self.headers.get('X-Mote-Max-Audio-Ms', '14400000')), 86400000)
                speakers = int(self.headers.get('X-Mote-Speaker-Count', '0'))
                lower, upper = self.headers.get('X-Mote-Speaker-Min'), self.headers.get('X-Mote-Speaker-Max')
                speaker_range = None
                if lower is not None or upper is not None:
                    if lower is None or upper is None or not lower.isascii() or not upper.isascii() or not lower.isdecimal() or not upper.isdecimal() or len(lower)>2 or len(upper)>2 or not 1 <= int(lower) <= int(upper) <= 16 or speakers or embedding != 'wespeaker-zh':
                        self.reject_before_execution(400, 'Invalid speaker range')
                        return
                    speaker_range = (int(lower), int(upper))
                if not 0 < length <= 512 * 1024 * 1024 or not math.isfinite(budget) or budget <= 0 or not 0 <= speakers <= 16:
                    self.send_error(413)
                    return
                with TemporaryDirectory(prefix='mote-audio-input-') as directory:
                    audio = Path(directory) / 'original.audio'
                    with audio.open('xb') as output:
                        remaining = length
                        while remaining:
                            block = self.rfile.read(min(1024 * 1024, remaining))
                            if not block:
                                raise ValueError('incomplete input')
                            output.write(block)
                            remaining -= len(block)
                    receiver, sender = mp.Pipe(duplex=False)
                    worker = mp.Process(target=recognize, args=(str(audio), self.path[1:], {**settings, 'timeout': timeout, 'speaker_model': selected_model, 'embedding': embedding, 'speaker_range': speaker_range}, budget, speakers, sender))
                    if request_id:
                        if not facts.begin(request_id, scope, self.path[1:]):
                            receiver.close()
                            sender.close()
                            worker = None
                            self.send_error(409)
                            return
                        receipt_owned = True
                        self.receipt_id = request_id
                        facts.started(request_id)
                    failure_code = 'processing_failed'
                    worker.start()
                    sender.close()
                    try:
                        if not receiver.poll(timeout):
                            failure_code = 'processing_timeout'
                            failure_status = 504
                            raise TimeoutError('Audio processing timeout')
                        response = json.loads(receiver.recv_bytes(32 * 1024 * 1024))
                    finally:
                        receiver.close()
                    if response['status'] != 200:
                        failure_status = response['status']
                        failure_code = response.get('failureCode', 'processing_failed')
                        raise ValueError('Audio processing failed')
                    worker.join(5)
                    if worker.is_alive():
                        raise TimeoutError('Worker did not finish')
                    busy.release()
                    released = True
                    if request_id:
                        facts.finish(request_id, True)
                    self.json_response(response['body'])
                    return
            except (BrokenPipeError, ConnectionResetError):
                disconnected = True
            except Exception:
                pass
            finally:
                if worker is not None and worker.pid is not None:
                    worker.join(0.2)
                    if worker.is_alive():
                        if hasattr(os, 'killpg'):
                            try:
                                os.killpg(worker.pid, signal.SIGTERM)
                            except ProcessLookupError:
                                worker.terminate()
                        else:
                            worker.terminate()
                        worker.join(5)
                        if worker.is_alive():
                            worker.kill()
                            worker.join()
                if receiver is not None:
                    receiver.close()
                if sender is not None:
                    sender.close()
                if not released:
                    busy.release()
                # No terminal failure is published until the actual recognizer
                # has exited. A parent restart alone never supplies that proof.
                if receipt_owned:
                    facts.finish(request_id, False, failure_code)
            if not disconnected:
                self.send_error(failure_status, 'Audio processing failed')

        def do_DELETE(self):
            if not secret or not self.authorized():
                self.send_error(401)
            else:
                erase_execution(self, facts)

    ThreadingHTTPServer(('127.0.0.1', args.port), Handler).serve_forever()


if __name__ == '__main__':
    main()
