import test from 'node:test';
import assert from 'node:assert/strict';
import {modelFixture,respond} from './fixtures/scoped-actions.js';
import {deferred,waitForState} from './fixtures/scoped-query-accounts.js';

type Fixture=Awaited<ReturnType<typeof modelFixture>>;
type User=Fixture['a'];
const successful=(f:Fixture,user:User)=>f.read(db=>db.prepare("SELECT j.id,j.input,j.proof,j.task_id,e.attempts FROM ac_jobs j JOIN execution_steps e ON e.id=j.task_id WHERE j.user_id=? AND j.state='completed' ORDER BY j.id").all(user.userId));
const position=(f:Fixture,user:User)=>f.read(db=>db.prepare('SELECT captures,materials FROM ac_discovery_state WHERE user_id=?').get(user.userId));
async function settings(f:Fixture,user:User,enabled:boolean,timeZone='UTC'){
 const view=await f.ok(user.token,'/api/actions');
 await f.ok(user.token,'/api/actions/settings','PUT',{revision:view.revision,authorizationRevision:view.authorizationRevision,settings:{enabled,timeZone,reviewDeviceIds:view.settings.reviewDeviceIds}});
}
async function watchSettled(f:Fixture,user:User,afterAvailableAt=0){
 return waitForState(async()=>f.read(db=>db.prepare('SELECT e.id,e.state,e.available_at FROM ac_state s JOIN execution_steps e ON e.id=s.policy_task WHERE s.user_id=?').get(user.userId)),row=>row?.state==='waiting'&&Number(row.available_at)>afterAvailableAt,'current owned discovery watch completed its scan');
}
async function wake(f:Fixture,user:User){
 const before=await watchSettled(f,user);
 await f.ok(user.token,'/api/actions/retry','POST',{});
 await watchSettled(f,user,Number(before!.available_at));
}

test('production enable, timezone and restart preserve successful units and per-user discovery positions',async t=>{
 const f=await modelFixture(t);
 for(const [user,label] of [[f.a,'A'],[f.b,'B']] as const){await f.ingest(user,label);await f.enable(user);await f.proposal(user);await watchSettled(f,user);}
 await waitForState(async()=>successful(f,f.a),rows=>rows.length>0,'A completed original analysis');
 await waitForState(async()=>successful(f,f.b),rows=>rows.length>0,'B completed original analysis');
 const before=successful(f,f.a),beforeB=successful(f,f.b),aPage=await f.ok(f.a.token,'/api/actions'),bPage=await f.ok(f.b.token,'/api/actions'),aPosition=position(f,f.a),bPosition=position(f,f.b),calls=f.requests.length;
 assert.ok(Number(aPosition?.captures)>0&&Number(aPosition?.materials)>0);
 await settings(f,f.a,false);await settings(f,f.a,true);await watchSettled(f,f.a);
 assert.equal(f.requests.length,calls);assert.deepEqual(successful(f,f.a),before);assert.deepEqual(position(f,f.a),aPosition);
 await settings(f,f.a,true,'Asia/Shanghai');await watchSettled(f,f.a);
 assert.equal(f.requests.length,calls);assert.deepEqual(successful(f,f.a),before);assert.deepEqual((await f.ok(f.a.token,'/api/actions')).items,aPage.items);
 assert.deepEqual(successful(f,f.b),beforeB);assert.deepEqual(position(f,f.b),bPosition);assert.deepEqual(await f.ok(f.b.token,'/api/actions'),bPage);
 await f.restart();await wake(f,f.a);
 assert.equal(f.requests.length,calls);assert.deepEqual(successful(f,f.a),before);assert.deepEqual(position(f,f.a),aPosition);
 await settings(f,f.a,false,'Asia/Shanghai');await f.ingest(f.a,'A','new-while-disabled','other-source');
 assert.equal(f.requests.length,calls);await settings(f,f.a,true,'Asia/Shanghai');await watchSettled(f,f.a);
 await waitForState(()=>f.ok(f.a.token,'/api/actions'),page=>page.items.length===2,'new input after re-enable is analyzed');
 assert.ok(f.requests.length>calls);for(const row of before)assert.deepEqual(successful(f,f.a).find(value=>value.id===row.id),row);
 assert.deepEqual(successful(f,f.b),beforeB);assert.deepEqual(await f.ok(f.b.token,'/api/actions'),bPage);
 for(const request of f.requests)assert.ok(!request.raw.includes(request.owner==='A'?'GENERATED_B_PRIVATE':'GENERATED_A_PRIVATE'));
});

