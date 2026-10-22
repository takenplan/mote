import test from 'node:test';
import assert from 'node:assert/strict';
import {modelFixture,respond} from './fixtures/scoped-actions.js';
import {deferred,waitForState} from './fixtures/scoped-query-accounts.js';

type Fixture=Awaited<ReturnType<typeof modelFixture>>;
type User=Fixture['a'];
const calendarRequest=(body:any)=>JSON.parse(typeof body.messages[0].content==='string'?body.messages[0].content:body.messages[0].content[0].text).responseMode==='calendar-extraction';
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
 const before=successful(f,f.a),calls=f.requests.length,nativeCalls=()=>f.read(db=>db.prepare('SELECT c.* FROM task_external_calls c JOIN ac_operations o ON o.user_id=c.user_id AND o.task_id=c.task_id WHERE o.user_id=? AND o.id=? ORDER BY c.issuance_id').all(f.a.userId,approved.operationId)),nativeBefore=nativeCalls();assert.equal(nativeBefore.length,1);
 await settings(f,f.a,false);await settings(f,f.a,true,'Asia/Shanghai');await watchSettled(f,f.a);await f.restart();await wake(f,f.a);
 assert.equal(f.requests.length,calls);assert.deepEqual(successful(f,f.a),before);
 const claim=await f.ok(f.a.token,'/api/actions/'+a.id+'/claim','POST',{deviceId:'same-device'});assert.equal(claim.status,'uncertain');assert.equal(claim.mutationAllowed,false);
 assert.deepEqual(nativeCalls(),nativeBefore,'Ordinary lifecycle changes cannot issue or rewrite the exact native call');
 assert.equal((await f.request(f.b.token,'/api/actions/'+a.id+'/claim','POST',{deviceId:'same-device'})).statusCode,404);
});

test('an exactly cancelled in-flight model remains fenced and retry waits for its original physical cleanup',async t=>{
 const f=await modelFixture(t),entered=deferred(),release=deferred();t.after(()=>release.resolve());
 // Preserve an actual callback that ignores cancellation during cleanup.
 // Harness itself honors cancellation, so a held HTTP server alone cannot
 // attest that the host's physical callback is still unresolved.
 const configuration=f.node.configuration!,withModel=configuration.withModel.bind(configuration);let heldCleanup=0;
 configuration.withModel=async(lease,work)=>withModel(lease,async(settings,document)=>{
  const exactPhysical=f.read(db=>Boolean(db.prepare("SELECT 1 FROM task_physical_calls p JOIN execution_steps e ON e.id=p.task_id AND e.user_id=p.user_id WHERE p.user_id=? AND p.snapshot_id=? AND p.state='active' AND e.kind='actions.extract'").get(f.a.userId,lease.snapshotId)));
  try{return await work(settings,document);}finally{if(exactPhysical){heldCleanup++;await release.promise;}}
 });t.after(()=>{configuration.withModel=withModel;});
 f.scripts.set('A',async(body,raw,res)=>{if(calendarRequest(body)){entered.resolve();await release.promise;}respond(body,raw,res,'A');});
 await f.ingest(f.a,'A');await f.enable(f.a);await entered.promise;
 const tasks=await f.ok(f.a.token,'/api/tasks'),unit=tasks.items.find((task:any)=>task.kind==='actions.extract'&&task.state==='running');assert.ok(unit);
 const calendarCalls=()=>f.requests.filter(request=>calendarRequest(request.body)).length,calls=calendarCalls();
 await f.ok(f.a.token,'/api/tasks/'+unit.id+'/cancel','POST',{});await settings(f,f.a,true,'Asia/Shanghai');await watchSettled(f,f.a);
 assert.equal((await f.ok(f.a.token,'/api/tasks/'+unit.id)).state,'cancelled');
 await waitForState(async()=>heldCleanup,count=>count===1,'actual original callback entered held cleanup');
 const physical=f.read(db=>db.prepare("SELECT * FROM task_physical_calls WHERE task_id=? AND state='active'").all(unit.id));assert.equal(physical.length,1,'the negative retry must hit the actual original active callback');assert.equal(heldCleanup,1,'The actual owner callback remains held during uncooperative cleanup');
 const retryHistory=()=>f.read(db=>({rounds:db.prepare('SELECT * FROM execution_retry_rounds WHERE step_id=? ORDER BY id').all(unit.id),policy:db.prepare('SELECT * FROM execution_retry_policies WHERE step_id=?').get(unit.id),replays:db.prepare('SELECT p.* FROM task_external_policy_replays p JOIN task_external_calls c ON c.issuance_id=p.issuance_id WHERE c.task_id=? ORDER BY p.id').all(unit.id),confirmations:db.prepare('SELECT a.* FROM task_external_retry_confirmations a JOIN task_external_calls c ON c.issuance_id=a.issuance_id WHERE c.task_id=? ORDER BY a.confirmation_id').all(unit.id)})),priorHistory=retryHistory();
 const beforeRetry=await f.ok(f.a.token,'/api/tasks/'+unit.id),rejected=await f.request(f.a.token,'/api/actions/retry','POST',{});assert.equal(rejected.statusCode,409);assert.equal(rejected.json().error,'physical_cleanup_pending');assert.deepEqual(await f.ok(f.a.token,'/api/tasks/'+unit.id),beforeRetry,'a rejected retry cannot renew the round');assert.equal(calendarCalls(),calls);assert.deepEqual(retryHistory(),priorHistory,'a rejected retry cannot rewrite policy, confirmation or round history');
 release.resolve();await waitForState(async()=>f.read(db=>db.prepare('SELECT * FROM task_physical_calls WHERE id=?').get(physical[0].id)),row=>row?.state==='quiescent'&&Number(row.quiescent_at)>0,'exact original model callback cleanup completed');
 await waitForState(()=>f.ok(f.a.token,'/api/actions'),page=>!page.progress.running,'retired model run settled');
 assert.equal(calendarCalls(),calls);assert.equal((await f.ok(f.a.token,'/api/actions')).items.length,0);
 f.scripts.delete('A');await f.ok(f.a.token,'/api/actions/retry','POST',{});
 await waitForState(()=>f.ok(f.a.token,'/api/tasks/'+unit.id),task=>task.state==='succeeded','explicit retry reuses the original interrupted unit');
 assert.equal((await f.ok(f.a.token,'/api/actions')).items.length,1);assert.equal((await f.ok(f.b.token,'/api/actions')).items.length,0);
});


