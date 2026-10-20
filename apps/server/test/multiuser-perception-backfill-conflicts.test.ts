import test from 'node:test';
import type {TestContext} from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {DatabaseSync} from 'node:sqlite';
import {join} from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';
import sharp from 'sharp';
import {defaultModelSettings} from '../src/model-settings.js';
import {bytesHash} from '../src/scope/originals.js';
import {scopedFilesFixture} from './fixtures/scoped-files.js';
import {waitForScopedState} from './fixtures/scoped-process.js';

type Fixture=Awaited<ReturnType<typeof scopedFilesFixture>>;
const png=()=>sharp({create:{width:2,height:2,channels:3,background:'#23578a'}}).png().toBuffer();
function inspect(f:Fixture,jobId:string,originalId:string){
 const db=new DatabaseSync(join(f.directory,'mote.sqlite'),{readOnly:true});try{
  const task=db.prepare("SELECT e.id,e.state,e.error,e.attempts FROM execution_steps e JOIN user_tasks u ON u.task_id=e.id AND u.user_id=e.user_id WHERE e.user_id=? AND e.kind='processing.image-backfill' AND json_extract(u.input,'$.id')=?").get(f.a.userId,jobId)!;
  const job=JSON.parse(String(db.prepare('SELECT json FROM mp_image_backfills WHERE user_id=? AND id=?').get(f.a.userId,jobId)!.json));
  return {task,job,plan:db.prepare('SELECT plan_id FROM mp_file_policy_bindings WHERE user_id=? AND original_id=?').get(f.a.userId,originalId)?.plan_id,generation:db.prepare('SELECT generation FROM mp_file_controls WHERE user_id=? AND original_id=?').get(f.a.userId,originalId)?.generation??0,admissions:db.prepare('SELECT count(*) n FROM mp_admissions WHERE user_id=? AND original_id=?').get(f.a.userId,originalId)!.n,confirmations:db.prepare('SELECT count(*) n FROM task_external_retry_confirmations WHERE user_id=?').get(f.a.userId)!.n};
 }finally{db.close();}
}
async function configurePolicy(f:Fixture,token:string,profile='one'){
 const page=await f.checked(token,'/api/file-processing');return f.checked(token,'/api/file-processing','PUT',{revision:page.revision,settings:page.settings,policy:{version:1,services:[],profiles:[...['one','two'].map(id=>({id,name:'Generated '+id,processorId:'image.http',parameters:{},summarize:false,imageRecipe:{id:'generated.backfill-'+id,version:'1'}})),{id:'archive',name:'Generated archive',processorId:'archive',parameters:{},summarize:false}],rules:[{type:'image/*',profileId:profile},{type:'*/*',profileId:'archive'}]}});
}
async function upload(f:Fixture,token:string,id:string,sourceId='same-source'){
 const bytes=await png(),hash=bytesHash(bytes),opened=await f.checked(token,'/api/ingress/sources/'+sourceId+'/uploads','POST',{batchId:id,revision:{sourceId,previousRevision:null,sizeBytes:bytes.length,sha256:hash,relativePath:id+'.png',item:{externalId:id,revision:'1',observedAt:'2026-10-16T00:00:00Z',title:id,text:'',kind:'file',layer:'original',mimeType:'image/png'}}});
 await f.checked(token,'/api/ingress/uploads/'+opened.id+'/parts/0','PUT',{bytes:bytes.toString('base64'),checksum:hash});return (await f.checked(token,'/api/ingress/uploads/'+opened.id+'/commit','POST',{})).captures[0];
}
async function completed(f:Fixture,token:string,id:string){await waitForScopedState(async()=>(await f.checked(token,'/api/files/'+id)).job?.state==='succeeded',()=>id+' image did not complete',12000);}
async function confirm(f:Fixture,mode:'complete'|'recompute'='recompute'){
 const preview=await f.checked(f.a.token,'/api/perception/ocr/historical-preview','POST',{mode});assert.ok(preview.count>0);const result=await f.checked(f.a.token,'/api/perception/ocr/historical-process','POST',{token:preview.token});return {id:String(result.jobId),count:Number(preview.count)};
}
async function waiting(f:Fixture,jobId:string,originalId:string){await waitForScopedState(()=>{const value=inspect(f,jobId,originalId);return value.task.state==='waiting'&&value.task.error==='file_processing_active';},()=>JSON.stringify(inspect(f,jobId,originalId)),6000);}
async function imageFixture(t:TestContext){
 const runs:string[]=[],releases=new Map<string,()=>void>();
 const f=await scopedFilesFixture(t,node=>{const registry=node.processing!.processors.imageRecipes;for(const id of ['one','two']){
  registry.registerStage({id:'generated.backfill-'+id,version:'1',kind:'ocr',run:async input=>{await input.readImage({view:'metadata'});const externalId=input.record.provenance!.externalId;runs.push(id+':'+externalId);if(externalId.startsWith('unknown'))return input.ocr();if(externalId.startsWith('held')&&id==='one')await new Promise<void>((resolve,reject)=>{releases.set(externalId,resolve);input.signal.addEventListener('abort',()=>reject(input.signal.reason),{once:true});});return {durationMs:0,segments:[{startMs:0,endMs:0,text:'GENERATED_'+id}]};}});
  registry.registerRecipe({id:'generated.backfill-'+id,version:'1',steps:[{name:'scan',stage:{id:'generated.backfill-'+id,version:'1'},dependsOn:[]}]});
 }});
 t.after(()=>{for(const release of releases.values())release();});
 for(const actor of [f.a,f.b]){const view=await f.checked(actor.token,'/api/configuration'),memory=view.domains.find((domain:any)=>domain.id==='memory').saved;await f.checked(actor.token,'/api/configuration/memory','PUT',{revision:view.revision,value:{...memory,automatic:false,integration:false}});await configurePolicy(f,actor.token);const perception=await f.checked(actor.token,'/api/perception');await f.checked(actor.token,'/api/perception','PUT',{revision:perception.revision,settings:{...perception.settings,concurrency:2}});}
 return {f,runs,releases};
}
async function heldFixture(t:TestContext,withOcr=false){const value=await imageFixture(t),calls=withOcr?await ambiguousOcr(t,value.f):undefined,original=await upload(value.f,value.f.a.token,'held');await waitForScopedState(()=>value.releases.has('held'),()=>JSON.stringify(value.runs),6000);return {...value,original,calls,release:()=>value.releases.get('held')!()};}
async function selectProfile(f:Fixture,profile:string){const page=await f.checked(f.a.token,'/api/perception');await f.checked(f.a.token,'/api/perception','PUT',{revision:page.revision,settings:{...page.settings,profileId:profile}});}
async function ambiguousOcr(t:TestContext,f:Fixture){
 let calls=0;const server=createServer(async(req,res)=>{for await(const _part of req){}calls++;res.writeHead(503,{'Retry-After':'0'});res.end('GENERATED_AMBIGUOUS_OCR');});await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(async()=>{server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));});const endpoint='http://127.0.0.1:'+(server.address() as any).port+'/ocr';
 const view=await f.checked(f.a.token,'/api/configuration');await f.checked(f.a.token,'/api/configuration/models','PUT',{revision:view.revision,value:{profiles:[{id:'generated-ocr',name:'Generated OCR',settings:{...defaultModelSettings(),provider:'custom',protocol:'mote-media',baseUrl:endpoint,model:'generated-ocr',apiKey:'GENERATED_LOCAL_KEY'}}],selections:{ocr:{kind:'personal',id:'generated-ocr'}}}});const page=await f.checked(f.a.token,'/api/file-processing');await f.checked(f.a.token,'/api/file-processing','PUT',{revision:page.revision,settings:page.settings,policy:{...page.policy,services:[{id:'generated-ocr',name:'Generated OCR',kind:'image',reference:{kind:'personal',id:'generated-ocr'}}],profiles:page.policy.profiles.map((profile:any)=>profile.id==='archive'?profile:{...profile,serviceId:'generated-ocr'})}});return ()=>calls;
}

