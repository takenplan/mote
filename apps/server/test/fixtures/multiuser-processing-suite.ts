import {expectedIndexProof,proofDigest} from './ask-index-proof.js';
import {waitForPluginCheck} from './plugin-check.js';
import test,{type TestContext} from 'node:test';
import assert from 'node:assert/strict';
import {createServer,type IncomingMessage,type ServerResponse} from 'node:http';
import {mkdtempSync,rmSync,readdirSync,existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {setTimeout as delay} from 'node:timers/promises';
import {buildApp} from '../../src/app.js';
import {bytesHash} from '../../src/scope/originals.js';
import {defaultModelSettings} from '../../src/model-settings.js';
import {defaultProcessingSettings} from '../../src/scope/processing-schema.js';
import {defaultPerceptionConfiguration} from '../../src/perception-configuration.js';
import {generatedScopedPluginRelease,generatedScopedPluginSource} from './scoped-plugin-release.js';
import {LifecycleAuthority} from '../../src/scope/lifecycle.js';
import {openScopeStorage} from '../../src/scope/storage.js';
import {z} from 'zod';
import {EXECUTION_POLICIES} from '../../src/execution-policy.js';
import type {TaskRun} from '../../src/scope/task-execution.js';
import type {PrivateData} from '../../src/scope/private-data.js';
import sharp from 'sharp';
import {gunzipSync} from 'node:zlib';
import {writeMessagesResponse} from '../../../../scripts/fixtures/messages-provider.js';
import {zipSync} from 'fflate';

const password='Generated-processing-01',protocol={'x-mote-protocol-version':'2','x-mote-ingress-version':'3'};

const deferred=()=>{let resolve!:()=>void;const promise=new Promise<void>(r=>resolve=r);return {promise,resolve};};

async function until(check:()=>boolean,message:string|(()=>string)){const end=Date.now()+12000;while(!check()){if(Date.now()>end)assert.fail(typeof message==='function'?message():message);await delay(5);}}

async function fixture(t:TestContext,automatic=false,release=generatedScopedPluginRelease(),beforeReady?:(host:Awaited<ReturnType<typeof buildApp>>)=>void,storage?:{maxStorageBytes:number;runtimeLifecycle:true}){
 const directory=mkdtempSync(join(tmpdir(),'mote-m06-')),preflight=openScopeStorage(directory),deploymentId=preflight.deploymentId;preflight.close();const grants=new Map<string,any>(),lifecycleAuthority=new LifecycleAuthority(deploymentId,{verify:async grant=>grants.get(grant),isCurrent:context=>grants.has(context.operationId)});let node=await buildApp({dataDir:directory,...(storage?{maxStorageBytes:storage.maxStorageBytes}:{})},{pluginReleaseTransport:release.transport,...(storage?.runtimeLifecycle?{}:{lifecycleAuthority})});const nodes=[node];beforeReady?.(node);
 t.after(async()=>{for(const current of nodes.reverse())await current.app.close();rmSync(directory,{recursive:true,force:true});});
 const request=(token:string|undefined,url:string,method:any='GET',payload?:unknown)=>node.app.inject({url,method,headers:{...protocol,...(token?{authorization:'Bearer '+token}:{})},...(payload===undefined?{}:{payload})});
 const checked=async(token:string|undefined,url:string,method:any='GET',payload?:unknown)=>{const response=await request(token,url,method,payload);assert.equal(response.statusCode,200,response.body);return response.json();};
 await node.accounts!.initialize('generated-admin',password);const login=(username:string)=>checked(undefined,'/api/auth/login','POST',{username,password,mode:'client'}),admin=await login('generated-admin'),a=await checked(admin.token,'/api/admin/accounts','POST',{username:'generated-a',password}),b=await checked(admin.token,'/api/admin/accounts','POST',{username:'generated-b',password}),alice=await login('generated-a'),bob=await login('generated-b');
 const configure=async(token:string,domain:string,value:unknown)=>checked(token,'/api/configuration/'+domain,'PUT',{revision:(await checked(token,'/api/configuration')).revision,value});
 for(const token of [alice.token,bob.token]){await configure(token,'processing',{...defaultProcessingSettings(),automatic,understandingEnabled:false,audioProcessor:'audio.http'});await configure(token,'perception',{...defaultPerceptionConfiguration(),understandingEnabled:false});await checked(token,'/api/ingress/sources','POST',{id:'same-source',name:'Generated source',kind:'local-files',deviceId:'same-device',platform:'import',retention:'archive'});}
 const upload=async(token:string,bytes:Buffer,mimeType='text/plain',externalId='same-file',revision='same-revision',previousRevision:string|null=null)=>{
  const value={previousRevision,sourceId:'same-source',item:{externalId,revision,observedAt:'2026-10-15T00:00:00Z',title:'Generated file',text:'',kind:'file',layer:'original',mimeType},sizeBytes:bytes.length,sha256:bytesHash(bytes),relativePath:'generated.bin'},upload=await checked(token,'/api/ingress/sources/same-source/uploads','POST',{batchId:externalId+':'+revision,revision:value});
  await checked(token,'/api/ingress/uploads/'+upload.id+'/parts/0','PUT',{bytes:bytes.toString('base64'),checksum:bytesHash(bytes)});return checked(token,'/api/ingress/uploads/'+upload.id+'/commit','POST',{});
 };
 const submit=(token:string,ref:string,id='same-operation')=>checked(token,'/api/processing','POST',{originalRef:ref,operationId:id});
 const task=(token:string,id:string)=>checked(token,'/api/tasks/'+id);
 const wait=async(token:string,id:string,state='succeeded')=>{const end=Date.now()+12000;for(;;){const value=await task(token,id);if(value.state===state)return value;if(['failed','blocked','cancelled','stale'].includes(value.state)&&value.state!==state)assert.fail(JSON.stringify(value));if(Date.now()>end)assert.fail(JSON.stringify(value));await delay(10);}};
 const status=(token:string,ref:string)=>checked(token,'/api/processing/originals/'+ref.slice(9));
 const models=async(token:string,url:string,key:string,model='same-model')=>configure(token,'models',{profiles:[{id:'same-profile',name:'Generated media',settings:{...defaultModelSettings(),provider:'custom',protocol:'mote-media',baseUrl:url,model,apiKey:key,reasoningEffort:'auto'}}],selections:{ocr:{kind:'personal',id:'same-profile'},asr:{kind:'personal',id:'same-profile'}}});
 const intake=async(token:string,ref:string)=>{const context=await node.authority.authenticate(token),row=read(db=>db.prepare("SELECT a.task_id FROM mp_admissions a JOIN user_tasks u ON u.task_id=a.task_id AND u.user_id=a.user_id WHERE a.user_id=? AND a.original_id=? AND a.request_key LIKE 'intake:%' ORDER BY u.user_position DESC LIMIT 1").get(context.userId,ref.slice(9)));assert.ok(row?.task_id,'actual M03 image intake must admit its durable processing task');return task(token,String(row.task_id));};
 const read=<T>(work:(db:DatabaseSync)=>T)=>{const db=new DatabaseSync(join(directory,'mote.sqlite'));try{return work(db);}finally{db.close();}};
 const restart=async()=>{await node.app.close();node=await buildApp({dataDir:directory,...(storage?{maxStorageBytes:storage.maxStorageBytes}:{})},{pluginReleaseTransport:release.transport,...(storage?.runtimeLifecycle?{}:{lifecycleAuthority})});nodes.push(node);beforeReady?.(node);};
 return {directory,release,deploymentId,grants,lifecycleAuthority,get node(){return node;},request,checked,admin,a,b,alice,bob,configure,upload,submit,intake,task,wait,status,models,read,restart};
}

// Raw intake, pipeline admission and exact M06 publication each re-evaluate
// their owned organizer. Ask observes the accepted capture and published Material.
async function publishedIntakeTasks(f:Awaited<ReturnType<typeof fixture>>){await until(()=>f.read(db=>{const rows=db.prepare("SELECT state FROM execution_steps WHERE user_id=? AND kind='memory.materials'").all(f.a.userId);return rows.length===3&&rows.every(row=>row.state==='succeeded');}),'the three actual organizer stages did not settle');const captureId=f.read(db=>String(db.prepare('SELECT capture_id FROM ig_originals WHERE user_id=?').get(f.a.userId)!.capture_id)),record=await f.checked(f.alice.token,'/api/captures/'+captureId);return f.read(db=>{
 const digest=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
 const rows=db.prepare('SELECT e.id,e.kind,e.operation_id,e.state,u.input,u.model_receipt,u.grant_id FROM user_tasks u JOIN execution_steps e ON e.id=u.task_id AND e.user_id=u.user_id WHERE u.user_id=? ORDER BY e.kind').all(f.a.userId);
 assert.deepEqual(rows.map(row=>row.kind),['ask.index-admit','ask.index-admit','memory.intake','memory.materials','memory.materials','memory.materials','processing.extract','processing.pipeline']);
 const organizers=rows.filter(row=>row.kind==='memory.materials'),input=JSON.parse(String(organizers[0].input)),capture=db.prepare('SELECT capture_id,source_id FROM ig_originals WHERE user_id=?').get(f.a.userId)!;
 assert.equal(input.captureId,capture.capture_id);assert.equal(input.sourceId,capture.source_id);assert.equal(input.hash,digest(record));
 for(const organizer of organizers){assert.deepEqual(JSON.parse(String(organizer.input)),input);assert.equal(organizer.state,'succeeded');assert.equal(organizer.model_receipt,null);}
 assert.equal(db.prepare('SELECT count(*) n FROM mp_publications WHERE user_id=?').get(f.a.userId)!.n,1);assert.equal(db.prepare('SELECT count(*) n FROM pd_materials WHERE user_id=?').get(f.a.userId)!.n,1);assert.equal(db.prepare('SELECT count(*) n FROM pd_material_versions WHERE user_id=?').get(f.a.userId)!.n,1);assert.equal(db.prepare('SELECT count(*) n FROM mm_intakes WHERE user_id=?').get(f.a.userId)!.n,1);assert.equal(db.prepare('SELECT count(*) n FROM mm_jobs WHERE user_id=?').get(f.a.userId)!.n,0);
 const pipeline=rows.find(row=>row.kind==='processing.pipeline')!,publication=db.prepare('SELECT material_id,revision FROM mp_publications WHERE user_id=?').get(f.a.userId)!,stages=['intake','admission:'+pipeline.id,String(publication.revision)];
 const origin=db.prepare('SELECT incarnation FROM mm_organizer_origins WHERE user_id=? AND source_id=? AND capture_id=?').get(f.a.userId,input.sourceId,input.captureId)!;assert.equal(input.incarnation,origin.incarnation);assert.equal(input.authorizationEpoch,db.prepare('SELECT authorization_epoch FROM auth_accounts WHERE user_id=?').get(f.a.userId)!.authorization_epoch);
 const organizerOperations=stages.map(stage=>'memory-materials:'+digest([f.a.userId,'memory-materials:'+digest([input.captureId,input.sourceId,input.hash,stage,input.authorizationEpoch,input.incarnation])]));assert.equal(new Set(organizerOperations).size,3);assert.deepEqual(organizers.map(row=>row.operation_id).sort(),organizerOperations.sort());const organizerIds=stages.map(stage=>digest([f.a.userId,'memory-materials:'+digest([input.captureId,input.sourceId,input.hash,stage,input.authorizationEpoch,input.incarnation]),'memory.materials',input]));assert.deepEqual(organizers.map(row=>row.id).sort(),organizerIds.sort());
 const currentEpoch=db.prepare('SELECT authorization_epoch FROM auth_accounts WHERE user_id=?').get(f.a.userId)!.authorization_epoch;
 for(const row of rows){const grant=db.prepare('SELECT user_id,authorization_epoch,revoked FROM task_authorizations WHERE task_id=? AND grant_id=?').get(row.id,row.grant_id)!;assert.deepEqual({...grant},{user_id:f.a.userId,authorization_epoch:currentEpoch,revoked:0});assert.equal(row.model_receipt,null);}
 const events=rows.filter(row=>row.kind==='ask.index-admit').map(row=>{
  const {eventId}=JSON.parse(String(row.input)),eventRow=db.prepare('SELECT input FROM ma_embedding_events WHERE user_id=? AND id=?').get(f.a.userId,eventId)!;assert.ok(eventRow);const proof=JSON.parse(String(eventRow.input));
  assert.ok(['captures','material'].includes(proof.event?.kind));const event=proof.event.kind==='captures'?{kind:'captures',ids:[capture.capture_id],sourceIds:[capture.source_id]}:{kind:'material',id:publication.material_id,revision:publication.revision,sourceIds:[capture.source_id]};
  assert.equal(db.prepare('SELECT count(*) n FROM pd_material_inputs WHERE user_id=? AND material_id=? AND revision=?').get(f.a.userId,publication.material_id,publication.revision)!.n,0,'this fixture has one known root and no transitive Material');
  const expected=expectedIndexProof(db,f.a.userId,Number(currentEpoch),event,{sourceIds:[String(capture.source_id)],materials:proof.event.kind==='material'?[{id:String(publication.material_id),revision:String(publication.revision)}]:[],originalIds:[String(capture.capture_id)]});assert.deepEqual(proof,expected);assert.equal(eventId,digest(expected));
  const operation='ask-index:'+eventId;assert.equal(row.operation_id,'ask-index:'+digest([f.a.userId,operation]));assert.equal(row.id,digest([f.a.userId,operation,'ask.index-admit',{eventId}]));assert.equal(row.model_receipt,null);
  const grant=db.prepare('SELECT user_id,revoked FROM task_authorizations WHERE task_id=? AND grant_id=?').get(row.id,row.grant_id)!;assert.deepEqual({...grant},{user_id:f.a.userId,revoked:0});return event;
 });
 assert.deepEqual(events.sort((a,b)=>a.kind.localeCompare(b.kind)),[{kind:'captures',ids:[capture.capture_id],sourceIds:[capture.source_id]},{kind:'material',id:publication.material_id,revision:publication.revision,sourceIds:[capture.source_id]}]);
 assert.equal(db.prepare('SELECT count(*) n FROM ma_embedding_events').get()!.n,2);assert.equal(db.prepare('SELECT count(*) n FROM user_model_snapshots').get()!.n,0);assert.equal(db.prepare('SELECT count(*) n FROM ma_embeddings').get()!.n,0);assert.equal(db.prepare('SELECT count(*) n FROM user_tasks WHERE user_id=?').get(f.b.userId)!.n,0);return rows;
 });}

// Capture a new explicit delete intent once; callers retry the saved body directly.
async function forgetFile(f:Awaited<ReturnType<typeof fixture>>,token:string,path:string){const file=await f.checked(token,path);return f.checked(token,path,'DELETE',{operationId:randomUUID(),originalGeneration:file.originalGeneration});}

async function media(t:TestContext,handle:(request:IncomingMessage,response:ServerResponse,bytes:Buffer)=>unknown|Promise<unknown>){const server=createServer((req,res)=>{if(req.method!=='POST'){res.writeHead(404).end();return;}void (async()=>{const parts:Buffer[]=[];for await(const part of req)parts.push(part);await handle(req,res,Buffer.concat(parts));})().catch(()=>res.destroy());});await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(()=>new Promise<void>(resolve=>server.close(()=>resolve())));const address=server.address();assert.ok(address&&typeof address!=='string');return 'http://127.0.0.1:'+address.port+'/transcribe';}

const respond=(res:ServerResponse,text:string,durationMs=0)=>{res.setHeader('Content-Type','application/json');res.setHeader('X-Mote-Execution','local');res.end(JSON.stringify({durationMs,segments:[{startMs:0,endMs:durationMs,text}],coverage:'full',engine:'generated-http-fixture'}));};

export {password,protocol,deferred,until,fixture,publishedIntakeTasks,forgetFile,media,respond};
