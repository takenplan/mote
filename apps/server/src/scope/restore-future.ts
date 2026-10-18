import type {DatabaseSync} from 'node:sqlite';
import {z} from 'zod';
import {EXECUTION_POLICIES} from '../execution-policy.js';
import {ExecutionFailure} from '../execution-engine.js';
import type {ScopedRuntime} from './http.js';
import type {UserContext} from './context.js';
import type {Configurations} from './configuration.js';
import type {TaskExecution,TaskRun} from './task-execution.js';
import type {ScopedPluginHost} from './plugins.js';
import type {ScopedConnectors} from './connectors.js';
import type {ScopedActions} from './actions.js';
import type {AskHost} from './ask.js';
import type {PrivateData} from './private-data.js';
import {PrivateSql,PrivateDataError} from './private-data-sql.js';
import {instanceSchema} from './plugin-contract.js';
import {identityHash} from './originals.js';

const kind='lifecycle.future';
const input=z.object({restorationId:z.string().uuid()}).strict();
const intent=z.object({plugins:z.array(z.object({id:z.string(),configurationHash:z.string(),scopeIntent:instanceSchema.shape.grants})),connectors:z.array(z.object({id:z.string(),generation:z.number().int()})),ask:z.array(z.object({id:z.string().uuid(),generation:z.string().uuid(),through:z.number().int().nonnegative()})),actions:z.object({captures:z.number().int().nonnegative(),materials:z.number().int().nonnegative()})}).strict();
export type FutureIntent=z.infer<typeof intent>;

/** Whole-instance restoration saves policy intent, never reusable authority.
 * Only a successful password login can admit this current-epoch task. Its
 * durable grant then survives ordinary logout like other authorized Central
 * work. Each domain creates fresh future work and never retries a snapshot task.
 */
