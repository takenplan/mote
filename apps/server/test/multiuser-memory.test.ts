import test,{type TestContext} from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {setTimeout as delay} from 'node:timers/promises';
import {buildApp} from '../src/app.js';
import {defaultModelSettings} from '../src/model-settings.js';
import {materialId} from '../src/materials.js';
import {writeMessagesResponse} from '../../../scripts/fixtures/messages-provider.js';
import {PrivateSql,PrivateCursor} from '../src/scope/private-data-sql.js';
import {ScopedMemoryData} from '../src/scope/memory-data.js';
import type {PrivateData} from '../src/scope/private-data.js';

const password='Generated-memory-password-only-01';
const protocol={'x-mote-protocol-version':'2','x-mote-ingress-version':'3'};
const text=(owner:string)=>'GENERATED_MEMORY_'+owner+': Nora prefers generated tea.';
const deferred=()=>{let resolve!:()=>void;const promise=new Promise<void>(r=>resolve=r);return {promise,resolve};};
async function fixture(t:TestContext){
 const directory=mkdtempSync(join(tmpdir(),'mote-m07-')),requests:{key:string;body:any;raw:string}[]=[],gates=new Map<string,{entered:ReturnType<typeof deferred>;release:ReturnType<typeof deferred>}>();
 const provider=createServer(async(req,res)=>{
  let raw='';for await(const chunk of req)raw+=chunk;const body=JSON.parse(raw),key=String(req.headers['x-api-key']??''),owner=key.includes('GENERATED_A_KEY')?'A':'B';requests.push({key,body,raw});
  const gate=gates.get(owner);if(gate){gate.entered.resolve();await gate.release.promise;}
  const ids=[...new Set(raw.match(/[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-a[0-9a-f]{3}-[0-9a-f]{12}/g)??[])],id=ids[0];
  const memories=id?[{title:'Generated '+owner,statement:`Nora prefers generated tea. [${id}]`,uncertainty:'Synthetic attributed statement only',admission:{layer:'memory',reason:'Synthetic explicitly expressed preference',scope:'Nora in generated fixture',attribution:'third_party'},evidenceIds:[id],evidence:[{id,quote:text(owner)}]}]:[];
  if(raw.includes('Host Memory deletion review.')){writeMessagesResponse(res,{stage:requests.length,text:JSON.stringify({answer:JSON.stringify({sameConclusion:true,newSupportEvidenceIds:[]}),citationIds:[]})});return;}
  writeMessagesResponse(res,{stage:requests.length,model:'generated-memory',text:JSON.stringify({answer:JSON.stringify({memories}),citationIds:id?[id]:[]})});
 });
 await new Promise<void>(resolve=>provider.listen(0,'127.0.0.1',resolve));
 let node=await buildApp({dataDir:directory});const nodes=[node];
 t.after(async()=>{for(const gate of gates.values())gate.release.resolve();for(const current of nodes.reverse())await current.app.close();provider.closeAllConnections();await new Promise<void>(resolve=>provider.close(()=>resolve()));rmSync(directory,{recursive:true,force:true});});
 await node.accounts!.initialize('generated-admin',password);
 const request=(token:string|undefined,url:string,method:any='GET',payload?:unknown)=>node.app.inject({method,url,headers:{...protocol,...(token?{authorization:'Bearer '+token}:{})},...(payload===undefined?{}:{payload})});
 const login=async(username:string)=>{const response=await request(undefined,'/api/auth/login','POST',{username,password,mode:'client'});assert.equal(response.statusCode,200,response.body);return response.json();};
 const admin=await login('generated-admin'),users:any[]=[];
 for(const label of ['a','b']){const response=await request(admin.token,'/api/admin/accounts','POST',{username:'generated-'+label,password});assert.equal(response.statusCode,200,response.body);users.push({...response.json(),...await login('generated-'+label)});}
 const [a,b]=users;
 const replace=async(token:string,domain:string,value:unknown)=>{const view=await request(token,'/api/configuration'),response=await request(token,'/api/configuration/'+domain,'PUT',{revision:view.json().revision,value});assert.equal(response.statusCode,200,response.body);return response.json();};
 for(const [user,label] of [[a,'A'],[b,'B']] as const)await replace(user.token,'models',{profiles:[{id:'same-model',name:'Generated memory model',settings:{...defaultModelSettings(),provider:'custom',protocol:'anthropic-messages',model:'generated-memory',baseUrl:'http://127.0.0.1:'+(provider.address() as any).port+'/v1',apiKey:'GENERATED_'+label+'_KEY',headers:{},extraBody:{}}}],selections:{memory:{kind:'personal',id:'same-model'}}});
 const publish=async(user:any,label:string,sourceId='same-source',externalId='same-external')=>{
  const context=await node.authority.authenticate(user.token),bound=node.ingress.bindSource(context,[sourceId],()=>{}),register=await request(user.token,'/api/ingress/sources','POST',{id:sourceId,name:'Generated source',kind:'custom',deviceId:'same-device',platform:'import',retention:'snapshot'});assert.equal(register.statusCode,200,register.body);
  const receipt=bound.receiveSourceItems(sourceId,'same-batch',[{externalId,revision:'same-revision',observedAt:'2026-01-01T00:00:00Z',title:'Generated input',text:text(label),kind:'file',layer:'original'}]),captureId=receipt.captures[0].id;
  return bound.publishMaterial({id:materialId(sourceId,externalId),kind:'document',schemaVersion:1,title:'Generated material',origin:{sourceId,externalId,deviceId:'same-device'},blocks:[{id:'same-block',kind:'text',format:'plain',text:text(label),memberIds:['original']}],members:[{id:'original',kind:'capture',ref:'capture:'+captureId}],coverage:{state:'complete'},fidelity:{state:'lossless'},retention:{original:'retained',policy:'keep'}});
 };
 const submit=async(user:any,materialIds:string[],operationId=randomUUID())=>{const response=await request(user.token,'/api/memory/jobs','POST',{materialIds,operationId});assert.equal(response.statusCode,200,response.body);return response.json();};
 const wait=async(user:any,id:string)=>{const deadline=Date.now()+30000;for(;;){const response=await request(user.token,'/api/memory/jobs/'+id);assert.equal(response.statusCode,200,response.body);const job=response.json(),tasks=Object.values(job.tasks) as any[];if(tasks.length===3&&tasks.every(task=>task.state==='succeeded'))return job;if(tasks.some(task=>['failed','stale','blocked','cancelled'].includes(task.state)))assert.fail(JSON.stringify(job));if(Date.now()>deadline)assert.fail('Memory job timeout '+JSON.stringify(job));await delay(10);}};
 const read=<T>(work:(db:DatabaseSync)=>T)=>{const db=new DatabaseSync(join(directory,'mote.sqlite'));try{return work(db);}finally{db.close();}};
 const data=async(user:any)=>{const context=await node.authority.authenticate(user.token),db=new DatabaseSync(join(directory,'mote.sqlite'));t.after(()=>db.close());return new ScopedMemoryData(new PrivateSql(db,context.userId,()=>node.authority.assert(context)),node.services.forUser(context).get<PrivateData>('private-data'),new PrivateCursor(read(db=>String(db.prepare('SELECT cursor_key FROM pd_meta').get()!.cursor_key)),node.deploymentId,context.userId));};
 const terminal=async(taskId:string)=>{const deadline=Date.now()+10000;for(;;){const row=read(db=>db.prepare('SELECT state FROM execution_steps WHERE id=?').get(taskId));if(row&&!['running','waiting'].includes(String(row.state)))return String(row.state);if(Date.now()>deadline)assert.fail('Expected terminal Memory extraction '+JSON.stringify(row));await delay(5);}};
 return {get node(){return node;},terminal,a,b,admin,directory,request,replace,publish,submit,wait,requests,gates,read,data,restart:async()=>{await node.app.close();node=await buildApp({dataDir:directory});nodes.push(node);}};
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

test('stop fences late model results and leaves the other user operational',async t=>{
 const f=await fixture(t),am=await f.publish(f.a,'A'),bm=await f.publish(f.b,'B'),gate={entered:deferred(),release:deferred()};f.gates.set('A',gate);
 const aj=await f.submit(f.a,[am.id]);await gate.entered.promise;
 const before=(await f.request(f.a.token,'/api/memory')).json();assert.equal((await f.request(f.a.token,'/api/memory/stop','POST',{expectedRevision:before.revision,operationId:randomUUID()})).statusCode,200);gate.release.resolve();
 const bj=await f.submit(f.b,[bm.id]);await f.wait(f.b,bj.id);
 assert.equal(await f.terminal(aj.tasks.extract.id),'stale');
 assert.equal((await f.request(f.a.token,'/api/memories')).json().items.length,0);assert.equal((await f.request(f.b.token,'/api/memories')).json().items.length,1);
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
