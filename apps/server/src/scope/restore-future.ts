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
  db.exec(`CREATE TABLE IF NOT EXISTS lifecycle_future(user_id TEXT PRIMARY KEY,restoration_id TEXT NOT NULL,epoch INTEGER NOT NULL,payload TEXT NOT NULL,task_id TEXT,state TEXT NOT NULL DEFAULT 'pending')`);
  this.unregister=execution.register({kind,pool:kind,concurrency:()=>configuration.instance.current<{agentConcurrency:number}>('execution').agentConcurrency,policy:EXECUTION_POLICIES.orchestration,parseInput:raw=>input.parse(raw),resources:()=>[{scope:'user',key:kind}],authorizeInput:(context,raw)=>{const row=this.sql(context).get('SELECT restoration_id,epoch FROM lifecycle_future WHERE user_id=$user');if(!row||row.restoration_id!==raw.restorationId||row.epoch!==context.authorizationEpoch)throw new PrivateDataError('conflict',409);},execute:run=>this.resume(run),classify:error=>error instanceof ExecutionFailure?error:new ExecutionFailure('blocked','restore_future_requires_attention')});
  // A new explicit pause/stop wins over a not-yet-applied saved plugin intent.
  this.detachPlugin=plugins.onInstanceChange(event=>{if(!event.context||!['pause','disable','stop'].includes(event.action??''))return;const sql=this.sql(event.context),row=sql.get('SELECT payload FROM lifecycle_future WHERE user_id=$user');if(!row)return;const value=intent.parse(JSON.parse(String(row.payload)));value.plugins=value.plugins.filter(item=>item.id!==event.instanceId);if(event.instanceId.startsWith('connector.'))value.connectors=value.connectors.filter(item=>'connector.'+item.id!==event.instanceId);sql.run('UPDATE lifecycle_future SET payload=? WHERE user_id=$user',JSON.stringify(value));});
 }
 private sql(context:UserContext){return new PrivateSql(this.db,context.userId,()=>this.runtime.authority.assert(context));}
 admit(context:UserContext){
  this.runtime.authority.assert(context);if(this.runtime.authority.isTask(context)||!this.runtime.accounts||!['web','client'].includes(this.runtime.accounts.credentialInfo(context,this.runtime.authority).kind))throw new PrivateDataError('invalid_data',403);
  const sql=this.sql(context),row=sql.get('SELECT * FROM lifecycle_future WHERE user_id=$user');if(!row||row.state==='completed')return;
  // An administrator can reset a password before the first restored login.
  // Preserve still-unissued intent, while taking authority only from this
  // successful current login. A previously admitted old task is never adopted.
  if(row.epoch!==context.authorizationEpoch){if(row.task_id)return;sql.run('UPDATE lifecycle_future SET epoch=? WHERE user_id=$user AND task_id IS NULL',context.authorizationEpoch);}

  if(row.task_id){const prior=this.execution.engine.get(String(row.task_id));if(prior?.ownership?.authorizationEpoch===context.authorizationEpoch){if(['failed','blocked','stale'].includes(prior.state))this.execution.forUser(context).retry(prior.id);return;}}
  sql.transaction(()=>{const task=this.execution.forUser(context).submitSync({kind,operationId:'restore-future:'+row.restoration_id,input:{restorationId:String(row.restoration_id)}});sql.run("UPDATE lifecycle_future SET task_id=?,state='authorized' WHERE user_id=$user AND restoration_id=?",task.id,String(row.restoration_id));});
 }
 private async resume(run:TaskRun){
  const sql=this.sql(run.context),restorationId=input.parse(run.task.input).restorationId;
  const current=()=>{run.grant.assert();const row=sql.get('SELECT * FROM lifecycle_future WHERE user_id=$user');if(!row||row.restoration_id!==restorationId||row.task_id!==run.task.id||row.epoch!==run.context.authorizationEpoch)throw new PrivateDataError('conflict',409);return intent.parse(JSON.parse(String(row.payload)));};
  current();await this.configuration.forUser(run.context).view();current();
  if(!run.checkpoint.read('actions')){if(this.actions)await this.actions.discovery.resumeRestored(run.context,current().actions,current);current();run.checkpoint.write('actions',true);}
  if(!run.checkpoint.read('ask')){this.ask.automations.resumeRestored(run.context,current().ask,current);current();run.checkpoint.write('ask',true);}
  for(const selected of current().plugins.sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0)){
   if(selected.id<=(run.checkpoint.read<string>('plugin-cursor')??''))continue;
   current();const service=this.plugins.forUser(run.context),view=await service.view();current();const existing=view.instances.find(value=>value.id===selected.id);
   if(!existing||existing.revocation!==restorationId&&existing.revocation!=='restored'){run.checkpoint.write('plugin-cursor',selected.id);continue;}
   const definition=this.plugins.restorationDefinition(run.context,selected.id);if(identityHash([definition.packageId,definition.configuration])!==selected.configurationHash)throw new PrivateDataError('conflict',409);
   for(const sourceId of selected.scopeIntent.sourceIds)run.services.get<PrivateData>('private-data').source(sourceId);
   const candidate={...definition,desired:false,revocation:restorationId,grants:selected.scopeIntent};
   const probe=run.checkpoint.read<{id:string;taskId:string}>('plugin-probe');let taskId=probe?.id===selected.id?probe.taskId:undefined;
   if(!taskId){await service.configure(candidate,view.revision);current();const result=await service.check(selected.id) as {taskId?:string};current();if(result.taskId){taskId=result.taskId;run.checkpoint.write('plugin-probe',{id:selected.id,taskId});}}
   if(taskId){const task=this.execution.forUser(run.context).get(taskId);if(['waiting','running'].includes(task.state))throw new ExecutionFailure('waiting','restore_future_verification_waiting',50,{executionStarted:false});if(task.state!=='succeeded')throw new ExecutionFailure('blocked','restore_future_verification_failed');}
   const checked=await service.view();current();if(!checked.instances.find(value=>value.id===selected.id)?.checked)throw new ExecutionFailure('blocked','restore_future_verification_failed');
   // Re-read the explicit pause fence after a potentially slow provider check.
   if(current().plugins.some(value=>value.id===selected.id))await service.action(selected.id,'enable',checked.revision);
   current();run.checkpoint.write('plugin-cursor',selected.id);run.checkpoint.write('plugin-probe',null);
  }
  if(!run.checkpoint.read('connectors')){await this.connectors?.resumeRestored(run.context,current().connectors,current);current();run.checkpoint.write('connectors',true);}
  sql.run("UPDATE lifecycle_future SET state='completed' WHERE user_id=$user AND restoration_id=? AND task_id=?",restorationId,run.task.id);return {futureAuthority:true};
 }
 close(){return this.closing??=(async()=>{this.detachPlugin();await this.unregister();})();}
}
