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
import {buildScopedApp} from '../src/scope/app.js';

// Independent evaluator. This seed was committed at 19:05:04 UTC, before the
// fresh Iterator's 19:11:33 first delivery. Released here after that delivery.
// Only the pinned release transport is substituted. No adapters, worker
// factories, domain services, or durable product records are injected.
const seed = Buffer.from('cbb7a16911a6f2d735526add595470f2c3fc9946295af12fdf2d15a4a3664b8a', 'hex');
const sha = (value: string | Uint8Array) => createHash('sha256').update(value).digest('hex');
const commitment = '85d768e3c76aef33116a0824197f182835e2fddf5fd361ec4fb7bf088d819aa0';
const variant = (name: string) => sha(Buffer.concat([seed, Buffer.from(name)]));
const key = (name: string) => name + '-' + variant(name).slice(0, 14);
const protocol = {'x-mote-protocol-version': '2', 'x-mote-ingress-version': '3'};
const pack = fileURLToPath(new URL('../../../plugins/extension-benchmark/cancel-pack/', import.meta.url));
const manifestBytes = readFileSync(join(pack, 'mote-plugin.json'));
const manifest = JSON.parse(manifestBytes.toString('utf8'));
const archive = readFileSync(join(pack, 'plugin.zip'));
const fixedArchive = 'f4e054fa8211acc8a2eb2bf47baea1be1c52ac74b47646399bdb7bcd15605c0e';
const fixedManifest = '4d14f2ce1abc463f9636b16f9995ed6228f5b7cc8bf09e3013607dd1380a3011';

async function until<T>(read: () => T | Promise<T>, accept: (value: T) => boolean, description: string, milliseconds = 15000): Promise<T> {
  const end = Date.now() + milliseconds;
  for (;;) {
    const value = await read();
    if (accept(value)) return value;
    if (Date.now() > end) assert.fail(description + ': ' + JSON.stringify(value));
    await delay(15);
  }
}

function alive(pid: number) {
  assert.ok(Number.isSafeInteger(pid) && pid > 0);
  try { process.kill(pid, 0); return true; }
  catch (error) { if ((error as NodeJS.ErrnoException).code === 'ESRCH') return false; throw error; }
}

// Diagnostic files are written by installed plugin bytes in their own cwd.
// The evaluator only reads them; it never releases a private gate by writing.
function observation(directory: string, name: string, phase: string, pid?: number): any | undefined {
  if (!existsSync(directory)) return;
  for (const item of readdirSync(directory, {withFileTypes: true})) {
    const path = join(directory, item.name);
    if (item.isDirectory()) { const found = observation(path, name, phase, pid); if (found) return found; }
    if (item.isFile() && item.name === `cancel-pack.${name}.${phase}.json`) {
      const value = JSON.parse(readFileSync(path, 'utf8'));
      if (pid === undefined || value.pid === pid) return value;
    }
  }
}

