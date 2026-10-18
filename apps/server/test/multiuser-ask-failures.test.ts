import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {setTimeout as delay} from 'node:timers/promises';
import {historyAskFixture,historyRespond,deferred} from './fixtures/history-ask-fixture.js';
import {publishableAskFailure,failedAskTurnResult} from '../src/scope/ask-failures.js';
import {defaultModelSettings} from '../src/model-settings.js';
import type {ExecutionFailureReceipt} from '../src/execution-engine.js';

async function until(check:()=>boolean,description:string,timeoutMs=20000){const deadline=Date.now()+timeoutMs;while(!check()){assert.ok(Date.now()<deadline,description);await delay(10);}}

test('real Ask persists safe failed questions before any run read, survives reopen, and retries with the same owned run',async t=>{
 const f=await historyAskFixture(t),id=randomUUID(),conversationId=randomUUID(),turnId=randomUUID(),question='GENERATED_FAILED_QUESTION_A';
 for(const user of [f.a,f.b])await f.checked(user.token,'/api/conversations','POST',{id:conversationId});
 f.scripts.set('A',(_body,_raw,res)=>{res.writeHead(401,{'content-type':'application/json'}).end(JSON.stringify({error:{message:'GENERATED_PRIVATE_PROVIDER_BODY GENERATED_A_KEY'}}));});
 const scope={after:'2026-01-01T00:00:00Z',before:'2026-01-02T00:00:00Z',deviceId:'generated-device',timeZone:'Asia/Shanghai'};
 await f.checked(f.a.token,'/api/query-runs','POST',{id,input:{question,conversationId,turnId,...scope}});
 await f.checked(f.b.token,'/api/query-runs','POST',{id,input:{question:'GENERATED_EQUAL_ID_B',conversationId,turnId}});
 // Canonical failure publication belongs to the coordinator lifecycle. Opening
 // a run or history page is not required to make a failed question durable.
 await until(()=>f.read(db=>Number(db.prepare('SELECT count(*) n FROM ma_turns WHERE user_id=? AND conversation_id=?').get(f.a.userId,conversationId)!.n))===1,'coordinator did not persist failed question');
 const saved=f.read(db=>db.prepare('SELECT * FROM ma_turns WHERE user_id=? AND conversation_id=?').get(f.a.userId,conversationId)!);
 assert.equal(saved.pins,'[]');assert.equal(saved.materials,'[]');assert.notEqual(saved.id,turnId);
 assert.equal(JSON.parse(String(saved.input)).turnId,saved.id);assert.equal(failedAskTurnResult(JSON.parse(String(saved.result)))?.error.code,'provider_authentication');
 const failed=await f.checked(f.a.token,'/api/conversations/'+conversationId);assert.equal(failed.turnCount,1);assert.equal(failed.status,'failed');assert.equal(failed.turns[0].status,'failed');assert.equal(failed.turns[0].question,question);assert.deepEqual(failed.turns[0].scope,scope);assert.equal(failed.turns[0].result,undefined);assert.equal(failed.turns[0].error.code,'provider_authentication');
 assert.doesNotMatch(JSON.stringify(failed),/GENERATED_PRIVATE_PROVIDER_BODY|GENERATED_A_KEY/);
 assert.equal((await f.wait(f.b,id)).status,'completed');const other=await f.checked(f.b.token,'/api/conversations/'+conversationId);assert.equal(other.turns[0].id,turnId);assert.equal(other.turns[0].question,'GENERATED_EQUAL_ID_B');assert.equal(other.turns[0].status,'completed');
 const another=randomUUID();await f.checked(f.a.token,'/api/conversations','POST',{id:another});await f.checked(f.a.token,'/api/conversations/'+another);await f.restart();
 const reopened=await f.checked(f.a.token,'/api/conversations/'+conversationId);assert.equal(reopened.turns[0].question,question);assert.equal(reopened.turns[0].status,'failed');assert.equal((await f.checked(f.a.token,'/api/conversations')).items.find((item:any)=>item.id===conversationId).status,'failed');
 f.scripts.delete('A');const context=await f.node.authority.authenticate(f.a.token),before=f.requests.length;f.node.ask!.bind(context,{assertCurrent:()=>f.node.authority.assert(context)}).retry(id);
 const retried=await f.wait(f.a,id);assert.equal(retried.status,'completed',JSON.stringify(retried));
 const calls=f.requests.slice(before).filter(call=>call.owner==='A');assert.ok(calls.length>0);for(const call of calls){const prompt=JSON.parse(typeof call.body.messages[0].content==='string'?call.body.messages[0].content:call.body.messages[0].content[0].text);assert.deepEqual(prompt.conversation?.turns,[],'failed questions must not become model dialogue');}
 const page=await f.checked(f.a.token,'/api/conversations/'+conversationId+'?limit=1');assert.equal(page.status,'completed');assert.equal(page.turnCount,2);assert.equal(page.turns[0].id,turnId);assert.equal(page.turns[0].status,'completed');assert.ok(page.nextCursor);
 const older=await f.checked(f.a.token,'/api/conversations/'+conversationId+'?limit=1&cursor='+encodeURIComponent(page.nextCursor));assert.equal(older.turns[0].status,'failed');assert.equal(older.turns[0].question,question);assert.equal(older.nextCursor,null);
});

