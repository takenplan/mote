import test,{type TestContext} from 'node:test';
import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import {mkdirSync,writeFileSync} from 'node:fs';
import {dirname,join} from 'node:path';
import {createServer} from 'node:http';
import {scopedCaptureFixture} from './fixtures/scoped-capture-host.js';
import {waitForScopedState} from './fixtures/scoped-process.js';
import {defaultProcessingSettings} from '../src/scope/processing-schema.js';
import {defaultMemorySettings} from '../src/scope/memory-schema.js';
import {defaultModelSettings} from '../src/model-settings.js';
import {historyRespond} from './fixtures/history-ask-fixture.js';
import {recordingMemoryRecipe} from '../src/connectors/recording-memory.js';

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

test('a multi-paragraph recording has one canonical owned semantic input, with exact segment locators into its retained export',async t=>{
 const {f,states,checked,run,page,heads,projection,originals,bytes}=await fixture(t,false,true);
 for(const actor of [f.a,f.b]){
  const current=await heads(actor.token),speech=current.filter(item=>item.externalId!==recordingId+':audio');
  assert.deepEqual(speech.map(item=>item.externalId),[recordingId+':export'],'individual segments must not become parallel semantic producers');
  const projected=await projection(actor.token);assert.equal(projected.materials.length,1,'the entire recording remains one Material and one Memory input');
  const material=await checked(actor.token,'/api/materials/'+projected.materials[0].id),state=states.get(actor.userId)!,members=await checked(actor.token,'/api/materials/'+material.id+'/members');
  assert.deepEqual(members.items.map((member:any)=>member.ref),['capture:'+speech[0].captureId]);assert.equal(material.blockCount,3);
  assert.equal((await checked(actor.token,'/api/materials/'+material.id+'/read')).text,state.paragraphs.map(row=>row.paragraph).join('\n'));
  const preview=await checked(actor.token,'/api/memory/materials/'+material.id+'?'+new URLSearchParams({revision:material.revision,recipes:JSON.stringify([recordingMemoryRecipe])}));assert.equal(preview.status,'ready');assert.equal(preview.evidenceIds.length,3);
  const source=(await page(actor.token)).sourceId,original=(await originals(actor.token)).find(item=>item.captureId===speech[0].captureId);assert.ok(original);
  const raw=JSON.parse((await bytes(actor.token,original.ref)).toString());assert.equal(raw.taskUuid,recordingId);assert.deepEqual(raw.paragraphList,state.paragraphs);
  const chunks=await checked(actor.token,'/api/files/'+speech[0].captureId+'/chunks?offset=0');assert.equal(chunks.items.length,3);
  assert.deepEqual(chunks.items.map((chunk:any)=>chunk.ocrText),state.paragraphs.map(row=>row.paragraph));assert.deepEqual(chunks.items.map((chunk:any)=>chunk.fileEvidence.documentLocation),state.paragraphs.map((row,index)=>({rowNumber:index+1,offset:0,length:String(row.paragraph).length})));assert.ok(chunks.items.every((chunk:any)=>chunk.fileEvidence.speaker==='Generated speaker'&&chunk.fileEvidence.uncertain===true));
  const settings=await checked(actor.token,'/api/memory/recipe-settings?sourceId='+source);assert.equal(settings.inherited,false);assert.deepEqual(settings.items.map((item:any)=>item.binding.recipe),[recordingMemoryRecipe]);
  const installed=(await checked(actor.token,'/api/memory/recipes')).items.find((item:any)=>item.id===recordingMemoryRecipe.id&&item.version===recordingMemoryRecipe.version);assert.ok(installed?.available);assert.equal(installed.binding.extract.id,'mote.recording-extraction');assert.equal(installed.binding.review.id,'mote.recording-review');
  const recipeRef=(pin:{id:string;version:string})=>({id:pin.id,version:pin.version}),frozen=f.read(db=>db.prepare('SELECT json FROM mm_capture_intakes WHERE user_id=? AND capture_id=?').get(actor.userId,speech[0].captureId));assert.ok(frozen);assert.deepEqual(JSON.parse(String(frozen.json)).strategies.map((strategy:any)=>recipeRef(strategy.recipe)),[recordingMemoryRecipe]);
  const intakes=f.read(db=>db.prepare('SELECT material_id,json FROM mm_intakes WHERE user_id=?').all(actor.userId));assert.equal(intakes.length,1,'one whole-recording semantic producer admits one dedicated recording intake');assert.equal(intakes[0].material_id,material.id);assert.deepEqual(recipeRef(JSON.parse(String(intakes[0].json)).strategy.recipe),recordingMemoryRecipe);
  assert.equal((await f.request(actor===f.a?f.b.token:f.a.token,'/api/files/'+speech[0].captureId)).statusCode,404);
  const override=defaultMemorySettings().recipe;await checked(actor.token,'/api/memory/recipe-settings','PUT',{sourceId:source,revision:settings.revision,recipes:[override]});await run(actor.token,'operations',{operation:'connect'});assert.deepEqual((await checked(actor.token,'/api/memory/recipe-settings?sourceId='+source)).items.map((item:any)=>item.binding.recipe),[override],'reconnecting an existing source preserves the owner-selected override');assert.equal(f.read(db=>db.prepare('SELECT count(*) n FROM mm_intakes WHERE user_id=?').get(actor.userId)!.n),1,'a default/override save never automatically replays historical Material');
  assert.ok(source);
 }
});

