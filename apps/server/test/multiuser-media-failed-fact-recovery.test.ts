import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {setTimeout as delay} from 'node:timers/promises';
import {fixture,media,respond,deferred,until} from './fixtures/scoped-processing.js';

type Fixture=Awaited<ReturnType<typeof fixture>>;
type Fact=Record<string,unknown>;
const key='GENERATED_FAILED_FACT_KEY',future=()=>Date.now()+3600000;
const terminal=(requestId:string,incarnation:string):Fact=>({version:1,requestId,incarnation,stage:'transcribe',state:'failed',acceptedAt:1,startedAt:2,finishedAt:3,outcome:'processing_failed'});

async function worker(t:Parameters<typeof fixture>[0],successAt=2){
 const requests:{id:string;scope:string}[]=[],reads:string[]=[],incarnation=randomUUID();let state='running',hold:(()=>Promise<void>)|undefined;
 const endpoint=await media(t,async(req,res)=>{
  assert.equal(req.headers.authorization,'Bearer '+key);
  if(req.method==='GET'){
   const id=String(req.url).slice('/executions/'.length),request=requests.find(value=>value.id===id);assert.ok(request);assert.equal(req.url,'/executions/'+request.id);assert.equal(req.headers['x-mote-request-scope'],request.scope);reads.push(id);await hold?.();
   res.setHeader('Content-Type','application/json');res.end(JSON.stringify(state==='failed'?terminal(id,incarnation):{version:1,requestId:id,incarnation,stage:'transcribe',state,acceptedAt:1,startedAt:2}));return;
  }
  assert.equal(req.method,'POST');assert.equal(req.url,'/transcribe');const id=String(req.headers['x-mote-request-id']),scope=String(req.headers['x-mote-request-scope']);assert.match(id,/^[a-f0-9-]{36}$/);assert.match(scope,/^[a-f0-9]{64}$/);assert.ok(!requests.some(value=>value.id===id),'each actual attempt has a new exact request identity');requests.push({id,scope});
  if(requests.length<successAt){res.destroy();return;}res.setHeader('X-Mote-Receipt-Id',id);respond(res,'GENERATED_RECOVERED_ASR',1000);
 });
 return {endpoint,requests,reads,incarnation,setState:(value:string)=>{state=value;},hold:(work?:()=>Promise<void>)=>{hold=work;}};
}

