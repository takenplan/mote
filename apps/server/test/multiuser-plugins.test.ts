import test,{type TestContext} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdtempSync,rmSync,readdirSync,existsSync,cpSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {setTimeout as delay} from 'node:timers/promises';
import {z} from 'zod';
import {ProviderFailure} from '@mote/shared';
import {DatabaseSync} from 'node:sqlite';
import {createHash} from 'node:crypto';
import {ExecutionFailure} from '../src/execution-engine.js';
import {zipSync,strToU8} from 'fflate';
import {buildApp} from '../src/app.js';
import type {PluginReleaseTransport} from '../src/plugin-release.js';
import type {PrivateData} from '../src/scope/private-data.js';
import type {PluginDomainAdapter,PluginInvocation,UserPluginInstance} from '../src/scope/plugin-contract.js';
import {LifecycleAuthority} from '../src/scope/lifecycle.js';
import {defaultModelSettings} from '../src/model-settings.js';
import {generatedScopedPluginRelease as release,generatedScopedPluginSource as plugin} from './fixtures/scoped-plugin-release.js';

const password='Generated-plugin-password-01',protocol={'x-mote-protocol-version':'2','x-mote-ingress-version':'3'};
const deferred=()=>{let resolve!:(value?:any)=>void;const promise=new Promise<any>(r=>resolve=r);return {promise,resolve};};
async function until(check:()=>boolean,message:string){const end=Date.now()+10000;while(!check()){if(Date.now()>end)assert.fail(message);await delay(5);}}
async function fixture(t:TestContext,options:{releases?:ReturnType<typeof release>[];lifecycle?:boolean}={}){
 const directory=mkdtempSync(join(tmpdir(),'mote-m09-production-')),releases=options.releases??[release()],transport:PluginReleaseTransport=async url=>{for(const r of releases)try{return await r.transport(url);}catch(e){if(!String(e).includes('Network forbidden'))throw e;}throw Error('Only generated local bytes are allowed');};
 let node=await buildApp({dataDir:directory},{pluginReleaseTransport:transport});const nodes=[node];
 t.after(async()=>{for(const n of nodes.reverse())await n.app.close();rmSync(directory,{recursive:true,force:true});});
 await node.accounts!.initialize('generated-admin',password);
 const request=(token:string|undefined,url:string,method:any='GET',payload?:unknown)=>node.app.inject({url,method,headers:{...protocol,...(token?{authorization:'Bearer '+token}:{})},...(payload===undefined?{}:{payload})});
 const login=async(username:string)=>{const r=await request(undefined,'/api/auth/login','POST',{username,password,mode:'client',durationMs:86400000});assert.equal(r.statusCode,200,r.body);return r.json();};
 const admin=await login('generated-admin');const create=async(username:string)=>{const r=await request(admin.token,'/api/admin/accounts','POST',{username,password,administrator:false});assert.equal(r.statusCode,200,r.body);return r.json();};
 const a=await create('generated-a'),b=await create('generated-b'),alice=await login('generated-a'),bob=await login('generated-b');
 const install=async(r=releases[0])=>{const preview=await request(admin.token,'/api/plugins/resolve','POST',{repository:r.repository,tag:r.tag});assert.equal(preview.statusCode,200,preview.body);const catalog=await request(admin.token,'/api/admin/plugins'),installed=await request(admin.token,'/api/plugins/install','POST',{previewId:preview.json().id,expectedRevision:catalog.json().revision,operationId:randomUUID()});assert.equal(installed.statusCode,200,installed.body);const pkg=installed.json().packages.find((p:any)=>p.version===r.manifest.version);await until(()=>node.plugins!.catalog.view().packages.find(p=>p.id===pkg.id)?.state!=='installing','installation did not settle');return pkg.id as string;};
 const view=async(token:string)=>{const r=await request(token,'/api/plugins');assert.equal(r.statusCode,200,r.body);return r.json();};
 const configure=async(token:string,instance:unknown)=>{const current=await view(token),r=await request(token,'/api/plugin-instances','POST',{instance,expectedRevision:current.revision});assert.equal(r.statusCode,200,r.body);return r.json();};
 const action=async(token:string,id:string,action:string)=>{const current=await view(token),r=await request(token,`/api/plugin-instances/${id}/${action}`,'POST',action==='check'?{}:{expectedRevision:current.revision});assert.equal(r.statusCode,200,r.body);return r.json();};
 const instance=async(token:string,packageId:string,label:string,id='same-instance',grants:Partial<UserPluginInstance['grants']>={})=>{await configure(token,{id,packageId,name:'Generated instance',configuration:{label,credential:'personal:generated-secret-reference'},desired:false,grants:{capabilities:['source','processor','repository','retrieval','model','ui'],sourceIds:['same-source'],history:true,...grants}});await action(token,id,'check');await action(token,id,'enable');return id;};
 const admit=async(token:string,id='same-instance',mode='task',bindingRevision=1)=>{const r=await request(token,`/api/plugin-instances/${id}/snapshots`,'POST',{mode,bindingRevision});assert.equal(r.statusCode,200,r.body);return r.json();};
 const invoke=async(token:string,snapshotId:string,payload:Record<string,unknown>={},componentId='generated.card',operationId=randomUUID())=>{const r=await request(token,`/api/plugin-snapshots/${snapshotId}/invoke`,'POST',{componentId,payload,operationId});assert.equal(r.statusCode,200,r.body);return r.json();};
 const wait=async(token:string,id:string,state='succeeded')=>{const end=Date.now()+10000;for(;;){const r=await request(token,'/api/tasks/'+id);assert.equal(r.statusCode,200,r.body);const v=r.json();if(v.state===state)return v;if(Date.now()>end)assert.fail(JSON.stringify(v));await delay(5);}};
 const adapters=new Map<string,PluginDomainAdapter>();
 const register=()=>{for(const capability of ['repository','retrieval','ui'] as const){const adapter:PluginDomainAdapter={bind:invocation=>({namespace:()=>invocation.namespace}),validateResult:value=>value,validateHistory:(value,{namespace})=>{const result=z.object({namespace:z.object({ownerId:z.string(),instanceId:z.string(),bindingRevision:z.number()}),records:z.array(z.unknown()),label:z.string()}).strict().parse(value);assert.deepEqual(result.namespace,namespace);for(const record of result.records as any[])assert.deepEqual(record.namespace,namespace);return result;}};adapters.set(capability,adapter);node.plugins!.registerAdapter(capability,adapter);}};
 register();
 return {directory,get node(){return node;},nodes,adapters,admin,a,b,alice,bob,releases,request,view,configure,action,instance,install,admit,invoke,wait,login,async restart(lifecycle?:LifecycleAuthority){await node.app.close();node=await buildApp({dataDir:directory},{pluginReleaseTransport:transport,lifecycleAuthority:lifecycle});nodes.push(node);register();return node;}};
}

