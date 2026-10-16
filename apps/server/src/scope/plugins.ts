import {createHash,randomUUID} from 'node:crypto';
import {join} from 'node:path';
import {rm} from 'node:fs/promises';
import type {DatabaseSync} from 'node:sqlite';
import type {ModelFeature} from '@mote/shared/models';
import {Context} from '@deepseek-ai/cordis';
import {FeatureRegistry,type FeatureInventory} from '@mote/shared';
import {z} from 'zod';
import {PluginCenter,type StoredPackage} from '../plugin-center.js';
import {GitHubPluginReleases,type PluginReleaseTransport,type PluginManifest} from '../plugin-release.js';
import {WorkerPluginRuntime,type PluginRuntime} from '../plugin-runtime.js';
import {BackendPluginScope} from '../backend-plugin-scope.js';
import {privateDirectory} from '../private-storage.js';
import {StoreError} from '../execution-storage.js';
import {ExecutionFailure} from '../execution-engine.js';
import {EXECUTION_POLICIES} from '../execution-policy.js';
import {ScopeError} from './baseline.js';
import type {Configurations} from './configuration.js';
import type {UserContext,UserContextAuthority} from './context.js';
import type {ScopedServices} from './services.js';
import type {TaskExecution,TaskRun} from './task-execution.js';
import type {DomainLifecycle,UserDataSubject,UserExport} from './lifecycle.js';
import {PLUGINS_DOMAIN,PLUGIN_CONFIGURATION_DOMAIN,componentSchema,instanceSchema,pluginConfigurationSchema,invokeSchema,type PluginConfiguration,type UserPluginInstance,type PluginCapabilityId,type PluginComponent,type PluginDomainAdapter,type PluginInvocation,type SourceCapabilityBinder,type PluginRuntimeFactory} from './plugin-contract.js';

const digest=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const clone=<T>(value:T):T=>structuredClone(value);
const signature=(i:UserPluginInstance)=>digest([i.packageId,i.configuration,i.grants]);
type InstanceRow={user_id:string;id:string;generation:number;removed:number;json:string;verified_hash:string|null};
type Snapshot={id:string;user_id:string;instance_id:string;generation:number;account_epoch:number;binding_revision:number;mode:'task'|'history';released:number;json:string};
type Fixed={instance:UserPluginInstance;components:PluginComponent[];packageId:string;version:string;digest:string};
type WorkerRecord={scope:BackendPluginScope;worker:PluginRuntime;userId:string;instanceId:string;generation:number;factory?:PluginRuntimeFactory;factoryId?:string;probeDirectory?:string;closing?:Promise<void>};
type Runtime={record:WorkerRecord;scope:BackendPluginScope;worker:PluginRuntime;registry:FeatureRegistry<(input:unknown,hostCall:(method:string,params:unknown)=>Promise<unknown>,signal?:AbortSignal)=>Promise<unknown>>};
type Listener={context:UserContext;snapshotId:string;callback:(value:unknown)=>void};
export type PluginHostOptions={db:DatabaseSync;directory:string;authority:UserContextAuthority;services:ScopedServices;configuration:Configurations;execution:TaskExecution;releaseTransport?:PluginReleaseTransport};

/** The existing PluginCenter owns the one shared immutable package catalog.
 * ConfigService owns per-user declarations. This adapter owns their fenced
 * runtime projection, pinned receipts, Cordis scopes and subscriptions. */