function pause(f:Fixture,id:string){f.read(db=>db.prepare("UPDATE execution_steps SET available_at=? WHERE id=? AND state='waiting'").run(future(),id));}
function wake(f:Fixture,id:string){f.read(db=>db.prepare("UPDATE execution_steps SET available_at=0 WHERE id=? AND state='waiting'").run(id));void f.node.execution!.tick();}
const row=(f:Fixture,id:string)=>f.read(db=>db.prepare('SELECT state,error,attempts FROM execution_steps WHERE id=?').get(id)!);
async function waiting(f:Fixture,id:string,error:string,attempts:number){await until(()=>{const value=row(f,id);return value.state==='waiting'&&value.error===error&&value.attempts===attempts;},()=>JSON.stringify(row(f,id)));pause(f,id);}
async function start(f:Fixture,label:string,token=f.alice.token,userId=f.a.userId){
 const ref=(await f.upload(token,Buffer.from('GENERATED_AUDIO_'+label),'audio/wav',label)).captures[0].original.ref,parent=await f.submit(token,ref,label);
 await until(()=>f.read(db=>Boolean(db.prepare("SELECT 1 FROM execution_steps e JOIN user_tasks u ON u.task_id=e.id WHERE e.user_id=? AND e.kind='processing.asr' AND json_extract(u.input,'$.originalRef')=? AND e.state='waiting' AND e.error='provider_network'").get(userId,ref))),'generated ASR disconnect did not retain its issued task');
 const id=f.read(db=>String(db.prepare("SELECT e.id FROM execution_steps e JOIN user_tasks u ON u.task_id=e.id WHERE e.user_id=? AND e.kind='processing.asr' AND json_extract(u.input,'$.originalRef')=?").get(userId,ref)!.id));pause(f,id);
 await until(()=>f.read(db=>!db.prepare("SELECT 1 FROM task_physical_calls WHERE task_id=? AND state='active'").get(id)),'the original HTTP callback did not complete cleanup');return {id,ref,parent:parent.id};
}
function accounting(f:Fixture,id:string,userId=f.a.userId){return f.read(db=>({
 charged:db.prepare('SELECT id,round,charged,executed,pending,open FROM execution_attempt_sessions WHERE step_id=? AND charged=1 ORDER BY id').all(id),
 executed:db.prepare('SELECT id FROM execution_attempt_sessions WHERE step_id=? AND executed=1 ORDER BY id').all(id),
 model:db.prepare('SELECT model_receipt FROM user_tasks WHERE task_id=?').get(id)!.model_receipt,
 modelAttempts:db.prepare('SELECT * FROM task_model_attempts WHERE task_id=? ORDER BY attempt_id').all(id),
 snapshots:db.prepare('SELECT id FROM user_model_snapshots WHERE user_id=? ORDER BY id').all(userId),
 usage:db.prepare('SELECT json FROM user_model_usage WHERE user_id=? ORDER BY rowid').all(userId),
 physical:db.prepare('SELECT * FROM task_physical_calls WHERE task_id=? ORDER BY id').all(id),
}));}
function calls(f:Fixture,id:string){return f.read(db=>db.prepare('SELECT m.*,c.state,c.settled_at,c.attempt FROM mp_media_calls m JOIN task_external_calls c ON c.issuance_id=m.issuance_id AND c.user_id=m.user_id AND c.task_id=m.task_id WHERE m.task_id=? ORDER BY c.issued_at,c.rowid').all(id));}
function noRecoveryAuthorization(f:Fixture,id:string){f.read(db=>{for(const table of ['task_external_retry_confirmations','task_external_policy_replays'])assert.equal(db.prepare('SELECT count(*) n FROM '+table+' a JOIN task_external_calls c ON c.issuance_id=a.issuance_id WHERE c.task_id=?').get(id)!.n,0);assert.equal(db.prepare('SELECT count(*) n FROM execution_retry_rounds WHERE step_id=?').get(id)!.n,0);assert.ok(db.prepare('SELECT replay_confirmed FROM mp_media_calls WHERE task_id=?').all(id).every(value=>value.replay_confirmed===0));});}
async function observe(f:Fixture,id:string,w:Awaited<ReturnType<typeof worker>>,state:'running'|'failed',attempts:number){const count=w.reads.length;w.setState(state);wake(f,id);await until(()=>w.reads.length===count+1,'exact worker fact was not read');await waiting(f,id,state==='running'?'processor_still_running':'processor_execution_failed',attempts);}
async function succeeded(f:Fixture,input:Awaited<ReturnType<typeof start>>,attempts:number){const result=await f.wait(f.alice.token,input.id);assert.equal(result.attempts,attempts);assert.equal(result.maxAttempts,3);assert.equal(result.retryRound,1);await f.wait(f.alice.token,input.parent);const status=await f.status(f.alice.token,input.ref);assert.equal(status.processed,true);assert.equal(status.indexed,true);assert.equal((await f.checked(f.alice.token,'/api/materials/'+status.materialId+'/read')).text,'GENERATED_RECOVERED_ASR');assert.equal((await f.request(f.bob.token,'/api/tasks/'+input.id)).statusCode,404);noRecoveryAuthorization(f,input.id);}

test('ASR facts polling survives repeat and restart without new execution accounting, then the same task retries a known failed request',async t=>{
 const w=await worker(t),f=await fixture(t);await f.models(f.alice.token,w.endpoint,key);const input=await start(f,'running-restart'),before=accounting(f,input.id);assert.equal(before.charged.length,1);assert.equal(before.executed.length,1);assert.equal(before.usage.length,1);assert.equal(before.physical.length,1);
 for(let i=0;i<2;i++){await observe(f,input.id,w,'running',1);assert.deepEqual(accounting(f,input.id),before);assert.equal((await f.status(f.alice.token,input.ref)).processed,false);}
 await f.restart();await observe(f,input.id,w,'running',1);assert.deepEqual(accounting(f,input.id),before);assert.equal(w.requests.length,1);
 const pending=f.read(db=>db.prepare('SELECT charged,executed,pending FROM execution_attempt_sessions WHERE step_id=? AND open=1').get(input.id)!);assert.deepEqual({...pending},{charged:0,executed:0,pending:0});
 await observe(f,input.id,w,'failed',1);assert.deepEqual(accounting(f,input.id),before);const failed=calls(f,input.id)[0];assert.equal(failed.state,'succeeded');assert.ok(failed.settled_at);assert.equal(failed.supported,1);assert.equal(failed.result_accepted,0);assert.equal(failed.replay_confirmed,0);assert.deepEqual(JSON.parse(String(failed.fact)),terminal(w.requests[0].id,w.incarnation));assert.equal(w.requests.length,1);
 wake(f,input.id);await succeeded(f,input,2);assert.equal(w.requests.length,2);assert.equal(w.reads.length,4);const history=calls(f,input.id);assert.equal(history.length,2);assert.equal(history[0].issuance_id,failed.issuance_id);assert.equal(history[0].fact,failed.fact);assert.equal(history[0].result_accepted,0);assert.equal(history[1].result_accepted,1);const after=accounting(f,input.id);assert.equal(after.charged.length,2);assert.equal(after.executed.length,2);assert.equal(after.usage.length,2);assert.equal(after.physical.length,2);
});

