import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {historyAskFixture as fixture,historyRespond as respond,deferred} from './fixtures/history-ask-fixture.js';
import {writeMessagesResponse} from '../../../scripts/fixtures/messages-provider.js';

type Fixture=Awaited<ReturnType<typeof fixture>>;
async function revise(f:Fixture,user:any,material:any,text='GENERATED_CORRECTED_BODY'){
 const context=await f.node.authority.authenticate(user.token),draft=f.read(db=>JSON.parse(String(db.prepare('SELECT json FROM pd_material_versions WHERE user_id=? AND material_id=? AND revision=?').get(user.userId,material.id,material.revision)!.json)));
 draft.blocks[0].text=text;
 return f.node.ingress.bindSource(context,['same-source'],()=>{}).publishMaterial(draft,material.revision);
}
async function ask(f:Fixture,user:any,conversationId?:string,question='Generated historical question'){
 const id=randomUUID();await f.checked(user.token,'/api/query-runs','POST',{id,input:{question,...(conversationId?{conversationId}:{})}});
 const result=await f.wait(user,id);assert.equal(result.status,'completed',JSON.stringify(result));return result;
}

test('ordinary scoped Material revisions retain original answers and citations across restart and real followups',async t=>{
 const f=await fixture(t),a=await f.publish(f.a,'A');await f.publish(f.b,'B');const original=await ask(f,f.a),b=await ask(f,f.b),conversationId=original.conversationId;
 await revise(f,f.a,a);let page=await f.checked(f.a.token,'/api/conversations/'+conversationId);
 assert.equal(page.turns[0].evidenceStale,true,'ordinary revisions must retain history with an explicit stale notice');assert.equal(page.turns[0].evidenceDeleted,undefined);assert.deepEqual(page.turns[0].result,original.result);
 assert.equal((await f.request(f.b.token,'/api/conversations/'+conversationId)).statusCode,404);assert.deepEqual((await f.checked(f.b.token,'/api/conversations/'+b.conversationId)).turns[0].result,b.result);
 await f.restart();page=await f.checked(f.a.token,'/api/conversations/'+conversationId);assert.deepEqual(page.turns[0].result,original.result);
 const start=f.requests.length;await ask(f,f.a,conversationId,'What was the earlier proposal? Check current evidence before facts.');const actual=f.requests.slice(start).filter(v=>v.owner==='A');assert.ok(actual.some(v=>v.raw.includes(original.result.answer)));assert.ok(actual.some(v=>v.raw.includes('evidenceStale')));assert.ok(actual.every(v=>!v.raw.includes('historyRoots')&&!v.raw.includes('GENERATED_B_PRIVATE_ORIGINAL')));
});

test('explicit original deletion erases every historical and followup generation, summary and frozen run only for its owner',async t=>{
 const f=await fixture(t),a=await f.publish(f.a,'A');await f.publish(f.b,'B');const original=await ask(f,f.a),b=await ask(f,f.b),conversationId=original.conversationId;
 await revise(f,f.a,a);await ask(f,f.a,conversationId);const context=await f.node.authority.authenticate(f.a.token);await f.node.ask!.bind(context,{assertCurrent:()=>{}}).compact(conversationId);
 const capture=f.read(db=>String(db.prepare('SELECT capture_id FROM pd_material_captures WHERE user_id=? AND material_id=? LIMIT 1').get(f.a.userId,a.id)!.capture_id));
 await f.checked(f.a.token,'/api/captures/'+capture,'DELETE');const page=await f.checked(f.a.token,'/api/conversations/'+conversationId);assert.ok(page.turns.length>=2);assert.ok(page.turns.every((v:any)=>v.evidenceDeleted&&!v.result));assert.equal(page.summary,undefined);
 const retained=f.read(db=>db.prepare('SELECT result FROM ma_turns WHERE user_id=? AND conversation_id=?').all(f.a.userId,conversationId));assert.ok(retained.every(row=>!String(row.result).includes(original.result.answer)),'privacy erasure clears saved prose, not just its rendered DTO');
 assert.deepEqual((await f.checked(f.b.token,'/api/conversations/'+b.conversationId)).turns[0].result,b.result);await f.restart();assert.ok((await f.checked(f.a.token,'/api/conversations/'+conversationId)).turns.every((v:any)=>v.evidenceDeleted));
});