test('generated local release registers actual Cordis capabilities through production and isolates A/B with identical instance identities',async t=>{
 const f=await fixture(t),packageId=await f.install();await f.instance(f.alice.token,packageId,'A configuration');await f.instance(f.bob.token,packageId,'B_PRIVATE configuration');
 const a=await f.admit(f.alice.token),b=await f.admit(f.bob.token);const ca=await f.node.authority.authenticate(f.alice.token),inventory=await f.node.plugins!.forUser(ca).inventory(a.id);assert.equal(inventory.capabilities.length,5);assert.equal(inventory.capabilities.find(c=>c.id==='generated.processor')?.state,'active');assert.equal(inventory.capabilities.find(c=>c.id==='generated.source')?.state,'active');assert.equal(inventory.capabilities.find(c=>c.id==='generated.model')?.reason,'scoped_domain_unavailable');
 const ta=await f.invoke(f.alice.token,a.id,{emit:true}),tb=await f.invoke(f.bob.token,b.id,{emit:true});assert.equal((await f.wait(f.alice.token,ta.id)).result.label,'A configuration');assert.equal((await f.wait(f.bob.token,tb.id)).result.label,'B_PRIVATE configuration');
 const view=await f.request(f.alice.token,'/api/plugins');assert.equal(view.body.includes('B_PRIVATE'),false);assert.equal(view.body.includes('personal:generated-secret-reference'),false);
 const events=await f.request(f.alice.token,'/api/plugin-events?since=0');assert.equal(events.json().items.length,1);assert.equal(events.body.includes('B_PRIVATE'),false);
 for(const endpoint of ['/api/plugins/resolve','/api/plugins/install','/api/plugins/'+encodeURIComponent(packageId)+'/uninstall'])assert.equal((await f.request(f.alice.token,endpoint,'POST',{})).statusCode,403);
 assert.equal((await f.request(f.admin.token,`/api/plugin-snapshots/${b.id}/read`,'POST',{method:'read',params:{}})).statusCode,404);
 assert.equal((await f.request(f.alice.token,'/api/tasks','POST',{kind:'plugin.invoke',operationId:'foreign-direct',input:{snapshotId:b.id,componentId:'generated.processor',payload:{}}})).statusCode,404);
});

test('pause drains admitted work, stop fences A callbacks and subscriptions, and B instance remains installed and usable',async t=>{
 const f=await fixture(t),packageId=await f.install();await f.instance(f.alice.token,packageId,'A');await f.instance(f.bob.token,packageId,'B');const a=await f.admit(f.alice.token),b=await f.admit(f.bob.token),entered=deferred(),held=deferred();t.after(()=>held.resolve());
 // A real generated worker reaches this domain callback; publication still
 // requires the exact current plugin snapshot and M05 execution fence.
 const adapter=f.adapters.get('ui')!;adapter.bind=(invocation:PluginInvocation)=>({gate:async()=>{entered.resolve();await held.promise;invocation.assertCurrent();return true;}});
 const context=await f.node.authority.authenticate(f.alice.token),events:unknown[]=[];f.node.plugins!.forUser(context).subscribe(a.id,value=>events.push(value));
 const task=await f.invoke(f.alice.token,a.id,{gate:true,emit:true});await entered.promise;await f.action(f.alice.token,'same-instance','pause');held.resolve();await f.wait(f.alice.token,task.id);assert.equal(events.length,1);
 assert.equal((await f.request(f.alice.token,'/api/plugin-instances/same-instance/snapshots','POST',{})).statusCode,409);
 await f.action(f.alice.token,'same-instance','resume');const second=await f.admit(f.alice.token),entered2=deferred(),held2=deferred();t.after(()=>held2.resolve());adapter.bind=(invocation:PluginInvocation)=>({gate:async()=>{entered2.resolve();await held2.promise;invocation.assertCurrent();return true;}});const stopped=await f.invoke(f.alice.token,second.id,{gate:true,emit:true});await entered2.promise;await f.action(f.alice.token,'same-instance','stop');held2.resolve();await f.wait(f.alice.token,stopped.id,'stale');assert.equal(events.length,1);
 const tb=await f.invoke(f.bob.token,b.id,{emit:true});assert.equal((await f.wait(f.bob.token,tb.id)).result.label,'B');assert.equal(f.node.plugins!.catalog.view().packages.length,1);
});

