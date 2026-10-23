import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import type {ExecutionPoolAdmission} from '../src/execution-engine.js';
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

/** Diagnostic-only view of the shared provider and genuine owned work. It
 * neither attributes an HTTP send to an ambiguous task nor changes its lifecycle. */
function replayObservation(f:Fixture,phase:string){
 const owners=[f.a.userId,f.b.userId],hash=(value:unknown)=>createHash('sha256').update(String(value)).digest('hex'),requests=f.requests.map((request,index)=>{const envelope=JSON.parse(typeof request.body.messages[0].content==='string'?request.body.messages[0].content:request.body.messages[0].content[0].text);return {seq:index+1,owner:request.owner,responseMode:envelope.responseMode??null,requiredSkill:envelope.requiredSkill??null,memoryWork:Boolean(envelope.untrustedTaskContext?.memoryWork),memoryEvaluation:Boolean(envelope.untrustedTaskContext?.memoryEvaluation)};});
 return f.read(db=>({phase,observedAt:Date.now(),requestCount:f.requests.length,requests,
  tasks:db.prepare("SELECT e.id,e.user_id,e.kind,e.operation_id,e.state,e.attempts,e.error,u.external_state,json_extract(u.input,'$.jobId') job_id,json_extract(u.input,'$.batchId') batch_id,json_extract(u.input,'$.phase') phase,json_extract(u.input,'$.captureId') capture_id FROM execution_steps e LEFT JOIN user_tasks u ON u.task_id=e.id AND u.user_id=e.user_id WHERE e.user_id IN (?,?) ORDER BY e.user_id,e.user_position,e.id").all(...owners),
  physical:db.prepare('SELECT p.id,p.task_id,p.user_id,p.snapshot_id,p.attempt_id,p.mode,p.state,p.issuance_id,p.created_at,p.quiescent_at,e.kind,e.state task_state,e.operation_id FROM task_physical_calls p LEFT JOIN execution_steps e ON e.id=p.task_id AND e.user_id=p.user_id WHERE p.user_id IN (?,?) ORDER BY p.created_at,p.id').all(...owners),
  externalCalls:db.prepare('SELECT c.issuance_id,c.task_id,c.user_id,c.state,c.attempt,c.issued_at,c.settled_at,e.kind FROM task_external_calls c LEFT JOIN execution_steps e ON e.id=c.task_id AND e.user_id=c.user_id WHERE c.user_id IN (?,?) ORDER BY c.issued_at,c.issuance_id').all(...owners),
  usageTaskCandidates:db.prepare("SELECT m.id,m.user_id,json_extract(m.json,'$.status') status,json_extract(m.json,'$.attribution.operationId') operation_id,json_extract(m.json,'$.attribution.jobId') job_id,json_extract(m.json,'$.attribution.agentId') agent_id,json_extract(m.json,'$.attribution.moduleId') module_id,json_extract(m.json,'$.attribution.skillId') skill_id,json_extract(m.json,'$.issuance.leaseId') lease_id,json_extract(m.json,'$.tokens.requests') requests,json_extract(m.json,'$.tokens.reportedRequests') reported_requests,json_extract(m.json,'$.issuance.issuedAt') issued_at,e.id task_id,e.kind,e.state task_state FROM user_model_usage m LEFT JOIN execution_steps e ON e.user_id=m.user_id AND e.operation_id=json_extract(m.json,'$.attribution.operationId') WHERE m.user_id IN (?,?) ORDER BY m.id,e.id").all(...owners),
  actions:db.prepare('SELECT j.user_id,j.id,j.task_id,j.state,j.input,j.proof,e.kind,e.state task_state,e.attempts FROM ac_jobs j LEFT JOIN execution_steps e ON e.id=j.task_id AND e.user_id=j.user_id WHERE j.user_id IN (?,?) ORDER BY j.user_id,j.id').all(...owners).map(({input,proof,...row})=>({...row,inputHash:hash(input),proofHash:hash(proof)})),
  semantic:db.prepare('SELECT p.user_id,p.id,p.revision,p.task_id,p.consumed,p.json IS NOT NULL product_retained,e.state task_state,e.attempts FROM ac_semantic_products p LEFT JOIN execution_steps e ON e.id=p.task_id AND e.user_id=p.user_id WHERE p.user_id IN (?,?) ORDER BY p.user_id,p.id,p.revision').all(...owners),
  memory:db.prepare('SELECT j.user_id,j.id,j.state,j.tasks,b.id batch_id,b.state batch_state FROM mm_jobs j LEFT JOIN mm_job_batches b ON b.user_id=j.user_id AND b.job_id=j.id WHERE j.user_id IN (?,?) ORDER BY j.user_id,j.id,b.id').all(...owners),
  intakes:db.prepare("SELECT user_id,id,material_id,revision,task_id,job_id,state,revoked,json_extract(json,'$.targetCaptureId') capture_id FROM mm_intakes WHERE user_id IN (?,?) ORDER BY user_id,id").all(...owners),
  positions:db.prepare("SELECT s.user_id,s.captures,s.materials,a.policy_task,a.generation,json_extract(a.settings,'$.enabled') enabled,json_extract(a.settings,'$.timeZone') time_zone FROM ac_discovery_state s JOIN ac_state a ON a.user_id=s.user_id WHERE s.user_id IN (?,?) ORDER BY s.user_id").all(...owners),
 }));
}

