import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {modelFixture,respond} from './fixtures/scoped-actions.js';
import {source,deferred,waitForState} from './fixtures/scoped-query-accounts.js';
import {writeMessagesResponse} from '../../../scripts/fixtures/messages-provider.js';

test('cancelling the actual discovery parent prevents its held child from publishing',async t=>{
 const f=await modelFixture(t);await f.ingest(f.a,'A');await f.enable(f.a);await f.proposal(f.a);const before=f.read(db=>Number(db.prepare('SELECT count(*) n FROM ac_proposals WHERE user_id=?').get(f.a.userId)!.n));
 const entered=deferred(),release=deferred();t.after(()=>release.resolve());f.scripts.set('A',async(body,raw,res)=>{if(body.messages.some((m:any)=>m.role==='assistant'&&m.content?.some((part:any)=>part.name==='evidence'))){entered.resolve();await release.promise;}respond(body,raw,res,'A');});
 await f.ok(f.a.token,'/api/ingress/sources','POST',source('late-source'));await f.ingest(f.a,'A','late','late-source');await f.ok(f.a.token,'/api/actions/retry','POST',{});await entered.promise;
 const watcher=f.read(db=>String(db.prepare('SELECT policy_task FROM ac_state WHERE user_id=?').get(f.a.userId)!.policy_task));await f.ok(f.a.token,'/api/tasks/'+watcher+'/cancel','POST',{});release.resolve();
 await waitForState(()=>f.ok(f.a.token,'/api/tasks'),value=>!value.items.some((task:any)=>task.kind==='actions.extract'&&task.state==='running'),'actual stopped discovery children');
 assert.equal(f.read(db=>Number(db.prepare('SELECT count(*) n FROM ac_proposals WHERE user_id=?').get(f.a.userId)!.n)),before);
});

test('ordinary task HTTP cannot replay an already successful private action model locator',async t=>{
 const f=await modelFixture(t);await f.ingest(f.a,'A');await f.enable(f.a);await f.proposal(f.a);await waitForState(()=>f.ok(f.a.token,'/api/tasks'),value=>value.items.some((task:any)=>task.kind==='actions.extract'&&task.state==='succeeded'),'completed action model');
 const job=f.read(db=>String(db.prepare("SELECT id FROM ac_jobs WHERE user_id=? AND state='completed' LIMIT 1").get(f.a.userId)!.id)),before=f.requests.length,attempt=await f.request(f.a.token,'/api/tasks','POST',{kind:'actions.extract',operationId:'forged-replay',input:{jobId:job}});
 assert.equal(attempt.statusCode,409,attempt.body);assert.equal(f.requests.length,before);
 assert.equal((await f.request(f.b.token,'/api/tasks','POST',{kind:'actions.extract',operationId:'forged-replay',input:{jobId:job}})).statusCode,404);
});

test('real calendar model cannot select owner or native event identifiers in a proposal',async t=>{
 const f=await modelFixture(t);let attempts=0;f.scripts.set('A',(body,_raw,res)=>{const envelope=JSON.parse(typeof body.messages[0].content==='string'?body.messages[0].content:body.messages[0].content[0].text),id=envelope.untrustedEvidence[0].id;attempts++;const actions=attempts===1?[{kind:'calendar.create',ownerId:f.b.userId,externalId:'forged-native',event:{title:'Generated malicious',start:null,end:null,timeZone:null,allDay:false,location:'',description:''},uncertainty:'',sameAs:null,evidence:[{id,quote:'GENERATED_A_PRIVATE_APPOINTMENT'}]}]:[];writeMessagesResponse(res,{stage:attempts,text:JSON.stringify({answer:JSON.stringify({actions}),citationIds:[id]})});});
 await f.ingest(f.a,'A');await f.enable(f.a);await waitForState(()=>f.ok(f.a.token,'/api/tasks'),value=>value.items.some((task:any)=>task.kind==='actions.extract'&&task.state==='succeeded'),'repaired empty model output');assert.ok(attempts>=2);assert.equal((await f.ok(f.a.token,'/api/actions')).items.length,0);assert.equal(f.read(db=>Number(db.prepare('SELECT count(*) n FROM ac_operations WHERE user_id=?').get(f.a.userId)!.n)),0);assert.ok(f.requests.every(request=>request.owner==='A'));
});
