import test from 'node:test';
import {createServer} from 'node:http';
import {writeMessagesResponse} from '../../../scripts/fixtures/messages-provider.js';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import {DatabaseSync} from 'node:sqlite';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {setTimeout as delay} from 'node:timers/promises';
import {scopedFilesFixture} from './fixtures/scoped-files.js';
import {waitForScopedState} from './fixtures/scoped-process.js';
import {PerformanceFailureObservation} from './fixtures/performance-failure-observation.js';
import {bytesHash} from '../src/scope/originals.js';
import {defaultModelSettings} from '../src/model-settings.js';
import {Fixture,png,settings,policy,generated,upload,read,done} from './fixtures/multiuser-perception-history-suite.js';

for(const reuseOcrListener of [false])test('real OCR and pixel-reading model children reach eight physical calls per kind while another owner retains its own slot'+(reuseOcrListener?' with a reused OCR listener':''),{timeout:240000},async t=>{
 // Functional coverage: the owner deferred the original latency budgets (PERF-R1-02).
 const functionalWaitMs=45000;
 const observation=new PerformanceFailureObservation('perception-physical-eight-'+reuseOcrListener,value=>t.diagnostic(value));
 const calls:{owner:string;kind:string;workerIndex:number;release:()=>void;captureId?:string}[]=[],active=new Set<object>(),seen=new Set<string>();t.after(()=>{observation.cleanupStart();for(const call of calls)call.release();});
 const listen=async(kind:string,index:number)=>{
  const server=createServer((req,res)=>{let observedOwner:string|undefined,observedCaptureId:string|undefined;void(async()=>{
   const parts:Buffer[]=[];for await(const part of req)parts.push(part);const body=Buffer.concat(parts).toString(),key=String(req.headers['x-api-key']??req.headers.authorization),owner=key.includes('GEN_b_')?'b':'a';
   const captureId=kind==='understanding'?[...new Set(body.match(/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/g)??[])][0]:undefined;
   observedOwner=owner;observedCaptureId=captureId;observation.event('transport-request',{owner,kind,workerIndex:index,captureId});
   if(kind==='understanding'&&!seen.has(captureId!)){assert.ok(captureId);seen.add(captureId!);observation.event('read-image-requested',{owner,kind,workerIndex:index,captureId});writeMessagesResponse(res,{stage:1,tool:{name:'read_image',args:{id:captureId,view:'image'}}});return;}
   // Force a legal arrival order in which the old first-five release leaves
   // worker0 occupied. The ninth OCR shares it only in the reuse scenario.
   if(reuseOcrListener&&kind==='ocr'&&index===0)await waitForScopedState(observation.poll('ocr-listener-order',()=>calls.filter(call=>call.owner==='a'&&call.kind==='ocr').length>=7),()=>observation.failure('ocr-listener-order-timeout',JSON.stringify(calls.map(({release,...call})=>call))),functionalWaitMs);
   let release!:()=>void;const held=new Promise<void>(resolve=>release=resolve),call={owner,kind,workerIndex:index,release,captureId};calls.push(call);active.add(call);observation.event('transport-held',{owner,kind,workerIndex:index,captureId});res.on('close',()=>{observation.event('transport-close',{owner,kind,workerIndex:index,captureId});active.delete(call);});await held;observation.event('transport-released',{owner,kind,workerIndex:index,captureId});active.delete(call);
   if(kind==='ocr'){res.setHeader('Content-Type','application/json');res.setHeader('X-Mote-Execution','local');res.end(JSON.stringify({durationMs:0,segments:[{startMs:0,endMs:0,text:'GENERATED_'+owner+'_OCR_'+index}]}));}
   else writeMessagesResponse(res,{stage:2,text:JSON.stringify({answer:JSON.stringify({text:'GENERATED_'+owner+'_PIXELS',regions:[]}),citationIds:[captureId]})});
  })().catch(error=>{observation.transportError(error,{owner:observedOwner,kind,workerIndex:index,captureId:observedCaptureId});res.destroy();});});
  await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(async()=>{server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));});return 'http://127.0.0.1:'+(server.address() as any).port;
 };
 observation.phase('fixture-setup');
 const aWorkers=reuseOcrListener?8:9,ocr=await Promise.all(Array.from({length:aWorkers+1},(_,index)=>listen('ocr',index))),language=await listen('understanding',0),f=await scopedFilesFixture(t,node=>{
  const registry=node.processing!.processors.imageRecipes;
  for(const kind of ['ocr','understanding'] as const){registry.registerStage({id:'generated.child-'+kind,version:'1',kind,run:input=>kind==='ocr'?input.ocr():input.understand()});registry.registerRecipe({id:'generated.child-'+kind,version:'1',steps:[{name:'physical',stage:{id:'generated.child-'+kind,version:'1'},dependsOn:[]}]});}
 });
 const files:{owner:string;kind:string;index:number;workerIndex?:number;id:string;token:string}[]=[];
 observation.bind(()=>({directory:f.directory,users:[{id:f.a.userId,alias:'a'},{id:f.b.userId,alias:'b'}],captures:files.map(({owner,kind,index,id})=>({owner,kind,index,id})),isActiveTask:id=>f.host.execution!.engine.isActiveStep(id),counts:()=>({activeAocr:[...active].filter((call:any)=>call.owner==='a'&&call.kind==='ocr').length,activeAunderstanding:[...active].filter((call:any)=>call.owner==='a'&&call.kind==='understanding').length,activeBocr:[...active].filter((call:any)=>call.owner==='b'&&call.kind==='ocr').length,activeBunderstanding:[...active].filter((call:any)=>call.owner==='b'&&call.kind==='understanding').length,callEntries:calls.length,firstTurnImages:seen.size})}));
 t.after(()=>observation.cleanupEnd());observation.phase('fixture-ready');
 const execution=await f.checked(f.admin.token,'/api/admin/execution-settings');await f.checked(f.admin.token,'/api/admin/execution-settings','PUT',{revision:execution.revision,interactiveConcurrency:execution.interactiveConcurrency,agentConcurrency:64,llmConcurrency:64,memoryConcurrency:execution.memoryConcurrency});
 observation.phase('owner-input-setup');
 for(const [owner,actor,limit,workers] of [['a',f.a,8,ocr.slice(0,aWorkers)],['b',f.b,1,ocr.slice(aWorkers)]] as const){
  observation.event('owner-configuration-start',{owner});
  const profiles=workers.map((url,index)=>({id:'ocr-'+index,name:'Generated OCR '+index,settings:{...defaultModelSettings(),provider:'custom',protocol:'mote-media',baseUrl:url+'/ocr',model:'generated-ocr',apiKey:'GEN_'+owner+'_ocr_'+index}}));profiles.push({id:'language',name:'Generated pixels',settings:{...defaultModelSettings(),provider:'custom',protocol:'anthropic-messages',baseUrl:language+'/v1',model:'generated-pixels',apiKey:'GEN_'+owner+'_pixels'}} as any);
  await f.checked(actor.token,'/api/configuration/models','PUT',{revision:(await f.checked(actor.token,'/api/configuration')).revision,value:{profiles,selections:{ocr:{kind:'personal',id:'ocr-0'},file:{kind:'personal',id:'language'}}}});
  const page=await f.checked(actor.token,'/api/file-processing');await f.checked(actor.token,'/api/file-processing','PUT',{revision:page.revision,settings:page.settings,policy:{version:1,services:[...workers.map((_url,index)=>({id:'ocr-'+index,name:'Generated OCR '+index,kind:'image',reference:{kind:'personal',id:'ocr-'+index}})),{id:'language',name:'Generated pixels',kind:'model',reference:{kind:'personal',id:'language'}}],profiles:[...workers.map((_url,index)=>({id:'ocr-'+index,name:'Generated OCR '+index,processorId:'image.http',serviceId:'ocr-'+index,parameters:{},summarize:false,imageRecipe:{id:'generated.child-ocr',version:'1'}})),{id:'pixels',name:'Generated pixels',processorId:'image.http',modelServiceId:'language',parameters:{},summarize:false,imageRecipe:{id:'generated.child-understanding',version:'1'}},{id:'archive',name:'Generated archive',processorId:'archive',parameters:{},summarize:false}],rules:[{type:'image/*',profileId:'ocr-0'},{type:'*/*',profileId:'archive'}]}});
  await settings(f,actor.token,{concurrency:limit});observation.event('owner-configuration-end',{owner,limit});
  for(const kind of ['ocr','understanding'])for(let index=0;index<limit+(owner==='a'?1:0);index++){
   observation.event('upload-start',{owner,kind,index});
   const externalId=owner+'-child-'+kind+'-'+index,bytes=await sharp({create:{width:2,height:2,channels:3,background:{r:index+1,g:owner==='a'?2:3,b:kind==='ocr'?4:5}}}).png().toBuffer(),hash=bytesHash(bytes),opened=await f.checked(actor.token,'/api/ingress/sources/same-source/uploads','POST',{batchId:externalId,revision:{sourceId:'same-source',sizeBytes:bytes.length,sha256:hash,processingProfileId:kind==='ocr'?'ocr-'+(index%workers.length):'pixels',item:{externalId,revision:'1',observedAt:'2026-10-16T00:00:00Z',title:externalId,text:'',kind:'file',layer:'original',mimeType:'image/png'}}});
   await f.checked(actor.token,'/api/ingress/uploads/'+opened.id+'/parts/0','PUT',{bytes:bytes.toString('base64'),checksum:hash});files.push({owner,kind,index,workerIndex:kind==='ocr'?(owner==='a'?index%workers.length:aWorkers):undefined,token:actor.token,id:(await f.checked(actor.token,'/api/ingress/uploads/'+opened.id+'/commit','POST',{})).captures[0].id});observation.event('upload-committed',{owner,kind,index,captureId:files.at(-1)!.id});
  }
 }
 const count=(owner:string,kind:string)=>[...active].filter((call:any)=>call.owner===owner&&call.kind===kind).length;
 const ninth=files.find(file=>file.owner==='a'&&file.kind==='ocr'&&file.index===8)!,workerHeld=()=>[...active].some((call:any)=>call.owner==='a'&&call.kind==='ocr'&&call.workerIndex===ninth.workerIndex);
 const blockedNinth=()=>{const db=new DatabaseSync(join(f.directory,'mote.sqlite'),{readOnly:true});try{return db.prepare("SELECT e.state,e.attempts,r.resource_key FROM execution_steps e JOIN user_tasks u ON u.task_id=e.id AND u.user_id=e.user_id JOIN ig_originals o ON o.user_id=u.user_id AND json_extract(u.input,'$.originalRef')='original:'||o.id JOIN task_model_resources r ON r.task_id=e.id WHERE e.user_id=? AND o.capture_id=? AND e.kind='processing.ocr' AND e.state='waiting' AND json_extract(r.resource_key,'$[1]') LIKE 'processor:%' AND EXISTS(SELECT 1 FROM task_model_resources held JOIN execution_steps running ON running.id=held.task_id WHERE held.resource_key=r.resource_key AND running.id<>e.id AND running.user_id=e.user_id AND running.state='running')").get(f.a.userId,ninth.id);}finally{db.close();}};
 const snapshot=(phase:string)=>t.diagnostic(JSON.stringify({phase,reuseOcrListener,ninthWorker:ninth.workerIndex,activeAocrWorkers:[...active].filter((call:any)=>call.owner==='a'&&call.kind==='ocr').map((call:any)=>call.workerIndex),callsAocr:calls.filter(call=>call.owner==='a'&&call.kind==='ocr').length,callsAunderstanding:calls.filter(call=>call.owner==='a'&&call.kind==='understanding').length,totalCalls:calls.length}));
 observation.phase('initial-18-wait');
 await waitForScopedState(observation.poll('initial-18',()=>['ocr','understanding'].every(kind=>count('a',kind)===8&&count('b',kind)===1)),()=>observation.failure('initial-18-timeout',JSON.stringify(calls.map(({release,...call})=>call))),functionalWaitMs);
 observation.phase('lower-to-3');
 await settings(f,f.a.token,{concurrency:3});observation.phase('lower-to-3-returned');assert.equal(active.size,18,'hot lowering does not retire issued physical calls');
 observation.phase('release-first-five');
 for(const kind of ['ocr','understanding'])for(const call of calls.filter(call=>call.owner==='a'&&call.kind===kind).slice(0,5))call.release();
 observation.phase('three-per-kind-wait');
 await waitForScopedState(observation.poll('three-per-kind',()=>['ocr','understanding'].every(kind=>count('a',kind)===3)),()=>observation.failure('three-per-kind-timeout',JSON.stringify([...active])),functionalWaitMs);await delay(200);assert.equal(calls.filter(call=>call.owner==='a').length,16,'no ninth call while three occupied units remain');
 assert.equal(workerHeld(),reuseOcrListener,'the global-limit scenario has a free ninth listener; the reuse scenario deliberately retains worker0');snapshot('hot3');
 observation.phase('raise-to-8');
 await settings(f,f.a.token,{concurrency:8});observation.phase('raise-to-8-returned');
 if(reuseOcrListener){
  observation.phase('shared-listener-blocked-wait');
  await waitForScopedState(observation.poll('shared-listener-blocked',()=>calls.filter(call=>call.owner==='a'&&call.kind==='understanding').length===9&&!!blockedNinth()),()=>observation.failure('shared-listener-blocked-timeout',JSON.stringify({calls:calls.map(({release,...call})=>call),blocked:blockedNinth()})),functionalWaitMs);
  assert.equal(calls.length,19,'raising global capacity cannot bypass the pinned busy listener');assert.equal(workerHeld(),true);assert.equal(blockedNinth()!.attempts,0,'physical resource waiting does not spend an attempt');snapshot('hot8-shared-listener-blocked');
  observation.phase('release-worker-0');
  calls.find(call=>call.owner==='a'&&call.kind==='ocr'&&call.workerIndex===0)!.release();
 }
 observation.phase('all-20-wait');
 await waitForScopedState(observation.poll('all-20',()=>calls.filter(call=>call.owner==='a').length===18),()=>observation.failure('all-20-timeout',JSON.stringify({calls:calls.map(({release,...call})=>call),active:[...active].map(({release,...call}:any)=>call)})),functionalWaitMs);assert.equal(calls.length,20);snapshot('all20');
 observation.phase('cancel-ninth-understanding');
 const cancelled=files.find(file=>file.owner==='a'&&file.kind==='understanding'&&file.index===8)!;await f.checked(f.a.token,'/api/files/'+cancelled.id+'/cancel','POST',{});calls.find(call=>call.captureId===cancelled.id)!.release();
 observation.phase('release-all-and-settle');
 for(const call of calls)call.release();for(const file of files)if(file!==cancelled){observation.event('file-settle-start',{owner:file.owner,kind:file.kind,index:file.index,captureId:file.id});await done(f,file.token,file.id,functionalWaitMs);observation.event('file-settle-end',{owner:file.owner,kind:file.kind,index:file.index,captureId:file.id});}await delay(100);assert.deepEqual((await f.checked(f.a.token,'/api/images/'+cancelled.id)).products,[],'late model response cannot publish after cancellation');
 for(const file of files.filter(file=>file.owner==='b')){const image=await f.checked(file.token,'/api/images/'+file.id);assert.ok(!JSON.stringify(image.products).includes('GENERATED_a_'));assert.equal((await f.request(f.a.token,'/api/files/'+file.id)).statusCode,404);}
 observation.complete();
});
