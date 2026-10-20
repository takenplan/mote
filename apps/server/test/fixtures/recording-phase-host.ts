import assert from 'node:assert/strict';
import type {TestContext} from 'node:test';
import {randomUUID,createHash} from 'node:crypto';
import {mkdirSync,writeFileSync} from 'node:fs';
import {dirname,join} from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';
import {scopedCaptureFixture} from './scoped-capture-host.js';
import {ExecutionFailure} from '../../src/execution-engine.js';
import {defaultProcessingSettings} from '../../src/scope/processing-schema.js';
import {defaultMemorySettings} from '../../src/scope/memory-schema.js';
import type {PerformanceFailureObservation} from './performance-failure-observation.js';
export const recordingRange={enabled:true,start:'2026-10-15T00:00:00Z',end:'2026-10-17T00:00:00Z',autoSync:false,backupAudio:true};
export function barrier(){let release!:()=>void;const wait=new Promise<void>(resolve=>release=resolve);return {wait,release};}
export async function until(read:()=>boolean|Promise<boolean>,message:string,ms=6000){const end=performance.now()+ms;while(!await read()){assert.ok(performance.now()<end,message);await delay(10);}}
/** All account, selection, Files, M03/M06 and M05 work is production code. */
export async function recordingPhaseHost(t:TestContext,processing=false,observation?:PerformanceFailureObservation){
 observation?.phase('recording-fixture-setup');
 const state={ids:['r1'],pages:false,heldUser:'',mediaGate:undefined as ReturnType<typeof barrier>|undefined,mediaEntered:false,discoveryGate:undefined as ReturnType<typeof barrier>|undefined,discoveryEntered:false,discoveryFail:false,gateAccount:undefined as ReturnType<typeof barrier>|undefined,accountEntered:false,metadataSeen:false,postMetadataAccounts:0,failTranscript:0,retryAfterMs:1000,activeMedia:0,maxMedia:0};
 const calls:{user:string;kind:string;id?:string;cursor?:string}[]=[],wave=Buffer.alloc(48);wave.write('RIFF');wave.writeUInt32LE(40,4);wave.write('WAVEfmt ',8);wave.writeUInt32LE(16,16);wave.writeUInt16LE(1,20);wave.writeUInt16LE(1,22);wave.writeUInt32LE(8000,24);wave.writeUInt32LE(16000,28);wave.writeUInt16LE(2,32);wave.writeUInt16LE(16,34);wave.write('data',36);wave.writeUInt32LE(4,40);
 t.after(()=>{observation?.cleanupStart();state.mediaGate?.release();state.discoveryGate?.release();state.gateAccount?.release();});
 const f=await scopedCaptureFixture(t,{connectorTransports:{dingtalk:scope=>async(command)=>{
  calls.push({user:scope.userId,kind:command.kind,...('id' in command?{id:command.id}:{}),...(command.kind==='search'&&command.cursor?{cursor:command.cursor}:{})});
  observation?.event('recording-command',{owner:observation.owner(scope.userId),kind:command.kind,...('id' in command?{recordingId:command.id}:{}),...(command.kind==='search'&&command.cursor?{cursor:command.cursor}:{})});
  const held=scope.userId===state.heldUser;
  if(command.kind==='status'){if(held&&state.gateAccount&&state.metadataSeen&&++state.postMetadataAccounts>=2){state.accountEntered=true;await state.gateAccount.wait;}return {authenticated:true,corp_id:'same-corp',user_id:'same-vendor'};}
  if(command.kind==='search'){
   if(held&&state.discoveryGate){state.discoveryEntered=true;await state.discoveryGate.wait;}
   if(held&&state.discoveryFail)throw new ExecutionFailure('permanent','generated_discovery_failed');
   return {data:{minutes:(state.pages&&command.cursor?['r3']:state.ids).map(taskUuid=>({taskUuid})),complete:!state.pages||Boolean(command.cursor)},...(state.pages&&!command.cursor?{meta:{pagination:{next_token:'page-2'}}}:{})};
  }
  if(command.kind==='metadata'){if(held)state.metadataSeen=true;return {basic:{taskUuid:command.id,title:'GENERATED_'+scope.userId+'_'+command.id,startTime:Date.parse('2026-10-16T01:00:00Z'),duration:5000}};}
  if(command.kind==='transcript'){if(held&&state.failTranscript-->0)throw new ExecutionFailure('transient','generated_transcript_pending',state.retryAfterMs);return {taskUuid:command.id,complete:true,paragraphList:[{paragraph:'GENERATED_TEXT_'+scope.userId+'_'+command.id,nickName:'Generated speaker'}]};}
  if(command.kind==='media'){state.activeMedia++;state.maxMedia=Math.max(state.maxMedia,state.activeMedia);try{if(held&&command.id==='r1'&&state.mediaGate){state.mediaEntered=true;observation?.event('recording-media-held',{owner:observation.owner(scope.userId),recordingId:command.id});await state.mediaGate.wait;}const path=join(scope.directory,'dws-runtime',command.output);mkdirSync(dirname(path),{recursive:true});writeFileSync(path,wave);return {ok:true,succeeded:1,results:[{taskUuid:command.id}]};}finally{state.activeMedia--;observation?.event('recording-media-finished',{owner:observation.owner(scope.userId),recordingId:command.id});}}
  throw Error('Unexpected generated command '+command.kind);
 }}});
 observation?.bind(()=>({directory:f.directory,users:[{id:f.a.userId,alias:'a'},{id:f.b.userId,alias:'b'}],connectionId:'recorder',isActiveTask:id=>f.host.execution!.engine.isActiveStep(id),counts:()=>({calls:calls.length,mediaEntered:Number(state.mediaEntered),mediaGatePresent:Number(Boolean(state.mediaGate)),heldOwnerIsA:Number(state.heldUser===f.a.userId),activeMedia:state.activeMedia,maxMedia:state.maxMedia,discoveryEntered:Number(state.discoveryEntered)})}));
 if(observation)t.after(()=>observation.cleanupEnd());
 observation?.phase('recording-fixture-ready');
 const checked=async(token:string|undefined,path:string,method:any='GET',payload?:unknown)=>{const response=await f.request(token,path,method,payload);assert.equal(response.statusCode,200,path+' '+response.body);return response.json();};
 const waitTask=async(token:string,id:string)=>{let task:any;await until(async()=>{await f.host.execution!.tick();task=await checked(token,'/api/tasks/'+id);return !['waiting','running'].includes(task.state);},'Task did not settle: '+id,12000);return task;};
 const operation=async(token:string,operation:string,payload:Record<string,unknown>={})=>{const task=await checked(token,'/api/connectors/recorder/operations','POST',{operation,payload,operationId:randomUUID()});const value=await waitTask(token,task.id);assert.equal(value.state,'succeeded',JSON.stringify(value));return value;};
 const page=(token:string)=>checked(token,'/api/connectors/recorder/recordings?limit=100');
 const count=(user:string,kind:string,id?:string)=>calls.filter(call=>call.user===user&&call.kind===kind&&(id===undefined||call.id===id)).length;
 await checked(f.admin.token,'/api/admin/connectors/dingtalk-recordings/install','POST',{expectedRevision:f.host.plugins!.catalog.revision(),operationId:randomUUID()});
 for(const actor of [f.a,f.b]){
  let view=await checked(actor.token,'/api/configuration');await checked(actor.token,'/api/configuration/processing','PUT',{revision:view.revision,value:{...defaultProcessingSettings(),automatic:processing,understandingEnabled:false,summarize:false,semanticTurns:false}});
  view=await checked(actor.token,'/api/configuration');await checked(actor.token,'/api/configuration/memory','PUT',{revision:view.revision,value:{...defaultMemorySettings(),automatic:false}});
  await checked(actor.token,'/api/connectors/recorder','PUT',{expectedRevision:(await checked(actor.token,'/api/connectors')).revision,connection:{provider:'dingtalk-recordings',autoSync:true,syncIntervalMs:60000}});
  await checked(actor.token,'/api/connectors/recorder/enable','POST',{expectedRevision:(await checked(actor.token,'/api/plugins')).revision});await operation(actor.token,'connect');
 }
 state.heldUser=f.a.userId;
 const select=(token:string,selection:Record<string,unknown>=recordingRange)=>operation(token,'select',selection);
 const settle=async(token:string)=>until(async()=>{const p=await page(token);return p.items.length>0&&p.items.every((item:any)=>!['waiting','running'].includes(item.metadata.state)&&!['waiting','running'].includes(item.transcript.state)&&!['waiting','running'].includes(item.audio.state));},'Recording phases did not settle',12000);
 const ordinaryAudio=async(token:string)=>{
  const p=await page(token),capture=p.items.find((item:any)=>item.id==='r1').audioCaptureId,head=await checked(token,'/api/ingress/sources/'+p.sourceId+'/head?externalId=r1%3Aaudio'),sha256=createHash('sha256').update(wave).digest('hex');
  const upload=await checked(token,'/api/ingress/sources/'+p.sourceId+'/uploads','POST',{batchId:randomUUID(),revision:{sourceId:p.sourceId,previousRevision:head.revision,relativePath:'generated.wav',sizeBytes:wave.length,sha256,item:{externalId:'r1:audio',revision:randomUUID(),observedAt:new Date(Date.now()+1000).toISOString(),title:'Generated owner audio',text:'',kind:'file',layer:'original',mimeType:'audio/wav'}}});
  await checked(token,'/api/ingress/uploads/'+upload.id+'/parts/0','PUT',{bytes:wave.toString('base64'),checksum:sha256});return (await checked(token,'/api/ingress/uploads/'+upload.id+'/commit','POST',{})).captures[0].id as string;
 };
 return {f,state,calls,checked,waitTask,operation,page,count,select,settle,ordinaryAudio};
}
