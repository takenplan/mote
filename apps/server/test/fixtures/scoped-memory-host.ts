import type {TestContext} from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {setTimeout as delay} from 'node:timers/promises';
import {LifecycleAuthority} from '../../src/scope/lifecycle.js';
import {openScopeStorage} from '../../src/scope/storage.js';
import {buildApp} from '../../src/app.js';
import {defaultProcessingSettings} from '../../src/scope/processing-schema.js';
import {defaultModelSettings} from '../../src/model-settings.js';
import {materialId} from '../../src/materials.js';
import {writeMessagesResponse} from '../../../../scripts/fixtures/messages-provider.js';
import {generatedMemoryRelease} from './scoped-memory-release.js';
import type {HindsightRuntimeFactory} from '../../src/scope/memory-providers.js';
import {PrivateSql,PrivateCursor} from '../../src/scope/private-data-sql.js';
import {ScopedMemoryData} from '../../src/scope/memory-data.js';
import type {PrivateData} from '../../src/scope/private-data.js';
const password='Generated-memory-password-only-01';
const protocol={'x-mote-protocol-version':'2','x-mote-ingress-version':'3'};
const text=(owner:string)=>'GENERATED_MEMORY_'+owner+': Nora prefers generated tea.';
const deferred=()=>{let resolve!:()=>void;const promise=new Promise<void>(r=>resolve=r);return {promise,resolve};};
export async function scopedMemoryFixture(t:TestContext,release?:ReturnType<typeof generatedMemoryRelease>,hindsightRuntimeFactory?:HindsightRuntimeFactory){
 const directory=mkdtempSync(join(tmpdir(),'mote-m07-')),requests:{key:string;body:any;raw:string}[]=[],answers=new Map<string,(raw:string,keys:string[],ids:string[])=>unknown>(),responses=new Map<string,(res:any,raw:string,keys:string[],ids:string[])=>void>(),gates=new Map<string,{entered:ReturnType<typeof deferred>;release:ReturnType<typeof deferred>}>();
 const provider=createServer(async(req,res)=>{
  let raw='';for await(const chunk of req)raw+=chunk;const body=JSON.parse(raw),key=String(req.headers['x-api-key']??''),owner=key.includes('GENERATED_A_KEY')?'A':'B';requests.push({key,body,raw});
  const gate=gates.get(owner);if(gate){gate.entered.resolve();await gate.release.promise;}
  const ids=[...new Set(raw.match(/[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-a[0-9a-f]{3}-[0-9a-f]{12}/g)??[])],id=ids[0];
  const targetScope=raw.match(/\\?"members\\?"\s*:\s*(\[.*?\])\s*,\s*\\?"contextMembers\\?"\s*:/s)?.[1]??raw;
  const keys=[...new Set([...targetScope.matchAll(/\\?"key\\?"\s*:\s*\\?"(member_[0-9]+)/g)].map(match=>match[1]))];
  const scripted=responses.get(owner);if(scripted){scripted(res,raw,keys,ids);return;}
  // Coding preparation is a distinct production model pass. Default fixtures
  // return valid empty semantic products before their ordinary Memory script.
  if(raw.includes('FINAL UNIFIED RESPONSE CONTRACT:')){const envelope=JSON.parse(typeof body.messages[0].content==='string'?body.messages[0].content:body.messages[0].content[0].text),seed=envelope.untrustedEvidence[0],answer={summary:'Generated Coding conversation summary.',evidence:[{id:seed.id,quote:seed.ocrText}],workRecords:[],events:[],memoryCandidates:[],actionCues:[],coverage:keys.map(key=>({key,state:'no_candidates',candidateIndexes:[]}))};writeMessagesResponse(res,{stage:requests.length,model:'generated-memory',text:JSON.stringify({answer:JSON.stringify(answer),citationIds:[seed.id]})});return;}
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
 const upload=async(user:any,label:string,externalId='same-upload',supplied?:Buffer,mimeType='text/plain',importDeclaration?:unknown,batchId=externalId)=>{
  const source=await request(user.token,'/api/ingress/sources','POST',{id:'same-source',name:'Generated source',kind:'local-files',deviceId:'same-device',platform:'import',retention:'archive'});assert.equal(source.statusCode,200,source.body);
  const bytes=supplied??Buffer.from(text(label)),checksum=createHash('sha256').update(bytes).digest('hex'),opened=await request(user.token,'/api/ingress/sources/same-source/uploads','POST',{batchId,...(importDeclaration?{importDeclaration}:{}),revision:{sourceId:'same-source',item:{externalId,revision:'same-revision',observedAt:'2026-01-01T00:00:00Z',title:'Generated original',text:'',kind:'file',layer:'original',mimeType},sizeBytes:bytes.length,sha256:checksum,relativePath:'generated.txt'}});assert.equal(opened.statusCode,200,opened.body);
  const part=await request(user.token,'/api/ingress/uploads/'+opened.json().id+'/parts/0','PUT',{bytes:bytes.toString('base64'),checksum});assert.equal(part.statusCode,200,part.body);const commit=await request(user.token,'/api/ingress/uploads/'+opened.json().id+'/commit','POST',{});assert.equal(commit.statusCode,200,commit.body);return commit.json();
 };
 const publish=async(user:any,label:string,sourceId='same-source',externalId='same-external',content=text(label))=>{
  const context=await node.authority.authenticate(user.token),bound=node.ingress.bindSource(context,[sourceId],()=>{}),register=await request(user.token,'/api/ingress/sources','POST',{id:sourceId,name:'Generated source',kind:'custom',deviceId:'same-device',platform:'import',retention:'snapshot'});assert.equal(register.statusCode,200,register.body);
  const receipt=bound.receiveSourceItems(sourceId,'batch:'+externalId,[{externalId,revision:'same-revision',observedAt:'2026-01-01T00:00:00Z',title:'Generated input',text:content,kind:'file',layer:'original'}]),captureId=receipt.captures[0].id;
  return bound.publishMaterial({id:materialId(sourceId,externalId),kind:'document',schemaVersion:1,title:'Generated material',origin:{sourceId,externalId,deviceId:'same-device'},blocks:[{id:'same-block',kind:'text',format:'plain',text:content,memberIds:['original']}],members:[{id:'original',kind:'capture',ref:'capture:'+captureId}],coverage:{state:'complete'},fidelity:{state:'lossless'},retention:{original:'retained',policy:'keep'}});
 };
 const submit=async(user:any,materialIds:string[],operationId=randomUUID())=>{const response=await request(user.token,'/api/memory/jobs','POST',{materialIds,operationId});assert.equal(response.statusCode,200,response.body);return response.json();};
 const wait=async(user:any,id:string)=>{const deadline=Date.now()+30000;for(;;){const response=await request(user.token,'/api/memory/jobs/'+id);assert.equal(response.statusCode,200,response.body);const job=response.json(),tasks=Object.values(job.tasks) as any[];if(tasks.length>=1&&job.state!=='admitting'&&tasks.every(task=>task.state==='succeeded'))return job;if(tasks.some(task=>['failed','stale','blocked','cancelled'].includes(task.state)))assert.fail(JSON.stringify(job));if(Date.now()>deadline)assert.fail('Memory job timeout '+JSON.stringify(job));await delay(10);}};
 const install=async()=>{assert.ok(release);const preview=await request(admin.token,'/api/plugins/resolve','POST',{repository:release.repository,tag:release.tag}),catalog=await request(admin.token,'/api/admin/plugins');assert.equal(preview.statusCode,200,preview.body);const installed=await request(admin.token,'/api/plugins/install','POST',{previewId:preview.json().id,expectedRevision:catalog.json().revision,operationId:randomUUID()});assert.equal(installed.statusCode,200,installed.body);const pkg=installed.json().packages.find((value:any)=>value.version===release.manifest.version);const deadline=Date.now()+10000;while(node.plugins!.catalog.view().packages.find(value=>value.id===pkg.id)?.state==='installing'){assert.ok(Date.now()<deadline);await delay(5);}return pkg.id as string;};
 const plugin=async(user:any,packageId:string,sourceIds=['same-source'],configuration:Record<string,unknown>={label:'Generated Memory',credential:'personal:same-model'},capabilities:string[]=['repository','retrieval'])=>{const view=await request(user.token,'/api/plugins'),configured=await request(user.token,'/api/plugin-instances','POST',{expectedRevision:view.json().revision,instance:{id:'same-instance',packageId,name:'Generated Memory provider',configuration,desired:false,grants:{capabilities,sourceIds,history:true}}});assert.equal(configured.statusCode,200,configured.body);const checked=await request(user.token,'/api/plugin-instances/same-instance/check','POST',{});assert.equal(checked.statusCode,200,checked.body);const next=await request(user.token,'/api/plugins'),enabled=await request(user.token,'/api/plugin-instances/same-instance/enable','POST',{expectedRevision:next.json().revision});assert.equal(enabled.statusCode,200,enabled.body);};
 const bind=async(user:any,instanceId?:string)=>{const prepared=await request(user.token,'/api/memory/bindings','POST',{operationId:randomUUID(),...(instanceId?{instanceId}:{})});assert.equal(prepared.statusCode,200,prepared.body);const deadline=Date.now()+15000;let view=prepared.json();while(view.state!=='verified'){assert.ok(Date.now()<deadline,JSON.stringify(view));assert.ok(!['failed','blocked','stale'].includes(view.task?.state),JSON.stringify(view));await delay(5);view=(await request(user.token,'/api/memory/bindings/'+view.id)).json();}const state=(await request(user.token,'/api/memory')).json(),activated=await request(user.token,'/api/memory/bindings/'+view.id+'/activate','POST',{expectedRevision:state.revision});assert.equal(activated.statusCode,200,activated.body);return activated.json();};
 const read=<T>(work:(db:DatabaseSync)=>T)=>{const db=new DatabaseSync(join(directory,'mote.sqlite'));try{return work(db);}finally{db.close();}};
 const data=async(user:any)=>{const context=await node.authority.authenticate(user.token),db=new DatabaseSync(join(directory,'mote.sqlite'));t.after(()=>db.close());return new ScopedMemoryData(new PrivateSql(db,context.userId,()=>node.authority.assert(context)),node.services.forUser(context).get<PrivateData>('private-data'),new PrivateCursor(read(db=>String(db.prepare('SELECT cursor_key FROM pd_meta').get()!.cursor_key)),node.deploymentId,context.userId));};
 const terminal=async(taskId:string)=>{const deadline=Date.now()+10000;for(;;){const row=read(db=>db.prepare('SELECT state FROM execution_steps WHERE id=?').get(taskId));if(row&&!['running','waiting'].includes(String(row.state)))return String(row.state);if(Date.now()>deadline)assert.fail('Expected terminal Memory extraction '+JSON.stringify(row));await delay(5);}};
 const lifecycle=async(user:any,purpose:'delete'|'export'|'restore',operationId=randomUUID(),domain='memory')=>{lifecycleGrants.set(operationId,{deploymentId,userId:user.userId,domain,purpose,operationId});return node.services.forLifecycle(await lifecycleAuthority.authorize(operationId));};
 return {get node(){return node;},beforeClose:(callback:()=>void)=>cleanup.push(callback),lifecycle,modelUrl:'http://127.0.0.1:'+(provider.address() as any).port+'/v1',terminal,install,plugin,bind,a,b,admin,directory,request,replace,publish,upload,submit,wait,requests,answers,responses,gates,read,data,restart:async()=>{await node.app.close();node=await buildApp({dataDir:directory},{lifecycleAuthority,...(release?{pluginReleaseTransport:release.transport}:{}),...(hindsightRuntimeFactory?{hindsightRuntimeFactory}:{})});nodes.push(node);}};
}
