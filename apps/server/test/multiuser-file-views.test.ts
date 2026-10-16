import test from 'node:test';
import assert from 'node:assert/strict';
import {gunzipSync} from 'node:zlib';
import {fileEvidenceSchema} from '../../../packages/shared/src/files.js';
import {waitForScopedState} from './fixtures/scoped-process.js';
import {scopedFilesFixture as fixture} from './fixtures/scoped-files.js';

test('a retained source-item JSON envelope is not an external file original or playback/download authority',async t=>{
  const f=await fixture(t),file=await f.upload(f.a.token,'real-file','Generated actual file original');
  const result=await f.checked(f.a.token,'/api/ingress/sources/same-source/items','POST',{batchId:'generated-reference-envelope',items:[{externalId:'reference-only-file',revision:'r1',observedAt:'2026-10-16T00:00:00Z',title:'Generated reference-only file',text:'Generated retained reference text',kind:'file',layer:'original'}]});
  const reference=result.captures[0];assert.ok(reference.original,'the archive policy retains its JSON envelope');
  assert.deepEqual((await f.checked(f.a.token,'/api/files')).items.map((item:any)=>item.captureId),[file.id]);
  for(const path of ['', '/chunks','/export'])assert.equal((await f.request(f.a.token,'/api/files/'+reference.id+path)).statusCode,404,path);
  assert.equal((await f.request(f.a.token,'/api/files/'+reference.id+'/playback','POST',{})).statusCode,404);
  assert.equal((await f.request(f.a.token,'/api/captures/'+reference.id)).statusCode,200,'reference capture remains a legitimate owned source record');
  assert.equal((await f.checked(f.a.token,'/api/files/'+file.id)).hasOriginal,true,'actual M03 external file stays available');
});

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
  fileEvidenceSchema.parse(chunks.items[0].fileEvidence);
  const first = await f.checked(f.a.token, '/api/files?limit=1');
  assert.equal(first.items.length, 1); assert.ok(first.nextCursor);
  const second = await f.checked(f.a.token, '/api/files?limit=1&cursor=' + encodeURIComponent(first.nextCursor));
  assert.deepEqual(new Set([...first.items, ...second.items].map((x: any) => x.captureId)), new Set([a.id, extra.id]));
  assert.equal((await f.request(f.b.token, '/api/files?limit=1&cursor=' + encodeURIComponent(first.nextCursor))).statusCode, 400);
  assert.equal((await f.request(f.a.token, '/api/files?limit=2&cursor=' + encodeURIComponent(first.nextCursor))).statusCode, 400);
  assert.equal((await f.request(f.a.token, '/api/files?limit=1&query=second&cursor=' + encodeURIComponent(first.nextCursor))).statusCode, 400);
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
  await f.checked(f.a.token, '/api/sources/same-source', 'PATCH', {enabled:false});
  assert.equal((await f.request(f.a.token, playback.url)).statusCode, 404);
  assert.equal((await f.request(f.a.token, '/api/files/' + a.id)).statusCode, 404);
  const bPlayback = await f.checked(f.b.token, '/api/files/' + b.id + '/playback', 'POST', {});
  assert.equal((await f.request(f.b.token, bPlayback.url)).rawPayload.toString(), 'Generated B private file');
});

test('the actual file reader preserves a complete transcript beyond its first hundred segments and filters before paging', async t => {
  const f = await fixture(t), text = 'x'.repeat(8000 * 102) + 'GENERATED_FULL_TAIL_Ω🙂';
  const original = await f.upload(f.a.token, 'long-file', text);
  await f.upload(f.a.token, 'unrelated-file', 'Generated unrelated');
  const task = await f.checked(f.a.token, '/api/processing', 'POST', {originalRef: original.original.ref, operationId: 'long-file-processing'});
  await waitForScopedState(async () => (await f.checked(f.a.token, '/api/tasks/' + task.id)).state === 'succeeded', () => 'long text did not reach an actual terminal M06 receipt');
  const first = await f.checked(f.a.token, '/api/files/' + original.id + '/chunks?offset=0');
  assert.equal(first.items.length, 100); assert.equal(first.nextOffset, 100);
  const all = [...first.items]; let offset = first.nextOffset;
  while (offset !== null) {
    const page = await f.checked(f.a.token, '/api/files/' + original.id + '/chunks?offset=' + offset);
    assert.ok(page.items.length > 0); all.push(...page.items);
    assert.ok(page.nextOffset === null || page.nextOffset > offset); offset = page.nextOffset;
  }
  assert.equal(all.map((item: any) => item.ocrText).join(''), text);
  assert.equal(new Set(all.map((item: any) => item.id)).size, all.length);
  const page = await f.checked(f.a.token, '/api/files?limit=1&query=long-file&mimePrefix=text/');
  assert.deepEqual(page.items.map((item: any) => item.captureId), [original.id]); assert.equal(page.nextCursor, null);
  assert.deepEqual((await f.checked(f.b.token, '/api/files?query=long-file')).items, []);
});
