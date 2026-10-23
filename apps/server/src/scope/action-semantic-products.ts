import {ProviderFailure,type CaptureRecord,type QueryResult} from '@mote/shared';
import type {QueryInput} from '@mote/agent';
import {z} from 'zod';
import {partitionExactSegments,describeExactSegment} from '../exact-segments.js';
import {observationKey} from '../observation-key.js';
import {validateMemoryExtraction} from '../memory-contract.js';
import {memoryProfile} from '../memory-profiles.js';
import type {Memory} from '../memory-schema.js';
import {parseSemanticProducts,segmentUnderstandingQuestion,type SemanticProducts} from '../semantic-products.js';
import {EXECUTION_POLICIES} from '../execution-policy.js';
import {ExecutionFailure} from '../execution-engine.js';
import {askHash} from './ask-schema.js';
import {queryWithUsage} from './model-query.js';
import {PrivateDataError,missing} from './private-data-sql.js';
import type {UserContext} from './context.js';
import type {TaskRun} from './task-execution.js';
import type {ScopedActions} from './actions.js';
import type {IngressHost} from './ingress.js';
import {installActionSemanticSchema,type ActionProof} from './actions-schema.js';

export type ActionSegment={id:string;revision:string;ranges:{id:string;offset:number;length:number}[];representativeIds:string[];memberIds:string[]};
type Product=SemanticProducts&{kind:'semantic';productsVersion:1;complete:true;artifactId:string;artifactRevision:string};
type Stored={segment:ActionSegment;generation:number;parentTaskId?:string;sourceIds?:readonly string[]};
type Row={id:string;revision:string;input:string;proof:string;task_id:string|null;json:string|null;consumed:number};
const input=z.object({id:z.string().regex(/^[a-f0-9]{64}$/),revision:z.string().regex(/^[a-f0-9]{64}$/)}).strict();
const parse=<T>(value:unknown):T=>JSON.parse(String(value));

/** Account adapter for the original complete-segment producer. Grouping,
 * representatives, prompt and quote parser are shared with the archive flow.
 * Coding understanding remains owned by Memory and never enters this producer. */
