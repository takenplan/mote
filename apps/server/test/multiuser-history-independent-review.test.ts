import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {historyAskFixture as fixture} from './fixtures/history-ask-fixture.js';
import {writeMessagesResponse} from '../../../scripts/fixtures/messages-provider.js';
import type {PrivateData} from '../src/scope/private-data.js';

type Fixture=Awaited<ReturnType<typeof fixture>>;
async function ask(f:Fixture,user:any,conversationId?:string){
 const id=randomUUID();
 await f.checked(user.token,'/api/query-runs','POST',{id,input:{question:'Generated independent history review',...(conversationId?{conversationId}:{})}});
 const value=await f.wait(user,id);
 assert.equal(value.status,'completed',JSON.stringify(value));
 return value;
}
function draft(f:Fixture,user:any,material:any){
 return f.read(db=>JSON.parse(String(db.prepare('SELECT json FROM pd_material_versions WHERE user_id=? AND material_id=? AND revision=?').get(user.userId,material.id,material.revision)!.json)));
}

test('ordinary scoped source correction and rebuilt Material preserve historical dialogue across temporary projection withdrawal',async t=>{
 const f=await fixture(t),material=await f.publish(f.a,'A');
 await f.publish(f.b,'B');
 const first=await ask(f,f.a),b=await ask(f,f.b),context=await f.node.authority.authenticate(f.a.token),changed=draft(f,f.a,material);
 const source=f.node.ingress.bindSource(context,['same-source'],()=>{}),receipt=source.receiveSourceItems('same-source','generated-corrected-receipt',[{externalId:'same-external',revision:'generated-corrected-source-revision',observedAt:'2026-01-02T00:00:00Z',title:'Generated corrected original A',text:'GENERATED_REBUILT_CURRENT_BODY',kind:'file',layer:'original'}]);
 changed.members[0].ref='capture:'+receipt.captures[0].id;
 changed.blocks[0].text='GENERATED_REBUILT_CURRENT_BODY';
 source.publishMaterial(changed,material.revision);
 const assertRetained=async()=>{
  const page=await f.checked(f.a.token,'/api/conversations/'+first.conversationId);
  assert.equal(page.turns[0].evidenceStale,true);
  assert.equal(page.turns[0].evidenceDeleted,undefined,'ordinary projection withdrawal must not become permanent retirement');
  assert.deepEqual(page.turns[0].result,first.result);
 };
 await assertRetained();
 await f.restart();
 await assertRetained();
 await ask(f,f.a,first.conversationId);
 assert.deepEqual((await f.checked(f.b.token,'/api/conversations/'+b.conversationId)).turns[0].result,b.result);
 await ask(f,f.b);
});

test('explicit scoped Material retirement retracts all historical generations permanently while A and B can use current evidence',async t=>{
 const f=await fixture(t),material=await f.publish(f.a,'A');
 await f.publish(f.b,'B');
 const first=await ask(f,f.a),b=await ask(f,f.b),context=await f.node.authority.authenticate(f.a.token),changed=draft(f,f.a,material);
 changed.blocks[0].text='GENERATED_ORDINARY_CORRECTION';
 const current=f.node.ingress.bindSource(context,['same-source'],()=>{}).publishMaterial(changed,material.revision);
 await ask(f,f.a,first.conversationId);
 assert.equal((await f.checked(f.a.token,'/api/conversations/'+first.conversationId)).turns[0].evidenceStale,true);

 f.node.services.forUser(context).get<PrivateData>('private-data').retireMaterial(material.id);
 const erased=()=>f.checked(f.a.token,'/api/conversations/'+first.conversationId);
 assert.ok((await erased()).turns.every((turn:any)=>turn.evidenceDeleted&&!turn.result),'explicit retirement must retract old and followup answers');
 changed.blocks[0].text='GENERATED_REPUBLISHED_CURRENT_BODY';
 f.node.ingress.bindSource(context,['same-source'],()=>{}).publishMaterial(changed,current.revision);
 assert.ok((await erased()).turns.every((turn:any)=>turn.evidenceDeleted&&!turn.result),'republishing a visible head must not revive retired dialogue');
 await ask(f,f.a);
 assert.deepEqual((await f.checked(f.b.token,'/api/conversations/'+b.conversationId)).turns[0].result,b.result);
 assert.equal((await f.request(f.b.token,'/api/conversations/'+first.conversationId)).statusCode,404);
 await f.restart();
 assert.ok((await erased()).turns.every((turn:any)=>turn.evidenceDeleted&&!turn.result));
 await ask(f,f.b);
});

