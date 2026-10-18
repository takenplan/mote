import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomUUID} from 'node:crypto';
import {buildApp} from '../src/app.js';
import {defaultProcessingSettings} from '../src/scope/processing-schema.js';
import {defaultMemorySettings} from '../src/scope/memory-schema.js';
import {launchScopedProcess,scopedHttpClient,waitForScopedState} from './fixtures/scoped-process.js';
import {recordingRange} from './fixtures/recording-phase-host.js';

test('SIGKILL of a real scoped recording HTTP host preserves admitted retry identity without rediscovery or replay of completed A/B phases',{timeout:45000},async t=>{
 const directory=mkdtempSync(join(tmpdir(),'mote-recording-process-')),password='Generated-recording-process-01',calls:{user:string;kind:string;id?:string}[]=[],processes:ReturnType<typeof launchScopedProcess>[]=[],failed=new Set<string>();let ownerA='';
 const wave=Buffer.alloc(48);wave.write('RIFF');wave.writeUInt32LE(40,4);wave.write('WAVEfmt ',8);wave.writeUInt32LE(16,16);wave.writeUInt16LE(1,20);wave.writeUInt16LE(1,22);wave.writeUInt32LE(8000,24);wave.writeUInt32LE(16000,28);wave.writeUInt16LE(2,32);wave.writeUInt16LE(16,34);wave.write('data',36);wave.writeUInt32LE(4,40);
 const provider=createServer((req,res)=>{void(async()=>{let raw='';for await(const chunk of req)raw+=chunk;const {user,command}=JSON.parse(raw);calls.push({user,kind:command.kind,...(command.id?{id:command.id}:{})});let value:unknown;
  if(command.kind==='status')value={authenticated:true,corp_id:'same-corp',user_id:'same-vendor'};
  else if(command.kind==='search')value={minutes:['r1','r2'].map(taskUuid=>({taskUuid})),complete:true};
  else if(command.kind==='metadata')value={basic:{taskUuid:command.id,title:'GENERATED_'+user+'_'+command.id,startTime:Date.parse('2026-10-16T01:00:00Z'),duration:5000}};
  else if(command.kind==='transcript'){const key=user+':'+command.id;if(user===ownerA&&command.id==='r1'&&!failed.has(key)){failed.add(key);value={failure:{category:'transient',code:'generated_pending_after_process_death',retryAfterMs:60000}};}else value={taskUuid:command.id,complete:true,paragraphList:[{paragraph:'GENERATED_'+user+'_'+command.id}]};}
  else if(command.kind==='media')value={bytes:wave.toString('base64')};else throw Error(command.kind);
  res.setHeader('content-type','application/json');res.end(JSON.stringify(value));})().catch(()=>res.destroy());});await new Promise<void>(resolve=>provider.listen(0,'127.0.0.1',resolve));
 t.after(async()=>{for(const process of processes){if(process.child.exitCode===null&&process.child.signalCode===null)process.child.kill('SIGKILL');await process.closed;}provider.closeAllConnections();await new Promise<void>(resolve=>provider.close(()=>resolve()));rmSync(directory,{recursive:true,force:true});});
 const initial=await buildApp({dataDir:directory});await initial.accounts!.initialize('generated-admin',password);await initial.app.close();
 let generatedNow=Date.now();const start=async()=>{const child=launchScopedProcess(fileURLToPath(new URL('./fixtures/scoped-recording-process.ts',import.meta.url)),{GENERATED_RECORDING_ROOT:directory,GENERATED_RECORDING_PROVIDER:'http://127.0.0.1:'+(provider.address() as any).port,GENERATED_RECORDING_NOW:String(generatedNow)});processes.push(child);const ready=await child.waitForPhase('listening');return {...child,...scopedHttpClient('http://127.0.0.1:'+ready.port)};};
 let host=await start();const request=(...args:Parameters<typeof host.request>)=>host.request(...args),configure=(...args:Parameters<typeof host.configure>)=>host.configure(...args);
 const admin=await request(undefined,'/api/auth/login','POST',{username:'generated-admin',password,mode:'client'}),users:any[]=[];
 await request(admin.token,'/api/admin/connectors/dingtalk-recordings/install','POST',{expectedRevision:(await request(admin.token,'/api/admin/plugins')).revision,operationId:randomUUID()});
 const waitTask=async(token:string,id:string)=>{let task:any;await waitForScopedState(async()=>{task=await request(token,'/api/tasks/'+id);return !['waiting','running'].includes(task.state);},()=>JSON.stringify(task),15000);assert.equal(task.state,'succeeded',JSON.stringify(task));return task;};
 for(const label of ['a','b']){
  await request(admin.token,'/api/admin/accounts','POST',{username:'generated-'+label,password});const user=await request(undefined,'/api/auth/login','POST',{username:'generated-'+label,password,mode:'client'});users.push(user);if(label==='a')ownerA=user.userId;
  await configure(user.token,'processing',{...defaultProcessingSettings(),automatic:false});await configure(user.token,'memory',{...defaultMemorySettings(),automatic:false});
  await request(user.token,'/api/connectors/recorder','PUT',{expectedRevision:(await request(user.token,'/api/connectors')).revision,connection:{provider:'dingtalk-recordings',autoSync:false}});await request(user.token,'/api/connectors/recorder/enable','POST',{expectedRevision:(await request(user.token,'/api/plugins')).revision});
  for(const [operation,payload]of [['connect',{}],['select',recordingRange]]as const){const task=await request(user.token,'/api/connectors/recorder/operations','POST',{operation,payload,operationId:randomUUID()});await waitTask(user.token,task.id);}
 }
 const [a,b]=users,page=(token:string)=>request(token,'/api/connectors/recorder/recordings?limit=100'),tasks=(token:string)=>request(token,'/api/tasks'),count=(user:string,kind:string,id?:string)=>calls.filter(call=>call.user===user&&call.kind===kind&&(!id||call.id===id)).length;
 await waitForScopedState(async()=>{const ap=await page(a.token),bp=await page(b.token);return ap.items.length===2&&ap.items.find((item:any)=>item.id==='r1').transcript.attempts===1&&ap.items.find((item:any)=>item.id==='r1').transcript.state==='waiting'&&ap.items.find((item:any)=>item.id==='r2').transcript.state==='succeeded'&&bp.items.length===2&&bp.items.every((item:any)=>item.audio.state==='succeeded'&&item.transcript.state==='succeeded');},()=>JSON.stringify(calls),10000);
 const transcript=(await tasks(a.token)).items.filter((task:any)=>task.kind==='connector.recording.transcript'),pending=transcript.find((task:any)=>task.state==='waiting'),completed=transcript.find((task:any)=>task.state==='succeeded'),beforeB=await page(b.token);assert.ok(pending&&completed);
 host.child.kill('SIGKILL');assert.equal((await host.closed).signal,'SIGKILL');generatedNow=pending.availableAt+1;host=await start();
 assert.equal((await request(a.token,'/api/tasks/'+completed.id)).attempts,completed.attempts);assert.deepEqual(await page(b.token),beforeB);
 await waitTask(a.token,pending.id);assert.equal((await request(a.token,'/api/tasks/'+pending.id)).attempts,2);assert.equal(count(a.userId,'transcript','r1'),2);assert.equal(count(a.userId,'transcript','r2'),1);assert.equal(count(a.userId,'search'),1);assert.equal(count(b.userId,'search'),1);assert.deepEqual(await page(b.token),beforeB);
 host.child.kill('SIGTERM');assert.equal((await host.closed).code,0);
});