test('portable failed-question history restores without model authority and rejects provider prose or invented evidence',async t=>{
 const f=await historyAskFixture(t),id=randomUUID();f.scripts.set('A',(_body,_raw,res)=>{res.writeHead(401,{'content-type':'application/json'}).end('{}');});
 await f.checked(f.a.token,'/api/query-runs','POST',{id,input:{question:'GENERATED_PORTABLE_FAILED_QUESTION'}});assert.equal((await f.wait(f.a,id)).status,'failed');
 const service=f.node.services.forUser(await f.node.authority.authenticate(f.a.token)),archive=await service.exportUser('ask'),payload=archive.payload as any;
 assert.equal(payload.turns.length,1);assert.equal(payload.runs.length,0);assert.equal(payload.artifacts.length,0);assert.equal(payload.coverage.activeAuthority,false);const count=f.requests.length;
 await service.deleteUser('ask',randomUUID());
 const corrupted=structuredClone(archive) as any;corrupted.payload.turns[0].result=JSON.stringify({...JSON.parse(corrupted.payload.turns[0].result),error:{code:'provider_authentication',message:'GENERATED_PRIVATE_PROVIDER_BODY'}});
 await assert.rejects(service.restoreUser('ask',corrupted,randomUUID()));
 const invented=structuredClone(archive) as any;invented.payload.turns[0].pins=JSON.stringify([{id:randomUUID(),hash:'a'.repeat(64)}]);await assert.rejects(service.restoreUser('ask',invented,randomUUID()));
 const operation=randomUUID();await service.restoreUser('ask',archive,operation);await service.restoreUser('ask',archive,operation);await f.restart();
 const restored=await f.checked(f.a.token,'/api/conversations/'+id);assert.equal(restored.turnCount,1);assert.equal(restored.turns[0].status,'failed');assert.equal(restored.turns[0].question,'GENERATED_PORTABLE_FAILED_QUESTION');assert.equal(restored.turns[0].result,undefined);
 await delay(100);assert.equal(f.requests.length,count,'restoring failed history cannot schedule a model call');assert.equal((await f.request(f.b.token,'/api/conversations/'+id)).statusCode,404);
});

