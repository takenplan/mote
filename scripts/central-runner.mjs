// Private bounded stdout/stderr supervisor. The CLI records this process's unique marker.
import { spawn } from 'node:child_process';
import { appendFileSync, statSync, renameSync, rmSync, mkdirSync, chmodSync } from 'node:fs';
import { dirname } from 'node:path';
import { startMediaWorkers } from './media-workers.mjs';
import { readConfigDocument } from '../packages/shared/src/config-file.ts';
import { logRetentionFromDocument } from '../apps/server/src/log-retention-config.mjs';

const [entry, logPath, marker] = process.argv.slice(2);
if (!entry || !logPath || !/^--mote-instance=[a-f0-9-]{36}$/.test(marker ?? '')) throw Error('Invalid central supervisor invocation');
const loaded = process.env.MOTE_CONFIG_FILE ? readConfigDocument(process.env.MOTE_CONFIG_FILE) : undefined;
const { maxBytes, maxFiles } = logRetentionFromDocument(loaded?.document ?? {});
const maxBufferedBytes = 16 * 1024;
let buffered = [], bufferedBytes = 0, logFailed = false;
mkdirSync(dirname(logPath), { recursive: true, mode: 0o700 });
const size = path => { try { return statSync(path).size; } catch (error) { if (error.code === 'ENOENT') return 0; throw error; } };
function rotate() {
  rmSync(maxFiles === 1 ? logPath : `${logPath}.${maxFiles - 1}`, { force: true });
  for (let i = maxFiles - 2; i >= 0; i--) {
    const source = i === 0 ? logPath : `${logPath}.${i}`;
    try { renameSync(source, `${logPath}.${i + 1}`); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
}
function write(chunk) {
  if (logFailed) return;
  try {
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    for (let offset = 0; offset < bytes.length;) {
      if (size(logPath) >= maxBytes) rotate();
      const piece = bytes.subarray(offset, offset + Math.min(maxBytes - size(logPath), bytes.length - offset));
      appendFileSync(logPath, piece, { mode: 0o600 }); chmodSync(logPath, 0o600); offset += piece.length;
    }
  } catch {
    // Disk failure must not leave a running server whose supervisor died or an unbounded pipe.
    logFailed = true; buffered = []; bufferedBytes = 0;
    child?.kill('SIGTERM'); process.exitCode = 1;
  }
}
function flush() {
  if (!bufferedBytes) return;
  const bytes = Buffer.concat(buffered, bufferedBytes);
  buffered = []; bufferedBytes = 0;
  write(bytes);
}
function safeWrite(line) {
  if (logFailed) return;
  const bytes = Buffer.from(line);
  if (bufferedBytes + bytes.length > maxBufferedBytes) flush();
  if (logFailed) return;
  if (bytes.length > maxBufferedBytes) { write(bytes); return; }
  buffered.push(bytes); bufferedBytes += bytes.length;
}
if (size(logPath) >= maxBytes) rotate();
const child = spawn(process.execPath, [entry, marker], { cwd: process.cwd(), env: process.env, stdio: ['ignore', 'pipe', 'pipe'] });
const workers = startMediaWorkers({ report: event => { safeWrite(JSON.stringify({event}) + '\n'); flush(); } });
function stopWorkers(){void workers.close();}
const events = new Set(['server.listening', 'server.stopped', 'server.stop_failed', 'server.start_failed']);
const categories = new Set(['data_directory_in_use', 'port_in_use', 'permission', 'startup', 'shutdown', 'configuration']);
const fields = new Set(['MOTE_CONFIG_FILE', 'version', 'revision', 'server', 'storage', 'execution', 'diagnostics', 'models', 'connectors', 'plugins', 'updates', 'media']);
function safeLine(line, stream, byteCount = Buffer.byteLength(line)) {
  let event = { event: 'process.output_suppressed', stream, bytes: byteCount };
  try {
    const candidate = JSON.parse(line);
    if (events.has(candidate.event)) {
      event = { event: candidate.event };
      if (Number.isInteger(candidate.port) && candidate.port > 0 && candidate.port <= 65535) event.port = candidate.port;
      if (candidate.tokenConfigured === true) event.tokenConfigured = true;
      if (categories.has(candidate.category)) event.category = candidate.category;
      if (candidate.category === 'configuration' && typeof candidate.field === 'string' && fields.has(candidate.field.split('.')[0])) event.field = candidate.field;
    }
  } catch { /* Arbitrary SDK/runtime output is never a diagnostic payload. */ }
  // Only allowlisted/suppressed JSON enters this bounded buffer; raw output never does.
  safeWrite(JSON.stringify(event) + '\n');
}
for (const stream of ['stdout', 'stderr']) {
  let pending = '', discarded = 0;
  child[stream].on('data', chunk => {
    const parts = chunk.toString('utf8').split('\n');
    for (let i = 0; i < parts.length; i++) {
      if (discarded) discarded += Buffer.byteLength(parts[i]);
      else pending += parts[i];
      if (Buffer.byteLength(pending) > 8192) { discarded = Buffer.byteLength(pending); pending = ''; }
      if (i < parts.length - 1) {
        if (discarded) safeLine('', stream, discarded); else if (pending) safeLine(pending, stream);
        pending = ''; discarded = 0;
      }
    }
    // Amortize filesystem calls within this data event without delaying diagnostics until a timer.
    flush();
  });
  child[stream].on('end', () => { if (discarded) safeLine('', stream, discarded); else if (pending) safeLine(pending, stream); flush(); });
}
child.on('error', () => { safeWrite('{"event":"process.spawn_failed"}\n'); flush(); process.exitCode = 1; });
child.on('close', (code, signal) => { stopWorkers();flush(); process.exitCode = process.exitCode || code || (signal ? 1 : 0); });
process.on('SIGTERM', () => {stopWorkers();child.kill('SIGTERM');});
process.on('SIGINT', () => {stopWorkers();child.kill('SIGINT');});