test('fixed release and original configuration survive changes and an actual host restart; history requires its own binding',async t=>{
 const first=release('1'),second=release('2'),f=await fixture(t,{releases:[first,second]}),p1=await f.install(first),p2=await f.install(second);await f.instance(f.alice.token,p1,'old');assert.notEqual(p1,p2);assert.equal(first.manifest.archive.sha256,second.manifest.archive.sha256);const task=await f.admit(f.alice.token,'same-instance','task',7),history=await f.admit(f.alice.token,'same-instance','history',7),otherBinding=await f.admit(f.alice.token,'same-instance','history',8);
 const write=await f.invoke(f.alice.token,history.id,{put:'same-key'},'generated.memory').catch(()=>undefined);assert.equal(write,undefined,'history receipt cannot admit work');
 const original=await f.invoke(f.alice.token,task.id,{put:'same-key'},'generated.memory');await f.wait(f.alice.token,original.id);
 await f.action(f.alice.token,'same-instance','pause');const current=(await f.view(f.alice.token)).instances[0];delete current.generation;delete current.checked;delete current.secretStatus;delete current.capabilities;current.packageId=p2;current.configuration.label='new';await f.configure(f.alice.token,current);await f.action(f.alice.token,'same-instance','check');await f.action(f.alice.token,'same-instance','enable');
 const newSnapshot=await f.admit(f.alice.token),newJob=await f.invoke(f.alice.token,newSnapshot.id);assert.equal((await f.wait(f.alice.token,newJob.id)).result.label,'new');
 await f.restart();const oldJob=await f.invoke(f.alice.token,task.id);assert.equal((await f.wait(f.alice.token,oldJob.id)).result.label,'old');
 const read=await f.request(f.alice.token,`/api/plugin-snapshots/${history.id}/read`,'POST',{method:'read',params:{}});assert.equal(read.statusCode,200,read.body);assert.equal(read.json().label,'old');assert.deepEqual(read.json().records,[{key:'same-key',label:'old',namespace:{ownerId:f.a.userId,instanceId:'same-instance',bindingRevision:7}}]);assert.equal(read.json().namespace.ownerId,f.a.userId);assert.equal(read.json().namespace.bindingRevision,7);assert.deepEqual((await f.request(f.alice.token,`/api/plugin-snapshots/${otherBinding.id}/read`,'POST',{method:'read',params:{}})).json().records,[]);
 assert.equal((await f.request(f.bob.token,`/api/plugin-snapshots/${history.id}/read`,'POST',{method:'read',params:{}})).statusCode,404);
 assert.equal((await f.request(f.alice.token,`/api/plugin-snapshots/${history.id}/read`,'POST',{method:'read',params:{namespace:{ownerId:f.b.userId}}})).statusCode,400);
 const catalog=await f.request(f.admin.token,'/api/admin/plugins');assert.equal((await f.request(f.admin.token,'/api/plugins/'+encodeURIComponent(p1)+'/uninstall','POST',{expectedRevision:catalog.json().revision,operationId:randomUUID()})).statusCode,409);
});

test('grant narrowing and account disable revoke delayed generated callbacks before event or result publication',async t=>{
 const f=await fixture(t),pkg=await f.install();await f.instance(f.alice.token,pkg,'A');const snapshot=await f.admit(f.alice.token),entered=deferred(),held=deferred();t.after(()=>held.resolve());const adapter=f.adapters.get('ui')!;adapter.bind=(i:PluginInvocation)=>({gate:async()=>{entered.resolve();await held.promise;i.assertCurrent();return true;}});
 const task=await f.invoke(f.alice.token,snapshot.id,{gate:true,emit:true});await entered.promise;await f.action(f.alice.token,'same-instance','pause');const i=(await f.view(f.alice.token)).instances[0];delete i.generation;delete i.checked;delete i.secretStatus;delete i.capabilities;i.grants.sourceIds=[];await f.configure(f.alice.token,i);held.resolve();await f.wait(f.alice.token,task.id,'stale');assert.deepEqual((await f.request(f.alice.token,'/api/plugin-events')).json().items,[]);
 await f.action(f.alice.token,'same-instance','check');await f.action(f.alice.token,'same-instance','enable');const fresh=await f.admit(f.alice.token),entered2=deferred(),held2=deferred();t.after(()=>held2.resolve());adapter.bind=(i:PluginInvocation)=>({gate:async()=>{entered2.resolve();await held2.promise;i.assertCurrent();return true;}});const disabled=await f.invoke(f.alice.token,fresh.id,{gate:true,emit:true});await entered2.promise;assert.equal((await f.request(f.admin.token,`/api/admin/accounts/${f.a.userId}`,'PATCH',{disabled:true})).statusCode,200);held2.resolve();await until(()=>f.node.execution!.engine.get(disabled.id)?.state==='stale','disabled callback did not lose publication');
});

