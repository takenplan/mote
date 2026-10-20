import type {DatabaseSync} from 'node:sqlite';
import {randomUUID} from 'node:crypto';
import {setTimeout as delay} from 'node:timers/promises';
import {z} from 'zod';
import {imageSettingsSchema,perceptionConfigurationSchema,defaultPerceptionConfiguration,type PerceptionConfiguration} from '../perception-configuration.js';
import {EXECUTION_POLICIES} from '../execution-policy.js';
import {ExecutionFailure,type ExecutionStep,type ExecutionPoolAdmission} from '../execution-engine.js';
import {ScopeError} from './baseline.js';
import {PrivateSql,PrivateDataError,missing} from './private-data-sql.js';
import {attachmentVisible} from './ingress-attachments.js';
import {identityHash} from './originals.js';
import {processingSettingsSchema} from './processing-schema.js';
import {imageRecipeInputSchema} from './processing-image-products.js';
import {selectScopedFilePolicy} from './processing-policy-contract.js';
import type {UserContext} from './context.js';
import {registerUserRoute,type ScopedRuntime} from './http.js';
import type {Configurations} from './configuration.js';
import {TaskError,type TaskExecution,type TaskRun} from './task-execution.js';
import type {ProcessingHost} from './processing.js';

const historicalSchema=z.object({after:z.string().datetime({offset:true}).optional(),before:z.string().datetime({offset:true}).optional(),sourceId:z.string().max(128).optional(),mode:z.enum(['complete','recompute']).default('complete')}).strict();
type Query=z.infer<typeof historicalSchema>;
const backfillProgress=z.object({queued:z.number().int().nonnegative().safe()});
function publicBackfillProgress(value:unknown){const result=backfillProgress.safeParse(value);return result.success?{queued:result.data.queued}:null;}
type Deferred={id:string;position:number;reason:'active'|'unknown'};
type Backfill={id:string;query:Query;watermark:number;cursor:number;queued:number;state:'waiting'|'succeeded';epoch:number;deferred?:Deferred[]};
function conflict(error:unknown){return error instanceof TaskError&&error.code==='file_processing_active'?'active':error instanceof TaskError&&error.code==='external_result_unknown'?'unknown':undefined;}
/** The existing image settings and paged backfill are adapters to M04/M05/M06,
 * not a second image processor, model reader or execution authority. */
