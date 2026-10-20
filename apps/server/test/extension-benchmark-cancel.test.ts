import {waitForPluginCheck} from './fixtures/plugin-check.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn, type ChildProcess} from 'node:child_process';
import {createHash, randomUUID} from 'node:crypto';
import {existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
import {setTimeout as delay} from 'node:timers/promises';
import {zipSync} from 'fflate';
import {buildScopedApp} from '../src/scope/app.js';
import type {PluginReleaseTransport} from '../src/plugin-release.js';

const pack = fileURLToPath(new URL('../../../plugins/extension-benchmark/cancel-pack/', import.meta.url));
const password = 'Generated-cancel-only-password-2026';
const protocol = {'x-mote-protocol-version': '2', 'x-mote-ingress-version': '3'};
const hash = (bytes: Uint8Array | string) => createHash('sha256').update(bytes).digest('hex');

function releases() {
  const manifest = JSON.parse(readFileSync(join(pack, 'mote-plugin.json'), 'utf8'));
  const archive = readFileSync(join(pack, 'plugin.zip'));
  assert.equal(hash(archive), manifest.archive.sha256, 'fixed archive must match its published digest');
  const nativeArchive = zipSync({'native-apply.mjs': [readFileSync(join(pack, 'native-apply.mjs')), {mtime: new Date('2026-10-19T00:00:00Z')}]});
  const nativeManifest = {...manifest, id: 'benchmark.native-apply', name: 'Generated unchanged native apply specimen', entry: 'native-apply.mjs', archive: {asset: 'plugin.zip', sha256: hash(nativeArchive)}, configuration: [], capabilities: ['source'], components: [{id: 'cancel.native', version: '1', surface: 'ingress', capability: 'source'}]};
  const triggerManifest = {...manifest, id: 'benchmark.custom-trigger', name: 'Generated custom durable trigger probe', capabilities: ['trigger'], components: [{id: 'cancel.trigger', version: '1', surface: 'agent', capability: 'trigger'}]};
  return [
    {repository: 'generated-cancel/cancel-pack', manifest, archive},
    {repository: 'generated-cancel/native-apply', manifest: nativeManifest, archive: nativeArchive},
    {repository: 'generated-cancel/custom-trigger', manifest: triggerManifest, archive},
  ].map(value => ({...value, tag: 'v1.0.0'}));
}

function fixedReleaseTransport(): PluginReleaseTransport {
  const fixtures = releases();
  return async url => {
    for (const fixture of fixtures) {
      const base = `https://github.com/${fixture.repository}/releases/download/${fixture.tag}/`;
      if (url === `https://api.github.com/repos/${fixture.repository}/releases/tags/${fixture.tag}`) return {bytes: Buffer.from(JSON.stringify({tag_name: fixture.tag, draft: false, assets: [{name: 'mote-plugin.json', browser_download_url: base + 'mote-plugin.json'}, {name: 'plugin.zip', browser_download_url: base + 'plugin.zip'}]}))};
      if (url === `https://api.github.com/repos/${fixture.repository}/commits/${fixture.tag}`) return {bytes: Buffer.from(JSON.stringify({sha: fixture.manifest.archive.sha256.slice(0, 40)}))};
      if (url === base + 'mote-plugin.json') return {bytes: Buffer.from(JSON.stringify(fixture.manifest))};
      if (url === base + 'plugin.zip') return {bytes: fixture.archive};
    }
    throw Error('Only pinned generated release transport is permitted: ' + url);
  };
}

async function serverProcess() {
  const node = await buildScopedApp({dataDir: process.env.MOTE_CANCEL_DATA_DIR!}, {pluginReleaseTransport: fixedReleaseTransport()});
  if (process.env.MOTE_CANCEL_INITIALIZE === '1') await node.accounts.initialize('cancel-admin', password);
  const origin = await node.app.listen({host: '127.0.0.1', port: 0});
  process.stdout.write(JSON.stringify({phase: 'listening', origin, pid: process.pid}) + '\n');
  process.once('SIGTERM', () => {
    void node.app.close().then(() => {
      process.stdout.write(JSON.stringify({phase: 'closed', pid: process.pid}) + '\n');
      process.exit(0);
    }, error => { process.stderr.write(String(error)); process.exit(1); });
  });
}

function marker(root: string, key: string, phase: string): any | undefined {
  if (!existsSync(root)) return;
  const name = `cancel-pack.${key}.${phase}.json`;
  for (const entry of readdirSync(root, {withFileTypes: true})) {
    const path = join(root, entry.name);
    if (entry.isFile() && entry.name === name) return JSON.parse(readFileSync(path, 'utf8'));
    if (entry.isDirectory()) { const found = marker(path, key, phase); if (found) return found; }
  }
}

async function until<T>(probe: () => T | Promise<T>, reason: string, milliseconds = 15000): Promise<NonNullable<T>> {
  const end = Date.now() + milliseconds;
  while (Date.now() < end) { const value = await probe(); if (value) return value as NonNullable<T>; await delay(20); }
  throw Error(reason);
}

function pidAlive(pid: number) {
  assert.ok(Number.isSafeInteger(pid) && pid > 0, 'a valid worker PID is required');
  try { process.kill(pid, 0); return true; }
  catch (error) { if ((error as NodeJS.ErrnoException).code === 'ESRCH') return false; throw error; }
}

if (process.env.MOTE_CANCEL_SERVER === '1') {
  await serverProcess();
} else test('independent Round4 pack: source, processor, per-task cancellation, isolation, retirement and restart through loopback HTTP', {timeout: 120000}, async t => {
  const started = Date.now(), directory = mkdtempSync(join(tmpdir(), 'mote-cancel-r4-'));
  const workerRoot = join(directory, 'plugins', 'instances');
  const report: any = {originatingRound: 4, regressionMode: 'current-host', testedCandidate: process.env.MOTE_BENCHMARK_CANDIDATE ?? 'unrecorded', startedAt: new Date(started).toISOString(), originalFrozenCandidate: 'b3d956189ba81e4843e9ceacdec06bb7f30a352e', releaseSha256: releases()[0].manifest.archive.sha256, composition: 'real child process calling buildScopedApp and listening on loopback; not the shipped index.ts launcher', modelCalls: 0, modelQuality: 'NOT RUN', coreBusinessFilesChanged: 0, observations: {}, requestStatuses: []};
  let active: {child: ChildProcess; origin: string; pid: number; closed: Promise<number | null>} | undefined;
  async function start(initialize: boolean) {
    const environment = {...process.env, MOTE_CANCEL_SERVER: '1', MOTE_CANCEL_DATA_DIR: directory, MOTE_CANCEL_INITIALIZE: initialize ? '1' : '0'};
    delete environment.NODE_TEST_CONTEXT;
    const child = spawn(process.execPath, ['--import', 'tsx', fileURLToPath(import.meta.url)], {env: environment, stdio: ['ignore', 'pipe', 'pipe']});
    let output = '', errors = '';
    child.stderr!.on('data', part => { errors = (errors + String(part)).slice(-12000); });
    const closed = new Promise<number | null>(resolve => child.once('close', code => resolve(code)));
    const listening = await new Promise<{origin: string; pid: number}>((resolve, reject) => {
      const timer = setTimeout(() => { child.kill('SIGKILL'); reject(Error('Host startup timed out: ' + errors)); }, 25000);
      child.once('error', error => { clearTimeout(timer); reject(error); });
      child.once('exit', code => { clearTimeout(timer); reject(Error('Host exited before readiness: ' + code + ' ' + errors)); });
      child.stdout!.on('data', part => {
        output += String(part);
        for (;;) {
          const end = output.indexOf('\n'); if (end < 0) break;
          const line = output.slice(0, end); output = output.slice(end + 1);
          try { const value = JSON.parse(line); if (value.phase === 'listening') { clearTimeout(timer); resolve(value); } } catch {}
        }
      });
    });
    return {child, closed, ...listening};
  }
  async function stop() {
    if (!active) return;
    const current = active;
    current.child.kill('SIGTERM');
    let timer: ReturnType<typeof setTimeout> | undefined;
    try { assert.equal(await Promise.race([current.closed, new Promise((_, reject) => { timer = setTimeout(() => { current.child.kill('SIGKILL'); reject(Error('Graceful host shutdown exceeded 15 seconds')); }, 15000); })]), 0); }
    finally { clearTimeout(timer); active = undefined; }
  }
  t.after(async () => {
    try { await stop(); }
    finally {
      report.finishedAt = new Date().toISOString(); report.elapsedMs = Date.now() - started;
      if (process.env.MOTE_CANCEL_REPORT_PATH) writeFileSync(process.env.MOTE_CANCEL_REPORT_PATH, JSON.stringify(report, null, 2) + '\n');
      rmSync(directory, {recursive: true, force: true});
    }
  });
  const request = async (token: string | undefined, path: string, method = 'GET', body?: unknown) => {
    const response = await fetch(active!.origin + path, {method, headers: {...protocol, ...(token ? {authorization: 'Bearer ' + token} : {}), ...(body === undefined ? {} : {'content-type': 'application/json'})}, ...(body === undefined ? {} : {body: JSON.stringify(body)}), signal: AbortSignal.timeout(20000)});
    const text = await response.text(); let value: any; try { value = JSON.parse(text); } catch { value = text; }
    report.requestStatuses.push({path, method, status: response.status});
    return {status: response.status, body: value};
  };
  const ok = async (token: string | undefined, path: string, method = 'GET', body?: unknown) => {
    const value = await request(token, path, method, body); assert.equal(value.status, 200, path + ' ' + JSON.stringify(value.body)); return value.body;
  };
  const login = (username: string) => ok(undefined, '/api/auth/login', 'POST', {username, password, mode: 'client'});
  const view = (token: string) => ok(token, '/api/plugins');
  const configure = async (token: string, instance: unknown) => ok(token, '/api/plugin-instances', 'POST', {instance, expectedRevision: (await view(token)).revision});
  const action = async (token: string, name: string, id = 'shared-instance') => {
    const receipt = await ok(token, '/api/plugin-instances/' + id + '/' + name, 'POST', name === 'check' ? {} : {expectedRevision: (await view(token)).revision});
    if (name !== 'check') return receipt;
    await waitForPluginCheck(receipt, taskId => ok(token, '/api/tasks/' + taskId));
    const instance = (await view(token)).instances.find((value: any) => value.id === id);
    assert.equal(instance.checked, true, JSON.stringify(instance)); return instance;
  };
  const snapshot = (token: string) => ok(token, '/api/plugin-instances/shared-instance/snapshots', 'POST', {});
  const invoke = (token: string, snapshotId: string, payload: Record<string, unknown>, componentId = 'cancel.source') => ok(token, '/api/plugin-snapshots/' + snapshotId + '/invoke', 'POST', {componentId, payload, operationId: randomUUID()});
  const terminal = async (token: string, id: string, expected = 'succeeded') => {
    const result = await until(async () => { const task = await ok(token, '/api/tasks/' + id); return ['succeeded', 'failed', 'blocked', 'stale', 'cancelled'].includes(task.state) ? task : undefined; }, 'Task did not settle: ' + id);
    assert.equal(result.state, expected, JSON.stringify(result)); return result;
  };
  const run = async (token: string, snapshotId: string, payload: Record<string, unknown>, componentId = 'cancel.source', expected = 'succeeded') => terminal(token, (await invoke(token, snapshotId, payload, componentId)).id, expected);
  const findMarker = (key: string, phase: string) => until(() => marker(workerRoot, key, phase), 'Missing plugin observation: ' + key + '/' + phase);
  const install = async (admin: string, repository: string) => {
    const preview = await ok(admin, '/api/plugins/resolve', 'POST', {repository, tag: 'v1.0.0'});
    const state = await ok(admin, '/api/admin/plugins');
    const result = await ok(admin, '/api/plugins/install', 'POST', {previewId: preview.id, expectedRevision: state.revision, operationId: randomUUID()});
    const candidate = result.packages.find((value: any) => value.source.repository === repository) ?? result.packages.at(-1);
    const installed = await until(async () => { const catalog = await ok(admin, '/api/admin/plugins'); const pkg = catalog.packages.find((value: any) => value.id === candidate.id); return pkg && pkg.state !== 'installing' ? pkg : undefined; }, 'Release installation did not finish');
    assert.equal(installed.state, 'installed', JSON.stringify(installed)); return installed.id as string;
  };

  active = await start(true);
  const firstHostPid = active.pid, admin = await login('cancel-admin');
  const preinstall = await ok(admin.token, '/api/plugins/host-capabilities');
  assert.equal((await view(admin.token)).packages.length, 0);
  assert.deepEqual(preinstall.factoryExports, ['createMotePlugin', 'createMemoryProvider']);
  assert.deepEqual(preinstall.invocationCapabilities.filter((value: any) => value.registered).map((value: any) => value.id).sort(), ['processor', 'source']);
  assert.ok(preinstall.invocationCapabilities.filter((value: any) => !value.registered).every((value: any) => value.reason === 'scoped_domain_unavailable'));
  report.observations.preinstallCapabilities = preinstall;
  for (const username of ['cancel-a', 'cancel-b']) await ok(admin.token, '/api/admin/accounts', 'POST', {username, password, administrator: false});
  const alice = await login('cancel-a'), bob = await login('cancel-b');
  const packageId = await install(admin.token, 'generated-cancel/cancel-pack');
  const sourceId = 'shared-source';
  for (const [owner, label] of [[alice, 'ALPHA-GENERATED-6201'], [bob, 'BETA-GENERATED-9374']] as const) {
    await ok(owner.token, '/api/ingress/sources', 'POST', {id: sourceId, name: 'Generated same-name source', kind: 'custom', deviceId: 'shared-device', platform: 'import', retention: 'archive'});
    await configure(owner.token, {id: 'shared-instance', packageId, name: 'Independent modular pack', configuration: {label}, desired: false, grants: {capabilities: ['source', 'processor'], sourceIds: [sourceId], history: false}});
    const checked = await action(owner.token, 'check'); assert.equal(checked.checked, true);
    assert.equal((await view(owner.token)).instances[0].checked, true);
    await action(owner.token, 'enable');
  }
  const a = await snapshot(alice.token), b = await snapshot(bob.token);
  const items = (label: string) => [17, 29, 43].map((amount, index) => ({externalId: 'generated-row-' + index, revision: 'fixed-v1', observedAt: '2026-10-19T00:00:00Z', title: 'Generated row ' + index, text: label + ' / row ' + index + ' / amount ' + amount, kind: 'message', layer: 'original'}));
  const aItems = items('ALPHA-GENERATED-6201'), bItems = items('BETA-GENERATED-9374');
  const ingestedA = (await run(alice.token, a.id, {action: 'ingest', sourceId, batchId: 'same-batch', items: aItems})).result;
  const ingestedB = (await run(bob.token, b.id, {action: 'ingest', sourceId, batchId: 'same-batch', items: bItems})).result;
  assert.equal(ingestedA.receipt.captures.length, 3); assert.equal(ingestedB.receipt.captures.length, 3);
  assert.notEqual(ingestedA.pid, ingestedB.pid);
  const initialA = (await run(alice.token, a.id, {action: 'publish', sourceId, key: 'initial'})).result;
  const initialB = (await run(bob.token, b.id, {action: 'publish', sourceId, key: 'initial'})).result;
  assert.deepEqual(initialA.pages.map((page: any) => page.count), [2, 1]);
  assert.ok(initialA.pages[0].nextCursor); assert.equal(initialA.pages[1].nextCursor, null);
  assert.equal(new Set(initialA.originals.map((original: any) => original.ref)).size, 3);
  assert.deepEqual(initialA.documents.map((row: any) => row.item.text).sort(), aItems.map(row => row.text).sort());
  const initialReadA = await ok(alice.token, '/api/materials/' + initialA.materialId + '/read');
  const initialReadB = await ok(bob.token, '/api/materials/' + initialB.materialId + '/read');
  for (const row of aItems) assert.ok(JSON.stringify(initialReadA).includes(row.text));
  assert.ok(!JSON.stringify(initialReadA).includes('BETA-GENERATED'));
  assert.ok(!JSON.stringify(initialReadB).includes('ALPHA-GENERATED'));
  const material = await ok(alice.token, '/api/materials/' + initialA.materialId + '/members');
  assert.equal(material.total, 3);
  assert.deepEqual(material.items.map((member: any) => member.ref).sort(), initialA.originals.map((original: any) => 'capture:' + original.captureId).sort());
  report.firstSuccessAt = new Date().toISOString();
  report.observations.source = {pages: initialA.pages, originals: initialA.originals, materialId: initialA.materialId, read: initialReadA, pid: initialA.pid};

  const selected = initialA.originals[0], selectedDocument = initialA.documents.find((value: any) => value.originalRef === selected.ref);
  const processed = await run(alice.token, a.id, {originalRef: selected.ref, key: 'process-first'}, 'cancel.processor');
  const artifact = await ok(alice.token, '/api/processing/artifacts/' + processed.result.artifactId);
  assert.equal(artifact.originalRef, selected.ref);
  assert.deepEqual(artifact.payload, {durationMs: 0, coverage: 'full', engine: 'cancel-pack.generated-text-v1', segments: [{startMs: 0, endMs: 0, text: 'Extracted: ' + selectedDocument.item.text + '\nSHA256: ' + selectedDocument.hash}]});
  const extractionMaterial = (await ok(alice.token, '/api/materials')).items.find((value: any) => value.origin?.externalId === 'processed:' + selected.captureId);
  assert.ok(extractionMaterial, 'processor must publish a normal Material');
  const extractionRead = await ok(alice.token, '/api/materials/' + extractionMaterial.id + '/read');
  assert.ok(JSON.stringify(extractionRead).includes(selectedDocument.item.text));
  const extractionDetail = await ok(alice.token, '/api/materials/' + extractionMaterial.id + '/members');
  assert.ok(extractionDetail.items.some((member: any) => member.ref === 'capture:' + selected.captureId));
  const originalRead = (await run(alice.token, a.id, {action: 'read-original', originalRef: selected.ref})).result;
  const originalBytes = Buffer.from(originalRead.bytes.data);
  assert.equal(hash(originalBytes), selected.hash); assert.equal(hash(originalBytes), selectedDocument.hash);
  assert.equal(JSON.parse(originalBytes.toString('utf8')).text, selectedDocument.item.text);
  report.observations.processor = {taskId: processed.id, artifact, materialId: extractionMaterial.id, read: extractionRead, marker: await findMarker('process-first', 'processor')};

  const held = await invoke(alice.token, a.id, {action: 'hold-cancel', sourceId, key: 'cancel-one'});
  const heldStart = await findMarker('cancel-one', 'started');
  const sibling = await invoke(alice.token, a.id, {action: 'delay-publish', sourceId, key: 'sibling-success', delayMs: 1800});
  const siblingStart = await findMarker('sibling-success', 'started');
  const other = await invoke(bob.token, b.id, {action: 'delay-publish', sourceId, key: 'other-success', delayMs: 1800});
  const otherStart = await findMarker('other-success', 'started');
  assert.equal(heldStart.pid, siblingStart.pid); assert.equal(heldStart.pid, initialA.pid);
  assert.notEqual(heldStart.pid, otherStart.pid);
  assert.equal((await ok(alice.token, '/api/tasks/' + held.id)).state, 'running');
  assert.equal((await ok(alice.token, '/api/tasks/' + sibling.id)).state, 'running');
  const eventBeforeCancel = await ok(alice.token, '/api/plugin-events');
  await ok(alice.token, '/api/tasks/' + held.id + '/cancel', 'POST', {});
  await terminal(alice.token, held.id, 'cancelled');
  const cancelled = await findMarker('cancel-one', 'cancelled');
  assert.equal(cancelled.signalAborted, true);
  assert.deepEqual(cancelled.cleanup, {aborted: true, timerCleared: true, listenerRemoved: true, pendingWaits: 0});
  assert.deepEqual(cancelled.attempts.map((attempt: any) => ({method: attempt.method, succeeded: attempt.succeeded})), [{method: 'publishMaterial', succeeded: false}, {method: 'emit', succeeded: false}]);
  assert.equal((await request(alice.token, '/api/materials/' + cancelled.materialId)).status, 404);
  const siblingResult = await terminal(alice.token, sibling.id), otherResult = await terminal(bob.token, other.id);
  assert.equal(siblingResult.result.pid, heldStart.pid); assert.equal(otherResult.result.pid, otherStart.pid);
  assert.ok(pidAlive(heldStart.pid)); assert.ok(pidAlive(otherStart.pid));
  assert.ok(JSON.stringify(await ok(alice.token, '/api/materials/' + siblingResult.result.materialId + '/read')).includes('ALPHA-GENERATED'));
  assert.ok(JSON.stringify(await ok(bob.token, '/api/materials/' + otherResult.result.materialId + '/read')).includes('BETA-GENERATED'));
  const events = await ok(alice.token, '/api/plugin-events');
  assert.ok(!JSON.stringify(events).includes('after-cancel')); assert.ok(!JSON.stringify(events).includes('BETA-GENERATED'));
  assert.equal(events.items.length, eventBeforeCancel.items.length + 1);
  const afterCancel = (await run(alice.token, a.id, {action: 'publish', sourceId, key: 'fresh-after-cancel'})).result;
  assert.equal(afterCancel.pid, heldStart.pid);
  report.observations.cancellation = {taskId: held.id, siblingTaskId: sibling.id, otherTaskId: other.id, started: heldStart, cleanup: cancelled, siblingMaterialId: siblingResult.result.materialId, otherMaterialId: otherResult.result.materialId, laterPid: afterCancel.pid};

  assert.equal((await request(alice.token, '/api/tasks/' + other.id)).status, 404);
  assert.equal((await request(admin.token, '/api/tasks/' + other.id)).status, 404);
  assert.equal((await request(alice.token, '/api/plugin-snapshots/' + b.id + '/invoke', 'POST', {componentId: 'cancel.source', payload: {action: 'page', sourceId}, operationId: randomUUID()})).status, 404);
  const foreignRead = await run(alice.token, a.id, {action: 'read-original', originalRef: ingestedB.receipt.captures[0].original.ref}, 'cancel.source', 'blocked');
  assert.equal(foreignRead.result, undefined);
  report.observations.isolation = {sameSourceId: sourceId, sameInstanceId: 'shared-instance', privateSnapshotRejected: true, privateTaskRejectedForAdmin: true, foreignReadState: foreignRead.state, alphaWorker: heldStart.pid, betaWorker: otherStart.pid};

  const nativePackageId = await install(admin.token, 'generated-cancel/native-apply');
  await configure(alice.token, {id: 'native-apply', packageId: nativePackageId, name: 'Native public-path failure', configuration: {}, desired: false, grants: {capabilities: ['source'], sourceIds: [sourceId], history: false}});
  const nativeCheck = await request(alice.token, '/api/plugin-instances/native-apply/check', 'POST', {});
  assert.equal(nativeCheck.status, 200);
  const nativeTask = await waitForPluginCheck(nativeCheck.body, taskId => ok(alice.token, '/api/tasks/' + taskId), 'blocked');
  assert.equal((await view(alice.token)).instances.find((value: any) => value.id === 'native-apply').checked, false);
  report.observations.nativeHarness = {status: 'FAIL', reason: 'NO_EXTENSION_POINT', entry: 'unchanged native-apply.mjs exports apply only', check: nativeCheck, checkTask: nativeTask, archiveSha256: releases()[1].manifest.archive.sha256, harnessSession: 'NOT RUN: no supported native loading admission'};
  const triggerResolve = await request(admin.token, '/api/plugins/resolve', 'POST', {repository: 'generated-cancel/custom-trigger', tag: 'v1.0.0'});
  assert.equal(triggerResolve.status, 400);
  const triggerPolicy = await request(alice.token, '/api/ask-automations', 'POST', {id: randomUUID(), kind: 'cancel.periodic', sourceIds: [sourceId], includeExisting: false});
  assert.equal(triggerPolicy.status, 400);
  const triggerRpc = await run(alice.token, a.id, {action: 'trigger-probe', sourceId}, 'cancel.source', 'blocked');
  report.observations.customTrigger = {status: 'FAIL', reason: 'NO_EXTENSION_POINT', manifest: triggerResolve, policy: triggerPolicy, workerRpc: {state: triggerRpc.state, failure: triggerRpc.failure}};

  const stopTask = await invoke(alice.token, a.id, {action: 'delay-publish', sourceId, key: 'stop-held', delayMs: 60000});
  const stopStart = await findMarker('stop-held', 'started');
  await action(alice.token, 'stop');
  await until(() => !pidAlive(stopStart.pid), 'Stopped instance worker remained alive');
  await terminal(alice.token, stopTask.id, 'stale');
  assert.equal((await request(alice.token, '/api/materials/' + stopStart.materialId)).status, 404);
  assert.ok(JSON.stringify(await ok(alice.token, '/api/materials/' + initialA.materialId + '/read')).includes('ALPHA-GENERATED'));
  const unaffected = (await run(bob.token, b.id, {action: 'publish', sourceId, key: 'after-other-stop'})).result;
  assert.equal(unaffected.pid, otherStart.pid);
  const catalog = await ok(admin.token, '/api/admin/plugins');
  const uninstall = await request(admin.token, '/api/plugins/' + encodeURIComponent(packageId) + '/uninstall', 'POST', {expectedRevision: catalog.revision, operationId: randomUUID()});
  assert.equal(uninstall.status, 409);
  const shutdownTask = await invoke(bob.token, b.id, {action: 'delay-publish', sourceId, key: 'shutdown-held', delayMs: 60000});
  const shutdownStart = await findMarker('shutdown-held', 'started');
  await stop();
  await until(() => !pidAlive(shutdownStart.pid), 'Host shutdown did not retire its worker');
  assert.ok(!pidAlive(firstHostPid));
  active = await start(false);
  assert.notEqual(active.pid, firstHostPid);
  assert.deepEqual(await ok(alice.token, '/api/materials/' + initialA.materialId + '/read'), initialReadA);
  assert.deepEqual(await ok(bob.token, '/api/materials/' + initialB.materialId + '/read'), initialReadB);
  assert.deepEqual(await ok(alice.token, '/api/processing/artifacts/' + processed.result.artifactId), artifact);
  assert.equal((await request(bob.token, '/api/materials/' + shutdownStart.materialId)).status, 404);
  assert.equal((await request(alice.token, '/api/tasks/' + shutdownTask.id)).status, 404);
  report.observations.lifecycle = {stoppedWorkerPid: stopStart.pid, retiredOnStop: true, retiredOnClose: true, firstHostPid, restartedHostPid: active.pid, historyReadback: true, processorArtifactReadback: true, referencedUninstall: uninstall.status, inFlightRecovery: 'NOT RUN: history and absence of stale publication are checked; no recovery outcome claim', pluginVersionUpgrade: 'NOT RUN'};
  report.focusedRun = 'PASS';
  report.fullCases = Object.fromEntries(Array.from({length: 12}, (_, index) => ['E' + String(index + 1).padStart(2, '0'), [0, 7, 9, 10].includes(index) ? 'PARTIAL' : [3, 5].includes(index) ? 'FAIL: NO_EXTENSION_POINT' : 'NOT RUN']));
  report.notRun = ['shipped index.ts process launcher', 'plugin version upgrade', 'disable/drain and gap backfill', 'task recovery after crash', 'all complete E01-E12 business journeys', 'Memory', 'query insight', 'UI/browser', 'Mac native', 'Android native/emulator/device', 'live model/provider quality', 'native CPU/memory/power'];
  t.diagnostic(JSON.stringify({focusedRun: report.focusedRun, actualChildHttp: true, source: 'PASS', processor: 'PASS', cancellation: 'PASS', isolation: 'PASS', stopCloseRestartHistory: 'PASS', native: 'FAIL/NO_EXTENSION_POINT', trigger: 'FAIL/NO_EXTENSION_POINT', modelCalls: 0}));
});
