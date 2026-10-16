import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {join} from 'node:path';
import {gunzipSync} from 'node:zlib';
import {rmSync} from 'node:fs';
import {buildApp} from '../src/app.js';
import {backupScopedInstance,restoreScopedInstance} from '../../../scripts/scoped-backup.mjs';
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
  const exported=await f.request(f.a.token,'/api/files/'+a.id+'/export');assert.equal(exported.statusCode,200,exported.body);
  const tar=gunzipSync(exported.rawPayload),entries=new Map<string,string>();
  for(let offset=0;offset+512<=tar.length&&tar[offset]!==0;){const name=tar.subarray(offset,offset+100).toString().replace(/\0.*$/s,''),length=parseInt(tar.subarray(offset+124,offset+136).toString().replace(/\0.*$/s,''),8);entries.set(name,tar.subarray(offset+512,offset+512+length).toString());offset+=512+Math.ceil(length/512)*512;}
  assert.equal(JSON.parse(entries.get('transcript.json')!).segments[0].text,input.correctedText);
  assert.equal(JSON.parse(entries.get('uncorrected-transcript.json')!).segments[0].text,original);
  assert.equal(JSON.parse(entries.get('manifest.json')!).uncorrectedArtifactId,artifactId);
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
  const bArtifact=beforeB.items[0].fileEvidence.artifactId;
  await f.checked(f.b.token, '/api/files/' + id + '/speakers', 'POST', {artifactId:bArtifact,names:{SPEAKER_0:'Generated B confirmed person'}});
  const bConfirmed=await f.checked(f.b.token, '/api/files/' + id + '/chunks');
  const operationId=randomUUID();
  await f.checked(f.a.token, '/api/portable/exports', 'POST', {operationId});
  await waitForScopedState(async () => (await f.checked(f.a.token, '/api/portable/exports/' + operationId)).state === 'completed', () => 'actual canonical export did not complete');
  const exported=await f.checked(f.a.token, '/api/portable/exports/' + operationId + '/content');
  const annotations=exported.domains.find((domain:any)=>domain.domain==='processing').payload.annotations;
  assert.equal(annotations.length,1);assert.equal(annotations[0].artifact_id,input.artifactId);
  assert.equal(JSON.parse(annotations[0].json).SPEAKER_0.name,input.names.SPEAKER_0);
  assert.ok(!JSON.stringify(annotations).includes('Generated B confirmed person'));
  await f.checked(f.a.token,'/api/files/'+id+'/speakers','POST',{...input,names:{SPEAKER_0:'Generated newer confirmed person'}});
  const newer=await f.checked(f.a.token,'/api/files/'+id+'/chunks'),importId=randomUUID();
  await f.checked(f.a.token,'/api/portable/imports','POST',{operationId:importId,archive:exported});
  await waitForScopedState(async()=>(await f.checked(f.a.token,'/api/portable/imports/'+importId)).state!=='working',()=>'annotation merge did not settle');
  const imported=await f.checked(f.a.token,'/api/portable/imports/'+importId);assert.equal(imported.state,'completed',JSON.stringify(imported));
  assert.deepEqual(await f.checked(f.a.token,'/api/files/'+id+'/chunks'),newer,'older portable names never overwrite current owner confirmation');
  assert.deepEqual(await f.checked(f.a.token,'/api/portable/imports','POST',{operationId:importId,archive:exported}),imported,'lost import ACK replays the same receipt');
  const corrupt=structuredClone(exported),processing=corrupt.domains.find((domain:any)=>domain.domain==='processing');processing.payload.annotations[0].raw_artifact_id='0'.repeat(64);
  const invalidId=randomUUID();await f.checked(f.a.token,'/api/portable/imports','POST',{operationId:invalidId,archive:corrupt});
  await waitForScopedState(async()=>(await f.checked(f.a.token,'/api/portable/imports/'+invalidId)).state!=='working',()=>'invalid annotation import did not settle');
  assert.equal((await f.checked(f.a.token,'/api/portable/imports/'+invalidId)).state,'failed');
  assert.deepEqual(await f.checked(f.a.token,'/api/files/'+id+'/chunks'),newer,'invalid raw artifact reference must not partially change canonical data');
  const deletion=await f.checked(f.admin.token, '/api/admin/accounts/' + f.a.userId, 'DELETE', {operationId:randomUUID()});
  await waitForScopedState(async () => (await f.checked(f.admin.token, '/api/admin/account-deletions/' + deletion.id)).state === 'completed', () => 'physical file annotation deletion did not complete');
  assert.deepEqual(await f.checked(f.b.token, '/api/files/' + id + '/chunks'), bConfirmed);
  const db=new DatabaseSync(join(f.directory,'mote.sqlite'),{readOnly:true});
  try{assert.equal(db.prepare('SELECT count(*) n FROM mp_file_annotations WHERE user_id=?').get(f.a.userId)!.n,0);assert.equal(db.prepare('SELECT count(*) n FROM mp_file_annotations WHERE user_id=?').get(f.b.userId)!.n,1);}finally{db.close();}
});

