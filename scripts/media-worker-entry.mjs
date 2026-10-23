// Docker sidecars read the same mounted YAML as Central, including declared secret references.
import { spawn } from 'node:child_process';
import { resolve, join } from 'node:path';
import { readConfigDocument } from '../packages/shared/src/config-file.ts';
import { mediaEnvironment } from './media-workers.mjs';
const role = process.argv[2];
if (!['ocr', 'asr'].includes(role) || !process.env.MOTE_CONFIG_FILE) throw Error('A worker role and MOTE_CONFIG_FILE are required');
const loaded = readConfigDocument(process.env.MOTE_CONFIG_FILE), media = loaded.document.media ?? {};
if (!media.modelDirectory || !media.workerToken) { setInterval(() => {}, 60000); }
else {
  const modelDirectory = resolve(loaded.baseDir, media.modelDirectory), python = /[\\/]/.test(media.python ?? '') ? resolve(loaded.baseDir, media.python) : media.python || 'python3';
  const args = role === 'ocr' ? ['scripts/ocr-server.py', '--model-root', join(modelDirectory, 'ocr'), '--port', String(media.ocrPort)]
    : ['scripts/transcription-server.py', '--model', join(modelDirectory, 'dialogue'), '--segmentation-model', join(modelDirectory, 'dialogue/segmentation.onnx'), '--speaker-model', join(modelDirectory, 'dialogue/speaker.onnx'), '--wespeaker-model', join(modelDirectory, 'speaker-wespeaker/speaker.onnx'), '--timeout', '3600', '--port', String(media.asrPort)];
  const child = spawn(python, args, { env: { ...mediaEnvironment(process.env), PYTHONUNBUFFERED: '1', MOTE_MEDIA_WORKER_TOKEN: media.workerToken }, stdio: 'ignore' });
  child.once('error', () => { process.exitCode = 1; });
  child.once('close', (code, signal) => { process.exitCode = code || (signal ? 1 : 0); });
  for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, () => child.kill(signal));
}
