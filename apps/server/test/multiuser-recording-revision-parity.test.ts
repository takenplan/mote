import test,{type TestContext} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdirSync,writeFileSync} from 'node:fs';
import {dirname,join} from 'node:path';
import {scopedCaptureFixture} from './fixtures/scoped-capture-host.js';
import {waitForScopedState} from './fixtures/scoped-process.js';
import {defaultProcessingSettings} from '../src/scope/processing-schema.js';
import {defaultMemorySettings} from '../src/scope/memory-schema.js';

type VendorState={title:string;at:number;paragraphs:Record<string,unknown>[]};
const recordingId='same-recording';
const initial=(label:string):VendorState=>({title:'Generated recording '+label,at:Date.parse('2026-10-16T01:00:00Z'),paragraphs:[
 {paragraph:'GENERATED_'+label+'_KEPT',nickName:'Generated speaker'},
 {paragraph:'GENERATED_'+label+'_REMOVED_ONE',nickName:'Generated speaker'},
 {paragraph:'GENERATED_'+label+'_REMOVED_TWO',nickName:'Generated speaker'},
]});

async function fixture(t:TestContext){
 const states=new Map<string,VendorState>();
 const wave=Buffer.alloc(48);wave.write('RIFF');wave.writeUInt32LE(40,4);wave.write('WAVEfmt ',8);wave.writeUInt32LE(16,16);wave.writeUInt16LE(1,20);wave.writeUInt16LE(1,22);wave.writeUInt32LE(8000,24);wave.writeUInt32LE(16000,28);wave.writeUInt16LE(2,32);wave.writeUInt16LE(16,34);wave.write('data',36);wave.writeUInt32LE(4,40);
 const f=await scopedCaptureFixture(t,{connectorTransports:{dingtalk:scope=>async command=>{
  const state=states.get(scope.userId);assert.ok(state,'Generated actor must be configured before vendor I/O');
  switch(command.kind){
   case 'status':return {authenticated:true,corp_id:'generated-corp',user_id:'generated-vendor-user'};
   case 'search':return {minutes:[{taskUuid:recordingId}],complete:true};
   case 'metadata':return {basic:{taskUuid:command.id,title:state.title,startTime:state.at,duration:5000}};
   case 'transcript':return {taskUuid:command.id,complete:true,paragraphList:state.paragraphs};
   case 'media':{const path=join(scope.directory,'dws-runtime',command.output);mkdirSync(dirname(path),{recursive:true});writeFileSync(path,wave);return {ok:true,succeeded:1,results:[{taskUuid:command.id}]};}
   default:throw Error('Unexpected generated recording operation '+command.kind);
  }
 }}});
 states.set(f.a.userId,initial('A'));states.set(f.b.userId,initial('B'));
 const protocol={'x-mote-protocol-version':'2','x-mote-ingress-version':'3'};
 const request=async(token:string,path:string,method='GET',payload?:unknown)=>{
  if(!f.host.app.server.listening)await f.host.app.listen({host:'127.0.0.1',port:0});
  return fetch(new URL(path,f.host.app.listeningOrigin),{method,headers:{...protocol,authorization:'Bearer '+token,...(payload===undefined?{}:{'content-type':'application/json'})},...(payload===undefined?{}:{body:JSON.stringify(payload)})});
 };
 const checked=async(token:string,path:string,method='GET',payload?:unknown)=>{
  const response=await request(token,path,method,payload),body=await response.text();assert.equal(response.status,200,path+' '+body);return JSON.parse(body);
 };
 const run=async(token:string,suffix:string,payload:Record<string,unknown>={})=>{
  const admitted=await checked(token,'/api/connectors/same-recordings/'+suffix,'POST',{operationId:randomUUID(),...payload});let task:any;
  await waitForScopedState(async()=>{task=await checked(token,'/api/tasks/'+admitted.id);return !['waiting','running'].includes(task.state);},()=>JSON.stringify(task));
  assert.equal(task.state,'succeeded',JSON.stringify(task));return task;
 };
 const configure=async(token:string,domain:string,value:unknown)=>checked(token,'/api/configuration/'+domain,'PUT',{revision:(await checked(token,'/api/configuration')).revision,value});
 const page=(token:string)=>checked(token,'/api/connectors/same-recordings/recordings?limit=10');
 const heads=async(token:string)=>{
  const source=(await page(token)).sourceId;assert.ok(source);
  return (await checked(token,'/api/source-items?'+new URLSearchParams({sourceId:source,limit:'100'}))).items as any[];
 };
 await checked(f.admin.token,'/api/admin/connectors/dingtalk-recordings/install','POST',{expectedRevision:f.host.plugins!.catalog.revision(),operationId:randomUUID()});
 await waitForScopedState(async()=>(await f.host.plugins!.catalog.view()).packages.some(value=>value.id.startsWith('mote.connector.dingtalk-recordings@')&&value.state==='installed'),()=>'Generated recording package not ready');
 for(const actor of [f.a,f.b]){
  await configure(actor.token,'processing',{...defaultProcessingSettings(),automatic:false,understandingEnabled:false});
  await configure(actor.token,'memory',{...defaultMemorySettings(),automatic:false});
  await checked(actor.token,'/api/connectors/same-recordings','PUT',{expectedRevision:(await checked(actor.token,'/api/connectors')).revision,connection:{provider:'dingtalk-recordings',autoSync:false}});
  await checked(actor.token,'/api/connectors/same-recordings/enable','POST',{expectedRevision:(await checked(actor.token,'/api/plugins')).revision});
  await run(actor.token,'operations',{operation:'connect'});
  await run(actor.token,'operations',{operation:'select',payload:{enabled:true,start:'2026-10-16T00:00:00Z',end:'2026-10-17T00:00:00Z',autoSync:false,backupAudio:true}});
  assert.equal((await run(actor.token,'sync')).result.failed,0);
 }
 return {f,states,checked,run,page,heads};
}

