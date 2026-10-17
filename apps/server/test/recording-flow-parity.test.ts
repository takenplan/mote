import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {join,dirname} from 'node:path';
import {randomUUID} from 'node:crypto';
import {ExecutionFailure} from '../src/execution-engine.js';
import {scopedCaptureFixture} from './fixtures/scoped-capture-host.js';
import {waitForScopedState} from './fixtures/scoped-process.js';
import {defaultProcessingSettings} from '../src/scope/processing-schema.js';

const selection={enabled:true,start:'2026-10-16T00:00:00.000Z',end:'2026-10-17T00:00:00.000Z',autoSync:false,backupAudio:true};
const wave=Buffer.concat([Buffer.from('RIFF0000WAVE'),Buffer.alloc(64)]);
for(const owners of [1,2])test(`${owners} owner recording journey keeps independent phase failures, date bounds and completed checkpoints across restart and retry`,async t=>{
 const calls:{user:string;phase:string;id?:string}[]=[],failures=new Map<string,{transcript:boolean;media:boolean}>();
 const state=(user:string)=>{let value=failures.get(user);if(!value){value={transcript:true,media:true};failures.set(user,value);}return value;};
 const f=await scopedCaptureFixture(t,{connectorTransports:{dingtalk:scope=>async command=>{
  calls.push({user:scope.userId,phase:command.kind,...('id' in command?{id:command.id}:{})});
  switch(command.kind){
   case 'status':return {authenticated:true,corp_id:'same-corp',user_id:'same-vendor-account'};
   case 'search':return {minutes:[{taskUuid:'same-recording'},{taskUuid:'outside-recording'},{taskUuid:'bad-metadata'}],complete:true};
   case 'metadata':if(command.id==='bad-metadata')throw new ExecutionFailure('blocked','recording_metadata_permission');return {basic:{taskUuid:command.id,title:'Generated '+scope.userId,startTime:Date.parse(command.id==='outside-recording'?'2026-10-18T12:00:00Z':'2026-10-16T12:00:00Z'),duration:5000}};
   case 'transcript':return {taskUuid:command.id,complete:true,paragraphList:[state(scope.userId).transcript?{sentenceList:[{sentence:'not primary speech'}]}:{paragraph:'GENERATED_PRIVATE_'+scope.userId,nickName:'Speaker'}]};
   case 'media':if(state(scope.userId).media)throw new ExecutionFailure('blocked','recording_media_permission');{const path=join(scope.directory,'dws-runtime',command.output);mkdirSync(dirname(path),{recursive:true});writeFileSync(path,wave);return {ok:true,succeeded:1,results:[{taskUuid:command.id}]};}
   default:throw Error('Unexpected generated recording operation '+command.kind);
  }
 }}});
 const checked=async(token:string,path:string,method='GET',payload?:unknown)=>{const response=await f.request(token,path,method,payload);assert.equal(response.statusCode,200,response.body);return response.json();};
 const run=async(token:string,suffix:string,payload:Record<string,unknown>={})=>{const task=await checked(token,'/api/connectors/same-recordings/'+suffix,'POST',{operationId:randomUUID(),...payload});let result:any;await waitForScopedState(async()=>{result=await checked(token,'/api/tasks/'+task.id);return !['waiting','running'].includes(result.state);},()=>'Generated recording flow did not settle');assert.equal(result.state,'succeeded',JSON.stringify(result));return result;};
 const page=async(token:string)=>(await checked(token,'/api/connectors/same-recordings/recordings?limit=100')).items;
 await checked(f.admin.token,'/api/admin/connectors/dingtalk-recordings/install','POST',{expectedRevision:f.host.plugins!.catalog.revision(),operationId:randomUUID()});
 await waitForScopedState(async()=>(await f.host.plugins!.catalog.view()).packages.some(value=>value.id.startsWith('mote.connector.dingtalk-recordings@')&&value.state==='installed'),()=>'Generated recording package not ready');
 const actors=owners===1?[f.a]:[f.a,f.b];
 for(const actor of actors){
  let view=await checked(actor.token,'/api/configuration');await checked(actor.token,'/api/configuration/processing','PUT',{revision:view.revision,value:{...defaultProcessingSettings(),automatic:false,understandingEnabled:false}});
  view=await checked(actor.token,'/api/connectors');await checked(actor.token,'/api/connectors/same-recordings','PUT',{expectedRevision:view.revision,connection:{provider:'dingtalk-recordings',autoSync:false}});
  const plugins=await checked(actor.token,'/api/plugins');await checked(actor.token,'/api/connectors/same-recordings/enable','POST',{expectedRevision:plugins.revision});
  await run(actor.token,'operations',{operation:'connect'});await run(actor.token,'operations',{operation:'select',payload:selection});const result=await run(actor.token,'sync');assert.equal(result.result.failed,3);
  const rows=await page(actor.token),same=rows.find((item:any)=>item.id==='same-recording'),outside=rows.find((item:any)=>item.id==='outside-recording'),bad=rows.find((item:any)=>item.id==='bad-metadata');
  assert.equal(same.metadata.state,'succeeded');assert.equal(same.transcript.error,'recording_transcript_format_unsupported');assert.equal(same.audio.error,'recording_media_permission');assert.equal(bad.metadata.error,'recording_metadata_permission');assert.equal(bad.transcript.error,undefined);assert.equal(outside.transcript.state,'skipped');assert.equal(outside.audio.state,'skipped');
  assert.equal(calls.filter(call=>call.user===actor.userId&&call.id==='outside-recording'&&['transcript','media'].includes(call.phase)).length,0,'provider search results outside the saved range never grant acquisition');
 }
 await f.restart();const bBefore=owners===2?await page(f.b.token):undefined;
 const transcriptCalls=()=>calls.filter(call=>call.user===f.a.userId&&call.phase==='transcript').length,searchCalls=()=>calls.filter(call=>call.user===f.a.userId&&call.phase==='search').length;
 const searchBefore=searchCalls();state(f.a.userId).transcript=false;
 await run(f.a.token,'operations',{operation:'retry',payload:{resume:true}});
 let same=(await page(f.a.token)).find((item:any)=>item.id==='same-recording');assert.equal(same.transcript.archived,true);assert.equal(same.transcript.error,undefined);assert.equal(same.audio.error,'recording_media_permission');assert.equal(same.error,'recording_media_permission','successful text cannot delete an unresolved audio failure');
 const successfulText=same.transcriptCaptureId,afterText=transcriptCalls();assert.ok(successfulText);assert.equal(searchCalls(),searchBefore);
 await f.restart();same=(await page(f.a.token)).find((item:any)=>item.id==='same-recording');assert.equal(same.audio.error,'recording_media_permission');state(f.a.userId).media=false;
 await run(f.a.token,'operations',{operation:'retry',payload:{resume:true}});same=(await page(f.a.token)).find((item:any)=>item.id==='same-recording');assert.equal(same.audio.archived,true);assert.equal(same.error,undefined);assert.equal(same.transcriptCaptureId,successfulText);assert.equal(transcriptCalls(),afterText);assert.equal(searchCalls(),searchBefore);
 if(owners===2){assert.deepEqual(await page(f.b.token),bBefore,'A recovery cannot alter B stage receipts with equal vendor IDs');assert.equal((await f.request(f.b.token,'/api/files/'+successfulText)).statusCode,404);}
});