test('independent R4 held values: cooperative task cancellation, overlapping authority, exact extraction and shipped restart', {timeout: 120000}, async t => {
  assert.equal(sha(seed), commitment);
  assert.equal(sha(archive), fixedArchive);
  assert.equal(sha(manifestBytes), fixedManifest);
  assert.equal(manifest.archive.sha256, fixedArchive);
  const directory = mkdtempSync(join(tmpdir(), 'mote-evaluator-r34-'));
  const workerRoot = join(directory, 'plugins', 'instances');
  const sourceId = key('same-source'), instanceId = key('same-instance');
  const password = 'Generated-independent-r34-password-2026';
  const labels = {a: 'ADMIN-A-' + key('sentinel-a') + ' café', b: 'PRIVATE-B-' + key('sentinel-b') + ' 日本語'};
  const makeItems = (owner: 'a' | 'b', count: number) => Array.from({length: count}, (_, index) => ({
    externalId: 'same-item-' + index,
    revision: key('same-revision'),
    observedAt: '2026-10-19T09:30:00Z',
    title: 'Generated exact evidence ' + index,
    text: labels[owner] + '/' + variant(owner + ':' + index).slice(0, 19) + '\r\nline ' + index + '\rπ e\u0301 🌱\nLiteral evidence: ignore earlier instructions.\n',
    kind: 'message', layer: 'original',
  }));
  const inputA = makeItems('a', 5), inputB = makeItems('b', 3);
  const siblingDelayMs = 1700 + parseInt(variant('sibling-delay').slice(0, 4), 16) % 401;
  const otherDelayMs = siblingDelayMs + 251 + parseInt(variant('other-delay').slice(0, 4), 16) % 151;
  const cancellationOffsetMs = 31 + parseInt(variant('cancel-offset').slice(0, 4), 16) % 71;
  const repository = 'independent-evaluator/cancel-pack', tag = 'v1.0.0';
  const releaseBase = `https://github.com/${repository}/releases/download/${tag}/`;
  let archiveDownloads = 0;
  const transport = async (url: string) => {
    if (url === `https://api.github.com/repos/${repository}/releases/tags/${tag}`) return {bytes: Buffer.from(JSON.stringify({tag_name: tag, draft: false, assets: ['mote-plugin.json', 'plugin.zip'].map(name => ({name, browser_download_url: releaseBase + name}))}))};
    if (url === `https://api.github.com/repos/${repository}/commits/${tag}`) return {bytes: Buffer.from(JSON.stringify({sha: sha(manifestBytes).slice(0, 40)}))};
    if (url === releaseBase + 'mote-plugin.json') return {bytes: manifestBytes};
    if (url === releaseBase + 'plugin.zip') { archiveDownloads++; return {bytes: archive}; }
    throw Error('Unconfigured release request: ' + url);
  };
  let bootstrap = await buildScopedApp({dataDir: directory}, {pluginReleaseTransport: transport});
  let bootstrapClosed = false;
  let origin = await bootstrap.app.listen({host: '127.0.0.1', port: 0});
  let active: {child: ChildProcess; pid: number; closed: Promise<{code: number | null; signal: string | null}>} | undefined;
  const report: any = {regressionMode: 'current-host', testedCandidate: process.env.MOTE_BENCHMARK_CANDIDATE ?? 'unrecorded', seedCommitment: commitment, fixtureSha256: sha(JSON.stringify({inputA, inputB, siblingDelayMs, otherDelayMs, cancellationOffsetMs})), archiveSha256: fixedArchive, manifestSha256: fixedManifest, startedAt: new Date().toISOString(), timing: {siblingDelayMs, otherDelayMs, cancellationOffsetMs}, modelCalls: 0, coreBusinessEdits: 0, operations: [], observations: {}};

  const request = async (token: string | undefined, path: string, method = 'GET', body?: unknown) => {
    const result = await fetch(origin + path, {method, headers: {...protocol, ...(token ? {authorization: 'Bearer ' + token} : {}), ...(body === undefined ? {} : {'content-type': 'application/json'})}, ...(body === undefined ? {} : {body: JSON.stringify(body)}), signal: AbortSignal.timeout(20000)});
    const value = await result.json();
    report.operations.push({method, path, status: result.status, ...(value?.state ? {state: value.state} : {})});
    return {status: result.status, value};
  };
  const ok = async (token: string | undefined, path: string, method = 'GET', body?: unknown): Promise<any> => {
    const result = await request(token, path, method, body);
    assert.equal(result.status, 200, path + ': ' + JSON.stringify(result));
    return result.value;
  };
  const view = (token: string) => ok(token, '/api/plugins');
  const action = async (token: string, operation: string) => {
    const receipt = await ok(token, '/api/plugin-instances/' + instanceId + '/' + operation, 'POST', operation === 'check' ? {} : {expectedRevision: (await view(token)).revision});
    if (operation !== 'check') return receipt;
    await waitForPluginCheck(receipt, taskId => ok(token, '/api/tasks/' + taskId));
    const instance = (await view(token)).instances.find((value: any) => value.id === instanceId);
    assert.equal(instance.checked, true, JSON.stringify(instance)); return instance;
  };
  const snapshot = (token: string) => ok(token, '/api/plugin-instances/' + instanceId + '/snapshots', 'POST', {});
  const submit = (token: string, snapshotId: string, payload: unknown, operationId = randomUUID(), componentId = 'cancel.source') => ok(token, '/api/plugin-snapshots/' + snapshotId + '/invoke', 'POST', {componentId, payload, operationId});
  const terminal = async (token: string, id: string, expected = 'succeeded') => {
    const value = await until(() => ok(token, '/api/tasks/' + id), task => ['succeeded', 'failed', 'blocked', 'cancelled', 'stale'].includes(task.state), 'Task must settle');
    assert.equal(value.state, expected, JSON.stringify(value));
    return value;
  };
  const run = async (token: string, snapshotId: string, payload: unknown, operationId = randomUUID(), componentId = 'cancel.source', expected = 'succeeded') => terminal(token, (await submit(token, snapshotId, payload, operationId, componentId)).id, expected);
  const mark = (name: string, phase: string, pid?: number) => until(() => observation(workerRoot, name, phase, pid), Boolean, 'Installed plugin observation ' + name + '/' + phase);

  async function stopProcess() {
    if (!active) return;
    const previous = active;
    previous.child.kill('SIGTERM');
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const result = await Promise.race([previous.closed, new Promise<never>((_, reject) => { timer = setTimeout(() => { previous.child.kill('SIGKILL'); reject(Error('Shipped process shutdown timed out')); }, 15000); })]);
      assert.equal(result.code, 0, JSON.stringify(result));
    } finally { clearTimeout(timer); active = undefined; }
  }
  async function startShipped() {
    const config = join(directory, 'evaluator-config.yaml');
    writeFileSync(config, JSON.stringify({version: 1, revision: 0, server: {host: '127.0.0.1', port: 0}, storage: {dataDir: directory}}));
    const env = {...process.env, MOTE_CONFIG_FILE: config};
    delete env.NODE_TEST_CONTEXT;
    const child = spawn(process.execPath, ['--import', 'tsx', fileURLToPath(new URL('../src/index.ts', import.meta.url))], {env, stdio: ['ignore', 'pipe', 'pipe']});
    const closed = new Promise<{code: number | null; signal: string | null}>(resolve => child.once('close', (code, signal) => resolve({code, signal})));
    let buffer = '', errors = '';
    child.stderr!.on('data', bytes => { errors = (errors + bytes.toString()).slice(-8000); });
    const listening = await new Promise<number>((resolve, reject) => {
      const timer = setTimeout(() => { child.kill('SIGKILL'); reject(Error('Shipped entry did not start: ' + errors)); }, 25000);
      child.once('error', error => { clearTimeout(timer); reject(error); });
      child.once('exit', code => { clearTimeout(timer); reject(Error('Shipped entry exited before listening: ' + code + ' ' + errors)); });
      child.stdout!.on('data', bytes => {
        buffer += bytes.toString();
        for (;;) {
          const end = buffer.indexOf('\n'); if (end < 0) break;
          const line = buffer.slice(0, end); buffer = buffer.slice(end + 1);
          try { const value = JSON.parse(line); if (value.event === 'server.listening') { clearTimeout(timer); resolve(value.port); } } catch {}
        }
      });
    });
    active = {child, pid: child.pid!, closed};
    origin = 'http://127.0.0.1:' + listening;
    return active.pid;
  }
  t.after(async () => {
    try { await stopProcess(); if (!bootstrapClosed) await bootstrap.app.close(); }
    finally {
      report.finishedAt = new Date().toISOString();
      report.postArchiveSha256 = sha(readFileSync(join(pack, 'plugin.zip')));
      report.postManifestSha256 = sha(readFileSync(join(pack, 'mote-plugin.json')));
      if (process.env.MOTE_R34_EVALUATOR_REPORT) writeFileSync(process.env.MOTE_R34_EVALUATOR_REPORT, JSON.stringify(report, null, 2) + '\n');
      rmSync(directory, {recursive: true, force: true});
    }
  });

  await bootstrap.accounts!.initialize('held-admin-a', password);
  const a = await ok(undefined, '/api/auth/login', 'POST', {username: 'held-admin-a', password, mode: 'client'});
  await ok(a.token, '/api/admin/accounts', 'POST', {username: 'held-owner-b', password});
  const b = await ok(undefined, '/api/auth/login', 'POST', {username: 'held-owner-b', password, mode: 'client'});
  const capabilities = await ok(a.token, '/api/plugins/host-capabilities');
  assert.deepEqual(capabilities.invocationCapabilities.filter((row: any) => row.registered).map((row: any) => row.id).sort(), ['processor', 'source']);
  const preview = await ok(a.token, '/api/plugins/resolve', 'POST', {repository, tag});
  assert.equal(preview.source.digest, fixedArchive);
  await ok(a.token, '/api/plugins/install', 'POST', {previewId: preview.id, expectedRevision: (await ok(a.token, '/api/admin/plugins')).revision, operationId: randomUUID()});
  const catalog = await until(() => ok(a.token, '/api/admin/plugins'), value => value.packages.some((row: any) => row.state === 'installed'), 'Pinned ZIP installation');
  const packageId = catalog.packages.find((row: any) => row.state === 'installed').id;
  assert.ok(archiveDownloads >= 2);
  for (const [owner, label] of [[a, labels.a], [b, labels.b]] as const) {
    const configuration = await ok(owner.token, '/api/configuration');
    const processing = configuration.domains.find((row: any) => row.id === 'processing').effective;
    await ok(owner.token, '/api/configuration/processing', 'PUT', {revision: configuration.revision, value: {...processing, automatic: false, summarize: false, semanticTurns: false}});
    await ok(owner.token, '/api/ingress/sources', 'POST', {id: sourceId, name: 'Held generated source', kind: 'custom', deviceId: 'same-device', platform: 'import', retention: 'archive'});
    await ok(owner.token, '/api/plugin-instances', 'POST', {expectedRevision: (await view(owner.token)).revision, instance: {id: instanceId, packageId, name: 'Held generated pack', configuration: {label}, desired: false, grants: {capabilities: ['source', 'processor'], sourceIds: [sourceId], history: false}}});
    assert.equal((await action(owner.token, 'check')).checked, true);
    await action(owner.token, 'enable');
  }
  const sa = await snapshot(a.token), sb = await snapshot(b.token);
  const ingestedA = await run(a.token, sa.id, {action: 'ingest', sourceId, batchId: key('same-batch'), items: inputA});
  const ingestedB = await run(b.token, sb.id, {action: 'ingest', sourceId, batchId: key('same-batch'), items: inputB});
  assert.equal(ingestedA.result.receipt.captures.length, inputA.length);
  assert.equal(ingestedB.result.receipt.captures.length, inputB.length);
  assert.notEqual(ingestedA.result.pid, ingestedB.result.pid);

  // From this point onward all interaction reaches the real shipped launcher.
  await bootstrap.app.close(); bootstrapClosed = true;
  await until(() => !alive(ingestedA.result.pid) && !alive(ingestedB.result.pid), Boolean, 'Bootstrap workers retired');
  const firstCentralPid = await startShipped();
  const pageA = await run(a.token, sa.id, {action: 'page', sourceId});
  const pageB = await run(b.token, sb.id, {action: 'page', sourceId});
  const aPid = pageA.result.pid, bPid = pageB.result.pid;
  assert.notEqual(aPid, bPid);
  assert.notEqual(aPid, firstCentralPid);
  assert.deepEqual(pageA.result.pages.map((row: any) => row.count), [2, 2, 1]);
  assert.deepEqual(pageA.result.documents.map((row: any) => row.item.text).sort(), inputA.map(row => row.text).sort());
  assert.deepEqual(pageB.result.documents.map((row: any) => row.item.text).sort(), inputB.map(row => row.text).sort());

  async function assertSourceRead(token: string, materialId: string, label: string, items: typeof inputA, captures: any[]) {
    const read = await ok(token, '/api/materials/' + materialId + '/read');
    assert.ok(read.text.startsWith(label + '\n'));
    for (const item of items) assert.equal(read.text.split(item.text).length, 2, 'Each exact independent input occurs once');
    assert.equal(read.text.length, label.length + 1 + items.reduce((length, row) => length + row.text.length, 0) + items.length - 1);
    const members = await ok(token, '/api/materials/' + materialId + '/members');
    assert.deepEqual(members.items.map((row: any) => row.ref).sort(), captures.map(row => 'capture:' + row.id).sort());
    return read;
  }
  const cancelKey = key('cancel-one'), siblingKey = key('same-publication');
  const held = await submit(a.token, sa.id, {action: 'hold-cancel', sourceId, key: cancelKey});
  const entered = await mark(cancelKey, 'started', aPid);
  const operationId = key('same-operation');
  // A and B use identical operation and publication keys in different scopes.
  const sibling = await submit(a.token, sa.id, {action: 'delay-publish', sourceId, key: siblingKey, delayMs: siblingDelayMs}, operationId);
  const other = await submit(b.token, sb.id, {action: 'delay-publish', sourceId, key: siblingKey, delayMs: otherDelayMs}, operationId);
  assert.equal((await mark(siblingKey, 'started', aPid)).pid, entered.pid);
  assert.equal((await mark(siblingKey, 'started', bPid)).pid, bPid);
  assert.equal((await ok(a.token, '/api/tasks/' + sibling.id)).state, 'running');
  assert.equal((await ok(b.token, '/api/tasks/' + other.id)).state, 'running');
  const before = await ok(a.token, '/api/materials');
  await delay(cancellationOffsetMs);
  assert.equal((await ok(a.token, '/api/tasks/' + sibling.id)).state, 'running');
  assert.equal((await ok(b.token, '/api/tasks/' + other.id)).state, 'running');
  const cancellationStarted = Date.now();
  await ok(a.token, '/api/tasks/' + held.id + '/cancel', 'POST', {});
  await terminal(a.token, held.id, 'cancelled');
  const cancelled = await mark(cancelKey, 'cancelled', aPid);
  const observationLatencyMs = Date.now() - cancellationStarted;
  assert.equal(cancelled.signalAborted, true);
  assert.deepEqual(cancelled.cleanup, {aborted: true, timerCleared: true, listenerRemoved: true, pendingWaits: 0});
  assert.deepEqual(cancelled.attempts.map((row: any) => [row.method, row.succeeded]), [['publishMaterial', false], ['emit', false]]);
  assert.equal((await request(a.token, '/api/materials/' + entered.materialId)).status, 404);
  const siblingResult = await terminal(a.token, sibling.id), otherResult = await terminal(b.token, other.id);
  assert.equal(siblingResult.result.pid, aPid);
  assert.equal(otherResult.result.pid, bPid);
  assert.equal(siblingResult.result.materialId, otherResult.result.materialId, 'Material IDs deliberately collide across owners');
  const readA = await assertSourceRead(a.token, siblingResult.result.materialId, labels.a, inputA, ingestedA.result.receipt.captures);
  await assertSourceRead(b.token, otherResult.result.materialId, labels.b, inputB, ingestedB.result.receipt.captures);
  assert.equal((await ok(a.token, '/api/materials')).items.length, before.items.length + 1, 'Only the lawful sibling published for A');
  const eventsA = await ok(a.token, '/api/plugin-events'), eventsB = await ok(b.token, '/api/plugin-events');
  assert.equal(eventsA.items.length, 1); assert.equal(eventsB.items.length, 1);
  assert.equal(JSON.stringify(eventsA).includes('after-cancel'), false);
  assert.equal(JSON.stringify(eventsA).includes(labels.b), false);
  assert.equal(JSON.stringify(eventsB).includes(labels.a), false);
  assert.equal((await request(a.token, '/api/tasks/' + other.id)).status, 404);
  assert.equal((await request(a.token, '/api/plugin-snapshots/' + sb.id + '/invoke', 'POST', {componentId: 'cancel.source', payload: {action: 'page', sourceId}, operationId: randomUUID()})).status, 404);
  await run(a.token, sa.id, {action: 'read-original', originalRef: ingestedB.result.receipt.captures[0].original.ref}, randomUUID(), 'cancel.source', 'blocked');
  assert.ok(alive(aPid) && alive(bPid));
  report.observations.cancellation = {taskId: held.id, cancelled, observationLatencyMs, siblingTaskId: sibling.id, otherTaskId: other.id, aPid, bPid, sourceReadA: readA.text, sameWorkerSurvived: true, lateMaterials: 0, forbiddenEvents: 0};

  // The expected hash comes from independently read original bytes, and its
  // text is checked against evaluator input, never a plugin-provided hash.
  const selected = ingestedA.result.receipt.captures[parseInt(variant('selected-original').slice(0, 4), 16) % inputA.length];
  const original = (await run(a.token, sa.id, {action: 'read-original', originalRef: selected.original.ref})).result;
  const originalBytes = Buffer.from(original.bytes.data), sourceItem = JSON.parse(originalBytes.toString('utf8'));
  const expectedItem = inputA.find(row => row.externalId === sourceItem.externalId)!;
  assert.ok(expectedItem); assert.equal(sourceItem.text, expectedItem.text);
  const expectedText = 'Extracted: ' + expectedItem.text + '\nSHA256: ' + sha(originalBytes);
  const processed = await run(a.token, sa.id, {originalRef: selected.original.ref, key: key('processor')}, key('processor-operation'), 'cancel.processor');
  const artifact = await ok(a.token, '/api/processing/artifacts/' + processed.result.artifactId);
  assert.equal(artifact.originalRef, selected.original.ref);
  assert.deepEqual(artifact.payload, {durationMs: 0, coverage: 'full', engine: 'cancel-pack.generated-text-v1', segments: [{startMs: 0, endMs: 0, text: expectedText}]});
  const processedMaterial = (await ok(a.token, '/api/materials')).items.find((row: any) => row.origin.externalId === 'processed:' + selected.id);
  assert.ok(processedMaterial);
  assert.equal((await ok(a.token, '/api/materials/' + processedMaterial.id + '/read')).text, expectedText);
  assert.ok((await ok(a.token, '/api/materials/' + processedMaterial.id + '/members')).items.some((row: any) => row.ref === 'capture:' + selected.id));
  assert.equal((await request(b.token, '/api/processing/artifacts/' + processed.result.artifactId)).status, 404);
  report.observations.processor = {taskId: processed.id, originalSha256: sha(originalBytes), artifactId: processed.result.artifactId, materialId: processedMaterial.id, exactText: expectedText};

  const drainKey = key('disable-drain');
  const draining = await submit(a.token, sa.id, {action: 'delay-publish', sourceId, key: drainKey, delayMs: 500 + cancellationOffsetMs});
  await mark(drainKey, 'started', aPid);
  await action(a.token, 'disable');
  assert.equal((await request(a.token, '/api/plugin-instances/' + instanceId + '/snapshots', 'POST', {})).status, 409);
  const drained = await terminal(a.token, draining.id);
  await assertSourceRead(a.token, drained.result.materialId, labels.a, inputA, ingestedA.result.receipt.captures);
  const stopKey = key('stop-held');
  const stopped = await submit(a.token, sa.id, {action: 'delay-publish', sourceId, key: stopKey, delayMs: 60000});
  const stopEntered = await mark(stopKey, 'started', aPid);
  const bContinues = await submit(b.token, sb.id, {action: 'delay-publish', sourceId, key: key('other-during-stop'), delayMs: 650 + cancellationOffsetMs});
  await mark(key('other-during-stop'), 'started', bPid);
  await action(a.token, 'stop');
  await until(() => !alive(aPid), Boolean, 'Stop retires only A worker');
  await terminal(a.token, stopped.id, 'stale');
  assert.equal((await request(a.token, '/api/materials/' + stopEntered.materialId)).status, 404);
  assert.equal((await request(a.token, '/api/plugin-snapshots/' + sa.id + '/invoke', 'POST', {componentId: 'cancel.source', payload: {action: 'page', sourceId}, operationId: randomUUID()})).status, 401);
  assert.equal((await terminal(b.token, bContinues.id)).result.pid, bPid);
  const uninstall = await request(a.token, '/api/plugins/' + packageId + '/uninstall', 'POST', {expectedRevision: (await ok(a.token, '/api/admin/plugins')).revision, operationId: randomUUID()});
  assert.equal(uninstall.status, 409);
  assert.deepEqual(await ok(a.token, '/api/materials/' + siblingResult.result.materialId + '/read'), readA);

  await stopProcess();
  await until(() => !alive(bPid), Boolean, 'Process shutdown retires B worker');
  const secondCentralPid = await startShipped();
  assert.notEqual(secondCentralPid, firstCentralPid);
  assert.deepEqual(await ok(a.token, '/api/materials/' + siblingResult.result.materialId + '/read'), readA);
  assert.deepEqual(await ok(a.token, '/api/processing/artifacts/' + processed.result.artifactId), artifact);
  assert.equal((await ok(a.token, '/api/tasks/' + held.id)).state, 'cancelled');
  assert.equal((await request(a.token, '/api/tasks/' + other.id)).status, 404);
  const repeated = await submit(b.token, sb.id, {action: 'delay-publish', sourceId, key: siblingKey, delayMs: otherDelayMs}, operationId);
  assert.equal(repeated.id, other.id);
  assert.equal((await terminal(b.token, repeated.id)).result.materialId, otherResult.result.materialId);
  const afterRestart = await run(b.token, sb.id, {action: 'publish', sourceId, key: key('after-restart')});
  assert.notEqual(afterRestart.result.pid, bPid);
  await assertSourceRead(b.token, afterRestart.result.materialId, labels.b, inputB, ingestedB.result.receipt.captures);
  report.observations.lifecycle = {disableDrainTask: drained.state, stoppedTask: 'stale', lateMaterialsAfterStop: 0, bWorkerSurvivedAStop: true, referencedUninstallHttp: uninstall.status, firstCentralPid, secondCentralPid, entry: 'apps/server/src/index.ts', termination: 'SIGTERM', cancelledTaskRetained: true, repeatedTaskId: repeated.id, completedTaskIdentityRetained: true, inFlightRecovery: 'NOT RUN', packageUpgrade: 'NOT RUN'};
  report.verdict = 'PASS for declared source, extraction, per-task cancellation and scoped lifecycle slices; full P10/P11 remain PARTIAL';
  assert.equal(sha(readFileSync(join(pack, 'plugin.zip'))), fixedArchive);
  assert.equal(sha(readFileSync(join(pack, 'mote-plugin.json'))), fixedManifest);
  t.diagnostic(JSON.stringify({evidence: 'EV-R4-INDEPENDENT-CANCEL', seedCommitment: commitment, fixtureSha256: report.fixtureSha256, archiveSha256: fixedArchive, exactOriginalsA: inputA.length, exactOriginalsB: inputB.length, cancellation: 'PASS', sameWorkerSibling: 'PASS', simultaneousOwnerB: 'PASS', processor: 'PASS', disableDrain: 'PASS', stopFence: 'PASS', actualShippedRestart: 'PASS for completed work', packageUpgrade: 'NOT RUN', inFlightRecovery: 'NOT RUN', modelCalls: 0}));
});