test('failed units remain explicit owned retries across settings changes and restart',async t=>{
 const f=await modelFixture(t);await f.ingest(f.a,'A');await f.enable(f.a);await f.proposal(f.a);await watchSettled(f,f.a);
 const before=successful(f,f.a);
 f.scripts.set('A',(_body,_raw,res)=>{res.writeHead(401,{'content-type':'application/json'});res.end('{}');});
 await f.ingest(f.a,'A','generated-failed','other-source');await wake(f,f.a);
 const failed=await waitForState(()=>f.ok(f.a.token,'/api/tasks'),page=>page.items.some((task:any)=>task.kind==='actions.extract'&&['failed','blocked'].includes(task.state)),'owned failed extraction');
 const unit=failed.items.find((task:any)=>task.kind==='actions.extract'&&['failed','blocked'].includes(task.state)),calls=f.requests.length;
 await settings(f,f.a,false);await settings(f,f.a,true,'Asia/Shanghai');await watchSettled(f,f.a);
 assert.equal(f.requests.length,calls);assert.equal((await f.ok(f.a.token,'/api/tasks/'+unit.id)).attempts,unit.attempts);assert.deepEqual(successful(f,f.a),before);
 assert.equal((await f.ok(f.a.token,'/api/actions')).progress.errorCode,'provider_authentication');
 await f.restart();await watchSettled(f,f.a);assert.equal(f.requests.length,calls);
 f.scripts.delete('A');await f.ok(f.a.token,'/api/actions/retry','POST',{});
 await waitForState(()=>f.ok(f.a.token,'/api/tasks/'+unit.id),task=>task.state==='succeeded','same failed business unit explicitly retried');
 assert.deepEqual(successful(f,f.a).filter(row=>before.some(old=>old.id===row.id)),before);
 assert.equal((await f.ok(f.b.token,'/api/actions')).items.length,0);
});

test('discovery lifecycle changes leave an unknown native issuance in reconcile-only state',async t=>{
 const f=await modelFixture(t);await f.ingest(f.a,'A');await f.enable(f.a);const a=(await f.proposal(f.a)).items[0];await watchSettled(f,f.a);
 await f.ok(f.a.token,'/api/actions/targets','POST',{deviceId:'same-device',deviceName:'Generated A',calendars:[{id:'same-calendar',title:'Generated A'}]});
 const approved=await f.ok(f.a.token,'/api/actions/'+a.id+'/confirm','POST',{version:a.version,event:a.event,target:{deviceId:'same-device',calendarId:'same-calendar'}});
 assert.equal((await f.ok(f.a.token,'/api/actions/'+a.id+'/claim','POST',{deviceId:'same-device'})).mutationAllowed,true);
 await f.ok(f.a.token,'/api/actions/'+a.id+'/receipt','POST',{deviceId:'same-device',operationId:approved.operationId,status:'uncertain'});
 const before=successful(f,f.a),calls=f.requests.length;
 await settings(f,f.a,false);await settings(f,f.a,true,'Asia/Shanghai');await watchSettled(f,f.a);await f.restart();await wake(f,f.a);
 assert.equal(f.requests.length,calls);assert.deepEqual(successful(f,f.a),before);
 const claim=await f.ok(f.a.token,'/api/actions/'+a.id+'/claim','POST',{deviceId:'same-device'});assert.equal(claim.status,'uncertain');assert.equal(claim.mutationAllowed,false);
 assert.equal(f.read(db=>Number(db.prepare('SELECT count(*) n FROM task_external_calls WHERE user_id=?').get(f.a.userId)!.n)),1);
 assert.equal((await f.request(f.b.token,'/api/actions/'+a.id+'/claim','POST',{deviceId:'same-device'})).statusCode,404);
});

test('an in-flight model result is fenced across re-enable and resumes only through the existing explicit retry',async t=>{
 const f=await modelFixture(t),entered=deferred(),release=deferred();t.after(()=>release.resolve());
 f.scripts.set('A',async(body,raw,res)=>{entered.resolve();await release.promise;respond(body,raw,res,'A');});
 await f.ingest(f.a,'A');await f.enable(f.a);await entered.promise;
 const tasks=await f.ok(f.a.token,'/api/tasks'),unit=tasks.items.find((task:any)=>task.kind==='actions.extract'&&task.state==='running');assert.ok(unit);
 const calls=f.requests.length;
 await settings(f,f.a,false);await settings(f,f.a,true,'Asia/Shanghai');await watchSettled(f,f.a);
 assert.equal((await f.ok(f.a.token,'/api/tasks/'+unit.id)).state,'cancelled');
 release.resolve();await waitForState(()=>f.ok(f.a.token,'/api/actions'),page=>!page.progress.running,'retired model run settled');
 assert.equal(f.requests.length,calls);assert.equal((await f.ok(f.a.token,'/api/actions')).items.length,0);
 f.scripts.delete('A');await f.ok(f.a.token,'/api/actions/retry','POST',{});
 await waitForState(()=>f.ok(f.a.token,'/api/tasks/'+unit.id),task=>task.state==='succeeded','explicit retry reuses the original interrupted unit');
 assert.equal((await f.ok(f.a.token,'/api/actions')).items.length,1);assert.equal((await f.ok(f.b.token,'/api/actions')).items.length,0);
});
