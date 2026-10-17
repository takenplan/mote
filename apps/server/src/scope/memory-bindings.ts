import {z} from 'zod';
import {memorySchema,type Memory} from '../memory-schema.js';
import {memoryProviderKey,memoryBodyDigest} from '../memory-provider-contract.js';
import {stageVerifiedMemoryWrite} from '../memory-provider-publication.js';
import {EXECUTION_POLICIES} from '../execution-policy.js';
import {ExecutionFailure} from '../execution-engine.js';
import {PrivateDataError,missing} from './private-data-sql.js';
import type {UserContext} from './context.js';
import type {TaskExecution,TaskRun} from './task-execution.js';
import type {ScopedPluginHost} from './plugins.js';
import type {ScopedMemoryProviders} from './memory-providers.js';
import {memoryHash,type ScopedMemoryData} from './memory-data.js';
import {queueMemoryErases} from './memory-reconcile.js';
import {memoryBindingSchema,type ScopedMemoryBinding} from './memory-schema.js';

type Preparation={id:string;source:string;target:string;catalog_hash:string|null;json:string;state:string;task_id:string|null};
const requestSchema=z.object({operationId:z.string().uuid(),instanceId:z.string().min(1).optional()}).strict();
const taskSchema=z.object({id:z.string().uuid()}).strict();

/** One publisher resource and a durable per-user admission barrier preserve the
 * existing prepare/verify/activate protocol across all model tasks and restarts. */