test('confirmed audio backups survive selection epochs and restart without new media calls or cross-account reuse',async t=>{
 const {f,states,checked,run,page,heads,calls}=await fixture(t),beforeA=await heads(f.a.token),beforeB=await heads(f.b.token),audio=beforeA.find(item=>item.externalId===recordingId+':audio');assert.ok(audio);
 const mediaCalls=(userId:string)=>calls.filter(call=>call.userId===userId&&call.kind==='media').length;
 const aCalls=mediaCalls(f.a.userId),bCalls=mediaCalls(f.b.userId);
 // The user's background preference and range are work authorization changes,
 // not a request to download an already confirmed recording again.
 await run(f.a.token,'operations',{operation:'select',payload:{enabled:true,start:'2026-10-16T00:00:00Z',end:'2026-10-17T00:00:00Z',autoSync:true,backupAudio:true}});await run(f.a.token,'sync');
 assert.equal(mediaCalls(f.a.userId),aCalls);assert.equal((await page(f.a.token)).items[0].audioCaptureId,audio.captureId);
 await f.restart();await run(f.a.token,'operations',{operation:'select',payload:{enabled:true,start:'2026-10-15T00:00:00Z',end:'2026-10-18T00:00:00Z',autoSync:false,backupAudio:true}});await run(f.a.token,'sync');
 assert.equal(mediaCalls(f.a.userId),aCalls);assert.equal((await page(f.a.token)).items[0].audioCaptureId,audio.captureId);assert.equal(mediaCalls(f.b.userId),bCalls);assert.deepEqual(await heads(f.b.token),beforeB);
 // An actual vendor account change gets a new source and its own media fact,
 // even when the provider exposes the same recording ID and identical bytes.
 states.get(f.a.userId)!.vendorUser='generated-different-vendor-user';await run(f.a.token,'operations',{operation:'connect'});await run(f.a.token,'operations',{operation:'select',payload:{enabled:true,start:'2026-10-16T00:00:00Z',end:'2026-10-17T00:00:00Z',autoSync:false,backupAudio:true}});await run(f.a.token,'sync');
 assert.equal(mediaCalls(f.a.userId),aCalls+1);assert.notEqual((await page(f.a.token)).items[0].audioCaptureId,audio.captureId);
 const newAudio=(await page(f.a.token)).items[0].audioCaptureId,playback=await checked(f.a.token,'/api/files/'+newAudio+'/playback','POST',{});assert.equal((await f.request(f.a.token,playback.url)).statusCode,200);assert.equal((await f.request(f.b.token,'/api/files/'+newAudio)).statusCode,404);
});

test('empty and unsupported recording corrections retain originals without admitting a new semantic Memory input',async t=>{
 const {f,states,run,page,projection}=await fixture(t,false,true),count=(userId:string)=>f.read(db=>db.prepare('SELECT count(*) n FROM mm_intakes WHERE user_id=?').get(userId)!.n),beforeA=count(f.a.userId),beforeB=count(f.b.userId);assert.equal(beforeA,1);assert.equal(beforeB,1);
 states.get(f.a.userId)!.paragraphs=[];assert.equal((await run(f.a.token,'sync')).result.failed,0);const empty=await projection(f.a.token);assert.equal(empty.materials.length,1);assert.equal(empty.materials[0].blockCount,0);assert.equal((await page(f.a.token)).items[0].empty,true);assert.equal(count(f.a.userId),beforeA,'a zero-block export cannot become a new recording Memory intake');
 await f.restart();states.get(f.a.userId)!.paragraphs=[{unknown:'Generated unsupported current vendor export'}];assert.equal((await run(f.a.token,'sync')).result.failed,1);assert.equal((await page(f.a.token)).items[0].unsupported,true);assert.equal(count(f.a.userId),beforeA);assert.equal(count(f.b.userId),beforeB);
});

