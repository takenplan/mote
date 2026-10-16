import {randomUUID} from 'node:crypto';
import {join} from 'node:path';
import {existsSync} from 'node:fs';
import type {ModelSettings} from '@mote/shared/models';
import {modelSettingsSchema} from '../model-settings.js';
import type {DatabaseSync} from 'node:sqlite';
import {z} from 'zod';
import type {TokenUsage} from '@mote/shared';
import {Mem0MemoryProvider} from '../mem0-memory-provider.js';
import {createHindsightEngine,HindsightEngine,type HindsightPrepare} from '../hindsight-engine.js';
import {hindsightModelFingerprint,type HindsightRuntime} from '../hindsight-runtime.js';
import {WorkerMemoryProvider} from '../worker-memory-provider.js';
import {MemoryProviderError,memoryProviderNamespaceSchema,type MemoryProvider,type MemoryProviderNamespace} from '../memory-provider-contract.js';
import {PrivateSql,PrivateDataError} from './private-data-sql.js';
import type {UserContext,UserContextAuthority} from './context.js';
import type {Configurations,ModelLease} from './configuration.js';
import type {ScopedPluginHost} from './plugins.js';
import {memoryHash} from './memory-data.js';
import {ScopedMemoryError,type ScopedMemoryBinding} from './memory-schema.js';

export type HindsightRuntimeFactory=(options:Parameters<typeof createHindsightEngine>[0]&{userId:string})=>HindsightRuntime;
export type MemoryProviderOptions={hindsightRuntimeFactory?:HindsightRuntimeFactory};
type Binding=Extract<ScopedMemoryBinding,{kind:'plugin'}>;
type ProviderConfig={snapshot_id:string;operation_id:string;configuration_hash:string};
type Entry={provider:MemoryProvider;tail:Promise<unknown>;active?:{assert:()=>void;lease?:ModelLease;tokens?:TokenUsage;started:number;modelStarted:boolean};base:ProviderConfig};
const referenceSchema=z.string().regex(/^(personal|shared):.+$/).transform(value=>{const at=value.indexOf(':');return {kind:value.slice(0,at) as 'personal'|'shared',id:value.slice(at+1)};});
const unavailable=()=>new MemoryProviderError('unavailable','The retained scoped Memory provider is unavailable');

/** M09 owns package/instance grants and fixed configuration. M04 owns keys and
 * model leases. This domain recipe supplies existing native provider classes;
 * it creates no alternate data store, model selector or publication path. */