type ReplayOriginal={userId:string;captureId:string};
const replayHash=(value:unknown)=>createHash('sha256').update(String(value)).digest('hex');
/** Queue only these real Memory batches; ordinary publication, admission and
 * Actions use their original pools, grants, model snapshots and callbacks. */
function holdReplayMemory(f:Fixture){
 const engine=f.node.execution!.engine,pool='memory.models',owners=new Set([f.a.userId,f.b.userId]),admissions=(engine as unknown as {admissions:Map<string,ExecutionPoolAdmission>}).admissions,previous=admissions.get(pool);assert.ok(previous,'the production Memory model admission is installed');let released=false;
 const held:ExecutionPoolAdmission={...previous,available:step=>step.kind==='memory.batch'&&owners.has(step.ownership?.userId??'')?false:previous.available?.(step)??true};engine.configurePool(pool,held);
 return ()=>{if(released)return;const current=admissions.get(pool);engine.configurePool(pool,previous);released=true;engine.wake();assert.equal(current,held,'restore the exact controlled admission object');};
}
/** Safe identity and measured execution facts; no model settings or evidence
 * bodies leave the actual account store in this diagnostic snapshot. */
function replayMemory(f:Fixture){
 return f.read(db=>db.prepare("SELECT e.id,e.user_id,e.operation_id,e.input engine_input,e.authorization_epoch,e.grant_id,e.state,e.attempts,e.error,u.input,u.grant_id user_grant_id,u.model_receipt,u.external_state,a.task_id authorized_task,a.user_id authorized_user,a.authorization_epoch authorized_epoch,a.revoked FROM execution_steps e JOIN user_tasks u ON u.user_id=e.user_id AND u.task_id=e.id JOIN task_authorizations a ON a.user_id=u.user_id AND a.grant_id=u.grant_id WHERE e.user_id IN (?,?) AND e.kind='memory.batch' ORDER BY e.user_id,e.id").all(f.a.userId,f.b.userId).map(row=>{
  const input=JSON.parse(String(row.input)),model=row.model_receipt?JSON.parse(String(row.model_receipt)):null,snapshot=(id:string)=>{const value=db.prepare('SELECT user_id,id,version,ciphertext,nonce,tag FROM user_model_snapshots WHERE user_id=? AND id=?').get(row.user_id,id);return value?{userId:value.user_id,id:value.id,version:value.version,ciphertextHash:replayHash(Buffer.from(value.ciphertext as Uint8Array).toString('hex')),nonceHash:replayHash(Buffer.from(value.nonce as Uint8Array).toString('hex')),tagHash:replayHash(Buffer.from(value.tag as Uint8Array).toString('hex'))}:null;};
  return {pin:{id:String(row.id),userId:String(row.user_id),operationId:String(row.operation_id),epoch:Number(row.authorization_epoch),grantHash:replayHash(row.grant_id),userGrantHash:replayHash(row.user_grant_id),inputHash:replayHash(row.input),engineInputHash:replayHash(row.engine_input),authorizedTask:row.authorized_task,authorizedUser:row.authorized_user,authorizedEpoch:row.authorized_epoch,revoked:row.revoked,jobId:String(input.jobId),batchId:String(input.batchId),targetIds:input.inputs.map((pin:{id:string})=>pin.id).sort(),jobModel:input.model,jobSnapshot:snapshot(input.model.snapshotId)},state:String(row.state),attempts:Number(row.attempts),error:row.error,externalState:row.external_state,model,modelHash:replayHash(row.model_receipt),taskSnapshot:model?snapshot(model.snapshotId):null,
   intakes:db.prepare('SELECT id,json,job_id,state,revoked FROM mm_intakes WHERE user_id=? AND job_id=? ORDER BY id').all(row.user_id,input.jobId).map(receipt=>{const value=JSON.parse(String(receipt.json));return {id:String(receipt.id),jobId:String(receipt.job_id),state:receipt.state,revoked:receipt.revoked,captureId:String(value.targetCaptureId),targetIds:value.targetIds,receiptHash:replayHash(receipt.json)};}),
   physical:db.prepare('SELECT id,user_id,task_id,snapshot_id,attempt_id,mode,state,issuance_id,quiescent_at FROM task_physical_calls WHERE user_id=? AND task_id=? ORDER BY id').all(row.user_id,row.id),
   calls:db.prepare('SELECT issuance_id,user_id,task_id,state,attempt,issued_at,settled_at FROM task_external_calls WHERE user_id=? AND task_id=? ORDER BY issuance_id').all(row.user_id,row.id),
   usage:db.prepare("SELECT id,json FROM user_model_usage WHERE user_id=? AND json_extract(json,'$.attribution.operationId')=? ORDER BY id").all(row.user_id,row.operation_id).map(receipt=>{const value=JSON.parse(String(receipt.json));return {id:receipt.id,status:value.status,attribution:value.attribution,issuance:value.issuance,requests:Number(value.tokens?.requests??0),reportedRequests:Number(value.tokens?.reportedRequests??0)};}),
   modelAttempts:db.prepare('SELECT attempt_id,receipt,parent_snapshot_id FROM task_model_attempts WHERE task_id=? ORDER BY attempt_id').all(row.id).map(attempt=>({attemptId:attempt.attempt_id,parentSnapshotId:attempt.parent_snapshot_id,model:JSON.parse(String(attempt.receipt))})),
  };
 }));
}
function assertQueuedReplayMemory(f:Fixture,originals:readonly ReplayOriginal[]){
 const rows=replayMemory(f);assert.equal(rows.length,originals.length,'every exact original has a real admitted Memory batch');
 const actual=rows.flatMap(row=>row.intakes.map(intake=>({userId:row.pin.userId,captureId:intake.captureId}))).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b))),expected=[...originals].sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)));assert.deepEqual(actual,expected);
 for(const row of rows){assert.equal(row.state,'waiting');assert.equal(row.attempts,0);assert.equal(row.externalState,'none');assert.equal(row.pin.revoked,0);assert.equal(row.pin.authorizedTask,row.pin.id);assert.equal(row.pin.authorizedUser,row.pin.userId);assert.equal(row.pin.authorizedEpoch,row.pin.epoch);assert.equal(row.pin.engineInputHash,row.pin.inputHash);assert.equal(row.pin.grantHash,row.pin.userGrantHash);assert.ok(row.pin.jobSnapshot);assert.equal(row.pin.jobSnapshot.userId,row.pin.userId);assert.equal(row.pin.jobModel.operationId,'memory-job:'+row.pin.jobId);
  assert.ok(row.model);assert.equal(row.model.userId,row.pin.userId);assert.equal(row.model.operationId,row.pin.operationId);assert.equal(row.model.feature,'memory');assert.equal(row.model.id,row.model.snapshotId);assert.notEqual(row.model.snapshotId,row.pin.jobModel.snapshotId,'task lease is a genuine fork of the job model connection');assert.ok(row.taskSnapshot);assert.equal(row.taskSnapshot.userId,row.pin.userId);assert.equal(row.taskSnapshot.id,row.model.snapshotId);
  assert.ok(row.intakes.length>0);for(const intake of row.intakes){assert.equal(intake.state,'complete');assert.equal(intake.revoked,0);assert.equal(intake.jobId,row.pin.jobId);assert.ok(intake.targetIds.length>0);assert.ok(intake.targetIds.every((id:string)=>row.pin.targetIds.includes(id)));}assert.equal(row.physical.length,0);assert.equal(row.calls.length,0);assert.equal(row.usage.length,0);assert.equal(row.modelAttempts.length,0);
 }
 return rows.map(row=>({pin:row.pin,modelHash:row.modelHash,taskSnapshot:row.taskSnapshot,intakes:row.intakes}));
}
async function queuedReplayMemory(f:Fixture,originals:readonly ReplayOriginal[]){
 await waitForState(async()=>replayMemory(f),rows=>rows.length===originals.length&&rows.flatMap(row=>row.intakes).length===originals.length&&rows.every(row=>row.intakes.every(intake=>intake.state==='complete')),'exact originals have admitted queued Memory batches');
 return assertQueuedReplayMemory(f,originals);
}