test('a held historical followup cannot publish or summarize across an ordinary revision and B remains usable',async t=>{
 const f=await fixture(t),a=await f.publish(f.a,'A');await f.publish(f.b,'B');const original=await ask(f,f.a),updated=await revise(f,f.a,a),entered=deferred(),gate=deferred();t.after(()=>gate.resolve());
 f.scripts.set('A',async(body,raw,res,owner)=>{if(raw.includes(original.result.answer)&&body.messages.some((v:any)=>v.role==='assistant'&&v.content?.some?.((p:any)=>p.type==='tool_use'&&p.name==='material_read'))){entered.resolve();await gate.promise;}respond(body,raw,res,owner);});
 const id=randomUUID();await f.checked(f.a.token,'/api/query-runs','POST',{id,input:{conversationId:original.conversationId,question:'Generated held historical followup'}});await entered.promise;await revise(f,f.a,updated,'GENERATED_NEXT_CORRECTION');gate.resolve();assert.equal((await f.wait(f.a,id)).status,'failed');assert.equal((await f.checked(f.a.token,'/api/conversations/'+original.conversationId)).turns.length,1);await ask(f,f.b);
});

export {revise,ask};

test('a personal Ask archive roundtrip retains stale historical dialogue without restoring model authority',async t=>{
 const f=await fixture(t),a=await f.publish(f.a,'A');await f.publish(f.b,'B');const original=await ask(f,f.a),context=await f.node.authority.authenticate(f.a.token);
 await revise(f,f.a,a);await f.checked(f.a.token,'/api/conversations/'+original.conversationId);
 const service=f.node.services.forUser(context),archive=await service.exportUser('ask'),calls=f.requests.length;
 await service.deleteUser('ask',randomUUID());await service.restoreUser('ask',archive,randomUUID());
 const page=await f.checked(f.a.token,'/api/conversations/'+original.conversationId);assert.equal(page.turns[0].evidenceStale,true);assert.deepEqual(page.turns[0].result,original.result);await f.restart();assert.equal(f.requests.length,calls);assert.equal((await f.request(f.b.token,'/api/conversations/'+original.conversationId)).statusCode,404);
});


test('an archive after privacy erasure keeps only erased dialogue receipts and restores without private prose or work',async t=>{
 const f=await fixture(t),material=await f.publish(f.a,'A'),original=await ask(f,f.a),context=await f.node.authority.authenticate(f.a.token),service=f.node.services.forUser(context);
 await f.checked(f.a.token,'/api/materials/'+material.id,'DELETE');const archive=await service.exportUser('ask');assert.ok(!JSON.stringify(archive).includes(original.result.answer));await service.deleteUser('ask',randomUUID());const calls=f.requests.length;await service.restoreUser('ask',archive,randomUUID());const page=await f.checked(f.a.token,'/api/conversations/'+original.conversationId);assert.equal(page.turns[0].evidenceDeleted,true);assert.equal(page.turns[0].result,undefined);assert.equal(f.requests.length,calls);
});

