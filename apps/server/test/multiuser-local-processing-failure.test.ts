import test,{type TestContext} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createServer} from 'node:http';
import {buildApp} from '../src/app.js';
import type {ConnectorTransports} from '../src/scope/connector-contract.js';
import {defaultProcessingSettings} from '../src/scope/processing-schema.js';
import {defaultModelSettings} from '../src/model-settings.js';
import {scopedFilesFixture} from './fixtures/scoped-files.js';
import {waitForScopedState} from './fixtures/scoped-process.js';

async function recordingFixture(t:TestContext){
 const directory=mkdtempSync(join(tmpdir(),'mote-local-decoder-failure-'));
 let aUser='';
 const transports:ConnectorTransports={dingtalk:scope=>async command=>{
  switch(command.kind){
   case 'status':return {authenticated:true,corp_id:'generated-corp',user_id:'generated-vendor-user'};
   case 'search':return {minutes:[{taskUuid:'same-recording'}],complete:true};
   case 'metadata':return {basic:{taskUuid:command.id,title:'Generated recording',startTime:1792022400000,duration:1000}};
   case 'transcript':return {taskUuid:command.id,complete:true,paragraphList:scope.userId===aUser?[{unknown:'GENERATED_UNSUPPORTED_PRIVATE_A'}]:[{paragraph:'GENERATED_PRIVATE_B',nickName:'Generated speaker'}]};
   case 'media':throw Error('Generated independent media acquisition unavailable');
   default:throw Error('Unexpected generated provider operation '+command.kind);
  }
 }};
 const host=await buildApp({dataDir:directory},{connectorTransports:transports});
 t.after(async()=>{await host.app.close();rmSync(directory,{recursive:true,force:true});});
 const headers={'x-mote-protocol-version':'2','x-mote-ingress-version':'3'};
 const request=(token:string|undefined,url:string,method:any='GET',payload?:any)=>host.app.inject({url,method,headers:{...headers,...(token?{authorization:'Bearer '+token}:{})},...(payload===undefined?{}:{payload})});
 const checked=async(...args:Parameters<typeof request>)=>{const response=await request(...args);assert.equal(response.statusCode,200,response.body);return response.json();};
 const password='Generated-local-decoder-password';
 await host.accounts!.initialize('generated-admin',password);
 const login=(username:string)=>checked(undefined,'/api/auth/login','POST',{username,password,mode:'client'}),admin=await login('generated-admin');
 for(const username of ['generated-a','generated-b'])await checked(admin.token,'/api/admin/accounts','POST',{username,password});
 const a=await login('generated-a'),b=await login('generated-b');aUser=a.userId;
 const db=new DatabaseSync(join(directory,'mote.sqlite'),{readOnly:true});t.after(()=>db.close());
 await checked(admin.token,'/api/admin/connectors/dingtalk-recordings/install','POST',{expectedRevision:host.plugins!.catalog.revision(),operationId:randomUUID()});
 const operation=async(token:string,operation:string,payload?:unknown)=>{
  const task=await checked(token,'/api/connectors/same-connection/operations','POST',{operationId:randomUUID(),operation,...(payload?{payload}:{})});
  await waitForScopedState(async()=>(await checked(token,'/api/tasks/'+task.id)).state==='succeeded',()=>'Generated recording setup did not complete',15000);
 };
 for(const actor of [a,b]){
  let current=await checked(actor.token,'/api/configuration');
  await checked(actor.token,'/api/configuration/processing','PUT',{revision:current.revision,value:{...defaultProcessingSettings(),automatic:true,understandingEnabled:false,summarize:false,semanticTurns:false}});
  current=await checked(actor.token,'/api/connectors');
  await checked(actor.token,'/api/connectors/same-connection','PUT',{expectedRevision:current.revision,connection:{provider:'dingtalk-recordings',autoSync:false}});
  current=await checked(actor.token,'/api/connectors');
  await checked(actor.token,'/api/connectors/same-connection/enable','POST',{expectedRevision:current.revision});
  await operation(actor.token,'connect');
  await operation(actor.token,'select',{enabled:true,start:'2026-10-01T00:00:00Z',end:'2026-10-20T00:00:00Z',autoSync:false,backupAudio:true});
 }
 const sync=async(token:string)=>{
  const task=await checked(token,'/api/connectors/same-connection/sync','POST',{operationId:randomUUID()});
  await waitForScopedState(async()=>!['waiting','running'].includes((await checked(token,'/api/tasks/'+task.id)).state),()=>'Generated recording sync did not finish',15000);
 };
 return {host,a,b,db,request,checked,sync};
}

