import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {modelFixture,event,respond} from './fixtures/scoped-actions.js';
import {deferred,waitForState} from './fixtures/scoped-query-accounts.js';

const target={deviceId:'same-device',calendarId:'same-calendar'};
async function proposed(t:Parameters<typeof modelFixture>[0]){const f=await modelFixture(t);await f.ingest(f.a,'A');await f.enable(f.a);await f.ok(f.a.token,'/api/actions/targets','POST',{deviceId:'same-device',deviceName:'Generated A',calendars:[{id:'same-calendar',title:'Generated A',accountId:'first-account'}]});const a=(await f.proposal(f.a)).items[0];return {...f,get node(){return f.node;},aProposal:a,input:{version:a.version,event:a.event,target}};}

test('review payload edits and target account changes invalidate old OwnerQuestions while an identical confirm is idempotent',async t=>{
 const f=await proposed(t),a=f.aProposal,q=await f.ok(f.a.token,'/api/actions/'+a.id+'/review','POST',f.input);
 await f.ok(f.a.token,'/api/actions/targets','POST',{deviceId:'same-device',deviceName:'Generated A',calendars:[{id:'same-calendar',title:'Generated A',accountId:'replacement-account'}]});
 assert.equal((await f.request(f.a.token,'/api/owner-questions/'+q.id+'/reply','POST',{requestId:randomUUID(),expectedRevision:q.revision,action:'answer',choiceId:'approve'})).statusCode,409);
 assert.equal((await f.ok(f.a.token,'/api/actions')).items[0].status,'proposed');
 const approved=await f.ok(f.a.token,'/api/actions/'+a.id+'/confirm','POST',f.input);assert.equal(approved.status,'approved');
 assert.deepEqual(await f.ok(f.a.token,'/api/actions/'+a.id+'/confirm','POST',f.input),approved);
 assert.equal((await f.request(f.a.token,'/api/actions/'+a.id+'/confirm','POST',{...f.input,event:{...a.event,title:'unreviewed'}})).statusCode,409);
 await f.ok(f.a.token,'/api/actions/targets','POST',{deviceId:'same-device',deviceName:'Generated A',calendars:[{id:'same-calendar',title:'Generated A',accountId:'third-account'}]});
 assert.equal((await f.request(f.a.token,'/api/actions/'+a.id+'/claim','POST',{deviceId:'same-device'})).statusCode,409);
 assert.equal(f.read(db=>Number(db.prepare('SELECT count(*) n FROM task_external_calls WHERE user_id=?').get(f.a.userId)!.n)),0);
});

test('source disable and re-enable never resurrect an already reviewed approval',async t=>{
 const f=await proposed(t),q=await f.ok(f.a.token,'/api/actions/'+f.aProposal.id+'/review','POST',f.input);
 await f.ok(f.a.token,'/api/sources/same-source','PATCH',{enabled:false});await f.ok(f.a.token,'/api/sources/same-source','PATCH',{enabled:true});
 assert.equal((await f.request(f.a.token,'/api/owner-questions/'+q.id+'/reply','POST',{requestId:randomUUID(),expectedRevision:q.revision,action:'answer',choiceId:'approve'})).statusCode,409);
 const a=(await f.ok(f.a.token,'/api/actions')).items[0];assert.equal(a.status,'stale');assert.deepEqual(a.evidence,[]);
});

for(const control of ['cancel','grant-revoke','target-change','account-disable','credential-revoke','delete'] as const)test('late exact native ACK records an external fact without private publication after '+control,async t=>{
 const f=await proposed(t),a=await f.ok(f.a.token,'/api/actions/'+f.aProposal.id+'/confirm','POST',f.input),claim=await f.ok(f.a.token,'/api/actions/'+a.id+'/claim','POST',{deviceId:'same-device'});assert.equal(claim.mutationAllowed,true);
 const context=await f.node.authority.authenticate(f.a.token),callback=f.node.actions!.delivery.bindReceipt(context,a.id,'same-device',a.operationId),bId=randomUUID();assert.equal((await f.request(f.b.token,'/api/todos','POST',{id:bId,title:'Generated unchanged B'})).statusCode,201);const beforeB=await f.ok(f.b.token,'/api/todos');
 if(control==='cancel')await f.ok(f.a.token,'/api/actions/'+a.id+'/cancel','POST',{version:a.version});
 if(control==='grant-revoke'){const v=await f.ok(f.a.token,'/api/actions');await f.ok(f.a.token,'/api/actions/settings','PUT',{revision:v.revision,authorizationRevision:v.authorizationRevision,settings:{...v.settings,reviewDeviceIds:[]}});}
 if(control==='target-change')await f.ok(f.a.token,'/api/actions/targets','POST',{deviceId:'same-device',deviceName:'Generated A',calendars:[{id:'same-calendar',title:'Generated A',accountId:'different-account'}]});
 if(control==='account-disable')await f.ok(f.admin.token,'/api/admin/accounts/'+f.a.userId,'PATCH',{disabled:true});
 if(control==='credential-revoke')await f.ok(f.a.token,'/api/auth/logout','POST',{});
 if(control==='delete')await f.node.services.forUser(context).deleteUser('actions','generated-delete');
 assert.deepEqual(await callback({operationId:a.operationId,status:'succeeded',externalId:'generated-external'}),{acknowledged:true,published:false});
 const facts=f.read(db=>db.prepare('SELECT o.published,o.ack,c.state FROM ac_operations o JOIN task_external_calls c ON c.issuance_id=o.issuance_id AND c.user_id=o.user_id WHERE o.user_id=? AND o.id=?').get(f.a.userId,a.operationId)!);assert.equal(facts.published,0);assert.equal(facts.state,'succeeded');assert.equal(JSON.parse(String(facts.ack)).externalId,'generated-external');
 assert.deepEqual(await callback({operationId:a.operationId,status:'succeeded',externalId:'generated-external'}),{acknowledged:true,published:false});
 await assert.rejects(callback({operationId:a.operationId,status:'succeeded',externalId:'conflicting-external'}));assert.deepEqual(await f.ok(f.b.token,'/api/todos'),beforeB);
 if(control==='delete')assert.equal(f.read(db=>db.prepare('SELECT e.state FROM ac_operations o JOIN execution_steps e ON e.id=o.task_id WHERE o.user_id=? AND o.id=?').get(f.a.userId,a.operationId)!.state),'cancelled');
});