test('offline instance backup restores corrected evidence and confirmed names but never old login grants',async t=>{
  const f=await scopedFilesFixture(t),snapshot=f.directory+'-backup',target=f.directory+'-restored';
  t.after(()=>{rmSync(snapshot,{recursive:true,force:true});rmSync(target,{recursive:true,force:true});});
  const received=await f.checked(f.a.token,'/api/ingress/sources/same-source/items','POST',{batchId:'generated-backup-recording',items:[{externalId:'generated-backup-recording',revision:'r1',observedAt:'2026-10-16T00:00:00Z',title:'Generated backup recording',text:'Generated raw recording',kind:'file',layer:'original',document:{originalMetadata:{speaker:'SPEAKER_0',startMs:0,endMs:1000}}}]});
  const original=received.captures[0],task=await f.checked(f.a.token,'/api/processing','POST',{originalRef:original.original.ref,operationId:'generated-backup-processing'});
  await waitForScopedState(async()=>(await f.checked(f.a.token,'/api/tasks/'+task.id)).state==='succeeded',()=>'backup extraction did not complete');
  const chunk=(await f.checked(f.a.token,'/api/files/'+original.id+'/chunks')).items[0];
  const corrected=await f.checked(f.a.token,'/api/files/'+original.id+'/corrections','POST',{artifactId:chunk.fileEvidence.artifactId,chunkId:chunk.id,originalText:chunk.ocrText,correctedText:'Generated corrected recording'});
  await f.checked(f.a.token,'/api/files/'+original.id+'/speakers','POST',{artifactId:corrected.artifactId,names:{SPEAKER_0:'Generated confirmed recording person'}});
  const expected=await f.checked(f.a.token,'/api/files/'+original.id+'/chunks');
  await f.host.app.close();await backupScopedInstance({source:f.directory,out:snapshot});await restoreScopedInstance({from:snapshot,target,deploymentId:f.host.deploymentId});
  const restored=await buildApp({dataDir:target});
  try{
    const headers={'x-mote-protocol-version':'2','x-mote-ingress-version':'3'};
    assert.equal((await restored.app.inject({url:'/api/auth/self',headers:{...headers,authorization:'Bearer '+f.a.token}})).statusCode,401);
    const login=await restored.accounts!.login('generated-a','Generated-joint-files-password','generated','client',0);assert.equal(login.userId,f.a.userId);
    const current=await restored.app.inject({url:'/api/files/'+original.id+'/chunks',headers:{...headers,authorization:'Bearer '+login.token}});assert.equal(current.statusCode,200,current.body);assert.deepEqual(current.json(),expected);
    const raw=await restored.app.inject({url:'/api/processing/artifacts/'+chunk.fileEvidence.artifactId,headers:{...headers,authorization:'Bearer '+login.token}});assert.equal(raw.statusCode,200,raw.body);assert.equal(raw.json().payload.segments[0].text,'Generated raw recording');
    const db=new DatabaseSync(join(target,'mote.sqlite'),{readOnly:true});try{assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(),[]);assert.equal(db.prepare('SELECT raw_artifact_id FROM mp_file_annotations WHERE user_id=? AND artifact_id=?').get(f.a.userId,corrected.artifactId)!.raw_artifact_id,chunk.fileEvidence.artifactId);}finally{db.close();}
  }finally{await restored.app.close();}
});
