import { constants, openSync, fstatSync, readFileSync, closeSync, unlinkSync } from 'node:fs';
import { open, rename, rm } from 'node:fs/promises';
import { dirname, basename, join, resolve } from 'node:path';
import { isIP } from 'node:net';
import { randomUUID } from 'node:crypto';
import { Agent, get } from 'node:http';

export interface RuntimeListener {
  version: 1;
  pid: number;
  port: number;
  address: string;
  instanceId: string;
}
const MAX_BYTES = 4096;
export const runtimeListenerPath = (configFile: string) => join(dirname(resolve(configFile)), `.${basename(configFile)}.runtime.json`);
export function healthAddress(address: string): string {
  return address === '0.0.0.0' ? '127.0.0.1' : address === '::' ? '::1' : address;
}
export async function writeRuntimeListener(configFile: string, listener: RuntimeListener): Promise<void> {
  const file = runtimeListenerPath(configFile), temporary = `${file}.${randomUUID()}.tmp`;
  try {
    const handle = await open(temporary, 'wx', 0o600);
    try { await handle.writeFile(JSON.stringify(listener) + '\n'); await handle.sync(); } finally { await handle.close(); }
    await rename(temporary, file);
  } finally { await rm(temporary, { force: true }); }
}
export function readRuntimeListener(configFile: string): RuntimeListener {
  const fd = openSync(runtimeListenerPath(configFile), constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const info = fstatSync(fd);
    if (!info.isFile() || info.nlink !== 1 || info.size > MAX_BYTES) throw Error('Invalid runtime listener');
    const raw = readFileSync(fd, 'utf8');
    if (Buffer.byteLength(raw) > MAX_BYTES) throw Error('Invalid runtime listener');
    const value = JSON.parse(raw) as RuntimeListener;
    if (value.version !== 1 || !Number.isSafeInteger(value.pid) || value.pid < 1 || !Number.isInteger(value.port) || value.port < 1 || value.port > 65535 || !isIP(value.address) || !/^[a-f0-9-]{36}$/.test(value.instanceId)) throw Error('Invalid runtime listener');
    return value;
  } finally { closeSync(fd); }
}
export function cleanupRuntimeListener(configFile: string, pid: number, instanceId: string): void {
  try {
    const listener = readRuntimeListener(configFile);
    if (listener.pid === pid && listener.instanceId === instanceId) unlinkSync(runtimeListenerPath(configFile));
  } catch { /* A replaced locator belongs to its new process; cleanup never exposes paths. */ }
}
/** Probe the actual startup listener, independently of saved settings awaiting restart. */
export async function probeRuntimeListener(configFile: string): Promise<boolean> {
  let listener: RuntimeListener;
  try { listener = readRuntimeListener(configFile); process.kill(listener.pid, 0); } catch { return false; }
  const host = healthAddress(listener.address), url = `http://${host.includes(':') ? `[${host}]` : host}:${listener.port}/api/health`;
  return new Promise(resolveHealth => {
    const agent = new Agent({ keepAlive: false, proxyEnv: {} });
    let done = false;
    const finish = (healthy: boolean) => { if (!done) { done = true; clearTimeout(timer); agent.destroy(); resolveHealth(healthy); } };
    const request = get(url, { agent }, response => {
      const identity = response.headers['x-mote-runtime-instance'];
      response.resume();
      finish(response.statusCode === 200 && identity === listener.instanceId);
    });
    const timer = setTimeout(() => { request.destroy(); finish(false); }, 3000);
    request.once('error', () => finish(false));
  });
}
