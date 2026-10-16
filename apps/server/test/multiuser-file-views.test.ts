import test, {type TestContext} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {gunzipSync} from 'node:zlib';
import {buildApp} from '../src/app.js';
import {bytesHash} from '../src/scope/originals.js';
import {defaultProcessingSettings} from '../src/scope/processing-schema.js';
import {waitForScopedState} from './fixtures/scoped-process.js';

async function fixture(t: TestContext) {
  const directory = mkdtempSync(join(tmpdir(), 'mote-joint-files-'));
  const host = await buildApp({dataDir: directory});
  t.after(async () => { await host.app.close(); rmSync(directory, {recursive: true, force: true}); });
  const password = 'Generated-joint-files-password';
  const headers = {'x-mote-protocol-version': '2', 'x-mote-ingress-version': '3'};
  const request = (token: string | undefined, url: string, method: any = 'GET', payload?: unknown, extra = {}) => host.app.inject({method, url, headers: {...headers, ...(token ? {authorization: 'Bearer ' + token} : {}), ...extra}, ...(payload === undefined ? {} : {payload})});
  const checked = async (...args: Parameters<typeof request>) => {
    const response = await request(...args); assert.equal(response.statusCode, 200, response.body); return response.json();
  };
  await host.accounts!.initialize('generated-admin', password);
  const login = (username: string) => checked(undefined, '/api/auth/login', 'POST', {username, password, mode: 'client'});
  const admin = await login('generated-admin');
  for (const username of ['generated-a', 'generated-b']) await checked(admin.token, '/api/admin/accounts', 'POST', {username, password});
  const a = await login('generated-a'), b = await login('generated-b');
  for (const account of [a, b]) {
    await checked(account.token, '/api/ingress/sources', 'POST', {id: 'same-source', name: 'Generated files', kind: 'local-files', deviceId: 'same-device', platform: 'import', retention: 'archive'});
    const view = await checked(account.token, '/api/configuration');
    await checked(account.token, '/api/configuration/processing', 'PUT', {revision: view.revision, value: {...defaultProcessingSettings(), automatic: false, summarize: false, semanticTurns: false}});
  }
  const upload = async (token: string, externalId: string, text: string) => {
    const bytes = Buffer.from(text), hash = bytesHash(bytes);
    const input = await checked(token, '/api/ingress/sources/same-source/uploads', 'POST', {batchId: externalId, revision: {sourceId: 'same-source', previousRevision: null, sizeBytes: bytes.length, sha256: hash, relativePath: externalId + '.txt', item: {externalId, revision: 'same-r1', observedAt: '2026-10-16T00:00:00Z', title: externalId, text: '', kind: 'file', layer: 'original', mimeType: 'text/plain'}}});
    await checked(token, '/api/ingress/uploads/' + input.id + '/parts/0', 'PUT', {bytes: bytes.toString('base64'), checksum: hash});
    return (await checked(token, '/api/ingress/uploads/' + input.id + '/commit', 'POST', {})).captures[0];
  };
  return {host, a, b, admin, request, checked, upload};
}

test('actual file views retain originals, current M06 text, owned paging and authenticated ranged playback for equal A/B IDs', async t => {
  const f = await fixture(t), text = 'Generated A original, complete tail Ω🙂';
  const a = await f.upload(f.a.token, 'same-file', text), b = await f.upload(f.b.token, 'same-file', 'Generated B private file');
  assert.equal(a.id, b.id, 'same external identity intentionally collides across accounts');
  const extra = await f.upload(f.a.token, 'second-file', 'Generated A second file');
  const foreign = await f.upload(f.b.token, 'b-only-file', 'Generated B only');
  const pending = await f.checked(f.a.token, '/api/files/' + a.id);
  assert.equal(pending.captureId, a.id); assert.equal(pending.hasOriginal, true);
  assert.equal(pending.processing.processed, false); assert.equal(pending.processing.indexed, false);
  const task = await f.checked(f.a.token, '/api/processing', 'POST', {originalRef: a.original.ref, operationId: 'same-manual-file'});
  await waitForScopedState(async () => (await f.checked(f.a.token, '/api/tasks/' + task.id)).state === 'succeeded', () => 'actual M06 file extraction did not complete');
  const detail = await f.checked(f.a.token, '/api/files/' + a.id);
  assert.equal(detail.processing.indexed, true);
  const chunks = await f.checked(f.a.token, '/api/files/' + a.id + '/chunks?offset=0');
  assert.equal(chunks.items.map((x: any) => x.ocrText).join(''), text);
  assert.equal(chunks.items[0].fileEvidence.artifactId, detail.processing.artifactId);
  const first = await f.checked(f.a.token, '/api/files?limit=1');
  assert.equal(first.items.length, 1); assert.ok(first.nextCursor);
  const second = await f.checked(f.a.token, '/api/files?limit=1&cursor=' + encodeURIComponent(first.nextCursor));
  assert.deepEqual(new Set([...first.items, ...second.items].map((x: any) => x.captureId)), new Set([a.id, extra.id]));
  assert.equal((await f.request(f.b.token, '/api/files?limit=1&cursor=' + encodeURIComponent(first.nextCursor))).statusCode, 400);
  assert.equal((await f.request(f.a.token, '/api/files/' + foreign.id)).statusCode, 404);
  assert.equal((await f.request(f.admin.token, '/api/files/' + a.id)).statusCode, 404);
  const playback = await f.checked(f.a.token, '/api/files/' + a.id + '/playback', 'POST', {});
  const content = await f.request(f.a.token, playback.url, 'GET', undefined, {range: 'bytes=3-12'});
  assert.equal(content.statusCode, 206); assert.deepEqual(content.rawPayload, Buffer.from(text).subarray(3, 13));
  assert.equal((await f.request(f.b.token, playback.url)).statusCode, 404);
  const exported = await f.request(f.a.token, '/api/files/' + a.id + '/export');
  assert.equal(exported.statusCode, 200, exported.body);
  const archive = gunzipSync(exported.rawPayload).toString();
  assert.ok(archive.includes(text)); assert.ok(!archive.includes('Generated B'));
  assert.equal((await f.request(undefined, '/api/files')).statusCode, 401);
  assert.equal((await f.checked(f.b.token, '/api/files/' + b.id)).processing.processed, false);
});