export class ProcessingPerception {
 private readonly previews=new Map<string,{user:string;epoch:number;expires:number;query:Query;watermark:number}>();
 private imageReader?: (context:UserContext,id:string,prepared?:{automatic:boolean;understandingEnabled:boolean;enabled:boolean})=>Promise<{jobs:{name:string;state:string;error?:string}[];automatic:boolean}>;
 bindImages(reader:NonNullable<ProcessingPerception['imageReader']>){this.imageReader=reader;}
 private readonly profileChanges=new Set<string>();
 preserveImagePlan(context:UserContext){return this.profileChanges.has(context.userId);}
 private closed=false;
 private readonly stop:()=>Promise<void>;
 constructor(private readonly runtime:ScopedRuntime,private readonly db:DatabaseSync,private readonly configuration:Configurations,private readonly execution:TaskExecution,private readonly host:()=>ProcessingHost,changed:(context:UserContext)=>void){
  for(const [pool,limit] of [['processing.pipeline',4],['processing.image-stage',4],['processing.ocr',2],['processing.analysis',2]] as const)execution.engine.configurePool(pool,{lane:()=> 'background',concurrency:{background:()=>limit,interactive:()=>limit},partition:step=>this.capacity(step)});
  configuration.registerDomain('perception',subject=>({id:'perception',schema:perceptionConfigurationSchema,defaultValue:defaultPerceptionConfiguration(),resolve:raw=>raw,fields:[{path:'enabled',effect:'immediate'},{path:'concurrency',effect:'next-admission'},...['understandingEnabled','providerRevision','allowExternalProcessing','allowQueryImages'].map(path=>({path,effect:'next-request' as const}))],prepare:next=>{
   const sql=new PrivateSql(db,subject.userId,()=>{'credentialId' in subject?runtime.authority.assert(subject):runtime.services.assertSubject(subject,'configuration',subject.purpose);}),before=sql.get('SELECT json FROM mp_perception_state WHERE user_id=$user'),value=perceptionConfigurationSchema.parse(next),json=JSON.stringify(value);let published=false;
   return {apply:()=>{},publish:()=>{sql.run('INSERT INTO mp_perception_state VALUES($user,?) ON CONFLICT(user_id) DO UPDATE SET json=excluded.json',json);published=true;},rollback:()=>{if(published){if(before)sql.run('UPDATE mp_perception_state SET json=? WHERE user_id=$user',before.json);else sql.run('DELETE FROM mp_perception_state WHERE user_id=$user');}},complete:()=>{if('credentialId' in subject&&this.executionStamp(before?perceptionConfigurationSchema.parse(JSON.parse(String(before.json))):defaultPerceptionConfiguration())!==this.executionStamp(value)){const preserved=this.profileChanges.has(subject.userId);this.profileChanges.add(subject.userId);try{changed(subject);}finally{if(!preserved)this.profileChanges.delete(subject.userId);}}}};
  }}));
  this.stop=execution.register({kind:'processing.image-backfill',pool:'processing.image-backfill',concurrency:()=>1,policy:EXECUTION_POLICIES.orchestration,publicProgress:publicBackfillProgress,parseInput:raw=>z.object({id:z.string().uuid()}).strict().parse(raw),authorizeInput:(context,input)=>this.load(context,String(input.id)),resources:input=>[{scope:'user',key:'image-backfill:'+input.id}],execute:async run=>{
   for(;;){run.grant.assert();const job=this.load(run.context,String(run.task.input.id));if(job.state==='succeeded')return {jobId:job.id,queued:job.queued};
    if(job.cursor<job.watermark){const rows=this.candidates(run.context,job.query,job.watermark,job.cursor,200);
     let inPage=0;for(const row of rows){this.admitCandidate(run,job,{id:String(row.id),position:Number(row.position)});if(++inPage%25===0)await delay(0,undefined,{signal:run.signal});}
     const progress=run.grant.commit(()=>{const current=this.load(run.context,job.id);if(rows.length<200)current.cursor=job.watermark;this.save(run.context,current);return {queued:current.queued};});run.progress(progress);await delay(0,undefined,{signal:run.signal});if(rows.length===200)continue;
    }
    // Conflicts retain only their exact private intent. Accepted siblings are
    // never rescanned, recounted or held behind another original's outcome.
    let inPage=0;for(const row of this.load(run.context,job.id).deferred??[]){this.admitCandidate(run,job,row,true);if(++inPage%25===0)await delay(0,undefined,{signal:run.signal});}
    const pending=this.load(run.context,job.id);run.progress({queued:pending.queued});
    if(pending.deferred?.some(row=>row.reason==='active'))throw new ExecutionFailure('waiting','file_processing_active',this.host().busyRecheckMs,{executionStarted:false});
    if(pending.deferred?.length)throw new ExecutionFailure('blocked','external_result_unknown');
    run.grant.commit(()=>{const current=this.load(run.context,job.id);current.state='succeeded';this.save(run.context,current);});
   }
  },classify:error=>error instanceof ExecutionFailure?error:error instanceof ScopeError||error instanceof PrivateDataError?new ExecutionFailure('stale','image_backfill_retired'):new ExecutionFailure('permanent','image_backfill_failed')});
 }
 private admitCandidate(run:TaskRun,job:Backfill,row:{id:string;position:number},deferred=false){
  try{run.grant.commit(()=>{const current=this.load(run.context,job.id);if(deferred?!current.deferred?.some(item=>item.id===row.id&&item.position===row.position):current.cursor>=row.position)return;
   // An original can retire while an earlier page yields or waits. Only its
   // current eligibility permits skipping; an admission error is not success.
   const candidate=this.candidates(run.context,job.query,Math.min(job.watermark,row.position),row.position-1,1)[0];
   if(candidate?.id===row.id&&(job.query.mode==='recompute'||!this.host().forUser(run.context).imageComplete('original:'+row.id))){const result=this.host().retryImageHistory(run.context,'original:'+row.id,'image-backfill:'+job.id+':'+row.id,job.query.mode);if(result.queued)current.queued++;}
   current.deferred=(current.deferred??[]).filter(item=>item.id!==row.id||item.position!==row.position);if(!deferred)current.cursor=row.position;this.save(run.context,current);
  });}catch(error){const reason=conflict(error);if(!reason)throw error;
   // The rejected admission has rolled back, including policy/task mutations.
   // Persist its intent separately, then let the initial scan visit siblings.
   run.grant.commit(()=>{const current=this.load(run.context,job.id);current.deferred=[...(current.deferred??[]).filter(item=>item.id!==row.id||item.position!==row.position),{...row,reason}];if(!deferred)current.cursor=row.position;this.save(run.context,current);});
  }
 }
 private sql(context:UserContext){const sql=new PrivateSql(this.db,context.userId,()=>this.runtime.authority.assert(context));if(this.closed||sql.get('SELECT deleted FROM mp_state WHERE user_id=$user')?.deleted)throw new ScopeError('invalid_identity',401);return sql;}
 retire(userId:string){for(const [token,preview]of this.previews)if(preview.user===userId)this.previews.delete(token);}
 value(sql:PrivateSql):PerceptionConfiguration{const row=sql.get('SELECT json FROM mp_perception_state WHERE user_id=$user');return row?perceptionConfigurationSchema.parse(JSON.parse(String(row.json))):defaultPerceptionConfiguration();}
 private executionStamp(value:PerceptionConfiguration){return identityHash([value.enabled,value.understandingEnabled,value.providerRevision,value.allowExternalProcessing]);}
 stamp(sql:PrivateSql,ref:string){return String(sql.get('SELECT mime FROM ig_originals WHERE user_id=$user AND id=?',ref.slice(9))?.mime??'').startsWith('image/')?this.executionStamp(this.value(sql)):undefined;}
 private stageKind(step:Pick<ExecutionStep,'kind'|'input'>){
  if(step.kind==='processing.ocr')return 'ocr';
  if(step.kind==='processing.image-understanding'||step.kind==='processing.analysis'&&step.input.mode==='image')return 'understanding';
  if(step.kind==='processing.image-stage')return imageRecipeInputSchema.parse(step.input).imageStep.kind;
 }
 private capacity(step:ExecutionStep):ReturnType<NonNullable<ExecutionPoolAdmission['partition']>>{
  if(!step.ownership)return;const sql=new PrivateSql(this.db,step.ownership.userId,()=>{});
  if(step.kind==='processing.pipeline')return step.input.perceptionStamp===undefined?undefined:{key:JSON.stringify(['image-coordinator',step.ownership.userId]),unit:step.id,concurrency:Number.MAX_SAFE_INTEGER};
  let kind:string|undefined;try{kind=this.stageKind(step);}catch{return;}if(!kind)return;
  // A genuine image-stage parent and its physical OCR/model child represent
  // one declared stage, even though M05 retains both durable task receipts.
  let unit=step.id;
  if(step.kind!=='processing.image-stage'&&typeof step.input.parentTaskId==='string'){
   const parent=sql.get("SELECT u.task_id,u.input FROM user_tasks u JOIN execution_steps e ON e.user_id=u.user_id AND e.id=u.task_id WHERE u.user_id=$user AND e.user_id=$user AND u.task_id=? AND e.kind='processing.image-stage'",step.input.parentTaskId);
   if(parent){const input=imageRecipeInputSchema.safeParse(JSON.parse(String(parent.input)));if(input.success&&input.data.originalRef===step.input.originalRef&&input.data.imageStep.kind===kind)unit=String(parent.task_id);}
  }
  return {key:JSON.stringify(['image-stage',step.ownership.userId,kind]),unit,concurrency:this.value(sql).concurrency};
 }
 admit(step:ExecutionStep){
  // M05's one host capacity predicate owns per-kind admission in every pool.
  // A second row-count gate here would disagree for exact parent/child units.
  return step.ownership?undefined:new ExecutionFailure('stale','image_owner_missing');
 }
 private save(context:UserContext,job:Backfill){this.sql(context).run('UPDATE mp_image_backfills SET json=? WHERE user_id=$user AND id=?',JSON.stringify(job),job.id);}
 private load(context:UserContext,id:string):Backfill{const row=this.sql(context).get('SELECT json FROM mp_image_backfills WHERE user_id=$user AND id=?',id);if(!row)throw missing();const value=JSON.parse(String(row.json)) as Backfill;if(value.epoch!==context.authorizationEpoch)throw new PrivateDataError('conflict',409);return value;}
 private candidates(context:UserContext,query:Query,watermark:number,after=0,limit=200){
  const sql=this.sql(context),values:(string|number)[]=[after,watermark],clauses:string[]=[];
  if(query.after){clauses.push("json_extract(c.json,'$.capturedAt')>=?");values.push(new Date(query.after).toISOString());}if(query.before){clauses.push("json_extract(c.json,'$.capturedAt')<?");values.push(new Date(query.before).toISOString());}if(query.sourceId){clauses.push('r.source_id=?');values.push(query.sourceId);}
  return sql.all(`SELECT r.id,r.rowid position,c.id capture_id FROM ig_originals r JOIN pd_captures c ON c.user_id=r.user_id AND c.id=r.capture_id JOIN pd_sources s ON s.user_id=r.user_id AND s.id=r.source_id
   WHERE r.user_id=$user AND c.user_id=$user AND s.user_id=$user AND r.rowid>? AND r.rowid<=? AND instr(r.mime,'image/')=1 AND COALESCE(json_extract(s.json,'$.enabled'),1)=1 AND COALESCE(json_extract(c.json,'$.privacy.excluded'),0)=0
   AND COALESCE(json_extract(c.json,'$.provenance.deleted'),0)=0 AND (c.source_id IS NULL OR EXISTS(SELECT 1 FROM pd_source_heads h WHERE h.user_id=c.user_id AND h.source_id=c.source_id AND h.external_id=c.external_id AND h.capture_id=c.id)) AND ${attachmentVisible()}
   ${clauses.length?'AND '+clauses.join(' AND '):''} ORDER BY r.rowid LIMIT ?`,...values,limit);
 }
 async view(context:UserContext){
  const host=this.host(),config=await this.configuration.forUser(context).view(),page=await host.policies.view(context),policy=page.policy,selected=selectScopedFilePolicy({...policy,rules:policy.rules.filter(rule=>!rule.sourceId)},'perception-settings','image/png'),reference=selected.services.find(service=>service.id===selected.profile.serviceId)?.reference;
  const descriptor=reference?await this.configuration.forUser(context).modelDescriptor('ocr',reference).catch(error=>{if(error instanceof ScopeError)return null;throw error;}):null,model=await this.configuration.forUser(context).modelDescriptor('file',selected.services.find(service=>service.id===selected.profile.modelServiceId)?.reference).catch(error=>{if(error instanceof ScopeError)return null;throw error;});
  const sql=this.sql(context),base=processingSettingsSchema.parse(config.domains.find(domain=>domain.id==='processing')?.effective),perception=this.value(sql),flags={automatic:perception.enabled,enabled:base.enabled&&perception.enabled,understandingEnabled:perception.understandingEnabled},rows=this.candidates(context,{mode:'complete'},Number.MAX_SAFE_INTEGER,0,Number.MAX_SAFE_INTEGER),recent:unknown[]=[],counts=new Map<string,{kind:string;state:string;autoEligible:number;count:number}>();
  for(const row of rows.reverse()){
   const detail=await this.imageReader!(context,String(row.capture_id),flags).catch(error=>{if((error instanceof PrivateDataError||error instanceof ScopeError)&&[404,409].includes(error.statusCode))return null;throw error;});if(!detail)continue;
   const jobs=detail.jobs;for(const job of jobs){const autoEligible=Number(detail.automatic),key=job.name+':'+job.state+':'+autoEligible,group=counts.get(key)??{kind:job.name,state:job.state,autoEligible,count:0};group.count++;counts.set(key,group);if(recent.length<40)recent.push({id:row.capture_id,kind:job.name,state:job.state,error:job.error??null,autoEligible});}
  }
  return {revision:config.revision,settings:{...this.value(sql),profileId:selected.profile.id,ocrProcessorId:selected.profile.processorId,ocrEndpoint:descriptor?.baseUrl??''},model:model?{model:model.model,profileId:model.reference.id}:null,jobs:[...counts.values()],recent,backfills:sql.all('SELECT json FROM mp_image_backfills WHERE user_id=$user ORDER BY rowid DESC LIMIT 20').map(row=>{const {id,queued}=JSON.parse(String(row.json)) as Backfill,task=sql.get("SELECT e.state,e.error FROM user_tasks u JOIN execution_steps e ON e.user_id=u.user_id AND e.id=u.task_id WHERE u.user_id=$user AND e.user_id=$user AND e.kind='processing.image-backfill' AND json_extract(u.input,'$.id')=?",id);return {id,state:task?.state??'stale',queued,...(task?.error?{error:task.error}:{})};}),recipes:host.processors.imageRecipes.list()};
 }
 async saveSettings(context:UserContext,raw:unknown){
  const input=z.object({revision:z.number().int().nonnegative().safe(),settings:imageSettingsSchema}).strict().parse(raw),previous=await this.view(context),{ocrEndpoint,ocrProcessorId,profileId,...settings}=input.settings,patches:Record<string,unknown>={perception:settings};
  if(profileId&&profileId!==previous.settings.profileId){const page=await this.host().policies.view(context),policy=page.policy;if(!policy.profiles.some(profile=>profile.id===profileId))throw new PrivateDataError('invalid_data');const rules=policy.rules.filter(rule=>!(rule.type==='image/*'&&!rule.sourceId));patches['filePolicy']={policy:{...policy,rules:[...rules,{type:'image/*',profileId}]}};}
  else if(ocrEndpoint!==previous.settings.ocrEndpoint||ocrProcessorId!==previous.settings.ocrProcessorId)throw new PrivateDataError('invalid_data');
  if(patches.filePolicy)this.profileChanges.add(context.userId);try{await this.configuration.forUser(context).replaceViews(patches,input.revision);}finally{this.profileChanges.delete(context.userId);}return this.view(context);
 }
 async preview(context:UserContext,raw:unknown){
  await this.configuration.forUser(context).view();const query=historicalSchema.parse(raw??{}),sql=this.sql(context),watermark=Number(sql.get('SELECT COALESCE(MAX(rowid),0) position FROM ig_originals WHERE user_id=$user')!.position),now=Date.now();
  for(const [token,entry]of this.previews)if(entry.expires<now)this.previews.delete(token);const owned=[...this.previews].filter(([,entry])=>entry.user===context.userId);if(owned.length>=20)this.previews.delete(owned[0]![0]);
  let cursor=0,count=0;for(;;){const rows=this.candidates(context,query,watermark,cursor);for(const row of rows)if(query.mode==='recompute'||!this.host().forUser(context).imageComplete('original:'+row.id))count++;if(rows.length<200)break;cursor=Number(rows.at(-1)!.position);}
  const token=randomUUID();this.previews.set(token,{user:context.userId,epoch:context.authorizationEpoch,expires:now+600000,query,watermark});return {token,count,bounded:false,mode:query.mode};
 }
 confirm(context:UserContext,raw:unknown){const {token}=z.object({token:z.string().uuid()}).strict().parse(raw),preview=this.previews.get(token);if(!preview||preview.user!==context.userId||preview.epoch!==context.authorizationEpoch||preview.expires<Date.now())throw new PrivateDataError('conflict',409);
  const id=randomUUID(),job:Backfill={id,query:preview.query,watermark:preview.watermark,cursor:0,queued:0,state:'waiting',epoch:context.authorizationEpoch,deferred:[]};this.sql(context).transaction(()=>{this.sql(context).run('INSERT INTO mp_image_backfills VALUES($user,?,?)',id,JSON.stringify(job));this.execution.forUser(context).submitSync({kind:'processing.image-backfill',operationId:'image-backfill:'+id,input:{id}});});this.previews.delete(token);return {queued:true,jobId:id};
 }
 async close(){if(this.closed)return;this.closed=true;this.previews.clear();await this.stop();}
}
export function registerPerceptionRoutes(runtime:ScopedRuntime,host:ProcessingHost){
 registerUserRoute(runtime,{scope:'user',service:'processing',method:'GET',url:'/api/perception',handle:({context})=>host.perception.view(context)});
 registerUserRoute(runtime,{scope:'user',service:'processing',method:'PUT',url:'/api/perception',handle:({context,request})=>host.perception.saveSettings(context,request.body)});
 registerUserRoute(runtime,{scope:'user',service:'processing',method:'POST',url:'/api/perception/ocr/historical-preview',handle:({context,request})=>host.perception.preview(context,request.body)});
 registerUserRoute(runtime,{scope:'user',service:'processing',method:'POST',url:'/api/perception/ocr/historical-process',handle:({context,request})=>host.perception.confirm(context,request.body)});
 registerUserRoute(runtime,{scope:'user',service:'processing',method:'POST',url:'/api/perception/:id/retry',handle:({context,request})=>{const {id}=z.object({id:z.string().uuid()}).parse(request.params);z.object({kind:z.literal('ocr')}).strict().parse(request.body);return host.retryImageCapture(context,id,randomUUID());}});
}
