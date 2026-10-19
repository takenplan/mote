import {createHash,randomUUID} from 'node:crypto';
import type {DatabaseSync} from 'node:sqlite';
import {z} from 'zod';
import {ProviderFailure,type CaptureRecord} from '@mote/shared';
import type {ModelSettings} from '@mote/shared/models';
import {requestEmbedding,EMBEDDING_INPUT_CODE_UNITS} from '../embedding-request.js';
import {fuseEvidenceRanks} from '../evidence-retrieval.js';
import {scanVectors,type VectorQuery} from '../vector-work.js';
import type {ContextQueryInput} from '../context-query-core.js';
import {memoryEvidenceFingerprint} from '../memory-contract.js';
import {EXECUTION_POLICIES} from '../execution-policy.js';
import {ExecutionFailure} from '../execution-engine.js';
import type {ScopedRuntime} from './http.js';
import type {Configurations,ModelLease} from './configuration.js';
import type {TaskExecution,TaskRun} from './task-execution.js';
import type {UserContext} from './context.js';
import {askHash,installAskRetrieval,type AskScope} from './ask-schema.js';
import {PrivateSql,missing} from './private-data-sql.js';
import type {IngressReceipt} from './ingress.js';

type EvidencePort={records:(args?:ContextQueryInput)=>{items:CaptureRecord[];nextCursor:string|null};evidence:(ids:readonly string[],args?:ContextQueryInput)=>CaptureRecord[];materialRecords:(id:string,revision?:string)=>CaptureRecord[];originalReceipt:(id:string)=>string;vectorQuery:(modelKey:string,args?:ContextQueryInput)=>VectorQuery};
type EvidenceFactory=(context:UserContext,scope:AskScope)=>EvidencePort;
const sha256=(value:string)=>createHash('sha256').update(value).digest('hex');
const identifier=z.string().min(1).max(256),fingerprint=z.string().regex(/^[a-f0-9]{64}$/),rootModel=z.object({snapshotId:z.string().uuid(),operationId:identifier}).strict();
const indexInput=z.object({eventId:fingerprint,id:z.string().uuid(),fingerprint,receipt:fingerprint,anchorHash:fingerprint,sourceIds:z.array(identifier),model:rootModel}).strict();
const queryInput=z.object({id:z.string().uuid(),hash:fingerprint}).strict();
const eventInput=z.object({eventId:fingerprint}).strict();
type Event={kind:'captures';ids:string[];sourceIds:string[]}|{kind:'material';id:string;revision:string;sourceIds:string[]};
type QueryValue={context:UserContext;text:string;assert:()=>void;result?:{vector:number[];modelKey:string};lease?:ModelLease};
const modelKey=(settings:Readonly<ModelSettings>)=>askHash([settings.provider,settings.protocol,settings.baseUrl,settings.model]);
const embeddingSettings=(settings:Readonly<ModelSettings>)=>{if(settings.protocol==='codex-app-server'||settings.protocol==='mote-media')throw new ExecutionFailure('permanent','embedding_transport_unsupported');return settings;};
const classify=(error:unknown)=>error instanceof ExecutionFailure?error:error instanceof ProviderFailure?new ExecutionFailure(error.details.category,error.details.code,error.details.retryAfterMs):new ExecutionFailure('permanent','embedding_failed');

/** Owner-bound indexing ports reuse the established embedding transport, vector
 * scan and rank fusion. Only new production intake/publications admit indexing;
 * startup and retrieval never scan old text or start a paid backfill. */
