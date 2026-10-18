import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createHash,randomUUID} from 'node:crypto';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {launchScopedProcess,scopedHttpClient,waitForScopedState} from './fixtures/scoped-process.js';

const digest=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const protocol={'x-mote-protocol-version':'2','content-type':'application/json'};
for(const boundary of ['issued-write','write-ack','cleanup-ack','orderly-write','durable-result-ack','enabled-recheck'] as const)test('HTTP plugin check recovers its original canary across '+boundary+' and real host recovery',{timeout:120000},async t=>{
 const completedResult=boundary==='durable-result-ack';
 const directory=mkdtempSync(join(tmpdir(),'mote-check-recovery-')),script=join(directory,'host.mjs'),vault=join(directory,'vault'),records=new Map<string,any>(),operations=new Map<string,{hash:string;receipt:any}>(),events:Array<{method:string;label:string;pid:number;input:any}>=[],children:ReturnType<typeof launchScopedProcess>[]=[];
 let release!:()=>void,heldInput:any,heldWorker:number|undefined,heldFinished=false,bBefore:any,firstMemoryId:string|undefined;const held=new Promise<void>(done=>release=done);
 const server=createServer((req,res)=>{void(async()=>{
  let raw='';for await(const part of req)raw+=part;const input=JSON.parse(raw),method=req.url!.slice(1),label=String(req.headers['x-generated-owner-label']),pid=Number(req.headers['x-generated-worker-pid']);events.push({method,label,pid,input});
  const tag=digest([input.namespace,input.key]),prior=operations.get(input.opId);let value:any;
  const hold=async()=>{heldInput=input;heldWorker=pid;await held;heldFinished=true;};
  if(method==='put'){
   if(prior){if(prior.hash!==digest(input)){res.statusCode=409;res.end('{}');return;}value=prior.receipt;}
   else {const record={namespace:input.namespace,key:input.key,memory:input.memory},current=records.get(tag);if(current&&digest(current)!==digest(record)){res.statusCode=409;res.end('{}');return;}
    if(label==='A'){firstMemoryId??=input.memory.id;if(!heldInput&&(boundary==='issued-write'||boundary==='orderly-write'||boundary==='enabled-recheck'&&input.memory.id!==firstMemoryId))await hold();}
    records.set(tag,record);value={opId:input.opId,namespace:input.namespace,key:input.key,payloadDigest:digest(record),state:'applied',eraseVerified:false,recordedAt:new Date().toISOString()};operations.set(input.opId,{hash:digest(input),receipt:value});
    if(label==='A'&&!heldInput&&boundary==='write-ack')await hold();
   }
  }else if(method==='remove'){
   if(prior){if(prior.hash!==digest(input)){res.statusCode=409;res.end('{}');return;}value=prior.receipt;}
   else {records.delete(tag);value={opId:input.opId,namespace:input.namespace,key:input.key,payloadDigest:digest(input),state:'removed',currentRemoved:true,historyRetained:false,eraseVerified:true,recordedAt:new Date().toISOString()};operations.set(input.opId,{hash:digest(input),receipt:value});
    if(label==='A'&&!heldInput&&boundary==='cleanup-ack'&&input.namespace.ownerId.endsWith('-other'))await hold();
   }
  }else if(method==='read')value=records.get(tag)?.memory??null;
  else if(method==='search')value=[...records.values()].filter(record=>digest(record.namespace)===digest(input.namespace)&&input.keys.some((key:any)=>digest(key)===digest(record.key))).slice(0,input.limit);
  else if(method==='export')value=[...records.values()].filter(record=>digest(record.namespace)===digest(input.namespace));
  else throw Error('Unexpected generated provider method '+method);
  if(!res.destroyed){res.setHeader('content-type','application/json');res.end(JSON.stringify(value));}
 })().catch(error=>{console.error(error);res.destroy();});});
 await new Promise<void>(done=>server.listen(0,'127.0.0.1',done));const address=server.address();assert.ok(address&&typeof address!=='string');
 t.after(async()=>{release();for(const host of children)if(host.child.exitCode===null&&host.child.signalCode===null)host.child.kill('SIGKILL');await Promise.all(children.map(host=>host.closed));server.closeAllConnections();await new Promise<void>(done=>server.close(()=>done()));rmSync(directory,{recursive:true,force:true});});
 writeFileSync(script,`
import {buildApp} from ${JSON.stringify(new URL('../src/app.ts',import.meta.url).href)};
import {generatedMemoryRelease} from ${JSON.stringify(new URL('./fixtures/scoped-memory-release.ts',import.meta.url).href)};
import {DatabaseSync} from 'node:sqlite';
// Advance only the fixture wall clock on restart to expire the genuine dead-host
// lease. No task state, external fact, handler or grant is manually fabricated.
const now=Date.now;Date.now=()=>now()+(process.env.GENERATED_RECOVERY==='yes'?60000:0);
if(process.env.GENERATED_RECOVERY==='yes'){const db=new DatabaseSync(${JSON.stringify(join(vault,'mote.sqlite'))});db.exec('DROP TRIGGER IF EXISTS generated_probe_ack_loss');db.close();}
const release=generatedMemoryRelease(${JSON.stringify('http://127.0.0.1:'+address.port)}),node=await buildApp({dataDir:${JSON.stringify(vault)}},{pluginReleaseTransport:release.transport});
if(process.env.GENERATED_RECOVERY!=='yes')await node.accounts.initialize('generated-admin','Generated-check-recovery-01');
if(${JSON.stringify(completedResult)}&&process.env.GENERATED_RECOVERY!=='yes'){
 const db=node.execution.engine.store.db;db.function('generated_probe_crash',()=>{process.kill(process.pid,'SIGKILL');return 0;});
 // Crash inside the external-ACK transaction, after the separate result
 // checkpoint committed. Genuine SQLite rollback leaves only that ACK lost.
 db.exec(${JSON.stringify("CREATE TRIGGER generated_probe_ack_loss AFTER UPDATE OF external_state ON user_tasks WHEN NEW.external_state='succeeded' AND json_extract(NEW.checkpoints,'$.\"plugin-probe-result\"') IS NOT NULL AND EXISTS(SELECT 1 FROM plugin_user_instances i WHERE i.user_id=NEW.user_id AND json_extract(i.json,'$.configuration.label')='A') BEGIN SELECT generated_probe_crash(); END")});
}
const base=await node.app.listen({host:'127.0.0.1',port:0});console.log(JSON.stringify({phase:'ready',base}));
process.once('SIGTERM',()=>{void node.app.close().then(()=>{console.log(JSON.stringify({phase:'closed'}));process.exit(0);});});
`);
 const first=launchScopedProcess(script,{});children.push(first);const ready=await first.waitForPhase('ready'),api=scopedHttpClient(ready.base),password='Generated-check-recovery-01',admin=await api.request(undefined,'/api/auth/login','POST',{username:'generated-admin',password,mode:'client'});
 const preview=await api.request(admin.token,'/api/plugins/resolve','POST',{repository:'generated-local/mote-plugins',tag:'v4'}),catalog=await api.request(admin.token,'/api/admin/plugins'),installed=await api.request(admin.token,'/api/plugins/install','POST',{previewId:preview.id,expectedRevision:catalog.revision,operationId:randomUUID()}),pkg=installed.packages[0];
 await waitForScopedState(async()=> (await api.request(admin.token,'/api/plugins')).packages.some((value:any)=>value.id===pkg.id&&value.state==='installed'),()=> 'Generated release did not install');
 const users:any[]=[];for(const label of ['B','A']){const username='generated-'+label.toLowerCase(),account=await api.request(admin.token,'/api/admin/accounts','POST',{username,password}),login=await api.request(undefined,'/api/auth/login','POST',{username,password,mode:'client'}),token=login.token;
  await api.request(token,'/api/plugin-instances','POST',{expectedRevision:(await api.request(token,'/api/plugins')).revision,instance:{id:'same-instance',packageId:pkg.id,name:'Generated capability probe',configuration:{label},desired:false,grants:{capabilities:['repository','retrieval'],sourceIds:[],history:false}}});
  let check=await api.request(token,'/api/plugin-instances/same-instance/check','POST',{});assert.equal(check.observed,'checking');assert.equal(check.checked,false);
  if(label==='A'&&boundary==='enabled-recheck'){await waitForScopedState(async()=>(await api.request(token,'/api/tasks/'+check.taskId)).state==='succeeded',()=> 'A initial verification did not settle');await api.request(token,'/api/plugin-instances/same-instance/enable','POST',{expectedRevision:(await api.request(token,'/api/plugins')).revision});check=await api.request(token,'/api/plugin-instances/same-instance/check','POST',{});}
  users.push({label,userId:account.userId,token,taskId:check.taskId});
  if(label==='B'){await waitForScopedState(async()=>(await api.request(token,'/api/tasks/'+check.taskId)).state==='succeeded',()=> 'B initial check did not settle');bBefore=await api.request(token,'/api/plugins');}
 }
 if(completedResult)assert.equal((await first.closed).signal,'SIGKILL');else await waitForScopedState(()=>Boolean(heldInput),()=>JSON.stringify(events));
 const a=users.find(user=>user.label==='A'),b=users.find(user=>user.label==='B'),writes=events.filter(event=>event.label==='A'&&event.method==='put').length;
 const db=new DatabaseSync(join(vault,'mote.sqlite'));db.exec('PRAGMA busy_timeout=5000');let priorAttempt:any;try{assert.equal(db.prepare('SELECT state FROM execution_steps WHERE id=?').get(a.taskId)!.state,'running');priorAttempt=JSON.parse(String(db.prepare('SELECT checkpoints FROM user_tasks WHERE task_id=?').get(a.taskId)!.checkpoints))['plugin-probe-attempt'];}finally{db.close();}
 if(!completedResult){
  if(boundary==='orderly-write'){first.child.kill('SIGTERM');assert.equal((await first.closed).code,0);}else {first.child.kill('SIGKILL');assert.equal((await first.closed).signal,'SIGKILL');}
  await waitForScopedState(()=>{try{process.kill(heldWorker!,0);return false;}catch(error){if((error as NodeJS.ErrnoException).code==='ESRCH')return true;throw error;}},()=> 'Issued worker did not retire');
 }
 const second=launchScopedProcess(script,{GENERATED_RECOVERY:'yes'});children.push(second);const restarted=await second.waitForPhase('ready'),next=scopedHttpClient(restarted.base);
 await waitForScopedState(async()=>!['running','waiting'].includes((await next.request(a.token,'/api/tasks/'+a.taskId)).state),()=>JSON.stringify(events));
 const task=await next.request(a.token,'/api/tasks/'+a.taskId),view=await next.request(a.token,'/api/plugins');assert.equal(events.filter(event=>event.label==='A'&&event.method==='put').length,writes,'an unknown check cannot dispatch a fresh physical canary');
 if(completedResult){assert.equal(task.state,'succeeded',JSON.stringify(task));assert.equal(task.externalUnresolved,0);assert.equal(view.instances[0].checked,true);assert.deepEqual(await next.request(b.token,'/api/plugins'),bBefore);assert.equal(records.size,0,'original canary cleanup really finished before its result became recoverable');second.child.kill('SIGTERM');assert.equal((await second.closed).code,0);t.diagnostic(JSON.stringify({boundary,durableResultReused:true,physicalWritesBefore:writes,physicalWritesAfter:events.filter(event=>event.label==='A'&&event.method==='put').length}));return;}
 assert.equal(task.state,'blocked',JSON.stringify(task));assert.equal(task.failure.code,'external_result_unknown');assert.ok(task.externalUnresolved>0);assert.equal(view.instances[0].checked,boundary==='enabled-recheck');assert.notEqual(view.instances[0].observed,'ready');assert.deepEqual(await next.request(b.token,'/api/plugins'),bBefore);
 if(boundary==='enabled-recheck'){assert.equal(view.instances[0].desired,true);const paused=await next.request(a.token,'/api/plugin-instances/same-instance/pause','POST',{expectedRevision:view.revision});assert.equal(paused.instances[0].desired,false);const response=await fetch(restarted.base+'/api/plugin-instances/same-instance/resume',{method:'POST',headers:{...protocol,authorization:'Bearer '+a.token},body:JSON.stringify({expectedRevision:paused.revision})});assert.equal(response.status,503,await response.text());}
 for(const [url,body] of [['/api/plugin-instances/same-instance/check',{}],['/api/tasks/'+a.taskId+'/retry',{confirmUnknown:true}]]){const response=await fetch(restarted.base+url,{method:'POST',headers:{...protocol,authorization:'Bearer '+a.token},body:JSON.stringify(body)});assert.equal(response.status,409,await response.text());}
 const bCheck=await next.request(b.token,'/api/plugin-instances/same-instance/check','POST',{});await waitForScopedState(async()=>(await next.request(b.token,'/api/tasks/'+bCheck.taskId)).state==='succeeded',()=> 'B cannot perform an independent fresh check');
 release();await waitForScopedState(()=>heldFinished&&operations.has(heldInput.opId),()=> 'Generated remote effect did not settle');assert.equal(events.filter(event=>event.label==='A'&&event.method==='put').length,writes);assert.equal((await next.request(a.token,'/api/tasks/'+a.taskId)).state,'blocked','a late remote ACK cannot publish readiness through a dead worker');
 const finalDb=new DatabaseSync(join(vault,'mote.sqlite'));finalDb.exec('PRAGMA busy_timeout=5000');try{const rows=finalDb.prepare('SELECT state FROM task_external_calls WHERE task_id=?').all(a.taskId);assert.equal(rows.length,1);assert.ok(['issued','unknown'].includes(String(rows[0].state)));const checkpoints=JSON.parse(String(finalDb.prepare('SELECT checkpoints FROM user_tasks WHERE task_id=?').get(a.taskId)!.checkpoints));assert.deepEqual(checkpoints['plugin-probe-attempt'],priorAttempt);assert.equal(checkpoints['plugin-probe-result'],undefined);}finally{finalDb.close();}
 second.child.kill('SIGTERM');assert.equal((await second.closed).code,0);t.diagnostic(JSON.stringify({boundary,hostRecovery:true,actualWorker:true,physicalWritesBefore:writes,physicalWritesAfter:events.filter(event=>event.label==='A'&&event.method==='put').length,oldUnknownRetained:true,secondAccountVerified:true}));
});
