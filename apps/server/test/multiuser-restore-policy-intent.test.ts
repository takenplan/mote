import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID,createHash} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {setTimeout as delay} from 'node:timers/promises';
import {parseConfigDocument,serializeConfigDocument} from '@mote/shared/config-file';
import {buildApp} from '../src/app.js';
import {ExecutionFailure} from '../src/execution-engine.js';
import {EXECUTION_POLICIES} from '../src/execution-policy.js';
import {defaultProcessingSettings} from '../src/scope/processing-schema.js';
import {defaultMemorySettings} from '../src/scope/memory-schema.js';
import {backupScopedInstance,restoreScopedInstance} from '../../../scripts/scoped-backup.mjs';
import {scopedFilesFixture} from './fixtures/scoped-files.js';
import {waitForScopedState} from './fixtures/scoped-process.js';

test('stopped restore keeps two owners future policy intent while retiring old authority, preserving unknown facts and fencing cancelled input',async t=>{
 const f=await scopedFilesFixture(t),root=mkdtempSync(join(tmpdir(),'mote-policy-intent-')),snapshot=join(root,'backup'),target=join(root,'restored'),configuration=join(root,'instance.yaml');
 let host=f.host,calls=0;
 t.after(async()=>{await host.app.close();rmSync(root,{recursive:true,force:true});});
 const read=<T>(directory:string,work:(db:DatabaseSync)=>T)=>{const db=new DatabaseSync(join(directory,'mote.sqlite'),{readOnly:true});try{return work(db);}finally{db.close();}};
 const request=(token:string|undefined,url:string,method:any='GET',payload?:unknown)=>host.app.inject({method,url,headers:{'x-mote-protocol-version':'2','x-mote-ingress-version':'3',...(token?{authorization:'Bearer '+token}:{})},...(payload===undefined?{}:{payload:payload as any})});
 const checked=async(...args:Parameters<typeof request>)=>{const response=await request(...args);assert.equal(response.statusCode,200,response.body);return response.json();};
 const register=()=>host.execution!.register({kind:'generated.policy-effect',pool:'generated.policy-effects',policy:EXECUTION_POLICIES.localProcessing,concurrency:()=>1,parseInput:input=>input as Record<string,unknown>,execute:async run=>{if(run.task.input.hold)throw new ExecutionFailure('waiting','generated_policy_waiting',60000,{executionStarted:false});run.external.begin('generated-policy-'+run.task.id);calls++;if(run.task.input.unknown)throw new ExecutionFailure('transient','generated_lost_reply',1);run.external.complete();return {generated:true};}});
 register();
 for(const [user,enabled] of [[f.a,true],[f.b,false]] as const){
  for(const [domain,value] of [
   ['processing',{...defaultProcessingSettings(),enabled,automatic:enabled,summarize:false,semanticTurns:false,understandingEnabled:false}],
   ['memory',{...defaultMemorySettings(),automatic:enabled}],
   ['actions',{enabled,timeZone:'UTC'}],
   ['mcpConnections',{connections:[{id:'generated-mcp',enabled,url:'https://generated.invalid/mcp',token:'GENERATED_STOPPED_ARCHIVE_TOKEN',sourceIds:['same-source']}]}],
  ] as const){const view=await checked(user.token,'/api/configuration');await checked(user.token,'/api/configuration/'+domain,'PUT',{revision:view.revision,value});}
 }
 const memoryB=await checked(f.b.token,'/api/memory');await checked(f.b.token,'/api/memory/pause','POST',{expectedRevision:memoryB.revision,operationId:randomUUID()});
 const cancelled=await checked(f.b.token,'/api/tasks','POST',{kind:'generated.policy-effect',operationId:'generated-cancelled-before-backup',input:{hold:true}});await checked(f.b.token,'/api/tasks/'+cancelled.id+'/cancel','POST',{});assert.equal((await checked(f.b.token,'/api/tasks/'+cancelled.id)).state,'cancelled');
 for(const [user,unknown] of [[f.a,true],[f.b,false]] as const){
  const task=await checked(user.token,'/api/tasks','POST',{kind:'generated.policy-effect',operationId:'generated-policy-'+unknown,input:{unknown}});
  await waitForScopedState(async()=>{const view=await checked(user.token,'/api/tasks/'+task.id);return unknown?view.state==='blocked'&&view.externalUnresolved>0:view.state==='succeeded';},()=> 'Generated external fact did not settle',10000);
 }
 assert.equal(calls,2);
 const before=read(f.directory,db=>({
  accounts:db.prepare('SELECT user_id,authorization_epoch FROM auth_accounts ORDER BY user_id').all(),
  policies:Object.fromEntries(['mp_state','mm_state','ac_state'].map(table=>[table,db.prepare('SELECT * FROM '+table+' ORDER BY user_id').all()])),
  external:db.prepare('SELECT * FROM task_external_calls ORDER BY issuance_id').all(),
  completed:db.prepare("SELECT id,input,attempts FROM execution_steps WHERE state='succeeded' ORDER BY id").all(),
  cancelled:db.prepare('SELECT id,state,input FROM execution_steps WHERE id=?').get(cancelled.id),
 }));
 const yamlBefore=new Map([f.a,f.b].map(user=>[user.userId,parseConfigDocument(readFileSync(join(f.directory,'configuration/users',user.userId,'mote.yaml'),'utf8'),{}).savedDocument]));
 await host.app.close();writeFileSync(configuration,serializeConfigDocument({version:1,revision:0,storage:{dataDir:f.directory},server:{host:'127.0.0.1',port:0},actions:{enabled:true,timeZone:'UTC'}}));
 await backupScopedInstance({source:f.directory,out:snapshot,configFile:configuration});await restoreScopedInstance({from:snapshot,target});
 assert.equal(parseConfigDocument(readFileSync(join(target,'instance.yaml'),'utf8'),{}).savedDocument.actions?.enabled,true);
 for(const user of [f.a,f.b]){const restored=parseConfigDocument(readFileSync(join(target,'configuration/users',user.userId,'mote.yaml'),'utf8'),{}).savedDocument,prior=yamlBefore.get(user.userId)!;for(const domain of ['processing','memory','actions','mcpConnections'] as const)assert.deepEqual(restored[domain],prior[domain]);}
 read(target,db=>{
  for(const row of before.accounts)assert.equal(db.prepare('SELECT authorization_epoch FROM auth_accounts WHERE user_id=?').get(row.user_id)!.authorization_epoch,Number(row.authorization_epoch)+1);
  assert.equal(db.prepare('SELECT count(*) n FROM auth_credentials WHERE revoked_at IS NULL').get()!.n,0);assert.equal(db.prepare('SELECT count(*) n FROM task_authorizations WHERE revoked=0').get()!.n,0);assert.equal(db.prepare('SELECT count(*) n FROM execution_steps WHERE fence IS NOT NULL OR lease_until>0').get()!.n,0);
  for(const table of ['mp_state','mm_state','ac_state'])for(const prior of before.policies[table]!){const row=db.prepare('SELECT * FROM '+table+' WHERE user_id=?').get(prior.user_id)!;assert.equal(row.settings,prior.settings);assert.equal(row.generation,Number(prior.generation)+1);if(table==='mm_state')assert.equal(row.desired,prior.desired);if(table==='ac_state'){assert.equal(row.policy_id,null);assert.equal(row.policy_task,null);assert.equal(row.review_devices,'[]');}}
  assert.deepEqual(db.prepare('SELECT * FROM task_external_calls ORDER BY issuance_id').all(),before.external);assert.deepEqual(db.prepare("SELECT id,input,attempts FROM execution_steps WHERE state='succeeded' ORDER BY id").all(),before.completed);assert.deepEqual(db.prepare('SELECT id,state,input FROM execution_steps WHERE id=?').get(cancelled.id),before.cancelled);
 });
 const upload=async(token:string,name:string)=>{
  const bytes=Buffer.from('GENERATED_FRESH_POLICY_INPUT'),hash=createHash('sha256').update(bytes).digest('hex');
  const opened=await checked(token,'/api/ingress/sources/same-source/uploads','POST',{batchId:name,revision:{sourceId:'same-source',previousRevision:null,sizeBytes:bytes.length,sha256:hash,relativePath:name+'.txt',item:{externalId:name,revision:'same-r1',observedAt:'2026-10-16T00:00:00Z',title:name,text:'',kind:'file',layer:'original',mimeType:'text/plain'}}});
  await checked(token,'/api/ingress/uploads/'+opened.id+'/parts/0','PUT',{bytes:bytes.toString('base64'),checksum:hash});return (await checked(token,'/api/ingress/uploads/'+opened.id+'/commit','POST',{})).captures[0];
 };
 let freshA:any,freshB:any;
 for(let cycle=0;cycle<2;cycle++){
  host=await buildApp({dataDir:target});register();
  assert.equal((await request(f.a.token,'/api/auth/self')).statusCode,401);
  freshA=await checked(undefined,'/api/auth/login','POST',{username:'generated-a',password:'Generated-joint-files-password',mode:'client'});freshB=await checked(undefined,'/api/auth/login','POST',{username:'generated-b',password:'Generated-joint-files-password',mode:'client'});
  for(const [user,enabled] of [[freshA,true],[freshB,false]] as const){const view=await checked(user.token,'/api/configuration');for(const domain of ['processing','memory'] as const)assert.equal(view.domains.find((item:any)=>item.id===domain).saved.automatic,enabled);assert.equal(view.domains.find((item:any)=>item.id==='actions').saved.enabled,enabled);assert.equal((await checked(user.token,'/api/memory')).desired,enabled);}
  assert.equal((await checked(freshB.token,'/api/tasks/'+cancelled.id)).state,'cancelled');
  if(cycle===0){const a=await upload(freshA.token,'generated-new-a'),b=await upload(freshB.token,'generated-new-b');await waitForScopedState(async()=>(await checked(freshA.token,'/api/files/'+a.id)).processing.indexed,()=> 'New A input did not use its preserved automatic policy',10000);assert.equal((await checked(freshB.token,'/api/files/'+b.id)).processing.indexed,false);read(target,db=>{for(const [user,capture,allowed] of [[freshA,a,true],[freshB,b,false]] as const){const intake=db.prepare('SELECT * FROM mm_capture_intakes WHERE user_id=? AND capture_id=?').get(user.userId,capture.id)!;assert.equal(intake.revoked,Number(!allowed));assert.equal(JSON.parse(String(intake.json)).generation,db.prepare('SELECT generation FROM mm_state WHERE user_id=?').get(user.userId)!.generation);}});}
  await delay(120);assert.equal(calls,2,'restore and restart cannot replay the old known or unknown external effect');assert.deepEqual(read(target,db=>db.prepare('SELECT * FROM task_external_calls WHERE issuance_id IN(SELECT value FROM json_each(?)) ORDER BY issuance_id').all(JSON.stringify(before.external.map(row=>row.issuance_id)))),before.external);
  await host.app.close();
 }
});