export class ActionSemanticProducts{
 private disposers:(()=>void|Promise<void>)[]=[];
 constructor(private host:ScopedActions,private ingress:IngressHost){
  installActionSemanticSchema(host.db);
  this.disposers.push(host.execution.register({kind:'actions.understand',pool:'actions.semantic',concurrency:()=>1,policy:EXECUTION_POLICIES.modelCall,modelFeature:'memory',parseInput:raw=>input.parse(raw),authorizeInput:(context,raw)=>{this.current(context,input.parse(raw));},execute:run=>this.understand(run),commit:(run,value)=>{const row=this.current(run.context,input.parse(run.task.input));host.sql(run.context).run('UPDATE ac_semantic_products SET json=? WHERE user_id=$user AND id=? AND revision=?',JSON.stringify(value),row.id,row.revision);},publicResult:()=>({retained:true}),classify:error=>error instanceof ExecutionFailure?error:error instanceof ProviderFailure?new ExecutionFailure(error.details.category,error.details.code,error.details.retryAfterMs):error instanceof PrivateDataError?new ExecutionFailure('stale','action_evidence_changed'):new ExecutionFailure('permanent','semantic_products')}));
 }
 private row(context:UserContext,ref:{id:string;revision:string}){const row=this.host.sql(context).get('SELECT * FROM ac_semantic_products WHERE user_id=$user AND id=? AND revision=?',ref.id,ref.revision) as Row|undefined;if(!row)throw missing();return row;}
 private assertSegment(context:UserContext,segment:ActionSegment){const record=this.host.evidence(context).evidence([segment.representativeIds[0]!])[0]!,current=this.segment(context,record);if(!current||current.id!==segment.id||current.revision!==segment.revision)throw missing();}
 private current(context:UserContext,ref:{id:string;revision:string}){const row=this.row(context,ref),stored=parse<Stored>(row.input),state=this.host.state(context);if(stored.generation!==state.generation||stored.parentTaskId&&!['waiting','running'].includes(this.host.execution.engine.get(stored.parentTaskId)?.state??''))throw missing();this.host.assertProof(context,parse(row.proof),stored.sourceIds);this.assertSegment(context,stored.segment);return row;}
 /** The exact old observation grouping, not a semantic/type classifier. File
  * products and V2 field pages retain their original direct-range branch. */
 segment(context:UserContext,record:CaptureRecord):ActionSegment|undefined{
  if(record.metadata?.uiPage?.version===2||record.provenance?.document?.coding)return;
  const sql=this.host.sql(context),file=sql.get('SELECT o.id,f.format FROM ig_originals o LEFT JOIN mp_original_formats f ON f.user_id=o.user_id AND f.original_id=o.id WHERE o.user_id=$user AND o.capture_id=?',record.id);
  if(file&&file.format!=='source-item')return;
  const group=observationKey(record),rows=record.source==='screen'||record.source==='ui_page'?sql.all("SELECT id FROM pd_captures WHERE user_id=$user AND json_extract(json,'$.deviceId')=? AND json_extract(json,'$.source')=? AND json_extract(json,'$.appId') IS ? AND json_extract(json,'$.windowTitle') IS ? AND json_extract(json,'$.provenance.sourceId') IS ? AND floor(unixepoch(json_extract(json,'$.capturedAt'),'subsec')/300)=? ORDER BY context_at,id LIMIT 1001",record.deviceId,record.source,record.appId??null,record.windowTitle??null,record.provenance?.sourceId??null,Math.floor(Date.parse(record.capturedAt)/300000)):[{id:record.id}];
  if(rows.length>1000)return;
  const repo=this.host.evidence(context),records=rows.flatMap(row=>{try{return repo.evidence([String(row.id)]);}catch(error){if(!(error instanceof PrivateDataError))throw error;return [];}});
  records.sort((a,b)=>a.capturedAt.localeCompare(b.capturedAt)||a.id.localeCompare(b.id));
  const part=partitionExactSegments(records).find(part=>part.some(item=>item.id===record.id));if(!part)return;
  const description=describeExactSegment(part);if(!description.metadata.complete||!description.text.trim())return;
  const representatives=part.filter(item=>description.representativeIds.includes(item.id)&&item.ocrText.length);
  if(representatives.reduce((n,item)=>n+item.ocrText.length,0)>12000)return;
  const proof=this.host.proof(context,part.map(item=>item.id)),id=askHash([group,part[0]!.id]),revision=askHash([proof,'mote.exact-segment','1',description.metadata]);
  return {id,revision,representativeIds:representatives.map(item=>item.id),memberIds:part.map(item=>item.id),ranges:representatives.map(item=>({id:item.id,offset:0,length:item.ocrText.length}))};
 }
 async stage(context:UserContext,segment:ActionSegment,proof:ActionProof,sourceIds?:readonly string[],parentTaskId?:string){
  const sql=this.host.sql(context),state=this.host.state(context),stored:Stored={segment,generation:state.generation,...(parentTaskId?{parentTaskId}:{}),...(sourceIds?{sourceIds}:{})};
  sql.run('INSERT OR IGNORE INTO ac_semantic_products(user_id,id,revision,input,proof) VALUES($user,?,?,?,?)',segment.id,segment.revision,JSON.stringify(stored),JSON.stringify(proof));let row=this.row(context,segment);
  if(row.json){this.host.assertProof(context,parse(row.proof),sourceIds);return row.task_id!;}
  if(parse<Stored>(row.input).generation!==state.generation||parse<Stored>(row.input).parentTaskId!==parentTaskId){if(row.task_id&&this.host.execution.engine.get(row.task_id)?.state==='running')this.host.execution.engine.cancel(row.task_id);sql.run('UPDATE ac_semantic_products SET input=? WHERE user_id=$user AND id=? AND revision=?',JSON.stringify(stored),segment.id,segment.revision);row=this.current(context,segment);}
  if(!row.task_id)await this.host.execution.forUser(context).submit({kind:'actions.understand',operationId:'workflow:actions:semantic:'+segment.id+':'+segment.revision,input:{id:segment.id,revision:segment.revision}},task=>{this.current(context,segment);sql.run('UPDATE ac_semantic_products SET task_id=? WHERE user_id=$user AND id=? AND revision=?',task.id,segment.id,segment.revision);for(const id of segment.memberIds)sql.run("INSERT OR IGNORE INTO ac_semantic_dependencies VALUES($user,?,?,'capture',?)",segment.id,segment.revision,id);for(const source of proof.sources)sql.run("INSERT OR IGNORE INTO ac_semantic_dependencies VALUES($user,?,?,'source',?)",segment.id,segment.revision,source.id);});
  return this.row(context,segment).task_id!;
 }
 read(context:UserContext,ref:ActionSegment){const row=this.row(context,ref);this.host.assertProof(context,parse(row.proof),parse<Stored>(row.input).sourceIds);this.assertSegment(context,ref);if(!row.json)throw new ExecutionFailure('waiting','action_semantic_pending',100,{executionStarted:false});const products=parse<Product>(row.json);if(products.kind!=='semantic'||products.productsVersion!==1||products.complete!==true||products.artifactId!==ref.id||products.artifactRevision!==ref.revision)throw missing();return {products,consumed:Boolean(row.consumed)};}
 consume(context:UserContext,ref:ActionSegment){this.read(context,ref);this.host.sql(context).run('UPDATE ac_semantic_products SET consumed=1 WHERE user_id=$user AND id=? AND revision=?',ref.id,ref.revision);}
 async retry(context:UserContext){for(const row of this.host.sql(context).all('SELECT id,revision,task_id FROM ac_semantic_products WHERE user_id=$user AND json IS NULL AND task_id IS NOT NULL')){try{this.current(context,{id:String(row.id),revision:String(row.revision)});const task=this.host.execution.forUser(context).get(String(row.task_id));if(['failed','blocked','stale','cancelled'].includes(task.state))this.host.execution.forUser(context).retry(task.id,{ownerAction:true});}catch(error){if(!(error instanceof PrivateDataError))throw error;}}}
 private async understand(run:TaskRun){
  const ref=input.parse(run.task.input),row=this.current(run.context,ref),stored=parse<Stored>(row.input),assert=()=>{run.grant.assert();run.signal.throwIfAborted();this.current(run.context,ref);},repo=this.host.evidence(run.context,stored.sourceIds),records=repo.evidence(stored.segment.representativeIds);
  if(!run.model||row.task_id!==run.task.id)throw missing();
  const accept=(result:QueryResult)=>{const output=parseSemanticProducts(result.answer,records,result.citations.map(item=>item.id),stored.segment.ranges);validateMemoryExtraction({...result,answer:JSON.stringify({memories:output.memoryCandidates})},{profile:memoryProfile(records[0]!).id,requireAdmission:true,evidenceRanges:stored.segment.ranges,validateOnly:true},{readEvidence:ids=>repo.evidence(ids),isCurrentEvidence:id=>{try{repo.evidence([id]);return true;}catch{return false;}},get:id=>this.host.runtime.services.forUser(run.context).get<{read(id:string):Memory}>('memory').read(id)});return output;};
  const validateOutput:NonNullable<QueryInput['validateOutput']>=result=>{assert();try{accept(result);}catch{return {code:'semantic_products',feedback:'Return all five required fields summary, evidence, events, memoryCandidates and actionCues. Use empty arrays for absent products. Every product must quote exact original text and cite its UUID. Keep original attribution, project scope and explicit dates. Memory candidates must satisfy the supplied memory admission schema.'};}};
  const result=await run.model.withModel(settings=>this.ingress.forUser(run.context,stored.sourceIds??[],assert).withWorkspace(workspace=>workspace.withDirectory(temporaryRoot=>queryWithUsage(run.model!,{...settings,reader:repo.reader(),temporaryRoot,requestTimeoutMs:settings.modelRequestTimeoutMs,authorizeModelRequest:assert},{signal:run.signal,assertContextAuthority:assert,executionLane:'background',evidenceIds:stored.segment.representativeIds,evidenceRanges:stored.segment.ranges,question:segmentUnderstandingQuestion(records),validateOutput},{jobId:ref.id,agentId:'segment-understanding',moduleId:'memories',skillId:null}))),{recovery:'read-query'});
  assert();return {...accept(result),kind:'semantic' as const,productsVersion:1 as const,complete:true as const,artifactId:ref.id,artifactRevision:ref.revision};
 }
 async close(){for(const dispose of this.disposers.reverse())await dispose();}
}
