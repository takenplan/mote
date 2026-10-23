import {existsSync,readFileSync,readdirSync,unlinkSync} from 'node:fs';
import {join,dirname,relative} from 'node:path';
import type {DatabaseSync} from 'node:sqlite';
import {setImmediate as yieldTurn} from 'node:timers/promises';
import {z} from 'zod';
import {readConfigDocument} from '@mote/shared/config-file';
import {storageStatistics} from '@mote/shared/storage-statistics';
import {ContentEncryption,replaceContentFile} from '../content-encryption.js';
import {privateDirectory,privateFile} from '../private-storage.js';
import {ConfigServiceError} from '../config-service.js';
import {EXECUTION_POLICIES} from '../execution-policy.js';
import {ExecutionFailure} from '../execution-engine.js';
import {ScopeError,validScopeId} from './baseline.js';
import {registerAuthenticatedRoute,type ScopedRuntime} from './http.js';
import type {Configurations} from './configuration.js';
import type {UserContext} from './context.js';
import type {TaskExecution,TaskRun} from './task-execution.js';
import {identityHash,bytesHash} from './originals.js';
import {PrivateDataError,PrivateSql} from './private-data-sql.js';

const policy=z.object({contentEncryptionEnabled:z.boolean().default(false)}).strict();
const progress=z.object({total:z.number().int().nonnegative(),processed:z.number().int().nonnegative(),converted:z.number().int().nonnegative(),skipped:z.number().int().nonnegative(),failed:z.number().int().nonnegative()}).strict();
type Counts=z.infer<typeof progress>;
const empty=():Counts=>({total:0,processed:0,converted:0,skipped:0,failed:0});
const kind='storage.decrypt';
type StorageTask=ReturnType<ReturnType<TaskExecution['forUser']>['get']>;

/** The existing encryption format, personal ConfigService and M05 execution.
 * No global Store, user-selected paths, key API or separate background queue. */