test('held real Harness model output cannot publish after original deletion, and deletion scrubs proposals immediately',async t=>{
 const f=await proposed(t),initial=f.aProposal,raw=f.read(db=>String(db.prepare('SELECT id FROM pd_captures WHERE user_id=? LIMIT 1').get(f.a.userId)!.id));
 const entered=deferred(),release=deferred();t.after(()=>release.resolve());f.scripts.set('A',async(body,text,res)=>{if(body.messages.some((message:any)=>message.role==='assistant'&&message.content?.some((part:any)=>part.type==='tool_use'&&part.name==='evidence'))){entered.resolve();await release.promise;}respond(body,text,res,'A');});
 await f.ingest(f.a,'A','held-original');await f.ok(f.a.token,'/api/actions/retry','POST',{});await entered.promise;
 await f.ok(f.a.token,'/api/captures/'+raw,'DELETE');
 const stored=f.read(db=>String(db.prepare('SELECT json FROM ac_proposals WHERE user_id=? AND id=?').get(f.a.userId,initial.id)!.json));assert.ok(!stored.includes('GENERATED_A_PRIVATE_APPOINTMENT'),'deleted original quote is scrubbed before another Actions read');
 await f.ok(f.a.token,'/api/sources/same-source','DELETE');release.resolve();
 await waitForState(()=>f.ok(f.a.token,'/api/tasks'),value=>!value.items.some((task:any)=>task.kind==='actions.extract'&&task.state==='running'),'late extraction termination');
 assert.equal(f.read(db=>Number(db.prepare("SELECT count(*) n FROM ac_proposals WHERE user_id=? AND json_extract(json,'$.status')!='stale'").get(f.a.userId)!.n)),0);
});

test('portable action restore validates atomically and restores history without approval authority',async t=>{
 const f=await proposed(t),context=await f.node.authority.authenticate(f.a.token),services=f.node.services.forUser(context),archive=await services.exportUser('actions'),clone={...(archive.payload as any).proposals[0],id:randomUUID()};
 await services.restoreUser('actions',{...archive,payload:{...(archive.payload as any),proposals:[clone]}},'generated-restore');
 const restored=(await f.ok(f.a.token,'/api/actions')).items.find((a:any)=>a.id===clone.id);assert.equal(restored.status,'stale');assert.equal(restored.operationId,undefined);assert.equal(restored.event.title,clone.event.title);
 await assert.rejects(services.restoreUser('actions',{...archive,payload:{...(archive.payload as any),proposals:[{...clone,id:randomUUID()},{id:'malformed'}]}},'generated-invalid-restore'));
 assert.equal(f.read(db=>Number(db.prepare('SELECT count(*) n FROM ac_proposals WHERE user_id=?').get(f.a.userId)!.n)),2);
});

test('the immutable review exposes the exact edited content and native account while cross-user details stay absent',async t=>{
 const f=await proposed(t),input={...f.input,event:{...f.input.event,title:'Generated explicitly edited title',description:'Generated complete reviewed description'}},q=await f.ok(f.a.token,'/api/actions/'+f.aProposal.id+'/review','POST',input);
 assert.deepEqual(q.reviewedAction.event,input.event);assert.deepEqual(q.reviewedAction.target,target);assert.equal(q.reviewedAction.targetDetails.calendar.accountId,'first-account');
 const path='/api/actions/'+f.aProposal.id+'/reviews/'+q.id;assert.deepEqual((await f.ok(f.a.token,path)).reviewedAction,q.reviewedAction);assert.equal((await f.request(f.b.token,path)).statusCode,404);
 await f.ok(f.a.token,'/api/owner-questions/'+q.id+'/reply','POST',{requestId:randomUUID(),expectedRevision:q.revision,action:'answer',choiceId:'dismiss'});
 assert.equal((await f.ok(f.a.token,'/api/actions')).items[0].status,'dismissed');
});