test('upgrading unread scoped dialogue backfills original roots before Memory cache deletion',async t=>{
 const f=await fixture(t);await f.publish(f.a,'A');await f.publish(f.b,'B');const original=await ask(f,f.a),b=await ask(f,f.b);
 // Model the previous M08 schema: real published turns and runs predate the
 // host-only history tables. No forged context, grant or evidence is supplied.
 f.read(db=>{db.exec('PRAGMA foreign_keys=ON');db.prepare('DELETE FROM ma_history_turns WHERE user_id=?').run(f.a.userId);db.prepare('DELETE FROM ma_history_runs WHERE user_id=?').run(f.a.userId);});
 await f.restart();assert.ok(f.read(db=>Number(db.prepare('SELECT count(*) n FROM ma_history_dependencies WHERE user_id=?').get(f.a.userId)!.n))>0,'startup, before any history read, must persist the retained canonical closure');
 const context=await f.node.authority.authenticate(f.a.token);await f.node.services.forUser(context).deleteUser('memory',randomUUID());
 const page=await f.checked(f.a.token,'/api/conversations/'+original.conversationId);assert.equal(page.turns[0].evidenceStale,true);assert.deepEqual(page.turns[0].result,original.result);assert.equal(page.turns[0].evidenceDeleted,undefined);
 await f.restart();assert.deepEqual((await f.checked(f.a.token,'/api/conversations/'+original.conversationId)).turns[0].result,original.result);assert.deepEqual((await f.checked(f.b.token,'/api/conversations/'+b.conversationId)).turns[0].result,b.result);
});

test('measurement-only answers retain the existing redacted-metadata contract without granting original reads',async t=>{
 const f=await fixture(t),captureId=randomUUID();await f.checked(f.a.token,'/api/ingress/sources','POST',{id:'generated-measurement',name:'Generated measurement',kind:'custom',deviceId:'generated-device',platform:'import',retention:'snapshot'});
 await f.checked(f.a.token,'/api/ingress/sources/generated-measurement/captures','POST',{batchId:'generated-redacted',items:[{id:captureId,deviceId:'generated-device',deviceName:'Generated device',platform:'import',capturedAt:'2026-01-01T00:00:05Z',durationMs:2000,source:'screen',appId:'generated.app',appName:'Generated app',windowTitle:'',ocrText:'GENERATED_REDACTED_CONTENT_NOT_DISCLOSED',privacy:{excluded:false,redacted:true,mode:'local',collection:'content'}}]});
 f.scripts.set('A',(body,raw,res)=>{const uses=body.messages.flatMap((message:any)=>Array.isArray(message.content)?message.content.filter((part:any)=>part.type==='tool_use'):[]),stage=uses.length+1;if(!uses.some((use:any)=>use.name==='capability_discover'))return writeMessagesResponse(res,{stage,tool:{name:'capability_discover',args:{name:'activity'}}});if(!uses.some((use:any)=>use.name==='capability_execute'))return writeMessagesResponse(res,{stage,tool:{name:'capability_execute',args:{name:'activity',version:'1',argumentsJson:'{}'}}});assert.ok(raw.includes('totalDurationMs'));writeMessagesResponse(res,{stage,text:JSON.stringify({answer:'Generated measured duration only',citationIds:[]})});});
 const original=await ask(f,f.a);await ask(f,f.a,original.conversationId);assert.ok(f.read(db=>db.prepare("SELECT 1 FROM ma_history_dependencies WHERE user_id=? AND kind='capture' AND root_id=?").get(f.a.userId,captureId)));assert.ok(f.requests.every(request=>!request.raw.includes('GENERATED_REDACTED_CONTENT_NOT_DISCLOSED')));
 const context=await f.node.authority.authenticate(f.a.token),service=f.node.services.forUser(context),archive=await service.exportUser('ask'),calls=f.requests.length;await service.deleteUser('ask',randomUUID());await service.restoreUser('ask',archive,randomUUID());await f.restart();assert.equal(f.requests.length,calls);const page=await f.checked(f.a.token,'/api/conversations/'+original.conversationId);assert.equal(page.turns.length,2);assert.deepEqual(page.turns[0].result,original.result);const restored=await f.node.authority.authenticate(f.a.token);await assert.rejects(f.node.ask!.bind(restored,{assertCurrent:()=>{}}).reader().agent.evidence({ids:[captureId]}));
 await f.checked(f.a.token,'/api/captures/'+captureId,'DELETE');assert.ok((await f.checked(f.a.token,'/api/conversations/'+original.conversationId)).turns.every((turn:any)=>turn.evidenceDeleted));
});
