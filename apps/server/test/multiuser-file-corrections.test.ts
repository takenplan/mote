import test from 'node:test';
import assert from 'node:assert/strict';
import {scopedFilesFixture} from './fixtures/scoped-files.js';
import {waitForScopedState} from './fixtures/scoped-process.js';

test('actual owner file corrections pin the exact transcript and chunk, preserve raw evidence and cannot alter equal-ID B', async t => {
  const f = await scopedFilesFixture(t), original = 'Generated original spoken text Ω🙂';
  const a = await f.upload(f.a.token, 'same-file', original), b = await f.upload(f.b.token, 'same-file', 'Generated B unchanged');
  for (const [account, receipt] of [[f.a, a], [f.b, b]]) {
    const task = await f.checked(account.token, '/api/processing', 'POST', {originalRef: receipt.original.ref, operationId: 'same-process'});
    await waitForScopedState(async () => (await f.checked(account.token, '/api/tasks/' + task.id)).state === 'succeeded', () => 'actual transcript extraction not completed');
  }
  const read = (account: typeof f.a) => f.checked(account.token, '/api/files/' + a.id + '/chunks');
  const first = (await read(f.a)).items[0], beforeB = await read(f.b), artifactId = first.fileEvidence.artifactId;
  const input = {artifactId, chunkId: first.id, originalText: original, correctedText: 'Generated owner corrected exact text Ω🙂'};
  const corrected = await f.checked(f.a.token, '/api/files/' + a.id + '/corrections', 'POST', input);
  assert.equal(corrected.status, 'accepted'); assert.notEqual(corrected.artifactId, artifactId);
  const current = (await read(f.a)).items[0];
  assert.equal(current.ocrText, input.correctedText); assert.equal(current.fileEvidence.artifactId, corrected.artifactId);
  assert.equal((await f.checked(f.a.token, '/api/processing/artifacts/' + artifactId)).payload.segments[0].text, original);
  assert.equal((await f.request(f.a.token, '/api/files/' + a.id + '/corrections', 'POST', input)).statusCode, 409);
  assert.equal((await f.request(f.b.token, '/api/files/' + b.id + '/corrections', 'POST', input)).statusCode, 409);
  assert.deepEqual(await read(f.b), beforeB);
  const unchanged = await f.checked(f.a.token, '/api/files/' + a.id + '/corrections', 'POST', {artifactId: corrected.artifactId, chunkId: current.id, originalText: input.correctedText, correctedText: input.correctedText});
  assert.equal(unchanged.status, 'unchanged'); assert.equal(unchanged.artifactId, corrected.artifactId);
  const status = await f.checked(f.a.token, '/api/files/' + a.id);
  assert.equal((await f.checked(f.a.token, '/api/materials/' + status.processing.materialId + '/read')).text, input.correctedText);
});

test('confirmed speaker names belong to the actual exact artifact and retain anonymous labels, text and B', async t => {
  const f = await scopedFilesFixture(t), receipts = [];
  for (const account of [f.a, f.b]) {
    const receipt = await f.checked(account.token, '/api/ingress/sources/same-source/items', 'POST', {batchId:'same-speaker-batch', items:[{externalId:'same-recording',revision:'r1',observedAt:'2026-10-16T00:00:00Z',title:'Generated recording',text:'Generated anonymous statement',kind:'file',layer:'original',document:{originalMetadata:{speaker:'SPEAKER_0',startMs:0,endMs:1000}}}]});
    const original = receipt.captures[0]; receipts.push(original);
    const task = await f.checked(account.token, '/api/processing', 'POST', {originalRef: original.original.ref, operationId:'same-speaker-processing'});
    await waitForScopedState(async () => (await f.checked(account.token, '/api/tasks/' + task.id)).state === 'succeeded', () => 'speaker-labelled original did not process');
  }
  const id = receipts[0].id, first = (await f.checked(f.a.token, '/api/files/' + id + '/chunks')).items[0];
  const beforeB = await f.checked(f.b.token, '/api/files/' + id + '/chunks');
  const input = {artifactId:first.fileEvidence.artifactId,names:{SPEAKER_0:'Generated confirmed person'}};
  assert.equal((await f.checked(f.a.token, '/api/files/' + id + '/speakers', 'POST', input)).saved, true);
  const current = (await f.checked(f.a.token, '/api/files/' + id + '/chunks')).items[0];
  assert.equal(current.ocrText, first.ocrText); assert.equal(current.fileEvidence.speaker, 'SPEAKER_0');
  assert.equal(current.fileEvidence.speakerAttribution.name, input.names.SPEAKER_0);
  assert.equal(current.fileEvidence.speakerAttribution.confirmedBy, 'owner');
  assert.equal((await f.request(f.a.token, '/api/files/' + id + '/speakers', 'POST', {...input,names:{SPEAKER_1:'Unknown cluster'}})).statusCode, 400);
  assert.equal((await f.request(f.b.token, '/api/files/' + id + '/speakers', 'POST', input)).statusCode, 409);
  assert.deepEqual(await f.checked(f.b.token, '/api/files/' + id + '/chunks'), beforeB);
});
