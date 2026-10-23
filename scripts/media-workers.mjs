// Shared by foreground development and the managed central supervisor.
// Installing dependencies never receives profile credentials or downloads model weights.
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join, isAbsolute, resolve } from 'node:path';
import { readConfigDocument } from '../packages/shared/src/config-file.ts';

export function mediaEnvironment(env) {
  const clean=Object.fromEntries(['PATH', 'HOME', 'LANG', 'TMPDIR', 'TMP', 'TEMP'].filter(key => env[key] !== undefined).map(key => [key, env[key]]));
  // GUI/launchd processes need the standard Native package-manager locations.
  // Preserve configured search order and never forward credentials.
  if(env.MOTE_RUNTIME==='native'&&process.platform==='darwin')clean.PATH=[...new Set([...(clean.PATH??'/usr/bin:/bin:/usr/sbin:/sbin').split(':'),'/opt/homebrew/bin','/usr/local/bin'])].join(':');
  return clean;
}

export async function ensureMediaRuntime({ root, python, env, run, sourcePython = 'python3' }) {
  if (!isAbsolute(python)) throw Error('Native media Python must be an absolute profile path');
  const requirements = ['requirements-audio.txt', 'requirements-ocr.txt'].map(name => join(root, 'scripts', name));
  const hash = createHash('sha256');
  for (const path of requirements) hash.update(await readFile(path));
  const version = hash.digest('hex'), directory = dirname(dirname(python)), marker = join(directory, 'mote-requirements.sha256');
  const clean = { ...mediaEnvironment(env), PADDLE_PDX_DISABLE_MODEL_SOURCE_CHECK: 'True', HF_HUB_OFFLINE: '1', HF_HUB_DISABLE_TELEMETRY: '1' };
  const probe = () => run(python, ['-c', 'import paddlex, onnxruntime, PIL, faster_whisper, sherpa_onnx'], clean);
  if (await readFile(marker, 'utf8').catch(() => null) === version) {
    try { await probe(); return false; } catch { /* Repair a partially removed runtime. */ }
  }
  await mkdir(dirname(directory), { recursive: true, mode: 0o700 });
  await run(sourcePython, ['-m', 'venv', directory], clean);
  await run(python, ['-m', 'pip', 'install', '--disable-pip-version-check', '--no-cache-dir', ...requirements.flatMap(path => ['-r', path])], clean);
  await probe();
  await writeFile(marker, version, { mode: 0o600 });
  return true;
}

export async function probeMediaCommands(python, env, run) {
  try { await run(python, ['-c', 'import shutil; assert shutil.which("ffmpeg"), "ffmpeg missing"'], mediaEnvironment(env)); }
  catch { throw Error('media.runtime.ffmpeg_missing'); }
}

export function startMediaWorkers({ root = process.cwd(), env = process.env, configuration, runtime, signal, report = event => console.info(JSON.stringify({ event })) } = {}) {
  if (!configuration && env.MOTE_CONFIG_FILE) {
    const loaded = readConfigDocument(env.MOTE_CONFIG_FILE, env);
    configuration = { ...(loaded.document.media ?? {}) }; runtime = loaded.document.server?.runtime;
    for (const key of ['modelDirectory', 'python']) if (configuration[key] && (key !== 'python' || /[\\/]/.test(configuration[key]))) configuration[key] = resolve(loaded.baseDir, configuration[key]);
  }
  if (!configuration?.modelDirectory || !configuration?.workerToken) return { ready: Promise.resolve(), close: async () => {} };
  const controller = new AbortController(), waits = new Set();
  const abort = () => controller.abort();
  signal?.addEventListener('abort', abort, { once: true });
  if (signal?.aborted) abort();
  const run = (command, args, childEnv, timeout = 30 * 60 * 1000) => {
    controller.signal.throwIfAborted();
    const child = spawn(command, args, { cwd: root, env: childEnv, stdio: 'ignore' });
    let force;
    const stop = () => { child.kill('SIGTERM'); force ??= setTimeout(() => child.kill('SIGKILL'), 5000); };
    controller.signal.addEventListener('abort', stop, { once: true });
    const timer = timeout ? setTimeout(stop, timeout) : undefined;
    const done = new Promise((resolve, reject) => {
      child.once('error', reject);
      child.once('close', code => code === 0 ? resolve() : reject(Error('Media subprocess failed')));
    }).finally(() => {
      clearTimeout(timer); clearTimeout(force); waits.delete(done);
      controller.signal.removeEventListener('abort', stop);
    });
    waits.add(done);
    return done;
  };
  const delay = ms => new Promise(resolve => {
    const finish = () => { clearTimeout(timer); controller.signal.removeEventListener('abort', finish); resolve(); };
    const timer = setTimeout(finish, ms);
    controller.signal.addEventListener('abort', finish, { once: true });
    if (controller.signal.aborted) finish();
  });
  const python = configuration.python || 'python3';
  const ready = (async () => {
    if (runtime === 'native') {
      for (;;) {
        controller.signal.throwIfAborted();
        try {
          report('media.runtime.preparing');
          await ensureMediaRuntime({ root, python, env: { ...env, MOTE_RUNTIME: runtime }, run });
          try { await probeMediaCommands(python, { ...env, MOTE_RUNTIME: runtime }, run); report('media.runtime.ready'); }
          catch { report('media.runtime.ffmpeg_missing'); }
          // Keep control endpoints and OCR available while a system command is missing.
          break;
        } catch (error) {
          if (controller.signal.aborted) throw error;
          report('media.runtime.install_failed');
          await delay(30000);
        }
      }
    }
    const workerEnv = { ...mediaEnvironment({ ...env, MOTE_RUNTIME: runtime }), PYTHONUNBUFFERED: '1', MOTE_MEDIA_WORKER_TOKEN: configuration.workerToken };
    const specs = [
      ['ocr-server.py', ['--model-root', join(configuration.modelDirectory, 'ocr'), '--port', String(configuration.ocrPort ?? 9010)]],
      ['transcription-server.py', ['--model', join(configuration.modelDirectory, 'dialogue'), '--segmentation-model', join(configuration.modelDirectory, 'dialogue/segmentation.onnx'), '--speaker-model', join(configuration.modelDirectory, 'dialogue/speaker.onnx'), '--wespeaker-model', join(configuration.modelDirectory, 'speaker-wespeaker/speaker.onnx'), '--timeout', '3600', '--port', String(configuration.asrPort ?? 9009)]],
    ];
    await Promise.all(specs.map(async ([script, args]) => {
      while (!controller.signal.aborted) {
        try { await run(python, [join(root, 'scripts', script), ...args], workerEnv, 0); }
        catch { if (!controller.signal.aborted) report('media.worker.exited'); }
        if (!controller.signal.aborted) await delay(5000);
      }
    }));
  })();
  void ready.catch(() => {});
  return { ready, close: async () => { abort(); await ready.catch(() => {}); await Promise.allSettled([...waits]); signal?.removeEventListener('abort', abort); } };
}