test('failed installation and undeclared actual components never activate a user instance',async t=>{
 const broken=release('1',plugin.replace('components:components.map','components:components.slice(1).map')),f=await fixture(t,{releases:[broken]}),pkg=await f.install();await f.configure(f.alice.token,{id:'broken',packageId:pkg,name:'Broken',configuration:{label:'synthetic'},desired:false,grants:{capabilities:['processor'],sourceIds:[],history:false}});assert.equal((await f.request(f.alice.token,'/api/plugin-instances/broken/check','POST',{})).statusCode,409);assert.equal((await f.view(f.alice.token)).instances[0].checked,false);
 const fail=release('2');f.releases.push(fail);const preview=await f.request(f.admin.token,'/api/plugins/resolve','POST',{repository:fail.repository,tag:fail.tag});assert.equal(preview.statusCode,200);fail.fail();const catalog=await f.request(f.admin.token,'/api/admin/plugins');assert.equal((await f.request(f.admin.token,'/api/plugins/install','POST',{previewId:preview.json().id,expectedRevision:catalog.json().revision,operationId:randomUUID()})).statusCode,200);await until(()=>f.node.plugins!.catalog.view().packages.find(p=>p.version==='2')?.state==='failed','failed install not recorded');assert.equal((await f.view(f.alice.token)).instances.length,1);
});

test('M09 instance export excludes B and opaque credentials; deletion fences retained handles and clears only A runtime state',async t=>{
 const f=await fixture(t),pkg=await f.install();await f.instance(f.alice.token,pkg,'A');await f.instance(f.bob.token,pkg,'B_PRIVATE');const a=await f.admit(f.alice.token),b=await f.admit(f.bob.token),context=await f.node.authority.authenticate(f.alice.token),service=f.node.services.forUser(context);
 const exported=await service.exportUser('plugins'),json=JSON.stringify(exported);assert.equal(json.includes('B_PRIVATE'),false);assert.equal(json.includes('personal:generated-secret-reference'),false);assert.equal(json.includes('activeAuthorization":false'),true);
 const before=await f.invoke(f.bob.token,b.id,{put:'B state'},'generated.memory');await f.wait(f.bob.token,before.id);assert.equal((await service.deleteUser('plugins','generated-delete')).status,'complete');assert.throws(()=>f.node.plugins!.forUser(context).events());assert.equal((await f.request(f.alice.token,`/api/plugin-snapshots/${a.id}/invoke`,'POST',{componentId:'generated.processor',payload:{},operationId:'late'})).statusCode,401);
 const tb=await f.invoke(f.bob.token,b.id);assert.equal((await f.wait(f.bob.token,tb.id)).result.label,'B_PRIVATE');assert.equal((await service.deleteUser('plugins','generated-delete')).status,'complete');
});

test('a generated source plugin uses the production M03 binder with a host-fixed source subset without a central dispatch branch',async t=>{
 const f=await fixture(t),pkg=await f.install();
 for(const [token,label] of [[f.alice.token,'A'],[f.bob.token,'B_PRIVATE']]){for(const id of ['same-source','ungranted-source']){const registered=await f.request(token,'/api/ingress/sources','POST',{id,name:label,kind:'custom',deviceId:'same-device',platform:'import',retention:'snapshot'});assert.equal(registered.statusCode,200,registered.body);}await f.instance(token,pkg,label);}
 const item=(label:string)=>({externalId:'same-external',revision:'same-revision',kind:'event',title:'Generated',text:label,observedAt:'2026-10-15T00:00:00Z',layer:'snapshot'});
 for(const [token,label] of [[f.alice.token,'A'],[f.bob.token,'B_PRIVATE']]){const snapshot=await f.admit(token),task=await f.invoke(token,snapshot.id,{source:'same-source',items:[item(label)]},'generated.source');await f.wait(token,task.id);const denied=await f.invoke(token,snapshot.id,{source:'ungranted-source',items:[item('forbidden')]},'generated.source');await f.wait(token,denied.id,'blocked');}
 const context=await f.node.authority.authenticate(f.alice.token),data=f.node.services.forUser(context).get<PrivateData>('private-data');assert.equal(data.sourceItem('same-source','same-external')?.text,'A');assert.equal(data.sourceItem('ungranted-source','same-external'),null);assert.equal(JSON.stringify(data.captures()).includes('B_PRIVATE'),false);
});