test('an inherited-only scoped followup loses run, artifact and stored prose when its original is deleted, including after restart',async t=>{
 const f=await fixture(t),material=await f.publish(f.a,'A');
 await f.publish(f.b,'B');
 const first=await ask(f,f.a),b=await ask(f,f.b),context=await f.node.authority.authenticate(f.a.token),changed=draft(f,f.a,material);
 changed.blocks[0].text='GENERATED_CHANGED_BODY';
 f.node.ingress.bindSource(context,['same-source'],()=>{}).publishMaterial(changed,material.revision);
 const answer='GENERATED_INHERITED_ONLY_PRIVATE_ANSWER';
 f.scripts.set('A',(_body,_raw,res)=>writeMessagesResponse(res,{stage:1,text:JSON.stringify({answer,citationIds:[]})}));
 const second=await ask(f,f.a,first.conversationId);
 assert.equal(second.result.answer,answer);
 const row=f.read(db=>db.prepare('SELECT pins,materials FROM ma_runs WHERE user_id=? AND id=?').get(f.a.userId,second.id)!);
 assert.equal(row.pins,'[]');
 assert.equal(row.materials,'[]','only inherited dialogue roots authorize this answer');
 const artifact=f.read(db=>String(db.prepare('SELECT id FROM ma_artifacts WHERE user_id=? AND run_id=? LIMIT 1').get(f.a.userId,second.id)!.id));
 assert.equal((await f.checked(f.a.token,'/api/ask-artifacts/'+artifact)).json.result.answer,answer);
 await f.checked(f.a.token,'/api/conversations/'+first.conversationId+'/compact','POST',{});
 assert.ok(f.read(db=>db.prepare('SELECT checkpoints FROM user_tasks WHERE user_id=?').all(f.a.userId).some(value=>String(value.checkpoints).includes(answer))),'the real compactor must persist its resumable summary before deletion');
 const capture=f.read(db=>String(db.prepare('SELECT capture_id FROM pd_material_captures WHERE user_id=? AND material_id=? LIMIT 1').get(f.a.userId,material.id)!.capture_id));
 await f.checked(f.a.token,'/api/captures/'+capture,'DELETE');
 const assertWithdrawn=async()=>{
  assert.equal((await f.checked(f.a.token,'/api/query-runs/'+second.id)).result,undefined,'operational results must validate inherited roots');
  const response=await f.request(f.a.token,'/api/ask-artifacts/'+artifact);
  assert.notEqual(response.statusCode,200);
  assert.ok(!response.body.includes(answer));
  assert.ok((await f.checked(f.a.token,'/api/conversations/'+first.conversationId)).turns.every((turn:any)=>turn.evidenceDeleted&&!turn.result));
 };
 await assertWithdrawn();
 const saved=f.read(db=>['ma_runs','ma_artifacts','ma_traces','ma_turns','user_tasks'].map(table=>JSON.stringify(db.prepare('SELECT * FROM '+table+' WHERE user_id=?').all(f.a.userId))).join('\n'));
 assert.ok(!saved.includes(answer),'privacy erasure clears stored run/artifact/trace/turn prose and task checkpoints');
 assert.ok(!saved.includes(first.result.answer),'frozen historical contexts are also erased');
 assert.deepEqual((await f.checked(f.b.token,'/api/conversations/'+b.conversationId)).turns[0].result,b.result);
 await f.restart();
 await assertWithdrawn();
 await ask(f,f.b);
});

