import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {randomUUID} from 'node:crypto';
import {waitForState} from './fixtures/scoped-query-accounts.js';
import {fixture} from './fixtures/scoped-actions.js';
import {defaultModelSettings} from '../src/model-settings.js';
import {writeMessagesResponse} from '../../../scripts/fixtures/messages-provider.js';

const connection=(key='GENERATED_A_KEY')=>({...defaultModelSettings(),provider:'custom',protocol:'anthropic-messages' as const,reasoningEffort:'auto' as const,baseUrl:'https://generated.invalid/v1',model:'generated-model',apiKey:key,headers:{},extraBody:{}});
const models=(settings:ReturnType<typeof connection>,selections:unknown={})=>({profiles:[{id:'same-profile',name:'Generated connection',settings}],selections});
const saved=(view:any)=>view.domains.find((domain:any)=>domain.id==='models').saved;

// Generated inputs exercise the real account/configuration HTTP entry points.
// No personal archive reader, provider account or external network is used.
test('target changes require explicit retention decisions across personal PUT, PATCH and batch views for every credential component',async t=>{
 const f=await fixture(t),service=async()=>f.node.configuration.forUser(await f.node.authority.authenticate(f.a.token));
 for(const target of ['provider','protocol','baseUrl'] as const)for(const credential of ['apiKey','headers','extraBody'] as const){
  const settings={...connection(''),[credential]:credential==='apiKey'?'GENERATED_SECRET':credential==='headers'?{'x-generated-secret':'GENERATED_SECRET'}:{generatedSecret:'GENERATED_SECRET'}};
  let view=await f.ok(f.a.token,'/api/configuration');view=await f.ok(f.a.token,'/api/configuration/models','PUT',{revision:view.revision,value:models(settings)});
  const draft=saved(view),changed=target==='provider'?'anthropic':target==='protocol'?'openai-completions':'https://other-generated.invalid/v1';draft.profiles[0].settings[target]=changed;
  const denied=await f.request(f.a.token,'/api/configuration/models','PUT',{revision:view.revision,value:draft,preserveRedactedSecrets:true});assert.equal(denied.statusCode,409,denied.body);assert.equal(denied.json().error,'model_settings_credential_reuse');assert.doesNotMatch(denied.body,/GENERATED_SECRET/);
  const patch=await f.request(f.a.token,'/api/configuration','PATCH',{revision:view.revision,patches:{models:draft},preserveRedactedSecrets:true});assert.equal(patch.statusCode,409,patch.body);assert.equal(patch.json().error,'model_settings_credential_reuse');
  await assert.rejects((await service()).replaceViews({models:draft},view.revision),{code:'model_settings_credential_reuse'});
  assert.equal((await f.ok(f.a.token,'/api/configuration')).revision,view.revision);
  const confirmed=await f.ok(f.a.token,'/api/configuration','PATCH',{revision:view.revision,patches:{models:draft},preserveRedactedSecrets:true,allowCredentialReuse:true});assert.equal(saved(confirmed).profiles[0].settings[target],changed);
  // An explicit replacement or clear is the original alternative to reuse.
  for(const clear of [false,true]){
   view=await f.ok(f.a.token,'/api/configuration/models','PUT',{revision:confirmed.revision+(clear?2:0),value:models(settings)});
   const next=saved(view);next.profiles[0].settings[target]=changed;next.profiles[0].settings[credential]=credential==='apiKey'?(clear?'':'GENERATED_REPLACEMENT'):clear?{}:{[credential==='headers'?'x-generated-secret':'generatedSecret']:'GENERATED_REPLACEMENT'};
   await f.ok(f.a.token,'/api/configuration/models','PUT',{revision:view.revision,value:next,preserveRedactedSecrets:true});
  }
 }
});