for(const action of ['cancel','source-delete','credentials-revoked'] as const)test('late provider failure cannot append a question after '+action,async t=>{
 const f=await historyAskFixture(t);await f.publish(f.a,'A');const entered=deferred(),gate=deferred();t.after(()=>gate.resolve());
 f.scripts.set('A',async(body,raw,res,owner)=>{if(!body.messages.some((message:any)=>message.role==='assistant'&&message.content?.some((part:any)=>part.name==='material_read'))){historyRespond(body,raw,res,owner);return;}entered.resolve();await gate.promise;res.writeHead(401,{'content-type':'application/json'}).end('{}');});
 const id=randomUUID();await f.checked(f.a.token,'/api/query-runs','POST',{id,input:{question:'GENERATED_REVOKED_FAILED_QUESTION'}});await entered.promise;
 if(action==='cancel')await f.checked(f.a.token,'/api/query-runs/'+id+'/cancel','POST',{});
 else if(action==='source-delete')await f.checked(f.a.token,'/api/sources/same-source','DELETE');
 else await f.replace(f.a.token,'models',{profiles:[{id:'same-model',name:'Generated changed credential',settings:{...defaultModelSettings(),provider:'custom',protocol:'anthropic-messages',model:'generated-ask',baseUrl:f.modelUrl,apiKey:'',headers:{},extraBody:{}}}],selections:{chat:{kind:'personal',id:'same-model'},insight:{kind:'personal',id:'same-model'},memory:{kind:'personal',id:'same-model'}}});
 gate.resolve();assert.ok(['failed','cancelled'].includes((await f.wait(f.a,id)).status));await delay(100);assert.equal(f.read(db=>Number(db.prepare('SELECT count(*) n FROM ma_turns WHERE user_id=?').get(f.a.userId)!.n)),0);
 const control=randomUUID();await f.checked(f.b.token,'/api/query-runs','POST',{id:control,input:{question:'GENERATED_OTHER_OWNER_CONTROL'}});assert.equal((await f.wait(f.b,control)).status,'completed');
});

test('failure receipt publication excludes waiting, cancellation, stale authority and timeout metadata',()=>{
 const receipt:ExecutionFailureReceipt={stepId:'generated-step',operationId:'generated-operation',kind:'ask.chat',state:'blocked',category:'blocked',code:'provider_authentication',attempt:1,at:'2026-10-18T00:00:00Z'};
 assert.equal(publishableAskFailure({state:'blocked',failure:receipt}),receipt);
 for(const state of ['waiting','running','succeeded','cancelled','stale'] as const)assert.equal(publishableAskFailure({state,failure:{...receipt,state}}),undefined);
 for(const code of ['timeout','agent_request_timeout','provider_timeout','grant_revoked','input_changed','model_authority_revoked','ask_revoked','external_result_unknown'])assert.equal(publishableAskFailure({state:'blocked',failure:{...receipt,code}}),undefined);
 assert.equal(publishableAskFailure({state:'failed'}),undefined);assert.equal(publishableAskFailure({state:'blocked',failure:{...receipt,admissionWaiting:true}}),undefined);
});

test('real Agent execution timeout never publishes a failed history turn from a late provider result',async t=>{
 const f=await historyAskFixture(t),entered=deferred(),gate=deferred();t.after(()=>gate.resolve());
 await f.replace(f.a.token,'models',{profiles:[{id:'same-model',name:'Generated bounded request',settings:{...defaultModelSettings(),provider:'custom',protocol:'anthropic-messages',model:'generated-ask',baseUrl:f.modelUrl,apiKey:'GENERATED_A_KEY',headers:{},extraBody:{},modelRequestTimeoutMs:5000,agentTimeoutMs:5000}}],selections:{chat:{kind:'personal',id:'same-model'},insight:{kind:'personal',id:'same-model'},memory:{kind:'personal',id:'same-model'}}});
 f.scripts.set('A',async(_body,_raw,res)=>{entered.resolve();await gate.promise;if(!res.destroyed)res.writeHead(401,{'content-type':'application/json'}).end('{}');});
 const id=randomUUID();await f.checked(f.a.token,'/api/query-runs','POST',{id,input:{question:'GENERATED_TIMED_OUT_QUESTION'}});await entered.promise;
 const timedOut=await f.wait(f.a,id);assert.equal(timedOut.status,'failed');assert.equal(timedOut.error.code,'agent_request_timeout');assert.equal(f.read(db=>Number(db.prepare('SELECT count(*) n FROM ma_turns WHERE user_id=?').get(f.a.userId)!.n)),0);
 gate.resolve();await delay(100);assert.equal(f.read(db=>Number(db.prepare('SELECT count(*) n FROM ma_turns WHERE user_id=?').get(f.a.userId)!.n)),0);
});