for(const changed of ['title','time'] as const)test('recording '+changed+' correction with identical transcript bytes publishes a new owned revision',async t=>{
 const {f,states,run,page,heads}=await fixture(t),beforeA=await heads(f.a.token),beforeB=await heads(f.b.token),beforeExport=beforeA.find(item=>item.externalId===recordingId+':export');
 assert.ok(beforeExport);const state=states.get(f.a.userId)!;
 if(changed==='title')state.title='Generated corrected recording title';else state.at=Date.parse('2026-10-16T02:00:00Z');
 const revised=await run(f.a.token,'sync');
 assert.deepEqual(await heads(f.b.token),beforeB,'A correction cannot change equal vendor identities owned by B');
 assert.equal((await run(f.b.token,'sync')).result.failed,0);
 assert.deepEqual(await heads(f.b.token),beforeB,'B exact replay stays a no-op');
 const after=await heads(f.a.token),current=after.find(item=>item.externalId===recordingId+':export'),status=(await page(f.a.token)).items[0];
 t.diagnostic(JSON.stringify({changed,failed:revised.result.failed,error:status.error,beforeExportRevision:beforeExport.revision,afterExportRevision:current?.revision,currentTitle:current?.title,currentRecordedAt:current?.document?.recordedAt}));
 assert.equal(revised.result.failed,0,'An ordinary metadata correction must not fail the recording transcript checkpoint');
 assert.ok(current);assert.notEqual(current.revision,beforeExport.revision,'Changed title/time is a genuine SourceItem revision even when original bytes are identical');
 assert.equal(current.title,state.title);assert.equal(current.document.recordedAt,new Date(state.at).toISOString());
 for(const segment of after.filter(item=>item.externalId.startsWith(recordingId+':segment:'))){assert.equal(segment.title,state.title);assert.equal(segment.document.recordedAt,new Date(state.at).toISOString());}
});

for(const replacement of ['shorter','empty','unsupported'] as const)test('recording three-paragraph '+replacement+' replacement withdraws earlier speech from current owned heads',async t=>{
 const {f,states,run,page,heads}=await fixture(t),beforeB=await heads(f.b.token);
 assert.equal((await heads(f.a.token)).filter(item=>item.externalId.startsWith(recordingId+':segment:')).length,3);
 const state=states.get(f.a.userId)!;
 state.paragraphs=replacement==='shorter'?[state.paragraphs[0]]:replacement==='empty'?[]:[{unknown:'Generated unsupported current vendor format'}];
 const revised=await run(f.a.token,'sync');
 assert.deepEqual(await heads(f.b.token),beforeB,'A transcript replacement cannot change B current speech');
 assert.equal((await run(f.b.token,'sync')).result.failed,0);assert.deepEqual(await heads(f.b.token),beforeB);
 await f.restart();
 const current=await heads(f.a.token),segments=current.filter(item=>item.externalId.startsWith(recordingId+':segment:')&&!item.deleted),status=(await page(f.a.token)).items[0];
 if(replacement==='unsupported'){assert.ok(revised.result.failed>0);assert.equal(status.unsupported,true,'An unsupported export is retained as such, not claimed to have decoded new speech');}
 else{assert.equal(revised.result.failed,0);if(replacement==='empty')assert.equal(status.empty,true);}
 // Archive sources intentionally redact SourceItem.text. Assert the current
 // canonical identities, rather than treating that privacy projection as loss.
 t.diagnostic(JSON.stringify({replacement,failed:revised.result.failed,empty:status.empty,unsupported:status.unsupported,currentSegmentIds:segments.map(item=>item.externalId)}));
 assert.deepEqual(segments.map(item=>item.externalId).sort(),replacement==='shorter'?[recordingId+':segment:0']:[],
  'An updated export cannot keep withdrawn older paragraphs as current speech; retained historical evidence has a separate contract');
});