test('personal Ask restore rejects forged hashes, foreign ownership and an omitted historical ancestor atomically',async t=>{
 const f=await fixture(t),material=await f.publish(f.a,'A');
 await f.publish(f.b,'B');
 const first=await ask(f,f.a),b=await ask(f,f.b),context=await f.node.authority.authenticate(f.a.token),changed=draft(f,f.a,material);
 changed.blocks[0].text='GENERATED_ARCHIVE_CORRECTION';
 f.node.ingress.bindSource(context,['same-source'],()=>{}).publishMaterial(changed,material.revision);
 f.scripts.set('A',(_body,_raw,res)=>writeMessagesResponse(res,{stage:1,text:JSON.stringify({answer:'GENERATED_ARCHIVED_INHERITED_PRIVATE_ANSWER',citationIds:[]})}));
 const second=await ask(f,f.a,first.conversationId),service=f.node.services.forUser(context),archive=await service.exportUser('ask'),calls=f.requests.length;
 const counts=()=>f.read(db=>['ma_conversations','ma_turns','ma_runs','ma_artifacts','ma_restore'].map(table=>Number(db.prepare('SELECT count(*) n FROM '+table+' WHERE user_id=?').get(f.a.userId)!.n)));
 await service.deleteUser('ask',randomUUID());
 assert.deepEqual(counts(),[0,0,0,0,0]);
 const forged=structuredClone(archive),forgedPayload=forged.payload as any,pins=JSON.parse(forgedPayload.turns[0].pins);
 assert.ok(pins.length>0);
 pins[0].hash='f'.repeat(64);
 forgedPayload.turns[0].pins=JSON.stringify(pins);
 await assert.rejects(async()=>service.restoreUser('ask',forged,randomUUID()));
 assert.deepEqual(counts(),[0,0,0,0,0],'failed canonical hash validation rolls back earlier conversation insertion');
 await assert.rejects(async()=>service.restoreUser('ask',{...archive,userId:f.b.userId},randomUUID()));
 assert.deepEqual(counts(),[0,0,0,0,0]);
 await service.restoreUser('ask',archive,randomUUID());
 assert.equal((await f.checked(f.a.token,'/api/conversations/'+first.conversationId)).turns.length,2);
 assert.equal(f.requests.length,calls,'data restoration must not restore model work');

 const capture=f.read(db=>String(db.prepare('SELECT capture_id FROM pd_material_captures WHERE user_id=? AND material_id=? LIMIT 1').get(f.a.userId,material.id)!.capture_id));
 await f.checked(f.a.token,'/api/captures/'+capture,'DELETE');
 await service.deleteUser('ask',randomUUID());
 const partial=structuredClone(archive),partialPayload=partial.payload as any;
 partialPayload.turns=partialPayload.turns.filter((turn:any)=>turn.id===second.id);
 assert.equal(partialPayload.turns[0].position,2,'retain the real later position while omitting its private ancestor');
 assert.equal(partialPayload.turns[0].pins,'[]');
 assert.equal(partialPayload.turns[0].materials,'[]');
 partialPayload.runs=partialPayload.runs.filter((run:any)=>run.id===second.id);
 partialPayload.artifacts=partialPayload.artifacts.filter((artifact:any)=>artifact.run_id===second.id);
 await assert.rejects(async()=>service.restoreUser('ask',partial,randomUUID()),'an omitted ancestor cannot become an empty privacy receipt');
 assert.deepEqual(counts(),[0,0,0,0,0]);
 assert.equal(f.requests.length,calls);
 assert.deepEqual((await f.checked(f.b.token,'/api/conversations/'+b.conversationId)).turns[0].result,b.result);
});

test('startup backfills unread legacy dialogue before derived Memory cache deletion can remove its anchors',async t=>{
 const f=await fixture(t);
 await f.publish(f.a,'A');
 await f.publish(f.b,'B');
 const first=await ask(f,f.a),b=await ask(f,f.b);
 f.read(db=>{
  assert.ok(Number(db.prepare('SELECT count(*) n FROM mm_evidence WHERE user_id=?').get(f.a.userId)!.n)>0);
  // The prior scoped release persisted turns but had no history root receipts.
  db.prepare('DELETE FROM ma_history_turns WHERE user_id=?').run(f.a.userId);
  db.prepare('DELETE FROM ma_history_runs WHERE user_id=?').run(f.a.userId);
 });
 await f.restart();
 const context=await f.node.authority.authenticate(f.a.token);
 await f.node.services.forUser(context).deleteUser('memory',randomUUID());
 assert.equal(f.read(db=>Number(db.prepare('SELECT count(*) n FROM mm_evidence WHERE user_id=?').get(f.a.userId)!.n)),0);
 const page=await f.checked(f.a.token,'/api/conversations/'+first.conversationId);
 assert.equal(page.turns[0].evidenceDeleted,undefined,'retained originals protect unread legacy dialogue after cache withdrawal');
 assert.deepEqual(page.turns[0].result,first.result);
 assert.deepEqual((await f.checked(f.b.token,'/api/conversations/'+b.conversationId)).turns[0].result,b.result);
 await ask(f,f.b);
});

