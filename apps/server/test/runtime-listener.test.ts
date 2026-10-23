import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, stat, writeFile, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import { writeRuntimeListener, readRuntimeListener, cleanupRuntimeListener, runtimeListenerPath, probeRuntimeListener, healthAddress } from '../src/runtime-listener.js';

test('runtime locator probes only its live startup listener and instance identity', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'mote-runtime-listener-')), file = join(directory, 'mote.yaml'), instanceId = randomUUID();
  let responseInstance = instanceId;
  const server = createServer((_req, response) => { response.setHeader('X-Mote-Runtime-Instance', responseInstance); response.end('{"ok":true}'); });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(async () => { await new Promise<void>(resolve => server.close(() => resolve())); await rm(directory, { recursive: true, force: true }); });
  const address = server.address(); assert.ok(address && typeof address !== 'string');
  const listener = { version: 1 as const, pid: process.pid, port: address.port, address: address.address, instanceId };
  await writeRuntimeListener(file, listener);
  assert.equal((await stat(runtimeListenerPath(file))).mode & 0o777, 0o600);
  assert.deepEqual(readRuntimeListener(file), listener);
  assert.equal(await probeRuntimeListener(file), true);
  await writeFile(file, 'version: 1\nrevision: 1\nserver:\n  port: 1\n');
  assert.equal(await probeRuntimeListener(file), true, 'saved YAML awaiting restart never redirects the health probe');
  responseInstance = randomUUID(); assert.equal(await probeRuntimeListener(file), false, 'another service with a reused port cannot satisfy the locator');
  responseInstance = instanceId;
  await writeRuntimeListener(file, { ...listener, pid: 2147483647 }); assert.equal(await probeRuntimeListener(file), false, 'a stale dead PID cannot use another live HTTP service');
  await writeRuntimeListener(file, listener);
  cleanupRuntimeListener(file, process.pid, randomUUID()); assert.deepEqual(readRuntimeListener(file), listener, 'cleanup retains another instance');
  cleanupRuntimeListener(file, process.pid, instanceId); assert.equal(await probeRuntimeListener(file), false);
  await symlink(file, runtimeListenerPath(file)); assert.equal(await probeRuntimeListener(file), false, 'links do not redirect private runtime reads');
});

test('wildcard listeners resolve to their IPv4 or IPv6 loopback health address', () => {
  assert.equal(healthAddress('0.0.0.0'), '127.0.0.1'); assert.equal(healthAddress('::'), '::1');
  assert.equal(healthAddress('127.0.0.2'), '127.0.0.2'); assert.equal(healthAddress('::1'), '::1');
});

test('shared-network health requires the runtime HTTP identity while local health also requires its PID', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'mote-shared-listener-')), file = join(directory, 'mote.yaml'), instanceId = randomUUID();
  let responseInstance = instanceId, status = 200, requests = 0;
  const server = createServer((_req, response) => { requests++; response.statusCode = status; response.setHeader('X-Mote-Runtime-Instance', responseInstance); response.end('{"ok":true}'); });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(async () => { await new Promise<void>(resolve => server.close(() => resolve())); await rm(directory, { recursive: true, force: true }); });
  const address = server.address(); assert.ok(address && typeof address !== 'string');
  await writeRuntimeListener(file, {version: 1, pid: 2147483647, port: address.port, address: address.address, instanceId});
  assert.equal(await probeRuntimeListener(file), false, 'the default local probe rejects a dead PID');
  assert.equal(requests, 0, 'a rejected local PID does not reach HTTP');
  assert.equal(await probeRuntimeListener(file, {checkLocalPid: false}), true, 'another PID namespace can verify the same runtime instance');
  responseInstance = randomUUID();
  assert.equal(await probeRuntimeListener(file, {checkLocalPid: false}), false, 'shared networking never accepts another instance');
  responseInstance = instanceId; status = 503;
  assert.equal(await probeRuntimeListener(file, {checkLocalPid: false}), false, 'shared networking still requires HTTP 200');
});