test('historical recompute admits later siblings while retaining a live original and resumes its exact intent after restart',{timeout:30000},async t=>{
 const {f,original,runs,release}=await heldFixture(t),b=await upload(f,f.b.token,'owner-b');await completed(f,f.b.token,b.id);const sibling=await upload(f,f.a.token,'later-sibling');await completed(f,f.a.token,sibling.id);
 const oldPlan=(await f.checked(f.a.token,'/api/files/'+original.id)).processing.appliedPolicy.id;await selectProfile(f,'two');
 const backfill=await confirm(f);assert.equal(backfill.count,2);await waiting(f,backfill.id,original.original.ref.slice(9));await waitForScopedState(()=>runs.includes('two:later-sibling'),()=>JSON.stringify(runs),6000);await completed(f,f.a.token,sibling.id);const before=inspect(f,backfill.id,original.original.ref.slice(9));
 assert.equal(before.job.cursor,before.job.watermark);assert.equal(before.job.queued,1);assert.deepEqual(before.job.deferred,[{id:original.original.ref.slice(9),position:before.job.deferred[0].position,reason:'active'}]);assert.equal(before.task.attempts,0);assert.equal(before.plan,oldPlan);assert.equal(before.generation,0);assert.equal(before.admissions,1);
 assert.equal((await f.request(f.b.token,'/api/tasks/'+before.task.id)).statusCode,404);assert.equal((await f.checked(f.b.token,'/api/perception')).backfills.length,0);
 const directContext=await f.host.authority.authenticate(f.a.token);assert.throws(()=>f.host.processing!.retryImageHistory(directContext,original.original.ref,'generated-direct-live-conflict','recompute'),/file_processing_active/);assert.deepEqual(inspect(f,backfill.id,original.original.ref.slice(9)),before,'direct host refusal also leaves the old plan and all admission state intact');
 release();await completed(f,f.a.token,original.id);await f.restart();await f.checked(f.admin.token,'/api/tasks?limit=100');
 await waitForScopedState(()=>inspect(f,backfill.id,original.original.ref.slice(9)).task.state==='succeeded',()=>JSON.stringify(inspect(f,backfill.id,original.original.ref.slice(9))),12000);await completed(f,f.a.token,original.id);
 const after=inspect(f,backfill.id,original.original.ref.slice(9));assert.equal(after.task.id,before.task.id);assert.equal(after.job.queued,2);assert.equal(after.job.cursor,after.job.watermark);assert.deepEqual(after.job.deferred,[]);assert.notEqual(after.plan,oldPlan);assert.equal(after.generation,1);assert.equal(after.admissions,2);assert.deepEqual(runs,['one:held','one:owner-b','one:later-sibling','two:later-sibling','two:held']);await f.restart();await f.checked(f.admin.token,'/api/tasks?limit=100');await delay(150);assert.equal(runs.length,5);assert.equal(inspect(f,backfill.id,original.original.ref.slice(9)).admissions,2);
});

