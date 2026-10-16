import sharp from 'sharp';
import test,{type TestContext} from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {mkdtempSync,rmSync,writeFileSync,unlinkSync,readFileSync,existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {setTimeout as delay} from 'node:timers/promises';
import {LifecycleAuthority} from '../src/scope/lifecycle.js';
import {openScopeStorage} from '../src/scope/storage.js';
import {buildApp} from '../src/app.js';
import {defaultMemorySettings} from '../src/scope/memory-schema.js';
import {defaultProcessingSettings} from '../src/scope/processing-schema.js';
import {defaultModelSettings} from '../src/model-settings.js';
import {materialId} from '../src/materials.js';
import {writeMessagesResponse} from '../../../scripts/fixtures/messages-provider.js';
import {generatedMemoryRelease,generatedMem0Release,generatedHindsightRelease} from './fixtures/scoped-memory-release.js';
import {hindsightHttpFixture} from './fixtures/hindsight-http.js';
import type {HindsightRuntimeFactory} from '../src/scope/memory-providers.js';
import {PrivateSql,PrivateCursor} from '../src/scope/private-data-sql.js';
import {ScopedMemoryData} from '../src/scope/memory-data.js';
import type {PrivateData} from '../src/scope/private-data.js';

const password='Generated-memory-password-only-01';
const protocol={'x-mote-protocol-version':'2','x-mote-ingress-version':'3'};
const text=(owner:string)=>'GENERATED_MEMORY_'+owner+': Nora prefers generated tea.';
const deferred=()=>{let resolve!:()=>void;const promise=new Promise<void>(r=>resolve=r);return {promise,resolve};};
async function fixture(t:TestContext,release?:ReturnType<typeof generatedMemoryRelease>,hindsightRuntimeFactory?:HindsightRuntimeFactory){
 const directory=mkdtempSync(join(tmpdir(),'mote-m07-')),requests:{key:string;body:any;raw:string}[]=[],answers=new Map<string,(raw:string,keys:string[],ids:string[])=>unknown>(),responses=new Map<string,(res:any,raw:string,keys:string[],ids:string[])=>void>(),gates=new Map<string,{entered:ReturnType<typeof deferred>;release:ReturnType<typeof deferred>}>();
 const provider=createServer(async(req,res)=>{
  let raw='';for await(const chunk of req)raw+=chunk;const body=JSON.parse(raw),key=String(req.headers['x-api-key']??''),owner=key.includes('GENERATED_A_KEY')?'A':'B';requests.push({key,body,raw});
  const gate=gates.get(owner);if(gate){gate.entered.resolve();await gate.release.promise;}
  const ids=[...new Set(raw.match(/[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-a[0-9a-f]{3}-[0-9a-f]{12}/g)??[])],id=ids[0];
  const keys=[...new Set([...raw.matchAll(/\\?"key\\?"\s*:\s*\\?"(member_[0-9]+)/g)].map(match=>match[1]))];
  const scripted=responses.get(owner);if(scripted){scripted(res,raw,keys,ids);return;}
  const override=answers.get(owner);if(override){const answer:any=override(raw,keys,ids);writeMessagesResponse(res,{stage:requests.length,model:'generated-memory',text:JSON.stringify({answer:JSON.stringify(answer),citationIds:[...new Set((answer.memories??[]).flatMap((memory:any)=>memory.evidenceIds))]})});return;}
  if(raw.includes('supplied-memory-cards')){writeMessagesResponse(res,{stage:requests.length,model:'generated-memory',text:JSON.stringify({answer:JSON.stringify({memories:[]}),citationIds:[]})});return;}
  const memories=id?[{title:'Generated '+owner,statement:`Nora prefers generated tea. [${id}]`,uncertainty:'Synthetic attributed statement only',admission:{layer:'memory',reason:'Synthetic explicitly expressed preference',scope:'Nora in generated fixture',attribution:'third_party'},evidenceIds:[id],evidence:[{id,quote:text(owner)}]}]:[];
  if(raw.includes('Host Memory deletion review.')){writeMessagesResponse(res,{stage:requests.length,text:JSON.stringify({answer:JSON.stringify({sameConclusion:true,newSupportEvidenceIds:[]}),citationIds:[]})});return;}
  writeMessagesResponse(res,{stage:requests.length,model:'generated-memory',text:JSON.stringify({answer:JSON.stringify({memories,...(keys.length?{coverage:keys.map((key,index)=>({key,state:index===0&&memories.length?'checked':'no_candidates',candidateIndexes:index===0&&memories.length?[0]:[]}))}:{})}),citationIds:id?[id]:[]})});
 });
 await new Promise<void>(resolve=>provider.listen(0,'127.0.0.1',resolve));
 const preflight=openScopeStorage(directory),deploymentId=preflight.deploymentId;preflight.close();const lifecycleGrants=new Map<string,any>(),lifecycleAuthority=new LifecycleAuthority(deploymentId,{verify:async grant=>lifecycleGrants.get(grant),isCurrent:context=>lifecycleGrants.has(context.operationId)});
 let node=await buildApp({dataDir:directory},{lifecycleAuthority,...(release?{pluginReleaseTransport:release.transport}:{}),...(hindsightRuntimeFactory?{hindsightRuntimeFactory}:{})});const nodes=[node],cleanup:Array<()=>void>=[];
 t.after(async()=>{for(const close of cleanup)close();for(const gate of gates.values())gate.release.resolve();for(const current of nodes.reverse())await current.app.close();provider.closeAllConnections();await new Promise<void>(resolve=>provider.close(()=>resolve()));rmSync(directory,{recursive:true,force:true});});
 await node.accounts!.initialize('generated-admin',password);
 const request=(token:string|undefined,url:string,method:any='GET',payload?:unknown)=>node.app.inject({method,url,headers:{...protocol,...(token?{authorization:'Bearer '+token}:{})},...(payload===undefined?{}:{payload})});
 const login=async(username:string)=>{const response=await request(undefined,'/api/auth/login','POST',{username,password,mode:'client'});assert.equal(response.statusCode,200,response.body);return response.json();};
 const admin=await login('generated-admin'),users:any[]=[];
 for(const label of ['a','b']){const response=await request(admin.token,'/api/admin/accounts','POST',{username:'generated-'+label,password});assert.equal(response.statusCode,200,response.body);users.push({...response.json(),...await login('generated-'+label)});}
 const [a,b]=users;
 const replace=async(token:string,domain:string,value:unknown)=>{const view=await request(token,'/api/configuration'),response=await request(token,'/api/configuration/'+domain,'PUT',{revision:view.json().revision,value});assert.equal(response.statusCode,200,response.body);return response.json();};
 for(const [user,label] of [[a,'A'],[b,'B']] as const)await replace(user.token,'models',{profiles:[{id:'same-model',name:'Generated memory model',settings:{...defaultModelSettings(),provider:'custom',protocol:'anthropic-messages',model:'generated-memory',baseUrl:'http://127.0.0.1:'+(provider.address() as any).port+'/v1',apiKey:'GENERATED_'+label+'_KEY',headers:{},extraBody:{}}}],selections:{memory:{kind:'personal',id:'same-model'}}});
 for(const user of [a,b])await replace(user.token,'processing',{...defaultProcessingSettings(),automatic:false,understandingEnabled:false});
 const upload=async(user:any,label:string,externalId='same-upload',supplied?:Buffer,mimeType='text/plain')=>{
  const source=await request(user.token,'/api/ingress/sources','POST',{id:'same-source',name:'Generated source',kind:'local-files',deviceId:'same-device',platform:'import',retention:'archive'});assert.equal(source.statusCode,200,source.body);
  const bytes=supplied??Buffer.from(text(label)),checksum=createHash('sha256').update(bytes).digest('hex'),opened=await request(user.token,'/api/ingress/sources/same-source/uploads','POST',{batchId:externalId,revision:{sourceId:'same-source',item:{externalId,revision:'same-revision',observedAt:'2026-01-01T00:00:00Z',title:'Generated original',text:'',kind:'file',layer:'original',mimeType},sizeBytes:bytes.length,sha256:checksum,relativePath:'generated.txt'}});assert.equal(opened.statusCode,200,opened.body);
  const part=await request(user.token,'/api/ingress/uploads/'+opened.json().id+'/parts/0','PUT',{bytes:bytes.toString('base64'),checksum});assert.equal(part.statusCode,200,part.body);const commit=await request(user.token,'/api/ingress/uploads/'+opened.json().id+'/commit','POST',{});assert.equal(commit.statusCode,200,commit.body);return commit.json();
 };
 const publish=async(user:any,label:string,sourceId='same-source',externalId='same-external',content=text(label))=>{
  const context=await node.authority.authenticate(user.token),bound=node.ingress.bindSource(context,[sourceId],()=>{}),register=await request(user.token,'/api/ingress/sources','POST',{id:sourceId,name:'Generated source',kind:'custom',deviceId:'same-device',platform:'import',retention:'snapshot'});assert.equal(register.statusCode,200,register.body);
  const receipt=bound.receiveSourceItems(sourceId,'batch:'+externalId,[{externalId,revision:'same-revision',observedAt:'2026-01-01T00:00:00Z',title:'Generated input',text:content,kind:'file',layer:'original'}]),captureId=receipt.captures[0].id;
  return bound.publishMaterial({id:materialId(sourceId,externalId),kind:'document',schemaVersion:1,title:'Generated material',origin:{sourceId,externalId,deviceId:'same-device'},blocks:[{id:'same-block',kind:'text',format:'plain',text:content,memberIds:['original']}],members:[{id:'original',kind:'capture',ref:'capture:'+captureId}],coverage:{state:'complete'},fidelity:{state:'lossless'},retention:{original:'retained',policy:'keep'}});
 };
 const submit=async(user:any,materialIds:string[],operationId=randomUUID())=>{const response=await request(user.token,'/api/memory/jobs','POST',{materialIds,operationId});assert.equal(response.statusCode,200,response.body);return response.json();};
 const wait=async(user:any,id:string)=>{const deadline=Date.now()+30000;for(;;){const response=await request(user.token,'/api/memory/jobs/'+id);assert.equal(response.statusCode,200,response.body);const job=response.json(),tasks=Object.values(job.tasks) as any[];if(tasks.length>=3&&job.state!=='admitting'&&tasks.every(task=>task.state==='succeeded'))return job;if(tasks.some(task=>['failed','stale','blocked','cancelled'].includes(task.state)))assert.fail(JSON.stringify(job));if(Date.now()>deadline)assert.fail('Memory job timeout '+JSON.stringify(job));await delay(10);}};
 const install=async()=>{assert.ok(release);const preview=await request(admin.token,'/api/plugins/resolve','POST',{repository:release.repository,tag:release.tag}),catalog=await request(admin.token,'/api/admin/plugins');assert.equal(preview.statusCode,200,preview.body);const installed=await request(admin.token,'/api/plugins/install','POST',{previewId:preview.json().id,expectedRevision:catalog.json().revision,operationId:randomUUID()});assert.equal(installed.statusCode,200,installed.body);const pkg=installed.json().packages.find((value:any)=>value.version===release.manifest.version);const deadline=Date.now()+10000;while(node.plugins!.catalog.view().packages.find(value=>value.id===pkg.id)?.state==='installing'){assert.ok(Date.now()<deadline);await delay(5);}return pkg.id as string;};
 const plugin=async(user:any,packageId:string,sourceIds=['same-source'],configuration:Record<string,unknown>={label:'Generated Memory',credential:'personal:same-model'},capabilities:string[]=['repository','retrieval'])=>{const view=await request(user.token,'/api/plugins'),configured=await request(user.token,'/api/plugin-instances','POST',{expectedRevision:view.json().revision,instance:{id:'same-instance',packageId,name:'Generated Memory provider',configuration,desired:false,grants:{capabilities,sourceIds,history:true}}});assert.equal(configured.statusCode,200,configured.body);const checked=await request(user.token,'/api/plugin-instances/same-instance/check','POST',{});assert.equal(checked.statusCode,200,checked.body);const next=await request(user.token,'/api/plugins'),enabled=await request(user.token,'/api/plugin-instances/same-instance/enable','POST',{expectedRevision:next.json().revision});assert.equal(enabled.statusCode,200,enabled.body);};
 const bind=async(user:any,instanceId?:string)=>{const prepared=await request(user.token,'/api/memory/bindings','POST',{operationId:randomUUID(),...(instanceId?{instanceId}:{})});assert.equal(prepared.statusCode,200,prepared.body);const deadline=Date.now()+15000;let view=prepared.json();while(view.state!=='verified'){assert.ok(Date.now()<deadline,JSON.stringify(view));assert.ok(!['failed','blocked','stale'].includes(view.task?.state),JSON.stringify(view));await delay(5);view=(await request(user.token,'/api/memory/bindings/'+view.id)).json();}const state=(await request(user.token,'/api/memory')).json(),activated=await request(user.token,'/api/memory/bindings/'+view.id+'/activate','POST',{expectedRevision:state.revision});assert.equal(activated.statusCode,200,activated.body);return activated.json();};
 const read=<T>(work:(db:DatabaseSync)=>T)=>{const db=new DatabaseSync(join(directory,'mote.sqlite'));try{return work(db);}finally{db.close();}};
 const data=async(user:any)=>{const context=await node.authority.authenticate(user.token),db=new DatabaseSync(join(directory,'mote.sqlite'));t.after(()=>db.close());return new ScopedMemoryData(new PrivateSql(db,context.userId,()=>node.authority.assert(context)),node.services.forUser(context).get<PrivateData>('private-data'),new PrivateCursor(read(db=>String(db.prepare('SELECT cursor_key FROM pd_meta').get()!.cursor_key)),node.deploymentId,context.userId));};
 const terminal=async(taskId:string)=>{const deadline=Date.now()+10000;for(;;){const row=read(db=>db.prepare('SELECT state FROM execution_steps WHERE id=?').get(taskId));if(row&&!['running','waiting'].includes(String(row.state)))return String(row.state);if(Date.now()>deadline)assert.fail('Expected terminal Memory extraction '+JSON.stringify(row));await delay(5);}};
 const lifecycle=async(user:any,purpose:'delete'|'export'|'restore',operationId=randomUUID())=>{lifecycleGrants.set(operationId,{deploymentId,userId:user.userId,domain:'memory',purpose,operationId});return node.services.forLifecycle(await lifecycleAuthority.authorize(operationId));};
 return {get node(){return node;},beforeClose:(callback:()=>void)=>cleanup.push(callback),lifecycle,modelUrl:'http://127.0.0.1:'+(provider.address() as any).port+'/v1',terminal,install,plugin,bind,a,b,admin,directory,request,replace,publish,upload,submit,wait,requests,answers,responses,gates,read,data,restart:async()=>{await node.app.close();node=await buildApp({dataDir:directory},{lifecycleAuthority,...(release?{pluginReleaseTransport:release.transport}:{}),...(hindsightRuntimeFactory?{hindsightRuntimeFactory}:{})});nodes.push(node);}};
}

test('real production Memory extraction/review/publication binds equal Material IDs and entity names before model disclosure',async t=>{
 const f=await fixture(t),am=await f.publish(f.a,'A'),bm=await f.publish(f.b,'B');assert.equal(am.id,bm.id);
 const aj=await f.submit(f.a,[am.id]),bj=await f.submit(f.b,[bm.id]);await Promise.all([f.wait(f.a,aj.id),f.wait(f.b,bj.id)]);
 const ap=await f.request(f.a.token,'/api/memories'),bp=await f.request(f.b.token,'/api/memories');assert.equal(ap.statusCode,200,ap.body);assert.equal(bp.statusCode,200,bp.body);
 assert.equal(ap.json().items.length,1);assert.equal(bp.json().items.length,1);assert.notEqual(ap.json().items[0].id,bp.json().items[0].id);assert.equal(ap.json().items[0].admission.attribution,'third_party');
 assert.equal((await f.request(f.a.token,'/api/memories/'+bp.json().items[0].id)).statusCode,404);assert.equal((await f.request(f.admin.token,'/api/memories/'+ap.json().items[0].id)).statusCode,404);
 assert.equal(f.requests.length,4,'each owner receives a real independent review');
 for(const request of f.requests){const owner=request.key.includes('_A_')?'A':'B',other=owner==='A'?'B':'A';assert.ok(request.raw.includes(text(owner)));assert.ok(!request.raw.includes(text(other)));assert.ok(!request.raw.includes('GENERATED_'+other+'_KEY'));}
});

test('trusted Memory inputs reject foreign hosts, fabricated identities and cross-source Material dependencies',async t=>{
 const f=await fixture(t),material=await f.publish(f.a,'A'),data=await f.data(f.a);assert.equal(data.materialEvidence(material.id,undefined,['same-source']).length,1);assert.throws(()=>data.materialEvidence(material.id,undefined,['other-source']));
 assert.throws(()=>f.node.memory!.forUser({...awaitableIdentity} as any));
 for(const [url,payload] of [['/api/memory/jobs',{materialIds:[material.id],operationId:randomUUID(),userId:f.b.userId}],['/api/memory/stop',{expectedRevision:1,operationId:randomUUID(),ownerId:f.b.userId}]] as const)assert.equal((await f.request(f.a.token,url,'POST',payload)).statusCode,401);
 assert.equal((await f.request(f.b.token,'/api/memory/jobs/'+randomUUID())).statusCode,404);
});
const awaitableIdentity={deploymentId:'generated',userId:'generated',credentialId:'generated',authorizationEpoch:1};

test('stopping automatic work preserves an already admitted manual job and the other user',async t=>{
 const f=await fixture(t),am=await f.publish(f.a,'A'),bm=await f.publish(f.b,'B'),gate={entered:deferred(),release:deferred()};f.gates.set('A',gate);
 const aj=await f.submit(f.a,[am.id]);await gate.entered.promise;
 const before=(await f.request(f.a.token,'/api/memory')).json();assert.equal((await f.request(f.a.token,'/api/memory/stop','POST',{expectedRevision:before.revision,operationId:randomUUID()})).statusCode,200);gate.release.resolve();
 const bj=await f.submit(f.b,[bm.id]);await f.wait(f.b,bj.id);
 await f.wait(f.a,aj.id);
 assert.equal((await f.request(f.a.token,'/api/memories')).json().items.length,1);assert.equal((await f.request(f.b.token,'/api/memories')).json().items.length,1);
});

test('same operation ID is idempotent under concurrent admission without duplicate models or jobs',async t=>{
 const f=await fixture(t),material=await f.publish(f.a,'A'),operationId=randomUUID();const [a,b]=await Promise.all([f.submit(f.a,[material.id],operationId),f.submit(f.a,[material.id],operationId)]);assert.equal(a.id,b.id);await f.wait(f.a,a.id);await f.submit(f.a,[material.id],operationId);assert.equal(f.requests.length,2);
 assert.equal(f.read(db=>Number(db.prepare('SELECT count(*) n FROM mm_jobs WHERE user_id=?').get(f.a.userId)!.n)),1);
});

test('pause drains admitted extraction and review without revoking its durable authority',async t=>{
 const f=await fixture(t),material=await f.publish(f.a,'A'),gate={entered:deferred(),release:deferred()};f.gates.set('A',gate);
 const job=await f.submit(f.a,[material.id]);await gate.entered.promise;const before=(await f.request(f.a.token,'/api/memory')).json();
 const paused=await f.request(f.a.token,'/api/memory/pause','POST',{expectedRevision:before.revision,operationId:randomUUID()});assert.equal(paused.statusCode,200,paused.body);assert.equal(paused.json().generation,before.generation);gate.release.resolve();await f.wait(f.a,job.id);
 assert.equal((await f.request(f.a.token,'/api/memories')).json().items.length,1);
});

test('job cancellation during an actual model request prevents both review and late publication',async t=>{
 const f=await fixture(t),material=await f.publish(f.a,'A'),gate={entered:deferred(),release:deferred()};f.gates.set('A',gate);const job=await f.submit(f.a,[material.id]);await gate.entered.promise;
 assert.equal((await f.request(f.b.token,'/api/memory/jobs/'+job.id+'/cancel','POST',{})).statusCode,404);
 const cancelled=await f.request(f.a.token,'/api/memory/jobs/'+job.id+'/cancel','POST',{});assert.equal(cancelled.statusCode,200,cancelled.body);gate.release.resolve();assert.equal(await f.terminal(job.tasks.extract.id),'cancelled');
 assert.equal((await f.request(f.a.token,'/api/memories')).json().items.length,0);assert.equal(f.read(db=>db.prepare('SELECT draft,review,prepared FROM mm_jobs WHERE user_id=? AND id=?').get(f.a.userId,job.id))!.draft,null);
});

test('retiring source originals while extraction is held revokes the original Memory pin',async t=>{
 const f=await fixture(t),material=await f.publish(f.a,'A'),gate={entered:deferred(),release:deferred()};f.gates.set('A',gate);const job=await f.submit(f.a,[material.id]);await gate.entered.promise;
 assert.equal((await f.request(f.a.token,'/api/sources/same-source','DELETE')).statusCode,200);gate.release.resolve();assert.equal(await f.terminal(job.tasks.extract.id),'stale');
 assert.equal((await f.request(f.a.token,'/api/memories')).json().items.length,0);const data=await f.data(f.a);assert.throws(()=>data.materialEvidence(material.id));
});

test('administrator account disable fences held Memory while another account can finish',async t=>{
 const f=await fixture(t),material=await f.publish(f.a,'A'),other=await f.publish(f.b,'B'),gate={entered:deferred(),release:deferred()};f.gates.set('A',gate);await f.submit(f.a,[material.id]);await gate.entered.promise;
 const disabled=await f.request(f.admin.token,'/api/admin/accounts/'+f.a.userId,'PATCH',{disabled:true});assert.equal(disabled.statusCode,200,disabled.body);gate.release.resolve();
 assert.equal((await f.request(f.a.token,'/api/memories')).statusCode,401);const job=await f.submit(f.b,[other.id]);await f.wait(f.b,job.id);assert.equal((await f.request(f.b.token,'/api/memories')).json().items.length,1);
 assert.equal(f.read(db=>Number(db.prepare('SELECT count(*) n FROM mm_records WHERE user_id=?').get(f.a.userId)!.n)),0);
});

test('Memory pages and cursor signatures are owner-bound and preserve same-name independent records',async t=>{
 const f=await fixture(t);for(const external of ['one','two','three']){const material=await f.publish(f.a,'A','source-'+external,external),job=await f.submit(f.a,[material.id]);await f.wait(f.a,job.id);}
 const page=await f.request(f.a.token,'/api/memories?limit=1');assert.equal(page.statusCode,200,page.body);const cursor=page.json().nextCursor;assert.ok(cursor);assert.equal(page.json().items.length,1);
 assert.equal((await f.request(f.b.token,'/api/memories?limit=1&cursor='+encodeURIComponent(cursor))).statusCode,400);
 assert.equal((await f.request(f.a.token,'/api/memories?limit=2&cursor='+encodeURIComponent(cursor))).statusCode,400);
 const second=await f.request(f.a.token,'/api/memories?limit=1&cursor='+encodeURIComponent(cursor));assert.equal(second.statusCode,200,second.body);assert.notEqual(second.json().items[0].id,page.json().items[0].id);
 assert.equal((await f.request(f.a.token,'/api/memories?query=GENERATED_MEMORY_B')).json().items.length,0);
});

test('deleting a Memory removes owner search results and invalidates an already admitted regeneration',async t=>{
 const f=await fixture(t),material=await f.publish(f.a,'A'),initial=await f.submit(f.a,[material.id]);await f.wait(f.a,initial.id);const memory=(await f.request(f.a.token,'/api/memories')).json().items[0];
 const gate={entered:deferred(),release:deferred()};f.gates.set('A',gate);await f.submit(f.a,[material.id]);await gate.entered.promise;
 assert.equal((await f.request(f.b.token,'/api/memories/'+memory.id,'DELETE')).statusCode,404);assert.equal((await f.request(f.a.token,'/api/memories/'+memory.id,'DELETE')).statusCode,200);gate.release.resolve();
 assert.equal((await f.request(f.a.token,'/api/memories/'+memory.id)).statusCode,404);assert.equal((await f.request(f.a.token,'/api/memories?query=tea')).json().items.length,0);
});

test('manual Memory admission requires its configured model and never borrows another user or chat selection',async t=>{
 const f=await fixture(t),material=await f.publish(f.a,'A');await f.replace(f.a.token,'models',{profiles:[],selections:{}});
 const denied=await f.request(f.a.token,'/api/memory/jobs','POST',{materialIds:[material.id],operationId:randomUUID()});assert.equal(denied.statusCode,503,denied.body);assert.equal(f.requests.length,0);assert.ok(!denied.body.includes('KEY'));
});

test('Memory control commands preserve revision checks, idempotency and per-user command IDs',async t=>{
 const f=await fixture(t),av=(await f.request(f.a.token,'/api/memory')).json(),bv=(await f.request(f.b.token,'/api/memory')).json(),operationId=randomUUID(),input={expectedRevision:av.revision,operationId};
 const paused=await f.request(f.a.token,'/api/memory/pause','POST',input);assert.equal(paused.statusCode,200);assert.equal((await f.request(f.a.token,'/api/memory/pause','POST',input)).statusCode,200);
 assert.equal((await f.request(f.a.token,'/api/memory/stop','POST',input)).statusCode,409);assert.equal((await f.request(f.b.token,'/api/memory/pause','POST',{expectedRevision:bv.revision,operationId})).statusCode,200);
 assert.equal((await f.request(f.a.token,'/api/memory/resume','POST',{expectedRevision:av.revision,operationId:randomUUID()})).statusCode,409);
});

test('restart preserves Memory owner, exact evidence and completed model output without replay',async t=>{
 const f=await fixture(t),material=await f.publish(f.a,'A'),job=await f.submit(f.a,[material.id]);await f.wait(f.a,job.id);const before=(await f.request(f.a.token,'/api/memories')).json();await f.restart();const after=await f.request(f.a.token,'/api/memories');assert.equal(after.statusCode,200,after.body);assert.deepEqual(after.json(),before);await f.submit(f.a,[material.id],job.id);assert.equal(f.requests.length,2);assert.equal((await f.request(f.b.token,'/api/memories')).json().items.length,0);
});

test('a new extraction of the same original applies semantic deletion review rather than regenerating a removed conclusion',async t=>{
 const f=await fixture(t),material=await f.publish(f.a,'A'),job=await f.submit(f.a,[material.id]);await f.wait(f.a,job.id);const memory=(await f.request(f.a.token,'/api/memories')).json().items[0];assert.equal((await f.request(f.a.token,'/api/memories/'+memory.id,'DELETE')).statusCode,200);
 const next=await f.submit(f.a,[material.id]);await f.wait(f.a,next.id);assert.equal((await f.request(f.a.token,'/api/memories')).json().items.length,0);assert.ok(f.requests.some(request=>request.raw.includes('Host Memory deletion review.')));
});

test('Memory lifecycle export and deletion cover only the authorized owner while a held result is fenced',async t=>{
 const f=await fixture(t),am=await f.publish(f.a,'A'),bm=await f.publish(f.b,'B'),aj=await f.submit(f.a,[am.id]),bj=await f.submit(f.b,[bm.id]);await f.wait(f.a,aj.id);await f.wait(f.b,bj.id);
 const aContext=await f.node.authority.authenticate(f.a.token),service=f.node.services.forUser(aContext),archive=await service.exportUser('memory');assert.equal(archive.userId,f.a.userId);assert.ok(JSON.stringify(archive).includes(text('A')));assert.ok(!JSON.stringify(archive).includes(text('B')));assert.ok(!JSON.stringify(archive).includes('GENERATED_A_KEY'));
 const gate={entered:deferred(),release:deferred()};f.gates.set('A',gate);await f.submit(f.a,[am.id]);await gate.entered.promise;
 const deleted=await service.deleteUser('memory',randomUUID());assert.equal(deleted.status,'complete');gate.release.resolve();assert.equal((await f.request(f.a.token,'/api/memories')).statusCode,503);assert.equal((await f.request(f.b.token,'/api/memories')).json().items.length,1);
 assert.equal(f.read(db=>Number(db.prepare('SELECT count(*) n FROM mm_records WHERE user_id=?').get(f.a.userId)!.n)),0);
});

test('portable Memory restore validates exact owner and Material parents, stays stale and is idempotent',async t=>{
 const f=await fixture(t),material=await f.publish(f.a,'A'),job=await f.submit(f.a,[material.id]);await f.wait(f.a,job.id);const context=await f.node.authority.authenticate(f.a.token),service=f.node.services.forUser(context),archive=await service.exportUser('memory'),memory=(archive.payload as any).records[0];
 assert.equal((await f.request(f.a.token,'/api/memories/'+memory.id,'DELETE')).statusCode,200);const operationId=randomUUID();await service.restoreUser('memory',archive,operationId);await service.restoreUser('memory',archive,operationId);
 assert.equal((await f.request(f.a.token,'/api/memories')).json().items.length,0);assert.equal(f.read(db=>JSON.parse(String(db.prepare('SELECT json FROM mm_records WHERE user_id=? AND id=?').get(f.a.userId,memory.id)!.json)).staleReason),'restored_archive');
 const other=f.node.services.forUser(await f.node.authority.authenticate(f.b.token));assert.throws(()=>other.restoreUser('memory',archive,randomUUID()));
 const bad=structuredClone(archive);(bad.payload as any).evidence[0].json='{}';await assert.rejects(service.restoreUser('memory',bad,randomUUID()));
 assert.equal(f.read(db=>Number(db.prepare('SELECT count(*) n FROM mm_restore WHERE user_id=?').get(f.a.userId)!.n)),1);
});

test('actual generated provider migrates and reads exact A/B bodies under the same instance ID across restart',async t=>{
 const f=await fixture(t,generatedMemoryRelease()),packageId=await f.install(),am=await f.publish(f.a,'A'),bm=await f.publish(f.b,'B');await f.plugin(f.a,packageId);await f.plugin(f.b,packageId);
 const aJob=await f.submit(f.a,[am.id]),bJob=await f.submit(f.b,[bm.id]);await Promise.all([f.wait(f.a,aJob.id),f.wait(f.b,bJob.id)]);const beforeA=(await f.request(f.a.token,'/api/memories')).json().items,beforeB=(await f.request(f.b.token,'/api/memories')).json().items;
 const [aBinding,bBinding]=await Promise.all([f.bind(f.a,'same-instance'),f.bind(f.b,'same-instance')]);assert.equal(aBinding.target.instanceId,bBinding.target.instanceId);assert.equal(aBinding.target.revision,bBinding.target.revision);
 const afterA=await f.request(f.a.token,'/api/memories'),afterB=await f.request(f.b.token,'/api/memories');assert.equal(afterA.statusCode,200,afterA.body);assert.equal(afterB.statusCode,200,afterB.body);assert.deepEqual(afterA.json().items,beforeA);assert.deepEqual(afterB.json().items,beforeB);await f.restart();assert.deepEqual((await f.request(f.a.token,'/api/memories')).json().items,beforeA);assert.equal((await f.request(f.a.token,'/api/memories/'+beforeB[0].id)).statusCode,404);
 await f.bind(f.a);assert.deepEqual((await f.request(f.a.token,'/api/memories')).json().items,beforeA);assert.deepEqual((await f.request(f.b.token,'/api/memories')).json().items,beforeB);
});

test('provider binding rejects a same-user source grant that excludes the original dependencies',async t=>{
 const f=await fixture(t,generatedMemoryRelease()),packageId=await f.install(),material=await f.publish(f.a,'A'),job=await f.submit(f.a,[material.id]);await f.wait(f.a,job.id);await f.plugin(f.a,packageId,['other-source']);
 const prepared=await f.request(f.a.token,'/api/memory/bindings','POST',{operationId:randomUUID(),instanceId:'same-instance'});assert.equal(prepared.statusCode,200,prepared.body);assert.equal(await f.terminal(prepared.json().task.id),'blocked');const current=(await f.request(f.a.token,'/api/memory')).json();assert.equal(current.binding.kind,'builtin');assert.equal((await f.request(f.a.token,'/api/memories')).json().items.length,1);
 assert.equal((await f.request(f.b.token,'/api/memory/bindings/'+prepared.json().id)).statusCode,404);assert.equal((await f.request(f.a.token,'/api/memory/bindings/'+prepared.json().id+'/cancel','POST',{})).statusCode,200);
});

test('external provider read/search failures never return the cached SQL Memory body and leave B usable',async t=>{
 const f=await fixture(t,generatedMemoryRelease()),packageId=await f.install(),am=await f.publish(f.a,'A'),bm=await f.publish(f.b,'B');await f.plugin(f.a,packageId);await f.plugin(f.b,packageId);await f.wait(f.a,(await f.submit(f.a,[am.id])).id);await f.wait(f.b,(await f.submit(f.b,[bm.id])).id);const binding=await f.bind(f.a,'same-instance');await f.bind(f.b,'same-instance');
 const context=await f.node.authority.authenticate(f.a.token),descriptor=await f.node.plugins!.domainProvider(context,binding.target.snapshotId,['repository']);
 writeFileSync(join(descriptor.directory,'fail-read'),'generated');const unreadable=await f.request(f.a.token,'/api/memories');assert.equal(unreadable.statusCode,503,unreadable.body);assert.ok(!unreadable.body.includes('Nora'));unlinkSync(join(descriptor.directory,'fail-read'));
 writeFileSync(join(descriptor.directory,'fail-search'),'generated');const unavailable=await f.request(f.a.token,'/api/memories?query=tea');assert.equal(unavailable.statusCode,503,unavailable.body);assert.ok(!unavailable.body.includes('Nora'));assert.equal((await f.request(f.b.token,'/api/memories?query=tea')).json().items.length,1);
});

test('native Mem0 uses actual SDK storage with fixed M04 embedding references and isolated A/B namespaces across restart',async t=>{
 const embeddingRequests:{key:string;raw:string}[]=[],embedding=createServer(async(req,res)=>{let raw='';for await(const chunk of req)raw+=chunk;embeddingRequests.push({key:String(req.headers.authorization),raw});const body=JSON.parse(raw),inputs=Array.isArray(body.input)?body.input:[body.input];res.setHeader('content-type','application/json');res.end(JSON.stringify({object:'list',model:'generated-embedding',data:inputs.map((_:unknown,index:number)=>({object:'embedding',index,embedding:[1,0,0]}))}));});await new Promise<void>(resolve=>embedding.listen(0,'127.0.0.1',resolve));t.after(async()=>{embedding.closeAllConnections();await new Promise<void>(resolve=>embedding.close(()=>resolve()));});
 const embeddingBaseUrl='http://127.0.0.1:'+(embedding.address() as any).port+'/v1',f=await fixture(t,generatedMem0Release()),packageId=await f.install();
 for(const [user,label] of [[f.a,'A'],[f.b,'B']] as const){await f.replace(user.token,'models',{profiles:[{id:'same-model',name:'Generated language model',settings:{...defaultModelSettings(),provider:'custom',protocol:'anthropic-messages',model:'generated-memory',baseUrl:f.modelUrl,apiKey:'GENERATED_'+label+'_KEY',headers:{},extraBody:{}}},{id:'same-embedding',name:'Generated embedding model',settings:{...defaultModelSettings(),provider:'custom',protocol:'openai-completions',model:'generated-embedding',baseUrl:embeddingBaseUrl,apiKey:'GENERATED_EMBEDDING_'+label+'_KEY',headers:{},extraBody:{}}}],selections:{memory:{kind:'personal',id:'same-model'}}});await f.plugin(user,packageId,['same-source'],{embeddingBaseUrl,embeddingModel:'generated-embedding',embeddingDimension:3,embeddingSecretReference:'personal:same-embedding'});}
 const am=await f.publish(f.a,'A'),bm=await f.publish(f.b,'B');await f.wait(f.a,(await f.submit(f.a,[am.id])).id);await f.wait(f.b,(await f.submit(f.b,[bm.id])).id);const aBefore=(await f.request(f.a.token,'/api/memories')).json().items,bBefore=(await f.request(f.b.token,'/api/memories')).json().items;
 await f.bind(f.a,'same-instance');await f.bind(f.b,'same-instance');assert.deepEqual((await f.request(f.a.token,'/api/memories?query=tea')).json().items,aBefore);assert.deepEqual((await f.request(f.b.token,'/api/memories?query=tea')).json().items,bBefore);
 assert.ok(embeddingRequests.some(request=>request.key==='Bearer GENERATED_EMBEDDING_A_KEY'));assert.ok(embeddingRequests.some(request=>request.key==='Bearer GENERATED_EMBEDDING_B_KEY'));
 for(const request of embeddingRequests){const foreign=request.key.includes('_A_')?bBefore:aBefore;for(const memory of foreign){assert.ok(!request.raw.includes(memory.id));for(const id of memory.evidenceIds)assert.ok(!request.raw.includes(id));}}
 await f.restart();assert.deepEqual((await f.request(f.a.token,'/api/memories')).json().items,aBefore);assert.deepEqual((await f.request(f.b.token,'/api/memories')).json().items,bBefore);assert.equal((await f.request(f.a.token,'/api/memories/'+bBefore[0].id)).statusCode,404);
 await f.replace(f.a.token,'models',{profiles:[],selections:{}});const calls=embeddingRequests.length;assert.deepEqual((await f.request(f.a.token,'/api/memories')).json().items,aBefore);assert.equal((await f.request(f.a.token,'/api/memories?query=tea')).statusCode,503);await f.restart();const retained=await f.request(f.a.token,'/api/memories');assert.equal(retained.statusCode,200,retained.body);assert.deepEqual(retained.json().items,aBefore);assert.equal(embeddingRequests.length,calls,'literal recovery must not use revoked embedding credentials');assert.ok(!f.read(db=>String(db.prepare('SELECT json FROM mm_provider_descriptors WHERE user_id=?').get(f.a.userId)!.json)).includes('GENERATED_EMBEDDING_A_KEY'));
});

test('new Memory in an activated external provider uses real extraction/review/publication; provider pause drains only admitted work',async t=>{
 const f=await fixture(t,generatedMemoryRelease()),packageId=await f.install();await f.plugin(f.a,packageId);await f.bind(f.a,'same-instance');const material=await f.publish(f.a,'A'),gate={entered:deferred(),release:deferred()};f.gates.set('A',gate);const job=await f.submit(f.a,[material.id]);await gate.entered.promise;
 const view=(await f.request(f.a.token,'/api/plugins')).json(),paused=await f.request(f.a.token,'/api/plugin-instances/same-instance/pause','POST',{expectedRevision:view.revision});assert.equal(paused.statusCode,200,paused.body);
 const denied=await f.request(f.a.token,'/api/memory/jobs','POST',{materialIds:[material.id],operationId:randomUUID()});assert.equal(denied.statusCode,409,denied.body);gate.release.resolve();await f.wait(f.a,job.id);const memories=await f.request(f.a.token,'/api/memories?query=tea');assert.equal(memories.statusCode,200,memories.body);assert.equal(memories.json().items.length,1);
});

test('native provider configuration cannot combine a scoped model key with a different plugin endpoint',async t=>{
 const f=await fixture(t,generatedMem0Release()),packageId=await f.install();await f.plugin(f.a,packageId,['same-source'],{embeddingBaseUrl:'http://127.0.0.1:9/v1',embeddingModel:'generated-memory',embeddingDimension:3,embeddingSecretReference:'personal:same-model'});
 const prepared=await f.request(f.a.token,'/api/memory/bindings','POST',{operationId:randomUUID(),instanceId:'same-instance'});assert.equal(prepared.statusCode,200,prepared.body);assert.equal(await f.terminal(prepared.json().task.id),'blocked');assert.equal(f.requests.length,0,'no model or unapproved embedding transport may start');assert.equal((await f.request(f.a.token,'/api/memory')).json().binding.kind,'builtin');
});

test('native Hindsight uses the real engine, independent review and exact private read banks across A/B and restart',async t=>{
 const native=await hindsightHttpFixture();t.after(()=>native.close());const f=await fixture(t,generatedHindsightRelease(),native.runtimeFactory),packageId=await f.install();
 for(const user of [f.a,f.b]){await f.plugin(user,packageId,['same-source'],{modelProfileId:'personal:same-model'},['engine']);await f.bind(user,'same-instance');}
 const am=await f.publish(f.a,'A'),bm=await f.publish(f.b,'B');await Promise.all([f.wait(f.a,(await f.submit(f.a,[am.id])).id),f.wait(f.b,(await f.submit(f.b,[bm.id])).id)]);
 assert.notEqual(native.descriptors.find(value=>value.userId===f.a.userId)!.container,native.descriptors.find(value=>value.userId===f.b.userId)!.container);assert.notEqual(native.descriptors.find(value=>value.userId===f.a.userId)!.volume,native.descriptors.find(value=>value.userId===f.b.userId)!.volume);
 assert.equal(f.requests.length,2,'native extraction is followed by one real independent model review per user');
 const a=await f.request(f.a.token,'/api/memories?query=tea'),b=await f.request(f.b.token,'/api/memories?query=tea');assert.equal(a.statusCode,200,a.body);assert.equal(b.statusCode,200,b.body);assert.equal(a.json().items.length,1);assert.equal(b.json().items.length,1);assert.equal(a.json().items[0].admission.attribution,'third_party');
 const ai=a.json().items[0],bi=b.json().items[0];for(const event of native.events){if(![f.a.userId,f.b.userId].includes(event.userId))continue;const foreign=event.userId===f.a.userId?bi:ai,body=JSON.stringify({body:event.body,facts:event.facts});assert.ok(!body.includes(foreign.id));for(const id of foreign.evidenceIds)assert.ok(!body.includes(id));}
 await f.restart();assert.deepEqual((await f.request(f.a.token,'/api/memories')).json().items,[ai]);assert.deepEqual((await f.request(f.b.token,'/api/memories')).json().items,[bi]);assert.equal((await f.request(f.a.token,'/api/memories/'+bi.id)).statusCode,404);
 const originalContainer=native.descriptors.find(value=>value.userId===f.a.userId)!.container;await f.replace(f.a.token,'models',{profiles:[],selections:{}});await f.restart();const retained=await f.request(f.a.token,'/api/memories?query=tea');assert.equal(retained.statusCode,200,retained.body);assert.deepEqual(retained.json().items,[ai]);assert.equal(native.descriptors.filter(value=>value.userId===f.a.userId).at(-1)!.container,originalContainer,'literal recovery keeps the exact original native volume identity');assert.equal(f.requests.length,2,'literal/read-bank recovery must not use a replacement language model');
});

for(const external of [false,true])test('concurrent independent extractions deduplicate only under the real publication coordinator: '+(external?'external provider':'builtin'),async t=>{
 const f=await fixture(t,external?generatedMemoryRelease():undefined);if(external){const packageId=await f.install();await f.plugin(f.a,packageId);await f.bind(f.a,'same-instance');}
 const material=await f.publish(f.a,'A'),[one,two]=await Promise.all([f.submit(f.a,[material.id]),f.submit(f.a,[material.id])]);await Promise.all([f.wait(f.a,one.id),f.wait(f.a,two.id)]);
 const memories=await f.request(f.a.token,'/api/memories');assert.equal(memories.statusCode,200,memories.body);assert.equal(memories.json().items.length,1);assert.equal(f.requests.length,4);assert.ok(memories.json().items[0].strategy.recipe.fingerprint);
 if(external)assert.equal(f.read(db=>Number(db.prepare("SELECT count(*) n FROM mm_provider_journal WHERE user_id=? AND state='acknowledged'").get(f.a.userId)!.n)),1);
});


test('real M06 upload publication admits durable automatic Memory grants for equal user inputs',async t=>{
 const f=await fixture(t);
 for(const user of [f.a,f.b]){const settings=defaultMemorySettings();settings.lifecycle.extraction.minChanges=1;await f.replace(user.token,'memory',settings);await f.replace(user.token,'processing',{...defaultProcessingSettings(),automatic:true,understandingEnabled:false});}
 await Promise.all([f.upload(f.a,'A'),f.upload(f.b,'B')]);
 const end=Date.now()+20000;for(;;){const rows=f.read(db=>db.prepare("SELECT user_id,job_id FROM mm_intakes WHERE state='complete'").all());if(rows.length===2){for(const row of rows)await f.wait(row.user_id===f.a.userId?f.a:f.b,String(row.job_id));break;}assert.ok(Date.now()<end,JSON.stringify(f.read(db=>db.prepare('SELECT * FROM execution_steps').all())));await delay(10);}
 assert.equal(f.requests.length,4);for(const user of [f.a,f.b]){const memories=(await f.request(user.token,'/api/memories')).json().items;assert.equal(memories.length,1);const context=await f.data(user);assert.equal(context.evidence(memories[0].evidenceIds)[0].capturedAt,'2026-01-01T00:00:00.000Z');}
 for(const request of f.requests){const owner=request.key.includes('_A_')?'A':'B';assert.ok(request.raw.includes(text(owner)));assert.ok(!request.raw.includes(text(owner==='A'?'B':'A')));}
 await f.restart();assert.equal(f.requests.length,4);
});


test('every long original range has a durable bounded batch and a retained complete assessment',async t=>{
 const f=await fixture(t),content=Array.from({length:180},(_,index)=>'generated line '+index+' '+('字🌱'.repeat(40))).join('\n'),material=await f.publish(f.a,'A','same-source','long-original',content);
 f.answers.set('A',(_raw,keys)=>({memories:[],coverage:keys.map(key=>({key,state:'no_candidates',candidateIndexes:[]}))}));
 const job=await f.submit(f.a,[material.id]);await f.wait(f.a,job.id);
 const batches=f.read(db=>db.prepare('SELECT input,review,state FROM mm_job_batches WHERE user_id=? AND job_id=?').all(f.a.userId,job.id)),ranges=batches.flatMap(row=>JSON.parse(String(row.input)).ranges).sort((a,b)=>a.offset-b.offset);
 assert.ok(batches.length>1);assert.ok(batches.every(row=>row.state==='committed'&&JSON.parse(String(row.review)).coverage?.incomplete===false));assert.equal(ranges.reduce((sum,range)=>sum+range.length,0),content.length);let at=0;for(const range of ranges){assert.equal(range.offset,at);assert.ok(range.length<=12000);at+=range.length;}assert.equal(f.requests.length,batches.length*2,'each range assessment receives independent review');
 const count=f.requests.length;await f.restart();await f.wait(f.a,job.id);assert.equal(f.requests.length,count);
});

test('real M06 automatic window consumes every authorized receipt once and stop fences only its owner',async t=>{
 const f=await fixture(t);for(const user of [f.a,f.b]){const settings=defaultMemorySettings();settings.lifecycle.extraction.minChanges=user===f.a?2:1;await f.replace(user.token,'memory',settings);await f.replace(user.token,'processing',{...defaultProcessingSettings(),automatic:true,understandingEnabled:false});}
 await f.upload(f.a,'A','window-first');const deadline=Date.now()+10000;while(!f.read(db=>db.prepare('SELECT 1 FROM mm_intakes WHERE user_id=?').get(f.a.userId))){assert.ok(Date.now()<deadline);await delay(5);}assert.equal(f.requests.length,0);
 const gate={entered:deferred(),release:deferred()};f.gates.set('A',gate);await f.upload(f.a,'A','window-second');await gate.entered.promise;
 const receipts=f.read(db=>db.prepare('SELECT job_id FROM mm_intakes WHERE user_id=?').all(f.a.userId));assert.equal(receipts.length,2);assert.equal(new Set(receipts.map(row=>row.job_id)).size,1);
 const state=(await f.request(f.a.token,'/api/memory')).json();assert.equal((await f.request(f.a.token,'/api/memory/stop','POST',{expectedRevision:state.revision,operationId:randomUUID()})).statusCode,200);gate.release.resolve();await f.upload(f.b,'B','other-window');
 const end=Date.now()+15000;for(;;){const rows=f.read(db=>db.prepare("SELECT user_id,id,state FROM mm_jobs WHERE user_id=?").all(f.b.userId));if(rows.length){await f.wait(f.b,String(rows[0].id));break;}assert.ok(Date.now()<end);await delay(10);}
 assert.equal((await f.request(f.a.token,'/api/memories')).json().items.length,0);assert.equal((await f.request(f.b.token,'/api/memories')).json().items.length,1);assert.equal(f.read(db=>db.prepare('SELECT count(*) n FROM mm_intakes WHERE user_id=? AND revoked=1').get(f.a.userId)!.n),2);
});

for(const external of [false,true])test('real integration preserves exact superseded versions through provider migration: '+external,async t=>{
 const f=await fixture(t,external?generatedMemoryRelease():undefined);if(external){const pkg=await f.install();await f.plugin(f.a,pkg);await f.bind(f.a,'same-instance');}
 const old=await f.publish(f.a,'A'),initial=await f.submit(f.a,[old.id]);await f.wait(f.a,initial.id);const parent=(await f.request(f.a.token,'/api/memories')).json().items[0],content='GENERATED_MEMORY_A: Nora now prefers generated coffee instead of generated tea.',updated=await f.publish(f.a,'A','same-source','explicit-replacement',content),data=await f.data(f.a),next=data.materialEvidence(updated.id)[0],oldEvidence=parent.evidenceIds[0];
 f.answers.set('A',()=>({memories:[{title:'Generated explicit replacement',statement:'Nora now prefers generated coffee. ['+next.id+']',uncertainty:'Generated explicit fixture only',admission:{layer:'memory',reason:'Explicit supported change from tea to coffee',scope:'Nora in generated fixture',attribution:'third_party'},relatedMemoryIds:[parent.id],relations:[{kind:'supersedes',memoryId:parent.id,version:parent.version,fingerprint:parent.fingerprint}],evidenceIds:[oldEvidence,next.id],evidence:[{id:oldEvidence,quote:text('A')},{id:next.id,quote:content}]}]}));
 const submitted=await f.request(f.a.token,'/api/memory/jobs','POST',{operationId:randomUUID(),materialIds:[old.id,updated.id],memoryIds:[parent.id],phase:'integrate'});assert.equal(submitted.statusCode,200,submitted.body);await f.wait(f.a,submitted.json().id);
 const previous=await f.request(f.a.token,'/api/memories/'+parent.id+'/versions/1'),current=await f.request(f.a.token,'/api/memories/'+parent.id+'/versions/2');assert.equal(previous.statusCode,200,previous.body);assert.equal(current.statusCode,200,current.body);assert.equal(previous.json().supersededBy,undefined);assert.ok(current.json().supersededBy);assert.equal((await f.request(f.b.token,'/api/memories/'+parent.id+'/versions/1')).statusCode,404);
 if(external)await f.bind(f.a);await f.restart();assert.deepEqual((await f.request(f.a.token,'/api/memories/'+parent.id+'/versions/1')).json(),previous.json());assert.deepEqual((await f.request(f.a.token,'/api/memories/'+parent.id+'/versions/2')).json(),current.json());
});

test('extraction and review fork one immutable M04 configuration even if selection changes during admission',async t=>{
 const f=await fixture(t),material=await f.publish(f.a,'A'),fork=f.node.configuration.forkLease.bind(f.node.configuration),gate={entered:deferred(),release:deferred()};let calls=0;
 f.node.configuration.forkLease=async(...args:Parameters<typeof fork>)=>{const lease=await fork(...args);if(++calls===1){gate.entered.resolve();await gate.release.promise;}return lease;};
 const admitted=f.submit(f.a,[material.id]);await gate.entered.promise;
 await f.replace(f.a.token,'models',{profiles:[{id:'same-model',name:'Retained original model',settings:{...defaultModelSettings(),provider:'custom',protocol:'anthropic-messages',model:'generated-memory',baseUrl:f.modelUrl,apiKey:'GENERATED_A_KEY',headers:{},extraBody:{}}},{id:'replacement',name:'Generated next model',settings:{...defaultModelSettings(),provider:'custom',protocol:'anthropic-messages',model:'generated-next-memory',baseUrl:f.modelUrl,apiKey:'GENERATED_NEXT_A_KEY',headers:{},extraBody:{}}}],selections:{memory:{kind:'personal',id:'replacement'}}});
 gate.release.resolve();const job=await admitted;await f.wait(f.a,job.id);assert.equal(f.requests.length,2);assert.ok(f.requests.every(request=>request.body.model==='generated-memory'&&request.key==='GENERATED_A_KEY'));
 const receipts=f.read(db=>db.prepare("SELECT json_extract(model_receipt,'$.snapshotId') AS snapshot,model_receipt FROM user_tasks WHERE user_id=? AND model_receipt IS NOT NULL").all(f.a.userId));assert.equal(receipts.length,2);assert.equal(new Set(receipts.map(row=>row.snapshot)).size,2,'each actual model call owns a distinct usage identity');
});

test('external export reads actual provider and exact erase reconciles only A after logical deletion',async t=>{
 const f=await fixture(t,generatedMemoryRelease()),pkg=await f.install();for(const user of [f.a,f.b]){await f.plugin(user,pkg);await f.bind(user,'same-instance');const material=await f.publish(user,user===f.a?'A':'B');await f.wait(user,(await f.submit(user,[material.id])).id);}
 const context=await f.node.authority.authenticate(f.a.token),service=f.node.services.forUser(context),before=(await f.request(f.a.token,'/api/memories')).json().items[0],binding=(await f.request(f.a.token,'/api/memory')).json().binding,descriptor=await f.node.plugins!.domainProvider(context,binding.snapshotId,['repository']);
 const archive=await service.exportUser('memory');assert.deepEqual((archive.payload as any).records,[before]);writeFileSync(join(descriptor.directory,'fail-read'),'generated');await assert.rejects(service.exportUser('memory'));unlinkSync(join(descriptor.directory,'fail-read'));
 const deleted=await f.request(f.a.token,'/api/memories/'+before.id,'DELETE');assert.equal(deleted.statusCode,200,deleted.body);assert.equal(await f.terminal(deleted.json().cleanupTaskId),'succeeded');assert.equal((await f.request(f.a.token,'/api/memories/'+before.id)).statusCode,404);assert.equal((await f.request(f.b.token,'/api/memories')).json().items.length,1);
 const writes=f.read(db=>db.prepare('SELECT state,json FROM mm_provider_journal WHERE user_id=?').all(f.a.userId));assert.ok(writes.length);for(const row of writes){assert.ok(['erased','erase_pending'].includes(String(row.state)));assert.ok(!String(row.json).includes('Nora'));assert.equal(JSON.parse(String(row.json)).receipt.currentRemoved,true);}
});


for(const external of [false,true])test('explicit owner correction uses a saved real note and the same exact provider publisher: '+external,async t=>{
 const f=await fixture(t,external?generatedMemoryRelease():undefined);if(external){const pkg=await f.install();await f.plugin(f.a,pkg,['same-source','mote-owner-memory-corrections']);await f.bind(f.a,'same-instance');}
 const material=await f.publish(f.a,'A');await f.wait(f.a,(await f.submit(f.a,[material.id])).id);const original=(await f.request(f.a.token,'/api/memories')).json().items[0],operationId=randomUUID(),command={operationId,correction:{version:original.version,title:'Explicit generated correction',statement:'The generated subject prefers coffee in this fixture.',uncertainty:'Explicit fixture correction'}};
 assert.equal((await f.request(f.b.token,'/api/memories/'+original.id+'/correct','POST',command)).statusCode,404);const corrected=await f.request(f.a.token,'/api/memories/'+original.id+'/correct','POST',command);assert.equal(corrected.statusCode,200,corrected.body);assert.equal(await f.terminal(corrected.json().tasks.correct.id),'succeeded');
 const current=(await f.request(f.a.token,'/api/memories')).json().items;assert.equal(current.length,1);assert.equal(current[0].model,'owner');assert.equal(current[0].correction.memoryId,original.id);const data=await f.data(f.a);assert.equal(data.evidence(current[0].evidenceIds)[0].ocrText,command.correction.statement);assert.equal((await f.request(f.a.token,'/api/memories/'+original.id+'/versions/2')).json().supersededBy,current[0].id);assert.equal(f.requests.length,2,'explicit owner correction adds no inferred model authority');
 assert.equal((await f.request(f.a.token,'/api/memories/'+original.id+'/correct','POST',command)).statusCode,200);assert.equal((await f.request(f.a.token,'/api/memories/'+original.id+'/correct','POST',{...command,correction:{...command.correction,statement:'Different command'}})).statusCode,409);await f.restart();assert.deepEqual((await f.request(f.a.token,'/api/memories')).json().items,current);
});


test('automatic integration uses its own immutable window and genuine M04/M05 model stages',async t=>{
 const f=await fixture(t),settings=defaultMemorySettings();settings.lifecycle.consolidation.minChanges=1;await f.replace(f.a.token,'memory',settings);const material=await f.publish(f.a,'A');await f.wait(f.a,(await f.submit(f.a,[material.id])).id);
 const end=Date.now()+15000;let jobId:string|undefined;while(!jobId){jobId=f.read(db=>db.prepare("SELECT job_id FROM mm_integration_windows WHERE user_id=? AND state='complete'").get(f.a.userId)?.job_id) as string|undefined;assert.ok(Date.now()<end,JSON.stringify(f.read(db=>db.prepare('SELECT * FROM mm_integration_windows').all())));await delay(10);}await f.wait(f.a,jobId);
 assert.equal(f.requests.length,3);assert.ok(f.requests.at(-1)!.raw.includes('supplied-memory-cards'));assert.ok(f.requests.at(-1)!.raw.includes(text('A')));assert.ok(!f.requests.at(-1)!.raw.includes(text('B')));assert.equal((await f.request(f.a.token,'/api/memories')).json().items.length,1);const before=f.requests.length;await f.restart();await f.wait(f.a,jobId);assert.equal(f.requests.length,before);
});


test('late unknown provider writes are observed and erased again without resurrecting a cancelled Memory',async t=>{
 const f=await fixture(t,generatedMemoryRelease()),pkg=await f.install();await f.plugin(f.a,pkg);const binding=await f.bind(f.a,'same-instance'),context=await f.node.authority.authenticate(f.a.token),descriptor=await f.node.plugins!.domainProvider(context,binding.target.snapshotId,['repository']);writeFileSync(join(descriptor.directory,'hold-before-put'),'generated');
 const material=await f.publish(f.a,'A'),job=await f.submit(f.a,[material.id]),end=Date.now()+12000;while(!f.read(db=>db.prepare("SELECT 1 FROM mm_provider_journal WHERE user_id=? AND state='submitted'").get(f.a.userId))){assert.ok(Date.now()<end);await delay(10);}await delay(50);
 const cancelled=await f.request(f.a.token,'/api/memory/jobs/'+job.id+'/cancel','POST',{});assert.equal(cancelled.statusCode,200,cancelled.body);const first=await f.request(f.a.token,'/api/memory/reconcile','POST',{});assert.equal(first.statusCode,200,first.body);assert.equal(await f.terminal(first.json().id),'succeeded');
 writeFileSync(join(descriptor.directory,'release-put'),'generated');const write=f.read(db=>db.prepare('SELECT namespace,key_json FROM mm_provider_journal WHERE user_id=?').get(f.a.userId))!,maintenance=await f.node.memory!.providers.maintenance(context,binding.target,'delete');try{while(!(await maintenance.observe({namespace:JSON.parse(String(write.namespace)),key:JSON.parse(String(write.key_json))})).present){assert.ok(Date.now()<end);await delay(10);}}finally{await maintenance.close();}
 const second=await f.request(f.a.token,'/api/memory/reconcile','POST',{});assert.equal(await f.terminal(second.json().id),'succeeded');const observed=f.read(db=>db.prepare('SELECT state,json FROM mm_provider_journal WHERE user_id=?').get(f.a.userId))!;assert.equal(observed.state,'erase_pending');assert.equal(JSON.parse(String(observed.json)).previousState,'observed');assert.equal(JSON.parse(String(observed.json)).attempt,2);assert.equal((await f.request(f.a.token,'/api/memories')).json().items.length,0);
});

test('purpose-limited Memory lifecycle cleanup works after plugin stop and account disable without touching B',async t=>{
 const f=await fixture(t,generatedMemoryRelease()),pkg=await f.install();for(const user of [f.a,f.b]){await f.plugin(user,pkg);await f.bind(user,'same-instance');const material=await f.publish(user,user===f.a?'A':'B');await f.wait(user,(await f.submit(user,[material.id])).id);}
 const bv=(await f.request(f.b.token,'/api/memories')).json().items,av=(await f.request(f.a.token,'/api/plugins')).json();assert.equal((await f.request(f.a.token,'/api/plugin-instances/same-instance/stop','POST',{expectedRevision:av.revision})).statusCode,200);assert.equal((await f.request(f.admin.token,'/api/admin/accounts/'+f.a.userId,'PATCH',{disabled:true})).statusCode,200);
 const control=await f.lifecycle(f.a,'delete'),deleted=await control.run();assert.equal((deleted as any).status,'pending','native/fixture logical removal never proves physical erase');assert.equal((await f.request(f.a.token,'/api/memories')).statusCode,401);assert.deepEqual((await f.request(f.b.token,'/api/memories')).json().items,bv);
 const rows=f.read(db=>db.prepare('SELECT state,json FROM mm_provider_journal WHERE user_id=?').all(f.a.userId));assert.ok(rows.every(row=>JSON.parse(String(row.json)).receipt.currentRemoved===true&&!String(row.json).includes('Nora')));assert.equal(f.read(db=>db.prepare('SELECT count(*) n FROM mm_records WHERE user_id=?').get(f.a.userId)!.n),0);assert.equal((await control.run() as any).status,'pending');
});


async function imageMaterial(t:TestContext,f:Awaited<ReturnType<typeof fixture>>,user:any,label:string,bytes:Buffer){
 const media=createServer(async(_req,res)=>{res.setHeader('content-type','application/json');res.setHeader('X-Mote-Execution','local');res.end(JSON.stringify({durationMs:0,segments:[{startMs:0,endMs:0,text:'GENERATED_OCR_NAVIGATION_ONLY'}],engine:'generated-ocr'}));});await new Promise<void>(resolve=>media.listen(0,'127.0.0.1',resolve));t.after(async()=>{media.closeAllConnections();await new Promise<void>(resolve=>media.close(()=>resolve()));});
 await f.replace(user.token,'models',{profiles:[{id:'same-model',name:'Generated language model',settings:{...defaultModelSettings(),provider:'custom',protocol:'anthropic-messages',model:'generated-memory',baseUrl:f.modelUrl,apiKey:'GENERATED_'+label+'_KEY'}},{id:'same-ocr',name:'Generated OCR',settings:{...defaultModelSettings(),provider:'custom',protocol:'mote-media',model:'generated-ocr',baseUrl:'http://127.0.0.1:'+(media.address() as any).port,apiKey:'GENERATED_OCR_'+label+'_KEY'}}],selections:{memory:{kind:'personal',id:'same-model'},ocr:{kind:'personal',id:'same-ocr'}}});
 const received=await f.upload(user,label,'same-image',bytes,'image/png'),original=received.captures[0].original.ref,submitted=await f.request(user.token,'/api/processing','POST',{originalRef:original,operationId:'same-image-processing'});assert.equal(submitted.statusCode,200,submitted.body);const end=Date.now()+12000;let materialId:string|undefined;while(!materialId){const state=await f.request(user.token,'/api/processing/originals/'+original.slice(9));assert.equal(state.statusCode,200,state.body);materialId=state.json().materialId;assert.ok(Date.now()<end,state.body);await delay(10);}return materialId;
}

test('actual M06 image originals require independent Memory pixel delivery for both users with equal bytes',async t=>{
 const f=await fixture(t),png=await sharp({create:{width:2,height:2,channels:3,background:'#dd2211'}}).png().toBuffer(),hash=createHash('sha256').update(png).digest('hex'),viewId=createHash('sha256').update(JSON.stringify([hash,'encoded-raster-pixels-v1',null,'original-bytes@1'])).digest('hex'),anchors=new Map<string,string>();
 for(const [user,label] of [[f.a,'A'],[f.b,'B']] as const){const material=await imageMaterial(t,f,user,label,png),data=await f.data(user);data.materialEvidence(material);const anchor=f.read(db=>db.prepare('SELECT id FROM mm_images WHERE user_id=?').get(user.userId))!;anchors.set(label,String(anchor.id));f.responses.set(label,(res,raw,keys)=>{assert.ok(raw.includes(String(anchor.id)));if(!raw.includes('tool_result')){writeMessagesResponse(res,{stage:f.requests.length,tool:{name:'read_image',args:{id:anchor.id,view:'image'}}});return;}writeMessagesResponse(res,{stage:f.requests.length,text:JSON.stringify({answer:JSON.stringify({memories:[{title:'Generated visible observation',statement:'The generated image shows a red patch. ['+anchor.id+']',uncertainty:'Generated pixel observation; authorship and owner identity unknown',admission:{layer:'observation',reason:'Exact visible fixture context',scope:'This generated image only',attribution:'observed'},evidenceIds:[anchor.id],evidence:[{id:anchor.id,image:{originalSha256:hash,viewId}}]}],coverage:keys.map((key,index)=>({key,state:index===keys.length-1?'checked':'no_candidates',candidateIndexes:index===keys.length-1?[0]:[]}))}),citationIds:[anchor.id]})});});await f.wait(user,(await f.submit(user,[material])).id);}
 assert.equal(f.requests.length,8,'each extractor and independent reviewer obtains its own pixels');for(const [user,label] of [[f.a,'A'],[f.b,'B']] as const){const memory=(await f.request(user.token,'/api/memories')).json().items[0];assert.equal(memory.evidence[0].image.original.sha256,hash);assert.equal(memory.evidence[0].id,anchors.get(label));for(const request of f.requests.filter(request=>request.key.includes('_'+label+'_')))assert.ok(!request.raw.includes(anchors.get(label==='A'?'B':'A')!));}
});


test('native Hindsight integration observes a completed consolidation after a lost response instead of replaying inference',async t=>{
 const native=await hindsightHttpFixture();t.after(()=>native.close());const f=await fixture(t,generatedHindsightRelease(),native.runtimeFactory),pkg=await f.install();await f.plugin(f.a,pkg,['same-source'],{modelProfileId:'personal:same-model'},['engine']);await f.bind(f.a,'same-instance');const material=await f.publish(f.a,'A');await f.wait(f.a,(await f.submit(f.a,[material.id])).id);const parent=(await f.request(f.a.token,'/api/memories')).json().items[0];native.faults.consolidateAfterCommit=true;
 const submitted=await f.request(f.a.token,'/api/memory/jobs','POST',{operationId:randomUUID(),materialIds:[material.id],memoryIds:[parent.id],phase:'integrate'});assert.equal(submitted.statusCode,200,submitted.body);assert.equal(await f.terminal(submitted.json().tasks.extract.id),'blocked');const initial=native.events.filter(event=>event.path==='/consolidate').length;
 const retry=await f.request(f.a.token,'/api/tasks/'+submitted.json().tasks.extract.id+'/retry','POST',{});assert.equal(retry.statusCode,200,retry.body);for(const stage of ['review','publish']){const job=(await f.request(f.a.token,'/api/memory/jobs/'+submitted.json().id)).json();if(job.tasks[stage].state==='blocked'){const retried=await f.request(f.a.token,'/api/tasks/'+job.tasks[stage].id+'/retry','POST',{});assert.equal(retried.statusCode,200,retried.body);}}
 await f.wait(f.a,submitted.json().id);assert.equal(native.events.filter(event=>event.path==='/consolidate').length,initial);assert.equal((await f.request(f.a.token,'/api/memories')).json().items.length,1);
});

test('visual Memory cannot publish a selector without actual pixels; text-only native engine refuses visual input explicitly',async t=>{
 const png=await sharp({create:{width:2,height:2,channels:3,background:'#dd2211'}}).png().toBuffer(),hash=createHash('sha256').update(png).digest('hex'),viewId=createHash('sha256').update(JSON.stringify([hash,'encoded-raster-pixels-v1',null,'original-bytes@1'])).digest('hex'),f=await fixture(t),material=await imageMaterial(t,f,f.a,'A',png),data=await f.data(f.a);data.materialEvidence(material);const anchor=String(f.read(db=>db.prepare('SELECT id FROM mm_images WHERE user_id=?').get(f.a.userId))!.id);
 f.answers.set('A',(_raw,keys)=>({memories:[{title:'Unsupported pixels',statement:'Unsupported generated image claim ['+anchor+']',uncertainty:'Generated negative fixture',admission:{layer:'observation',reason:'Generated negative',scope:'Generated image',attribution:'observed'},evidenceIds:[anchor],evidence:[{id:anchor,image:{originalSha256:hash,viewId}}]}],coverage:keys.map((key,index)=>({key,state:index===keys.length-1?'checked':'no_candidates',candidateIndexes:index===keys.length-1?[0]:[]}))}));const job=await f.submit(f.a,[material]);assert.ok(['failed','blocked'].includes(await f.terminal(job.tasks.extract.id)));assert.equal((await f.request(f.a.token,'/api/memories')).json().items.length,0);assert.ok(f.requests.every(request=>!request.raw.includes(png.toString('base64'))));
 const native=await hindsightHttpFixture();t.after(()=>native.close());const g=await fixture(t,generatedHindsightRelease(),native.runtimeFactory),pkg=await g.install();await g.plugin(g.a,pkg,['same-source'],{modelProfileId:'personal:same-model'},['engine']);await g.bind(g.a,'same-instance');const original=await imageMaterial(t,g,g.a,'A',png),denied=await g.submit(g.a,[original]);assert.equal(await g.terminal(denied.tasks.extract.id),'blocked');const result=(await g.request(g.a.token,'/api/memory/jobs/'+denied.id)).json();assert.equal(result.tasks.extract.failure.code,'memory_provider_unsupported_input');assert.equal(g.requests.length,0);
});


test('recipe-specific named ready blocks admit partial originals without reading unrelated pending artifacts',async t=>{
 const f=await fixture(t),material=await f.publish(f.a,'A'),context=await f.node.authority.authenticate(f.a.token),data=await f.data(f.a),sql=new DatabaseSync(join(f.directory,'mote.sqlite'));t.after(()=>sql.close());const draft=JSON.parse(String(sql.prepare('SELECT json FROM pd_material_versions WHERE user_id=? AND material_id=? AND revision=?').get(f.a.userId,material.id,material.revision)!.json));draft.coverage={state:'partial',reason:'visible_window'};draft.artifacts=[{key:'daily-events',state:'ready',revision:'daily-1',blockIds:['same-block']},{key:'unrelated',state:'pending',blockIds:['unrelated']}];draft.blocks.push({id:'unrelated',kind:'text',format:'plain',text:'GENERATED_UNRELATED_PENDING_BODY',memberIds:['original']});
 const updated=f.node.ingress.bindSource(context,['same-source'],()=>{}).publishMaterial(draft,material.revision);assert.throws(()=>data.materialEvidence(updated.id));assert.equal(data.materialEvidence(updated.id,undefined,undefined,['daily-events']).length,1);
 const settings=defaultMemorySettings();settings.recipe={id:'mote.daily-event-memory',version:'2'};await f.replace(f.a.token,'memory',settings);await f.wait(f.a,(await f.submit(f.a,[updated.id])).id);assert.ok(f.requests.every(request=>!request.raw.includes('GENERATED_UNRELATED_PENDING_BODY')));assert.ok(f.requests.some(request=>request.raw.includes('daily event history')));
});

test('declared source narration reaches actual A/B model inputs even through a block attribution refinement',async t=>{
 const f=await fixture(t);for(const [user,label] of [[f.a,'A'],[f.b,'B']] as const){await f.request(user.token,'/api/ingress/sources','POST',{id:'same-source',name:'Generated source',kind:'custom',deviceId:'same-device',platform:'import',retention:'snapshot'});const updated=await f.request(user.token,'/api/sources/same-source/context','PATCH',{expectedVersion:0,description:'GENERATED_DECLARED_NARRATOR_'+label+': Nora is a third-party speaker, not the uploader.'});assert.equal(updated.statusCode,200,updated.body);const material=await f.publish(user,label);await f.wait(user,(await f.submit(user,[material.id])).id);}
 for(const request of f.requests){const owner=request.key.includes('_A_')?'A':'B';assert.ok(request.raw.includes('GENERATED_DECLARED_NARRATOR_'+owner));assert.ok(!request.raw.includes('GENERATED_DECLARED_NARRATOR_'+(owner==='A'?'B':'A')));}
});

test('native Hindsight namespaces separate equal owner-supplied credentials, settings, bytes and entity names',async t=>{
 const native=await hindsightHttpFixture();t.after(()=>native.close());const f=await fixture(t,generatedHindsightRelease(),native.runtimeFactory),pkg=await f.install();await f.replace(f.b.token,'models',{profiles:[{id:'same-model',name:'Generated equal native model',settings:{...defaultModelSettings(),provider:'custom',protocol:'anthropic-messages',model:'generated-memory',baseUrl:f.modelUrl,apiKey:'GENERATED_A_KEY',headers:{},extraBody:{}}}],selections:{memory:{kind:'personal',id:'same-model'}}});
 const evidence:string[][]=[];for(const user of [f.a,f.b]){await f.plugin(user,pkg,['same-source'],{modelProfileId:'personal:same-model'},['engine']);await f.bind(user,'same-instance');const material=await f.publish(user,'A');await f.wait(user,(await f.submit(user,[material.id])).id);evidence.push((await f.request(user.token,'/api/memories')).json().items[0].evidenceIds);}
 const a=native.descriptors.find(item=>item.userId===f.a.userId)!,b=native.descriptors.find(item=>item.userId===f.b.userId)!;assert.notEqual(a.container,b.container);assert.notEqual(a.volume,b.volume);for(const request of f.requests)assert.equal(evidence.filter(ids=>ids.some(id=>request.raw.includes(id))).length,1);assert.equal((await f.request(f.a.token,'/api/memories')).json().items.length,1);assert.equal((await f.request(f.b.token,'/api/memories')).json().items.length,1);
});

test('independent review: binding migration checks transitive source dependencies before provider writes',async t=>{
 const f=await fixture(t,generatedMemoryRelease()),pkg=await f.install(),primary=await f.publish(f.a,'A'),hidden=await f.publish(f.a,'A','hidden-source','hidden'),secret='GENERATED_HIDDEN_SOURCE_SECRET',content=text('A')+' '+secret,context=await f.node.authority.authenticate(f.a.token),bound=f.node.ingress.bindSource(context,['same-source','hidden-source'],()=>{});
 const material=bound.publishMaterial({id:materialId('same-source','composite'),kind:'document',schemaVersion:1,title:'Generated transitive original',origin:{sourceId:'same-source',externalId:'composite'},blocks:[{id:'same-block',kind:'text',format:'plain',text:content,memberIds:['a','h']}],members:[{id:'a',kind:'material',ref:primary.ref},{id:'h',kind:'material',ref:hidden.ref}],coverage:{state:'complete'},fidelity:{state:'lossless'},retention:{original:'retained',policy:'keep'}});
 f.answers.set('A',(_raw,keys,ids)=>({memories:[{title:secret,statement:content+' ['+ids[0]+']',uncertainty:'Synthetic transitive source review',admission:{layer:'memory',reason:'Synthetic explicitly supported statement',scope:'Nora in generated fixture',attribution:'third_party'},evidenceIds:[ids[0]],evidence:[{id:ids[0],quote:content}]}],...(keys.length?{coverage:keys.map(key=>({key,state:'checked',candidateIndexes:[0]}))}:{})}));
 await f.wait(f.a,(await f.submit(f.a,[material.id])).id);await f.plugin(f.a,pkg,['same-source']);
 const prepared=await f.request(f.a.token,'/api/memory/bindings','POST',{operationId:randomUUID(),instanceId:'same-instance'});assert.equal(prepared.statusCode,200,prepared.body);const plan=prepared.json();await f.terminal(plan.task.id);
 const descriptor=await f.node.plugins!.domainProvider(context,plan.target.snapshotId,['repository']),file=join(descriptor.directory,'memory-records.json'),leaked=existsSync(file)&&readFileSync(file,'utf8').includes(secret),view=(await f.request(f.a.token,'/api/memory/bindings/'+plan.id)).json();
 console.log(JSON.stringify({state:view.state,taskState:view.task.state,leaked,sourceScope:descriptor.sourceIds}));
 assert.equal(leaked,false,'plugin granted only same-source received hidden-source dependent Memory during binding migration');
});


test('host-bound Memory read scope filters transitive sources before LIMIT and binds cursor/evidence identity',async t=>{
 const f=await fixture(t),allowed=await f.publish(f.a,'A'),hidden=await f.publish(f.a,'A','hidden-source','hidden'),context=await f.node.authority.authenticate(f.a.token),narrow=f.node.memory!.bindRead(context,{sourceIds:['same-source'],assertCurrent:()=>{}});
 await f.wait(f.a,(await f.submit(f.a,[allowed.id])).id);await f.wait(f.a,(await f.submit(f.a,[hidden.id])).id);
 const broad=f.node.memory!.bindRead(context,{assertCurrent:()=>{}}),all=await broad.page({limit:1}),page=await narrow.page({limit:1});assert.equal(page.items.length,1);assert.equal(page.items[0].evidence[0].sourceId,'same-source');assert.ok(all.nextCursor);await assert.rejects(narrow.page({limit:1,cursor:all.nextCursor}));assert.equal((await f.node.memory!.bindRead(context,{sourceIds:[],assertCurrent:()=>{}}).opening()).items.length,0);
 const projection=narrow.projectMaterial({id:allowed.id,revision:allowed.revision});assert.equal(projection.evidence[0].ocrText,text('A'));narrow.assertEvidence(projection.pins);assert.equal(narrow.isCurrent(projection.pins[0]),true);assert.throws(()=>narrow.projectMaterial({id:hidden.id,revision:hidden.revision}));await assert.rejects(narrow.read((await broad.page({limit:100})).items.find(memory=>memory.evidence[0].sourceId==='hidden-source')!.id));
 let current=true;const ids=['same-source'],held=f.node.memory!.bindRead(context,{sourceIds:ids,assertCurrent:()=>{if(!current)throw Error('Generated revoked scope');}});ids.push('hidden-source');assert.equal((await held.page()).items.length,1,'caller mutation cannot broaden a captured allowlist');current=false;await assert.rejects(held.page(),/revoked scope/);assert.throws(()=>held.evidence(projection.pins.map(pin=>pin.id)),/revoked scope/);
});


test('default Memory policy and recipe objects do not share mutable state between owners',()=>{
 const a=defaultMemorySettings(),b=defaultMemorySettings(),before=structuredClone(b);a.lifecycle.extraction.minChanges=999;a.lifecycle.consolidation.minChanges=999;a.captureRecipes[0].version=999;a.integrationRecipe.version=999;assert.deepEqual(b,before);assert.deepEqual(defaultMemorySettings(),before);
});

test('independent review: deleting an earlier Memory while a later page read is held fences the whole page',async t=>{
 const f=await fixture(t,generatedMemoryRelease()),pkg=await f.install(),one=await f.publish(f.a,'A','same-source','first'),two=await f.publish(f.a,'A','same-source','second');
 await f.wait(f.a,(await f.submit(f.a,[one.id])).id);await f.wait(f.a,(await f.submit(f.a,[two.id])).id);await f.plugin(f.a,pkg);await f.bind(f.a,'same-instance');
 const context=await f.node.authority.authenticate(f.a.token),reader=f.node.memory!.bindRead(context,{sourceIds:['same-source'],assertCurrent:()=>f.node.authority.assert(context)}),page=await reader.page({limit:2});assert.equal(page.items.length,2);
 const deleted=page.items[0],held=page.items[1],binding=(await f.request(f.a.token,'/api/memory')).json().binding,descriptor=await f.node.plugins!.domainProvider(context,binding.snapshotId,['repository']),hold=join(descriptor.directory,'hold-read-'+held.id),started=join(descriptor.directory,'read-started-'+held.id),release=join(descriptor.directory,'release-read-'+held.id);f.beforeClose(()=>writeFileSync(release,'generated'));
 writeFileSync(hold,'generated');const pending=reader.page({limit:2}).then(value=>({value}),error=>({error}));const deadline=Date.now()+15000;while(!existsSync(started)){assert.ok(Date.now()<deadline,'second actual provider read did not start');await delay(5);}
 const removed=await f.request(f.a.token,'/api/memories/'+deleted.id,'DELETE');assert.equal(removed.statusCode,200,removed.body);assert.equal((await f.request(f.a.token,'/api/memories/'+deleted.id)).statusCode,404);writeFileSync(release,'generated');
 const outcome=await pending,leaked='value' in outcome&&outcome.value.items.some(item=>item.id===deleted.id);console.log(JSON.stringify({deletedId:deleted.id,heldId:held.id,leaked,outcome:'error' in outcome?'blocked':'returned'}));assert.equal(leaked,false,'a page must revalidate previously fetched entries before returning after later provider awaits');
});


test('portable external Memory export retains all exact historical bodies and restores only stale builtin authority',async t=>{
 const f=await fixture(t,generatedMemoryRelease()),pkg=await f.install();await f.plugin(f.a,pkg,['same-source','mote-owner-memory-corrections']);await f.bind(f.a,'same-instance');const material=await f.publish(f.a,'A');await f.wait(f.a,(await f.submit(f.a,[material.id])).id);const old=(await f.request(f.a.token,'/api/memories')).json().items[0],corrected=await f.request(f.a.token,'/api/memories/'+old.id+'/correct','POST',{operationId:randomUUID(),correction:{version:old.version,title:'Owner correction',statement:'Generated corrected owner assertion.'}});assert.equal(corrected.statusCode,200,corrected.body);assert.equal(await f.terminal(corrected.json().tasks.correct.id),'succeeded');
 const context=await f.node.authority.authenticate(f.a.token),service=f.node.services.forUser(context),archive=await service.exportUser('memory'),payload=archive.payload as any;assert.equal(payload.coverage.history,true);assert.equal(payload.versions.length,3);assert.equal(payload.versions.find((memory:any)=>memory.id===old.id&&memory.version===1).statement,old.statement);for(const memory of payload.records)assert.equal((await f.request(f.a.token,'/api/memories/'+memory.id,'DELETE')).statusCode,200);await service.restoreUser('memory',archive,randomUUID());
 assert.equal((await f.request(f.a.token,'/api/memories')).json().items.length,0);const restored=f.read(db=>db.prepare('SELECT json FROM mm_versions WHERE user_id=?').all(f.a.userId));assert.equal(restored.length,3);assert.ok(restored.every(row=>JSON.parse(String(row.json)).staleReason==='restored_archive'));assert.equal(f.read(db=>db.prepare("SELECT count(*) n FROM mm_version_bindings WHERE user_id=? AND json_extract(binding,'$.kind')='builtin'").get(f.a.userId)!.n),3);
});


test('external portable Memory export rejects a concurrent earlier-record deletion while another provider body is held',async t=>{
 const f=await fixture(t,generatedMemoryRelease()),pkg=await f.install();for(const id of ['first','second']){const material=await f.publish(f.a,'A','same-source',id);await f.wait(f.a,(await f.submit(f.a,[material.id])).id);}await f.plugin(f.a,pkg);await f.bind(f.a,'same-instance');const context=await f.node.authority.authenticate(f.a.token),service=f.node.services.forUser(context),before=await service.exportUser('memory'),[first,second]=(before.payload as any).records,binding=(await f.request(f.a.token,'/api/memory')).json().binding,descriptor=await f.node.plugins!.domainProvider(context,binding.snapshotId,['repository']),started=join(descriptor.directory,'read-started-'+second.id),release=join(descriptor.directory,'release-read-'+second.id);f.beforeClose(()=>writeFileSync(release,'generated'));writeFileSync(join(descriptor.directory,'hold-read-'+second.id),'generated');
 const pending=service.exportUser('memory').then(value=>({value}),error=>({error})),deadline=Date.now()+10000;while(!existsSync(started)){assert.ok(Date.now()<deadline);await delay(5);}assert.equal((await f.request(f.a.token,'/api/memories/'+first.id,'DELETE')).statusCode,200);writeFileSync(release,'generated');assert.ok('error' in await pending,'an archive cannot mix pre-deletion bodies with a later private catalog');assert.equal((await f.request(f.b.token,'/api/memories')).json().items.length,0);
});