for(const success of [true,false])test('two reconciled failed ASR requests retain the third '+(success?'successful attempt':'unknown failure cap without a fourth POST'),async t=>{
 const w=await worker(t,success?3:4),f=await fixture(t);await f.models(f.alice.token,w.endpoint,key);const input=await start(f,'finite-'+success);
 for(let attempt=1;attempt<=2;attempt++){
  await observe(f,input.id,w,'failed',attempt);assert.equal(w.requests.length,attempt);assert.equal(accounting(f,input.id).charged.length,attempt);wake(f,input.id);
  if(attempt===1)await waiting(f,input.id,'provider_network',2);
 }
 if(success)await succeeded(f,input,3);else{const failed=await f.wait(f.alice.token,input.id,'failed');assert.equal(failed.attempts,3);assert.equal(failed.retryRound,1);assert.equal(failed.maxAttempts,3);assert.equal(failed.retryExhausted,true);assert.equal(failed.failure.code,'provider_network');assert.ok(['issued','unknown'].includes(failed.externalState));await f.restart();await f.node.execution!.tick();assert.equal(row(f,input.id).state,'failed');assert.equal((await f.status(f.alice.token,input.ref)).processed,false);}
 assert.equal(w.requests.length,3);assert.equal(new Set(w.requests.map(value=>value.id)).size,3);assert.equal(w.reads.length,2);const history=calls(f,input.id);assert.equal(history.length,3);assert.deepEqual(history.map(value=>value.attempt),[1,2,3]);for(const call of history.slice(0,2)){assert.equal(call.state,'succeeded');assert.equal(JSON.parse(String(call.fact)).state,'failed');assert.equal(call.result_accepted,0);assert.equal(call.replay_confirmed,0);}const budget=accounting(f,input.id);assert.equal(budget.charged.length,3);assert.equal(budget.executed.length,3);assert.equal(budget.usage.length,3);assert.equal(budget.physical.length,3);noRecoveryAuthorization(f,input.id);
});

// Simulate a durable generated journal at the post-fact/pre-retry restart
// boundary. Production HTTP created every task, model receipt and issuance.
function storeSettled(f:Fixture,id:string,fact:unknown,supported=1,snapshot?:string){const call=calls(f,id)[0];f.read(db=>{db.prepare('UPDATE mp_media_calls SET supported=?,fact=?,snapshot_id=? WHERE user_id=? AND task_id=? AND issuance_id=?').run(supported,typeof fact==='string'?fact:fact===null?null:JSON.stringify(fact),snapshot??String(call.snapshot_id),f.a.userId,id,call.issuance_id);db.prepare("UPDATE task_external_calls SET state='succeeded',settled_at=? WHERE issuance_id=? AND task_id=? AND user_id=?").run(Date.now(),call.issuance_id,id,f.a.userId);db.prepare("UPDATE user_tasks SET external_state='succeeded' WHERE task_id=? AND user_id=? AND external_issuance=?").run(id,f.a.userId,call.issuance_id);});}

test('the exact supported stored terminal failed proof survives restart without a metadata execution or an owner replay confirmation',async t=>{
 const w=await worker(t),f=await fixture(t);await f.models(f.alice.token,w.endpoint,key);const input=await start(f,'stored-proof');await observe(f,input.id,w,'running',1);const old=calls(f,input.id)[0],proof=terminal(String(old.request_id),w.incarnation);storeSettled(f,input.id,proof);const before=accounting(f,input.id);await f.restart();assert.deepEqual(accounting(f,input.id),before);wake(f,input.id);await succeeded(f,input,2);assert.equal(w.requests.length,2);assert.equal(w.reads.length,1);assert.deepEqual(JSON.parse(String(calls(f,input.id)[0].fact)),proof);
});

