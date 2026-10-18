#!/usr/bin/env python3
"""Loopback-only, offline OCR worker. Model files are installed by Mote first."""
import argparse
import hmac
import json
import os
import socket
from pathlib import Path
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from threading import BoundedSemaphore
from mote_ocr import UnsupportedImage, recognize_image
from mote_execution_facts import ExecutionFacts, execution_status, erase_execution


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--model-root', required=True)
    parser.add_argument('--port', type=int, default=9010)
    args = parser.parse_args()
    if not 1 <= args.port <= 65535:
        parser.error('Invalid port')
    root = Path(args.model_root)
    secret = os.environ.get('MOTE_MEDIA_WORKER_TOKEN', '')
    os.environ.update(HF_HUB_OFFLINE='1', TRANSFORMERS_OFFLINE='1', HF_HUB_DISABLE_TELEMETRY='1', DO_NOT_TRACK='1', PADDLE_PDX_DISABLE_MODEL_SOURCE_CHECK='True')
    busy = BoundedSemaphore(1)
    facts = ExecutionFacts(os.environ.get('MOTE_MEDIA_RECEIPT_DIRECTORY', str(root.parent / 'execution-facts')), 'ocr')
    pipeline = None
    pipeline_marker = None

    def ready():
        return (root / 'complete.json').is_file() and all((root / name).is_file() for name in (
            'det/inference.onnx', 'det/inference.yml', 'rec/inference.onnx', 'rec/inference.yml'))

    def load_model():
        nonlocal pipeline, pipeline_marker
        from paddlex.inference.pipelines import create_pipeline, load_pipeline_config
        stamp = (root / 'complete.json').stat().st_mtime_ns
        if pipeline is None or pipeline_marker != stamp:
            config = load_pipeline_config('OCR')
            config['use_doc_preprocessor'] = False
            config['use_textline_orientation'] = False
            config['SubModules']['TextDetection'].update(model_name='PP-OCRv5_mobile_det', model_dir=str(root / 'det'))
            config['SubModules']['TextRecognition'].update(model_name='PP-OCRv5_mobile_rec', model_dir=str(root / 'rec'))
            pipeline = create_pipeline(config=config, engine='onnxruntime', device='cpu')
            pipeline_marker = stamp

    def recognize(image):
        load_model()
        return recognize_image(image, pipeline.predict)

    class Handler(BaseHTTPRequestHandler):
        def end_headers(self):
            if getattr(self, 'receipt_id', None):
                self.send_header('X-Mote-Receipt-Id', self.receipt_id)
            super().end_headers()

        def log_message(self, *_):
            pass

        def authorized(self):
            return bool(secret) and hmac.compare_digest(self.headers.get('Authorization', ''), 'Bearer ' + secret)

        def send_json(self, value):
            body = json.dumps(value, ensure_ascii=False).encode()
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('X-Mote-Execution', 'local')
            self.send_header('Content-Length', str(len(body)))
            self.end_headers()
            self.wfile.write(body)

        json_response = send_json

        def reject_before_execution(self, status, message, retry_after=None):
            body = json.dumps({'error': message, 'executionStarted': False}).encode()
            self.send_response(status)
            self.send_header('Content-Type', 'application/json')
            self.send_header('X-Mote-Execution', 'local')
            self.send_header('X-Mote-Execution-Started', 'false')
            if retry_after is not None:
                self.send_header('Retry-After', str(retry_after))
            self.send_header('Content-Length', str(len(body)))
            self.end_headers()
            self.wfile.write(body)

        def do_GET(self):
            if not self.authorized():
                self.send_error(401)
            elif execution_status(self, facts):
                pass
            elif self.path == '/health':
                # Readiness includes dependencies and model loading, not only files.
                # The worker can start before model installation and load it later.
                available = False
                if ready():
                    if busy.acquire(blocking=False):
                        try:
                            load_model()
                            available = True
                        except Exception:
                            pass
                        finally:
                            busy.release()
                    else:
                        available = pipeline is not None and pipeline_marker == (root / 'complete.json').stat().st_mtime_ns
                self.send_json({'version': 1, 'execution': 'local', 'ocr': available})
            else:
                self.send_error(404)

        def do_POST(self):
            if self.path != '/ocr':
                self.send_error(404)
                return
            if not self.authorized():
                self.send_error(401)
                return
            if not ready():
                self.reject_before_execution(503, 'Model not installed')
                return
            request_id, scope = self.headers.get('X-Mote-Request-Id', ''), self.headers.get('X-Mote-Request-Scope', '')
            if request_id and not facts.identity(request_id, scope):
                self.reject_before_execution(400, 'Invalid execution identity')
                return
            if not busy.acquire(blocking=False):
                # Recheck cadence; actual worker completion remains independent.
                self.reject_before_execution(429, 'OCR worker busy', retry_after=5)
                return
            receipt_owned = False
            try:
                if request_id and not facts.begin(request_id, scope, 'ocr'):
                    self.send_response(409)
                    self.send_header('Content-Length', '0')
                    self.end_headers()
                    return
                receipt_owned = bool(request_id)
                self.receipt_id = request_id
                size = int(self.headers.get('Content-Length', '-1'))
                if not 0 < size <= 8 * 1024 * 1024:
                    self.send_error(413)
                    return
                image = self.rfile.read(size)
                if len(image) != size:
                    self.send_error(400)
                    return
                try:
                    if request_id:
                        facts.started(request_id)
                    result = recognize(image)
                    if request_id:
                        facts.finish(request_id, True)
                    self.send_json(result)
                except UnsupportedImage:
                    self.send_error(422, 'Unsupported image')
                except Exception:
                    self.send_error(503, 'OCR execution unavailable')
            finally:
                busy.release()
                if receipt_owned:
                    facts.finish(request_id, False)

        def do_DELETE(self):
            if not self.authorized():
                self.send_error(401)
            else:
                erase_execution(self, facts)

    server = ThreadingHTTPServer(('127.0.0.1', args.port), Handler)
    def denied(*_args, **_kwargs):
        raise OSError('Network is disabled in the local OCR worker')
    socket.socket.connect = denied
    socket.socket.connect_ex = denied
    socket.create_connection = denied
    socket.getaddrinfo = denied
    server.serve_forever()


if __name__ == '__main__':
    main()