test('unsaved personal drafts discover and probe before save, never silently send retained keys to another target, and stay account isolated',async t=>{
 const requests:{method:string;path:string;key:string;raw:string}[]=[];
 const provider=createServer((request,response)=>{void(async()=>{let raw='';for await(const chunk of request)raw+=chunk;requests.push({method:request.method!,path:request.url!,key:String(request.headers['x-api-key']),raw});if(request.method==='GET'){response.setHeader('content-type','application/json');response.end(JSON.stringify({data:[{id:'generated-draft-model'}]}));return;}
  const body=JSON.parse(raw),uses=body.messages.flatMap((message:any)=>Array.isArray(message.content)?message.content.filter((part:any)=>part.type==='tool_use'):[]),id='7a8f56d1-45de-47b7-90bb-5e84d411c3d6',stage=uses.length+1;
  if(!uses.some((use:any)=>use.name==='search_context'))return writeMessagesResponse(response,{stage,tool:{name:'search_context',args:{query:'generated synthetic test'}}});
  if(!uses.some((use:any)=>use.name==='evidence'))return writeMessagesResponse(response,{stage,tool:{name:'evidence',args:{ids:[id]}}});
  writeMessagesResponse(response,{stage,text:JSON.stringify({answer:'GENERATED_DRAFT_PROBE ['+id+']',citationIds:[id]})});
 })().catch(()=>response.destroy());});await new Promise<void>(r=>provider.listen(0,'127.0.0.1',r));t.after(async()=>{provider.closeAllConnections();await new Promise<void>(r=>provider.close(()=>r()));});
 const f=await fixture(t),baseUrl='http://127.0.0.1:'+(provider.address() as any).port+'/v1';
 for(const [user,label]of [[f.a,'A'],[f.b,'B']]as const){const view=await f.ok(user.token,'/api/configuration');await f.ok(user.token,'/api/configuration/models','PUT',{revision:view.revision,value:models({...connection('GENERATED_'+label+'_KEY'),baseUrl}, {chat:{kind:'personal',id:'same-profile'}})});}
 const before=await f.ok(f.a.token,'/api/configuration'),draft={...saved(before).profiles[0].settings,model:'generated-unsaved-model'},input={revision:before.revision,reference:{kind:'personal',id:'same-profile'},draft};
 assert.deepEqual((await f.ok(f.a.token,'/api/models/catalog','POST',input)).items.map((item:any)=>item.id),['generated-draft-model']);assert.equal((await f.ok(f.a.token,'/api/models/probe','POST',input)).ok,true);
 assert.equal((await f.ok(f.a.token,'/api/configuration')).revision,before.revision);assert.equal((await f.ok(f.a.token,'/api/models/selection/chat')).model,'generated-model');assert.ok(requests.every(request=>request.key==='GENERATED_A_KEY'));assert.ok(requests.filter(request=>request.method==='POST').every(request=>JSON.parse(request.raw).model==='generated-unsaved-model'));
 const count=requests.length,changed={...input,draft:{...draft,baseUrl:baseUrl+'/other'}};
 for(const endpoint of ['catalog','probe']){const response=await f.request(f.a.token,'/api/models/'+endpoint,'POST',changed);assert.equal(response.statusCode,409,response.body);assert.equal(response.json().error,'model_settings_credential_reuse');}assert.equal(requests.length,count);
 await f.ok(f.a.token,'/api/models/catalog','POST',{...changed,allowCredentialReuse:true});assert.equal(requests.at(-1)!.key,'GENERATED_A_KEY');
 const b=await f.ok(f.b.token,'/api/configuration');await f.ok(f.b.token,'/api/models/catalog','POST',{revision:b.revision,reference:input.reference,draft:{...draft,baseUrl}});assert.equal(requests.at(-1)!.key,'GENERATED_B_KEY');
 await f.ok(f.a.token,'/api/models/catalog','POST',{revision:before.revision,reference:{kind:'personal',id:'brand-new'},draft:{...connection('GENERATED_NEW_KEY'),baseUrl,model:''}});assert.equal(requests.at(-1)!.key,'GENERATED_NEW_KEY');assert.equal(saved(await f.ok(f.a.token,'/api/configuration')).profiles.length,1);
 const forbidden=await f.request(f.a.token,'/api/models/catalog','POST',{...input,reference:{kind:'shared',id:'env:deployment'}});assert.equal(forbidden.statusCode,400,forbidden.body);
 assert.equal((await f.ok(f.a.token,'/api/tasks')).items.length,0);assert.equal((await f.ok(f.a.token,'/api/query-runs')).items.length,0);
});