test('an independent SQLite writer rolls back privacy cleanup atomically and committed deletion survives restart and equal-ID recreation',async t=>{
 const f=await fixture(t),material=await f.publish(f.a,'A');
 await f.publish(f.b,'B');
 const first=await ask(f,f.a),b=await ask(f,f.b),retained=draft(f,f.a,material),capture=f.read(db=>String(db.prepare('SELECT capture_id FROM pd_material_captures WHERE user_id=? AND material_id=? LIMIT 1').get(f.a.userId,material.id)!.capture_id));
 await f.node.app.close();
 f.read(db=>{
  const snapshot=()=>['ma_conversations','ma_turns','ma_runs','ma_artifacts','ma_history_turns','ma_history_runs'].map(table=>JSON.stringify(db.prepare('SELECT * FROM '+table+' WHERE user_id=? ORDER BY rowid').all(f.a.userId)));
  // Preserve the existing foreign-key order used by the owning data module.
  const erase=()=>{db.prepare('DELETE FROM pd_materials WHERE user_id=? AND id=?').run(f.a.userId,material.id);db.prepare('DELETE FROM pd_captures WHERE user_id=? AND id=?').run(f.a.userId,capture);};
  const before=snapshot();
  db.exec("CREATE TEMP TRIGGER generated_history_abort BEFORE UPDATE ON ma_turns BEGIN SELECT RAISE(ABORT,'Generated history transaction failure'); END; BEGIN IMMEDIATE");
  assert.throws(erase,/Generated history transaction failure/);
  assert.equal(db.isTransaction,true);
  db.exec('ROLLBACK; DROP TRIGGER generated_history_abort');
  assert.deepEqual(snapshot(),before,'all earlier trigger writes roll back with the failed original deletion');
  assert.ok(db.prepare('SELECT id FROM pd_captures WHERE user_id=? AND id=?').get(f.a.userId,capture));
  db.exec('BEGIN IMMEDIATE');
  erase();
  db.exec('COMMIT');
  assert.ok(!String(db.prepare('SELECT result FROM ma_turns WHERE user_id=? AND id=?').get(f.a.userId,first.id)!.result).includes(first.result.answer),'SQL alone clears saved prose without a connection-local callback');
  assert.equal(db.prepare('SELECT deleted FROM ma_history_turns WHERE user_id=? AND turn_id=?').get(f.a.userId,first.id)!.deleted,1);
  assert.ok(db.prepare('SELECT id FROM pd_captures WHERE user_id=? AND id=?').get(f.b.userId,capture),'equal capture IDs remain owner scoped');
 });
 await f.restart();
 const erased=()=>f.checked(f.a.token,'/api/conversations/'+first.conversationId);
 assert.equal((await erased()).turns[0].evidenceDeleted,true);
 const context=await f.node.authority.authenticate(f.a.token),source=f.node.ingress.bindSource(context,['same-source'],()=>{}),receipt=source.receiveSourceItems('same-source','generated-equal-id-recreation',[{externalId:'same-external',revision:'same-revision',observedAt:'2026-01-01T00:00:00Z',title:'Generated original A',text:'GENERATED_A_PRIVATE_ORIGINAL',kind:'file',layer:'original'}]);
 assert.equal(receipt.captures[0].id,capture);
 assert.equal(source.publishMaterial(retained).id,material.id);
 assert.equal((await erased()).turns[0].evidenceDeleted,true,'new original and Material incarnations cannot revive erased history');
 await ask(f,f.a);
 assert.deepEqual((await f.checked(f.b.token,'/api/conversations/'+b.conversationId)).turns[0].result,b.result);
 await f.restart();
 assert.equal((await erased()).turns[0].evidenceDeleted,true);
 await ask(f,f.b);
});
