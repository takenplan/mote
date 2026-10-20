import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {execFileSync} from 'node:child_process';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {join,dirname} from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
import {createHash,randomUUID} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {serializeConfigDocument} from '@mote/shared/config-file';
import {defaultModelSettings} from '../src/model-settings.js';
import {defaultProcessingSettings} from '../src/scope/processing-schema.js';
import {defaultMemorySettings} from '../src/scope/memory-schema.js';
import {writeMessagesResponse} from '../../../scripts/fixtures/messages-provider.js';
import {launchScopedProcess,scopedHttpClient,waitForScopedState} from './fixtures/scoped-process.js';

const entry=process.env.MOTE_MEMORY_INDEX_ENTRY??fileURLToPath(new URL('../src/index.ts',import.meta.url));
test('actual index startup confirms an unknown Coding review after SIGKILL without repeating understanding or a successful owner',{timeout:120000},async t=>{
 const root=mkdtempSync(join(tmpdir(),'mote-memory-index-')),directory=join(root,'vault'),file=join(root,'generated.yaml'),password='Generated-memory-index-01',calls:{owner:string;review:boolean;understanding:boolean;model:string}[]=[],processes:ReturnType<typeof launchScopedProcess>[]=[];let resumed=false,release!:()=>void;
 const held=new Promise<void>(done=>release=done),provider=createServer((req,res)=>{void(async()=>{
  let raw='';for await(const chunk of req)raw+=chunk;const body=JSON.parse(raw),owner=String(req.headers['x-api-key']).includes('_A_')?'A':'B',value=JSON.parse(typeof body.messages[0].content==='string'?body.messages[0].content:body.messages[0].content[0].text),review=Boolean(value.untrustedTaskContext?.untrustedMemoryDraft),understanding=raw.includes('FINAL UNIFIED RESPONSE CONTRACT:');calls.push({owner,review,understanding,model:body.model});
  if(owner==='A'&&review&&!resumed)await held;
  if(res.destroyed)return;
  const seed=value.untrustedEvidence[0],candidate={domain:'personal',title:'Generated '+owner+' scoped Memory',statement:'The generated speaker described this scoped work constraint. ['+seed.id+']',uncertainty:'Generated source only',admission:{layer:'memory',reason:'Explicit generated context',scope:'This generated original',attribution:owner==='A'?'user':'third_party'},evidenceIds:[seed.id],evidence:[{id:seed.id,quote:seed.ocrText}]},coverage=value.untrustedTaskContext.memoryWork.members.map((member:any,index:number)=>({key:member.key,state:index===0?'checked':'no_candidates',candidateIndexes:index===0?[0]:[]}));
  const answer=understanding?{summary:'Generated bounded Coding interpretation',evidence:candidate.evidence,workRecords:[],events:[],memoryCandidates:[candidate],actionCues:[],coverage}:{memories:[candidate],coverage};
  writeMessagesResponse(res,{stage:calls.length,model:body.model,text:JSON.stringify({answer:JSON.stringify(answer),citationIds:[seed.id]})});
 })().catch(()=>res.destroy());});await new Promise<void>(done=>provider.listen(0,'127.0.0.1',done));
 writeFileSync(file,serializeConfigDocument({version:1,revision:0,storage:{dataDir:directory},server:{host:'127.0.0.1',port:0}}));const env={MOTE_CONFIG_FILE:file},initialize=join(dirname(entry),'scope','initialize-admin'+(entry.endsWith('.ts')?'.ts':'.js'));
 execFileSync(process.execPath,entry.endsWith('.ts')?['--import','tsx',initialize]:[initialize],{env:{...process.env,...env},input:JSON.stringify({username:'generated-admin',password}),stdio:['pipe','pipe','pipe'],timeout:15000});
 const db=new DatabaseSync(join(directory,'mote.sqlite'));db.exec('PRAGMA busy_timeout=5000');
 t.after(async()=>{release();for(const process of processes){if(process.child.exitCode===null&&process.child.signalCode===null)process.child.kill('SIGKILL');await process.closed;}db.close();provider.closeAllConnections();await new Promise<void>(done=>provider.close(()=>done()));rmSync(root,{recursive:true,force:true});});
 const start=async()=>{const process=launchScopedProcess(entry,env,{loader:entry.endsWith('.ts')});processes.push(process);const {port}=await process.waitForPhase('listening');return {...process,...scopedHttpClient('http://127.0.0.1:'+port),base:'http://127.0.0.1:'+port};};
 let host=await start();const request=(...args:Parameters<typeof host.request>)=>host.request(...args),configure=(...args:Parameters<typeof host.configure>)=>host.configure(...args),admin=await request(undefined,'/api/auth/login','POST',{username:'generated-admin',password,mode:'client'}),users:any[]=[];
 for(const owner of ['B','A']){
  const account=await request(admin.token,'/api/admin/accounts','POST',{username:'generated-'+owner.toLowerCase(),password}),{token}=await request(undefined,'/api/auth/login','POST',{username:account.username,password,mode:'client'});
  await configure(token,'models',{profiles:[{id:'same-model',name:'Generated model',settings:{...defaultModelSettings(),provider:'custom',protocol:'anthropic-messages',model:'generated-admitted-memory',baseUrl:'http://127.0.0.1:'+(provider.address() as any).port+'/v1',apiKey:'GENERATED_'+owner+'_KEY'}}],selections:{memory:{kind:'personal',id:'same-model'}}});
  await configure(token,'processing',{...defaultProcessingSettings(),automatic:true,understandingEnabled:false,summarize:false,semanticTurns:false});await configure(token,'memory',{...defaultMemorySettings(),automatic:false,integration:false});
  await request(token,'/api/ingress/sources','POST',{id:'same-source',name:'Generated '+owner,kind:owner==='A'?'coding-agent':'local-files',deviceId:'same-device',platform:'macos',retention:'archive'});
  if(owner==='A')await request(token,'/api/ingress/sources/same-source/items','POST',{batchId:'same-batch',items:[{externalId:'same-owner-event',revision:'1',observedAt:'2001-01-01T10:00:00Z',kind:'message',layer:'original',text:'GENERATED_A: Please keep a reviewable preview and defer deployment.',document:{recordedAt:'2001-01-01T10:00:00Z',timeBasis:'recorded',contentRole:'transcript',coding:{version:1,provider:'codex',sessionId:'same-session',projectKey:'same-project',eventId:'same-owner-event',part:0,parts:1,role:'user',attribution:'human'}}}]});
  else{
   const bytes=Buffer.from('GENERATED_B: The narrator keeps a blue bicycle.'),checksum=createHash('sha256').update(bytes).digest('hex'),upload=await request(token,'/api/ingress/sources/same-source/uploads','POST',{batchId:'same-batch',revision:{sourceId:'same-source',item:{externalId:'same-file',revision:'1',observedAt:'2001-01-01T10:00:00Z',title:'Generated ordinary original',text:'',kind:'file',layer:'original',mimeType:'text/plain'},sizeBytes:bytes.length,sha256:checksum,relativePath:'generated.txt'}});await request(token,'/api/ingress/uploads/'+upload.id+'/parts/0','PUT',{bytes:bytes.toString('base64'),checksum});await request(token,'/api/ingress/uploads/'+upload.id+'/commit','POST',{});
  }
  let material:any;await waitForScopedState(async()=>{material=(await request(token,'/api/materials')).items.find((item:any)=>item.kind===(owner==='A'?'mote.coding-session':'document'));return material;},()=>owner+' organized original');
  const job=await request(token,'/api/memory/jobs','POST',{operationId:randomUUID(),materialIds:[material.id]});users.push({owner,token,userId:account.userId,job,material});
  if(owner==='B')await waitForScopedState(async()=>(await request(token,'/api/memory/jobs/'+job.id)).state==='committed',()=> 'B successful batch');
 }
 const a=users.find(user=>user.owner==='A'),b=users.find(user=>user.owner==='B');await waitForScopedState(()=>calls.some(call=>call.owner==='A'&&call.review),()=> 'A independent review transport');
 const before=await request(b.token,'/api/memories'),bTask=db.prepare("SELECT id,attempts FROM execution_steps WHERE user_id=? AND kind='memory.batch' AND state='succeeded'").get(b.userId),aTask=db.prepare("SELECT id,attempts FROM execution_steps WHERE user_id=? AND kind='memory.batch'").get(a.userId)!;
 assert.equal(calls.length,4);assert.equal(calls.filter(call=>call.owner==='A'&&call.understanding).length,1);assert.ok(db.prepare('SELECT 1 FROM mm_job_batches WHERE user_id=? AND draft IS NOT NULL AND review IS NULL').get(a.userId));assert.ok(db.prepare("SELECT 1 FROM mm_batch_artifacts WHERE user_id=? AND kind LIKE 'coding-understanding:%'").get(a.userId));
 const staged={draft:db.prepare('SELECT draft FROM mm_job_batches WHERE user_id=? AND job_id=?').get(a.userId,a.job.id)!.draft,artifacts:db.prepare('SELECT kind,json FROM mm_batch_artifacts WHERE user_id=? AND job_id=? ORDER BY kind').all(a.userId,a.job.id)},issued=db.prepare("SELECT issuance_id,state,settled_at FROM task_external_calls WHERE task_id=? AND state='issued'").get(aTask.id)!;assert.ok(issued);
 host.child.kill('SIGKILL');assert.equal((await host.closed).signal,'SIGKILL');resumed=true;release();host=await start();
 await waitForScopedState(async()=>{const task=await request(a.token,'/api/tasks/'+aTask.id);return task.state==='blocked'&&task.error==='external_result_unknown'&&task.externalUnresolved===1;},()=> 'issued review must block without a replacement request');
 assert.equal(calls.length,4);assert.deepEqual(await request(b.token,'/api/memories'),before);assert.deepEqual(db.prepare('SELECT issuance_id,state,settled_at FROM task_external_calls WHERE issuance_id=?').get(issued.issuance_id),issued);assert.deepEqual({draft:db.prepare('SELECT draft FROM mm_job_batches WHERE user_id=? AND job_id=?').get(a.userId,a.job.id)!.draft,artifacts:db.prepare('SELECT kind,json FROM mm_batch_artifacts WHERE user_id=? AND job_id=? ORDER BY kind').all(a.userId,a.job.id)},staged);
 const retry=async(token:string,url:string,body:unknown)=>fetch(host.base+url,{method:'POST',headers:{'x-mote-protocol-version':'2','content-type':'application/json',authorization:'Bearer '+token},body:JSON.stringify(body)});
 assert.equal((await retry(b.token,'/api/tasks/'+aTask.id+'/retry',{confirmUnknown:true})).status,404);assert.equal((await retry(a.token,'/api/tasks/'+aTask.id+'/retry',{})).status,409);assert.equal((await retry(a.token,'/api/memory/jobs/'+a.job.id+'/retry',{})).status,409);assert.equal(calls.length,4,'unconfirmed recovery never sends another reviewer');
 await request(a.token,'/api/tasks/'+aTask.id+'/retry','POST',{confirmUnknown:true});
 assert.equal(db.prepare('SELECT state FROM task_external_calls WHERE issuance_id=?').get(issued.issuance_id)!.state,'unknown');assert.equal(db.prepare('SELECT count(*) n FROM task_external_retry_confirmations WHERE issuance_id=?').get(issued.issuance_id)!.n,1);
 await waitForScopedState(async()=>(await request(a.token,'/api/memory/jobs/'+a.job.id)).state==='committed',()=>JSON.stringify(db.prepare('SELECT kind,state,error FROM execution_steps').all()));
 assert.equal(calls.length,5,'only the explicitly confirmed interrupted independent review repeats');assert.deepEqual(await request(b.token,'/api/memories'),before);assert.deepEqual(db.prepare("SELECT id,attempts FROM execution_steps WHERE id=? AND state='succeeded'").get(bTask!.id),bTask);assert.equal((await request(a.token,'/api/memory/jobs/'+a.job.id)).tasks.batch.id,aTask.id);assert.equal((await request(a.token,'/api/materials?kind=summary')).items.length,1);
 const usage=(await request(a.token,'/api/usage')).items;assert.equal(usage.filter((item:any)=>item.status==='completed').length,2);assert.equal(usage.length,3,'the interrupted review has its own usage fragment');assert.equal(usage.filter((item:any)=>item.status==='failed').length,1);assert.equal(db.prepare('SELECT state FROM task_external_calls WHERE issuance_id=?').get(issued.issuance_id)!.state,'unknown','confirmation does not invent the lost reviewer outcome');assert.ok(calls.every(call=>call.model==='generated-admitted-memory'));
 const foreign=await fetch(host.base+'/api/memory/jobs/'+a.job.id,{headers:{'x-mote-protocol-version':'2',authorization:'Bearer '+b.token}});assert.equal(foreign.status,404);
 host.child.kill('SIGTERM');assert.equal((await host.closed).code,0);
});
