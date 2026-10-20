import test,{type TestContext} from 'node:test';
import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import {mkdirSync,writeFileSync} from 'node:fs';
import {dirname,join} from 'node:path';
import {createServer} from 'node:http';
import {scopedCaptureFixture} from '../fixtures/scoped-capture-host.js';
import {waitForScopedState} from '../fixtures/scoped-process.js';
import {defaultProcessingSettings} from '../../src/scope/processing-schema.js';
import {defaultMemorySettings} from '../../src/scope/memory-schema.js';
import {defaultModelSettings} from '../../src/model-settings.js';
import {historyRespond} from '../fixtures/history-ask-fixture.js';
import {recordingMemoryRecipe} from '../../src/connectors/recording-memory.js';

type VendorState={title:string;at:number;paragraphs:Record<string,unknown>[];vendorUser?:string;mediaGate?:{entered():void;wait:Promise<void>}};

const recordingId='same-recording';

const initial=(label:string):VendorState=>({title:'Generated recording '+label,at:Date.parse('2026-10-16T01:00:00Z'),paragraphs:[
 {paragraph:'GENERATED_'+label+'_KEPT',nickName:'Generated speaker'},
 {paragraph:'GENERATED_'+label+'_REMOVED_ONE',nickName:'Generated speaker'},
 {paragraph:'GENERATED_'+label+'_REMOVED_TWO',nickName:'Generated speaker'},
]});

async function fixture(t:TestContext,withAsk=false,withIntake=false){
 const states=new Map<string,VendorState>(),calls:{userId:string;kind:string}[]=[],modelRequests:string[]=[];
 const wave=Buffer.alloc(48);wave.write('RIFF');wave.writeUInt32LE(40,4);wave.write('WAVEfmt ',8);wave.writeUInt32LE(16,16);wave.writeUInt16LE(1,20);wave.writeUInt16LE(1,22);wave.writeUInt32LE(8000,24);wave.writeUInt32LE(16000,28);wave.writeUInt16LE(2,32);wave.writeUInt16LE(16,34);wave.write('data',36);wave.writeUInt32LE(4,40);
 const f=await scopedCaptureFixture(t,{connectorTransports:{dingtalk:scope=>async command=>{
  const state=states.get(scope.userId);assert.ok(state,'Generated actor must be configured before vendor I/O');
  calls.push({userId:scope.userId,kind:command.kind});
  switch(command.kind){
   case 'status':return {authenticated:true,corp_id:'generated-corp',user_id:state.vendorUser??'generated-vendor-user'};
   case 'search':return {minutes:[{taskUuid:recordingId}],complete:true};
   case 'metadata':return {basic:{taskUuid:command.id,title:state.title,startTime:state.at,duration:5000}};
   case 'transcript':return {taskUuid:command.id,complete:true,paragraphList:state.paragraphs};
   case 'media':{state.mediaGate?.entered();await state.mediaGate?.wait;const path=join(scope.directory,'dws-runtime',command.output);mkdirSync(dirname(path),{recursive:true});writeFileSync(path,wave);return {ok:true,succeeded:1,results:[{taskUuid:command.id}]};}
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
 const waitTask=async(token:string,id:string)=>{
  let task:any;
  await waitForScopedState(async()=>{task=await checked(token,'/api/tasks/'+id);return !['waiting','running'].includes(task.state);},()=>JSON.stringify(task));
  assert.equal(task.state,'succeeded',JSON.stringify(task));return task;
 };
 const run=async(token:string,suffix:string,payload:Record<string,unknown>={})=>{const admitted=await checked(token,'/api/connectors/same-recordings/'+suffix,'POST',{operationId:randomUUID(),...payload});return waitTask(token,admitted.id);};
 const configure=async(token:string,domain:string,value:unknown)=>checked(token,'/api/configuration/'+domain,'PUT',{revision:(await checked(token,'/api/configuration')).revision,value});
 const page=(token:string)=>checked(token,'/api/connectors/same-recordings/recordings?limit=10');
 const heads=async(token:string)=>{
  const source=(await page(token)).sourceId;assert.ok(source);
  return (await checked(token,'/api/source-items?'+new URLSearchParams({sourceId:source,limit:'100'}))).items as any[];
 };
 const materials=async(token:string)=>(await checked(token,'/api/materials?'+new URLSearchParams({sourceId:(await page(token)).sourceId,limit:'100'}))).items as any[];
 const projection=async(token:string,unsupported=false)=>{
  const expected=(await heads(token)).filter(item=>!unsupported&&item.externalId===recordingId+':export');let current:any[]=[];
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
  await configure(actor.token,'memory',{...defaultMemorySettings(),automatic:withIntake});
  if(modelUrl)await configure(actor.token,'models',{profiles:[{id:'generated-chat',name:'Generated recording history',settings:{...defaultModelSettings(),provider:'custom',protocol:'anthropic-messages',model:'generated-recording',baseUrl:modelUrl,apiKey:actor===f.a?'GENERATED_A_KEY':'GENERATED_B_KEY',headers:{},extraBody:{}}}],selections:{chat:{kind:'personal',id:'generated-chat'}}});
  await checked(actor.token,'/api/connectors/same-recordings','PUT',{expectedRevision:(await checked(actor.token,'/api/connectors')).revision,connection:{provider:'dingtalk-recordings',autoSync:false}});
  await checked(actor.token,'/api/connectors/same-recordings/enable','POST',{expectedRevision:(await checked(actor.token,'/api/plugins')).revision});
  await run(actor.token,'operations',{operation:'connect'});
  const saved=await run(actor.token,'operations',{operation:'select',payload:{enabled:true,start:'2026-10-16T00:00:00Z',end:'2026-10-17T00:00:00Z',autoSync:false,backupAudio:true}});
  assert.equal((await waitTask(actor.token,saved.result.syncTask.id)).result.failed,0);
  await projection(actor.token);
 }
 return {f,states,checked,request,run,page,heads,materials,projection,originals,bytes,calls,ask,modelRequests};
}

export {VendorState,recordingId,initial,fixture};