for(const retired of ['delete','disable'] as const)test('historical recompute drops only a now-ineligible deferred '+retired+' original',{timeout:25000},async t=>{
 const {f,original,runs,releases,release}=await heldFixture(t);await f.checked(f.a.token,'/api/ingress/sources','POST',{id:'other-source',name:'Generated retired source',kind:'local-files',deviceId:'generated-other',platform:'import',retention:'archive'});const later=await upload(f,f.a.token,'held-later','other-source');await waitForScopedState(()=>releases.has('held-later'),()=>JSON.stringify(runs),6000);
 const backfill=await confirm(f);assert.equal(backfill.count,2);await waiting(f,backfill.id,original.original.ref.slice(9));assert.equal(inspect(f,backfill.id,original.original.ref.slice(9)).job.deferred.length,2);await f.checked(f.a.token,'/api/sources/other-source',retired==='delete'?'DELETE':'PATCH',retired==='delete'?{}:{enabled:false});
 await selectProfile(f,'two');release();await completed(f,f.a.token,original.id);await waitForScopedState(()=>inspect(f,backfill.id,original.original.ref.slice(9)).task.state==='succeeded',()=>JSON.stringify(inspect(f,backfill.id,original.original.ref.slice(9))),12000);await completed(f,f.a.token,original.id);
 assert.equal(inspect(f,backfill.id,original.original.ref.slice(9)).job.queued,1);assert.deepEqual(runs,['one:held','one:held-later','two:held']);assert.equal((await f.request(f.a.token,'/api/processing/originals/'+later.original.ref.slice(9))).statusCode,retired==='delete'?404:409);
});

for(const retired of ['cancel','account-epoch'] as const)test('historical recompute waiting authority cannot survive '+retired,{timeout:20000},async t=>{
 const {f,original,runs,release}=await heldFixture(t),backfill=await confirm(f);await waiting(f,backfill.id,original.original.ref.slice(9));const before=inspect(f,backfill.id,original.original.ref.slice(9));
 if(retired==='cancel')await f.checked(f.a.token,'/api/tasks/'+before.task.id+'/cancel','POST',{});else await f.checked(f.admin.token,'/api/admin/accounts/'+f.a.userId+'/password','POST',{password:'Generated-revoked-backfill-password'});
 release();if(retired==='cancel')await completed(f,f.a.token,original.id);await f.restart();await f.checked(f.admin.token,'/api/tasks?limit=100');await waitForScopedState(()=>inspect(f,backfill.id,original.original.ref.slice(9)).task.state===(retired==='cancel'?'cancelled':'stale'),()=>JSON.stringify(inspect(f,backfill.id,original.original.ref.slice(9))),12000);const after=inspect(f,backfill.id,original.original.ref.slice(9));assert.equal(after.job.cursor,before.job.cursor);assert.equal(after.job.queued,0);assert.equal(after.admissions,1);assert.equal(runs.filter(value=>value==='one:held').length,1);
 const b=await upload(f,f.b.token,'owner-b-after-retirement');await completed(f,f.b.token,b.id);assert.ok(runs.includes('one:owner-b-after-retirement'));assert.equal((await f.checked(f.b.token,'/api/perception')).backfills.length,0);
});