test('missing, malformed, unsupported and mismatched stored facts cannot waive a settled missing-result guard',async t=>{
 const w=await worker(t,Number.MAX_SAFE_INTEGER),f=await fixture(t);await f.models(f.alice.token,w.endpoint,key);await f.models(f.bob.token,w.endpoint,key);const foreign=await start(f,'foreign-proof',f.bob.token,f.b.userId),foreignCall=calls(f,foreign.id)[0],foreignProof=terminal(String(foreignCall.request_id),w.incarnation);
 const cases:{name:string;change:(proof:Fact)=>unknown;supported?:number;snapshot?:string}[]=[
  {name:'missing',change:()=>null},{name:'malformed',change:()=>'{'}, {name:'unsupported',change:value=>value,supported:0},
  {name:'wrong-request',change:value=>({...value,requestId:randomUUID()})},{name:'foreign-request',change:()=>foreignProof}, {name:'wrong-stage',change:value=>({...value,stage:'ocr'})},
  {name:'missing-incarnation',change:({incarnation,...value})=>value},{name:'missing-accepted',change:({acceptedAt,...value})=>value},{name:'missing-finished',change:({finishedAt,...value})=>value},
  {name:'unknown',change:value=>({...value,state:'unknown'})},{name:'succeeded',change:value=>({...value,state:'succeeded',outcome:'completed'})},
  {name:'extra-field',change:value=>({...value,untrustedExtra:true})},{name:'wrong-snapshot',change:value=>value,snapshot:randomUUID()},
 ];
 for(const item of cases){const input=await start(f,'invalid-'+item.name),call=calls(f,input.id)[0],before=accounting(f,input.id),postCount=w.requests.length;storeSettled(f,input.id,item.change(terminal(String(call.request_id),w.incarnation)),item.supported??1,item.snapshot);wake(f,input.id);const blocked=await f.wait(f.alice.token,input.id,'blocked');assert.equal(blocked.failure.code,'processor_result_unavailable',item.name);assert.equal(blocked.attempts,1,item.name);assert.equal(w.requests.length,postCount,item.name);assert.equal(w.reads.length,0,item.name);assert.deepEqual(accounting(f,input.id),before,item.name);assert.equal((await f.status(f.alice.token,input.ref)).processed,false,item.name);assert.equal((await f.request(f.bob.token,'/api/tasks/'+input.id)).statusCode,404);assert.equal((await f.request(f.alice.token,'/api/tasks/'+foreign.id)).statusCode,404);noRecoveryAuthorization(f,input.id);}
});

for(const retirement of ['cancel','source','account','model','close'] as const)test('held ASR facts read retains no late proof or new execution after '+retirement+' and close drains its complete local cleanup',async t=>{
 const responseRelease=deferred(),cleanupRelease=deferred();t.after(()=>{responseRelease.resolve();cleanupRelease.resolve();});const w=await worker(t),f=await fixture(t);await f.models(f.alice.token,w.endpoint,key);const input=await start(f,'held-'+retirement),before=accounting(f,input.id),old=calls(f,input.id)[0];let entered=false,inCleanup=false,cleaned=false,closed=false;
 w.hold(async()=>{entered=true;await responseRelease.promise;});w.setState('failed');const configuration=f.node.configuration!,withModel=configuration.withModel.bind(configuration);
 // Hold the real fixed GET callback's finally, rather than substituting an
 // internal execution path, to prove TaskExecution drains registered localWork.
 configuration.withModel=async(lease,work)=>withModel(lease,async(settings,document)=>{try{return await work(settings,document);}finally{if(lease.feature==='asr'){inCleanup=true;await cleanupRelease.promise;cleaned=true;}}});
 let closing:Promise<void>|undefined;
 try{
  wake(f,input.id);await until(()=>entered,'the actual facts GET did not enter');assert.equal(w.requests.length,1);
  if(retirement==='cancel')await f.checked(f.alice.token,'/api/tasks/'+input.id+'/cancel','POST',{});
  else if(retirement==='source')await f.checked(f.alice.token,'/api/sources/same-source','PATCH',{enabled:false});
  else if(retirement==='account')await f.checked(f.admin.token,'/api/admin/accounts/'+f.a.userId,'PATCH',{disabled:true});
  else if(retirement==='model')await f.models(f.alice.token,w.endpoint,'');
  else closing=f.node.execution!.close().then(()=>{closed=true;});
  responseRelease.resolve();await until(()=>inCleanup,'the abort-controlled GET did not reach complete local cleanup');
  closing??=f.node.execution!.close().then(()=>{closed=true;});await delay(0);assert.equal(closed,false,'execution close must wait for the registered local finally');assert.equal(cleaned,false);assert.deepEqual(accounting(f,input.id),before);assert.deepEqual(calls(f,input.id),[old]);
  cleanupRelease.resolve();await closing;assert.equal(cleaned,true);assert.equal(closed,true);assert.equal(w.requests.length,1);assert.equal(w.reads.length,1);assert.deepEqual(calls(f,input.id),[old]);assert.deepEqual(accounting(f,input.id),before);f.read(db=>{assert.equal(db.prepare('SELECT count(*) n FROM mp_artifacts WHERE user_id=?').get(f.a.userId)!.n,0);assert.equal(db.prepare('SELECT count(*) n FROM mp_publications WHERE user_id=?').get(f.a.userId)!.n,0);assert.equal(db.prepare("SELECT count(*) n FROM task_physical_calls WHERE task_id=? AND state='active'").get(input.id)!.n,0);});noRecoveryAuthorization(f,input.id);
 }finally{responseRelease.resolve();cleanupRelease.resolve();await closing;configuration.withModel=withModel;}
});