export class ScopedPluginHost {
 readonly catalog:PluginCenter;
 private readonly root=new Context();
 private readonly runtimes=new Map<string,Promise<Runtime>>();
 private readonly workers=new Set<WorkerRecord>();
 private readonly runtimeFactories=new Map<string,PluginRuntimeFactory>();
 private readonly adapters=new Map<PluginCapabilityId,PluginDomainAdapter>();
 private readonly subscriptions=new Set<Listener>();
 private readonly invocations=new WeakMap<TaskRun,PluginInvocation>();
 private readonly disposeTasks:Array<()=>Promise<void>>=[];
 private readonly bundled=new Map<string,StoredPackage>();
 private readonly instanceListeners=new Set<(event:{userId:string;instanceId:string;context?:UserContext;action?:string})=>void|Promise<void>>();
 private closed=false;
 private closing?:Promise<void>;
 constructor(private readonly options:PluginHostOptions){
  const {db,configuration,execution}=options;
  for(const path of [options.directory,join(options.directory,'plugins'),join(options.directory,'plugins','packages'),join(options.directory,'plugins','instances')])privateDirectory(path);
  db.exec(`CREATE TABLE IF NOT EXISTS plugin_user_state(user_id TEXT PRIMARY KEY,deleted INTEGER NOT NULL DEFAULT 0);
   CREATE TABLE IF NOT EXISTS plugin_user_instances(user_id TEXT NOT NULL,id TEXT NOT NULL,generation INTEGER NOT NULL,removed INTEGER NOT NULL DEFAULT 0,json TEXT NOT NULL,verified_hash TEXT,PRIMARY KEY(user_id,id));
   CREATE TABLE IF NOT EXISTS plugin_user_snapshots(id TEXT PRIMARY KEY,user_id TEXT NOT NULL,instance_id TEXT NOT NULL,generation INTEGER NOT NULL,account_epoch INTEGER NOT NULL,binding_revision INTEGER NOT NULL,mode TEXT NOT NULL,released INTEGER NOT NULL DEFAULT 0,json TEXT NOT NULL,FOREIGN KEY(user_id,instance_id) REFERENCES plugin_user_instances(user_id,id));
   CREATE INDEX IF NOT EXISTS plugin_user_snapshot_owner ON plugin_user_snapshots(user_id,instance_id,released);
   CREATE TABLE IF NOT EXISTS plugin_user_events(user_id TEXT NOT NULL,sequence INTEGER NOT NULL,json TEXT NOT NULL,PRIMARY KEY(user_id,sequence));
   CREATE TABLE IF NOT EXISTS plugin_user_restore(user_id TEXT NOT NULL,operation_id TEXT NOT NULL,payload_hash TEXT NOT NULL,json TEXT NOT NULL,applied INTEGER NOT NULL DEFAULT 0,PRIMARY KEY(user_id,operation_id));`);
  this.catalog=new PluginCenter({db,reserveMetadata:bytes=>{if(!Number.isSafeInteger(bytes)||bytes<0)throw new StoreError('Invalid plugin metadata');}},execution.engine,new GitHubPluginReleases(join(options.directory,'plugins','packages'),options.releaseTransport),{catalogOnly:true});
  this.catalog.references=packageId=>db.prepare('SELECT 1 FROM plugin_user_instances WHERE removed=0 AND json_extract(json,\'$.packageId\')=? UNION ALL SELECT 1 FROM plugin_user_snapshots WHERE released=0 AND json_extract(json,\'$.packageId\')=? LIMIT 1').get(packageId,packageId)?['A retained user instance or snapshot requires this package']:[];
  configuration.registerDomain(PLUGIN_CONFIGURATION_DOMAIN,subject=>({id:PLUGIN_CONFIGURATION_DOMAIN,schema:pluginConfigurationSchema,defaultValue:{instances:[]},fields:[{path:'instances.*.configuration',sensitive:true}],resolve:raw=>raw,prepare:next=>this.prepare(subject.userId,pluginConfigurationSchema.parse(next))}));
  options.services.registerUser(PLUGINS_DOMAIN,{scope:'user',create:context=>this.forUser(context),lifecycle:this.lifecycle});
  options.services.registerInstance('plugin-catalog',{scope:'instance',service:{forAdministrator:(context:UserContext)=>this.forAdministrator(context)}});
  this.installTask('plugin.invoke');
 }
 private installTask(kind:string,modelFeature?:ModelFeature){
  const dispose=this.options.execution.register({kind,pool:'plugin-user',concurrency:()=>4,policy:modelFeature?EXECUTION_POLICIES.modelCall:EXECUTION_POLICIES.control,...(modelFeature?{modelFeature}:{}),
   parseInput:input=>invokeSchema.parse(input),authorizeInput:(context,input)=>{const value=this.authorized(context,String(input.snapshotId),String(input.componentId));if(this.adapter(value.component.capability).modelFeature!==modelFeature)throw new StoreError('Use the domain model task admission',403);},
   validate:task=>{try{const snapshot=this.snapshot(String(task.input.snapshotId));return snapshot.user_id===task.ownership?.userId&&this.currentSnapshot(snapshot);}catch{return false;}},
   execute:run=>this.execute(run),commit:(run,value)=>{const invocation=this.invocations.get(run);if(!invocation)throw new ScopeError('invalid_identity',401);invocation.assertCurrent();this.adapter(invocation.component.capability).commit?.(value,invocation);invocation.assertCurrent();},
   classify:error=>error instanceof ScopeError?new ExecutionFailure('stale','plugin_authority_revoked'):new ExecutionFailure('blocked','plugin_operation_requires_attention'),
  });let active=true;const release=async()=>{if(!active)return;active=false;await dispose();};this.disposeTasks.push(release);return release;
 }
 private transaction<T>(work:()=>T):T{const db=this.options.db,own=!db.isTransaction;if(own)db.exec('BEGIN IMMEDIATE');try{const result=work();if(own)db.exec('COMMIT');return result;}catch(error){if(own&&db.isTransaction)db.exec('ROLLBACK');throw error;}}
 private assert(context:UserContext){this.options.authority.assert(context);if(this.closed||this.options.db.prepare('SELECT 1 FROM plugin_user_state WHERE user_id=? AND deleted=1').get(context.userId))throw new ScopeError('invalid_identity',401);}
 private instance(userId:string,id:string){const row=this.options.db.prepare('SELECT * FROM plugin_user_instances WHERE user_id=? AND id=?').get(userId,id) as InstanceRow|undefined;if(!row||row.removed)throw new StoreError('Plugin instance not found',404);return row;}
 private package(id:string):StoredPackage{const row=this.options.db.prepare('SELECT json FROM plugin_packages WHERE id=?').get(id);if(!row)throw new StoreError('Plugin package unavailable',409);const pkg=JSON.parse(String(row.json)) as StoredPackage;if(pkg.view.state!=='installed')throw new StoreError('Plugin package unavailable',409);const bundled=this.bundled.get(id);if(bundled){if(digest(pkg.manifest)!==digest(bundled.manifest)||pkg.hostAdapter!==bundled.hostAdapter||pkg.view.source.digest!==bundled.view.source.digest)throw new StoreError('Bundled package changed',409);return bundled;}const current={...pkg,directory:join(this.catalog.releases.directory,pkg.view.source.digest)};this.catalog.releases.verifyInstalled(current.directory,pkg.view.source.digest,pkg.manifest,Boolean(pkg.hostAdapter));return current;}
 private components(pkg:StoredPackage){const values=pkg.manifest.components??[];if(new Set(values.map(c=>c.id)).size!==values.length||values.some(c=>!pkg.manifest.capabilities.includes(c.capability)))throw new StoreError('Plugin component contract is invalid',409);return clone(values);}
 private validate(instance:UserPluginInstance,complete=instance.desired){
  const pkg=this.package(instance.packageId);this.components(pkg);
  if(new Set(instance.grants.capabilities).size!==instance.grants.capabilities.length||new Set(instance.grants.sourceIds).size!==instance.grants.sourceIds.length||instance.grants.capabilities.some(c=>!pkg.manifest.capabilities.includes(c)))throw new StoreError('Invalid plugin grants');
  if(Object.keys(instance.configuration).some(key=>!pkg.manifest.configuration.some(f=>f.id===key)))throw new StoreError('Unknown plugin configuration field');
  for(const field of pkg.manifest.configuration){const value=instance.configuration[field.id];if(value===undefined||value===''){if(complete&&field.required)throw new StoreError('Missing plugin configuration');continue;}if(field.type==='number'?typeof value!=='number':field.type==='boolean'?typeof value!=='boolean':typeof value!=='string')throw new StoreError('Invalid plugin configuration');if(field.type==='select'&&!field.options?.some(o=>o.value===value))throw new StoreError('Invalid plugin configuration');if(['secret-reference','model-profile'].includes(field.type)&&(!String(value).startsWith('personal:')&&!String(value).startsWith('shared:')))throw new StoreError('Use an opaque scoped model reference');}
 }
 private prepare(userId:string,next:PluginConfiguration){
  for(const value of next.instances){this.validate(value);const row=this.options.db.prepare('SELECT * FROM plugin_user_instances WHERE user_id=? AND id=?').get(userId,value.id) as InstanceRow|undefined;if(value.desired&&row?.verified_hash!==signature(value))throw new StoreError('Check this exact configuration before enabling it',409);}
  const before=this.options.db.prepare('SELECT * FROM plugin_user_instances WHERE user_id=?').all(userId) as InstanceRow[];
  let published=false;
  return {apply:()=>{},publish:()=>{this.transaction(()=>{
   if(this.closed||this.options.db.prepare('SELECT 1 FROM plugin_user_state WHERE user_id=? AND deleted=1').get(userId))throw new ScopeError('invalid_identity',401);
   for(const value of next.instances)this.validate(value);
   for(const old of before)if(!next.instances.some(i=>i.id===old.id))this.options.db.prepare('UPDATE plugin_user_instances SET generation=generation+1,removed=1,verified_hash=NULL WHERE user_id=? AND id=? AND removed=0').run(userId,old.id);
   for(const value of next.instances){const old=before.find(i=>i.id===value.id),previous=old?JSON.parse(old.json) as UserPluginInstance:undefined,revoke=Boolean(old&&(old.removed||previous!.revocation!==value.revocation||digest(previous!.grants)!==digest(value.grants)));this.options.db.prepare('INSERT INTO plugin_user_instances VALUES(?,?,?,0,?,?) ON CONFLICT(user_id,id) DO UPDATE SET generation=excluded.generation,removed=0,json=excluded.json,verified_hash=excluded.verified_hash').run(userId,value.id,(old?.generation??1)+Number(revoke),JSON.stringify(value),old?.verified_hash===signature(value)?old.verified_hash:null);}
   published=true;
  });},rollback:()=>{if(published)this.transaction(()=>{this.options.db.prepare('DELETE FROM plugin_user_instances WHERE user_id=? AND id NOT IN (SELECT instance_id FROM plugin_user_snapshots WHERE user_id=?)').run(userId,userId);for(const old of before)this.options.db.prepare('INSERT INTO plugin_user_instances VALUES(?,?,?,?,?,?) ON CONFLICT(user_id,id) DO UPDATE SET generation=excluded.generation,removed=excluded.removed,json=excluded.json,verified_hash=excluded.verified_hash').run(old.user_id,old.id,old.generation,old.removed,old.json,old.verified_hash);});},complete:()=>{this.pruneSubscriptions();void this.retireRevoked().catch(()=>{});for(const old of before){const row=this.options.db.prepare('SELECT generation,removed FROM plugin_user_instances WHERE user_id=? AND id=?').get(userId,old.id);if(!row||row.removed||row.generation!==old.generation)for(const listener of this.instanceListeners)void Promise.resolve(listener({userId,instanceId:old.id})).catch(()=>{});}}};
 }
 private snapshot(id:string){const value=this.options.db.prepare('SELECT * FROM plugin_user_snapshots WHERE id=?').get(id) as Snapshot|undefined;if(!value)throw new StoreError('Plugin snapshot not found',404);return value;}
 private currentSnapshot(value:Snapshot){if(this.closed||value.released||this.options.db.prepare('SELECT 1 FROM plugin_user_state WHERE user_id=? AND deleted=1').get(value.user_id))return false;try{return this.instance(value.user_id,value.instance_id).generation===value.generation;}catch{return false;}}
 private owned(context:UserContext,id:string){this.assert(context);const value=this.snapshot(id);if(value.user_id!==context.userId)throw new StoreError('Plugin snapshot not found',404);if(value.account_epoch!==context.authorizationEpoch||!this.currentSnapshot(value))throw new ScopeError('invalid_identity',401);return value;}
 private authorized(context:UserContext,id:string,componentId:string){const snapshot=this.owned(context,id),fixed=JSON.parse(snapshot.json) as Fixed,component=fixed.components.find(c=>c.id===componentId);if(!component||!fixed.instance.grants.capabilities.includes(component.capability))throw new StoreError('Plugin capability unavailable',503);if(snapshot.mode==='history')throw new StoreError('A history binding cannot authorize a task',403);this.adapter(component.capability);return {snapshot,fixed,component};}
 private adapter(capability:PluginCapabilityId){const value=this.adapters.get(capability);if(!value)throw new StoreError('The scoped domain adapter is unavailable',503);return value;}
 /** A bundled provider has a fixed manifest and a trusted host implementation.
  * The administrator must still install it, and every user must configure/check/enable. */
 registerBundledPackage(manifest:PluginManifest,factory:PluginRuntimeFactory){
  const fingerprint=digest(manifest),id=manifest.id+'@'+fingerprint,adapter='bundled:'+id;
  if(this.bundled.has(id))throw new StoreError('Bundled package conflict',409);
  const pkg:StoredPackage={manifest:clone(manifest),previewId:'bundled',hostAdapter:adapter,view:{id,name:manifest.name,version:manifest.version,source:{repository:'utopiafar/mote',tag:'bundled-'+manifest.version,commit:fingerprint.slice(0,40),digest:fingerprint},runtime:'service',state:'installed',desired:false,observed:'installed',issues:[],instanceIds:[],allowedActions:[]}};
  this.bundled.set(id,pkg);this.registerRuntimeFactory(adapter,factory);return id;
 }
 installBundled(context:UserContext,packageId:string,input:unknown){this.options.authority.assertAdministrator(context);const pkg=this.bundled.get(packageId);if(!pkg)throw new StoreError('Bundled package unavailable',404);return this.catalog.installBundled(pkg,input);}
 /** Only a trusted domain receives a fixed metadata/generation fence. */
 onInstanceChange(listener:(event:{userId:string;instanceId:string;context?:UserContext;action?:string})=>void|Promise<void>){this.instanceListeners.add(listener);return ()=>{this.instanceListeners.delete(listener);};}
 storedAdmissionOpen(userId:string,instanceId:string){try{const row=this.instance(userId,instanceId),instance=JSON.parse(row.json) as UserPluginInstance;return !this.closed&&instance.desired&&row.verified_hash===signature(instance);}catch{return false;}}
 assertStoredBinding(userId:string,snapshotId:string){const snapshot=this.snapshot(snapshotId);if(snapshot.user_id!==userId||!this.currentSnapshot(snapshot))throw new ScopeError('invalid_identity',401);const epoch=this.options.db.prepare('SELECT authorization_epoch,disabled FROM auth_accounts WHERE user_id=?').get(userId);if(!epoch||epoch.disabled||epoch.authorization_epoch!==snapshot.account_epoch)throw new ScopeError('invalid_identity',401);return snapshot.account_epoch;}
 binding(context:UserContext,snapshotId:string){const snapshot=this.owned(context,snapshotId),fixed=JSON.parse(snapshot.json) as Fixed;return Object.freeze({instanceId:snapshot.instance_id,packageId:fixed.packageId,configuration:Object.freeze(clone(fixed.instance.configuration)),sourceIds:Object.freeze([...fixed.instance.grants.sourceIds]),assertCurrent:()=>{this.owned(context,snapshotId);}});}
 registerAdapter(capability:PluginCapabilityId,adapter:PluginDomainAdapter){if(this.closed||this.adapters.has(capability)||typeof adapter.validateResult!=='function')throw new StoreError('Plugin domain registration conflict',409);const dispose=adapter.modelFeature?this.installTask('plugin.invoke.'+capability,adapter.modelFeature):undefined;this.adapters.set(capability,adapter);return async()=>{if(this.adapters.get(capability)===adapter)this.adapters.delete(capability);await dispose?.();};}
 registerRuntimeFactory(id:string,factory:PluginRuntimeFactory){if(this.closed||!id||this.runtimeFactories.has(id))throw new StoreError('Plugin runtime registration conflict',409);this.runtimeFactories.set(id,factory);return async()=>{if(this.runtimeFactories.get(id)===factory)this.runtimeFactories.delete(id);if(!await this.closeWorkers(record=>record.factory===factory))throw new StoreError('Plugin runtime retirement requires reconciliation',503);};}
 /** Host-only retained domain grant. A worker receives neither this method nor its context. */
 domainGrant(context:UserContext,snapshotId:string,capability:PluginCapabilityId){const current=()=>{const value=this.owned(context,snapshotId),fixed=JSON.parse(value.json) as Fixed;if(value.mode!=='task'||!fixed.instance.grants.capabilities.includes(capability)||!fixed.components.some(c=>c.capability===capability))throw new ScopeError('invalid_identity',403);return fixed;};const fixed=current();return Object.freeze({sourceIds:Object.freeze([...fixed.instance.grants.sourceIds]),assertCurrent:()=>{current();},assertAdmission:()=>{current();if(!JSON.parse(this.instance(context.userId,fixed.instance.id).json).desired)throw new StoreError('Plugin admission is closed',409);}});}
 bindSource(bind:SourceCapabilityBinder,validateResult:PluginDomainAdapter['validateResult']=value=>value){return this.registerAdapter('source',{bind:invocation=>bind(invocation.context,invocation.sourceIds,invocation.assertCurrent),validateResult});}
 /** Trusted domain-only retained descriptor. Ordinary services and JSON RPC
  * never expose this API, its context, package paths or runtime handle. */
 async domainProvider(context:UserContext,snapshotId:string,capabilities:readonly PluginCapabilityId[]){
  const snapshot=this.owned(context,snapshotId),fixed=JSON.parse(snapshot.json) as Fixed;
  if(!capabilities.some(capability=>fixed.instance.grants.capabilities.includes(capability)))throw new StoreError('Provider capability unavailable',503);
  const pkg=this.package(fixed.packageId);if(pkg.view.source.digest!==fixed.digest||pkg.view.version!==fixed.version)throw new StoreError('Pinned provider unavailable',503);
  const assertCurrent=()=>{this.owned(context,snapshotId);};
  const root=this.directory(context.userId),directory=join(root,digest([fixed.instance.id,fixed.packageId,fixed.instance.configuration]));privateDirectory(directory);
  return Object.freeze({instanceId:snapshot.instance_id,namespace:this.namespace(snapshot),sourceIds:Object.freeze([...fixed.instance.grants.sourceIds]),history:fixed.instance.grants.history,configuration:Object.freeze(clone(fixed.instance.configuration)),adapter:pkg.hostAdapter,directory,assertCurrent,
   runtime:async()=>{assertCurrent();const runtime=await this.runtime(snapshot,fixed);assertCurrent();return Object.freeze({call:async(method:Parameters<PluginRuntime['call']>[0],params:unknown)=>{assertCurrent();const value=await runtime.worker.call(method,params);assertCurrent();return value;},close:async()=>{}});},
  });
 }
 /** Purpose-limited Memory lifecycle access. A revoked task snapshot cannot
  * regain inference, source tools or ordinary reads through this capability. */
 memoryMaintenance(subject:UserDataSubject,snapshotId:string,purpose:'export'|'delete'){
  const assert=()=>{this.options.services.assertSubject(subject,'memory',purpose);if(this.closed)throw new ScopeError('scope_unavailable',503);};assert();
  const snapshot=this.snapshot(snapshotId);if(snapshot.user_id!==subject.userId)throw new ScopeError('invalid_identity',403);const fixed=JSON.parse(snapshot.json) as Fixed;
  if(!fixed.instance.grants.capabilities.some(capability=>['repository','engine'].includes(capability)))throw new StoreError('Memory provider capability unavailable',503);
  const pkg=this.package(fixed.packageId);if(pkg.view.source.digest!==fixed.digest||pkg.view.version!==fixed.version)throw new StoreError('Pinned provider unavailable',503);
  const directory=join(this.directory(subject.userId),digest([fixed.instance.id,fixed.packageId,fixed.instance.configuration]));
  return Object.freeze({instanceId:snapshot.instance_id,namespace:this.namespace(snapshot),configuration:Object.freeze(clone(fixed.instance.configuration)),adapter:pkg.hostAdapter,directory,assertCurrent:assert,
   runtime:async()=>{assert();const worker=new WorkerPluginRuntime(join(pkg.directory!,pkg.manifest.entry),clone(fixed.instance.configuration),directory);try{const actual=z.object({components:z.array(componentSchema)}).strict().parse(await worker.call('describe',{}));assert();if(digest(actual.components)!==digest(fixed.components))throw new StoreError('Pinned maintenance provider differs',409);}catch(error){await worker.close();throw error;}return Object.freeze({call:async(method:Parameters<PluginRuntime['call']>[0],params:unknown)=>{assert();if(!(purpose==='delete'?['remove']:['read','export']).includes(method))throw new ScopeError('invalid_identity',403);const value=await worker.call(method,params);assert();return value;},close:()=>worker.close()});},
  });
 }
 forAdministrator(context:UserContext){
  const check=()=>{if(this.closed)throw new ScopeError('invalid_identity',401);this.options.authority.assertAdministrator(context);};check();
  return Object.freeze({view:()=>{check();return this.catalog.view();},resolve:async(input:unknown)=>{check();const result=await this.catalog.resolve(input);check();return result;},install:(input:unknown)=>{check();return this.catalog.install(input);},uninstall:(id:string,input:unknown)=>{check();return this.catalog.uninstall(id,input);}});
 }
 private async configuration(context:UserContext){this.assert(context);let view=await this.options.configuration.forUser(context).view();this.assert(context);
  const restores=this.options.db.prepare('SELECT * FROM plugin_user_restore WHERE user_id=? AND applied=0 ORDER BY rowid').all(context.userId);
  for(const restore of restores){const candidates=pluginConfigurationSchema.parse(JSON.parse(String(restore.json))),current=this.values(context.userId),ids=new Set(current.instances.map(i=>i.id));for(const candidate of candidates.instances){if(ids.has(candidate.id)&&digest(current.instances.find(i=>i.id===candidate.id))!==digest(candidate))throw new StoreError('Plugin restore conflicts with current configuration',409);if(!ids.has(candidate.id))current.instances.push(candidate);}view=await this.options.configuration.forUser(context).replace(PLUGIN_CONFIGURATION_DOMAIN,current,view.revision);this.assert(context);this.options.db.prepare('UPDATE plugin_user_restore SET applied=1 WHERE user_id=? AND operation_id=?').run(context.userId,restore.operation_id);}
  return view;
 }
 private values(userId:string):PluginConfiguration{return {instances:(this.options.db.prepare('SELECT json FROM plugin_user_instances WHERE user_id=? AND removed=0 ORDER BY id').all(userId)).map(row=>JSON.parse(String(row.json)) as UserPluginInstance)};}
 private safe(instance:UserPluginInstance){const value=clone(instance),pkg=this.package(value.packageId);for(const field of pkg.manifest.configuration)if(field.type==='secret-reference')delete value.configuration[field.id];return value;}
 forUser(context:UserContext){
  this.assert(context);
  return Object.freeze({
   view:async()=>{const configuration=await this.configuration(context);this.assert(context);const packages=this.catalog.view().packages.map(({instanceIds:_,operationId:_op,allowedActions:_actions,...pkg})=>({...pkg,instanceIds:[],allowedActions:['configure']}));return {revision:configuration.revision,packages,instances:this.values(context.userId).instances.map(value=>({...this.safe(value),generation:this.instance(context.userId,value.id).generation,checked:this.instance(context.userId,value.id).verified_hash===signature(value)}))};},
   configure:async(raw:unknown,expectedRevision:number)=>{await this.configuration(context);this.assert(context);const value=instanceSchema.parse(raw);this.validate(value);const current=this.values(context.userId),index=current.instances.findIndex(i=>i.id===value.id);if(index<0)current.instances.push(value);else current.instances[index]=value;await this.options.configuration.forUser(context).replace(PLUGIN_CONFIGURATION_DOMAIN,current,expectedRevision);this.assert(context);return this.forUser(context).view();},
   check:async(id:string)=>{await this.configuration(context);this.assert(context);const row=this.instance(context.userId,id),instance=JSON.parse(row.json) as UserPluginInstance,pkg=this.package(instance.packageId),fixed={instance,components:this.components(pkg),packageId:pkg.view.id,version:pkg.view.version,digest:pkg.view.source.digest};this.validate(instance,true);const runtime=await this.openRuntime('probe:'+randomUUID(),context.userId,fixed,row.generation,true);try{return this.transaction(()=>{this.assert(context);const current=this.instance(context.userId,id);if(current.generation!==row.generation||current.json!==row.json)throw new StoreError('Plugin configuration changed',409);this.options.db.prepare('UPDATE plugin_user_instances SET verified_hash=? WHERE user_id=? AND id=? AND generation=?').run(signature(instance),context.userId,id,row.generation);return {checked:true,components:runtime.registry.inventory().capabilities};});}finally{await this.closeWorker(runtime.record);}},
   action:async(id:string,action:'pause'|'disable'|'resume'|'enable'|'stop',expectedRevision:number)=>{await this.configuration(context);const row=this.instance(context.userId,id),instance=JSON.parse(row.json) as UserPluginInstance;instance.desired=action==='resume'||action==='enable';if(action==='stop')instance.revocation=randomUUID();const result=await this.forUser(context).configure(instance,expectedRevision);for(const listener of this.instanceListeners)await listener({userId:context.userId,instanceId:id,context,action});return result;},
   admit:async(id:string,mode:'task'|'history'='task',bindingRevision=1)=>{await this.configuration(context);return this.transaction(()=>{this.assert(context);const row=this.instance(context.userId,id),instance=JSON.parse(row.json) as UserPluginInstance;if(!instance.desired||row.verified_hash!==signature(instance)||mode==='history'&&!instance.grants.history)throw new StoreError('Plugin admission is closed',409);z.number().int().positive().parse(bindingRevision);const pkg=this.package(instance.packageId),fixed:Fixed={instance:clone(instance),components:this.components(pkg),packageId:pkg.view.id,version:pkg.view.version,digest:pkg.view.source.digest},snapshotId=randomUUID();this.options.db.prepare('INSERT INTO plugin_user_snapshots VALUES(?,?,?,?,?,?,?,0,?)').run(snapshotId,context.userId,id,row.generation,context.authorizationEpoch,bindingRevision,mode,JSON.stringify(fixed));return Object.freeze({id:snapshotId,packageId:fixed.packageId,version:fixed.version,digest:fixed.digest,mode,bindingRevision});});},
   invoke:async(snapshotId:string,componentId:string,payload:Record<string,unknown>,operationId:string)=>{const {component}=this.authorized(context,snapshotId,componentId),adapter=this.adapter(component.capability);return this.options.execution.forUser(context).submit({kind:adapter.modelFeature?'plugin.invoke.'+component.capability:'plugin.invoke',operationId,input:{snapshotId,componentId,payload}});},
   history:async(snapshotId:string,method:'read'|'search'|'export',params:Record<string,unknown>)=>{const snapshot=this.owned(context,snapshotId),fixed=JSON.parse(snapshot.json) as Fixed;if(snapshot.mode!=='history'||!fixed.instance.grants.history)throw new StoreError('History authorization required',403);if(!['read','search','export'].includes(method)||['ownerId','userId','namespace','instanceId'].some(k=>Object.hasOwn(params,k)))throw new StoreError('Invalid provider read');const capability=method==='search'?'retrieval':'repository';if(!fixed.instance.grants.capabilities.includes(capability))throw new StoreError('Provider capability unavailable',503);const adapter=this.adapter(capability);if(!adapter.validateHistory)throw new StoreError('The domain history validator is unavailable',503);const runtime=await this.runtime(snapshot,fixed);this.owned(context,snapshotId);let result:unknown;try{result=await runtime.worker.call(method,{...params,namespace:this.namespace(snapshot)},undefined);}finally{this.owned(context,snapshotId);}if(this.adapters.get(capability)!==adapter)throw new ScopeError('invalid_identity',401);const validated=await adapter.validateHistory(result,{context,sourceIds:Object.freeze([...fixed.instance.grants.sourceIds]),assertCurrent:()=>{this.owned(context,snapshotId);},namespace:this.namespace(snapshot),method,params});this.owned(context,snapshotId);if(this.adapters.get(capability)!==adapter)throw new ScopeError('invalid_identity',401);return validated;},
   release:async(snapshotId:string)=>{this.transaction(()=>{this.assert(context);const snapshot=this.snapshot(snapshotId);if(snapshot.user_id!==context.userId)throw new StoreError('Plugin snapshot not found',404);this.options.db.prepare('UPDATE plugin_user_snapshots SET released=1 WHERE id=? AND user_id=?').run(snapshotId,context.userId);});this.pruneSubscriptions();await this.retireRevoked();},
   inventory:async(snapshotId:string)=>{const snapshot=this.owned(context,snapshotId),fixed=JSON.parse(snapshot.json) as Fixed,runtime=await this.runtime(snapshot,fixed);this.owned(context,snapshotId);const inventory=runtime.registry.inventory();return {...inventory,capabilities:inventory.capabilities.map(c=>{const component=fixed.components.find(v=>v.id===c.id);return component&&this.adapters.has(component.capability)?c:{...c,state:'unavailable' as const,reason:'scoped_domain_unavailable'};})};},
   subscribe:(snapshotId:string,callback:(value:unknown)=>void)=>{this.owned(context,snapshotId);const listener={context,snapshotId,callback};this.subscriptions.add(listener);return ()=>{this.subscriptions.delete(listener);};},
   events:(since=0)=>{this.assert(context);z.number().int().nonnegative().parse(since);return this.options.db.prepare('SELECT sequence,json FROM plugin_user_events WHERE user_id=? AND sequence>? ORDER BY sequence LIMIT 100').all(context.userId,since).map(row=>({sequence:Number(row.sequence),value:JSON.parse(String(row.json))}));},
  });
 }
 private namespace(snapshot:Snapshot){return Object.freeze({ownerId:snapshot.user_id,instanceId:snapshot.instance_id,bindingRevision:snapshot.binding_revision});}
 private directory(userId:string){for(const path of [this.options.directory,join(this.options.directory,'plugins'),join(this.options.directory,'plugins','instances')])privateDirectory(path);const path=join(this.options.directory,'plugins','instances',digest([this.options.authority.deploymentId,userId]));privateDirectory(path);return path;}
 private async openRuntime(key:string,userId:string,fixed:Fixed,generation:number,probe=false):Promise<Runtime>{
  const pkg=this.package(fixed.packageId);if(pkg.view.source.digest!==fixed.digest||pkg.view.version!==fixed.version)throw new StoreError('Pinned plugin release unavailable',409);
  const factory=pkg.hostAdapter?this.runtimeFactories.get(pkg.hostAdapter):undefined;if(pkg.hostAdapter&&!factory)throw new StoreError('This provider requires its scoped domain adapter',503);
  if(this.closed)throw new StoreError('Plugin host is closing',503);
  await Promise.all([...this.workers].filter(record=>record.userId===userId&&record.instanceId===fixed.instance.id&&(record.generation!==generation||Boolean(record.closing))).map(record=>this.closeWorker(record)));
  if(this.closed||this.instance(userId,fixed.instance.id).generation!==generation)throw new ScopeError('invalid_identity',401);
  const root=this.directory(userId),probeRoot=join(root,'probes');if(probe)privateDirectory(probeRoot);
  const directory=probe?join(probeRoot,digest(key)):join(root,digest([fixed.instance.id,fixed.packageId,fixed.instance.configuration]));privateDirectory(directory);
  const worker=factory?factory(Object.freeze({userId,instanceId:fixed.instance.id,generation,directory,configuration:Object.freeze(clone(fixed.instance.configuration))})):new WorkerPluginRuntime(join(pkg.directory!,pkg.manifest.entry),clone(fixed.instance.configuration),directory),scope=new BackendPluginScope(this.root),registry=new FeatureRegistry<Runtime['registry'] extends FeatureRegistry<infer T>?T:never>();
  const record:WorkerRecord={scope,worker,userId,instanceId:fixed.instance.id,generation,...(factory?{factory,factoryId:pkg.hostAdapter}:{}),...(probe?{probeDirectory:directory}:{})};this.workers.add(record);
  try{const actual=z.object({components:z.array(componentSchema)}).strict().parse(await worker.call('describe',{}));if(digest(actual.components)!==digest(fixed.components))throw new StoreError('Actual plugin registration differs from the pinned manifest',409);
   if(this.closed||this.instance(userId,fixed.instance.id).generation!==generation)throw new ScopeError('invalid_identity',401);
   await scope.install(ctx=>{ctx.effect(()=>()=>worker.close());ctx.effect(()=>registry.install({id:pkg.manifest.id,version:fixed.version,components:fixed.components}));for(const component of actual.components)ctx.effect(()=>registry.register(pkg.manifest.id,component,(input,hostCall,signal)=>worker.call('invoke',{componentId:component.id,input},signal,hostCall)));});
   return {record,worker,scope,registry};
  }catch(error){await this.closeWorker(record);throw error;}
 }
 private runtimeKey(userId:string,fixed:Fixed,generation:number){return digest([userId,fixed.instance.id,generation,fixed.packageId,fixed.instance.configuration]);}
 private async runtime(snapshot:Snapshot,fixed:Fixed):Promise<Runtime>{const key=this.runtimeKey(snapshot.user_id,fixed,snapshot.generation);let value=this.runtimes.get(key);if(!value){value=this.openRuntime(key,snapshot.user_id,fixed,snapshot.generation);this.runtimes.set(key,value);void value.catch(()=>{if(this.runtimes.get(key)===value)this.runtimes.delete(key);});}const runtime=await value;if(!this.workers.has(runtime.record)||runtime.record.closing||runtime.record.factory&&this.runtimeFactories.get(runtime.record.factoryId!)!==runtime.record.factory){if(this.runtimes.get(key)===value)this.runtimes.delete(key);return this.runtime(snapshot,fixed);}return runtime;}
 private async execute(run:TaskRun){
  const input=invokeSchema.parse(run.task.input),{snapshot,fixed,component}=this.authorized(run.context,input.snapshotId,input.componentId),assertCurrent=()=>{run.grant.assert();this.owned(run.context,snapshot.id);if(this.adapters.get(component.capability)!==adapter)throw new ScopeError('invalid_identity',401);},adapter=this.adapter(component.capability);
  const invocation:PluginInvocation=Object.freeze({context:run.context,instanceId:snapshot.instance_id,snapshotId:snapshot.id,packageId:fixed.packageId,configuration:Object.freeze(clone(fixed.instance.configuration)),sourceIds:Object.freeze([...fixed.instance.grants.sourceIds]),history:fixed.instance.grants.history,namespace:this.namespace(snapshot),component:clone(component),run,assertCurrent});
  if(adapter.modelFeature&&run.model?.lease.feature!==adapter.modelFeature||!adapter.modelFeature&&run.model)throw new StoreError('Plugin model task contract changed',409);
  this.invocations.set(run,invocation);assertCurrent();const runtime=await this.runtime(snapshot,fixed);assertCurrent();const invoke=runtime.registry.get(component.id);if(!invoke)throw new StoreError('Pinned plugin component unavailable',503);const methods=Object.freeze({...adapter.bind?.(invocation)});
  let value:unknown;try{value=await invoke(clone(input.payload),async(method,params)=>{assertCurrent();if(method==='emit'){this.emit(invocation,params);return {published:true};}if(!Object.hasOwn(methods,method))throw new StoreError('Host capability unavailable',503);const result=await methods[method]!(...(Array.isArray(params)?clone(params):[clone(params)]));assertCurrent();return result;},run.signal);}finally{assertCurrent();}const result=adapter.validateResult(value,invocation);assertCurrent();return result;
 }
 private emit(invocation:PluginInvocation,value:unknown){invocation.assertCurrent();const json=JSON.stringify(value);if(json===undefined||Buffer.byteLength(json)>32768)throw new StoreError('Plugin event is too large',413);invocation.run.grant.commit(()=>{invocation.assertCurrent();this.options.db.prepare('INSERT INTO plugin_user_events SELECT ?,coalesce(max(sequence),0)+1,? FROM plugin_user_events WHERE user_id=?').run(invocation.context.userId,json,invocation.context.userId);});for(const listener of this.subscriptions){try{this.owned(listener.context,listener.snapshotId);if(listener.context.userId===invocation.context.userId&&listener.snapshotId===invocation.snapshotId){invocation.assertCurrent();listener.callback(clone(value));}}catch{this.subscriptions.delete(listener);}}}
 private pruneSubscriptions(){for(const listener of this.subscriptions)try{this.owned(listener.context,listener.snapshotId);}catch{this.subscriptions.delete(listener);}}
 private closeWorker(record:WorkerRecord){
  if(record.closing)return record.closing;
  const result=(async()=>{await record.worker.close();await record.scope.close();if(record.probeDirectory)await rm(record.probeDirectory,{recursive:true,force:true});this.workers.delete(record);})();record.closing=result;
  void result.catch(()=>{record.closing=undefined;});return result;
 }
 private async closeWorkers(predicate:(record:WorkerRecord)=>boolean){const results=await Promise.allSettled([...this.workers].filter(predicate).map(record=>this.closeWorker(record)));return results.every(result=>result.status==='fulfilled');}
 private async retireRevoked(){
  const retained=new Set((this.options.db.prepare('SELECT * FROM plugin_user_snapshots WHERE released=0').all() as Snapshot[]).filter(snapshot=>this.currentSnapshot(snapshot)).map(snapshot=>this.runtimeKey(snapshot.user_id,JSON.parse(snapshot.json),snapshot.generation)));
  for(const [key,promise] of this.runtimes){if(!this.closed&&retained.has(key))continue;this.runtimes.delete(key);try{await this.closeWorker((await promise).record);}catch{}}
  await this.closeWorkers(record=>{if(this.closed)return true;try{return this.instance(record.userId,record.instanceId).generation!==record.generation;}catch{return true;}});
 }
 readonly lifecycle:DomainLifecycle={
  exportUser:async subject=>{this.options.services.assertSubject(subject,PLUGINS_DOMAIN,'export');return this.transaction(()=>{this.options.services.assertSubject(subject,PLUGINS_DOMAIN,'export');return {domain:PLUGINS_DOMAIN,version:1,deploymentId:subject.deploymentId,userId:subject.userId,payload:{format:'mote-user-plugins-v1',coverage:{instanceDefinitions:true,credentials:false,activeAuthorization:false,runtimeData:false,excluded:['provider-domain-data','runtime-files','snapshots','subscriptions','events']},instances:this.values(subject.userId).instances.map(value=>({...this.safe(value),desired:false,revocation:'restored',grants:{capabilities:[],sourceIds:[],history:false}}))}};});},
  deleteUser:async(subject,operationId)=>{this.options.services.assertSubject(subject,PLUGINS_DOMAIN,'delete');this.transaction(()=>{this.options.services.assertSubject(subject,PLUGINS_DOMAIN,'delete');this.options.db.prepare('INSERT INTO plugin_user_state VALUES(?,1) ON CONFLICT(user_id) DO UPDATE SET deleted=1').run(subject.userId);this.options.db.prepare('UPDATE plugin_user_instances SET generation=generation+1,removed=1,verified_hash=NULL WHERE user_id=? AND removed=0').run(subject.userId);this.options.db.prepare('UPDATE plugin_user_snapshots SET released=1 WHERE user_id=?').run(subject.userId);});this.pruneSubscriptions();if(!await this.closeWorkers(record=>record.userId===subject.userId))return {status:'result_unknown',operationId};await this.retireRevoked();this.options.services.assertSubject(subject,PLUGINS_DOMAIN,'delete');await rm(this.directory(subject.userId),{recursive:true,force:true});this.options.services.assertSubject(subject,PLUGINS_DOMAIN,'delete');this.transaction(()=>{for(const table of ['plugin_user_snapshots','plugin_user_instances','plugin_user_events','plugin_user_restore'])this.options.db.prepare('DELETE FROM '+table+' WHERE user_id=?').run(subject.userId);});return {status:'complete',operationId};},
  restoreUser:async(subject,archive,operationId)=>this.restore(subject,archive,operationId),
 };
 private restore(subject:UserDataSubject,archive:UserExport,operationId:string){
  this.options.services.assertSubject(subject,PLUGINS_DOMAIN,'restore');if(archive.domain!==PLUGINS_DOMAIN||archive.version!==1||archive.userId!==subject.userId||archive.deploymentId!==subject.deploymentId)throw new StoreError('Plugin archive scope mismatch');
  const value=z.object({format:z.literal('mote-user-plugins-v1'),coverage:z.object({instanceDefinitions:z.literal(true),credentials:z.literal(false),activeAuthorization:z.literal(false),runtimeData:z.literal(false),excluded:z.tuple([z.literal('provider-domain-data'),z.literal('runtime-files'),z.literal('snapshots'),z.literal('subscriptions'),z.literal('events')])}).strict(),instances:z.array(instanceSchema)}).strict().parse(archive.payload),instances=value.instances.map(value=>({...value,desired:false,revocation:'restored',grants:{capabilities:[],sourceIds:[],history:false}}));
  pluginConfigurationSchema.parse({instances});for(const instance of instances)this.validate(instance);
  this.transaction(()=>{this.options.services.assertSubject(subject,PLUGINS_DOMAIN,'restore');const hash=digest(value),prior=this.options.db.prepare('SELECT payload_hash FROM plugin_user_restore WHERE user_id=? AND operation_id=?').get(subject.userId,operationId);if(prior){if(prior.payload_hash!==hash)throw new StoreError('Plugin restore identity conflict',409);return;}if(this.values(subject.userId).instances.length)throw new StoreError('Plugin restore requires an empty target domain',409);this.options.db.prepare('INSERT INTO plugin_user_restore VALUES(?,?,?,?,0)').run(subject.userId,operationId,hash,JSON.stringify({instances}));this.options.db.prepare('INSERT INTO plugin_user_state VALUES(?,0) ON CONFLICT(user_id) DO UPDATE SET deleted=0').run(subject.userId);});return Promise.resolve();
 }
 close(){if(this.closing)return this.closing;this.closed=true;this.subscriptions.clear();return this.closing=(async()=>{if(!await this.closeWorkers(()=>true))throw new StoreError('Plugin workers require shutdown reconciliation',503);await this.retireRevoked();for(const dispose of this.disposeTasks)await dispose();await this.catalog.close();await this.root.fiber.dispose();})();}
}
export type UserPluginService=ReturnType<ScopedPluginHost['forUser']>;
