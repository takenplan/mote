import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {join,dirname} from 'node:path';
import {randomUUID} from 'node:crypto';
import {scopedCaptureFixture} from './fixtures/scoped-capture-host.js';
import {waitForScopedState} from './fixtures/scoped-process.js';
import {defaultProcessingSettings} from '../src/scope/processing-schema.js';

test('owned recording reads retain actual transcript/audio checkpoints and signed owner-bound pagination without provider I/O',async t=>{
 const calls:string[]=[],state={failAudio:true};
 const wave=Buffer.alloc(48);wave.write('RIFF');wave.writeUInt32LE(40,4);wave.write('WAVEfmt ',8);wave.writeUInt32LE(16,16);wave.writeUInt16LE(1,20);wave.writeUInt16LE(1,22);wave.writeUInt32LE(8000,24);wave.writeUInt32LE(16000,28);wave.writeUInt16LE(2,32);wave.writeUInt16LE(16,34);wave.write('data',36);wave.writeUInt32LE(4,40);
 const f=await scopedCaptureFixture(t,{connectorTransports:{dingtalk:scope=>async(command)=>{
  calls.push(scope.userId+':'+command.kind);
  switch(command.kind){
   case 'status':return {authenticated:true,corp_id:'same-corp',user_id:'same-user'};
   case 'search':return {data:{minutes:[{taskUuid:command.cursor?'second-recording':'same-recording'}],complete:Boolean(command.cursor)},...(!command.cursor?{meta:{pagination:{next_token:'same-page-token'}}}:{})};
   case 'metadata':return {basic:{taskUuid:command.id,title:'Generated '+command.id+' '+scope.userId,startTime:1792108800000,duration:5000}};
   case 'transcript':return {taskUuid:command.id,complete:true,paragraphList:[{paragraph:'GENERATED_PRIVATE_'+scope.userId,nickName:'Speaker'}]};
   case 'media':if(state.failAudio)throw Error('GENERATED_PRIVATE_MEDIA_ERROR');{const path=join(scope.directory,'dws-runtime',command.output);mkdirSync(dirname(path),{recursive:true});writeFileSync(path,wave);return {ok:true,succeeded:1,results:[{taskUuid:command.id}]};}
   default:throw Error('Unexpected generated recording I/O '+command.kind);
  }
 }}});
 const checked=async(token:string,path:string,method='GET',payload?:unknown)=>{const r=await f.request(token,path,method,payload);assert.equal(r.statusCode,200,r.body);return r.json();};
 const run=async(token:string,suffix:string,body:Record<string,unknown>={})=>{const task=await checked(token,'/api/connectors/same-recordings/'+suffix,'POST',{operationId:randomUUID(),...body});let result:any;await waitForScopedState(async()=>{result=await checked(token,'/api/tasks/'+task.id);return !['waiting','running'].includes(result.state);},()=>'Generated recording task not settled');assert.equal(result.state,'succeeded',JSON.stringify(result));return result;};
 await checked(f.admin.token,'/api/admin/connectors/dingtalk-recordings/install','POST',{expectedRevision:f.host.plugins!.catalog.revision(),operationId:randomUUID()});
 await waitForScopedState(async()=>(await f.host.plugins!.catalog.view()).packages.some(value=>value.id.startsWith('mote.connector.dingtalk-recordings@')&&value.state==='installed'),()=>'Bundled generated recording package not ready');
 const selection={enabled:true,start:'2026-10-16T00:00:00.000Z',end:'2026-10-17T00:00:00.000Z',autoSync:false,backupAudio:true};
 for(const actor of [f.a,f.b]){
  let view=await checked(actor.token,'/api/configuration');await checked(actor.token,'/api/configuration/processing','PUT',{revision:view.revision,value:{...defaultProcessingSettings(),automatic:false,understandingEnabled:false}});
  view=await checked(actor.token,'/api/connectors');await checked(actor.token,'/api/connectors/same-recordings','PUT',{expectedRevision:view.revision,connection:{provider:'dingtalk-recordings',autoSync:false}});
  const plugins=await checked(actor.token,'/api/plugins');await checked(actor.token,'/api/connectors/same-recordings/enable','POST',{expectedRevision:plugins.revision});
  await run(actor.token,'operations',{operation:'connect'});await run(actor.token,'operations',{operation:'select',payload:selection});const result=await run(actor.token,'sync');assert.equal(result.result.failed,2);
 }
 const before=calls.length,first=await checked(f.a.token,'/api/connectors/same-recordings/recordings?limit=1');assert.equal(calls.length,before,'reading the ledger must not probe the external account');
 assert.equal(first.items.length,1);assert.equal(first.items[0].id,'same-recording');assert.equal(first.items[0].transcript.archived,true);assert.equal(first.items[0].audio.archived,false);assert.equal(first.items[0].audio.blocked,true);assert.equal(first.items[0].error,'recording_media_failed');assert.ok(first.items[0].transcriptCaptureId);assert.ok(first.sourceId.startsWith('connector-'));assert.ok(first.nextCursor);assert.doesNotMatch(JSON.stringify(first),/GENERATED_PRIVATE_MEDIA_ERROR/);
 const second=await checked(f.a.token,'/api/connectors/same-recordings/recordings?limit=1&cursor='+encodeURIComponent(first.nextCursor));assert.equal(second.items[0].id,'second-recording');assert.equal(second.nextCursor,null);
 assert.equal((await f.request(f.b.token,'/api/connectors/same-recordings/recordings?limit=1&cursor='+encodeURIComponent(first.nextCursor))).statusCode,400);
 assert.equal((await f.request(f.a.token,'/api/connectors/same-recordings/recordings?limit=2&cursor='+encodeURIComponent(first.nextCursor))).statusCode,400);
 const b=await checked(f.b.token,'/api/connectors/same-recordings/recordings?limit=1');assert.match(b.items[0].title,new RegExp(f.b.userId));assert.doesNotMatch(JSON.stringify(first),new RegExp(f.b.userId));
 state.failAudio=false;await run(f.a.token,'operations',{operation:'retry'});await run(f.a.token,'sync');const recovered=await checked(f.a.token,'/api/connectors/same-recordings/recordings?limit=1');assert.equal(recovered.items[0].audio.archived,true);assert.ok(recovered.items[0].audioCaptureId);assert.equal(recovered.items[0].transcriptCaptureId,first.items[0].transcriptCaptureId);
 await run(f.a.token,'operations',{operation:'select',payload:{...selection,end:'2026-10-18T00:00:00.000Z'}});assert.equal((await f.request(f.a.token,'/api/connectors/same-recordings/recordings?limit=1&cursor='+encodeURIComponent(first.nextCursor))).statusCode,400);
 await checked(f.admin.token,'/api/admin/accounts/'+f.a.userId,'PATCH',{disabled:true});assert.equal((await f.request(f.a.token,'/api/connectors/same-recordings/recordings?limit=1')).statusCode,401);assert.equal((await f.request(f.b.token,'/api/connectors/same-recordings/recordings?limit=1')).statusCode,200);
});