export class ScopedMemoryProviders {
 private readonly entries=new Map<string,Promise<Entry>>();
 private closed=false;
 private readonly releaseFactories:Array<()=>Promise<void>>=[];
 constructor(private readonly db:DatabaseSync,private readonly authority:UserContextAuthority,private readonly configuration:Configurations,private readonly plugins:ScopedPluginHost,private readonly options:MemoryProviderOptions={}){
  for(const [adapter,id,version,capabilities] of [['mote.mem0@1','mote.mem0','3.3.1',['repository','retrieval']],['mote.hindsight@1','mote.hindsight','0.10.2',['engine']]] as const)this.releaseFactories.push(plugins.registerRuntimeFactory(adapter,()=>({call:async method=>{if(method==='describe')return {components:capabilities.map(capability=>({id:id+'.'+capability,version,surface:capability==='engine'?'agent':'data',capability}))};throw new MemoryProviderError('unsupported_input','Use the scoped Memory domain for this native provider operation');},close:async()=>{}})));
 }
 private sql(context:UserContext){return new PrivateSql(this.db,context.userId,()=>{this.authority.assert(context);if(this.closed)throw unavailable();});}
 async descriptor(context:UserContext,binding:Binding){
  this.authority.assert(context);const value=await this.plugins.domainProvider(context,binding.snapshotId,['repository','engine']);this.authority.assert(context);
  if(value.instanceId!==binding.instanceId||value.namespace.ownerId!==context.userId||value.namespace.bindingRevision!==binding.revision)throw unavailable();return value;
 }
 /** Only explicit binding preparation may create this mapping. Reads/recovery
  * never reconstruct a missing mapping from the current profile. */
 async provision(context:UserContext,binding:Binding){
  const descriptor=await this.descriptor(context,binding),sql=this.sql(context),namespace=descriptor.namespace,tag=memoryHash(namespace),prior=sql.get('SELECT * FROM mm_provider_config WHERE user_id=$user AND namespace_hash=?',tag) as ProviderConfig|undefined;
  if(!descriptor.adapter)return;
  const hash=memoryHash([descriptor.adapter,descriptor.configuration]);if(prior){if(prior.configuration_hash!==hash)throw unavailable();return;}
  const reference=referenceSchema.parse(descriptor.configuration[descriptor.adapter==='mote.mem0@1'?'embeddingSecretReference':'modelProfileId']),operationId='memory-provider:'+randomUUID(),lease=await this.configuration.leaseReference(context,'memory',operationId,reference);descriptor.assertCurrent();
  const literal=await this.configuration.withModel(lease,async settings=>{
   if(descriptor.adapter==='mote.mem0@1'){
    if(descriptor.configuration.embeddingBaseUrl!==settings.baseUrl||descriptor.configuration.embeddingModel!==settings.model)throw new PrivateDataError('invalid_data');
    z.number().int().positive().parse(descriptor.configuration.embeddingDimension);
   }return {settings:{...settings,apiKey:'',headers:{},extraBody:{}},modelFingerprint:hindsightModelFingerprint(settings)};
  });descriptor.assertCurrent();sql.transaction(()=>{sql.run('INSERT INTO mm_provider_config VALUES($user,?,?,?,?)',tag,lease.snapshotId,operationId,hash);sql.run('INSERT INTO mm_provider_descriptors VALUES($user,?,?)',tag,JSON.stringify(literal));});
 }
 private async open(context:UserContext,binding:Binding):Promise<Entry>{
  const descriptor=await this.descriptor(context,binding),namespace=descriptor.namespace,tag=memoryHash(namespace),sql=this.sql(context),base=sql.get('SELECT * FROM mm_provider_config WHERE user_id=$user AND namespace_hash=?',tag) as ProviderConfig|undefined;
  if(!descriptor.adapter)return {provider:new WorkerMemoryProvider(await descriptor.runtime()),tail:Promise.resolve(),base:{snapshot_id:'',operation_id:'',configuration_hash:memoryHash(descriptor.configuration)}};
  if(!base||base.configuration_hash!==memoryHash([descriptor.adapter,descriptor.configuration]))throw unavailable();
  const restored=await this.configuration.restoreLease(context,base.snapshot_id,base.operation_id);descriptor.assertCurrent();const saved=sql.get('SELECT json FROM mm_provider_descriptors WHERE user_id=$user AND namespace_hash=?',tag);
  const literal=saved?z.object({settings:modelSettingsSchema,modelFingerprint:z.string().regex(/^[a-f0-9]{64}$/)}).strict().parse(JSON.parse(String(saved.json))):undefined;
  if(restored.status!=='restored'&&(!['credentials_revoked','configuration_deleted'].includes(restored.reason)||!literal))throw unavailable();
  const directory=join(descriptor.directory,'memory-'+tag);if(restored.status!=='restored'&&descriptor.adapter==='mote.mem0@1'&&!['operations.db','vectors.db','history.db'].every(file=>existsSync(join(directory,file))))throw unavailable();
  const entry:Entry={provider:undefined as unknown as MemoryProvider,tail:Promise.resolve(),base};
  const create=async(settings:Readonly<ModelSettings>)=>{
   const assert=()=>{const active=entry.active;if(!active?.lease)throw unavailable();active.modelStarted=true;active.assert();this.configuration.assertLease(active.lease);};
   if(descriptor.adapter==='mote.mem0@1')return new Mem0MemoryProvider({directory:join(descriptor.directory,'memory-'+tag),embedding:{baseUrl:settings.baseUrl,model:settings.model,dimension:z.number().int().positive().parse(descriptor.configuration.embeddingDimension),apiKey:settings.apiKey||'unused-local-literal-reader'}},{assertEmbeddingAuthority:assert,...(restored.status!=='restored'?{embeddingUnavailable:unavailable()}:{})});
   if(descriptor.adapter==='mote.hindsight@1'){
    const options:Parameters<typeof createHindsightEngine>[0]={directory:join(descriptor.directory,'memory-'+tag),instanceId:binding.instanceId,configurationIdentity:memoryHash([context.deploymentId,descriptor.namespace,base.configuration_hash]),modelFingerprint:literal?.modelFingerprint??hindsightModelFingerprint(settings),settings:{...settings},assertModelAuthority:assert,runModel:async work=>{assert();const result=await work();assert();return result;},onUsage:tokens=>{assert();const prior=entry.active!.tokens;if(!prior){entry.active!.tokens=tokens;return;}const fields=['requests','reportedRequests','inputTokens','outputTokens','totalTokens','cacheReadTokens','cacheWriteTokens'] as const;entry.active!.tokens={...tokens,...Object.fromEntries(fields.flatMap(field=>prior[field]!==undefined||tokens[field]!==undefined?[[field,(prior[field]??0)+(tokens[field]??0)]]:[]))};}};
    return this.options.hindsightRuntimeFactory?new HindsightEngine({directory:join(options.directory,'provider'),runtime:this.options.hindsightRuntimeFactory({...options,userId:context.userId}),model:settings.model}):createHindsightEngine(options);
   }
   throw unavailable();
  };
  entry.provider=restored.status==='restored'?await this.configuration.withModel(restored.lease,create):await create(literal!.settings);return entry;
 }
 private async entry(context:UserContext,binding:Binding){const descriptor=await this.descriptor(context,binding);if(!descriptor.adapter)return this.open(context,binding);const key=memoryHash([descriptor.namespace,descriptor.configuration]),existing=this.entries.get(key);if(existing)return existing;const created=this.open(context,binding);this.entries.set(key,created);void created.catch(()=>{if(this.entries.get(key)===created)this.entries.delete(key);});return created;}
 private async call<T>(context:UserContext,binding:Binding,assertCurrent:()=>void,work:(provider:MemoryProvider)=>Promise<T>,literalRead=false):Promise<T>{
  assertCurrent();const descriptor=await this.descriptor(context,binding),entry=await this.entry(context,binding);assertCurrent();
  const assert=()=>{this.authority.assert(context);descriptor.assertCurrent();assertCurrent();if(this.closed)throw unavailable();};
  const execute=async()=>{
   assert();let lease:ModelLease|undefined;if(entry.base.snapshot_id){const current=await this.configuration.restoreLease(context,entry.base.snapshot_id,entry.base.operation_id);assert();if(current.status==='restored')lease=await this.configuration.forkLease(context,entry.base.snapshot_id,entry.base.operation_id,'memory-call:'+randomUUID());else if(!literalRead||!['credentials_revoked','configuration_deleted'].includes(current.reason))throw unavailable();}assert();
   entry.active={assert,lease,started:Date.now(),modelStarted:false};
   try{const result=await work(entry.provider);assert();if(lease&&entry.active?.modelStarted)this.configuration.recordUsage(lease,{status:'completed',durationMs:Date.now()-entry.active!.started,...(entry.active!.tokens?{tokens:entry.active!.tokens}:{})});return result;}
   catch(error){assert();if(lease&&entry.active?.modelStarted)this.configuration.recordUsage(lease,{status:'failed',durationMs:Date.now()-entry.active!.started,...(entry.active!.tokens?{tokens:entry.active!.tokens}:{})});throw error instanceof MemoryProviderError?new ScopedMemoryError(error.code==='unknown_result'?'memory_provider_result_unknown':error.code==='invalid_record'||error.code==='conflict'?'memory_provider_invalid_record':'memory_provider_unavailable',error.code==='invalid_record'||error.code==='conflict'?502:503):error instanceof z.ZodError?new ScopedMemoryError('memory_provider_invalid_record',502):new ScopedMemoryError('memory_provider_unavailable');}
   finally{entry.active=undefined;}
  };
  const result=entry.tail.then(execute);entry.tail=result.then(()=>{},()=>{});return result;
 }
 async provider(context:UserContext,binding:Binding,assertCurrent:()=>void):Promise<MemoryProvider>{
  const descriptor=await this.descriptor(context,binding),namespace=descriptor.namespace,check=(actual:MemoryProviderNamespace)=>{memoryProviderNamespaceSchema.parse(actual);if(memoryHash(actual)!==memoryHash(namespace))throw new MemoryProviderError('invalid_record','Memory namespace does not match its host binding');};
  return Object.freeze<MemoryProvider>({
   put:input=>{check(input.namespace);return this.call(context,binding,assertCurrent,provider=>provider.put(input));},
   read:input=>{check(input.namespace);return this.call(context,binding,assertCurrent,provider=>provider.read(input),true);},
   search:input=>{check(input.namespace);return this.call(context,binding,assertCurrent,provider=>provider.search(input),descriptor.adapter==='mote.hindsight@1');},
   remove:input=>{check(input.namespace);return this.call(context,binding,assertCurrent,provider=>provider.remove(input),true);},
   export:input=>{check(input.namespace);return this.call(context,binding,assertCurrent,provider=>provider.export(input),true);},
   health:input=>{check(input.namespace);return this.call(context,binding,assertCurrent,provider=>provider.health(input));},
   recover:input=>{check(input.namespace);return this.call(context,binding,assertCurrent,provider=>provider.recover(input));},
   close:async()=>{},
  });
 }
 async verify(context:UserContext,binding:Binding,assertCurrent:()=>void,signal:AbortSignal){const descriptor=await this.descriptor(context,binding);return this.call(context,binding,assertCurrent,provider=>provider instanceof HindsightEngine?provider.probe(signal):provider.recover({namespace:descriptor.namespace}));}
 async nativeDraft(context:UserContext,binding:Binding,input:HindsightPrepare,assertCurrent:()=>void){
  const descriptor=await this.descriptor(context,binding);if(descriptor.adapter!=='mote.hindsight@1')return;
  if(memoryHash(descriptor.namespace)!==memoryHash(input.namespace))throw unavailable();
  return this.call(context,binding,assertCurrent,provider=>{if(!(provider instanceof HindsightEngine))throw unavailable();return provider.prepare(input);});
 }
 async close(){if(this.closed)return;this.closed=true;for(const promise of this.entries.values()){try{await (await promise).provider.close();}catch{}}this.entries.clear();for(const release of this.releaseFactories.reverse())await release();}
}