test('a generated model extension uses the real M04/M05 fixed lease and never receives the other user model or reusable credential',async t=>{
 const f=await fixture(t),pkg=await f.install(),entered=deferred(),held=deferred();t.after(()=>held.resolve());
 f.node.plugins!.registerAdapter('model',{modelFeature:'chat',bind:invocation=>({gate:async()=>{entered.resolve();await held.promise;invocation.assertCurrent();return true;},model:async()=>{assert.ok(invocation.run.model);return invocation.run.model.withModel(async settings=>({model:settings.model,configuredKey:settings.apiKey==='A_SYNTHETIC_KEY'}));}}),validateResult:value=>z.object({model:z.string(),configuredKey:z.boolean()}).strict().parse(value)});
 const configure=async(token:string,key:string,model:string)=>{const context=await f.node.authority.authenticate(token),config=f.node.configuration.forUser(context),view=await config.view();await config.replace('models',{profiles:[{id:'same-profile',name:'Generated',settings:{...defaultModelSettings(),provider:'custom',protocol:'openai-completions',baseUrl:'https://generated.invalid/v1',model,apiKey:key}}],selections:{chat:{kind:'personal',id:'same-profile'}}},view.revision);};
 await configure(f.alice.token,'A_SYNTHETIC_KEY','A-original');await configure(f.bob.token,'B_SYNTHETIC_KEY','B_PRIVATE');await f.instance(f.alice.token,pkg,'A');const snapshot=await f.admit(f.alice.token),task=await f.invoke(f.alice.token,snapshot.id,{model:true,gate:true},'generated.model');await entered.promise;
 await configure(f.alice.token,'A_NEW_KEY','A-current');held.resolve();const result=(await f.wait(f.alice.token,task.id)).result;assert.deepEqual(result,{model:'A-original',configuredKey:true});assert.equal(JSON.stringify(result).includes('KEY'),false);
 assert.equal((await f.request(f.alice.token,'/api/tasks','POST',{kind:'plugin.invoke',operationId:'no-model-bypass',input:{snapshotId:snapshot.id,componentId:'generated.model',payload:{model:true}}})).statusCode,403);
});

test('purpose-bound lifecycle restores only disabled credential-free definitions, survives restart and rejects tampered envelopes',async t=>{
 const f=await fixture(t),pkg=await f.install();await f.instance(f.alice.token,pkg,'A');await f.instance(f.bob.token,pkg,'B_PRIVATE');const context=await f.node.authority.authenticate(f.alice.token),archive=await f.node.services.forUser(context).exportUser('plugins'),configurationArchive=await f.node.services.forUser(context).exportUser('configuration');
 const grants=new Map<string,any>(),authority=new LifecycleAuthority(f.node.deploymentId,{verify:async token=>grants.get(token),isCurrent:()=>true});
 const grant=async(purpose:'delete'|'restore',operationId:string,domain='plugins')=>{grants.set(operationId,{deploymentId:f.node.deploymentId,userId:f.a.userId,domain,operationId,purpose});return authority.authorize(operationId);};
 await f.restart(authority);
 const remove=await grant('delete','generated-lifecycle-delete');await f.node.services.forLifecycle(remove).run();await f.node.services.forLifecycle(await grant('delete','generated-configuration-delete','configuration')).run();
 const restore=await grant('restore','generated-lifecycle-restore');await assert.rejects(f.node.services.forLifecycle(restore).run({...archive,userId:f.b.userId}));
 await f.node.services.forLifecycle(restore).run(archive);await f.node.services.forLifecycle(restore).run(archive);
 await f.node.services.forLifecycle(await grant('restore','generated-configuration-restore','configuration')).run(configurationArchive);
 await f.restart(authority);const view=await f.view(f.alice.token);assert.equal(view.instances.length,1);assert.equal(view.instances[0].desired,false);assert.deepEqual(view.instances[0].grants,{capabilities:[],sourceIds:[],history:false});assert.equal('credential' in view.instances[0].configuration,false);assert.equal((await f.view(f.bob.token)).instances[0].configuration.label,'B_PRIVATE');
 assert.equal((await f.request(f.alice.token,'/api/plugin-instances/same-instance/snapshots','POST',{})).statusCode,409);
});

test('deletion joins initializing probe workers before erasure and their delayed code cannot recreate the user directory',async t=>{
 const code=plugin.replace('import {readFile,writeFile}','import {readFile,writeFile,mkdir}').replace(' const read=async'," const cwd=process.cwd(); await writeFile('probe-entered','synthetic'); await new Promise(resolve=>setTimeout(resolve,500)); await mkdir(cwd,{recursive:true}); await writeFile(cwd+'/probe-after-delete','synthetic late probe write');\n const read=async"),generated=release('3',code),f=await fixture(t,{releases:[generated]}),pkg=await f.install();
 await f.configure(f.alice.token,{id:'same-instance',packageId:pkg,name:'Generated probe',configuration:{label:'synthetic'},desired:false,grants:{capabilities:['processor'],sourceIds:[],history:false}});
 const userRoot=join(f.directory,'plugins','instances',createHash('sha256').update(JSON.stringify([f.node.deploymentId,f.a.userId])).digest('hex'));
 const contains=(name:string):boolean=>{const walk=(path:string):boolean=>existsSync(path)&&readdirSync(path,{withFileTypes:true}).some(entry=>entry.name===name||entry.isDirectory()&&walk(join(path,entry.name)));return walk(userRoot);};
 const checking=f.request(f.alice.token,'/api/plugin-instances/same-instance/check','POST',{});await until(()=>contains('probe-entered'),'probe did not start');
 const context=await f.node.authority.authenticate(f.alice.token),deleted=await f.node.services.forUser(context).deleteUser('plugins','generated-probe-delete');assert.equal(deleted.status,'complete');assert.notEqual((await checking).statusCode,200);assert.equal(existsSync(userRoot),false);await delay(600);assert.equal(existsSync(userRoot),false);assert.equal(contains('probe-after-delete'),false);
});

