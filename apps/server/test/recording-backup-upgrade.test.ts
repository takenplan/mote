import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {mkdirSync,writeFileSync} from 'node:fs';
import {dirname,join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {scopedCaptureFixture} from './fixtures/scoped-capture-host.js';
import {waitForScopedState} from './fixtures/scoped-process.js';
import {defaultModelSettings} from '../src/model-settings.js';
import {defaultProcessingSettings} from '../src/scope/processing-schema.js';
import type {ProcessingHost} from '../src/scope/processing.js';
import type {IngressHost} from '../src/scope/ingress.js';
import {ConnectorVault,connectorHash} from '../src/scope/connector-vault.js';
import {RECORDING_AUTOMATIC_RETIRED} from '../src/scope/processing-origins.js';

test('startup repairs exact host backups before execution; provenance, owner retry and unknown journals survive restart',async t=>{
 const wave=Buffer.alloc(48);wave.write('RIFF');wave.writeUInt32LE(40,4);wave.write('WAVEfmt ',8);wave.writeUInt32LE(16,16);wave.writeUInt16LE(1,20);wave.writeUInt16LE(1,22);wave.writeUInt32LE(8000,24);wave.writeUInt32LE(16000,28);wave.writeUInt16LE(2,32);wave.writeUInt16LE(16,34);wave.write('data',36);wave.writeUInt32LE(4,40);
 const calls:string[]=[];
 const worker=createServer(async(req,res)=>{const bytes:Buffer[]=[];for await(const part of req)bytes.push(Buffer.from(part));assert.deepEqual(Buffer.concat(bytes),wave);calls.push(String(req.headers.authorization));res.setHeader('Content-Type','application/json');res.setHeader('X-Mote-Execution','local');res.end(JSON.stringify({durationMs:1,segments:[{startMs:0,endMs:1,text:'GENERATED_UPGRADE_ASR'}],coverage:'full',engine:'generated-upgrade'}));});
 await new Promise<void>(resolve=>worker.listen(0,'127.0.0.1',resolve));t.after(()=>new Promise<void>(resolve=>worker.close(()=>resolve())));const address=worker.address();assert.ok(address&&typeof address!=='string');
 const f=await scopedCaptureFixture(t,{connectorTransports:{dingtalk:scope=>async command=>{
  switch(command.kind){case 'status':return {authenticated:true,corp_id:'generated-corp',user_id:'generated-user'};case 'search':return {minutes:['pending','post','uncertain','legacy','owner','spoof'].map(taskUuid=>({taskUuid})),complete:true};case 'metadata':return {basic:{taskUuid:command.id,title:'Generated '+command.id,startTime:1792108800000,duration:1}};case 'transcript':return {taskUuid:command.id,complete:true,paragraphList:[]};case 'media':{const path=join(scope.directory,'dws-runtime',command.output);mkdirSync(dirname(path),{recursive:true});writeFileSync(path,wave);return {ok:true,succeeded:1,results:[{taskUuid:command.id}]};}default:throw Error('Unexpected generated command '+command.kind);}
 }}});
 const checked=async(token:string,path:string,method='GET',payload?:unknown)=>{const r=await f.request(token,path,method,payload);assert.equal(r.statusCode,200,r.body);return r.json();};
 const configure=async(token:string,domain:string,value:unknown)=>checked(token,'/api/configuration/'+domain,'PUT',{revision:(await checked(token,'/api/configuration')).revision,value});
 await checked(f.admin.token,'/api/admin/connectors/dingtalk-recordings/install','POST',{expectedRevision:f.host.plugins!.catalog.revision(),operationId:randomUUID()});
 const run=async(operation:string,payload?:unknown)=>{const task=await checked(f.a.token,'/api/connectors/recordings/operations','POST',{operationId:randomUUID(),operation,...(payload?{payload}:{})});await waitForScopedState(async()=>(await checked(f.a.token,'/api/tasks/'+task.id)).state==='succeeded',()=>'Generated connector setup failed');};
 await checked(f.a.token,'/api/connectors/recordings','PUT',{expectedRevision:(await checked(f.a.token,'/api/connectors')).revision,connection:{provider:'dingtalk-recordings',autoSync:false}});
 await checked(f.a.token,'/api/connectors/recordings/enable','POST',{expectedRevision:(await checked(f.a.token,'/api/plugins')).revision});await run('connect');await run('select',{enabled:true,start:'2026-10-16T00:00:00Z',end:'2026-10-17T00:00:00Z',autoSync:false,backupAudio:true});
 const sync=await checked(f.a.token,'/api/connectors/recordings/sync','POST',{operationId:randomUUID()});await waitForScopedState(async()=>(await checked(f.a.token,'/api/tasks/'+sync.id)).state==='succeeded',()=>'Generated backups not saved');
 for(const actor of [f.a,f.b]){await configure(actor.token,'models',{profiles:[{id:'asr',name:'Generated ASR',settings:{...defaultModelSettings(),provider:'custom',protocol:'mote-media',baseUrl:'http://127.0.0.1:'+address.port+'/transcribe',model:'generated-asr',apiKey:'GENERATED_'+actor.userId}}],selections:{asr:{kind:'personal',id:'asr'}}});await configure(actor.token,'processing',{...defaultProcessingSettings(),automatic:true,understandingEnabled:false,summarize:false,semanticTurns:false,audioProcessor:'audio.http'});await checked(actor.token,'/api/sources/same-source','PATCH',{retention:'archive'});}
 const backups=f.read(db=>db.prepare("SELECT o.id,o.capture_id,o.source_id,c.external_id FROM ig_originals o JOIN pd_captures c ON c.user_id=o.user_id AND c.id=o.capture_id WHERE o.user_id=? AND o.mime='audio/wav'").all(f.a.userId));
 const backup=(id:string)=>{const row=backups.find(row=>row.external_id===id+':audio');assert.ok(row);return row;};
 assert.equal(calls.length,0);
 // buildApp registers handlers but deliberately does not start M05 until ready.
 // All old-state facts below are generated; the test then uses the real startup.
 await f.restart();
 const context=await f.host.authority.authenticate(f.a.token),scope=f.host.services.forUser(context),processing=scope.get<ReturnType<ProcessingHost['forUser']>>('processing'),execution=f.host.execution!;
 const submit=async(name:string,operationId='generated-old-'+name)=>{const original=backup(name),root=await processing.submit({originalRef:'original:'+original.id,operationId}),input=execution.engine.get(root.id)!.input,child=await execution.forUser(context).submit({kind:'processing.asr',operationId:'processing:'+root.id,input:{...input,parentTaskId:root.id}});f.read(db=>db.prepare('UPDATE user_tasks SET checkpoints=? WHERE task_id=?').run(JSON.stringify({extraction:{taskId:child.id}}),root.id));return {root,child,original};};
 const pending=await submit('pending'),post=await submit('post'),uncertain=await submit('uncertain'),owner=await submit('owner');
 const legacyReceipt=f.read(db=>db.prepare('SELECT receipt FROM ig_batches WHERE user_id=? AND source_id=?').all(f.a.userId,backup('legacy').source_id).map(row=>JSON.parse(String(row.receipt))).find(receipt=>receipt.captures.some((item:any)=>item.original?.ref==='original:'+backup('legacy').id)));
 assert.ok(legacyReceipt);const legacyKey='intake:'+legacyReceipt.id+':original:'+backup('legacy').id,legacy=await submit('legacy',legacyKey);
 // Generate a stale host head pointing at another capture. A matching source,
 // external id and successful media checkpoint cannot repair this original.
 const spoof=backup('spoof'),head=f.read(db=>db.prepare('SELECT s.local_id,k.instance_id FROM connector_sources s JOIN connector_secrets k ON k.user_id=s.user_id WHERE s.user_id=? AND s.source_id=? LIMIT 1').get(f.a.userId,spoof.source_id)!);
 f.read(db=>new ConnectorVault(db,f.directory,f.host.deploymentId,f.a.userId,String(head.instance_id),()=>{}).write('head:'+connectorHash([head.local_id,'spoof:audio']),{captureId:'generated-unrelated-capture',item:{}}));
 const bContext=await f.host.authority.authenticate(f.b.token),bIngress=f.host.services.forUser(bContext).get<ReturnType<IngressHost['forUser']>>('ingress'),ordinary=bIngress.receiveSourceItemsWithOriginals('same-source','generated-ordinary',[{externalId:'ordinary',revision:'r1',observedAt:'2026-10-16T00:00:00Z',title:'Generated ordinary audio',text:'',kind:'file',layer:'original',mimeType:'audio/wav',document:{originalMetadata:{role:'original-audio'}}}],[{bytes:wave,mime:'audio/wav'}]).captures[0].original!;
 const issuance=randomUUID(),activity=randomUUID();
 f.read(db=>{
  db.prepare("UPDATE mp_original_formats SET format='file' WHERE user_id=?").run(f.a.userId);
  for(const item of [pending,post,uncertain])db.prepare("UPDATE mp_admission_origins SET origin='automatic' WHERE user_id=? AND task_id=?").run(f.a.userId,item.root.id);
  db.prepare('DELETE FROM mp_admission_origins WHERE user_id=? AND task_id IN(?,?)').run(f.a.userId,legacy.root.id,legacy.child.id);
  db.prepare("UPDATE execution_steps SET state='blocked',error='processor_unavailable' WHERE id=?").run(pending.child.id);
  db.prepare("UPDATE user_tasks SET external_state='unknown',external_key=?,external_issuance=? WHERE task_id=?").run('processing:'+uncertain.child.id+':'+activity,issuance,uncertain.child.id);
  db.prepare("INSERT INTO task_external_calls(issuance_id,task_id,user_id,request_key,state,authorization_epoch,attempt,issued_at) VALUES(?,?,?,?,'unknown',?,1,?)").run(issuance,uncertain.child.id,f.a.userId,'processing:'+uncertain.child.id+':'+activity,context.authorizationEpoch,Date.now());
  db.prepare("INSERT INTO mp_activity VALUES(?,?,'unknown')").run(f.a.userId,activity);
  db.prepare("UPDATE execution_steps SET state='blocked',error='external_result_unknown' WHERE id=?").run(uncertain.child.id);
 });
 assert.equal(calls.length,0,'No worker executes during fixture construction before app ready');
 await f.host.app.ready();
 assert.equal(f.read(db=>db.prepare('SELECT format FROM mp_original_formats WHERE user_id=? AND original_id=?').get(f.a.userId,pending.original.id)!.format),'recording-audio-backup','repair runs before the executor starts');
 for(const item of [pending,post,uncertain])for(const task of [item.root,item.child]){const state=await checked(f.a.token,'/api/tasks/'+task.id);assert.equal(state.state,'cancelled');assert.equal(f.read(db=>db.prepare('SELECT error FROM execution_steps WHERE id=?').get(task.id)!.error),RECORDING_AUTOMATIC_RETIRED);}
 assert.equal(f.read(db=>db.prepare('SELECT origin FROM mp_admission_origins WHERE user_id=? AND task_id=?').get(f.a.userId,legacy.root.id)!.origin),'unknown','owner-selectable intake key cannot manufacture historical automatic intent');
 assert.equal(f.read(db=>db.prepare('SELECT format FROM mp_original_formats WHERE user_id=? AND original_id=?').get(f.a.userId,spoof.id)!.format),'file');
 assert.equal(f.read(db=>db.prepare('SELECT format FROM mp_original_formats WHERE user_id=? AND original_id=?').get(f.b.userId,ordinary.ref.slice(9))!.format),'file');
 await waitForScopedState(async()=>(await checked(f.a.token,'/api/tasks/'+owner.root.id)).state==='succeeded'&&(await checked(f.b.token,'/api/processing/originals/'+ordinary.ref.slice(9))).indexed,()=>'Explicit owner and B ordinary audio must retain processing');
 const unknown=()=>f.read(db=>({call:db.prepare('SELECT * FROM task_external_calls WHERE issuance_id=?').get(issuance),task:db.prepare('SELECT external_state,external_key,external_issuance FROM user_tasks WHERE task_id=?').get(uncertain.child.id),activity:db.prepare('SELECT state FROM mp_activity WHERE user_id=? AND id=?').get(f.a.userId,activity)}));const journal=unknown();assert.equal(journal.call!.state,'unknown');assert.equal(journal.activity!.state,'unknown');
 // Background snapshot/internal recovery has no ownerRequested capability.
 execution.forUser(context).retry(pending.root.id);await waitForScopedState(async()=>(await checked(f.a.token,'/api/tasks/'+pending.root.id)).state==='blocked',()=>'Internal retry should stay fenced');assert.equal(f.read(db=>db.prepare('SELECT origin FROM mp_admission_origins WHERE user_id=? AND task_id=?').get(f.a.userId,pending.root.id)!.origin),'automatic');
 await checked(f.a.token,'/api/tasks/'+pending.root.id+'/retry','POST',{});await waitForScopedState(async()=>(await checked(f.a.token,'/api/tasks/'+pending.root.id)).state==='succeeded',()=>'One explicit root retry must restore its exact safe retired child');assert.equal((await checked(f.a.token,'/api/tasks/'+pending.child.id)).state,'succeeded');
 const replay=await checked(f.a.token,'/api/processing','POST',{originalRef:'original:'+post.original.id,operationId:'generated-old-post'});assert.equal(replay.id,post.root.id);await waitForScopedState(async()=>(await checked(f.a.token,'/api/tasks/'+post.root.id)).state==='succeeded',()=>'Explicit same-key submit must upgrade intent and restore only its safe retired tree');
 assert.equal((await f.request(f.a.token,'/api/tasks/'+uncertain.child.id+'/retry','POST',{})).statusCode,409);assert.deepEqual(unknown(),journal,'Migration and unacknowledged retry preserve all unknown issuance facts');
 await checked(f.a.token,'/api/tasks/'+uncertain.root.id+'/retry','POST',{});await waitForScopedState(async()=>(await checked(f.a.token,'/api/tasks/'+uncertain.root.id)).state==='blocked',()=>'Root retry must still require acknowledgement of its unknown child');assert.deepEqual(unknown(),journal);
 const count=calls.length;await f.restart();await checked(f.a.token,'/api/health');assert.deepEqual(unknown(),journal);assert.equal(calls.length,count);assert.equal((await checked(f.a.token,'/api/tasks/'+uncertain.root.id)).state,'blocked');
 await checked(f.a.token,'/api/tasks/'+uncertain.child.id+'/retry','POST',{confirmUnknown:true});await waitForScopedState(async()=>(await checked(f.a.token,'/api/tasks/'+uncertain.root.id)).state==='succeeded',()=>'Acknowledged exact unknown child restores its retired coordinator');assert.equal(unknown().call!.state,'unknown','Acknowledgement never rewrites the previous physical call fact');assert.equal(unknown().activity!.state,'unknown');assert.equal(f.read(db=>db.prepare('SELECT count(*) n FROM task_external_retry_confirmations WHERE issuance_id=?').get(issuance)!.n),1);const acknowledgedCount=calls.length;await f.restart();await checked(f.a.token,'/api/health');assert.equal(calls.length,acknowledgedCount);
 const sameKey=await checked(f.a.token,'/api/processing','POST',{originalRef:'original:'+legacy.original.id,operationId:legacyKey});assert.equal(sameKey.id,legacy.root.id);assert.equal(f.read(db=>db.prepare('SELECT origin FROM mp_admission_origins WHERE user_id=? AND task_id=?').get(f.a.userId,legacy.root.id)!.origin),'owner');
});