test('one personal connection persists different per-feature models and recovers each frozen model without duplicating credentials',async t=>{
 const f=await fixture(t),view=await f.ok(f.a.token,'/api/configuration');await f.ok(f.a.token,'/api/configuration/models','PUT',{revision:view.revision,value:models({...connection(),model:''},{chat:{kind:'personal',id:'same-profile',model:'generated-chat'},memory:{kind:'personal',id:'same-profile',model:'generated-memory'}})});
 const context=()=>f.node.authority.authenticate(f.a.token),chat=await f.node.configuration.forUser(await context()).lease('chat','generated-chat-op'),memory=await f.node.configuration.forUser(await context()).lease('memory','generated-memory-op');assert.equal(chat.model,'generated-chat');assert.equal(memory.model,'generated-memory');
 await f.restart();for(const lease of [chat,memory]){const result=await f.node.configuration.restoreLease(await context(),lease.snapshotId,lease.operationId);assert.equal(result.status,'restored');if(result.status==='restored')assert.equal(await f.node.configuration.withModel(result.lease,async settings=>settings.model),lease.model);}
 const after=await f.ok(f.a.token,'/api/configuration');assert.equal(saved(after).profiles.length,1);assert.equal(saved(after).selections.memory.model,'generated-memory');const invalid=saved(after);invalid.selections.chat={kind:'shared',id:'env:deployment',model:'caller-model'};assert.equal((await f.request(f.a.token,'/api/configuration/models','PUT',{revision:after.revision,value:invalid,preserveRedactedSecrets:true})).statusCode,400);
});

test('shared request tuning preserves actual running Ask completion and restart snapshots while credential withdrawal fences immediately',async t=>{
 const deferred=()=>{let resolve!:()=>void;const promise=new Promise<void>(r=>resolve=r);return {promise,resolve};};
 let entered=deferred(),release=deferred();const sentModels:string[]=[];
 const provider=createServer((request,response)=>{void(async()=>{let raw='';for await(const chunk of request)raw+=chunk;const body=JSON.parse(raw);sentModels.push(body.model);entered.resolve();await release.promise;writeMessagesResponse(response,{stage:1,text:JSON.stringify({answer:'Generated frozen Ask completion',citationIds:[]})});})().catch(()=>response.destroy());});
 await new Promise<void>(r=>provider.listen(0,'127.0.0.1',r));t.after(async()=>{release.resolve();provider.closeAllConnections();await new Promise<void>(r=>provider.close(()=>r()));});
 const f=await fixture(t);let instance=await f.ok(f.admin.token,'/api/admin/configuration/models');const shared=saved(instance);shared.profiles.push({id:'generated-shared',name:'Generated shared',settings:{...connection('GENERATED_SHARED_KEY'),baseUrl:'http://127.0.0.1:'+(provider.address() as any).port+'/v1'}});instance=await f.ok(f.admin.token,'/api/admin/configuration/models','PUT',{revision:instance.revision,value:shared,preserveRedactedSecrets:true});
 const view=await f.ok(f.a.token,'/api/configuration');await f.ok(f.a.token,'/api/configuration/models','PUT',{revision:view.revision,value:{profiles:[],selections:{chat:{kind:'shared',id:'generated-shared'}}}});
 const context=()=>f.node.authority.authenticate(f.a.token),lease=await f.node.configuration.forUser(await context()).lease('chat','generated-shared-tuning');
 const run=randomUUID();await f.ok(f.a.token,'/api/query-runs','POST',{id:run,input:{question:'Generated tuning during running Ask'}});await entered.promise;
 const tuned=saved(instance);Object.assign(tuned.profiles[0].settings,{model:'generated-next-model',maxTokens:1234,reasoningEffort:'low',modelRequestTimeoutMs:15000});instance=await f.ok(f.admin.token,'/api/admin/configuration/models','PUT',{revision:instance.revision,value:tuned,preserveRedactedSecrets:true});
 release.resolve();const completed=await waitForState(()=>f.ok(f.a.token,'/api/query-runs/'+run),value=>value.status!=='running','actual Ask after ordinary model tuning');assert.equal(completed.status,'completed',JSON.stringify(completed));assert.deepEqual(sentModels,['generated-model']);
 assert.equal(await f.node.configuration.withModel(lease,async settings=>settings.model),'generated-model');assert.equal((await f.node.configuration.forUser(await context()).lease('chat','generated-new-admission')).model,'generated-next-model');
 await f.restart();const restored=await f.node.configuration.restoreLease(await context(),lease.snapshotId,lease.operationId);assert.equal(restored.status,'restored');if(restored.status!=='restored')return;assert.equal(await f.node.configuration.withModel(restored.lease,async settings=>settings.maxTokens),connection().maxTokens);
 entered=deferred();release=deferred();const revokedRun=randomUUID();await f.ok(f.a.token,'/api/query-runs','POST',{id:revokedRun,input:{question:'Generated actual credential withdrawal'}});await entered.promise;
 const revoked=saved(instance);revoked.profiles[0].settings.apiKey='';await f.ok(f.admin.token,'/api/admin/configuration/models','PUT',{revision:instance.revision,value:revoked,preserveRedactedSecrets:true});release.resolve();const failed=await waitForState(()=>f.ok(f.a.token,'/api/query-runs/'+revokedRun),value=>value.status!=='running','actual Ask after credential withdrawal');assert.equal(failed.status,'failed',JSON.stringify(failed));assert.throws(()=>f.node.configuration.assertLease(restored.lease),{code:'invalid_identity'});assert.deepEqual(await f.node.configuration.restoreLease(await context(),lease.snapshotId,lease.operationId),{status:'unavailable',reason:'shared_resource_revoked'});
});