test('historical recompute admits later siblings but preserves unknown OCR across retry and restart',{timeout:25000},async t=>{
 const {f,runs}=await imageFixture(t),calls=await ambiguousOcr(t,f),original=await upload(f,f.a.token,'unknown-original');await waitForScopedState(async()=>calls()===1&&(await f.checked(f.a.token,'/api/files/'+original.id)).job?.state==='blocked',()=>String(calls()),12000);const sibling=await upload(f,f.a.token,'later-known');await completed(f,f.a.token,sibling.id);await selectProfile(f,'two');
 const backfill=await confirm(f);assert.equal(backfill.count,2);let value=inspect(f,backfill.id,original.original.ref.slice(9));await waitForScopedState(()=>{value=inspect(f,backfill.id,original.original.ref.slice(9));return value.task.state==='blocked';},()=>JSON.stringify(value),6000);await completed(f,f.a.token,sibling.id);assert.equal(value.task.error,'external_result_unknown');assert.equal(value.job.cursor,value.job.watermark);assert.equal(value.job.queued,1);assert.equal(value.job.deferred.length,1);assert.equal(value.job.deferred[0].reason,'unknown');assert.equal(value.generation,0);assert.equal(value.admissions,1);assert.equal(value.confirmations,0);
 const directContext=await f.host.authority.authenticate(f.a.token);assert.throws(()=>f.host.processing!.retryImageHistory(directContext,original.original.ref,'generated-direct-unknown-conflict','recompute'),/external_result_unknown/);assert.deepEqual(inspect(f,backfill.id,original.original.ref.slice(9)),value);
 await f.checked(f.a.token,'/api/tasks/'+value.task.id+'/retry','POST',{});await waitForScopedState(()=>inspect(f,backfill.id,original.original.ref.slice(9)).task.state==='blocked',()=>JSON.stringify(inspect(f,backfill.id,original.original.ref.slice(9))),6000);await f.restart();await f.checked(f.admin.token,'/api/tasks?limit=100');await delay(150);
 const after=inspect(f,backfill.id,original.original.ref.slice(9));assert.equal(after.task.error,'external_result_unknown');assert.equal(after.task.state,'blocked');assert.equal(after.job.queued,1);assert.equal(after.admissions,1);assert.equal(after.confirmations,0);assert.equal(calls(),1);assert.deepEqual(runs,['one:unknown-original','one:later-known','two:later-known']);const displayed=(await f.checked(f.a.token,'/api/perception')).backfills.find((job:any)=>job.id===backfill.id);assert.equal(displayed.state,'blocked');assert.equal(displayed.error,'external_result_unknown');assert.equal(displayed.queued,1);
});

test('unknown deferred OCR cannot prevent a live sibling from eventually receiving its recompute',{timeout:30000},async t=>{
 const setup=await heldFixture(t,true),{f,original,runs,release}=setup,calls=setup.calls!,unknown=await upload(f,f.a.token,'unknown-mixed');await waitForScopedState(async()=>calls()===1&&(await f.checked(f.a.token,'/api/files/'+unknown.id)).job?.state==='blocked',()=>String(calls()),12000);const ready=await upload(f,f.a.token,'mixed-ready');await completed(f,f.a.token,ready.id);await selectProfile(f,'two');
 const backfill=await confirm(f);assert.equal(backfill.count,3);await waiting(f,backfill.id,original.original.ref.slice(9));await completed(f,f.a.token,ready.id);const before=inspect(f,backfill.id,original.original.ref.slice(9));assert.equal(before.job.queued,1);assert.deepEqual(before.job.deferred.map((row:any)=>row.reason).sort(),['active','unknown']);assert.ok(runs.includes('two:mixed-ready'));assert.equal(calls(),1);
 release();await completed(f,f.a.token,original.id);await waitForScopedState(()=>inspect(f,backfill.id,original.original.ref.slice(9)).task.state==='blocked',()=>JSON.stringify(inspect(f,backfill.id,original.original.ref.slice(9))),12000);await completed(f,f.a.token,original.id);const after=inspect(f,backfill.id,original.original.ref.slice(9));assert.equal(after.task.error,'external_result_unknown');assert.equal(after.job.queued,2);assert.equal(after.job.deferred.length,1);assert.equal(after.job.deferred[0].id,unknown.original.ref.slice(9));assert.equal(after.job.deferred[0].reason,'unknown');assert.ok(runs.includes('two:held'));assert.equal(after.confirmations,0);assert.equal(calls(),1);
});