test('ordinary discovery disable and timezone tuning let an admitted model drain its original snapshot without retry',async t=>{
 const f=await modelFixture(t),entered=deferred(),release=deferred();t.after(()=>release.resolve());f.scripts.set('A',async(body,raw,res)=>{if(calendarRequest(body)){entered.resolve();await release.promise;}respond(body,raw,res,'A');});
 await f.ingest(f.a,'A');await f.enable(f.a);await entered.promise;const tasks=await f.ok(f.a.token,'/api/tasks'),unit=tasks.items.find((task:any)=>task.kind==='actions.extract'&&task.state==='running');assert.ok(unit);
 const snapshot=()=>f.read(db=>db.prepare('SELECT j.id,j.input,j.proof,j.task_id,t.model_receipt,e.input task_input FROM ac_jobs j JOIN user_tasks t ON t.user_id=j.user_id AND t.task_id=j.task_id JOIN execution_steps e ON e.user_id=t.user_id AND e.id=t.task_id WHERE j.user_id=? AND j.task_id=?').get(f.a.userId,unit.id)),before=snapshot(),count=f.read(db=>Number(db.prepare('SELECT count(*) n FROM ac_jobs WHERE user_id=?').get(f.a.userId)!.n)),rounds=f.read(db=>db.prepare('SELECT * FROM execution_retry_rounds WHERE step_id=? ORDER BY id').all(unit.id));assert.equal(JSON.parse(String(before!.input)).timeZone,'UTC');
 await settings(f,f.a,false);await settings(f,f.a,true,'Asia/Shanghai');await watchSettled(f,f.a);assert.equal((await f.ok(f.a.token,'/api/tasks/'+unit.id)).state,'running');assert.deepEqual(snapshot(),before);assert.deepEqual(f.read(db=>db.prepare('SELECT * FROM execution_retry_rounds WHERE step_id=? ORDER BY id').all(unit.id)),rounds);
 release.resolve();await waitForState(()=>f.ok(f.a.token,'/api/tasks/'+unit.id),task=>task.state==='succeeded','same admitted model drains through ordinary configuration');assert.deepEqual(snapshot(),before);assert.equal(f.read(db=>Number(db.prepare('SELECT count(*) n FROM ac_jobs WHERE user_id=?').get(f.a.userId)!.n)),count);assert.equal((await f.ok(f.a.token,'/api/actions')).items.length,1);assert.equal((await f.ok(f.b.token,'/api/actions')).items.length,0);assert.equal((await f.ok(f.a.token,'/api/actions')).settings.timeZone,'Asia/Shanghai');assert.deepEqual(f.read(db=>db.prepare('SELECT * FROM execution_retry_rounds WHERE step_id=? ORDER BY id').all(unit.id)),rounds);
});