export class ScopedMemoryBindings {
 private readonly dispose:()=>Promise<void>;
 constructor(private readonly data:(context:UserContext)=>ScopedMemoryData,private readonly read:(context:UserContext,id:string)=>Promise<Memory>,private readonly readVersion:(context:UserContext,id:string,version:number)=>Promise<Memory>,private readonly execution:TaskExecution,private readonly plugins:ScopedPluginHost,private readonly providers:ScopedMemoryProviders){
  this.dispose=execution.register({kind:'memory.binding',pool:'memory.publication',concurrency:()=>4,policy:EXECUTION_POLICIES.control,parseInput:value=>taskSchema.parse(value),authorizeInput:(context,input)=>{this.owned(context,String(input.id));},resources:()=>[{scope:'user',key:'memory-publication'}],execute:run=>this.execute(run),commit:run=>{
   const {id}=taskSchema.parse(run.task.input),data=this.data(run.context),preparation=this.owned(run.context,id);this.assert(run.context,preparation);
   if(preparation.catalog_hash!==this.catalog(data))throw new PrivateDataError('conflict',409);data.sql.run("UPDATE mm_binding_preparations SET state='verified' WHERE user_id=$user AND id=?",id);
  },classify:error=>error instanceof ExecutionFailure?error:new ExecutionFailure('blocked','memory_binding_requires_attention')});
 }
 private owned(context:UserContext,id:string){const data=this.data(context);data.state();const row=data.sql.get('SELECT * FROM mm_binding_preparations WHERE user_id=$user AND id=?',id) as Preparation|undefined;if(!row)throw missing();return row;}
 private assert(context:UserContext,preparation:Preparation){const data=this.data(context),lock=data.sql.get('SELECT operation_id FROM mm_binding_locks WHERE user_id=$user');if(lock?.operation_id!==preparation.id||memoryHash(data.binding())!==memoryHash(JSON.parse(preparation.source))||['cancelled','activated'].includes(preparation.state))throw new PrivateDataError('conflict',409);}
 private catalog(data:ScopedMemoryData){return memoryHash([data.sql.all('SELECT id,version,fingerprint,body_digest,binding,json FROM mm_records WHERE user_id=$user ORDER BY id'),data.sql.all('SELECT id,version,binding,body_digest FROM mm_version_bindings WHERE user_id=$user ORDER BY id,version')]);}
 async prepare(context:UserContext,raw:unknown){
  const request=requestSchema.parse(raw),data=this.data(context),requestHash=memoryHash(request),prior=data.sql.get('SELECT * FROM mm_binding_preparations WHERE user_id=$user AND id=?',request.operationId) as Preparation|undefined;
  if(prior){if(JSON.parse(prior.json).requestHash!==requestHash)throw new PrivateDataError('conflict',409);if(!prior.task_id){const task=await this.execution.forUser(context).submit({kind:'memory.binding',operationId:'memory-binding:'+request.operationId,input:{id:request.operationId}});data.sql.run('UPDATE mm_binding_preparations SET task_id=? WHERE user_id=$user AND id=?',task.id,request.operationId);}return this.view(context,request.operationId);}
  const source=data.binding(),revision=source.revision+1,snapshot=request.instanceId?await this.plugins.forUser(context).admit(request.instanceId,'task',revision):undefined,target:ScopedMemoryBinding=request.instanceId?{kind:'plugin',instanceId:request.instanceId,revision,snapshotId:snapshot!.id}:{kind:'builtin',revision};
  data.sql.transaction(()=>{if(data.sql.get('SELECT 1 FROM mm_binding_locks WHERE user_id=$user'))throw new PrivateDataError('conflict',409);data.state();if(memoryHash(data.binding())!==memoryHash(source))throw new PrivateDataError('conflict',409);data.sql.run('INSERT INTO mm_binding_locks VALUES($user,?)',request.operationId);data.sql.run("INSERT INTO mm_binding_preparations VALUES($user,?,?,?,NULL,?,'preparing',NULL)",request.operationId,JSON.stringify(source),JSON.stringify(target),JSON.stringify({requestHash}));});
  for(const row of data.sql.all("SELECT i.task_id FROM mm_intakes i JOIN execution_steps e ON e.id=i.task_id WHERE i.user_id=$user AND e.user_id=$user AND i.revoked=0 AND i.state='pending' AND e.state='waiting'"))this.execution.forUser(context).retry(String(row.task_id));
  for(const row of data.sql.all("SELECT i.task_id FROM mm_integration_windows i JOIN execution_steps e ON e.id=i.task_id WHERE i.user_id=$user AND e.user_id=$user AND i.revoked=0 AND i.state='pending' AND e.state='waiting'"))this.execution.forUser(context).retry(String(row.task_id));
  const task=await this.execution.forUser(context).submit({kind:'memory.binding',operationId:'memory-binding:'+request.operationId,input:{id:request.operationId}});data.sql.run('UPDATE mm_binding_preparations SET task_id=? WHERE user_id=$user AND id=?',task.id,request.operationId);return this.view(context,request.operationId);
 }
 view(context:UserContext,id:string){const preparation=this.owned(context,id);return {id,state:preparation.state,source:memoryBindingSchema.parse(JSON.parse(preparation.source)),target:memoryBindingSchema.parse(JSON.parse(preparation.target)),...(preparation.task_id?{task:this.execution.forUser(context).get(preparation.task_id)}:{})};}
 private async execute(run:TaskRun){
  const {id}=taskSchema.parse(run.task.input),data=this.data(run.context),preparation=this.owned(run.context,id),assert=()=>{run.grant.assert();this.assert(run.context,preparation);};assert();
  if(data.sql.get("SELECT 1 FROM mm_jobs WHERE user_id=$user AND state='admitting' LIMIT 1"))throw new ExecutionFailure('waiting','memory_binding_draining',100,{executionStarted:false});
  if(data.sql.get("SELECT 1 FROM mm_integration_windows i JOIN execution_steps e ON e.id=i.task_id WHERE i.user_id=$user AND e.user_id=$user AND i.revoked=0 AND i.state='pending' AND e.state IN ('running','waiting') LIMIT 1"))throw new ExecutionFailure('waiting','memory_binding_draining',100,{executionStarted:false});
  if(data.sql.get("SELECT 1 FROM mm_intakes i JOIN execution_steps e ON e.id=i.task_id WHERE i.user_id=$user AND e.user_id=$user AND i.revoked=0 AND i.state='pending' AND e.state IN ('running','waiting') LIMIT 1"))throw new ExecutionFailure('waiting','memory_binding_draining',100,{executionStarted:false});
  if(data.sql.get("SELECT 1 FROM mm_jobs j JOIN json_each(j.tasks) t JOIN execution_steps s ON s.id=t.value JOIN user_tasks u ON u.task_id=s.id WHERE j.user_id=$user AND u.user_id=$user AND s.state IN ('waiting','running') LIMIT 1"))throw new ExecutionFailure('waiting','memory_binding_draining',100,{executionStarted:false});
  if(data.sql.get("SELECT 1 FROM user_tasks u JOIN execution_steps e ON e.id=u.task_id WHERE u.user_id=$user AND e.user_id=$user AND e.kind IN ('memory.feedback','memory.feedback-admit','memory.owner-reply','memory.materials') AND e.state IN ('waiting','running') LIMIT 1"))throw new ExecutionFailure('waiting','memory_binding_draining',100,{executionStarted:false});
  if(data.sql.get("SELECT 1 FROM mm_provider_journal WHERE user_id=$user AND state IN ('submitted','erase_submitted') LIMIT 1"))throw new ExecutionFailure('blocked','memory_provider_result_unknown');
  const target=memoryBindingSchema.parse(JSON.parse(preparation.target)),catalog=this.catalog(data),rows=data.sql.all("SELECT v.id,v.version FROM mm_versions v JOIN mm_records r ON r.user_id=v.user_id AND r.id=v.id WHERE v.id=r.id AND v.user_id=$user AND r.user_id=$user AND json_extract(r.json,'$.status')='published' ORDER BY v.id,v.version"),records:Memory[]=[];
  for(const row of rows){records.push(await this.readVersion(run.context,String(row.id),Number(row.version)));assert();}
  if(target.kind==='plugin'){
   const descriptor=await this.providers.descriptor(run.context,target),assertTarget=()=>{assert();descriptor.assertCurrent();for(const memory of records){data.evidence(memory.evidenceIds);data.assertSources(memory.evidenceIds,descriptor.sourceIds);}};
   // Every current and historical body must fit the full transitive allowlist
   // before provider setup, verification or any disclosure to its runtime.
   assertTarget();await this.providers.provision(run.context,target);assertTarget();const provider=await this.providers.provider(run.context,target,assertTarget);assertTarget();
   const health=await this.providers.verify(run.context,target,assertTarget,run.signal);assertTarget();if(!health.ready||!health.verified.persistentCrud||!health.verified.scopedRetrieval||!health.verified.immutableRecords||!health.verified.idempotentReplay)throw new ExecutionFailure('blocked','memory_provider_unverified');
   for(const memory of records){
    assertTarget();
    const namespace=descriptor.namespace,key=memoryProviderKey(memory),opId='memory-binding:'+memoryHash([id,namespace,key]),write={namespace,key,memory,opId};
    run.grant.commit(()=>{assert();data.sql.run("INSERT OR IGNORE INTO mm_provider_journal VALUES($user,?,?,?,?,?,?,'submitted',?)",opId,id,JSON.stringify(namespace),JSON.stringify(key),memoryBodyDigest(memory),memoryHash({namespace,key,memory}),JSON.stringify({...write,binding:target}));});
    await stageVerifiedMemoryWrite(provider,write,assertTarget);run.grant.commit(()=>{assertTarget();data.sql.run("UPDATE mm_provider_journal SET state='acknowledged' WHERE user_id=$user AND id=?",opId);});
   }
  }
  assert();if(this.catalog(data)!==catalog)throw new PrivateDataError('conflict',409);
  run.grant.commit(()=>{assert();data.sql.run('UPDATE mm_binding_preparations SET catalog_hash=?,json=? WHERE user_id=$user AND id=?',catalog,JSON.stringify({...JSON.parse(preparation.json),records}),id);});run.checkpoint.write('verified-bodies',id);return {count:records.length};
 }
 activate(context:UserContext,id:string,raw:unknown){
  const request=z.object({expectedRevision:z.number().int().positive()}).strict().parse(raw),data=this.data(context);
  return data.sql.transaction(()=>{const preparation=this.owned(context,id);if(preparation.state==='activated')return this.view(context,id);this.assert(context,preparation);const state=data.state();if(state.revision!==request.expectedRevision||preparation.state!=='verified'||preparation.catalog_hash!==this.catalog(data))throw new PrivateDataError('conflict',409);
   const target=memoryBindingSchema.parse(JSON.parse(preparation.target));if(target.kind==='plugin'){let grant;try{grant=this.plugins.domainGrant(context,target.snapshotId,'repository');}catch{grant=this.plugins.domainGrant(context,target.snapshotId,'engine');}grant.assertAdmission();}
   const records=z.array(memorySchema).parse(JSON.parse(preparation.json).records);
   for(const memory of records){const current=data.row(memory.id);if(current.version===memory.version){if(current.body_digest!==memoryBodyDigest(memory))throw new PrivateDataError('conflict',409);data.sql.run('UPDATE mm_records SET binding=?,json=? WHERE user_id=$user AND id=?',JSON.stringify(target),JSON.stringify(memory),memory.id);}data.sql.run('UPDATE mm_version_bindings SET binding=? WHERE user_id=$user AND id=? AND version=?',JSON.stringify(target),memory.id,memory.version);}
   data.sql.run('UPDATE mm_state SET binding=?,generation=generation+1,revision=revision+1 WHERE user_id=$user',JSON.stringify(target));data.sql.run("UPDATE mm_binding_preparations SET state='activated' WHERE user_id=$user AND id=?",id);data.sql.run('DELETE FROM mm_binding_locks WHERE user_id=$user AND operation_id=?',id);return this.view(context,id);
  });
 }
 cancel(context:UserContext,id:string){const data=this.data(context);return data.sql.transaction(()=>{const preparation=this.owned(context,id);if(preparation.state==='activated')throw new PrivateDataError('conflict',409);if(preparation.task_id)this.execution.forUser(context).cancel(preparation.task_id);data.sql.run("UPDATE mm_binding_preparations SET state='cancelled',json=json_remove(json,'$.records') WHERE user_id=$user AND id=?",id);data.sql.run('DELETE FROM mm_binding_locks WHERE user_id=$user AND operation_id=?',id);queueMemoryErases(data.sql,{jobId:id});return {cancelled:true,pendingExternal:Number(data.sql.get("SELECT count(*) n FROM mm_provider_journal WHERE user_id=$user AND job_id=? AND state='erase_submitted'",id)!.n)};});}
 async close(){await this.dispose();}
}
