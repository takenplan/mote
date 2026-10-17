import type {TestContext} from 'node:test';
import {createServer} from 'node:http';
import {mkdirSync,writeFileSync} from 'node:fs';
import {join,dirname} from 'node:path';
import {randomUUID} from 'node:crypto';
import {scopedCaptureFixture} from '../../server/test/fixtures/scoped-capture-host.js';
import {waitForScopedState} from '../../server/test/fixtures/scoped-process.js';
import {defaultProcessingSettings} from '../../server/src/scope/processing-schema.js';
import {defaultModelSettings} from '../../server/src/model-settings.js';

// Original recording providers/M05/M03/M06. Only external DWS and ASR I/O is
// generated; no vendor account, native CLI installation or live model is used.
const cleanup:Array<()=>unknown>=[],state={failAudio:true};
const wave=Buffer.alloc(80044);wave.write('RIFF');wave.writeUInt32LE(wave.length-8,4);wave.write('WAVEfmt ',8);wave.writeUInt32LE(16,16);wave.writeUInt16LE(1,20);wave.writeUInt16LE(1,22);wave.writeUInt32LE(8000,24);wave.writeUInt32LE(16000,28);wave.writeUInt16LE(2,32);wave.writeUInt16LE(16,34);wave.write('data',36);wave.writeUInt32LE(wave.length-44,40);
const f=await scopedCaptureFixture({after:(work:()=>unknown)=>cleanup.push(work)} as unknown as TestContext,{connectorTransports:{dingtalk:scope=>async command=>{
 switch(command.kind){
  case 'status':return {authenticated:true,corp_id:'same-corp',user_id:'same-user'};
  case 'search':return {data:{minutes:[{taskUuid:'same-recording'}],complete:true}};
  case 'metadata':return {basic:{taskUuid:command.id,title:'Generated recording '+scope.userId,startTime:1792108800000,duration:5000}};
  case 'transcript':return {taskUuid:command.id,complete:true,paragraphList:[{paragraph:'GENERATED_VENDOR_TEXT_'+scope.userId,nickName:'Speaker'}]};
  case 'media':if(state.failAudio)throw Error('GENERATED_PRIVATE_MEDIA_ERROR');{const path=join(scope.directory,'dws-runtime',command.output);mkdirSync(dirname(path),{recursive:true});writeFileSync(path,wave);return {ok:true,succeeded:1,results:[{taskUuid:command.id}]};}
  default:throw Error('Unexpected generated recording I/O '+command.kind);
 }
}}});
const asr=createServer((request,response)=>{void(async()=>{for await(const _ of request){}const actor=String(request.headers.authorization).includes('GENERATED_B')?f.b:f.a;response.setHeader('content-type','application/json');response.setHeader('X-Mote-Execution','local');response.end(JSON.stringify({durationMs:5000,segments:[{startMs:0,endMs:5000,text:'GENERATED_AUDIO_TEXT_'+actor.userId,speaker:'SPEAKER_0',uncertain:false,overlap:false}],coverage:'full',engine:'generated-recording-asr'}));})().catch(()=>response.destroy());});
await new Promise<void>(resolve=>asr.listen(0,'127.0.0.1',resolve));const asrAddress=asr.address();if(!asrAddress||typeof asrAddress==='string')throw Error('No generated ASR listener');
const checked=async(token:string,path:string,method='GET',payload?:unknown)=>{const r=await f.request(token,path,method,payload);if(r.statusCode!==200)throw Error(path+': '+r.statusCode+' '+r.body);return r.json();};
const run=async(token:string,suffix:string,body:Record<string,unknown>={})=>{const task=await checked(token,'/api/connectors/same-recordings/'+suffix,'POST',{operationId:randomUUID(),...body});let result:any;await waitForScopedState(async()=>{result=await checked(token,'/api/tasks/'+task.id);return !['waiting','running'].includes(result.state);},()=>'Generated recording preparation not settled');if(result.state!=='succeeded')throw Error('Generated recording task '+result.state);return result;};
await checked(f.admin.token,'/api/admin/connectors/dingtalk-recordings/install','POST',{expectedRevision:f.host.plugins!.catalog.revision(),operationId:randomUUID()});
await waitForScopedState(async()=>(await f.host.plugins!.catalog.view()).packages.some(value=>value.id.startsWith('mote.connector.dingtalk-recordings@')&&value.state==='installed'),()=>'Bundled generated recording package not ready');
for(const[actor,label]of [[f.a,'A'],[f.b,'B']] as const){
 let view=await checked(actor.token,'/api/configuration');
 await checked(actor.token,'/api/configuration/processing','PUT',{revision:view.revision,value:{...defaultProcessingSettings(),automatic:true,summarize:false,semanticTurns:false,understandingEnabled:false,audioProcessor:'audio.http'}});
 view=await checked(actor.token,'/api/configuration');const memory=view.domains.find((domain:any)=>domain.id==='memory').effective;
 await checked(actor.token,'/api/configuration/memory','PUT',{revision:view.revision,value:{...memory,automatic:false,integration:false,lifecycle:{...memory.lifecycle,insights:{...memory.lifecycle.insights,enabled:false},working:{...memory.lifecycle.working,enabled:false},consolidation:{...memory.lifecycle.consolidation,enabled:false}}}});
 view=await checked(actor.token,'/api/configuration');await checked(actor.token,'/api/configuration/models','PUT',{revision:view.revision,value:{profiles:[{id:'generated-asr',name:'Generated ASR',settings:{...defaultModelSettings(),provider:'custom',protocol:'mote-media',baseUrl:'http://127.0.0.1:'+asrAddress.port+'/transcribe',model:'generated-recording-asr',apiKey:'GENERATED_'+label}}],selections:{asr:{kind:'personal',id:'generated-asr'}}}});
 view=await checked(actor.token,'/api/connectors');await checked(actor.token,'/api/connectors/same-recordings','PUT',{expectedRevision:view.revision,connection:{provider:'dingtalk-recordings',autoSync:false}});
 const plugins=await checked(actor.token,'/api/plugins');await checked(actor.token,'/api/connectors/same-recordings/enable','POST',{expectedRevision:plugins.revision});
}
await run(f.b.token,'operations',{operation:'connect'});await run(f.b.token,'operations',{operation:'select',payload:{enabled:true,start:'2026-10-16T00:00:00.000Z',end:'2026-10-17T00:00:00.000Z',autoSync:false,backupAudio:true}});await run(f.b.token,'sync');
const commands:Array<{actor:string;path:string}>=[];
f.host.app.server.on('request',request=>{if(request.method==='POST'&&request.url?.startsWith('/api/connectors/'))commands.push({actor:request.headers.authorization==='Bearer '+f.a.token?'a':request.headers.authorization==='Bearer '+f.b.token?'b':'other',path:request.url});});
const control=createServer((request,response)=>{
 if(request.method==='POST'&&request.url==='/generated/recover-recording-audio'){state.failAudio=false;response.setHeader('content-type','application/json');response.end('{"ready":true}');}
 else if(request.method==='POST'&&request.url==='/generated/recording-commands'){response.setHeader('content-type','application/json');response.end(JSON.stringify({commands}));}
 else {response.statusCode=404;response.end();}
});
await new Promise<void>(resolve=>control.listen(0,'127.0.0.1',resolve));const controlAddress=control.address();if(!controlAddress||typeof controlAddress==='string')throw Error('No generated control listener');
const address=await f.host.app.listen({host:'127.0.0.1',port:0});process.stdout.write(JSON.stringify({address,controlAddress:'http://127.0.0.1:'+controlAddress.port,a:f.a,b:f.b,admin:f.admin,password:'Generated-M13-archive-only-01',pid:process.pid})+'\n');
let closing=false;async function close(){if(closing)return;closing=true;for(const work of cleanup.reverse())await work();control.closeAllConnections();asr.closeAllConnections();await Promise.all([new Promise<void>(resolve=>control.close(()=>resolve())),new Promise<void>(resolve=>asr.close(()=>resolve()))]);process.exit(0);}
process.on('SIGTERM',()=>void close());process.on('SIGINT',()=>void close());