test('a returned pure recording decoder failure settles its exact activity and allows current owner data recovery',async t=>{
 const f=await recordingFixture(t);
 await f.sync(f.a.token);await f.sync(f.b.token);
 let decoder:any;
 await waitForScopedState(async()=>{
  decoder=(await f.checked(f.a.token,'/api/tasks')).items.find((task:any)=>task.kind==='processing.extract'&&task.failure?.code==='recording_transcript_format_unsupported');
  return decoder?.state==='failed';
 },()=>'Current unsupported recording did not reach its real decoder failure',15000);
 await waitForScopedState(()=>!f.db.prepare("SELECT 1 FROM execution_steps WHERE user_id=? AND kind LIKE 'processing.%' AND state IN('waiting','running')").get(f.a.userId),()=>'Failed recording coordinator did not stop',15000);
 assert.equal(decoder.externalUnresolved,0,'a pure decoder returned a known format failure; no physical call remains unknown');
 assert.equal(Number(f.db.prepare('SELECT count(*) n FROM mp_activity WHERE user_id=?').get(f.a.userId)!.n),0);
 const calls=f.db.prepare('SELECT state FROM task_external_calls WHERE user_id=? AND task_id=?').all(f.a.userId,decoder.id);
 assert.ok(calls.length>0,'exercise the real issued/completion journal');
 assert.ok(calls.every(row=>row.state==='succeeded'),'failure completion settles only the physical receipt, not task success');
 const original=f.db.prepare("SELECT o.id,o.hash FROM ig_originals o JOIN mp_original_formats f ON f.user_id=o.user_id AND f.original_id=o.id WHERE o.user_id=? AND f.format='processor:connector.dingtalk-transcript'").get(f.a.userId)!;
 assert.ok(original);
 const aContext=await f.host.authority.authenticate(f.a.token),scope=f.host.services.forUser(aContext),originalBytes=f.host.ingress!.forUser(aContext).readOriginal('original:'+original.id).bytes;
 assert.match(originalBytes.toString(),/GENERATED_UNSUPPORTED_PRIVATE_A/);
 assert.equal((await f.request(f.b.token,'/api/processing/originals/'+original.id)).statusCode,404);
 await waitForScopedState(()=>Boolean(f.db.prepare('SELECT 1 FROM mp_publications WHERE user_id=?').get(f.b.userId)),()=>'B valid recording did not publish',15000);
 const bPublications=f.db.prepare('SELECT * FROM mp_publications WHERE user_id=? ORDER BY original_id').all(f.b.userId);
 const archive=await scope.exportUser('processing');
 assert.equal((await scope.deleteUser('processing','generated-local-decode-delete')).status,'complete');
 await scope.restoreUser('processing',archive,'generated-local-decode-restore');
 await scope.restoreUser('processing',archive,'generated-local-decode-restore');
 assert.equal(f.db.prepare('SELECT format FROM mp_original_formats WHERE user_id=? AND original_id=?').get(f.a.userId,original.id)!.format,'processor:connector.dingtalk-transcript');
 assert.deepEqual(f.host.ingress!.forUser(aContext).readOriginal('original:'+original.id).bytes,originalBytes);
 assert.deepEqual(f.db.prepare('SELECT * FROM mp_publications WHERE user_id=? ORDER BY original_id').all(f.b.userId),bPublications,'A recovery cannot alter B publications');
 assert.equal(Number(f.db.prepare('SELECT count(*) n FROM mp_activity WHERE user_id=?').get(f.b.userId)!.n),0);
 assert.equal((await f.checked(f.a.token,'/api/tasks/'+decoder.id)).state,'failed','data recovery never grants or retries the failed task');
});