test('production enable, timezone and restart preserve successful units and per-user discovery positions',async t=>{
 const f=await modelFixture(t),originals:ReplayOriginal[]=[],releases:Array<()=>void>=[];let releaseMemory=holdReplayMemory(f);releases.push(releaseMemory);t.after(()=>{for(const release of releases)release();});
 for(const [user,label] of [[f.a,'A'],[f.b,'B']] as const){const receipt=await f.ingest(user,label);assert.equal(receipt.captures.length,1);originals.push({userId:user.userId,captureId:receipt.captures[0].id});await f.enable(user);await f.proposal(user);await watchSettled(f,user);}
 await waitForState(async()=>successful(f,f.a),rows=>rows.length>0,'A completed original analysis');
 await waitForState(async()=>successful(f,f.b),rows=>rows.length>0,'B completed original analysis');
 const initialMemory=await queuedReplayMemory(f,originals);
 const before=successful(f,f.a),beforeB=successful(f,f.b),aPage=await f.ok(f.a.token,'/api/actions'),bPage=await f.ok(f.b.token,'/api/actions'),aPosition=position(f,f.a),bPosition=position(f,f.b),calls=f.requests.length;
 t.diagnostic(JSON.stringify({...replayObservation(f,'baseline'),capturedCalls:calls,queuedMemory:initialMemory}));
 assert.ok(Number(aPosition?.captures)>0&&Number(aPosition?.materials)>0);
 await settings(f,f.a,false);await settings(f,f.a,true);await watchSettled(f,f.a);t.diagnostic(JSON.stringify(replayObservation(f,'after-disable-reenable')));
 assert.equal(f.requests.length,calls);assert.deepEqual(successful(f,f.a),before);assert.deepEqual(position(f,f.a),aPosition);
 await settings(f,f.a,true,'Asia/Shanghai');await watchSettled(f,f.a);t.diagnostic(JSON.stringify(replayObservation(f,'after-timezone')));
 assert.equal(f.requests.length,calls);assert.deepEqual(successful(f,f.a),before);assert.deepEqual((await f.ok(f.a.token,'/api/actions')).items,aPage.items);
 assert.deepEqual(successful(f,f.b),beforeB);assert.deepEqual(position(f,f.b),bPosition);assert.deepEqual(await f.ok(f.b.token,'/api/actions'),bPage);
 assert.deepEqual(assertQueuedReplayMemory(f,originals),initialMemory);
 t.diagnostic(JSON.stringify(replayObservation(f,'before-restart')));
 const releaseOldMemory=releaseMemory;await f.restart();releaseMemory=holdReplayMemory(f);releases.push(releaseMemory);releaseOldMemory();assert.deepEqual(assertQueuedReplayMemory(f,originals),initialMemory);t.diagnostic(JSON.stringify(replayObservation(f,'after-restart-before-wake')));await wake(f,f.a);t.diagnostic(JSON.stringify(replayObservation(f,'after-restart-wake')));
 assert.equal(f.requests.length,calls);assert.deepEqual(successful(f,f.a),before);assert.deepEqual(position(f,f.a),aPosition);
 await settings(f,f.a,false,'Asia/Shanghai');const receipt=await f.ingest(f.a,'A','new-while-disabled','other-source');assert.equal(receipt.captures.length,1);originals.push({userId:f.a.userId,captureId:receipt.captures[0].id});const allMemory=await queuedReplayMemory(f,originals);assert.deepEqual(allMemory.filter(row=>initialMemory.some(before=>before.pin.id===row.pin.id)),initialMemory);t.diagnostic(JSON.stringify(replayObservation(f,'after-disabled-new-ingest')));
 assert.equal(f.requests.length,calls);await settings(f,f.a,true,'Asia/Shanghai');await watchSettled(f,f.a);
 await waitForState(()=>f.ok(f.a.token,'/api/actions'),page=>page.items.length===2,'new input after re-enable is analyzed');
 assert.ok(f.requests.length>calls);for(const row of before)assert.deepEqual(successful(f,f.a).find(value=>value.id===row.id),row);
 assert.deepEqual(successful(f,f.b),beforeB);assert.deepEqual(await f.ok(f.b.token,'/api/actions'),bPage);
 t.diagnostic(JSON.stringify(replayObservation(f,'after-current-new-input-analysis')));
 for(const request of f.requests)assert.ok(!request.raw.includes(request.owner==='A'?'GENERATED_B_PRIVATE':'GENERATED_A_PRIVATE'));
 const pendingMemory=assertQueuedReplayMemory(f,originals),beforeRelease=replayObservation(f,'before-memory-release'),beforeReleaseA=successful(f,f.a),beforeReleaseB=successful(f,f.b),releaseCount=f.requests.length;
 t.diagnostic(JSON.stringify({...beforeRelease,queuedMemory:pendingMemory}));releaseMemory();
 const released=await waitForState(async()=>replayMemory(f),rows=>rows.length===3&&rows.every(row=>row.state==='failed'&&row.error==='agent_host_validation'&&row.attempts>0&&row.calls.length>0&&row.calls.every(call=>call.state==='succeeded'&&Number(call.settled_at)>0)&&row.physical.length>0&&row.physical.every(call=>call.state==='quiescent'&&Number(call.quiescent_at)>0)&&row.usage.length>0&&row.usage.every(usage=>usage.status==='failed'&&usage.requests>0&&usage.reportedRequests>0)),'same three admitted Memory batches really execute and settle with the unchanged Actions-only responder');
 assert.deepEqual(released.map(row=>row.pin),pendingMemory.map(row=>row.pin));
 for(const row of released){assert.equal(row.pin.revoked,0);const queued=pendingMemory.find(value=>value.pin.id===row.pin.id)!;assert.ok(row.modelAttempts.length>0);for(const attempt of row.modelAttempts){assert.equal(attempt.parentSnapshotId,queued.taskSnapshot!.id);assert.equal(attempt.model.userId,row.pin.userId);assert.equal(attempt.model.operationId,row.pin.operationId);assert.equal(attempt.model.feature,'memory');}
  for(const usage of row.usage){assert.equal(usage.attribution.operationId,row.pin.operationId);assert.equal(usage.attribution.jobId,row.pin.jobId);assert.equal(usage.attribution.agentId,'memory.extract');assert.equal(usage.attribution.moduleId,'memories');assert.ok(usage.issuance.issuedAt);assert.equal(usage.issuance.state,'settled');assert.ok(row.modelAttempts.some(attempt=>attempt.model.snapshotId===usage.issuance.leaseId));assert.ok(row.physical.some(call=>call.user_id===row.pin.userId&&call.task_id===row.pin.id&&call.snapshot_id===usage.issuance.leaseId&&call.issuance_id!==null&&row.calls.some(issuance=>issuance.issuance_id===call.issuance_id)));}
  for(const call of row.calls){assert.equal(call.user_id,row.pin.userId);assert.equal(call.task_id,row.pin.id);assert.ok(row.physical.some(physical=>physical.issuance_id===call.issuance_id&&physical.user_id===row.pin.userId&&physical.task_id===row.pin.id&&physical.mode==='read-query'&&row.modelAttempts.some(attempt=>attempt.attemptId===physical.attempt_id&&attempt.model.snapshotId===physical.snapshot_id)));}
 }
 const afterRelease=replayObservation(f,'after-memory-release'),releasedRequests=f.requests.slice(releaseCount),accountedRequests=released.flatMap(row=>row.usage).reduce((sum,usage)=>sum+usage.requests,0);assert.ok(releasedRequests.length>0);assert.equal(f.requests.length-releaseCount,accountedRequests,'all provider growth is accounted by these exact real batches');assert.deepEqual([...new Set(releasedRequests.map(request=>request.owner))].sort(),['A','B']);
 for(const request of releasedRequests){const envelope=JSON.parse(typeof request.body.messages[0].content==='string'?request.body.messages[0].content:request.body.messages[0].content[0].text);assert.equal(envelope.responseMode,'memory-extraction');}
 for(const [user,label] of [[f.a,'A'],[f.b,'B']] as const)assert.equal(releasedRequests.filter(request=>request.owner===label).length,released.filter(row=>row.pin.userId===user.userId).flatMap(row=>row.usage).reduce((sum,usage)=>sum+usage.requests,0));
 assert.deepEqual(afterRelease.usageTaskCandidates.filter(row=>String(row.kind).startsWith('actions.')),beforeRelease.usageTaskCandidates.filter(row=>String(row.kind).startsWith('actions.')));assert.deepEqual(successful(f,f.a),beforeReleaseA);assert.deepEqual(successful(f,f.b),beforeReleaseB);assert.deepEqual(await f.ok(f.b.token,'/api/actions'),bPage);t.diagnostic(JSON.stringify({...afterRelease,releasedMemory:released}));
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
