import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {DatabaseSync} from 'node:sqlite';
import {join} from 'node:path';
import sharp from 'sharp';
import {randomUUID} from 'node:crypto';
import {defaultModelSettings} from '../src/model-settings.js';
import {scopedFilesFixture} from './fixtures/scoped-files.js';
import {waitForScopedState} from './fixtures/scoped-process.js';

test('accepted full file retry adopts its exact pending policy atomically without settling the old unknown call',async t=>{
 const calls:string[]=[],server=createServer(async(req,res)=>{
  for await(const _ of req){}calls.push(req.url!);
  if(req.url==='/old'){req.socket.destroy();return;}
  res.setHeader('X-Mote-Execution','local');
  res.end(JSON.stringify({durationMs:0,engine:'generated-pending-retry',segments:[{startMs:0,endMs:0,text:'GENERATED_CURRENT_RETRY'}]}));
 });
 await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
 t.after(()=>{server.closeAllConnections();return new Promise<void>(resolve=>server.close(()=>resolve()));});
 const address=server.address();assert.ok(address&&typeof address!=='string');
 // Keep independently admitted A organizers queued while asserting the entire
 // retry transaction's rows. B's real background work remains executable.
 let heldMemoryOwner:string|undefined;
 const f=await scopedFilesFixture(t,node=>{
  const engine=node.execution!.engine,admissions=(engine as any).admissions,previous=admissions.get('memory.materials');
  engine.configurePool('memory.materials',{...(previous??{lane:()=> 'background',concurrency:{background:()=>4,interactive:()=>4}}),available:step=>heldMemoryOwner!==undefined&&step.ownership?.userId===heldMemoryOwner?false:previous?.available?.(step)});
  t.after(()=>{if(previous)engine.configurePool('memory.materials',previous);else admissions.delete('memory.materials');});
 });heldMemoryOwner=f.a.userId;
 const sql=<T>(work:(db:DatabaseSync)=>T)=>{
  const db=new DatabaseSync(join(f.directory,'mote.sqlite'));try{return work(db);}finally{db.close();}
 };
 const page=await f.checked(f.a.token,'/api/file-processing'),policy=(id:string)=>({version:1,
  services:[{id:'image',name:'Generated pending service',kind:'image',reference:{kind:'personal',id}}],
  profiles:[{id:'image',name:'Generated pending OCR',processorId:'image.http',serviceId:'image',parameters:{},summarize:false},{id:'archive',name:'Generated archive',processorId:'archive',parameters:{},summarize:false}],
  rules:[{type:'image/*',profileId:'image'},{type:'*/*',profileId:'archive'}]});
 await f.checked(f.a.token,'/api/file-processing','PUT',{revision:page.revision,settings:{...page.settings,automatic:true,understandingEnabled:false},policy:policy('old'),models:{profiles:['old','new'].map(id=>({id,name:'Generated '+id,settings:{...defaultModelSettings(),provider:'custom',protocol:'mote-media',baseUrl:'http://127.0.0.1:'+address.port+'/'+id,apiKey:'GENERATED_PENDING_'+id,model:''}})),selections:{}}});
 const perception=await f.checked(f.a.token,'/api/perception');
 await f.checked(f.a.token,'/api/perception','PUT',{revision:perception.revision,settings:{...perception.settings,understandingEnabled:false}});
 const b=await f.upload(f.b.token,'generated-pending-policy','GENERATED_INDEPENDENT_RETRY_B');
 await f.checked(f.b.token,'/api/processing','POST',{originalRef:b.original.ref,operationId:'generated-retry-b-positive'});
 await waitForScopedState(async()=>(await f.checked(f.b.token,'/api/files/'+b.id)).processing.indexed,()=> 'Independent B positive missing',8000);
 const bBefore=await f.checked(f.b.token,'/api/files/'+b.id+'/chunks');
 const png=await sharp({create:{width:2,height:2,channels:3,background:'#567d90'}}).png().toBuffer(),file=await f.uploadBytes(f.a.token,'generated-pending-policy',png,'image/png');
 let detail:any;await waitForScopedState(async()=>{detail=await f.checked(f.a.token,'/api/files/'+file.id);return detail.cancellation.wait==='unknown';},()=>JSON.stringify({detail,calls}),8000);
 const oldPlan=detail.processing.appliedPolicy.id,oldRoot=sql(db=>String(db.prepare('SELECT task_id FROM mp_admissions WHERE user_id=? AND original_id=? ORDER BY rowid DESC LIMIT 1').get(f.a.userId,file.original.ref.slice(9))!.task_id));
 const current=await f.checked(f.a.token,'/api/file-processing');
 await f.checked(f.a.token,'/api/file-processing','PUT',{revision:current.revision,settings:current.settings,policy:policy('new')});
 const pending=()=>sql(db=>db.prepare("SELECT h.*,e.state,e.error,t.json target_json FROM task_processing_config_handoffs h JOIN execution_steps e ON e.id=h.task_id AND e.user_id=h.user_id JOIN mp_configuration_targets t ON t.user_id=h.user_id AND t.original_id=substr(h.original_ref,10) AND t.receipt_id=h.receipt_id WHERE h.user_id=? AND h.original_ref=? AND h.root_id=?").get(f.a.userId,file.original.ref,oldRoot));
 await waitForScopedState(()=>pending()?.state==='blocked'&&pending()?.error==='external_result_unknown',()=>JSON.stringify({pending:pending(),calls}),8000);
 const target=pending()!,desiredPlan=JSON.parse(String(target.target_json)).facts.policyPlanId;
 assert.equal(target.replacement_id,null);assert.notEqual(desiredPlan,oldPlan);
 assert.deepEqual(calls,['/old']);
 const tables=['mp_file_policy_bindings','mp_file_plans','mp_file_controls','mp_file_retries','mp_admissions','mp_configuration_targets','task_processing_config_handoffs','task_processing_config_retirements','task_authorizations','user_tasks','execution_steps','task_external_retry_confirmations','task_external_calls'] as const;
 const snapshot=()=>sql(db=>Object.fromEntries(tables.map(table=>[table,table==='task_processing_config_retirements'?db.prepare('SELECT r.* FROM task_processing_config_retirements r JOIN task_processing_config_handoffs h ON h.task_id=r.handoff_id WHERE h.user_id=? ORDER BY r.rowid').all(f.a.userId):db.prepare('SELECT * FROM '+table+' WHERE user_id=? ORDER BY rowid').all(f.a.userId)])));
 const originalUnknown=sql(db=>db.prepare('SELECT * FROM task_external_calls WHERE user_id=? ORDER BY issuance_id').all(f.a.userId));
 assert.equal(originalUnknown.length,1);assert.ok(['issued','unknown'].includes(String(originalUnknown[0].state)));assert.equal(originalUnknown[0].settled_at,null);
 const organizers=sql(db=>db.prepare("SELECT * FROM execution_steps WHERE user_id=? AND kind='memory.materials' ORDER BY rowid").all(f.a.userId));
 assert.ok(organizers.length>0,'the real intake still admits its independent Memory organizer');
 for(const organizer of organizers){assert.equal(organizer.state,'waiting');assert.equal(organizer.attempts,0);}
 const before=snapshot();
 assert.equal((await f.request(f.a.token,'/api/files/'+file.id+'/retry','POST',{operationId:randomUUID(),stage:'transcribe'})).statusCode,409);
 assert.deepEqual(snapshot(),before);
 const operationId=randomUUID(),request={operationId,stage:'transcribe',confirmUnknown:true};let commitBoundaries=0;
 f.host.execution!.engine.store.db.function('generated_retry_commit_boundary',()=>{commitBoundaries++;return 0;});
 sql(db=>db.exec("CREATE TRIGGER generated_retry_commit_failure BEFORE INSERT ON mp_file_retries WHEN NEW.user_id='"+f.a.userId+"' BEGIN SELECT generated_retry_commit_boundary(); SELECT RAISE(ABORT,'GENERATED_RETRY_COMMIT_FAILURE'); END"));
 try{
  const failed=await f.request(f.a.token,'/api/files/'+file.id+'/retry','POST',request);assert.equal(failed.statusCode,503,failed.body);assert.deepEqual(failed.json(),{error:'scope_unavailable'});assert.equal(commitBoundaries,1,'the injected late retry receipt failure must be reached');
  assert.deepEqual(snapshot(),before,'failed retry receipt must roll back plan binding, confirmations, cancellations and owner admission');
  assert.deepEqual(calls,['/old']);assert.deepEqual(await f.checked(f.b.token,'/api/files/'+b.id+'/chunks'),bBefore);
 }finally{sql(db=>db.exec('DROP TRIGGER generated_retry_commit_failure'));}
 const accepted=await f.checked(f.a.token,'/api/files/'+file.id+'/retry','POST',request);
 await waitForScopedState(()=>f.host.execution!.engine.get(accepted.taskId)?.state==='succeeded',()=>JSON.stringify({detail,pending:pending(),calls,task:f.host.execution!.engine.get(accepted.taskId)}),8000);
 detail=await f.checked(f.a.token,'/api/files/'+file.id);
 assert.equal(detail.processing.indexed,true);assert.equal(detail.processing.appliedPolicy.id,desiredPlan);
 assert.equal((await f.checked(f.a.token,'/api/files/'+file.id+'/chunks')).items[0].ocrText,'GENERATED_CURRENT_RETRY');
 const manual=f.host.execution!.engine.get(accepted.taskId)!;assert.equal(manual.input.policyPlanId,desiredPlan);assert.equal(manual.input.configurationIntentId,undefined);assert.equal(manual.ownership!.userId,f.a.userId);
 assert.equal(pending()!.replacement_id,null);assert.equal(pending()!.state,'cancelled');
 assert.deepEqual(sql(db=>db.prepare('SELECT * FROM task_external_calls WHERE issuance_id=?').all(originalUnknown[0].issuance_id)),originalUnknown,'explicit retry consent cannot invent settlement of the old unknown call');
 assert.equal(sql(db=>db.prepare('SELECT count(*) n FROM mp_file_retries WHERE user_id=? AND original_id=?').get(f.a.userId,file.original.ref.slice(9))!.n),1);
 assert.equal(sql(db=>db.prepare('SELECT task_id FROM mp_admissions WHERE user_id=? AND original_id=? ORDER BY rowid DESC LIMIT 1').get(f.a.userId,file.original.ref.slice(9))!.task_id),accepted.taskId);
 const grants=sql(db=>db.prepare('SELECT * FROM task_authorizations WHERE user_id=? ORDER BY task_id').all(f.a.userId));
 assert.deepEqual(await f.checked(f.a.token,'/api/files/'+file.id+'/retry','POST',request),accepted);
 assert.deepEqual(sql(db=>db.prepare('SELECT * FROM task_authorizations WHERE user_id=? ORDER BY task_id').all(f.a.userId)),grants);
 assert.deepEqual(calls,['/old','/new']);assert.deepEqual(await f.checked(f.b.token,'/api/files/'+b.id+'/chunks'),bBefore);
});
