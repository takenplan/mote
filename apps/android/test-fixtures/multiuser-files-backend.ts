import type {TestContext} from 'node:test';
import {createServer} from 'node:http';
import {scopedFilesFixture} from '../../server/test/fixtures/scoped-files.js';
import {waitForScopedState} from '../../server/test/fixtures/scoped-process.js';
import {defaultModelSettings} from '../../server/src/model-settings.js';
import {defaultProcessingSettings} from '../../server/src/scope/processing-schema.js';

// The production M03/M04/M05/M06 host processes an actual generated WAV. Only
// ASR transport is substituted; no real recording, model or account is accessed.
const literalSpeakerPrefix=process.argv.includes('--literal-speaker-prefix');
const cleanup:Array<()=>unknown>=[];
const f=await scopedFilesFixture({after:(callback:()=>unknown)=>cleanup.push(callback)} as unknown as TestContext);
const retries:Array<{actor:string;body:unknown;status:number;taskId?:string}>=[];
let dropRetryAck=false;
// Record only generated account labels and retry metadata. The HTTP handler has
// already admitted the real M05 task before its successful reply is dropped.
f.host.app.addHook('onSend',async(request,reply,payload)=>{
 if(request.method==='POST'&&/^\/api\/files\/[^/]+\/retry$/.test(request.url)){
  const actor=request.headers.authorization==='Bearer '+f.a.token?'a':request.headers.authorization==='Bearer '+f.b.token?'b':'other';
  let taskId:string|undefined;try{taskId=JSON.parse(String(payload)).taskId;}catch{}
  retries.push({actor,body:request.body,status:reply.statusCode,...(taskId?{taskId}:{})});
  if(dropRetryAck&&actor==='a'&&reply.statusCode===200)reply.raw.destroy();
 }
 return payload;
});
const control=createServer((request,response)=>{void(async()=>{
 for await(const _ of request){}
 if(request.url==='/generated/drop-file-retry-ack')dropRetryAck=true;
 else if(request.url==='/generated/release-file-retry-ack')dropRetryAck=false;
 else if(request.url!=='/generated/file-retries'){response.statusCode=404;response.end();return;}
 response.setHeader('content-type','application/json');response.end(JSON.stringify({retries,dropRetryAck}));
})().catch(()=>response.destroy());});
await new Promise<void>(resolve=>control.listen(0,'127.0.0.1',resolve));
const controlAddress=control.address();if(!controlAddress||typeof controlAddress==='string')throw Error('Missing generated control address');
cleanup.push(()=>{control.closeAllConnections();return new Promise<void>(resolve=>control.close(()=>resolve()));});
const asr=createServer((req,res)=>{void(async()=>{for await(const _ of req){}const text=(literalSpeakerPrefix?'[SPEAKER_0] ':'')+(String(req.headers.authorization).includes('GENERATED_B')?'Generated B raw recording':'Generated A raw recording');res.setHeader('Content-Type','application/json');res.setHeader('X-Mote-Execution','local');res.end(JSON.stringify({durationMs:1000,segments:[{startMs:0,endMs:1000,text,speaker:'SPEAKER_0',uncertain:true,overlap:false}],coverage:'full',engine:'generated-native-files'}));})().catch(()=>res.destroy());});
await new Promise<void>(resolve=>asr.listen(0,'127.0.0.1',resolve));
const address=asr.address();if(!address||typeof address==='string')throw Error('Missing generated ASR address');
const wave=Buffer.alloc(48);wave.write('RIFF');wave.writeUInt32LE(40,4);wave.write('WAVEfmt ',8);wave.writeUInt32LE(16,16);wave.writeUInt16LE(1,20);wave.writeUInt16LE(1,22);wave.writeUInt32LE(8000,24);wave.writeUInt32LE(16000,28);wave.writeUInt16LE(2,32);wave.writeUInt16LE(16,34);wave.write('data',36);wave.writeUInt32LE(4,40);
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
let closing=false;async function close(){if(closing)return;closing=true;for(const work of cleanup.reverse())await work();asr.closeAllConnections();await new Promise<void>(resolve=>asr.close(()=>resolve()));process.exit(0);}
process.on('SIGINT',()=>void close());process.on('SIGTERM',()=>void close());