test('real HTTP shutdown retires a stuck configuration probe before waiting for its request socket',async t=>{
 const generated=release('7',plugin.replace(' const read=async'," await writeFile('probe-entered','synthetic'); await new Promise(()=>{});\n const read=async")),f=await fixture(t,{releases:[generated]}),pkg=await f.install();await f.configure(f.alice.token,{id:'same-instance',packageId:pkg,name:'Generated stuck probe',configuration:{label:'A'},desired:false,grants:{capabilities:['processor'],sourceIds:[],history:false}});
 const url=await f.node.app.listen({host:'127.0.0.1',port:0}),root=join(f.directory,'plugins','instances'),checking=fetch(url+'/api/plugin-instances/same-instance/check',{method:'POST',headers:{...protocol,authorization:'Bearer '+f.alice.token,'content-type':'application/json'},body:'{}'}).then(async response=>({status:response.status,body:await response.json()}));
 const entered=(path:string):boolean=>existsSync(path)&&readdirSync(path,{withFileTypes:true}).some(entry=>entry.name==='probe-entered'||entry.isDirectory()&&entered(join(path,entry.name)));await until(()=>entered(root),'HTTP probe did not start');
 let deadline:ReturnType<typeof setTimeout>|undefined;try{await Promise.race([f.node.app.close(),new Promise((_,reject)=>{deadline=setTimeout(()=>reject(Error('Shutdown waited for an untracked probe socket')),4000);})]);}finally{clearTimeout(deadline);}
 assert.notEqual((await checking).status,200);
});

test('registration probes use disposable storage and cannot modify a live fixed configuration',async t=>{
 const code=plugin.replace(' const read=async'," await writeFile('records.json',JSON.stringify([{key:'initialization',label:configuration.label,namespace:{ownerId:'unscoped',instanceId:'unscoped',bindingRevision:1}}]));\n const read=async"),generated=release('4',code),f=await fixture(t,{releases:[generated]}),pkg=await f.install();await f.instance(f.alice.token,pkg,'A');const snapshot=await f.admit(f.alice.token),job=await f.invoke(f.alice.token,snapshot.id,{put:'retained'},'generated.memory');await f.wait(f.alice.token,job.id);const history=await f.admit(f.alice.token,'same-instance','history',1);
 await f.action(f.alice.token,'same-instance','check');const read=await f.request(f.alice.token,`/api/plugin-snapshots/${history.id}/read`,'POST',{method:'read',params:{}});assert.equal(read.statusCode,200,read.body);assert.deepEqual(read.json().records.map((v:any)=>v.key),['retained']);
});

test('stop generations reopen worker handles even when another SQLite connection advances the persistent fence',async t=>{
 const f=await fixture(t),pkg=await f.install();await f.instance(f.alice.token,pkg,'A');const first=await f.admit(f.alice.token),before=await f.invoke(f.alice.token,first.id,{pid:true}),pid=(await f.wait(f.alice.token,before.id)).result.pid;
 // Represents a committed stop/resume from another host before this host's
 // watcher sees the YAML event. The durable fence must win over a cached handle.
 const db=new DatabaseSync(join(f.directory,'mote.sqlite'));try{db.prepare('UPDATE plugin_user_instances SET generation=generation+1 WHERE user_id=? AND id=?').run(f.a.userId,'same-instance');}finally{db.close();}
 const second=await f.admit(f.alice.token),after=await f.invoke(f.alice.token,second.id,{pid:true});assert.notEqual((await f.wait(f.alice.token,after.id)).result.pid,pid);
 assert.equal((await f.request(f.alice.token,`/api/plugin-snapshots/${first.id}/invoke`,'POST',{componentId:'generated.processor',payload:{},operationId:'retired'})).statusCode,401);
});

test('stopped receipts can be released repeatedly by their owner so removed instances no longer pin package uninstall',async t=>{
 const f=await fixture(t),pkg=await f.install();await f.instance(f.alice.token,pkg,'A');const snapshot=await f.admit(f.alice.token);await f.action(f.alice.token,'same-instance','stop');
 assert.equal((await f.request(f.bob.token,'/api/plugin-snapshots/'+snapshot.id,'DELETE')).statusCode,404);
 for(let i=0;i<2;i++)assert.equal((await f.request(f.alice.token,'/api/plugin-snapshots/'+snapshot.id,'DELETE')).statusCode,200);
 const context=await f.node.authority.authenticate(f.alice.token),configuration=f.node.configuration.forUser(context),view=await configuration.view();await configuration.replace('pluginInstances',{instances:[]},view.revision);
 const catalog=await f.request(f.admin.token,'/api/admin/plugins'),removed=await f.request(f.admin.token,'/api/plugins/'+encodeURIComponent(pkg)+'/uninstall','POST',{expectedRevision:catalog.json().revision,operationId:randomUUID()});assert.equal(removed.statusCode,200,removed.body);assert.equal(removed.json().packages.length,0);
});

