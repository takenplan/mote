import {DatabaseSync,type SQLInputValue} from 'node:sqlite';
import {join} from 'node:path';

type Scalar=string|number|boolean|null|undefined;
type Fields=Record<string,Scalar>;
type Row=Record<string,any>;
type Scope={directory:string;users:readonly {id:string;alias:'a'|'b'}[];captures?:readonly {id:string;owner:string;kind:string;index:number}[];connectionId?:string;isActiveTask?:(id:string)=>boolean;counts?:()=>Record<string,number>};
const EVENT_LIMIT=512,ROW_LIMIT=2000;
const code=(value:unknown)=>value===null?null:typeof value==='string'&&/^[A-Za-z0-9_.:-]{1,128}$/.test(value)?value:'non_code';
const errorIdentity=(error:unknown)=>{const value=error as {name?:unknown;code?:unknown};const safe=(part:unknown)=>typeof part==='string'&&/^[A-Za-z0-9_.:-]{1,128}$/.test(part)?part:undefined;return {name:safe(value?.name)??'Error',code:safe(value?.code)};};

/** Generated-fixture observations only. No scheduling, authority predicates,
 * payloads or product hooks are invoked by a failure snapshot. */
export class PerformanceFailureObservation{
 private readonly started=performance.now();
 private readonly events:Fields[]=[];
 private readonly polls=new Map<string,{count:number;firstMs:number;lastMs:number;maxGapMs:number}>();
 private overflow=0;
 private currentPhase='created';
 private completed=false;
 private captured=false;
 private failureReport='';
 private cleanupStartedMs?:number;
 private cleanupEndedMs?:number;
 private scope?:()=>Scope|undefined;
 constructor(private readonly scenario:string,private readonly emit:(value:string)=>void){this.event('created');}
 bind(scope:()=>Scope|undefined){this.scope=scope;}
 event(event:string,fields:Fields={}){
  // Call sites supply only fixed labels, generated IDs and scalar counters.
  if(this.events.length>=EVENT_LIMIT){this.overflow++;return;}
  this.events.push({atMs:performance.now()-this.started,event,...fields});
 }
 phase(phase:string,fields:Fields={}){this.currentPhase=phase;this.event('phase',{phase,...fields});}
 owner(id:string){try{return this.scope?.()?.users.find(user=>user.id===id)?.alias??'unknown';}catch{return 'unknown';}}
 poll<T>(name:string,check:()=>T):()=>T{return ()=>{const at=performance.now()-this.started,prior=this.polls.get(name);if(prior){prior.count++;prior.maxGapMs=Math.max(prior.maxGapMs,at-prior.lastMs);prior.lastMs=at;}else if(this.polls.size<EVENT_LIMIT)this.polls.set(name,{count:1,firstMs:at,lastMs:at,maxGapMs:0});return check();};}
 transportError(error:unknown,fields:Fields={}){this.event('transport-error',{...fields,...errorIdentity(error)});}
 complete(){this.completed=true;this.phase('complete');}
 failure(phase:string,original:string){
  this.phase(phase);return original+'\n'+this.captureFailure();
 }
 cleanupStart(){
  this.cleanupStartedMs=performance.now()-this.started;
  this.event('cleanup-start',{unfinished:!this.completed});
  if(!this.completed&&!this.captured)this.captureFailure();
 }
 cleanupEnd(){this.cleanupEndedMs=performance.now()-this.started;this.event('cleanup-end');this.output(false);}
 private captureFailure(){
  if(this.captured)return this.failureReport;
  this.captured=true;
  try{this.failureReport='[fixture-observation] '+JSON.stringify(this.report(true));}
  catch(error){this.failureReport='[fixture-observation-error] '+JSON.stringify(errorIdentity(error));}
  try{this.emit(this.failureReport);}catch{/* Keep the same snapshot in the original failure even if emission fails. */}
  return this.failureReport;
 }
 private output(snapshot:boolean){try{this.emit('[fixture-observation] '+JSON.stringify(this.report(snapshot)));}catch{/* Observation must never replace an original failure or cleanup. */}}
 private report(snapshot:boolean){return {scenario:this.scenario,phase:this.currentPhase,completed:this.completed,atMs:performance.now()-this.started,cleanupStartedMs:this.cleanupStartedMs,cleanupEndedMs:this.cleanupEndedMs,eventLimit:EVENT_LIMIT,eventOverflow:this.overflow,events:this.events.slice(),polls:Object.fromEntries(this.polls),...(snapshot?{snapshot:this.snapshot()}:{} )};}
 private snapshot():unknown{
  let db:DatabaseSync|undefined;
  try{
   const snapshotStartedAt=Date.now(),scope=this.scope?.();if(!scope)return {unavailable:'fixture_not_ready'};
   const users=JSON.stringify(scope.users.map(user=>user.id)),owner=(id:unknown)=>scope.users.find(user=>user.id===id)?.alias??'unknown';
   db=new DatabaseSync(join(scope.directory,'mote.sqlite'),{readOnly:true});
   const relations:Record<string,unknown>={},resourceAliases=new Map<string,string>();
   const resource=(key:unknown)=>{const raw=String(key);let alias=resourceAliases.get(raw);if(!alias){alias='resource-'+(resourceAliases.size+1);resourceAliases.set(raw,alias);}let kind='opaque',resourceOwner='unknown';try{const value=JSON.parse(raw);if(Array.isArray(value)){kind=value[0]==='shared'?'shared':value[0]==='user'?'user':'opaque';if(kind==='user')resourceOwner=owner(value[1]);}}catch{}return {resourceAlias:alias,resourceScope:kind,resourceOwner};};
   const relation=(name:string,sql:string,args:SQLInputValue[]=[],project:(row:Row)=>unknown=row=>row)=>{
    try{const rows=db!.prepare(sql+' LIMIT '+(ROW_LIMIT+1)).all(...args);relations[name]={limit:ROW_LIMIT,truncated:rows.length>ROW_LIMIT,rows:rows.slice(0,ROW_LIMIT).map(row=>project(Object.fromEntries(Object.entries(row).map(([key,value])=>[key,['error','code','category','cause_state'].includes(key)?code(value):value]))))};return rows.slice(0,ROW_LIMIT);}
    catch(error){relations[name]={diagnosticError:errorIdentity(error)};return [] as Row[];}
   };
   relation('originals',`SELECT user_id,capture_id,id original_id,mime FROM ig_originals WHERE user_id IN(SELECT value FROM json_each(?))${scope.captures?' AND capture_id IN(SELECT value FROM json_each(?))':''} ORDER BY user_id,id`,[users,...(scope.captures?[JSON.stringify(scope.captures.map(capture=>capture.id))]:[])],row=>({...row,owner:owner(row.user_id)}));
   relation('admissions','SELECT user_id,original_id,task_id,state FROM mp_admissions WHERE user_id IN(SELECT value FROM json_each(?)) ORDER BY user_id,original_id,task_id',[users],row=>({...row,owner:owner(row.user_id)}));
   const tasks=relation('tasks',`SELECT e.id,e.operation_id,e.user_id,e.kind,e.pool,e.state,e.attempts,e.available_at,e.lease_until,e.recovery_deadline,e.error,e.created_at,e.updated_at,
    json_extract(u.input,'$.originalRef') original_ref,json_extract(u.input,'$.parentTaskId') parent_task_id,
    json_extract(u.input,'$.imageStep.name') image_step,json_extract(u.input,'$.imageStep.kind') image_kind,
    json_extract(u.input,'$.connectionId') connection_id,json_extract(u.input,'$.action') action,json_extract(u.input,'$.recordingPhase') recording_phase,json_extract(u.input,'$.recordingKey') recording_key,
    u.external_state,u.result IS NOT NULL result_present
    FROM execution_steps e JOIN user_tasks u ON u.task_id=e.id AND u.user_id=e.user_id WHERE e.user_id IN(SELECT value FROM json_each(?)) ORDER BY e.user_id,e.user_position`,[users],row=>({...row,owner:owner(row.user_id),localActive:scope.isActiveTask?.(String(row.id))}));
   const ids=JSON.stringify(tasks.map(row=>String(row.id)));
   relation('failures',"SELECT step_id,json_extract(json,'$.code') code,json_extract(json,'$.category') category,json_extract(json,'$.causeStepId') cause_step_id,json_extract(json,'$.causeState') cause_state FROM execution_failures WHERE step_id IN(SELECT value FROM json_each(?)) ORDER BY step_id",[ids]);
   relation('dependencies',`SELECT d.step_id,d.dependency_id,p.state,p.attempts,p.error,p.available_at,p.lease_until FROM execution_dependencies d JOIN execution_steps p ON p.id=d.dependency_id WHERE d.step_id IN(SELECT value FROM json_each(?)) AND p.user_id IN(SELECT value FROM json_each(?)) ORDER BY d.step_id,d.dependency_id`,[ids,users]);
   relation('modelResources','SELECT task_id,resource_key FROM task_model_resources WHERE task_id IN(SELECT value FROM json_each(?)) ORDER BY task_id,resource_key',[ids],row=>({task_id:row.task_id,...resource(row.resource_key)}));
   relation('resources','SELECT step_id,resource_key FROM execution_resources WHERE step_id IN(SELECT value FROM json_each(?)) ORDER BY step_id,resource_key',[ids],row=>({step_id:row.step_id,...resource(row.resource_key)}));
   for(const [name,table] of [['dynamicResources','execution_dynamic_resources'],['resourceWaits','execution_resource_waits'],['resourceReleases','execution_resource_releases']] as const){
    relation(name,`SELECT r.step_id,r.resource_key,r.fence=e.fence fence_current${name==='resourceWaits'?',r.created_at':''} FROM ${table} r JOIN execution_steps e ON e.id=r.step_id WHERE r.step_id IN(SELECT value FROM json_each(?)) ORDER BY r.step_id,r.resource_key`,[ids],row=>({step_id:row.step_id,fence_current:row.fence_current,...(name==='resourceWaits'?{created_at:row.created_at}:{}),...resource(row.resource_key)}));
   }
   relation('matchingResourceHolders',`WITH wanted AS (
    SELECT resource_key FROM execution_resources WHERE step_id IN(SELECT value FROM json_each(?))
    UNION SELECT resource_key FROM execution_dynamic_resources WHERE step_id IN(SELECT value FROM json_each(?))
    UNION SELECT resource_key FROM execution_resource_waits WHERE step_id IN(SELECT value FROM json_each(?))
   ),held AS (SELECT step_id,resource_key FROM execution_resources UNION SELECT d.step_id,d.resource_key FROM execution_dynamic_resources d JOIN execution_steps e ON e.id=d.step_id AND e.fence=d.fence)
    SELECT h.step_id,h.resource_key,e.user_id,e.kind,e.pool,e.state,e.lease_until,EXISTS(SELECT 1 FROM execution_resource_releases r WHERE r.step_id=e.id AND r.resource_key=h.resource_key AND r.fence=e.fence) released
    FROM held h JOIN execution_steps e ON e.id=h.step_id WHERE h.resource_key IN(SELECT resource_key FROM wanted) AND e.user_id IN(SELECT value FROM json_each(?)) ORDER BY h.resource_key,e.id`,[ids,ids,ids,users],row=>{const {resource_key,...rest}=row;return {...rest,owner:owner(row.user_id),...resource(resource_key)};});
   relation('externalCalls','SELECT task_id,user_id,state,attempt,issued_at,settled_at FROM task_external_calls WHERE task_id IN(SELECT value FROM json_each(?)) AND user_id IN(SELECT value FROM json_each(?)) ORDER BY task_id,issued_at',[ids,users],row=>({...row,owner:owner(row.user_id)}));
   relation('perception','SELECT user_id,json_extract(json,\'$.concurrency\') concurrency FROM mp_perception_state WHERE user_id IN(SELECT value FROM json_each(?)) ORDER BY user_id',[users],row=>({...row,owner:owner(row.user_id)}));
   if(scope.connectionId){
    relation('connections','SELECT user_id,id,generation,removed,sync_authorized,storage_generation FROM connector_connections WHERE user_id IN(SELECT value FROM json_each(?)) AND id=? ORDER BY user_id',[users,scope.connectionId],row=>({...row,owner:owner(row.user_id)}));
    relation('recordingJobs',`SELECT user_id,key,json_extract(json,'$.epoch') epoch,json_extract(json,'$.job.phase') phase,json_extract(json,'$.job.input.id') recording_id,json_extract(json,'$.taskId') task_id,json_type(json,'$.outcome') IS NOT NULL outcome_present,json_array_length(json,'$.requests') request_count FROM connector_ledger WHERE user_id IN(SELECT value FROM json_each(?)) AND instance_id=? AND scope='recording-jobs' ORDER BY user_id,key`,[users,scope.connectionId],row=>({...row,owner:owner(row.user_id)}));
    relation('recordingWork',`SELECT user_id,substr(key,6) recording_id,json_extract(json,'$.jobs.metadata') metadata_job,json_extract(json,'$.jobs.transcript') transcript_job,json_extract(json,'$.jobs.media') media_job,json_extract(json,'$.stages.metadata.state') stored_metadata_state,json_extract(json,'$.stages.transcript.state') stored_transcript_state,json_extract(json,'$.stages.media.state') stored_media_state FROM connector_ledger WHERE user_id IN(SELECT value FROM json_each(?)) AND instance_id=? AND key IN('work:r1','work:r2','work:r3') ORDER BY user_id,scope,key`,[users,scope.connectionId],row=>({...row,owner:owner(row.user_id)}));
   }
   return {snapshotStartedAt,observedAt:Date.now(),scopeUsers:scope.users.map(user=>({alias:user.alias,id:user.id})),knownCaptures:scope.captures?.map(({id,owner,kind,index})=>({id,owner,kind,index})),counts:scope.counts?.(),relations};
  }catch(error){return {diagnosticError:errorIdentity(error)};}
  finally{try{db?.close();}catch{/* An observation connection never owns product cleanup. */}}
 }
}
