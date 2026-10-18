import {waitForPluginCheck} from './plugin-check.js';
import type {TestContext} from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {randomUUID} from 'node:crypto';
import {setTimeout as delay} from 'node:timers/promises';
import {writeFileSync,existsSync} from 'node:fs';
import {join} from 'node:path';
import {defaultModelSettings} from '../../src/model-settings.js';
import {defaultMemorySettings} from '../../src/scope/memory-schema.js';
import {defaultProcessingSettings} from '../../src/scope/processing-schema.js';
import {materialId} from '../../src/materials.js';
import {writeMessagesResponse} from '../../../../scripts/fixtures/messages-provider.js';
import {generatedMemoryRelease} from './scoped-memory-release.js';
import {fixture,item} from './ask-reader-host.js';

export const memoryText=(owner:string)=>'GENERATED_MCP_MEMORY_'+owner+': Nora prefers generated tea.';
export async function memoryFixture(t:TestContext,external=false){
 const release=generatedMemoryRelease(),f=await fixture(t,true,external?{pluginReleaseTransport:release.transport}:{}),requests:{owner:string;raw:string}[]=[];
 const provider=createServer(async(req,res)=>{
  let raw='';for await(const chunk of req)raw+=chunk;const owner=String(req.headers['x-api-key']).includes('GENERATED_A_KEY')?'A':'B';requests.push({owner,raw});
  if(raw.includes('GENERATED_MCP_ARTIFACT_REQUEST')){writeMessagesResponse(res,{stage:requests.length,text:JSON.stringify({answer:'GENERATED_OWNED_ARTIFACT_'+owner,citationIds:[]})});return;}
  const ids=[...new Set(raw.match(/[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-a[0-9a-f]{3}-[0-9a-f]{12}/g)??[])],id=ids[0],keys=[...new Set([...raw.matchAll(/\\?"key\\?"\s*:\s*\\?"(member_[0-9]+)/g)].map(match=>match[1]))];
  if(raw.includes('Host Memory deletion review.')){writeMessagesResponse(res,{stage:requests.length,text:JSON.stringify({answer:JSON.stringify({sameConclusion:true,newSupportEvidenceIds:[]}),citationIds:[]})});return;}
  const memories=id?[{title:'Generated '+owner,statement:`Nora prefers generated tea. [${id}]`,uncertainty:'Synthetic attributed statement only',admission:{layer:'memory',reason:'Synthetic explicitly expressed preference',scope:'Nora in generated fixture',attribution:'third_party'},evidenceIds:[id],evidence:[{id,quote:memoryText(owner)}]}]:[];
  writeMessagesResponse(res,{stage:requests.length,model:'generated-memory',text:JSON.stringify({answer:JSON.stringify({memories,...(keys.length?{coverage:keys.map((key,index)=>({key,state:index===0&&memories.length?'checked':'no_candidates',candidateIndexes:index===0&&memories.length?[0]:[]}))}:{})}),citationIds:id?[id]:[]})});
 });
 await new Promise<void>(resolve=>provider.listen(0,'127.0.0.1',resolve));t.after(async()=>{provider.closeAllConnections();await new Promise<void>(resolve=>provider.close(()=>resolve()));});
 const replace=async(user:any,domain:string,value:unknown)=>{const view=await f.ok(user.token,'/api/configuration');return f.ok(user.token,'/api/configuration/'+domain,'PUT',{revision:view.revision,value});};
 for(const [user,owner]of [[f.a,'A'],[f.b,'B']] as const){await replace(user,'models',{profiles:[{id:'same-model',name:'Generated Memory model',settings:{...defaultModelSettings(),provider:'custom',protocol:'anthropic-messages',model:'generated-memory',baseUrl:'http://127.0.0.1:'+(provider.address() as any).port+'/v1',apiKey:'GENERATED_'+owner+'_KEY'}}],selections:{memory:{kind:'personal',id:'same-model'}}});await replace(user,'processing',{...defaultProcessingSettings(),automatic:false,understandingEnabled:false});await replace(user,'memory',{...defaultMemorySettings(),automatic:false,integration:false});}
 const publish=async(user:any,owner:string,sourceId='same-source',externalId='same-external')=>{
  const context=await f.node.authority.authenticate(user.token),bound=f.node.ingress.bindSource(context,[sourceId],()=>{}),receipt=bound.receiveSourceItems(sourceId,'batch:'+externalId,[{...item(memoryText(owner),externalId),kind:'file',layer:'original'}]);
  return bound.publishMaterial({id:materialId(sourceId,externalId),kind:'document',schemaVersion:1,title:'Generated Material',origin:{sourceId,externalId},blocks:[{id:'same-block',kind:'text',format:'plain',text:memoryText(owner),memberIds:['original']}],members:[{id:'original',kind:'capture',ref:'capture:'+receipt.captures[0].id}],coverage:{state:'complete'},fidelity:{state:'lossless'},retention:{original:'retained',policy:'keep'}});
 };
 const wait=async(user:any,id:string)=>{const deadline=Date.now()+30000;for(;;){const job=await f.ok(user.token,'/api/memory/jobs/'+id),tasks=Object.values(job.tasks) as any[];if(tasks.length>=3&&job.state!=='admitting'&&tasks.every(task=>task.state==='succeeded'))return job;assert.ok(!tasks.some(task=>['failed','stale','blocked','cancelled'].includes(task.state)),JSON.stringify(job));assert.ok(Date.now()<deadline,JSON.stringify(job));await delay(10);}};
 const extract=async(user:any,id:string)=>{const job=await f.ok(user.token,'/api/memory/jobs','POST',{operationId:randomUUID(),materialIds:[id]});await wait(user,job.id);return job;};
 const externalize=async(users:any[]=[f.a,f.b])=>{
  assert.ok(external);const preview=await f.ok(f.admin.token,'/api/plugins/resolve','POST',{repository:release.repository,tag:release.tag}),catalog=await f.ok(f.admin.token,'/api/admin/plugins'),installed=await f.ok(f.admin.token,'/api/plugins/install','POST',{previewId:preview.id,expectedRevision:catalog.revision,operationId:randomUUID()}),pkg=installed.packages.find((value:any)=>value.version===release.manifest.version),deadline=Date.now()+10000;
  while(f.node.plugins!.catalog.view().packages.find(value=>value.id===pkg.id)?.state==='installing'){assert.ok(Date.now()<deadline);await delay(5);}
  const directories=new Map<string,string>();for(const user of users){const view=await f.ok(user.token,'/api/plugins');await f.ok(user.token,'/api/plugin-instances','POST',{expectedRevision:view.revision,instance:{id:'same-instance',packageId:pkg.id,name:'Generated Memory provider',configuration:{label:'Generated Memory',credential:'personal:same-model'},desired:false,grants:{capabilities:['repository','retrieval'],sourceIds:['same-source','other-source','mote-owner-memory-corrections'],history:true}}});await waitForPluginCheck(await f.ok(user.token,'/api/plugin-instances/same-instance/check','POST',{}),id=>f.ok(user.token,'/api/tasks/'+id));const next=await f.ok(user.token,'/api/plugins');await f.ok(user.token,'/api/plugin-instances/same-instance/enable','POST',{expectedRevision:next.revision});let binding=await f.ok(user.token,'/api/memory/bindings','POST',{operationId:randomUUID(),instanceId:'same-instance'});const end=Date.now()+15000;while(binding.state!=='verified'){assert.ok(Date.now()<end,JSON.stringify(binding));assert.ok(!['failed','blocked','stale'].includes(binding.task?.state),JSON.stringify(binding));await delay(5);binding=await f.ok(user.token,'/api/memory/bindings/'+binding.id);}const state=await f.ok(user.token,'/api/memory');await f.ok(user.token,'/api/memory/bindings/'+binding.id+'/activate','POST',{expectedRevision:state.revision});const context=await f.node.authority.authenticate(user.token),descriptor=await f.node.plugins!.domainProvider(context,binding.target.snapshotId,['repository']);directories.set(user.userId,descriptor.directory);}
  return directories;
 };
 const enableAsk=async(user:any,owner:string)=>replace(user,'models',{profiles:[{id:'same-model',name:'Generated Memory and Ask',settings:{...defaultModelSettings(),provider:'custom',protocol:'anthropic-messages',model:'generated-memory',baseUrl:'http://127.0.0.1:'+(provider.address() as any).port+'/v1',apiKey:'GENERATED_'+owner+'_KEY'}}],selections:{memory:{kind:'personal',id:'same-model'},chat:{kind:'personal',id:'same-model'}}});
 const hold=(directory:string,id:string)=>{const started=join(directory,'read-started-'+id),release=join(directory,'release-read-'+id);writeFileSync(join(directory,'hold-read-'+id),'generated');f.beforeClose(()=>{if(existsSync(directory))writeFileSync(release,'generated');});return {release:()=>writeFileSync(release,'generated'),entered:async()=>{const end=Date.now()+10000;while(!existsSync(started)){assert.ok(Date.now()<end,'actual provider read barrier');await delay(5);}}};};
 return {...f,get node(){return f.node;},replace,publish,extract,wait,externalize,hold,requests,enableAsk};
}