test('removing and reinstalling a trusted model adapter disposes its M05 registration without widening a task',async t=>{
 const f=await fixture(t),adapter:PluginDomainAdapter={modelFeature:'chat',validateResult:value=>value};const first=f.node.plugins!.registerAdapter('model',adapter);await first();await first();const second=f.node.plugins!.registerAdapter('model',{...adapter});await second();
});

test('host model failures retain their private typed retry facts even when generated plugin code tries to conceal them',async t=>{
 const generated=release('5',plugin.replace("if(input.model)return host.call('model',[]);","if(input.model)return host.call('model',[]).catch(()=>({concealed:true}));")),f=await fixture(t,{releases:[generated]}),pkg=await f.install();let calls=0;const snapshots=new Set<string>();
 f.node.plugins!.registerAdapter('model',{modelFeature:'chat',bind:invocation=>({model:()=>invocation.run.model!.withModel(async settings=>{calls++;snapshots.add(invocation.run.model!.lease.snapshotId);if(calls<3)throw new ProviderFailure({category:'transient',code:'provider_network',retryAfterMs:0},'GENERATED_PRIVATE_TRANSPORT_DETAIL');return {model:settings.model};})}),validateResult:value=>z.object({model:z.string()}).strict().parse(value)});
 const context=await f.node.authority.authenticate(f.alice.token),configuration=f.node.configuration.forUser(context),view=await configuration.view();await configuration.replace('models',{profiles:[{id:'same-profile',name:'Generated',settings:{...defaultModelSettings(),provider:'custom',protocol:'openai-completions',baseUrl:'https://generated.invalid/v1',model:'fixed-model',apiKey:'GENERATED_KEY'}}],selections:{chat:{kind:'personal',id:'same-profile'}}},view.revision);await f.instance(f.alice.token,pkg,'A');const snapshot=await f.admit(f.alice.token),task=await f.invoke(f.alice.token,snapshot.id,{model:true},'generated.model'),completed=await f.wait(f.alice.token,task.id);assert.equal(completed.attempts,3);assert.equal(calls,3);assert.equal(snapshots.size,1);assert.deepEqual(completed.result,{model:'fixed-model'});assert.equal(JSON.stringify(completed).includes('GENERATED_PRIVATE_TRANSPORT_DETAIL'),false);
});

test('a generated fire-and-forget host callback must settle before M05 can publish task success',async t=>{
 const generated=release('6',plugin.replace("if(input.gate)await host.call('gate',[]);","if(input.gate)void host.call('gate',[]).catch(()=>{});")),f=await fixture(t,{releases:[generated]}),pkg=await f.install(),entered=deferred(),held=deferred();t.after(()=>held.resolve());f.adapters.get('ui')!.bind=invocation=>({gate:async()=>{entered.resolve();await held.promise;invocation.assertCurrent();throw new ExecutionFailure('blocked','generated_host_call_rejected');}});await f.instance(f.alice.token,pkg,'A');const snapshot=await f.admit(f.alice.token),task=await f.invoke(f.alice.token,snapshot.id,{gate:true});await entered.promise;held.resolve();const result=await f.wait(f.alice.token,task.id,'blocked');assert.equal(result.result,undefined);assert.equal(result.error,'generated_host_call_rejected');
});

test('deletion fences an already running callback and subscription before closing its worker, leaving B data readable',async t=>{
 const f=await fixture(t),pkg=await f.install(),entered=deferred(),held=deferred();t.after(()=>held.resolve());await f.instance(f.alice.token,pkg,'A');await f.instance(f.bob.token,pkg,'B');const a=await f.admit(f.alice.token),b=await f.admit(f.bob.token),context=await f.node.authority.authenticate(f.alice.token),events:unknown[]=[];f.node.plugins!.forUser(context).subscribe(a.id,event=>events.push(event));f.adapters.get('ui')!.bind=invocation=>({gate:async()=>{entered.resolve();await held.promise;invocation.assertCurrent();return true;}});
 const task=await f.invoke(f.alice.token,a.id,{gate:true,emit:true});await entered.promise;assert.equal((await f.node.services.forUser(context).deleteUser('plugins','generated-running-delete')).status,'complete');held.resolve();await f.wait(f.alice.token,task.id,'stale');assert.deepEqual(events,[]);const other=await f.invoke(f.bob.token,b.id);assert.equal((await f.wait(f.bob.token,other.id)).result.label,'B');
});