export class ScopedAskRetrieval{
 private readonly dispose:Array<()=>void|Promise<void>>=[];
 private readonly queries=new Map<string,QueryValue>();
 private readonly queryCache=new Map<string,Map<string,{at:number;value:{vector:number[];modelKey:string};lease:ModelLease}>>();
 private readonly abort=new AbortController();
 private readonly path:string;
 constructor(private readonly runtime:ScopedRuntime,private readonly db:DatabaseSync,private readonly configuration:Configurations,private readonly execution:TaskExecution,private readonly factory:EvidenceFactory){
  this.path=installAskRetrieval(db);
  this.dispose.push(execution.register({kind:'ask.index-admit',pool:'embedding.admission',concurrency:()=>2,policy:EXECUTION_POLICIES.control,parseInput:raw=>eventInput.parse(raw),authorizeInput:(context,raw)=>{this.event(context,String(raw.eventId));},execute:run=>this.admit(run),publicResult:()=>({retained:true}),classify}));
  this.dispose.push(execution.register({kind:'ask.embedding',pool:'embedding',concurrency:()=>2,policy:EXECUTION_POLICIES.modelCall,modelFeature:'embedding',leaseModel:(context,raw,operationId)=>{const input=indexInput.parse(raw);return configuration.forkLease(context,input.model.snapshotId,input.model.operationId,operationId);},parseInput:raw=>indexInput.parse(raw),authorizeInput:(context,raw)=>{this.indexCurrent(context,indexInput.parse(raw));},execute:run=>this.index(run),commit:(run,result)=>{const input=indexInput.parse(run.task.input);this.indexCurrent(run.context,input);const value=result as {vector:number[];modelKey:string};this.sql(run.context).run('INSERT INTO ma_embeddings VALUES($user,?,?,?,?,?,?) ON CONFLICT(user_id,evidence_id,model_key) DO UPDATE SET fingerprint=excluded.fingerprint,receipt=excluded.receipt,anchor_hash=excluded.anchor_hash,embedding=excluded.embedding',input.id,input.fingerprint,input.receipt,input.anchorHash,value.modelKey,JSON.stringify(value.vector));},publicResult:()=>({retained:true}),classify}));
  this.dispose.push(execution.register({kind:'ask.embedding-query',pool:'embedding.query',concurrency:()=>2,policy:{...EXECUTION_POLICIES.modelCall,maxAttempts:1,timeoutMs:1200},modelFeature:'embedding',parseInput:raw=>queryInput.parse(raw),authorizeInput:(context,raw)=>{this.queryCurrent(context,queryInput.parse(raw));},execute:async run=>{const input=queryInput.parse(run.task.input),query=this.queryCurrent(run.context,input),result=await this.call(run,query.text,1200,query.assert);query.assert();this.queryCurrent(run.context,input);query.result=result;query.lease=run.model!.lease;return {retained:false};},publicResult:()=>({retained:false}),classify}));
 }
 private sql(context:UserContext){return new PrivateSql(this.db,context.userId,()=>{this.runtime.authority.assert(context);this.abort.signal.throwIfAborted();});}
 /** A repeated notification is idempotent only within its admitted authority
  * and exact current originals. Stable external IDs are not incarnations. */
 private eventIdentity(context:UserContext,event:Event){
  const sql=this.sql(context),reader=this.factory(context,{sourceIds:event.sourceIds,assertCurrent:()=>this.runtime.authority.assert(context)});
  const sources=[...event.sourceIds].sort().map(id=>{const row=sql.get('SELECT incarnation FROM ma_sources WHERE user_id=$user AND id=?',id);if(!row)throw missing();return {id,incarnation:String(row.incarnation)};});
  const tree=event.kind==='material'?sql.all('WITH RECURSIVE tree(id,revision) AS(SELECT ?,? UNION SELECT p.input_material_id,p.input_revision FROM pd_material_inputs p JOIN tree t ON p.material_id=t.id AND p.revision=t.revision WHERE p.user_id=$user) SELECT t.id,t.revision,h.incarnation FROM tree t LEFT JOIN ma_history_materials h ON h.user_id=$user AND h.id=t.id ORDER BY t.id,t.revision',event.id,event.revision):[];
  const materials=tree.map(row=>{if(!row.incarnation)throw missing();return {id:String(row.id),revision:String(row.revision),incarnation:String(row.incarnation)};});
  const ids=event.kind==='captures'?[...event.ids].sort():sql.all('WITH RECURSIVE tree(id,revision) AS(SELECT ?,? UNION SELECT p.input_material_id,p.input_revision FROM pd_material_inputs p JOIN tree t ON p.material_id=t.id AND p.revision=t.revision WHERE p.user_id=$user) SELECT DISTINCT c.capture_id FROM pd_material_captures c JOIN tree t ON c.material_id=t.id AND c.revision=t.revision WHERE c.user_id=$user ORDER BY c.capture_id',event.id,event.revision).map(row=>String(row.capture_id));
  const originals=ids.map(id=>({id,receipt:reader.originalReceipt(id)}));
  return askHash({authorizationEpoch:context.authorizationEpoch,event,sources,materials,originals});
 }
 private event(context:UserContext,id:string){const row=this.sql(context).get('SELECT input FROM ma_embedding_events WHERE user_id=$user AND id=?',id);if(!row)throw missing();const event=JSON.parse(String(row.input)) as Event;if(this.eventIdentity(context,event)!==id)throw missing();return event;}
 private enqueue(context:UserContext,event:Event){const eventId=this.eventIdentity(context,event),sql=this.sql(context);sql.run('INSERT OR IGNORE INTO ma_embedding_events VALUES($user,?,?)',eventId,JSON.stringify(event));this.execution.forUser(context).submitSync({kind:'ask.index-admit',operationId:'ask-index:'+eventId,input:{eventId}});}
 accepted(context:UserContext,receipt:IngressReceipt){const ids=receipt.captures.filter(item=>!item.duplicate).map(item=>item.id);if(ids.length)this.enqueue(context,{kind:'captures',ids,sourceIds:[receipt.sourceId]});}
 published(context:UserContext,material:Readonly<{id:string;revision:string}>){const sourceIds=this.sql(context).all('SELECT source_id FROM pd_material_sources WHERE user_id=$user AND material_id=? AND revision=? ORDER BY source_id',material.id,material.revision).map(row=>String(row.source_id));this.enqueue(context,{kind:'material',id:material.id,revision:material.revision,sourceIds});}
 private async admit(run:TaskRun){
  const eventId=String(run.task.input.eventId),event=this.event(run.context,eventId),scope={sourceIds:event.sourceIds,assertCurrent:()=>run.grant.assert()},reader=this.factory(run.context,scope);
  const selections=await this.configuration.forUser(run.context).models();run.grant.assert();if(!selections.selections.embedding)return {configured:false};
  let records:CaptureRecord[];
  try{records=event.kind==='material'?reader.materialRecords(event.id,event.revision):event.ids.flatMap(id=>{try{return reader.evidence([id]);}catch{run.grant.assert();return [];}});}catch{run.grant.assert();return {current:false};}
  if(!records.length)return {current:false};
  const operationId='embedding-index:'+eventId,lease=await this.configuration.lease(run.context,'embedding',operationId);run.grant.assert();
  for(const record of records){run.grant.assert();const input={eventId,id:record.id,fingerprint:memoryEvidenceFingerprint(record),receipt:reader.originalReceipt(record.id),anchorHash:this.anchorHash(run.context,record.id),sourceIds:event.sourceIds,model:{snapshotId:lease.snapshotId,operationId:lease.operationId}};await this.execution.forUser(run.context).submit({kind:'ask.embedding',operationId:'embedding-index:'+askHash(input),input});}
  return {scheduled:records.length};
 }
 private anchorHash(context:UserContext,id:string){const sql=this.sql(context),row=sql.get('SELECT hash FROM mm_evidence WHERE user_id=$user AND id=?',id)??sql.get('SELECT fingerprint hash FROM pd_captures WHERE user_id=$user AND id=?',id);if(!row)throw missing();return String(row.hash);}
 private indexCurrent(context:UserContext,input:z.infer<typeof indexInput>){const event=this.event(context,input.eventId);if(JSON.stringify(event.sourceIds)!==JSON.stringify(input.sourceIds))throw missing();if(event.kind==='captures'){if(!event.ids.includes(input.id))throw missing();}else if(!this.sql(context).get('WITH RECURSIVE tree(id,revision) AS(SELECT ?,? UNION SELECT p.input_material_id,p.input_revision FROM pd_material_inputs p JOIN tree t ON p.material_id=t.id AND p.revision=t.revision WHERE p.user_id=$user) SELECT 1 FROM mm_evidence e JOIN tree t ON t.id=e.material_id AND t.revision=e.material_revision WHERE e.user_id=$user AND e.id=?',event.id,event.revision,input.id))throw missing();const reader=this.factory(context,{sourceIds:input.sourceIds,assertCurrent:()=>this.runtime.authority.assert(context)}),record=reader.evidence([input.id])[0];if(memoryEvidenceFingerprint(record)!==input.fingerprint||reader.originalReceipt(input.id)!==input.receipt||this.anchorHash(context,input.id)!==input.anchorHash)throw missing();return record;}
 private index(run:TaskRun){const input=indexInput.parse(run.task.input),record=this.indexCurrent(run.context,input);return this.call(run,[record.appName,record.windowTitle,record.ocrText,...(record.mood===undefined?[]:[`User-provided mood: ${record.mood}`])].join('\n'),45000,()=>{run.grant.assert();this.indexCurrent(run.context,input);});}
 private queryCurrent(context:UserContext,input:z.infer<typeof queryInput>){this.runtime.authority.assert(context);const query=this.queries.get(context.userId+':'+input.id);if(!query||query.context.userId!==context.userId||sha256(query.text)!==input.hash)throw missing();query.assert();return query;}
 private async call(run:TaskRun,text:string,timeoutMs:number,assert:()=>void){
  if(!run.model)throw new ExecutionFailure('permanent','embedding_not_configured');
  const meter=run.model.startUsage({attribution:{agentId:'context-query',moduleId:'retrieval',skillId:null}});
  try{
   const outcome=await run.model.withModel(async raw=>{try{const settings=embeddingSettings(raw);assert();const value=await requestEmbedding(settings,text,timeoutMs,AbortSignal.any([this.abort.signal,run.signal]),()=>{assert();run.grant.assert();meter.issued();});assert();return {ok:true as const,value:{vector:value.vector,modelKey:modelKey(settings)},usage:value.usage};}catch(error){return {ok:false as const,error:classify(error)};}});
   assert();if(!outcome.ok)throw outcome.error;if(outcome.usage)meter.update(outcome.usage);meter.finish('completed');return outcome.value;
  }catch(error){try{meter.finish('failed');}catch{meter.interrupt();}throw error;}
 }
 async search(context:UserContext,scope:AskScope,args:ContextQueryInput={},signal?:AbortSignal){
  const assert=()=>{this.runtime.authority.assert(context);this.abort.signal.throwIfAborted();signal?.throwIfAborted();scope.assertCurrent();},reader=this.factory(context,{...scope,assertCurrent:assert}),readLexical=()=>reader.records(args).items;assert();
  let lexical=readLexical(),vectors:CaptureRecord[]=[],degraded=false,reason:string|undefined,vectorCoverage:unknown,configured=false,hybrid=false;
  const limit=Math.max(1,Math.min(args.limit??50,200));
  const selection=await this.configuration.forUser(context).models();assert();configured=Boolean(selection.selections.embedding);
  if(configured&&args.query&&args.source!=='activity'&&args.source!=='media'&&args.collection!=='activity'){
   const id=randomUUID(),key=context.userId+':'+id,deadline=new AbortController(),timer=setTimeout(()=>deadline.abort(new Error('retrieval_timeout')),1200);timer.unref();let taskId:string|undefined,scanning=false;
   const combined=AbortSignal.any([this.abort.signal,deadline.signal,...(signal?[signal]:[])]),query:QueryValue={context,text:args.query,assert:()=>{assert();combined.throwIfAborted();}},cancel=()=>{if(taskId)try{this.execution.forUser(context).cancel(taskId);}catch{/* Retired request authority cannot revive the child. */}};combined.addEventListener('abort',cancel,{once:true});this.queries.set(key,query);
   try{
    const selected=await this.configuration.forUser(context).selection('embedding'),cacheKey=askHash([selected,args.query]);query.assert();let cache=this.queryCache.get(context.userId);if(!cache){cache=new Map();this.queryCache.set(context.userId,cache);}const cached=cache.get(cacheKey);
    if(cached&&Date.now()-cached.at<60000){this.configuration.assertLease(cached.lease);query.result=cached.value;}
    else{const task=await this.execution.forUser(context).submit({kind:'ask.embedding-query',operationId:'embedding-query:'+id,input:{id,hash:sha256(args.query)}},task=>{taskId=task.id;if(combined.aborted)this.execution.forUser(context).cancel(task.id);});taskId=task.id;query.assert();await this.execution.engine.drain([task.id]);query.assert();if(!query.result||!query.lease||this.execution.forUser(context).get(task.id).state!=='succeeded')throw Error('embedding_unavailable');this.configuration.assertLease(query.lease);if(cache.size>=128)cache.delete(cache.keys().next().value!);cache.set(cacheKey,{at:Date.now(),value:query.result,lease:query.lease});}
    const vectorQuery=reader.vectorQuery(query.result.modelKey,args);scanning=true;
    const [scan]=await scanVectors({path:this.path,queries:[vectorQuery],vector:query.result.vector,limit},combined);query.assert();
    const current=new Map(this.sql(context).all(`SELECT * FROM (${vectorQuery.sql}) WHERE id IN(SELECT value FROM json_each(?))`,...vectorQuery.values,JSON.stringify(scan.candidates.map(item=>item.id))).map(row=>[String(row.id),row]));
    vectors=scan.candidates.flatMap(candidate=>{const row=current.get(candidate.id);if(!row||sha256(String(row.embedding))!==candidate.embeddingHash)return [];try{const record=reader.evidence([candidate.id],args)[0];return memoryEvidenceFingerprint(record)===row.fingerprint&&reader.originalReceipt(candidate.id)===row.receipt?[record]:[];}catch{assert();return [];}});
    vectorCoverage={captures:scan.coverage,files:null};hybrid=true;
   }catch(error){assert();degraded=true;reason=deadline.signal.aborted?'retrieval_timeout':scanning?'vector_unavailable':'embedding_unavailable';vectorCoverage={complete:false,reason};}
   finally{clearTimeout(timer);combined.removeEventListener('abort',cancel);this.queries.delete(key);if(taskId){try{const state=this.execution.forUser(context).get(taskId).state;if(state==='waiting'||state==='running')this.execution.forUser(context).cancel(taskId);}catch{assert();}}}
   lexical=readLexical();
  }
  assert();const retrieval={mode:hybrid?'hybrid':'lexical',degraded,...(configured?{embeddingInput:{maxUtf16CodeUnits:EMBEDDING_INPUT_CODE_UNITS,evidencePolicy:'prefix_per_capture_or_file_chunk',queryTruncated:(args.query?.length??0)>EMBEDDING_INPUT_CODE_UNITS,fullTextFallback:'lexical'}}:{}),...(vectorCoverage?{vectorCoverage}:{}),...(reason?{reason}:{})},result=fuseEvidenceRanks(hybrid?[lexical,vectors]:[lexical],limit).map(record=>({...record,retrieval}));return Object.assign(result,{retrieval});
 }
 forgetOwner(userId:string){this.queryCache.delete(userId);for(const [key,query]of this.queries)if(query.context.userId===userId)this.queries.delete(key);}
 async close(){if(this.abort.signal.aborted)return;this.abort.abort();this.queries.clear();this.queryCache.clear();for(const dispose of this.dispose.reverse())await dispose();}
}
