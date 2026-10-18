import type {TestContext} from 'node:test';
import {createServer} from 'node:http';
import {randomUUID} from 'node:crypto';
import {recordingFixture} from '../../web/test/fixtures/recordings.js';
import {waitForScopedState} from '../../server/test/fixtures/scoped-process.js';

/** Generated transport fixtures enter the real scoped connection/task/recording
 * flow. Native reads consume persisted phase receipts after an actual restart. */
const cleanup:Array<()=>unknown>=[],{f,state,calls}=await recordingFixture({after:(work:()=>unknown)=>cleanup.push(work)} as unknown as TestContext);
state.count=32;state.audioFails=false;
state.phaseFailures={
 'recording-00':{metadata:{category:'blocked',code:'generated_metadata_blocked'}},
 'recording-01':{transcript:{category:'transient',code:'generated_transcript_pending',retryAfterMs:3600000},media:{category:'transient',code:'generated_audio_pending',retryAfterMs:7200000}},
 'recording-02':{media:{category:'permanent',code:'generated_media_failed'}},
};
const checked=async(token:string,path:string,method='GET',payload?:unknown)=>{const response=await f.request(token,path,method,payload);if(response.statusCode!==200)throw Error(path+': '+response.statusCode+' '+response.body);return response.json();};
async function command(token:string,suffix:string,body:Record<string,unknown>){
 const admitted=await checked(token,'/api/connectors/same-recorder/'+suffix,'POST',{operationId:randomUUID(),...body});let task:any;
 await waitForScopedState(async()=>{task=await checked(token,'/api/tasks/'+admitted.id);return !['waiting','running'].includes(task.state);},()=>'Generated recording phase fixture did not settle');
 if(task.state!=='succeeded')throw Error('Generated recording phase task '+JSON.stringify(task));
}
const selection={enabled:true,start:'2026-09-01T00:00:00Z',end:'2026-10-17T00:00:00Z',autoSync:false,backupAudio:true};
await command(f.a.token,'operations',{operation:'connect',payload:{}});
await command(f.a.token,'operations',{operation:'select',payload:selection});
await command(f.a.token,'sync',{});
state.phaseFailures={};state.count=1;
await command(f.b.token,'operations',{operation:'connect',payload:{}});
await command(f.b.token,'operations',{operation:'select',payload:selection});
await command(f.b.token,'sync',{});
await f.restart();
const control=createServer((request,response)=>{
 if(request.method==='POST'&&request.url==='/generated/recording-calls'){response.setHeader('content-type','application/json');response.end(JSON.stringify({calls}));}
 else {response.statusCode=404;response.end();}
});
await new Promise<void>(resolve=>control.listen(0,'127.0.0.1',resolve));const controlAddress=control.address();if(!controlAddress||typeof controlAddress==='string')throw Error('No generated recording control listener');
const address=await f.host.app.listen({host:'127.0.0.1',port:0});
process.stdout.write(JSON.stringify({address,controlAddress:'http://127.0.0.1:'+controlAddress.port,a:f.a,b:f.b,admin:f.admin,password:'Generated-M13-archive-only-01',pid:process.pid})+'\n');
let closing=false;async function close(){if(closing)return;closing=true;for(const work of cleanup.reverse())await work();control.closeAllConnections();await new Promise<void>(resolve=>control.close(()=>resolve()));process.exit(0);}
process.on('SIGTERM',()=>void close());process.on('SIGINT',()=>void close());
