import test,{type TestContext} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdirSync,writeFileSync} from 'node:fs';
import {dirname,join} from 'node:path';
import {createServer} from 'node:http';
import {scopedCaptureFixture} from './fixtures/scoped-capture-host.js';
import {waitForScopedState} from './fixtures/scoped-process.js';
import {defaultProcessingSettings} from '../src/scope/processing-schema.js';
import {defaultMemorySettings} from '../src/scope/memory-schema.js';
import {defaultModelSettings} from '../src/model-settings.js';
import {historyRespond} from './fixtures/history-ask-fixture.js';

type VendorState={title:string;at:number;paragraphs:Record<string,unknown>[]};
const recordingId='same-recording';
const initial=(label:string):VendorState=>({title:'Generated recording '+label,at:Date.parse('2026-10-16T01:00:00Z'),paragraphs:[
 {paragraph:'GENERATED_'+label+'_KEPT',nickName:'Generated speaker'},
 {paragraph:'GENERATED_'+label+'_REMOVED_ONE',nickName:'Generated speaker'},
 {paragraph:'GENERATED_'+label+'_REMOVED_TWO',nickName:'Generated speaker'},
]});

async function fixture(t:TestContext,withAsk=false){
 const states=new Map<string,VendorState>(),calls:{userId:string;kind:string}[]=[],modelRequests:string[]=[];
 const wave=Buffer.alloc(48);wave.write('RIFF');wave.writeUInt32LE(40,4);wave.write('WAVEfmt ',8);wave.writeUInt32LE(16,16);wave.writeUInt16LE(1,20);wave.writeUInt16LE(1,22);wave.writeUInt32LE(8000,24);wave.writeUInt32LE(16000,28);wave.writeUInt16LE(2,32);wave.writeUInt16LE(16,34);wave.write('data',36);wave.writeUInt32LE(4,40);
 const f=await scopedCaptureFixture(t,{connectorTransports:{dingtalk:scope=>async command=>{
  const state=states.get(scope.userId);assert.ok(state,'Generated actor must be configured before vendor I/O');
  calls.push({userId:scope.userId,kind:command.kind});
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
 const materials=async(token:string)=>(await checked(token,'/api/materials?'+new URLSearchParams({sourceId:(await page(token)).sourceId,limit:'100'}))).items as any[];
 const projection=async(token:string,unsupported=false)=>{
  const expected=(await heads(token)).filter(item=>item.externalId.includes(':segment:')||!unsupported&&item.externalId===recordingId+':export');let current:any[]=[];
  await waitForScopedState(async()=>{current=await materials(token);return expected.every(item=>current.some(material=>material.origin.externalId==='processed:'+item.captureId));},()=>JSON.stringify({expected:expected.map(item=>item.captureId),materials:current}));
  const reads=await Promise.all(current.map(material=>checked(token,'/api/materials/'+material.id+'/read')));
  return {materials:current,text:reads.map(value=>value.text).join('\n')};
 };
 const originals=async(token:string)=>(await checked(token,'/api/ingress/sources/'+(await page(token)).sourceId+'/originals?limit=100')).items as any[];
 const bytes=async(token:string,ref:string)=>{
  const ticket=await checked(token,'/api/ingress/originals/'+ref.slice(9)+'/tickets','POST',{mode:'download'}),response=await request(token,'/api/ingress/originals/'+ref.slice(9)+'/content?ticket='+encodeURIComponent(ticket.ticket));
  assert.equal(response.status,200);return Buffer.from(await response.arrayBuffer());
 };
 const ask=async(token:string)=>{
  const id=randomUUID();await checked(token,'/api/query-runs','POST',{id,input:{question:'Describe the generated current recording evidence.'}});let result:any;
  await waitForScopedState(async()=>{result=await checked(token,'/api/query-runs/'+id);return result.status!=='running';},()=>JSON.stringify(result),20000);
  assert.equal(result.status,'completed',JSON.stringify(result));return result;
 };
 let modelUrl:string|undefined;
 if(withAsk){
  const provider=createServer((req,res)=>{void(async()=>{let raw='';for await(const part of req)raw+=part;modelRequests.push(raw);historyRespond(JSON.parse(raw),raw,res,String(req.headers['x-api-key']).includes('_A_')?'A':'B');})().catch(()=>res.destroy());});
  await new Promise<void>(resolve=>provider.listen(0,'127.0.0.1',resolve));const address=provider.address();assert.ok(address&&typeof address!=='string');modelUrl='http://127.0.0.1:'+address.port+'/v1';
  t.after(async()=>{provider.closeAllConnections();await new Promise<void>(resolve=>provider.close(()=>resolve()));});
 }
 await checked(f.admin.token,'/api/admin/connectors/dingtalk-recordings/install','POST',{expectedRevision:f.host.plugins!.catalog.revision(),operationId:randomUUID()});
 await waitForScopedState(async()=>(await f.host.plugins!.catalog.view()).packages.some(value=>value.id.startsWith('mote.connector.dingtalk-recordings@')&&value.state==='installed'),()=>'Generated recording package not ready');
 for(const actor of [f.a,f.b]){
  await configure(actor.token,'processing',{...defaultProcessingSettings(),automatic:true,understandingEnabled:false,summarize:false,semanticTurns:false});
  await configure(actor.token,'memory',{...defaultMemorySettings(),automatic:false});
  if(modelUrl)await configure(actor.token,'models',{profiles:[{id:'generated-chat',name:'Generated recording history',settings:{...defaultModelSettings(),provider:'custom',protocol:'anthropic-messages',model:'generated-recording',baseUrl:modelUrl,apiKey:actor===f.a?'GENERATED_A_KEY':'GENERATED_B_KEY',headers:{},extraBody:{}}}],selections:{chat:{kind:'personal',id:'generated-chat'}}});
  await checked(actor.token,'/api/connectors/same-recordings','PUT',{expectedRevision:(await checked(actor.token,'/api/connectors')).revision,connection:{provider:'dingtalk-recordings',autoSync:false}});
  await checked(actor.token,'/api/connectors/same-recordings/enable','POST',{expectedRevision:(await checked(actor.token,'/api/plugins')).revision});
  await run(actor.token,'operations',{operation:'connect'});
  await run(actor.token,'operations',{operation:'select',payload:{enabled:true,start:'2026-10-16T00:00:00Z',end:'2026-10-17T00:00:00Z',autoSync:false,backupAudio:true}});
  assert.equal((await run(actor.token,'sync')).result.failed,0);
  await projection(actor.token);
 }
 return {f,states,checked,request,run,page,heads,materials,projection,originals,bytes,calls,ask,modelRequests};
}

for(const changed of ['title','time'] as const)test('recording '+changed+' correction with identical transcript bytes publishes a new owned revision',async t=>{
 const {f,states,run,page,heads,projection,calls,originals,bytes}=await fixture(t),beforeA=await heads(f.a.token),beforeB=await heads(f.b.token),beforeExport=beforeA.find(item=>item.externalId===recordingId+':export'),beforeOriginals=await originals(f.a.token),mediaCalls=calls.filter(call=>call.userId===f.a.userId&&call.kind==='media').length;
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
 await projection(f.a.token);assert.equal(calls.filter(call=>call.userId===f.a.userId&&call.kind==='media').length,mediaCalls);
 assert.equal(after.find(item=>item.externalId===recordingId+':audio').captureId,beforeA.find(item=>item.externalId===recordingId+':audio').captureId);
 const oldOriginal=beforeOriginals.find(item=>item.captureId===beforeExport.captureId),newOriginal=(await originals(f.a.token)).find(item=>item.captureId===current.captureId);assert.ok(oldOriginal&&newOriginal);assert.equal(newOriginal.hash,oldOriginal.hash);assert.deepEqual(await bytes(f.a.token,newOriginal.ref),await bytes(f.a.token,oldOriginal.ref));
 const corrected=await heads(f.a.token);assert.equal((await run(f.a.token,'sync')).result.failed,0);assert.deepEqual(await heads(f.a.token),corrected,'Exact metadata replay must not produce captures');
 // Returning to the original metadata must advance the head, not reuse an old
 // duplicate receipt that leaves the corrected version current.
 if(changed==='title')state.title=initial('A').title;else state.at=initial('A').at;
 assert.equal((await run(f.a.token,'sync')).result.failed,0);const returned=(await heads(f.a.token)).find(item=>item.externalId===recordingId+':export');assert.ok(returned);assert.notEqual(returned.revision,beforeExport.revision);assert.notEqual(returned.revision,current.revision);assert.equal(returned.title,state.title);assert.equal(returned.document.recordedAt,new Date(state.at).toISOString());await projection(f.a.token);
});

for(const replacement of ['shorter','empty','unsupported'] as const)test('recording three-paragraph '+replacement+' replacement withdraws earlier speech from current owned consumers',async t=>{
 const {f,states,run,page,heads,projection,checked,originals,bytes,calls}=await fixture(t),beforeB=await heads(f.b.token),beforeA=await heads(f.a.token),oldOriginals=await originals(f.a.token),oldBytes=await Promise.all(oldOriginals.map(item=>bytes(f.a.token,item.ref))),beforeProjection=await projection(f.a.token),beforeMedia=calls.filter(call=>call.userId===f.a.userId&&call.kind==='media').length;
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
 t.diagnostic(JSON.stringify({replacement,failed:revised.result.failed,empty:status.empty,unsupported:status.unsupported,currentSegmentIds:segments.map(item=>item.externalId)}));
 const after=await projection(f.a.token,replacement==='unsupported');assert.ok(beforeProjection.text.includes('GENERATED_A_REMOVED_ONE'));
 for(const text of ['GENERATED_A_REMOVED_ONE','GENERATED_A_REMOVED_TWO',...(replacement==='shorter'?[]:['GENERATED_A_KEPT'])]){
  assert.ok(!after.text.includes(text),'Current Material cannot expose withdrawn speech '+text);
  assert.deepEqual((await checked(f.a.token,'/api/data/search?query='+text)).items,[],'Actual current query candidates cannot contain withdrawn speech');
 }
 if(replacement==='shorter')assert.ok(after.text.includes('GENERATED_A_KEPT'));
 for(const material of beforeProjection.materials.filter(item=>!after.materials.some(current=>current.id===item.id))){const response=await f.request(f.a.token,'/api/memory/materials/'+material.id+'?revision='+material.revision);assert.equal(response.statusCode,404,response.body);}
 for(const material of after.materials){const memory=await checked(f.a.token,'/api/memory/materials/'+material.id+'?revision='+material.revision);if(material.blockCount===0){assert.equal(memory.status,'unavailable');assert.deepEqual(memory.evidenceIds,[]);}}
 const oldSegment=beforeA.find(item=>item.externalId===recordingId+':segment:1'),head=current.find(item=>item.externalId===oldSegment.externalId);assert.ok(head&&!head.deleted);assert.notEqual(head.captureId,oldSegment.captureId,'Ordinary withdrawal advances a retained non-deleted source head');
 for(const [index,original] of oldOriginals.entries())assert.deepEqual(await bytes(f.a.token,original.ref),oldBytes[index],'Historical encrypted originals stay readable by their owner');
 const beforeReplay=await heads(f.a.token);await run(f.a.token,'sync');assert.deepEqual(await heads(f.a.token),beforeReplay,'Repeated current export must be idempotent');assert.equal(calls.filter(call=>call.userId===f.a.userId&&call.kind==='media').length,beforeMedia,'A transcript revision does not re-download a successful media backup');
});

test('ordinary recording withdrawal retains stale Ask answers and citations across restart while a fresh Ask uses current evidence',async t=>{
 const {f,states,run,projection,checked,ask,modelRequests}=await fixture(t,true),original=await ask(f.a.token),beforeB=await ask(f.b.token);assert.ok(original.result.citations.length);
 states.get(f.a.userId)!.paragraphs=[states.get(f.a.userId)!.paragraphs[0]];assert.equal((await run(f.a.token,'sync')).result.failed,0);await projection(f.a.token);
 const retained=await checked(f.a.token,'/api/conversations/'+original.conversationId);assert.equal(retained.turns[0].evidenceStale,true);assert.equal(retained.turns[0].evidenceDeleted,undefined);assert.deepEqual(retained.turns[0].result,original.result);
 const start=modelRequests.length;await ask(f.a.token);assert.ok(modelRequests.slice(start).every(raw=>!raw.includes('GENERATED_A_REMOVED_ONE')&&!raw.includes('GENERATED_A_REMOVED_TWO')));
 assert.deepEqual((await checked(f.b.token,'/api/conversations/'+beforeB.conversationId)).turns[0].result,beforeB.result);
 await f.restart();const restarted=await checked(f.a.token,'/api/conversations/'+original.conversationId);assert.equal(restarted.turns[0].evidenceStale,true);assert.equal(restarted.turns[0].evidenceDeleted,undefined);assert.deepEqual(restarted.turns[0].result,original.result);
});