test('Files forget fences recording text and audio acquisition across a new selection and restart while another owner continues',async t=>{
 const {f,checked,run,page,calls}=await fixture(t),recording=(await page(f.a.token)).items[0];
 for(const captureId of [recording.transcriptCaptureId,recording.audioCaptureId]){
  const file=await checked(f.a.token,'/api/files/'+captureId);await checked(f.a.token,'/api/files/'+captureId,'DELETE',{operationId:randomUUID(),originalGeneration:file.originalGeneration});
 }
 await f.restart();const count=(userId:string,kind:string)=>calls.filter(call=>call.userId===userId&&call.kind===kind).length,before={transcript:count(f.a.userId,'transcript'),media:count(f.a.userId,'media')};
 const selection={enabled:true,start:'2026-10-15T00:00:00Z',end:'2026-10-18T00:00:00Z',autoSync:false,backupAudio:true};
 await run(f.a.token,'operations',{operation:'select',payload:selection});const result=await run(f.a.token,'sync');assert.equal(result.result.failed,2);
 assert.equal(count(f.a.userId,'transcript'),before.transcript,'forgotten text is rejected before a provider transcript read');assert.equal(count(f.a.userId,'media'),before.media,'forgotten audio is rejected before a media download');
 const forgotten=(await page(f.a.token)).items[0];assert.equal(forgotten.metadata.state,'succeeded');assert.equal(forgotten.transcript.state,'stale');assert.equal(forgotten.audio.state,'stale');assert.equal(forgotten.transcriptCaptureId,undefined);assert.equal(forgotten.audioCaptureId,undefined);
 const bTranscripts=count(f.b.userId,'transcript');await run(f.b.token,'operations',{operation:'select',payload:selection});assert.equal((await run(f.b.token,'sync')).result.failed,0);assert.ok(count(f.b.userId,'transcript')>bTranscripts);assert.ok((await page(f.b.token)).items[0].audioCaptureId,'equal recording IDs in the other owner retain their own confirmed backup');
});