test('administrator deployment defaults cannot change a retained credential target without explicit reuse',async t=>{
 const f=await fixture(t);
 for(const credential of ['apiKey','headers','extraBody'] as const){
  let view=await f.ok(f.admin.token,'/api/admin/configuration/models'),domain=saved(view);
  domain.deployment={...connection(''),[credential]:credential==='apiKey'?'GENERATED_ADMIN_SECRET':credential==='headers'?{'x-generated-secret':'GENERATED_ADMIN_SECRET'}:{generatedSecret:'GENERATED_ADMIN_SECRET'}};
  view=await f.ok(f.admin.token,'/api/admin/configuration/models','PUT',{revision:view.revision,value:domain,preserveRedactedSecrets:true});
  const existing=saved(view).deployment;
  for(const omitted of [['provider'],['protocol'],['baseUrl'],['provider','protocol','baseUrl']] as const){
   // Only the status field is retained; deployment defaults own omitted targets.
   const deployment={...existing};for(const field of omitted)delete deployment[field];
   const response=await f.request(f.admin.token,'/api/admin/configuration/models','PUT',{revision:view.revision,value:{...saved(view),deployment},preserveRedactedSecrets:true});
   // A custom provider's absent protocol defaults to deepseek, and absent URL
   // defaults to empty; the provider/default-target omissions must all confirm.
   assert.equal(response.statusCode,409,response.body);assert.equal(response.json().error,'model_settings_credential_reuse');assert.doesNotMatch(response.body,/GENERATED_ADMIN_SECRET/);
  }
  const deployment={[credential]:true};
  const denied=await f.request(f.admin.token,'/api/admin/configuration/models','PUT',{revision:view.revision,value:{deployment},preserveRedactedSecrets:true});assert.equal(denied.statusCode,409,denied.body);assert.equal(denied.json().error,'model_settings_credential_reuse');
  const allowed=await f.ok(f.admin.token,'/api/admin/configuration/models','PUT',{revision:view.revision,value:{deployment},preserveRedactedSecrets:true,allowCredentialReuse:true});assert.equal(saved(allowed).deployment.provider,'deepseek');assert.equal(saved(allowed).deployment[credential],true);
 }
});