test('loopback media HTTP unknown remains fenced across restart and still requires exact owner acknowledgement',async t=>{
 let aKey='',aCalls=0,ready=false;
 const server=createServer((request,response)=>{void(async()=>{
  for await(const _ of request){}
  if(request.headers.authorization==='Bearer '+aKey){aCalls++;if(!ready){response.writeHead(503,{'Retry-After':'0'}).end('GENERATED_UNKNOWN_MEDIA_RESULT');return;}}
  response.setHeader('Content-Type','application/json');response.setHeader('X-Mote-Execution','local');
  response.end(JSON.stringify({durationMs:1000,segments:[{startMs:0,endMs:1000,text:'GENERATED_MEDIA_TRANSCRIPT'}],coverage:'full',engine:'generated-unknown-contrast'}));
 })().catch(()=>response.destroy());});
 await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
 t.after(()=>{server.closeAllConnections();return new Promise<void>(resolve=>server.close(()=>resolve()));});
 const address=server.address();assert.ok(address&&typeof address!=='string');
 const f=await scopedFilesFixture(t);aKey='GENERATED_'+f.a.userId;
 for(const actor of [f.a,f.b]){
  let view=await f.checked(actor.token,'/api/configuration');
  await f.checked(actor.token,'/api/configuration/processing','PUT',{revision:view.revision,value:{...defaultProcessingSettings(),automatic:false,summarize:false,semanticTurns:false,audioProcessor:'audio.http'}});
  view=await f.checked(actor.token,'/api/configuration');
  await f.checked(actor.token,'/api/configuration/models','PUT',{revision:view.revision,value:{profiles:[{id:'generated-asr',name:'Generated ASR',settings:{...defaultModelSettings(),provider:'custom',protocol:'mote-media',baseUrl:'http://127.0.0.1:'+address.port+'/transcribe',model:'generated-asr',apiKey:'GENERATED_'+actor.userId}}],selections:{asr:{kind:'personal',id:'generated-asr'}}}});
 }
 const wave=Buffer.alloc(48);wave.write('RIFF');wave.writeUInt32LE(40,4);wave.write('WAVEfmt ',8);wave.writeUInt32LE(16,16);wave.writeUInt16LE(1,20);wave.writeUInt16LE(1,22);wave.writeUInt32LE(8000,24);wave.writeUInt32LE(16000,28);wave.writeUInt16LE(2,32);wave.writeUInt16LE(16,34);wave.write('data',36);wave.writeUInt32LE(4,40);
 const a=await f.uploadBytes(f.a.token,'generated-unknown-contrast',wave,'audio/wav'),b=await f.uploadBytes(f.b.token,'generated-unknown-contrast',wave,'audio/wav');
 const root=await f.checked(f.a.token,'/api/processing','POST',{originalRef:a.original.ref,operationId:'generated-unknown-contrast'}),other=await f.checked(f.b.token,'/api/processing','POST',{originalRef:b.original.ref,operationId:'generated-unknown-contrast'});
 await waitForScopedState(async()=>['blocked','failed'].includes((await f.checked(f.a.token,'/api/tasks/'+root.id)).state)&&(await f.checked(f.b.token,'/api/tasks/'+other.id)).state==='succeeded',()=>'Generated HTTP unknown/valid contrast did not finish',15000);
 const child=(await f.checked(f.a.token,'/api/tasks')).items.find((task:any)=>task.kind==='processing.asr');assert.ok(child);assert.equal(child.externalUnresolved,1);assert.equal(aCalls,1);
 assert.equal((await f.request(f.a.token,'/api/processing','POST',{originalRef:a.original.ref,operationId:'generated-unknown-fresh-replay'})).statusCode,409);
 assert.equal((await f.request(f.a.token,'/api/tasks/'+child.id+'/retry','POST',{})).statusCode,409);
 assert.equal((await f.request(f.b.token,'/api/tasks/'+child.id+'/retry','POST',{confirmUnknown:true})).statusCode,404);
 await f.restart();assert.equal((await f.checked(f.a.token,'/api/tasks/'+child.id)).externalUnresolved,1);assert.equal(aCalls,1);
 const db=new DatabaseSync(join(f.directory,'mote.sqlite'),{readOnly:true});t.after(()=>db.close());
 const issuance=db.prepare('SELECT issuance_id,state FROM task_external_calls WHERE user_id=? AND task_id=?').get(f.a.userId,child.id)!;
 assert.ok(['issued','unknown'].includes(String(issuance.state)));
 assert.equal(Number(db.prepare('SELECT count(*) n FROM mp_activity WHERE user_id=?').get(f.a.userId)!.n),1);
 ready=true;
 const retried=await f.checked(f.a.token,'/api/files/'+a.id+'/retry','POST',{operationId:'generated-confirmed-media-contrast',stage:'transcribe',confirmUnknown:true});
 await waitForScopedState(async()=>(await f.checked(f.a.token,'/api/tasks/'+retried.taskId)).state==='succeeded',()=>'Explicitly acknowledged media retry did not finish',15000);
 assert.equal(aCalls,2);assert.equal((await f.checked(f.b.token,'/api/files/'+b.id)).processing.indexed,true);
 assert.equal(db.prepare('SELECT state FROM task_external_calls WHERE issuance_id=?').get(issuance.issuance_id)!.state,issuance.state,'confirmation cannot rewrite the earlier physical fact');
 assert.equal(Number(db.prepare('SELECT count(*) n FROM task_external_retry_confirmations WHERE user_id=? AND issuance_id=?').get(f.a.userId,issuance.issuance_id)!.n),1);
});