test('shared scoped stages publish each discovery page, keep independent backup latency and revise metadata without replaying identical evidence',async t=>{
 let entered!:()=>void,release!:()=>void;const entry=new Promise<void>(resolve=>entered=resolve),hold=new Promise<void>(resolve=>release=resolve);t.after(()=>release());
 let nextEntered!:()=>void,nextRelease!:()=>void;const discoveryEntry=new Promise<void>(resolve=>nextEntered=resolve),discoveryHold=new Promise<void>(resolve=>nextRelease=resolve);t.after(()=>nextRelease());let version=0,transcriptCalls=0,ioCalls=0;
 const f=await scopedCaptureFixture(t,{connectorTransports:{dingtalk:scope=>async command=>{
  ioCalls++;switch(command.kind){case 'status':return {authenticated:true,corp_id:'same',user_id:'same'};case 'search':if(command.cursor){nextEntered();await discoveryHold;return {minutes:[{taskUuid:'same'}],complete:true};}return {data:{minutes:[{taskUuid:'same'}],complete:false},meta:{pagination:{next_token:'page2'}}};case 'metadata':return {basic:{taskUuid:'same',title:version===2?'Generated title-only correction':version?'Generated corrected title':'Generated',startTime:Date.parse(version?'2026-10-16T13:00:00Z':'2026-10-16T12:00:00Z'),duration:version?6000:5000}};case 'transcript':transcriptCalls++;entered();await hold;return {taskUuid:'same',complete:true,paragraphList:[{paragraph:'Generated held transcript'}]};case 'media':{const path=join(scope.directory,'dws-runtime',command.output);mkdirSync(dirname(path),{recursive:true});writeFileSync(path,wave);return {ok:true,succeeded:1,results:[{taskUuid:'same'}]};}default:throw Error('Unexpected generated recording I/O');}
 }}});
 const checked=async(path:string,method='GET',payload?:unknown,token=f.a.token)=>{const response=await f.request(token,path,method,payload);assert.equal(response.statusCode,200,response.body);return response.json();};
 const settle=async(task:any)=>{let value:any;await waitForScopedState(async()=>{value=await checked('/api/tasks/'+task.id);return value.state==='succeeded';},()=>'Generated task did not complete');};
 await checked('/api/admin/connectors/dingtalk-recordings/install','POST',{expectedRevision:f.host.plugins!.catalog.revision(),operationId:randomUUID()},f.admin.token);
 await waitForScopedState(async()=>(await f.host.plugins!.catalog.view()).packages.some(value=>value.id.startsWith('mote.connector.dingtalk-recordings@')&&value.state==='installed'),()=>'Generated package not ready');
 let view=await checked('/api/configuration');await checked('/api/configuration/processing','PUT',{revision:view.revision,value:{...defaultProcessingSettings(),automatic:false,understandingEnabled:false}});view=await checked('/api/connectors');await checked('/api/connectors/same-recordings','PUT',{expectedRevision:view.revision,connection:{provider:'dingtalk-recordings',autoSync:false}});const plugins=await checked('/api/plugins');await checked('/api/connectors/same-recordings/enable','POST',{expectedRevision:plugins.revision});
 for(const operation of [{operation:'connect'},{operation:'select',payload:selection}])await settle(await checked('/api/connectors/same-recordings/operations','POST',{operationId:randomUUID(),...operation}));
 const task=await checked('/api/connectors/same-recordings/sync','POST',{operationId:randomUUID()});await entry;
 await waitForScopedState(async()=>{const item=(await checked('/api/connectors/same-recordings/recordings?limit=100')).items[0];return item?.audio.archived&&item.transcript.state==='running';},()=>'Independent backup remained behind held transcript');release();await discoveryEntry;
 const first=(await checked('/api/connectors/same-recordings/recordings?limit=100')).items[0];assert.equal(first.transcript.archived,true,'a later discovery page cannot delay the durable first recording');assert.equal(first.audio.archived,true);nextRelease();await settle(task);assert.equal(transcriptCalls,1,'repeated IDs on another page are one phase in this discovery round');
 version=1;await settle(await checked('/api/connectors/same-recordings/sync','POST',{operationId:randomUUID()}));let page=await checked('/api/connectors/same-recordings/recordings?limit=100'),corrected=page.items[0];assert.notEqual(corrected.transcriptCaptureId,first.transcriptCaptureId,'unchanged vendor text with corrected metadata creates a semantic revision');assert.equal(corrected.title,'Generated corrected title');assert.equal(corrected.recordedAt,'2026-10-16T13:00:00.000Z');assert.equal(corrected.transcript.error,undefined);
 version=2;await settle(await checked('/api/connectors/same-recordings/sync','POST',{operationId:randomUUID()}));const titleOnly=(await checked('/api/connectors/same-recordings/recordings?limit=100')).items[0];assert.notEqual(titleOnly.transcriptCaptureId,corrected.transcriptCaptureId);assert.equal(titleOnly.title,'Generated title-only correction');assert.equal(titleOnly.transcript.error,undefined);corrected=titleOnly;
 await settle(await checked('/api/connectors/same-recordings/sync','POST',{operationId:randomUUID()}));page=await checked('/api/connectors/same-recordings/recordings?limit=100');assert.equal(page.items[0].transcriptCaptureId,corrected.transcriptCaptureId,'unchanged metadata and bytes remain the same revision despite a later observation');
 const sourceId=page.sourceId;await checked('/api/sources/'+sourceId,'PATCH',{enabled:false});const callsBefore=ioCalls,blocked=await checked('/api/connectors/same-recordings/sync','POST',{operationId:randomUUID()});let blockedTask:any;await waitForScopedState(async()=>{blockedTask=await checked('/api/tasks/'+blocked.id);return blockedTask.state==='blocked';},()=>'Privacy withdrawal did not block collection');assert.equal(blockedTask.failure.code,'recording_paused');assert.equal(ioCalls,callsBefore,'source withdrawal fences provider reads before account discovery');await checked('/api/sources/'+sourceId,'PATCH',{enabled:true});await settle(await checked('/api/connectors/same-recordings/operations','POST',{operationId:randomUUID(),operation:'retry',payload:{resume:true}}));
});