test('Files forget during an admitted media download rejects its late archive while the equal recording in B remains available',async t=>{
 let entered!:()=>void,release!:()=>void;const entry=new Promise<void>(resolve=>entered=resolve),wait=new Promise<void>(resolve=>release=resolve);t.after(()=>release());
 const {f,states,checked,run,page,heads,originals,bytes,calls}=await fixture(t),aPage=await page(f.a.token),originalAudio=(await heads(f.a.token)).find(item=>item.externalId===recordingId+':audio'),bAudio=(await page(f.b.token)).items[0].audioCaptureId;assert.ok(originalAudio);
 const raw=(await originals(f.a.token)).find(item=>item.captureId===originalAudio.captureId);assert.ok(raw);const wave=await bytes(f.a.token,raw.ref),sha256=createHash('sha256').update(wave).digest('hex');
 // Even copied provider metadata cannot confer the host's trusted backup format.
 // This ordinary owner revision remains playable, while the connector acquires its
 // actual provider backup. Disabling automatic processing avoids unrelated ASR
 // for this deliberately ordinary audio upload.
 const configuration=await checked(f.a.token,'/api/configuration');await checked(f.a.token,'/api/configuration/processing','PUT',{revision:configuration.revision,value:{...defaultProcessingSettings(),automatic:false,understandingEnabled:false}});
 const head=await checked(f.a.token,'/api/ingress/sources/'+aPage.sourceId+'/head?externalId='+encodeURIComponent(recordingId+':audio'));assert.equal(head.revision,originalAudio.revision);
 const upload=await checked(f.a.token,'/api/ingress/sources/'+aPage.sourceId+'/uploads','POST',{batchId:randomUUID(),revision:{sourceId:aPage.sourceId,previousRevision:head.revision,relativePath:'generated-owner-audio.wav',sizeBytes:wave.length,sha256,item:{externalId:recordingId+':audio',revision:'generated-owner-audio-revision',observedAt:new Date().toISOString(),title:'Generated owner audio revision',text:'',kind:'file',layer:'original',mimeType:'audio/wav',document:originalAudio.document}}});
 await checked(f.a.token,'/api/ingress/uploads/'+upload.id+'/parts/0','PUT',{bytes:wave.toString('base64'),checksum:sha256});const ownerFile=(await checked(f.a.token,'/api/ingress/uploads/'+upload.id+'/commit','POST',{})).captures[0].id;
 states.get(f.a.userId)!.mediaGate={entered,wait};
 await run(f.a.token,'operations',{operation:'select',payload:{enabled:true,start:'2026-10-15T00:00:00Z',end:'2026-10-18T00:00:00Z',autoSync:false,backupAudio:true}});
 const mediaBefore=calls.filter(call=>call.userId===f.a.userId&&call.kind==='media').length,syncing=run(f.a.token,'sync');await entry;
 const file=await checked(f.a.token,'/api/files/'+ownerFile);await checked(f.a.token,'/api/files/'+ownerFile,'DELETE',{operationId:randomUUID(),originalGeneration:file.originalGeneration});release();const result=await syncing;
 assert.equal(result.result.failed,1);assert.equal(calls.filter(call=>call.userId===f.a.userId&&call.kind==='media').length,mediaBefore+1,'the one physical acquisition already started before withdrawal');
 const after=(await page(f.a.token)).items[0];assert.equal(after.audio.state,'stale');assert.equal(after.audioCaptureId,undefined);assert.equal((await heads(f.a.token)).some(item=>item.externalId===recordingId+':audio'),false,'a late provider result cannot republish the forgotten head');
 assert.equal((await f.request(f.a.token,'/api/files/'+ownerFile)).statusCode,404);assert.equal((await run(f.b.token,'sync')).result.failed,0);assert.equal((await page(f.b.token)).items[0].audioCaptureId,bAudio);const playback=await checked(f.b.token,'/api/files/'+bAudio+'/playback','POST',{});assert.equal((await f.request(f.b.token,playback.url)).statusCode,200);
});

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
 assert.equal(after.filter(item=>item.externalId.startsWith(recordingId+':segment:')).length,0);
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
 assert.deepEqual((await heads(f.a.token)).filter(item=>item.externalId!==recordingId+':audio').map(item=>item.externalId),[recordingId+':export']);
 const state=states.get(f.a.userId)!;
 state.paragraphs=replacement==='shorter'?[state.paragraphs[0]]:replacement==='empty'?[]:[{unknown:'Generated unsupported current vendor format'}];
 const revised=await run(f.a.token,'sync');
 assert.deepEqual(await heads(f.b.token),beforeB,'A transcript replacement cannot change B current speech');
 assert.equal((await run(f.b.token,'sync')).result.failed,0);assert.deepEqual(await heads(f.b.token),beforeB);
 await f.restart();
 const current=await heads(f.a.token),status=(await page(f.a.token)).items[0];
 if(replacement==='unsupported'){assert.ok(revised.result.failed>0);assert.equal(status.unsupported,true,'An unsupported export is retained as such, not claimed to have decoded new speech');}
 else{assert.equal(revised.result.failed,0);if(replacement==='empty')assert.equal(status.empty,true);}
 t.diagnostic(JSON.stringify({replacement,failed:revised.result.failed,empty:status.empty,unsupported:status.unsupported,canonicalCaptureId:status.transcriptCaptureId}));
 const after=await projection(f.a.token,replacement==='unsupported');assert.ok(beforeProjection.text.includes('GENERATED_A_REMOVED_ONE'));
 const summary=(await checked(f.a.token,'/api/connectors/same-recordings')).counts;assert.equal(summary.transcripts,replacement==='shorter'?1:0);assert.equal(summary.empty,replacement==='empty'?1:0);assert.equal(summary.audio,1,'Current recording totals preserve the independent confirmed backup');
 for(const text of ['GENERATED_A_REMOVED_ONE','GENERATED_A_REMOVED_TWO',...(replacement==='shorter'?[]:['GENERATED_A_KEPT'])]){
  assert.ok(!after.text.includes(text),'Current Material cannot expose withdrawn speech '+text);
  assert.deepEqual((await checked(f.a.token,'/api/data/search?query='+text)).items,[],'Actual current query candidates cannot contain withdrawn speech');
 }
 if(replacement==='shorter')assert.ok(after.text.includes('GENERATED_A_KEPT'));
 for(const material of beforeProjection.materials.filter(item=>!after.materials.some(current=>current.id===item.id))){const response=await f.request(f.a.token,'/api/memory/materials/'+material.id+'?revision='+material.revision);assert.equal(response.statusCode,404,response.body);}
 for(const material of after.materials){const memory=await checked(f.a.token,'/api/memory/materials/'+material.id+'?revision='+material.revision);if(material.blockCount===0){assert.equal(memory.status,'unavailable');assert.deepEqual(memory.evidenceIds,[]);}}
 const oldExport=beforeA.find(item=>item.externalId===recordingId+':export'),head=current.find(item=>item.externalId===oldExport.externalId);assert.ok(head&&!head.deleted);assert.notEqual(head.captureId,oldExport.captureId,'Ordinary withdrawal advances the single retained non-deleted export head');assert.equal(current.filter(item=>item.externalId.startsWith(recordingId+':segment:')).length,0);
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
