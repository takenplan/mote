import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {mkdirSync,writeFileSync} from 'node:fs';
import {dirname,join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {defaultModelSettings} from '../src/model-settings.js';
import {scopedCaptureFixture} from './fixtures/scoped-capture-host.js';
import {waitForScopedState} from './fixtures/scoped-process.js';
import {defaultProcessingSettings} from '../src/scope/processing-schema.js';
import {bytesHash} from '../src/scope/originals.js';
import type {IngressHost} from '../src/scope/ingress.js';

function tarEntries(bytes:Buffer){const tar=gunzipSync(bytes),entries=new Map<string,Buffer>();for(let offset=0;offset+512<=tar.length&&tar[offset]!==0;){const name=tar.subarray(offset,offset+100).toString().replace(/\0.*$/s,''),length=parseInt(tar.subarray(offset+124,offset+136).toString().replace(/\0.*$/s,''),8);entries.set(name,tar.subarray(offset+512,offset+512+length));offset+=512+Math.ceil(length/512)*512;}return entries;}

test('recording backups remain saved playable originals without automatic ASR, including empty/unsupported exports and restart',async t=>{
 const wave=Buffer.alloc(48);wave.write('RIFF');wave.writeUInt32LE(40,4);wave.write('WAVEfmt ',8);wave.writeUInt32LE(16,16);wave.writeUInt16LE(1,20);wave.writeUInt16LE(1,22);wave.writeUInt32LE(8000,24);wave.writeUInt32LE(16000,28);wave.writeUInt16LE(2,32);wave.writeUInt16LE(16,34);wave.write('data',36);wave.writeUInt32LE(4,40);
 const asrCalls:string[]=[];
 const worker=createServer(async(req,res)=>{const parts:Buffer[]=[];for await(const part of req)parts.push(Buffer.from(part));assert.deepEqual(Buffer.concat(parts),wave);asrCalls.push(String(req.headers.authorization));res.setHeader('Content-Type','application/json');res.setHeader('X-Mote-Execution','local');res.end(JSON.stringify({durationMs:1,segments:[{startMs:0,endMs:1,text:'GENERATED_EXPLICIT_ASR'}],coverage:'full',engine:'generated-backup-regression'}));});
 await new Promise<void>(resolve=>worker.listen(0,'127.0.0.1',resolve));t.after(()=>new Promise<void>(resolve=>worker.close(()=>resolve())));const address=worker.address();assert.ok(address&&typeof address!=='string');
 const vendorCalls:string[]=[];
 const f=await scopedCaptureFixture(t,{connectorTransports:{dingtalk:scope=>async command=>{
  vendorCalls.push(scope.userId+':'+command.kind);
  switch(command.kind){
   case 'status':return {authenticated:true,corp_id:'generated-corp',user_id:'generated-user'};
   case 'search':return {minutes:['spoken','empty','unsupported'].map(taskUuid=>({taskUuid})),complete:true};
   case 'metadata':return {basic:{taskUuid:command.id,title:'Generated '+command.id,startTime:1792108800000,duration:5000}};
   case 'transcript':return {taskUuid:command.id,complete:true,paragraphList:command.id==='empty'?[]:command.id==='unsupported'?[{unknown:'generated unsupported vendor export'}]:[{paragraph:'GENERATED_VENDOR_TRANSCRIPT',nickName:'Speaker'}]};
   case 'media':{const path=join(scope.directory,'dws-runtime',command.output);mkdirSync(dirname(path),{recursive:true});writeFileSync(path,wave);return {ok:true,succeeded:1,results:[{taskUuid:command.id}]};}
   default:throw Error('Unexpected generated vendor operation '+command.kind);
  }
 }}});
 const checked=async(token:string,path:string,method='GET',payload?:unknown)=>{const response=await f.request(token,path,method,payload);assert.equal(response.statusCode,200,response.body);return response.json();};
 const configure=async(token:string,domain:string,value:unknown)=>checked(token,'/api/configuration/'+domain,'PUT',{revision:(await checked(token,'/api/configuration')).revision,value});
 const run=async(token:string,suffix:string,payload:Record<string,unknown>={})=>{const admitted=await checked(token,'/api/connectors/recordings/'+suffix,'POST',{operationId:randomUUID(),...payload});let result:any;await waitForScopedState(async()=>{result=await checked(token,'/api/tasks/'+admitted.id);return !['waiting','running'].includes(result.state);},()=>'Generated recording command did not finish');assert.equal(result.state,'succeeded',JSON.stringify(result));return result;};
 await checked(f.admin.token,'/api/admin/connectors/dingtalk-recordings/install','POST',{expectedRevision:f.host.plugins!.catalog.revision(),operationId:randomUUID()});
 const audio=(userId:string)=>f.read(db=>db.prepare("SELECT r.id,r.capture_id FROM ig_originals r JOIN mp_original_formats f ON f.user_id=r.user_id AND f.original_id=r.id WHERE r.user_id=? AND f.format='recording-audio-backup' ORDER BY r.id").all(userId));
 const assertNoAutomaticAudio=(userId:string)=>f.read(db=>{const backups=audio(userId);assert.equal(backups.length,3);for(const row of backups)assert.equal(db.prepare("SELECT count(*) n FROM user_tasks u JOIN execution_steps e ON e.user_id=u.user_id AND e.id=u.task_id WHERE u.user_id=? AND e.kind LIKE 'processing.%' AND json_extract(u.input,'$.originalRef')=?").get(userId,'original:'+row.id)!.n,0,'backup intake must not even admit an automatic coordinator');});
 for(const actor of [f.a,f.b]){
  await configure(actor.token,'models',{profiles:[{id:'asr',name:'Generated available ASR',settings:{...defaultModelSettings(),provider:'custom',protocol:'mote-media',baseUrl:'http://127.0.0.1:'+address.port+'/transcribe',model:'generated-asr',apiKey:'GENERATED_'+actor.userId}}],selections:{asr:{kind:'personal',id:'asr'}}});
  await configure(actor.token,'processing',{...defaultProcessingSettings(),automatic:true,understandingEnabled:false,summarize:false,semanticTurns:false,audioProcessor:'audio.http'});
  await checked(actor.token,'/api/connectors/recordings','PUT',{expectedRevision:(await checked(actor.token,'/api/connectors')).revision,connection:{provider:'dingtalk-recordings',autoSync:false}});
  await checked(actor.token,'/api/connectors/recordings/enable','POST',{expectedRevision:(await checked(actor.token,'/api/plugins')).revision});
  await run(actor.token,'operations',{operation:'connect'});await run(actor.token,'operations',{operation:'select',payload:{enabled:true,start:'2026-10-16T00:00:00Z',end:'2026-10-17T00:00:00Z',autoSync:false,backupAudio:true}});await run(actor.token,'sync');
  assertNoAutomaticAudio(actor.userId);
  const list=await checked(actor.token,'/api/connectors/recordings/recordings');assert.equal(list.items.length,3);assert.ok(list.items.every((item:any)=>item.audio.archived));assert.equal(list.items.find((item:any)=>item.id==='spoken').transcript.archived,true);
  for(const row of audio(actor.userId)){
   const file=await checked(actor.token,'/api/files/'+row.capture_id);assert.equal(file.job,null);assert.equal(file.hasOriginal,true);assert.equal(file.processing.processed,false);
   const capture=await checked(actor.token,'/api/capture-browser/'+row.capture_id);assert.deepEqual(capture.fileArchive,{captureId:row.capture_id});
   const playback=await checked(actor.token,'/api/files/'+row.capture_id+'/playback','POST',{}),bytes=await f.request(actor.token,playback.url);assert.equal(bytes.statusCode,200,bytes.body);assert.deepEqual(bytes.rawPayload,wave);
   const exported=await f.request(actor.token,'/api/files/'+row.capture_id+'/export');assert.equal(exported.statusCode,200,exported.body);const entries=tarEntries(exported.rawPayload);assert.deepEqual([...entries.keys()],['manifest.json','original']);assert.deepEqual(entries.get('original'),wave);const manifest=JSON.parse(entries.get('manifest.json')!.toString());assert.equal(manifest.processed,false);assert.equal(manifest.originalMime,'audio/wav');assert.equal(manifest.originalFile,'original');assert.equal(manifest.artifactId,undefined);
   if(actor===f.a)assert.equal((await f.request(f.b.token,'/api/files/'+row.capture_id+'/export')).statusCode,404,'B has no copy of A recording before B sync');
  }
 }
 assert.equal(asrCalls.length,0);
 const a=audio(f.a.userId)[0];assert.equal((await f.request(f.b.token,'/api/ingress/originals/'+a.id+'/tickets','POST',{mode:'download'})).statusCode,404);
 const scope=f.host.services.forUser(await f.host.authority.authenticate(f.a.token)),archive=await scope.exportUser('processing');assert.equal((archive.payload as any).formats.filter((row:any)=>row.format==='recording-audio-backup').length,3);
 await f.restart();assertNoAutomaticAudio(f.a.userId);assertNoAutomaticAudio(f.b.userId);assert.equal(asrCalls.length,0);
 await configure(f.a.token,'processing',{...defaultProcessingSettings(),automatic:true,understandingEnabled:false,summarize:false,semanticTurns:false,audioProcessor:'audio.http',timeoutMs:610000});assertNoAutomaticAudio(f.a.userId);
 const before=vendorCalls.length;await run(f.a.token,'operations',{operation:'retry',payload:{resume:true}});assertNoAutomaticAudio(f.a.userId);assert.equal(asrCalls.length,0);assert.equal(vendorCalls.filter(x=>x===f.a.userId+':media').length,3,'completed backup checkpoints survive retry and restart');assert.ok(vendorCalls.length>=before);
 // A deliberate owner request may process the backup using the same pipeline.
 const explicit=await checked(f.a.token,'/api/processing','POST',{originalRef:'original:'+a.id,operationId:'generated-explicit-backup-asr'});await waitForScopedState(async()=>(await checked(f.a.token,'/api/tasks/'+explicit.id)).state==='succeeded',()=>'Explicit backup ASR did not finish');assert.equal(asrCalls.length,1);assertNoAutomaticAudio(f.b.userId);
 // A public metadata field cannot impersonate the trusted host format.
 await checked(f.b.token,'/api/sources/same-source','PATCH',{retention:'archive'});
 const hash=bytesHash(wave),upload=await checked(f.b.token,'/api/ingress/sources/same-source/uploads','POST',{batchId:'generated-ordinary-audio',revision:{sourceId:'same-source',previousRevision:null,sizeBytes:wave.length,sha256:hash,relativePath:'generated.wav',item:{externalId:'ordinary-audio',revision:'r1',observedAt:'2026-10-16T00:00:00Z',title:'Generated ordinary audio',text:'',kind:'file',layer:'original',mimeType:'audio/wav',document:{originalMetadata:{role:'original-audio'}}}}});
 await checked(f.b.token,'/api/ingress/uploads/'+upload.id+'/parts/0','PUT',{bytes:wave.toString('base64'),checksum:hash});const receipt=await checked(f.b.token,'/api/ingress/uploads/'+upload.id+'/commit','POST',{}),ref=receipt.captures[0].original.ref;
 await waitForScopedState(async()=>(await checked(f.b.token,'/api/processing/originals/'+ref.slice(9))).indexed,()=>'Ordinary audio must retain configured automatic processing');assert.equal(asrCalls.length,2);
});

test('backup disposition survives a processing-domain delete/restore without restoring processing authority',async t=>{
 const f=await scopedCaptureFixture(t),context=await f.host.authority.authenticate(f.a.token),scope=f.host.services.forUser(context);
 const checked=async(path:string,method='GET',payload?:unknown)=>{const response=await f.request(f.a.token,path,method,payload);assert.equal(response.statusCode,200,response.body);return response.json();};
 await checked('/api/sources/same-source','PATCH',{retention:'archive'});
 const ingress=scope.get<ReturnType<IngressHost['forUser']>>('ingress');
 const wave=Buffer.concat([Buffer.from('RIFF0000WAVE'),Buffer.alloc(32)]),item={externalId:'generated-backup',revision:'r1',observedAt:'2026-10-16T00:00:00Z',title:'Generated backup',text:'',kind:'file',layer:'original',mimeType:'audio/wav'};
 const receipt=ingress.receiveSourceItemsWithOriginals('same-source','generated-backup', [item],[{bytes:wave,mime:'audio/wav',format:'recording-audio-backup'}]),original=receipt.captures[0].original!;
 const archive=await scope.exportUser('processing');assert.equal((archive.payload as any).formats[0].format,'recording-audio-backup');
 assert.equal((await scope.deleteUser('processing','generated-backup-format-delete')).status,'complete');assert.equal(f.read(db=>db.prepare('SELECT count(*) n FROM mp_original_formats WHERE user_id=?').get(f.a.userId)!.n),0);
 await scope.restoreUser('processing',archive,'generated-backup-format-restore');await scope.restoreUser('processing',archive,'generated-backup-format-restore');await f.restart();
 assert.equal(f.read(db=>db.prepare('SELECT format FROM mp_original_formats WHERE user_id=? AND original_id=?').get(f.a.userId,original.ref.slice(9))!.format),'recording-audio-backup');
 const file=await checked('/api/files/'+original.captureId);assert.equal(file.job,null);assert.equal(file.hasOriginal,true);assert.equal(file.processing.processed,false);
 assert.equal(f.read(db=>db.prepare('SELECT count(*) n FROM mp_admissions WHERE user_id=?').get(f.a.userId)!.n),0);
 const ticket=await checked('/api/ingress/originals/'+original.ref.slice(9)+'/tickets','POST',{mode:'download'}),bytes=await f.request(f.a.token,'/api/ingress/originals/'+original.ref.slice(9)+'/content?ticket='+encodeURIComponent(ticket.ticket));assert.equal(bytes.statusCode,200,bytes.body);assert.deepEqual(bytes.rawPayload,wave);
 assert.equal((await f.request(f.b.token,'/api/files/'+original.captureId)).statusCode,404);
});
