import type {TestContext} from 'node:test';
import {createServer} from 'node:http';
import {scopedFilesFixture} from '../../server/test/fixtures/scoped-files.js';
import {waitForScopedState} from '../../server/test/fixtures/scoped-process.js';
import {defaultModelSettings} from '../../server/src/model-settings.js';
import {defaultProcessingSettings} from '../../server/src/scope/processing-schema.js';
import type {FastifyRequest} from 'fastify';
import {requestActor,type FixtureActor} from './request-actor.js';
import {bytesHash} from '../../server/src/scope/originals.js';

// The production M03/M04/M05/M06 host processes an actual generated WAV. Only
// ASR transport is substituted; no real recording, model or account is accessed.
const literalSpeakerPrefix=process.argv.includes('--literal-speaker-prefix');
const cleanup:Array<()=>unknown>=[];
const retries:Array<{actor:string;body:unknown;status:number;taskId?:string}>=[];
const deletes:Array<{actor:string;body:unknown;status:number}>=[];
const catalogReads:Array<{actor:string;method:string;path:string}>=[];
const parity:{metadataCaptureId?:string;historyCaptureId?:string}={};
let dropRetryAck=false,dropDeleteAck=false,holdDelete=false,deleteEntered=false;
let releaseDelete:(()=>void)|undefined;
let actors:{a:{userId:string};b:{userId:string}};
const requestActors=new WeakMap<FastifyRequest,FixtureActor>();
let holdNextAsr=false,dropNextAsr=false,asrHeld=false,releaseAsr:(()=>void)|undefined;
const asrCalls:string[]=[];
// Record only generated account labels and retry metadata. The HTTP handler has
// already admitted the real M05 task before its successful reply is dropped.
const f=await scopedFilesFixture({after:(callback:()=>unknown)=>cleanup.push(callback)} as unknown as TestContext,host=>{
host.app.addHook('preHandler',async request=>{
 const path=request.url.split('?')[0];
 if(path==='/api/files'||path.startsWith('/api/files/')||path.startsWith('/api/ingress/originals/')){
  const actor=await requestActor(request,host,actors);requestActors.set(request,actor);catalogReads.push({actor,method:request.method,path});
 }
 if(!/^\/api\/files\/[^/]+(?:\/(?:retry|cancel))?$/.test(request.url.split('?')[0]))return;
 const actor=await requestActor(request,host,actors);requestActors.set(request,actor);
 if(holdDelete&&request.method==='DELETE'&&/^\/api\/files\/[^/]+$/.test(request.url)&&actor==='a'){holdDelete=false;deleteEntered=true;await new Promise<void>(resolve=>{releaseDelete=resolve;});releaseDelete=undefined;}
});
host.app.addHook('onError',async(request,_reply,error)=>{if(request.method==='DELETE'&&request.url.startsWith('/api/files/'))process.stderr.write(String(error.stack)+'\n');});
host.app.addHook('onSend',async(request,reply,payload)=>{
 if(request.method==='DELETE'&&/^\/api\/files\/[^/]+$/.test(request.url)||request.method==='POST'&&/^\/api\/files\/[^/]+\/cancel$/.test(request.url)){
  let error:string|undefined;try{error=JSON.parse(String(payload)).error;}catch{}
  process.stderr.write(JSON.stringify({type:'generated-file-control',method:request.method,path:request.url,status:reply.statusCode,...(error?{error}:{})})+'\n');
 }
 if(request.method==='DELETE'&&/^\/api\/files\/[^/]+$/.test(request.url)){
  const actor=requestActors.get(request)??'other';
  deletes.push({actor,body:request.body,status:reply.statusCode});
  if(dropDeleteAck&&actor==='a'&&reply.statusCode===200)reply.raw.destroy();
 }
 if(request.method==='POST'&&/^\/api\/files\/[^/]+\/retry$/.test(request.url)){
  const actor=requestActors.get(request)??'other';
  let taskId:string|undefined;try{taskId=JSON.parse(String(payload)).taskId;}catch{}
  retries.push({actor,body:request.body,status:reply.statusCode,...(taskId?{taskId}:{})});
  if(dropRetryAck&&actor==='a'&&reply.statusCode===200)reply.raw.destroy();
 }
 return payload;
});});
actors=f;
const control=createServer((request,response)=>{void(async()=>{
 for await(const _ of request){}
 if(request.url==='/generated/drop-file-retry-ack')dropRetryAck=true;
 else if(request.url==='/generated/release-file-retry-ack')dropRetryAck=false;
 else if(request.url==='/generated/drop-file-delete-ack')dropDeleteAck=true;
 else if(request.url==='/generated/release-file-delete-ack')dropDeleteAck=false;
 else if(request.url==='/generated/hold-file-delete-before-admission'){holdDelete=true;deleteEntered=false;}
 else if(request.url==='/generated/release-file-delete-before-admission')releaseDelete?.();
 else if(request.url==='/generated/recreate-file-source'){await f.checked(f.a.token,'/api/sources/same-source','DELETE',{});await f.checked(f.a.token,'/api/ingress/sources','POST',{id:'same-source',name:'Generated replacement files',kind:'local-files',deviceId:'same-device',platform:'import',retention:'archive'});await f.uploadBytes(f.a.token,'same-recording',wave,'audio/wav');}
 else if(request.url==='/generated/hold-next-asr')holdNextAsr=true;
 else if(request.url==='/generated/drop-next-asr')dropNextAsr=true;
 else if(request.url==='/generated/release-asr')releaseAsr?.();
 else if(request.url==='/generated/file-parity/setup-metadata')await setupMetadata();
 else if(request.url==='/generated/file-parity/setup-history')await setupHistory();
 else if(request.url==='/generated/file-parity/state'){}
 else if(request.url!=='/generated/file-retries'){response.statusCode=404;response.end();return;}
 response.setHeader('content-type','application/json');response.end(JSON.stringify({retries,deletes,dropRetryAck,dropDeleteAck,deleteEntered,asrHeld,asrCalls,...parity,catalogReads}));
})().catch(()=>response.destroy());});
await new Promise<void>(resolve=>control.listen(0,'127.0.0.1',resolve));
const controlAddress=control.address();if(!controlAddress||typeof controlAddress==='string')throw Error('Missing generated control address');
cleanup.push(()=>{control.closeAllConnections();return new Promise<void>(resolve=>control.close(()=>resolve()));});
const asr=createServer((req,res)=>{void(async()=>{for await(const _ of req){}const actor=String(req.headers.authorization).includes('GENERATED_B')?'B':'A';asrCalls.push(actor);if(actor==='A'&&dropNextAsr){dropNextAsr=false;res.destroy();return;}if(actor==='A'&&holdNextAsr){holdNextAsr=false;asrHeld=true;await new Promise<void>(resolve=>{releaseAsr=resolve;});asrHeld=false;releaseAsr=undefined;}const text=(literalSpeakerPrefix?'[SPEAKER_0] ':'')+'Generated '+actor+' raw recording';res.setHeader('Content-Type','application/json');res.setHeader('X-Mote-Execution','local');res.end(JSON.stringify({durationMs:1000,segments:[{startMs:0,endMs:1000,text,speaker:'SPEAKER_0',uncertain:true,overlap:false}],coverage:'full',engine:'generated-native-files'}));})().catch(()=>res.destroy());});
await new Promise<void>(resolve=>asr.listen(0,'127.0.0.1',resolve));
const address=asr.address();if(!address||typeof address==='string')throw Error('Missing generated ASR address');
const wave=Buffer.alloc(48);wave.write('RIFF');wave.writeUInt32LE(40,4);wave.write('WAVEfmt ',8);wave.writeUInt32LE(16,16);wave.writeUInt16LE(1,20);wave.writeUInt16LE(1,22);wave.writeUInt32LE(8000,24);wave.writeUInt32LE(16000,28);wave.writeUInt16LE(2,32);wave.writeUInt16LE(16,34);wave.write('data',36);wave.writeUInt32LE(4,40);
async function setupMetadata(){
 if(parity.metadataCaptureId)return;
 for(const [actor,label] of [[f.a,'A'],[f.b,'B']] as const){
  await f.checked(actor.token,'/api/ingress/sources','POST',{id:'parity-metadata',name:'Generated '+label+' reference source',kind:'local-files',deviceId:'same-device',platform:'import',retention:'reference'});
  const receipt=await f.checked(actor.token,'/api/ingress/sources/parity-metadata/items','POST',{batchId:'parity-metadata',items:[{externalId:'same-reference',revision:'r1',observedAt:'2026-10-17T00:00:00Z',title:'GENERATED_'+label+'_REFERENCE',text:'',kind:'file',layer:'reference',mimeType:'text/plain',document:{path:'parity/reference.txt'},metadata:{version:1,file:{sizeBytes:33}}}]});
  if(label==='A')parity.metadataCaptureId=receipt.captures[0].id;
 }
}
async function setupHistory(){
 if(parity.historyCaptureId)return;
 for(const [actor,label] of [[f.a,'A'],[f.b,'B']] as const){
  const sourceId='parity-history';await f.checked(actor.token,'/api/ingress/sources','POST',{id:sourceId,name:'Generated '+label+' archive source',kind:'local-files',deviceId:'same-device',platform:'import',retention:'archive'});
  const upload=await f.checked(actor.token,'/api/ingress/sources/'+sourceId+'/uploads','POST',{batchId:'parity-history-original',revision:{sourceId,previousRevision:null,relativePath:'parity/history.wav',sizeBytes:wave.length,sha256:bytesHash(wave),item:{externalId:'same-history',revision:'r1',observedAt:'2026-10-16T00:00:00Z',title:'GENERATED_'+label+'_HISTORICAL',text:'',kind:'file',layer:'original',mimeType:'audio/wav'}}});
  await f.checked(actor.token,'/api/ingress/uploads/'+upload.id+'/parts/0','PUT',{bytes:wave.toString('base64'),checksum:bytesHash(wave)});
  const receipt=(await f.checked(actor.token,'/api/ingress/uploads/'+upload.id+'/commit','POST',{})).captures[0];
  const task=await f.checked(actor.token,'/api/processing','POST',{originalRef:receipt.original.ref,operationId:'parity-history-process'});await waitForScopedState(async()=>(await f.checked(actor.token,'/api/tasks/'+task.id)).state==='succeeded',()=>'Generated historical extraction did not complete');
  const tombstone=await f.checked(actor.token,'/api/ingress/sources/'+sourceId+'/uploads','POST',{batchId:'parity-history-deleted',revision:{sourceId,previousRevision:'r1',relativePath:'parity/history.wav',sizeBytes:0,item:{externalId:'same-history',revision:'r2',observedAt:'2026-10-17T00:00:00Z',title:'GENERATED_'+label+'_HISTORICAL',text:'',kind:'file',layer:'original',mimeType:'audio/wav',deleted:true}}});await f.checked(actor.token,'/api/ingress/uploads/'+tombstone.id+'/commit','POST',{});
  if(label==='A')parity.historyCaptureId=receipt.id;
 }
}
const receipts=[];
for(const [actor,label] of [[f.a,'A'],[f.b,'B']] as const){
 let view=await f.checked(actor.token,'/api/configuration');
 await f.checked(actor.token,'/api/configuration/processing','PUT',{revision:view.revision,value:{...defaultProcessingSettings(),automatic:false,understandingEnabled:false,summarize:false,semanticTurns:false,audioProcessor:'audio.http'}});
 view=await f.checked(actor.token,'/api/configuration');
 await f.checked(actor.token,'/api/configuration/models','PUT',{revision:view.revision,value:{profiles:[{id:'generated-asr',name:'Generated ASR',settings:{...defaultModelSettings(),provider:'custom',protocol:'mote-media',baseUrl:'http://127.0.0.1:'+address.port+'/transcribe',model:'generated-files',apiKey:'GENERATED_'+label}}],selections:{asr:{kind:'personal',id:'generated-asr'}}}});
 const receipt=await f.uploadBytes(actor.token,'same-recording',wave,'audio/wav');receipts.push(receipt);
 const task=await f.checked(actor.token,'/api/processing','POST',{originalRef:receipt.original.ref,operationId:'same-native-files'});
 await waitForScopedState(async()=>(await f.checked(actor.token,'/api/tasks/'+task.id)).state==='succeeded',()=>'Generated native WAV extraction did not complete');
}
const server=await f.host.app.listen({host:'127.0.0.1',port:0});
process.stdout.write(JSON.stringify({address:server,controlAddress:'http://127.0.0.1:'+controlAddress.port,a:f.a,b:f.b,admin:f.admin,password:'Generated-joint-files-password',captureId:receipts[0].id,wave:wave.toString('base64'),pid:process.pid})+'\n');
let closing=false;async function close(){if(closing)return;closing=true;process.stderr.write(JSON.stringify({type:'generated-file-final',asrCalls,deletes:deletes.map(entry=>{const body=entry.body as {operationId?:string;originalGeneration?:number}|undefined;return {actor:entry.actor,status:entry.status,operationId:body?.operationId,originalGeneration:body?.originalGeneration};}),retries:retries.map(entry=>{const body=entry.body as {stage?:string;operationId?:string;confirmUnknown?:boolean};return {actor:entry.actor,status:entry.status,taskId:entry.taskId,stage:body.stage,operationId:body.operationId,confirmUnknown:body.confirmUnknown};})})+'\n');releaseAsr?.();releaseDelete?.();for(const work of cleanup.reverse())await work();asr.closeAllConnections();await new Promise<void>(resolve=>asr.close(()=>resolve()));process.exit(0);}
process.on('SIGINT',()=>void close());process.on('SIGTERM',()=>void close());