test('native Memory recipes register fixed scoped descriptors and refuse unmediated raw history',async t=>{
 const upstream=zipSync({'generated-upstream/README.md':strToU8('Generated pinned host recipe bytes')}),generated=release(),original=generated.transport;
 generated.transport=async url=>url.endsWith('/releases/tags/ts-v3.3.1')?{bytes:strToU8(JSON.stringify({tag_name:'ts-v3.3.1',draft:false,assets:[]}))}:url.endsWith('/commits/ts-v3.3.1')?{bytes:strToU8(JSON.stringify({sha:'a'.repeat(40)}))}:url.endsWith('/zipball/'+'a'.repeat(40))?{bytes:upstream}:original(url);
 const f=await fixture(t,{releases:[generated]});
 const preview=await f.request(f.admin.token,'/api/plugins/resolve','POST',{repository:'mem0ai/mem0',tag:'ts-v3.3.1'});assert.equal(preview.statusCode,200,preview.body);const catalog=await f.request(f.admin.token,'/api/admin/plugins'),installed=await f.request(f.admin.token,'/api/plugins/install','POST',{previewId:preview.json().id,expectedRevision:catalog.json().revision,operationId:randomUUID()});assert.equal(installed.statusCode,200);const pkg=installed.json().packages[0].id;await until(()=>f.node.plugins!.catalog.view().packages[0].state==='installed','host recipe install did not settle');
 for(const [token,label,userId] of [[f.alice.token,'A',f.a.userId],[f.bob.token,'B_PRIVATE',f.b.userId]]){await f.configure(token,{id:'same-instance',packageId:pkg,name:'Generated host recipe',configuration:{embeddingBaseUrl:'http://127.0.0.1:1',embeddingModel:label,embeddingDimension:3},desired:false,grants:{capabilities:['repository'],sourceIds:[],history:true}});await f.action(token,'same-instance','check');await f.action(token,'same-instance','enable');const snapshot=await f.admit(token,'same-instance','history',4),read=await f.request(token,`/api/plugin-snapshots/${snapshot.id}/read`,'POST',{method:'read',params:{}});assert.equal(read.statusCode,503,read.body);assert.ok(!read.body.includes(label));const context=await f.node.authority.authenticate(token),inventory=await f.node.plugins!.forUser(context).inventory(snapshot.id);assert.equal(inventory.capabilities.length,2);}
});

test('private plugin deletion does not revoke a still-authorized administrator catalog capability',async t=>{
 const f=await fixture(t),context=await f.node.authority.authenticate(f.admin.token);assert.equal((await f.node.services.forUser(context).deleteUser('plugins','generated-admin-private-delete')).status,'complete');assert.equal((await f.request(f.admin.token,'/api/admin/plugins')).statusCode,200);assert.equal((await f.request(f.admin.token,'/api/plugins')).statusCode,401);
});

test('relocating an offline vault uses its own fixed package cache and preserves scoped task and history data after the original is removed',async t=>{
 const generated=release(),f=await fixture(t,{releases:[generated]}),pkg=await f.install();await f.instance(f.alice.token,pkg,'A');await f.instance(f.bob.token,pkg,'B_PRIVATE');
 const task=await f.admit(f.alice.token,'same-instance','task',7),history=await f.admit(f.alice.token,'same-instance','history',7),other=await f.admit(f.bob.token,'same-instance','history',7),bTask=await f.admit(f.bob.token,'same-instance','task',7);
 await f.wait(f.alice.token,(await f.invoke(f.alice.token,task.id,{put:'same-key'},'generated.memory')).id);await f.wait(f.bob.token,(await f.invoke(f.bob.token,bTask.id,{put:'same-key'},'generated.memory')).id);
 await f.node.app.close();const target=f.directory+'-relocated';let relocated:Awaited<ReturnType<typeof buildApp>>|undefined;t.after(async()=>{await relocated?.app.close();rmSync(target,{recursive:true,force:true});});cpSync(f.directory,target,{recursive:true});rmSync(f.directory,{recursive:true,force:true});assert.equal(existsSync(f.directory),false);
 const restored=relocated=await buildApp({dataDir:target},{pluginReleaseTransport:generated.transport});for(const capability of ['repository','retrieval','ui'] as const)restored.plugins!.registerAdapter(capability,f.adapters.get(capability)!);
 const request=(token:string,url:string,method:any='GET',payload?:unknown)=>restored.app.inject({url,method,headers:{...protocol,authorization:'Bearer '+token},...(payload===undefined?{}:{payload})});
 const view=await request(f.alice.token,'/api/plugins');assert.equal(view.statusCode,200,view.body);assert.equal(view.body.includes('B_PRIVATE'),false);
 for(const [token,snapshot,userId,label] of [[f.alice.token,history.id,f.a.userId,'A'],[f.bob.token,other.id,f.b.userId,'B_PRIVATE']]){const read=await request(token,`/api/plugin-snapshots/${snapshot}/read`,'POST',{method:'read',params:{}});assert.equal(read.statusCode,200,read.body);assert.deepEqual(read.json().records,[{key:'same-key',label,namespace:{ownerId:userId,instanceId:'same-instance',bindingRevision:7}}]);}
 assert.equal((await request(f.bob.token,`/api/plugin-snapshots/${history.id}/read`,'POST',{method:'read',params:{}})).statusCode,404);
 const admitted=await request(f.alice.token,`/api/plugin-snapshots/${task.id}/invoke`,'POST',{componentId:'generated.card',payload:{},operationId:randomUUID()});assert.equal(admitted.statusCode,200,admitted.body);await until(()=>restored.execution!.engine.get(admitted.json().id)?.state==='succeeded','relocated fixed task did not complete');const completed=await request(f.alice.token,'/api/tasks/'+admitted.json().id);assert.equal(completed.statusCode,200,completed.body);assert.equal(completed.json().result.label,'A');
});