export class ScopedContentStorage {
 private readonly published=new Map<string,boolean>();
 private readonly unregister:()=>Promise<void>;
 private closing?:Promise<void>;
 constructor(private readonly runtime:ScopedRuntime,private readonly db:DatabaseSync,private readonly directory:string,private readonly configuration:Configurations,private readonly execution:TaskExecution){
  configuration.registerDomain('storage',subject=>{const assertDomain=configuration.domainSubjectGuard(subject);return ({id:'storage',schema:policy,defaultValue:{contentEncryptionEnabled:false},resolve:raw=>raw,prepare:next=>{assertDomain();const candidate=this.preparePolicy(subject.userId,policy.parse(next).contentEncryptionEnabled);return {...candidate,publish:()=>{assertDomain();candidate.publish();}};}});});
  this.unregister=execution.register({kind,pool:kind,concurrency:()=>1,policy:EXECUTION_POLICIES.deterministic,
   parseInput:raw=>z.object({operationId:z.string().uuid()}).strict().parse(raw),resources:()=>[{scope:'user',key:kind}],
   authorizeInput:context=>{runtime.authority.assert(context);if(this.enabled(context.userId))throw new ConfigServiceError('config_conflict');},
   execute:run=>this.decrypt(run),classify:()=>new ExecutionFailure('permanent','storage_conversion_failed')});
 }
 private preparePolicy(userId:string,enabled:boolean){
  const before=this.published.get(userId);
  if(this.active(userId)&&enabled!==this.enabled(userId))throw new ConfigServiceError('config_conflict');
  const cipher=this.cipher(userId);cipher.prepareEnabled(enabled);
  return {apply:()=>{},publish:()=>{this.published.set(userId,enabled);},rollback:()=>{if(before===undefined)this.published.delete(userId);else this.published.set(userId,before);}};
 }
 private userPath(userId:string){if(!validScopeId(userId)||/[/:]/.test(userId))throw new ScopeError('invalid_identity',401);return join(this.directory,'configuration','users',userId);}
 private enabled(userId:string){
  if(this.published.has(userId))return this.published.get(userId)!;
  // M03's synchronous intake can precede the first interactive M04 read after
  // restart. Bootstrap only this registered field from the same fixed YAML;
  // once ConfigService publishes, its current value wins through every await.
  for(const path of [this.directory,join(this.directory,'configuration'),join(this.directory,'configuration','users'),this.userPath(userId)])privateDirectory(path);
  const path=join(this.userPath(userId),'mote.yaml');privateFile(path);if(!existsSync(path))return false;
  try{return policy.parse(readConfigDocument(path,{}).savedDocument.storage??{}).contentEncryptionEnabled;}catch{throw new ConfigServiceError('config_unavailable');}
 }
 root(userId:string){this.userPath(userId);privateDirectory(this.directory);const parent=join(this.directory,'originals');privateDirectory(parent);const root=join(parent,identityHash([this.runtime.authority.deploymentId,userId]));privateDirectory(root);return root;}
 cipher=(userId:string)=>{
  const root=this.root(userId),identity=join(root,'content-key-id');
  return new ContentEncryption(root,undefined,{contentEncryptionEnabled:this.enabled(userId)},{
   read:()=>{privateFile(identity);if(!existsSync(identity))return;const value=readFileSync(identity,'utf8').trim();if(!/^[a-f0-9]{64}$/.test(value))throw Error('Invalid managed key identity');return value;},
   write:value=>{privateFile(identity);replaceContentFile(identity,Buffer.from(value+'\n'));},clear:()=>{privateFile(identity);if(existsSync(identity))unlinkSync(identity);}});
 };
 private sql(context:UserContext){return new PrivateSql(this.db,context.userId,()=>this.runtime.authority.assert(context));}
 private active(userId:string){return new PrivateSql(this.db,userId,()=>{}).get("SELECT 1 FROM user_tasks u JOIN execution_steps e ON e.id=u.task_id WHERE u.user_id=$user AND e.user_id=$user AND e.kind=? AND e.state IN ('waiting','running','blocked') LIMIT 1",kind);}
 private latest(context:UserContext){
  this.runtime.authority.assert(context);
  const row=this.sql(context).get('SELECT u.task_id FROM user_tasks u JOIN execution_steps e ON e.id=u.task_id WHERE u.user_id=$user AND e.user_id=$user AND e.kind=? ORDER BY u.user_position DESC LIMIT 1',kind);
  return row?this.execution.forUser(context).get(String(row.task_id)):undefined;
 }
 async view(context:UserContext,selected?:StorageTask){
  const configuration=await this.configuration.forUser(context).view();this.runtime.authority.assert(context);
  const task=selected??this.latest(context),counts=progress.parse(task?.progress??empty());
  const state=!task?'idle':task.state==='succeeded'?'completed':task.state==='cancelled'?'cancelled':task.state==='blocked'?'blocked':['failed','stale'].includes(task.state)?'failed':'running';
  const intent=task?this.sql(context).get('SELECT input,user_position FROM user_tasks WHERE user_id=$user AND task_id=?',task.id):undefined;
  return {scope:'account' as const,enabled:this.enabled(context.userId),revision:configuration.revision,job:{...counts,state,sequence:Number(intent?.user_position??0),...(task?{id:task.id,operationId:JSON.parse(String(intent!.input)).operationId}: {})},coverage:{originals:true,uploadParts:true,credentials:false,privateDatabase:false}};
 }
 async save(context:UserContext,raw:unknown){const input=z.object({enabled:z.boolean(),revision:z.number().int().nonnegative()}).strict().parse(raw);this.runtime.authority.assert(context);if(this.active(context.userId)&&input.enabled!==this.enabled(context.userId))throw new ConfigServiceError('config_conflict');await this.configuration.forUser(context).replace('storage',{contentEncryptionEnabled:input.enabled},input.revision);return this.view(context);}
 async start(context:UserContext,raw:unknown){
  const input=z.object({operationId:z.string().uuid()}).strict().parse(raw);await this.configuration.forUser(context).view();this.runtime.authority.assert(context);
  if(this.enabled(context.userId))throw new ConfigServiceError('config_conflict');
  const existing=this.latest(context);if(existing&&['waiting','running','blocked'].includes(existing.state)){
   if(identityHash([context.userId,input.operationId,kind,{operationId:input.operationId}])!==existing.id)throw new ConfigServiceError('config_conflict');return this.view(context,existing);
  }
  const task=this.execution.forUser(context).submitSync({kind,operationId:input.operationId,input:{operationId:input.operationId}});return this.view(context,task);
 }
 async cancel(context:UserContext,raw:unknown){const {taskId}=z.object({taskId:z.string().regex(/^[a-f0-9]{64}$/)}).strict().parse(raw),task=this.execution.forUser(context).get(taskId);if(task.kind!==kind)throw new PrivateDataError('not_found',404);return this.view(context,this.execution.forUser(context).cancel(taskId));}
 private paths(userId:string){
  const root=this.root(userId),paths=new Set<string>();
  for(const area of ['objects','uploads']){const parent=join(root,area);privateDirectory(parent);for(const id of readdirSync(parent).sort()){
   if(!(area==='objects'?/^[a-f0-9]{64}$/:/^[a-f0-9-]{36}$/).test(id))continue;
   const path=join(parent,id);privateDirectory(path);for(const name of readdirSync(path))if(/^[0-9]+\.(plain|aes)$/.test(name))paths.add(relative(root,join(path,name.replace(/\.(plain|aes)$/,''))));
  }}return [...paths].sort();
 }
 private validatePart(context:UserContext,name:string,bytes:Buffer){const [area,id,part]=name.split('/');let row:Record<string,unknown>|undefined;
  if(area==='objects')row=this.sql(context).get('SELECT checksum FROM ig_parts WHERE user_id=$user AND hash=? AND part=?',id,Number(part));
  else row=this.sql(context).get('SELECT checksum FROM ig_upload_parts WHERE user_id=$user AND upload_id=? AND part=? UNION ALL SELECT p.checksum FROM ig_import_parts p JOIN ig_import_uploads u ON u.user_id=p.user_id AND u.id=p.upload_id WHERE u.user_id=$user AND p.user_id=$user AND u.stage_id=? AND p.part=?',id,Number(part),id,Number(part));
  if(row&&row.checksum!==bytesHash(bytes))throw Error('Original checksum mismatch');
 }
 private async decrypt(run:TaskRun){
  const current=()=>{run.signal.throwIfAborted();run.grant.assert();this.runtime.authority.assert(run.context);if(this.enabled(run.context.userId))throw new ConfigServiceError('config_conflict');};
  current();const root=this.root(run.context.userId),paths=this.paths(run.context.userId),saved=run.checkpoint.read<{last:string;counts:Counts;pending?:{path:string;encrypted:boolean}}>('conversion'),counts=progress.parse(saved?.counts??empty());
  let last=saved?.last??'';counts.total=counts.processed+paths.filter(path=>!saved?.last||path>saved.last).length;run.progress(counts);
  for(const name of paths){if(last&&name<=last)continue;await yieldTurn();current();
   // Reuse M03's physical worker observation. A running child may still be
   // reading its old representation; wait without changing/cancelling intake.
   while(this.sql(run.context).get('SELECT 1 FROM ig_activity WHERE user_id=$user LIMIT 1')){await new Promise(resolve=>setTimeout(resolve,25));current();}
   const path=join(root,name);privateDirectory(root);privateDirectory(dirname(dirname(path)));privateDirectory(dirname(path));
   const encrypted=saved?.pending?.path===name?saved.pending.encrypted:existsSync(path+'.aes');
   run.checkpoint.write('conversion',{last,counts,pending:{path:name,encrypted}});
   try{const converted=this.cipher(run.context.userId).decrypt(path,bytes=>this.validatePart(run.context,name,bytes));counts.converted+=Number(converted||encrypted);counts.skipped+=Number(!converted&&!encrypted);}
   catch{counts.failed++;}
   current();counts.processed++;last=name;run.checkpoint.write('conversion',{last,counts});run.progress(counts);
  }current();return counts;
 }
 async statistics(context:UserContext){
  this.runtime.authority.assert(context);const root=this.root(context.userId),configuration=this.userPath(context.userId),owner=identityHash([context.deploymentId,context.userId]),roots=[root,configuration];
  for(const parts of [['plugins','instances',owner],['connectors',owner]]){let path=this.directory,exists=true;for(const part of parts){path=join(path,part);if(!existsSync(path)){exists=false;break;}privateDirectory(path);}if(exists)roots.push(path);}
  const types=new Map(this.sql(context).all("SELECT hash,MIN(mime) mime FROM(SELECT hash,mime FROM ig_originals WHERE user_id=$user UNION ALL SELECT hash,json_extract(json,'$.mimeType') mime FROM ig_archive_files WHERE user_id=$user) GROUP BY hash").map(row=>[String(row.hash),String(row.mime)]));
  const prefix=join(root,'objects')+'/',report=await storageStatistics(roots,path=>path.startsWith(prefix)?types.get(path.slice(prefix.length).split('/')[0])??'original':undefined);this.runtime.authority.assert(context);
  return {...report,scope:'account' as const,coverage:{originals:true,uploadParts:true,configuration:true,managedProviderDirectories:true,sharedDatabase:false,sharedModels:false,otherAccounts:false,externalProviderVolumes:false},excluded:['shared-sqlite-and-index','shared-models','external-provider-volumes','other-accounts']};
 }
 close(){return this.closing??=(async()=>{await this.unregister();this.published.clear();})();}
}

export function registerScopedContentStorage(runtime:ScopedRuntime,db:DatabaseSync,directory:string,configuration:Configurations,execution:TaskExecution){
 const storage=new ScopedContentStorage(runtime,db,directory,configuration,execution);
 registerAuthenticatedRoute(runtime,{method:'GET',url:'/api/content-storage',handle:context=>storage.view(context)});
 registerAuthenticatedRoute(runtime,{method:'PUT',url:'/api/content-storage',handle:(context,request)=>storage.save(context,request.body)});
 registerAuthenticatedRoute(runtime,{method:'POST',url:'/api/content-storage/decrypt',handle:async(context,request,reply)=>{const value=await storage.start(context,request.body);reply.code(202);return value;}});
 registerAuthenticatedRoute(runtime,{method:'POST',url:'/api/content-storage/decrypt/cancel',handle:(context,request)=>storage.cancel(context,request.body)});
 registerAuthenticatedRoute(runtime,{method:'GET',url:'/api/storage-statistics',handle:context=>storage.statistics(context)});
 return storage;
}
