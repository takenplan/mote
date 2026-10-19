import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn, type ChildProcess} from 'node:child_process';
import {randomUUID, createHash} from 'node:crypto';
import {mkdtemp, readFile, writeFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {setTimeout as delay} from 'node:timers/promises';
import {makeRelease, componentIds, generatedPassword} from '../../../plugins/extension-benchmark/final-pack/release.mjs';

const pack = new URL('../../../plugins/extension-benchmark/final-pack/', import.meta.url);
const hostScript = fileURLToPath(new URL('http-host.ts', pack));
const hash = (value: string | Uint8Array) => createHash('sha256').update(value).digest('hex');
const terminal = new Set(['succeeded', 'failed', 'blocked', 'stale', 'cancelled']);

async function until<T>(read: () => Promise<T>, done: (value: T) => boolean, label: string, timeout = 20000): Promise<T> {
  const end = Date.now() + timeout;
  for (;;) {
    const value = await read();
    if (done(value)) return value;
    assert.ok(Date.now() < end, label + ': ' + JSON.stringify(value));
    await delay(10);
  }
}

async function launch(vault: string, initialize: boolean) {
  const child = spawn(process.execPath, ['--import', 'tsx', hostScript], {
    env: {...process.env, MOTE_EXTENSION_FINAL_VAULT: vault, MOTE_EXTENSION_FINAL_INITIALIZE: initialize ? '1' : '0'},
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let stdout = '', stderr = '', base = '';
  const closed = new Promise<{code: number | null; signal: NodeJS.Signals | null}>(resolve => child.once('close', (code, signal) => resolve({code, signal})));
  child.stderr!.on('data', part => { stderr = (stderr + String(part)).slice(-16000); });
  child.stdout!.on('data', part => {
    stdout += String(part);
    for (;;) {
      const end = stdout.indexOf('\n'); if (end < 0) break;
      const line = stdout.slice(0, end); stdout = stdout.slice(end + 1);
      try { const event = JSON.parse(line); if (event.phase === 'listening') base = event.base; } catch {}
    }
  });
  await until(async () => ({base, code: child.exitCode, stderr}), value => {
    if (value.code !== null) throw Error('Host startup failed: ' + value.stderr);
    return Boolean(value.base);
  }, 'actual HTTP listener', 30000);
  return {child, base, closed, stderr: () => stderr};
}

test('Round 5 fresh source/processor release: public finance, scope, version pinning and real process history', {timeout: 120000}, async t => {
  const startedAt = new Date().toISOString(), started = Date.now();
  const directory = await mkdtemp(join(tmpdir(), 'mote-extension-final-'));
  const inputs = JSON.parse(await readFile(new URL('visible-inputs.json', pack), 'utf8'));
  const spec = JSON.parse(await readFile(new URL('../../../docs/validation/plugin-extension-benchmark/cases.json', import.meta.url), 'utf8'));
  const expected = spec.fixtures['finance-visible-v1'].expected;
  const processes: ChildProcess[] = [], snapshots: {token: string; id: string}[] = [];
  const observations: Record<string, any> = {startedAt, liveModelCalls: 0, developmentTokens: null, developmentCost: null,
    baselineCommit: '88fb30af6cc70d369625f4b1350e78f01e207650', coreChanges: 0, privateRuntimeImports: 0,
    hostAdaptersAdded: 0, coverage: 'actual-process loopback HTTP through buildScopedApp'};
  let node = await launch(join(directory, 'vault'), true); processes.push(node.child);
  t.after(async () => {
    for (const child of processes) if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
    await rm(directory, {recursive: true, force: true});
  });
  const request = async (token: string | undefined, path: string, method = 'GET', payload?: unknown) => {
    const response = await fetch(node.base + path, {method, headers: {
      'x-mote-protocol-version': '2', 'x-mote-ingress-version': '3',
      ...(token ? {authorization: 'Bearer ' + token} : {}),
      ...(payload === undefined ? {} : {'content-type': 'application/json'}),
    }, ...(payload === undefined ? {} : {body: JSON.stringify(payload)})});
    const text = await response.text();
    let body: any; try {body = JSON.parse(text);} catch {body = text;}
    return {status: response.status, body};
  };
  const ok = async (token: string | undefined, path: string, method = 'GET', payload?: unknown) => {
    const response = await request(token, path, method, payload);
    assert.equal(response.status, 200, path + ' ' + JSON.stringify(response.body));
    return response.body;
  };
  const login = (username: string) => ok(undefined, '/api/auth/login', 'POST', {username, password: generatedPassword, mode: 'client'});
  const admin = await login('round5-admin');
  for (const username of ['round5-a', 'round5-b']) await ok(admin.token, '/api/admin/accounts', 'POST', {username, password: generatedPassword});
  const a = await login('round5-a'), b = await login('round5-b');
  observations.accountIsolation = {distinctActualAccounts: a.userId !== b.userId, sameInstanceId: 'same-instance', sameSourceId: 'source-bank'};

  // Capability discovery happens before installing any release or admitting work.
  const caps = await ok(a.token, '/api/plugins/host-capabilities');
  assert.equal((await ok(admin.token, '/api/admin/plugins')).packages.length, 0);
  assert.deepEqual(caps.factoryExports, ['createMotePlugin', 'createMemoryProvider']);
  for (const id of ['source', 'processor']) assert.equal(caps.invocationCapabilities.find((value: any) => value.id === id).registered, true);
  assert.deepEqual(caps.invocationCapabilities.find((value: any) => value.id === 'model'), {id: 'model', registered: false, reason: 'scoped_domain_unavailable'});
  observations.preinstallHostCapabilities = caps;
  observations.fullE01 = {status: 'FAIL', reason: 'NO_EXTENSION_POINT', detail: 'Default generic worker has no model adapter or external automatic insight admission; source Material alone is not full E01.'};
  const trigger = await request(a.token, '/api/ask-automations', 'POST', {
    id: randomUUID(), kind: 'benchmark-periodic-v1', sourceIds: ['source-bank'], intervalMs: 60000,
    componentId: componentIds.source, includeExisting: false,
  });
  assert.equal(trigger.status, 400);
  assert.equal((await ok(a.token, '/api/ask-automations')).items.length, 0);
  observations.customTrigger = {status: 'FAIL', reason: 'NO_EXTENSION_POINT', admission: trigger, actualCallbackExecuted: false};

  const install = async (version = '1.0.0', variant = 'finance') => {
    const release = await makeRelease(version, variant);
    assert.equal(hash(release.archive), release.manifest.archive.sha256);
    const preview = await ok(admin.token, '/api/plugins/resolve', 'POST', {repository: release.repository, tag: release.tag});
    const catalog = await ok(admin.token, '/api/admin/plugins');
    await ok(admin.token, '/api/plugins/install', 'POST', {previewId: preview.id, expectedRevision: catalog.revision, operationId: randomUUID()});
    const installed = await until(() => ok(admin.token, '/api/admin/plugins'), value => value.packages.some((pkg: any) =>
      pkg.source.digest === release.manifest.archive.sha256 && pkg.state === 'installed'), 'fixed release installed');
    const pkg = installed.packages.find((pkg: any) => pkg.source.digest === release.manifest.archive.sha256);
    return {...release, packageId: pkg.id};
  };
  const view = (token: string) => ok(token, '/api/plugins');
  const configure = async (token: string, id: string, packageId: string, capabilities: string[], sourceIds: string[]) =>
    ok(token, '/api/plugin-instances', 'POST', {expectedRevision: (await view(token)).revision, instance: {
      id, packageId, name: 'Generated ' + id, configuration: packageId.includes('native') ? {} : {pageLimit: 7}, desired: false,
      grants: {capabilities, sourceIds, history: false},
    }});
  const action = async (token: string, id: string, action: string) => ok(token, '/api/plugin-instances/' + id + '/' + action, 'POST',
    action === 'check' ? {} : {expectedRevision: (await view(token)).revision});
  const admit = async (token: string, id = 'same-instance') => {
    const snapshot = await ok(token, '/api/plugin-instances/' + id + '/snapshots', 'POST', {});
    snapshots.push({token, id: snapshot.id}); return snapshot;
  };
  const submit = (token: string, snapshot: any, componentId: string, payload: any, operationId = randomUUID()) =>
    ok(token, '/api/plugin-snapshots/' + snapshot.id + '/invoke', 'POST', {componentId, payload: {...payload, operationId}, operationId});
  const task = (token: string, id: string) => until(() => ok(token, '/api/tasks/' + id), value => terminal.has(value.state), 'terminal task');
  const success = async (token: string, job: any) => {
    const value = await task(token, job.id); assert.equal(value.state, 'succeeded', JSON.stringify(value)); return value;
  };
  const scan = (token: string, snapshot: any, sourceIds: string[], month = '2026-09', operationId = randomUUID()) =>
    submit(token, snapshot, componentIds.source, {sourceIds, month}, operationId);
  const allEvents = async (token: string) => {
    let since = 0; const result: any[] = [];
    for (;;) {
      const page = await ok(token, '/api/plugin-events?since=' + since);
      result.push(...page.items); if (page.items.length < 100) return result;
      since = page.items.at(-1).sequence;
    }
  };
  const entered = async (token: string, operationId: string) => until(() => allEvents(token), value => value.some((event: any) =>
    event.value.operationId === operationId && event.value.phase === 'semantic.input'), 'semantic fixture entered');
  const readMaterial = async (token: string, id: string, revision?: string) => {
    let offset = 0, text = ''; const spans: any[] = [];
    for (;;) {
      const page = await ok(token, '/api/materials/' + id + '/read?offset=' + offset + (revision ? '&revision=' + revision : ''));
      text += page.text; spans.push(...page.spans);
      if (page.textRange.nextOffset === null) return {text, spans, material: page.material};
      offset = page.textRange.nextOffset;
    }
  };
  const materialId = (sourceIds: string[], month: string) => {
    const sources = [...sourceIds].sort(), externalId = 'finance-month:' + month + ':' + hash(JSON.stringify(sources));
    return 'mat_' + hash(JSON.stringify([sources[0], externalId]));
  };

  const native = await install('1.0.0', 'native');
  await configure(a.token, 'native-boundary', native.packageId, ['source'], ['source-bank']);
  const nativeCheck = await request(a.token, '/api/plugin-instances/native-boundary/check', 'POST', {});
  assert.notEqual(nativeCheck.status, 200);
  observations.nativeHarness = {status: 'FAIL', reason: 'NO_EXTENSION_POINT', archiveSha256: native.manifest.archive.sha256,
    nativeFileSha256: hash(await readFile(new URL('native-apply.mjs', pack))), check: nativeCheck,
    supportedFactoryExports: caps.factoryExports, toolExecuted: false, scope: 'apply-only worker ABI boundary, not native Harness execution'};

  const v1 = await install();
  const aSources = ['source-bank', 'source-notice', 'source-email'], aGrants = [...aSources, 'source-hold'];
  const bGrants = ['source-bank', 'source-hold'];
  for (const token of [a.token, b.token]) {
    for (const id of ['source-bank', 'source-notice', 'source-email', 'source-hold', 'source-ungranted']) {
      await ok(token, '/api/ingress/sources', 'POST', {id, name: 'Generated ' + id, kind: 'coding-agent', deviceId: 'same-device', platform: 'import', retention: 'archive'});
    }
    await configure(token, 'same-instance', v1.packageId, ['source'], token === a.token ? aGrants : bGrants);
    await configure(token, 'processor-instance', v1.packageId, ['processor'], ['source-bank']);
    for (const id of ['same-instance', 'processor-instance']) {await action(token, id, 'check'); await action(token, id, 'enable');}
  }
  const as = await admit(a.token), bs = await admit(b.token), ap = await admit(a.token, 'processor-instance'), bp = await admit(b.token, 'processor-instance');
  assert.equal(as.digest, v1.manifest.archive.sha256);
  const receipts = new Map<string, any>();
  for (const [token, snapshot, rows] of [[a.token, as, inputs.a], [b.token, bs, inputs.b], [a.token, as, inputs.hold], [b.token, bs, inputs.hold]] as const) {
    for (const sourceId of new Set<string>(rows.map((row: any) => row.sourceId))) {
      const batchId = 'visible-' + sourceId, items = rows.filter((row: any) => row.sourceId === sourceId).map((row: any) => row.item);
      const received = await success(token, await submit(token, snapshot, componentIds.source, {mode: 'receive', sourceId, batchId, items}));
      receipts.set(token + ':' + sourceId, received.result);
    }
  }
  assert.equal((await allEvents(a.token)).length, 0);
  assert.equal((await allEvents(b.token)).length, 0);
  observations.installOnly = {semanticCalls: 0, historyScans: 0, sourceIntakeViaRealWorker: true};
  const initialOperation = randomUUID(), initial = await success(a.token, await scan(a.token, as, aSources, '2026-09', initialOperation));
  observations.firstSuccessAt = new Date().toISOString(); observations.firstSuccessElapsedMs = Date.now() - started;
  const body = await readMaterial(a.token, initial.result.materialId), ledger = JSON.parse(body.text);
  assert.deepEqual(ledger.statistics, {totalObservations: expected.totalObservations, normalizedObservations: 39,
    uniqueTransactions: expected.uniqueTransactions, noiseObservations: expected.noiseObservations,
    repeatedObservations: expected.repeatedObservations, monthlyCharges: expected.septemberCharges, monthlyRefunds: expected.septemberRefunds});
  assert.deepEqual(ledger.totals, {grossCents: expected.septemberGrossCents, refundCents: expected.septemberRefundCents, netCents: expected.septemberNetCents});
  assert.deepEqual(ledger.pagesBySource, {'source-bank': 3, 'source-email': 2, 'source-notice': 3});
  assert.deepEqual(ledger.transactions.map((row: any) => row.transactionId).sort(), spec.cases[0].oracle.exactLedgerTransactionIds.slice().sort());
  const members = await ok(a.token, '/api/materials/' + initial.result.materialId + '/members?limit=200');
  assert.equal(members.items.length, 43);
  const refs = aSources.flatMap(sourceId => receipts.get(a.token + ':' + sourceId).captures.map((item: any) => item.original.ref)).sort();
  assert.deepEqual(ledger.inputs.map((item: any) => item.originalRef).sort(), refs);
  for (const row of ledger.allTransactions) {
    assert.ok(row.evidenceIds.length > 0);
    for (const evidence of row.evidence) assert.ok(members.items.some((member: any) => member.ref === 'capture:' + evidence.captureId && member.locator.originalRef === evidence.originalRef));
    if (row.kind === 'refund') assert.equal(ledger.allTransactions.find((value: any) => value.transactionId === row.refundOf)?.kind, 'payment');
  }
  assert.deepEqual(ledger.allTransactions.find((value: any) => value.transactionId === 'P01').sourceIds, ['source-bank', 'source-notice']);
  const events = await allEvents(a.token), semantic = events.filter((event: any) => event.value.operationId === initialOperation);
  assert.equal(semantic.length, 43);
  for (const event of semantic) {
    const original = ledger.inputs.find((item: any) => item.originalRef === event.value.originalRef);
    assert.equal(hash(event.value.text), original.sha256);
  }
  const duplicate = await scan(a.token, as, aSources, '2026-09', initialOperation);
  assert.equal(duplicate.id, initial.id);
  assert.equal((await allEvents(a.token)).length, events.length);
  const repeated = await success(a.token, await scan(a.token, as, aSources));
  assert.equal(repeated.result.materialId, initial.result.materialId);
  assert.equal(repeated.result.revision, initial.result.revision);
  observations.source = {status: 'PASS', taskId: initial.id, materialId: initial.result.materialId, revision: initial.result.revision,
    statistics: ledger.statistics, totals: ledger.totals, pagesBySource: ledger.pagesBySource, formalMembers: members.items.length,
    modelFixtureRequests: semantic.length, allInputHashesMatch: true, exactOriginalRefsRetained: true, idempotentTask: true, idempotentMaterial: true};

  const bResult = await success(b.token, await scan(b.token, bs, ['source-bank']));
  const bLedger = JSON.parse((await readMaterial(b.token, bResult.result.materialId)).text);
  assert.equal(bLedger.totals.netCents, 987654321);
  assert.equal(body.text.includes('987654321'), false);
  const aOriginal = receipts.get(a.token + ':source-bank').captures[0].original.ref;
  const bOriginal = receipts.get(b.token + ':source-bank').captures[0].original.ref;
  assert.notEqual(aOriginal, bOriginal);
  const foreignTask = await request(a.token, '/api/tasks/' + bResult.id), foreignSnapshot = await request(a.token, '/api/plugin-snapshots/' + bs.id + '/invoke', 'POST', {componentId: componentIds.source, payload: {sourceIds: ['source-bank'], month: '2026-09'}, operationId: randomUUID()});
  assert.equal(foreignTask.status, 404); assert.equal(foreignSnapshot.status, 404);
  assert.equal((await request(admin.token, '/api/tasks/' + bResult.id)).status, 404);
  assert.equal((await request(admin.token, '/api/materials/' + bResult.result.materialId)).status, 404);
  const deniedSource = await task(a.token, (await scan(a.token, as, ['source-ungranted'])).id);
  assert.equal(deniedSource.state, 'blocked');
  const deniedOriginal = await task(a.token, (await submit(a.token, ap, componentIds.processor, {originalRef: bOriginal})).id);
  assert.equal(deniedOriginal.state, 'blocked');
  const sameOwnerUngrant = await task(a.token, (await submit(a.token, ap, componentIds.processor, {
    originalRef: receipts.get(a.token + ':source-hold').captures[0].original.ref,
  })).id);
  assert.equal(sameOwnerUngrant.state, 'blocked');
  assert.equal(JSON.stringify(await allEvents(a.token)).includes('BETA-PRIVATE-9374'), false);
  assert.equal(JSON.stringify(await allEvents(b.token)).includes('bankCsvRows'), false);
  observations.isolation = {status: 'PASS', foreignTask, foreignSnapshot, foreignOriginalState: deniedOriginal.state,
    ungrantedSourceState: deniedSource.state, administratorForeignPrivateReads: 0, aNet: ledger.totals.netCents, bNet: bLedger.totals.netCents};

  const processed = await success(a.token, await submit(a.token, ap, componentIds.processor, {originalRef: aOriginal}));
  const artifact = await ok(a.token, '/api/processing/artifacts/' + processed.result.artifactId);
  assert.equal(artifact.originalRef, aOriginal);
  assert.equal(artifact.payload.engine, 'final-text-normalizer-1.0.0');
  assert.equal(artifact.payload.segments[0].text, inputs.a[0].item.text.replace(/\r\n?/g, '\n').trim());
  const materials = await ok(a.token, '/api/materials?limit=200');
  let processorMaterial: any;
  for (const material of materials.items) if (material.id !== initial.result.materialId) {
    const text = (await readMaterial(a.token, material.id)).text;
    if (text.trim() === artifact.payload.segments[0].text) {processorMaterial = material; break;}
  }
  assert.ok(processorMaterial, 'stageExtraction must commit a readable formal Material');
  assert.ok((await ok(a.token, '/api/materials/' + processorMaterial.id + '/members')).items.some((member: any) => member.ref === 'capture:' + receipts.get(a.token + ':source-bank').captures[0].id));
  observations.processor = {status: 'PASS', taskId: processed.id, artifactId: artifact.id, originalRef: artifact.originalRef,
    materialId: processorMaterial.id, text: artifact.payload.segments[0].text, qualityClaim: false};

  const upgradeOperation = randomUUID(), oldHeld = await scan(a.token, as, ['source-hold'], '2026-09', upgradeOperation);
  await entered(a.token, upgradeOperation);
  const v11 = await install('1.1.0');
  assert.notEqual(v11.packageId, v1.packageId); assert.notEqual(v11.manifest.archive.sha256, v1.manifest.archive.sha256);
  assert.equal((await ok(a.token, '/api/tasks/' + oldHeld.id)).state, 'running', 'old task must still be in flight at actual version replacement');
  await configure(a.token, 'same-instance', v11.packageId, ['source'], aGrants);
  await action(a.token, 'same-instance', 'check'); await action(a.token, 'same-instance', 'enable');
  const newer = await admit(a.token);
  assert.equal(newer.version, '1.1.0'); assert.equal(as.version, '1.0.0');
  const afterUpgrade = await scan(a.token, newer, ['source-hold']);
  const oldResult = await success(a.token, oldHeld), newResult = await success(a.token, afterUpgrade);
  assert.equal(oldResult.result.releaseVersion, '1.0.0'); assert.equal(newResult.result.releaseVersion, '1.1.0');
  const oldVersionRead = JSON.parse((await readMaterial(a.token, oldResult.result.materialId, oldResult.result.revision)).text);
  assert.equal(oldVersionRead.releaseVersion, '1.0.0');
  observations.upgrade = {status: 'PASS', before: {snapshot: as, taskId: oldHeld.id, resultVersion: oldResult.result.releaseVersion},
    after: {snapshot: newer, taskId: afterUpgrade.id, resultVersion: newResult.result.releaseVersion}, oldTaskRunningAtUpgrade: true, oldVersionHistoryReadable: true};

  const drainOperation = randomUUID(), draining = await scan(a.token, newer, ['source-hold'], '2026-08', drainOperation);
  await entered(a.token, drainOperation);
  await action(a.token, 'same-instance', 'disable');
  assert.equal((await request(a.token, '/api/plugin-instances/same-instance/snapshots', 'POST', {})).status, 409);
  await success(a.token, draining);
  assert.equal(JSON.parse((await readMaterial(a.token, initial.result.materialId)).text).totals.netCents, 83335);
  const beforeGap = (await allEvents(a.token)).length;
  await ok(a.token, '/api/ingress/sources/source-bank/items', 'POST', {batchId: 'disabled-gap', items: [{
    externalId: 'disabled-gap', revision: '1', observedAt: '2026-10-19T00:00:00Z', title: 'Disabled gap', text: 'Generated disabled gap', kind: 'message', layer: 'original',
  }]});
  await action(a.token, 'same-instance', 'enable');
  await delay(40);
  assert.equal((await allEvents(a.token)).length, beforeGap);
  await success(b.token, await submit(b.token, bp, componentIds.processor, {originalRef: bOriginal}));
  observations.disable = {status: 'PASS', newAdmissionHttp: 409, authorizedDrainCompleted: true, lawfulHistoryReadable: true,
    siblingProcessorCompleted: true, implicitGapBackfill: 0};

  const cancelOperation = randomUUID(), cancelJob = await scan(a.token, newer, ['source-hold'], '2026-10', cancelOperation);
  await entered(a.token, cancelOperation);
  const sameWorkerSibling = await scan(a.token, newer, ['source-hold'], '2026-11');
  await ok(a.token, '/api/tasks/' + cancelJob.id + '/cancel', 'POST', {});
  assert.equal((await task(a.token, cancelJob.id)).state, 'cancelled');
  await success(a.token, sameWorkerSibling);
  assert.equal((await request(a.token, '/api/materials/' + materialId(['source-hold'], '2026-10'))).status, 404);
  observations.cancel = {status: 'PASS', cancelledTask: cancelJob.id, sameWorkerSiblingTask: sameWorkerSibling.id, latePublication: 0};

  await configure(a.token, 'revocation-instance', v11.packageId, ['source'], ['source-hold']);
  await action(a.token, 'revocation-instance', 'check'); await action(a.token, 'revocation-instance', 'enable');
  const revocable = await admit(a.token, 'revocation-instance'), revokeOperation = randomUUID();
  const revokeJob = await scan(a.token, revocable, ['source-hold'], '2026-12', revokeOperation);
  await entered(a.token, revokeOperation);
  await configure(a.token, 'revocation-instance', v11.packageId, ['source'], []);
  assert.equal((await task(a.token, revokeJob.id)).state, 'stale');
  assert.equal((await request(a.token, '/api/plugin-snapshots/' + revocable.id + '/invoke', 'POST', {componentId: componentIds.source, payload: {sourceIds: ['source-hold'], month: '2026-12'}, operationId: randomUUID()})).status, 401);
  assert.equal((await request(a.token, '/api/materials/' + materialId(['source-hold'], '2026-12'))).status, 404);
  observations.sourceRevocation = {status: 'PASS', revokedTask: revokeJob.id, latePublication: 0, oldSnapshotHttp: 401};

  const stopOperation = randomUUID(), stopping = await scan(a.token, newer, ['source-hold'], '2027-01', stopOperation);
  await entered(a.token, stopOperation);
  const bConcurrent = await scan(b.token, bs, ['source-hold'], '2027-01');
  await action(a.token, 'same-instance', 'stop');
  assert.equal((await task(a.token, stopping.id)).state, 'stale');
  await success(b.token, bConcurrent);
  assert.equal((await request(a.token, '/api/materials/' + materialId(['source-hold'], '2027-01'))).status, 404);
  assert.equal((await request(a.token, '/api/plugin-snapshots/' + newer.id + '/invoke', 'POST', {componentId: componentIds.source, payload: {sourceIds: ['source-hold'], month: '2027-01'}, operationId: randomUUID()})).status, 401);
  // The separate processor instance survives source instance disposal.
  await success(a.token, await submit(a.token, ap, componentIds.processor, {originalRef: aOriginal}));
  observations.stop = {status: 'PASS', staleTask: stopping.id, bConcurrentTask: bConcurrent.id, latePublication: 0, siblingProcessorCompleted: true};

  const catalog = await ok(admin.token, '/api/admin/plugins');
  const referenced = await request(admin.token, '/api/plugins/' + encodeURIComponent(v1.packageId) + '/uninstall', 'POST', {expectedRevision: catalog.revision, operationId: randomUUID()});
  assert.equal(referenced.status, 409);
  const oldPid = node.child.pid;
  node.child.kill('SIGTERM');
  assert.deepEqual(await node.closed, {code: 0, signal: null});
  node = await launch(join(directory, 'vault'), false); processes.push(node.child);
  assert.notEqual(node.child.pid, oldPid);
  assert.equal((await ok(a.token, '/api/tasks/' + initial.id)).id, initial.id);
  assert.equal((await ok(a.token, '/api/tasks/' + initial.id)).state, 'succeeded');
  assert.equal(JSON.parse((await readMaterial(a.token, initial.result.materialId)).text).totals.netCents, 83335);
  assert.equal(JSON.parse((await readMaterial(b.token, bResult.result.materialId)).text).totals.netCents, 987654321);
  assert.equal((await ok(a.token, '/api/processing/artifacts/' + artifact.id)).payload.segments[0].text, artifact.payload.segments[0].text);
  assert.equal((await request(a.token, '/api/tasks/' + bResult.id)).status, 404);
  // A retained v1 B snapshot still executes the exact old plugin in the new host process.
  const afterRestart = await success(b.token, await scan(b.token, bs, ['source-bank']));
  assert.equal(afterRestart.result.releaseVersion, '1.0.0');
  observations.restart = {status: 'PASS', oldPid, newPid: node.child.pid, taskIdentityRetained: true,
    historyReadable: true, oldSnapshotVersion: afterRestart.result.releaseVersion, inFlightCrashRecovery: 'NOT RUN'};

  for (const snapshot of snapshots) await ok(snapshot.token, '/api/plugin-snapshots/' + snapshot.id, 'DELETE');
  for (const token of [a.token, b.token]) await ok(token, '/api/configuration/pluginInstances', 'PUT', {revision: (await view(token)).revision, value: {instances: []}});
  for (const release of [v1, v11]) {
    const catalog = await ok(admin.token, '/api/admin/plugins');
    await ok(admin.token, '/api/plugins/' + encodeURIComponent(release.packageId) + '/uninstall', 'POST', {expectedRevision: catalog.revision, operationId: randomUUID()});
  }
  assert.equal(JSON.parse((await readMaterial(a.token, initial.result.materialId)).text).totals.netCents, 83335);
  assert.equal((await ok(a.token, '/api/processing/artifacts/' + artifact.id)).originalRef, aOriginal);
  observations.uninstall = {status: 'PASS', referencedUninstallHttp: referenced.status, releasedThenUninstalled: true, lawfulHistorySurvived: true};
  observations.finishedAt = new Date().toISOString(); observations.elapsedMs = Date.now() - started;
  observations.remaining = ['Full E01 insight/query/UI', 'E08 image semantic products', 'E10 in-flight crash recovery', 'E11 model-resource/export branch', 'Native/browser/live-model quality'];
  if (process.env.MOTE_EXTENSION_FINAL_REPORT) {
    await writeFile(process.env.MOTE_EXTENSION_FINAL_REPORT, JSON.stringify(observations, null, 2) + '\n');
  }
  t.diagnostic(JSON.stringify({elapsedMs: observations.elapsedMs, sourceNetCents: ledger.totals.netCents,
    formalOriginalMembers: members.items.length, realProcesses: [oldPid, node.child.pid], fullE01: 'FAIL/NO_EXTENSION_POINT', liveModelCalls: 0}));
  node.child.kill('SIGTERM');
  assert.deepEqual(await node.closed, {code: 0, signal: null});
});