export class RestoreFutureAuthority{
 private readonly unregister:()=>Promise<void>;
 private readonly detachPlugin:()=>void;
 private closing?:Promise<void>;
 constructor(private readonly runtime:ScopedRuntime,private readonly db:DatabaseSync,private readonly configuration:Configurations,private readonly execution:TaskExecution,private readonly plugins:ScopedPluginHost,private readonly connectors:ScopedConnectors|undefined,private readonly ask:AskHost,private readonly actions:ScopedActions|undefined){
  db.exec(`CREATE TABLE IF NOT EXISTS lifecycle_future(user_id TEXT PRIMARY KEY,restoration_id TEXT NOT NULL,epoch INTEGER NOT NULL,payload TEXT NOT NULL,task_id TEXT,state TEXT NOT NULL DEFAULT 'pending');
   CREATE TABLE IF NOT EXISTS lifecycle_future_scopes(user_id TEXT NOT NULL,restoration_id TEXT NOT NULL,scope_key TEXT NOT NULL,state TEXT NOT NULL,error TEXT,probe_task_id TEXT,PRIMARY KEY(user_id,restoration_id,scope_key),FOREIGN KEY(user_id) REFERENCES lifecycle_future(user_id) ON DELETE CASCADE)`);
  this.unregister=execution.register({kind,pool:kind,concurrency:()=>configuration.instance.current<{agentConcurrency:number}>('execution').agentConcurrency,policy:EXECUTION_POLICIES.orchestration,parseInput:raw=>input.parse(raw),resources:()=>[{scope:'user',key:kind}],authorizeInput:(context,raw)=>{const row=this.sql(context).get('SELECT restoration_id,epoch FROM lifecycle_future WHERE user_id=$user');if(!row||row.restoration_id!==raw.restorationId||row.epoch!==context.authorizationEpoch)throw new PrivateDataError('conflict',409);},execute:run=>this.resume(run),classify:error=>error instanceof ExecutionFailure?error:new ExecutionFailure('blocked','restore_future_requires_attention')});
  // A new explicit pause/stop wins over a not-yet-applied saved plugin intent.
  this.detachPlugin=plugins.onInstanceChange(event=>{if(!event.context||!['pause','disable','stop'].includes(event.action??''))return;const sql=this.sql(event.context),row=sql.get('SELECT payload,restoration_id FROM lifecycle_future WHERE user_id=$user');if(!row)return;const value=intent.parse(JSON.parse(String(row.payload)));value.plugins=value.plugins.filter(item=>item.id!==event.instanceId);if(event.instanceId.startsWith('connector.'))value.connectors=value.connectors.filter(item=>'connector.'+item.id!==event.instanceId);sql.transaction(()=>{sql.run('UPDATE lifecycle_future SET payload=? WHERE user_id=$user',JSON.stringify(value));sql.run('DELETE FROM lifecycle_future_scopes WHERE user_id=$user AND restoration_id=? AND scope_key IN (?,?)',String(row.restoration_id),'plugin:'+event.instanceId,event.instanceId.startsWith('connector.')?'connector:'+event.instanceId.slice('connector.'.length):'plugin:'+event.instanceId);});});
 }
 private sql(context:UserContext){return new PrivateSql(this.db,context.userId,()=>this.runtime.authority.assert(context));}
 admit(context:UserContext){
  this.runtime.authority.assert(context);if(this.runtime.authority.isTask(context)||!this.runtime.accounts||!['web','client'].includes(this.runtime.accounts.credentialInfo(context,this.runtime.authority).kind))throw new PrivateDataError('invalid_data',403);
  const sql=this.sql(context),row=sql.get('SELECT * FROM lifecycle_future WHERE user_id=$user');if(!row||row.state==='completed')return;
  // An administrator can reset a password before the first restored login.
  // Preserve still-unissued intent, while taking authority only from this
  // successful current login. A previously admitted old task is never adopted.
  if(row.epoch!==context.authorizationEpoch){if(row.task_id)return;sql.run('UPDATE lifecycle_future SET epoch=? WHERE user_id=$user AND task_id IS NULL',context.authorizationEpoch);}

  if(row.task_id){const prior=this.execution.engine.get(String(row.task_id));if(prior?.ownership?.authorizationEpoch===context.authorizationEpoch){if(['failed','blocked','stale'].includes(prior.state))sql.transaction(()=>{sql.run("UPDATE lifecycle_future_scopes SET state='pending',error=NULL,probe_task_id=NULL WHERE user_id=$user AND restoration_id=? AND state='failed'",String(row.restoration_id));this.execution.forUser(context).retry(prior.id);sql.run("UPDATE lifecycle_future SET state='authorized' WHERE user_id=$user");});return;}}
  sql.transaction(()=>{const task=this.execution.forUser(context).submitSync({kind,operationId:'restore-future:'+row.restoration_id,input:{restorationId:String(row.restoration_id)}});sql.run("UPDATE lifecycle_future SET task_id=?,state='authorized' WHERE user_id=$user AND restoration_id=?",task.id,String(row.restoration_id));});
 }
 private async resume(run:TaskRun){
  const sql=this.sql(run.context),restorationId=input.parse(run.task.input).restorationId;
  const current=()=>{run.grant.assert();const row=sql.get('SELECT * FROM lifecycle_future WHERE user_id=$user');if(!row||row.restoration_id!==restorationId||row.task_id!==run.task.id||row.epoch!==run.context.authorizationEpoch)throw new PrivateDataError('conflict',409);return intent.parse(JSON.parse(String(row.payload)));};
  current();await this.configuration.forUser(run.context).view();current();
  // Each independent future scope settles separately. Only configuration
  // writes share a queue; a slow verifier must not serialize other scopes.
  let writes:Promise<unknown>=Promise.resolve();
  const mutate=<T>(work:()=>Promise<T>)=>{const result=writes.then(()=>{current();return work();});writes=result.catch(()=>{});return result;};
  const scopeRow=(key:string)=>sql.get('SELECT state,error,probe_task_id FROM lifecycle_future_scopes WHERE user_id=$user AND restoration_id=? AND scope_key=?',restorationId,key);
  const progress=()=>{current();const counts=new Map(sql.all('SELECT state,COUNT(*) n FROM lifecycle_future_scopes WHERE user_id=$user AND restoration_id=? GROUP BY state',restorationId).map(row=>[String(row.state),Number(row.n)])),failed=sql.get("SELECT scope_key,error FROM lifecycle_future_scopes WHERE user_id=$user AND restoration_id=? AND state='failed' ORDER BY scope_key LIMIT 1",restorationId);run.progress({stage:'restoring-future',completedScopes:counts.get('completed')??0,failedScopes:counts.get('failed')??0,waitingScopes:(counts.get('working')??0)+(counts.get('waiting')??0),...(failed?{failedScope:String(failed.scope_key),scopeError:String(failed.error)}:{})});return counts;};
  const scoped=async(key:string,work:()=>Promise<unknown>|unknown)=>{
   current();const prior=scopeRow(key);if(prior?.state==='completed')return true;if(prior?.state==='failed')return false;
   sql.run("INSERT INTO lifecycle_future_scopes VALUES($user,?,?,'working',NULL,NULL) ON CONFLICT(user_id,restoration_id,scope_key) DO UPDATE SET state='working',error=NULL",restorationId,key);
   try{await work();current();sql.run("UPDATE lifecycle_future_scopes SET state='completed',error=NULL WHERE user_id=$user AND restoration_id=? AND scope_key=?",restorationId,key);return true;}
   catch(error){current();const waiting=error instanceof ExecutionFailure&&error.category==='waiting';sql.run('UPDATE lifecycle_future_scopes SET state=?,error=? WHERE user_id=$user AND restoration_id=? AND scope_key=?',waiting?'waiting':'failed',waiting?null:'restore_future_scope_failed',restorationId,key);return false;}
   finally{progress();}
  };
  const connection=async(saved:{id:string;generation:number})=>scoped('connector:'+saved.id,async()=>{
   if(!current().connectors.some(value=>value.id===saved.id&&value.generation===saved.generation))return;
   if(!this.plugins.storedAdmissionOpen(run.context.userId,'connector.'+saved.id))throw new ExecutionFailure('blocked','restore_future_plugin_unavailable');
   await this.connectors?.resumeRestored(run.context,[saved],current);current();
  });
  const plugin=async(selected:FutureIntent['plugins'][number])=>{
   const key='plugin:'+selected.id,restored=await scoped(key,async()=>{
    const service=this.plugins.forUser(run.context);let candidate:ReturnType<ScopedPluginHost['restorationDefinition']>|undefined,taskId:string|undefined;
    await mutate(async()=>{
     if(!current().plugins.some(value=>value.id===selected.id))return;
     const view=await service.view();current();const existing=view.instances.find(value=>value.id===selected.id);
     if(!existing||existing.revocation!==restorationId&&existing.revocation!=='restored')return;
     const definition=this.plugins.restorationDefinition(run.context,selected.id);if(identityHash([definition.packageId,definition.configuration])!==selected.configurationHash)throw new PrivateDataError('conflict',409);
     for(const sourceId of selected.scopeIntent.sourceIds)run.services.get<PrivateData>('private-data').source(sourceId);
     candidate={...definition,desired:false,revocation:restorationId,grants:selected.scopeIntent};
     taskId=scopeRow(key)?.probe_task_id as string|undefined;if(!taskId)await service.configure(candidate,view.revision);current();
    });
    if(!candidate)return;
    if(!taskId){const result=await service.check(selected.id) as {taskId?:string};current();if(result.taskId){taskId=result.taskId;sql.run('UPDATE lifecycle_future_scopes SET probe_task_id=? WHERE user_id=$user AND restoration_id=? AND scope_key=?',taskId,restorationId,key);}}
    if(taskId){const task=this.execution.forUser(run.context).get(taskId);if(['waiting','running'].includes(task.state))throw new ExecutionFailure('waiting','restore_future_verification_waiting',50,{executionStarted:false});if(task.state!=='succeeded')throw new ExecutionFailure('blocked','restore_future_verification_failed');}
    await mutate(async()=>{const checked=await service.view();current();if(!current().plugins.some(value=>value.id===selected.id))return;if(!checked.instances.find(value=>value.id===selected.id)?.checked)throw new ExecutionFailure('blocked','restore_future_verification_failed');await service.action(selected.id,'enable',checked.revision);current();});
   });
   if(restored)for(const saved of current().connectors.filter(value=>'connector.'+value.id===selected.id))await connection(saved);
  };
  const planned=current().plugins;let next=0;const worker=async()=>{while(next<planned.length)await plugin(planned[next++]);};
  await Promise.allSettled([
   scoped('actions',()=>this.actions?.discovery.resumeRestored(run.context,current().actions,current)),
   scoped('ask',()=>this.ask.automations.resumeRestored(run.context,current().ask,current)),
   ...Array.from({length:Math.min(planned.length,this.configuration.instance.current<{agentConcurrency:number}>('execution').agentConcurrency)},()=>worker()),
  ]);current();
  // A connection depends on its own verified plugin only. Failed or held
  // siblings cannot stop an already verified future timer from being admitted.
  for(const saved of current().connectors){const owner=scopeRow('plugin:connector.'+saved.id);if(owner?.state==='waiting'||owner?.state==='working')continue;await connection(saved);}
  const counts=progress();if((counts.get('waiting')??0)+(counts.get('working')??0)>0)throw new ExecutionFailure('waiting','restore_future_verification_waiting',50,{executionStarted:false});
  if(counts.get('failed')){sql.run("UPDATE lifecycle_future SET state='attention' WHERE user_id=$user AND restoration_id=? AND task_id=?",restorationId,run.task.id);throw new ExecutionFailure('blocked','restore_future_requires_attention');}
  sql.run("UPDATE lifecycle_future SET state='completed' WHERE user_id=$user AND restoration_id=? AND task_id=?",restorationId,run.task.id);return {futureAuthority:true};
 }

 close(){return this.closing??=(async()=>{this.detachPlugin();await this.unregister();})();}
}
