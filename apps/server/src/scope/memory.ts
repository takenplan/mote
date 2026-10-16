import type {DatabaseSync} from 'node:sqlite';
import {z} from 'zod';
import {createAgent,type ContextReader,type QueryInput} from '@mote/agent';
import type {QueryResult,TokenUsage} from '@mote/shared';
import {memorySchema,type Memory} from '../memory-schema.js';
import {MemoryOutputValidationError} from '../memory-errors.js';
import {ScopedMemoryProviders,type MemoryProviderOptions} from './memory-providers.js';
import {queueMemoryErases,queueNativeCleanup,reconcileMemory} from './memory-reconcile.js';
import {MemoryIntake,type IntakeReceipt} from './memory-intake.js';
import type {ProcessingHost} from './processing.js';
import {ScopedMemoryBindings} from './memory-bindings.js';
import type {ScopedPluginHost} from './plugins.js';
import {memoryStrategyRefSchema} from '../memory-strategy-contract.js';
import {MemoryStrategies} from '../memory-strategies.js';
import {memoryWorkInstruction,readMemoryWorkCoverage} from '../memory-work-contract.js';
import {MEMORY_EXTRACTION_PROMPT,preparedMemoryExtractionSchema} from '../memory-contract.js';
import {reviewMemory,memoryReviewReceipt} from '../memory-review.js';
import {memoryProviderKey,memoryBodyDigest,withMemoryHostState,type MemoryProvider,type MemoryProviderNamespace} from '../memory-provider-contract.js';
import {stageVerifiedMemoryWrite} from '../memory-provider-publication.js';
import {EXECUTION_POLICIES} from '../execution-policy.js';
import {ExecutionFailure} from '../execution-engine.js';
import {PrivateSql,PrivateCursor,PrivateDataError,missing} from './private-data-sql.js';
import {PrivateData} from './private-data.js';
import type {ScopedRuntime} from './http.js';
import type {UserContext} from './context.js';
import type {DomainLifecycle,UserDataSubject} from './lifecycle.js';
import type {Configurations} from './configuration.js';
import type {TaskExecution,TaskRun} from './task-execution.js';
import {isCaptureMemorySource} from '../capture-memory-source.js';
import {memoryRangeChunks} from '../memory-range-chunks.js';
import {ScopedMemoryData,memoryUUID,memoryHash,type MemoryRow,type MemoryState} from './memory-data.js';
import {installScopedMemory,ScopedMemoryError,MEMORY_DOMAIN,scopedMemoryTaskSchema,memorySettingsSchema,defaultMemorySettings,type ScopedMemoryTask,type ScopedMemoryBinding} from './memory-schema.js';

type Job={input:string;draft:string|null;review:string|null;prepared:string|null;state:string;tasks:string};
const submitSchema=z.object({operationId:z.string().uuid(),recipes:z.array(memoryStrategyRefSchema).min(1).max(10).optional(),materialIds:z.array(z.string().regex(/^mat_[a-f0-9]{64}$/)).min(1),memoryIds:z.array(z.string().uuid()).default([]),phase:z.enum(['extract','integrate']).default('extract')}).strict();
const queryResultSchema=z.object({answer:z.string(),runId:z.string().min(1),citations:z.array(z.object({id:z.string().uuid()}).passthrough()),trace:z.array(z.unknown()).default([])}).passthrough();
const result=(value:string)=>queryResultSchema.parse(JSON.parse(value)) as QueryResult;
const failure=(error:unknown)=>error instanceof ExecutionFailure?error:error instanceof ScopedMemoryError?new ExecutionFailure('blocked',error.code):error instanceof PrivateDataError?new ExecutionFailure('stale','memory_input_changed'):error instanceof MemoryOutputValidationError?new ExecutionFailure('permanent','memory_output_'+error.code):new ExecutionFailure('blocked','memory_requires_attention');

/** The existing M05 executor is the only scheduler. Extraction, independent
 * review, integration and publication use durable grants, M04 model snapshots
 * and the shared exact-evidence/publication validators. */
export class MemoryHost {
 readonly strategies=new MemoryStrategies();
 readonly intake:MemoryIntake;
 readonly providers:ScopedMemoryProviders;
 readonly bindings:ScopedMemoryBindings;
 private readonly disposers:Array<()=>void|Promise<void>>=[];
 private closed=false;
 private readonly admissions=new Map<string,{fingerprint:string;promise:Promise<unknown>}>();
 constructor(private readonly runtime:ScopedRuntime,private readonly db:DatabaseSync,private readonly configuration:Configurations,private readonly execution:TaskExecution,private readonly plugins:ScopedPluginHost,providerOptions:MemoryProviderOptions={},private readonly cursorKey=installScopedMemory(db)){
  this.providers=new ScopedMemoryProviders(db,runtime.authority,configuration,plugins,providerOptions);
  this.bindings=new ScopedMemoryBindings(context=>this.data(context),(context,id)=>this.read(context,id),(context,id,version)=>this.readVersion(context,id,version),execution,plugins,this.providers);
  this.intake=new MemoryIntake(context=>this.data(context),execution,this.strategies,(context,id,materials,receipt)=>this.admit(context,{operationId:id,materialIds:[...new Set(materials.map(item=>item.materialId))]},true,receipt,materials));
  runtime.services.registerUser(MEMORY_DOMAIN,{scope:'user',create:context=>this.forUser(context),lifecycle:this.lifecycle()});
  configuration.registerDomain(MEMORY_DOMAIN,subject=>({id:MEMORY_DOMAIN,schema:memorySettingsSchema,defaultValue:defaultMemorySettings(),resolve:raw=>{const value=memorySettingsSchema.parse(raw);for(const ref of [value.recipe,value.codingRecipe,...(value.recipes??[]),...value.captureRecipes,...value.documentRecipes,...Object.values(value.sourceRecipes).flat()])this.strategies.resolve(ref);this.strategies.resolveIntegration(value.integrationRecipe);return value;},fields:[{path:'',effect:'next-request'}],prepare:next=>{
   const assert=()=>runtime.services.assertSubject(subject,'configuration',('purpose' in subject?subject.purpose:'restore')),sql=new PrivateSql(db,subject.userId,assert),before=sql.get('SELECT * FROM mm_state WHERE user_id=$user') as MemoryState|undefined,settings=JSON.stringify(memorySettingsSchema.parse(next)),beforeIntakes=sql.all('SELECT id,revoked FROM mm_intakes WHERE user_id=$user');let applied=false;
   return {apply:()=>{},publish:()=>sql.transaction(()=>{if(before?.deleted)throw new PrivateDataError('scope_unavailable',503);if(before)sql.run('UPDATE mm_state SET settings=?,revision=revision+1 WHERE user_id=$user',settings);else sql.run('INSERT INTO mm_state VALUES($user,0,0,1,1,?,?)',settings,JSON.stringify({kind:'builtin',revision:1}));const value=memorySettingsSchema.parse(next);for(const row of sql.all('SELECT id,material_id,json FROM mm_intakes WHERE user_id=$user AND revoked=0')){const receipt=JSON.parse(String(row.json)),material=sql.get('SELECT source_id FROM pd_materials WHERE user_id=$user AND id=?',row.material_id),source=material?sql.get('SELECT json FROM pd_sources WHERE user_id=$user AND id=?',material.source_id):undefined,definition=source?JSON.parse(String(source.json)):undefined,refs=material?value.sourceRecipes[String(material.source_id)]??(definition&&isCaptureMemorySource(definition.id,definition.deviceId)?value.captureRecipes:definition?.kind==='lark-docs'?value.documentRecipes:value.recipes??[value.profile==='coding'?value.codingRecipe:value.recipe]):[];if(!value.automatic||!refs.some(ref=>ref.id===receipt.strategy?.recipe.id&&ref.version===receipt.strategy?.recipe.version))sql.run('UPDATE mm_intakes SET revoked=1 WHERE user_id=$user AND id=?',row.id);}applied=true;}),rollback:()=>{if(applied){for(const row of beforeIntakes)sql.run('UPDATE mm_intakes SET revoked=? WHERE user_id=$user AND id=?',row.revoked,row.id);if(before)sql.run('UPDATE mm_state SET settings=?,revision=? WHERE user_id=$user',before.settings,before.revision);else sql.run('DELETE FROM mm_state WHERE user_id=$user');}}};
  }}));
  this.disposers.push(execution.register({kind:'memory.reconcile',pool:'memory.publication',concurrency:()=>4,policy:EXECUTION_POLICIES.control,parseInput:value=>z.object({operationId:z.string().uuid()}).strict().parse(value),authorizeInput:context=>{this.data(context).state();},resources:()=>[{scope:'user',key:'memory-publication'}],execute:async run=>reconcileMemory(this.data(run.context).sql,this.providers,run.context),classify:failure}));
  for(const stage of ['extract','review','publish'] as const)this.disposers.push(execution.register({kind:'memory.'+stage,pool:stage==='publish'?'memory.publication':'memory.models',concurrency:()=>stage==='publish'?4:2,policy:stage==='publish'?EXECUTION_POLICIES.control:EXECUTION_POLICIES.modelCall,...(stage==='publish'?{}:{modelFeature:'memory' as const,leaseModel:async(context:UserContext,raw:Record<string,unknown>,operationId:string)=>{const input=scopedMemoryTaskSchema.parse(raw);this.assertJob(context,input);if(!input.model)throw new PrivateDataError('scope_unavailable',503);return this.configuration.forkLease(context,input.model.snapshotId,input.model.operationId,operationId);}}),parseInput:value=>scopedMemoryTaskSchema.parse(value),authorizeInput:(context,value)=>{this.assertJob(context,scopedMemoryTaskSchema.parse(value));},resources:()=>[{scope:'user',key:'memory-publication'}],execute:run=>this.execute(run,stage),commit:(run,value)=>{if(stage==='publish'){const data=this.data(run.context),input=scopedMemoryTaskSchema.parse(run.task.input),job=this.assertJob(run.context,input);if(!job.prepared)throw missing();data.commit(preparedMemoryExtractionSchema.parse(JSON.parse(job.prepared)),input);if(input.binding.kind==='plugin'){queueNativeCleanup(data.sql,input.jobId);this.execution.forUser(run.context).submitSync({kind:'memory.reconcile',operationId:'memory-published-cleanup:'+input.jobId,input:{operationId:input.jobId}});}}},classify:failure}));
 }
 bindProcessing(processing:ProcessingHost){this.intake.bind(processing);}
 private data(context:UserContext){this.runtime.authority.assert(context);if(this.closed)throw new PrivateDataError('scope_unavailable',503);return new ScopedMemoryData(new PrivateSql(this.db,context.userId,()=>{this.runtime.authority.assert(context);if(this.closed)throw new PrivateDataError('scope_unavailable',503);}),this.runtime.services.forUser(context).get<PrivateData>('private-data'),new PrivateCursor(this.cursorKey,context.deploymentId,context.userId));}
 private assertJob(context:UserContext,input:ScopedMemoryTask){const data=this.data(context);data.assertInputs(input);if(input.binding.kind==='plugin'){let grant;try{grant=this.plugins.domainGrant(context,input.binding.snapshotId,'repository');}catch{grant=this.plugins.domainGrant(context,input.binding.snapshotId,'engine');}grant.assertCurrent();data.assertSources(input.inputs.map(pin=>pin.id),grant.sourceIds);}const parent=data.sql.get('SELECT * FROM mm_jobs WHERE user_id=$user AND id=?',input.jobId) as Job|undefined,job=(input.batchId?data.sql.get('SELECT * FROM mm_job_batches WHERE user_id=$user AND job_id=? AND id=?',input.jobId,input.batchId):parent) as Job|undefined;if(!parent||!job||job.input!==JSON.stringify(input)||['cancelled','deleted'].includes(parent.state))throw new PrivateDataError('conflict',409);return job;}
 private async provider(context:UserContext,binding:ScopedMemoryBinding,assertCurrent:()=>void){assertCurrent();if(binding.kind!=='plugin')throw new PrivateDataError('scope_unavailable',503);const provider=await this.providers.provider(context,binding,assertCurrent);assertCurrent();return provider;}
 private namespace(context:UserContext,binding:Extract<ScopedMemoryBinding,{kind:'plugin'}>):MemoryProviderNamespace{return Object.freeze({ownerId:context.userId,instanceId:binding.instanceId,bindingRevision:binding.revision});}
 private async read(context:UserContext,id:string){
  const data=this.data(context),row=data.row(id),host=data.assertCurrentRecord(row),binding=JSON.parse(row.binding) as ScopedMemoryBinding;
  const assert=()=>{const current=data.row(id);data.assertCurrentRecord(current);if(current.body_digest!==row.body_digest||current.version!==row.version||current.binding!==row.binding)throw new PrivateDataError('conflict',409);};
  if(binding.kind==='builtin')return host;
  const descriptor=await this.providers.descriptor(context,binding);data.assertSources(host.evidenceIds,descriptor.sourceIds);
  const provider=await this.provider(context,binding,assert),value=await provider.read({namespace:this.namespace(context,binding),key:memoryProviderKey(host)});assert();
  if(!value||memoryBodyDigest(value)!==row.body_digest)throw new PrivateDataError('scope_unavailable',503);return withMemoryHostState(value,host);
 }
 private async readVersion(context:UserContext,id:string,version:number){
  const data=this.data(context),current=data.row(id);data.assertCurrentRecord(current);if(current.version===version)return this.read(context,id);
  const row=data.sql.get('SELECT v.json,b.binding,b.body_digest FROM mm_versions v JOIN mm_version_bindings b ON b.user_id=v.user_id AND b.id=v.id AND b.version=v.version WHERE v.user_id=$user AND b.user_id=$user AND v.id=? AND v.version=?',id,version);if(!row)throw missing();
  const memory=memorySchema.parse(JSON.parse(String(row.json)));data.evidence(memory.evidenceIds);const binding=JSON.parse(String(row.binding)) as ScopedMemoryBinding;if(binding.kind==='builtin')return memory;
  const descriptor=await this.providers.descriptor(context,binding);data.assertSources(memory.evidenceIds,descriptor.sourceIds);const assert=()=>{data.assertCurrentRecord(data.row(id));data.evidence(memory.evidenceIds);descriptor.assertCurrent();},provider=await this.provider(context,binding,assert),value=await provider.read({namespace:descriptor.namespace,key:memoryProviderKey(memory)});assert();if(!value||memoryBodyDigest(value)!==row.body_digest)throw new ScopedMemoryError('memory_provider_unavailable');return value;
 }
 private async scheduleReconcile(context:UserContext){return this.execution.forUser(context).submit({kind:'memory.reconcile',operationId:'memory-reconcile:'+crypto.randomUUID(),input:{operationId:crypto.randomUUID()}});}
 private async page(context:UserContext,raw:unknown){
  const request=z.object({query:z.string().trim().min(1).max(500).optional(),cursor:z.string().optional(),limit:z.coerce.number().int().min(1).max(100).default(30),includeHistory:z.boolean().default(false)}).strict().parse(raw),data=this.data(context),binding=data.binding();
  if(!request.query||binding.kind==='builtin'){
   const page=data.page(request),items:Memory[]=[];for(const row of page.rows){try{items.push(await this.read(context,row.id));}catch(error){if(error instanceof PrivateDataError&&error.code==='not_found')continue;throw error;}}return {items,nextCursor:page.nextCursor};
  }
  const rows:MemoryRow[]=[];let cursor:string|undefined;do{const page=data.page({limit:100,includeHistory:request.includeHistory,...(cursor?{cursor}:{})});rows.push(...page.rows);cursor=page.nextCursor??undefined;}while(cursor);
  const descriptor=await this.providers.descriptor(context,binding),current=rows.filter(row=>memoryHash(JSON.parse(row.binding))===memoryHash(binding)),keys=current.map(row=>{const memory=data.assertCurrentRecord(row);data.assertSources(memory.evidenceIds,descriptor.sourceIds);return memoryProviderKey(memory);}),catalog=memoryHash(current.map(row=>[row.id,row.version,row.body_digest,row.binding,row.json])),assert=()=>{descriptor.assertCurrent();for(const row of current){const actual=data.row(row.id);data.assertCurrentRecord(actual);if(memoryHash([actual.id,actual.version,actual.body_digest,actual.binding,actual.json])!==memoryHash([row.id,row.version,row.body_digest,row.binding,row.json]))throw new PrivateDataError('conflict',409);}};
  const provider=await this.provider(context,binding,assert),hits=await provider.search({namespace:descriptor.namespace,query:request.query,keys,limit:Math.max(keys.length,1)});assert();
  const seen=new Set<string>();for(const hit of hits){const row=current.find(row=>row.id===hit.key.memoryId);if(!row||!keys.some(key=>memoryHash(key)===memoryHash(hit.key))||memoryBodyDigest(hit.memory)!==row.body_digest||seen.has(hit.memory.id))throw new PrivateDataError('scope_unavailable',503);seen.add(hit.memory.id);}
  if(catalog!==memoryHash(current.map(row=>[row.id,row.version,row.body_digest,row.binding,row.json])))throw new PrivateDataError('conflict',409);
  const selected=data.rankedPage(request,hits.map(hit=>hit.memory.id)),items:Memory[]=[];for(const id of selected.ids)items.push(await this.read(context,id));assert();return {items,nextCursor:selected.nextCursor};
 }
 private async related(context:UserContext,input:ScopedMemoryTask){const values:Memory[]=[];for(const pin of input.related){const value=await this.read(context,pin.id);if(value.version!==pin.version||value.fingerprint!==pin.fingerprint)throw new PrivateDataError('conflict',409);values.push(value);}return values;}
 private async reader(run:TaskRun,input:ScopedMemoryTask):Promise<ContextReader>{
  const data=this.data(run.context),related=await this.related(run.context,input),assert=()=>{run.grant.assert();this.assertJob(run.context,input);},evidence=(ids:readonly string[])=>{assert();if(ids.some(id=>!input.inputs.some(pin=>pin.id===id)))throw missing();return data.evidence(ids);};
  return {search:async args=>evidence(input.inputs.map(pin=>pin.id)).filter(record=>!args.query||record.ocrText.toLowerCase().includes(args.query.toLowerCase())),timeline:async()=>({items:evidence(input.inputs.map(pin=>pin.id)),nextCursor:null}),evidence:async args=>evidence(args.ids),activity:async()=>{assert();return {};},devices:async()=>{assert();return [];},memories:async args=>{assert();const selected=related.filter(memory=>(!args.id||memory.id===args.id)&&(!args.query||memory.statement.toLowerCase().includes(args.query.toLowerCase())));return {items:selected,nextCursor:null,evidence:evidence([...new Set(selected.flatMap(memory=>memory.evidenceIds))])};}};
 }
 private async query(run:TaskRun,input:ScopedMemoryTask,args:QueryInput):Promise<QueryResult>{
  if(!run.model)throw new PrivateDataError('scope_unavailable',503);const reader=await this.reader(run,input),started=Date.now();
  try{return await run.model.withModel(async settings=>{
   const agent=createAgent({...settings,reader,authorizeModelRequest:()=>{run.grant.assert();this.assertJob(run.context,input);}});
   try{let tokens:TokenUsage|undefined;const answer=await agent.query({...args,onUsage:value=>{tokens=value;args.onUsage?.(value);}});run.grant.assert();this.assertJob(run.context,input);run.model!.recordUsage({status:'completed',durationMs:Date.now()-started,tokens});return answer;}finally{await agent.close();}
  });}catch(error){run.grant.assert();this.assertJob(run.context,input);run.model.recordUsage({status:'failed',durationMs:Date.now()-started});throw error;}
 }
 private async execute(run:TaskRun,stage:'extract'|'review'|'publish'){
  const input=scopedMemoryTaskSchema.parse(run.task.input),data=this.data(run.context),job=this.assertJob(run.context,input),related=await this.related(run.context,input),assert=()=>{run.grant.assert();this.assertJob(run.context,input);};
  if(job.state==='admitting')throw new ExecutionFailure('waiting','memory_admission_pending',100,{executionStarted:false});
  const selected=input.strategy?this.strategies.resolvePinned(input.strategy):undefined,integrated=input.integration?this.strategies.resolvePinnedIntegration(input.integration):undefined,members=selected?.binding.workContract?data.members(input):undefined,records=data.assertInputs(input),base:QueryInput={question:integrated?.integrate.prompt??selected?.extract.prompt??MEMORY_EXTRACTION_PROMPT,...(integrated?{taskContext:{turns:[],untrustedInterpretations:JSON.stringify({kind:'supplied-memory-cards',items:related})}}:{}),...(members?{taskContext:{turns:[],memoryWork:{package:{goal:'Evaluate the authorized original ranges',instruction:'Preserve attribution, selected useful context and exact evidence'},members,contextMembers:[],authorizedMembers:members,history:[],workContract:input.strategy!.workContract,instruction:memoryWorkInstruction(members,undefined,input.strategy!.workContract)}}}:{}),skill:input.phase==='integrate'?'memory-consolidation':'memory-extraction',responseMode:'memory-extraction',timeZone:input.timeZone,signal:run.signal,contextTime:records.map(record=>record.capturedAt).sort().at(-1),evidenceIds:records.map(record=>record.id),evidenceRanges:data.ranges(input),validateOutput:value=>{try{data.validate(value,input,related);return undefined;}catch(error){if(error instanceof MemoryOutputValidationError)return {code:error.code,feedback:error.repairInstruction};throw error;}}};
  if(stage==='extract'){
   if(job.draft)return {retained:true};const native=input.binding.kind==='plugin'?await this.providers.nativeDraft(run.context,input.binding,{namespace:this.namespace(run.context,input.binding),opId:run.task.id,phase:input.phase,evidence:data.ranges(input).map(range=>({record:records.find(record=>record.id===range.id)!,offset:range.offset,length:range.length})),relatedMemories:related,signal:run.signal},assert):undefined,draft=native??await this.query(run,input,base);assert();if(!native)data.validate(draft,input,related);run.grant.commit(()=>{assert();data.sql.run('UPDATE mm_job_batches SET draft=? WHERE user_id=$user AND job_id=? AND id=? AND draft IS NULL',JSON.stringify(draft),input.jobId,input.batchId!);});run.checkpoint.write('output',input.jobId);return {retained:true};
  }
  if(stage==='review'){
   if(job.review)return {retained:true};if(!job.draft)throw missing();
   const origin=input.binding.kind==='plugin'&&(await this.providers.descriptor(run.context,input.binding)).adapter==='mote.hindsight@1'?'native-engine':'mote';
   const reviewed=await reviewMemory(base,result(job.draft),args=>this.query(run,input,args),{draftOrigin:origin,deletions:data.deletionReview(),strategy:integrated?.review??selected?.review});assert();const receipt=memoryReviewReceipt(reviewed);if(receipt)receipt.model=run.model!.lease.model;const coverage=members?readMemoryWorkCoverage(reviewed,members,undefined,id=>records.find(record=>record.id===id)?.ocrText,input.strategy!.workContract):undefined;
   run.grant.commit(()=>{assert();data.sql.run('UPDATE mm_job_batches SET review=? WHERE user_id=$user AND job_id=? AND id=? AND review IS NULL',JSON.stringify({result:reviewed,receipt,...(coverage?{coverage}:{})}),input.jobId,input.batchId!);});run.checkpoint.write('output',input.jobId);return {retained:true};
  }
  if(!job.review)throw missing();const reviewed=JSON.parse(job.review);if(reviewed.coverage?.incomplete)throw new ExecutionFailure('blocked',reviewed.coverage.needsOwnerInput?.length?'memory_requires_owner_input':'memory_incomplete');const reviewedResult=queryResultSchema.parse(reviewed.result) as QueryResult,duplicates:Memory[]=[];if(!job.prepared)for(const id of data.duplicateIds(reviewedResult,input,related)){duplicates.push(await this.read(run.context,id));assert();}
  const prepared=job.prepared?preparedMemoryExtractionSchema.parse(JSON.parse(job.prepared)):data.prepareExtract(reviewedResult,input,related,reviewed.receipt,duplicates);
  if(!job.prepared)run.grant.commit(()=>{assert();data.sql.run('UPDATE mm_job_batches SET prepared=? WHERE user_id=$user AND job_id=? AND id=?',JSON.stringify(prepared),input.jobId,input.batchId!);});
  data.assertPrepared(prepared,input);
  if(input.binding.kind==='plugin'){
   const binding=input.binding,namespace=this.namespace(run.context,binding),provider=await this.provider(run.context,binding,assert);
   for(const memory of prepared.changed){
    assert();const key=memoryProviderKey(memory),id='memory:'+memoryHash([namespace,key]),write={namespace,key,memory,opId:id},digest=memoryHash({namespace,key,memory}),prior=data.sql.get('SELECT state,payload_digest FROM mm_provider_journal WHERE user_id=$user AND id=?',id);
    if(prior&&prior.payload_digest!==digest)throw new PrivateDataError('conflict',409);
    run.grant.commit(()=>data.sql.run("INSERT OR IGNORE INTO mm_provider_journal VALUES($user,?,?,?,?,?,?,'submitted',?)",id,input.jobId,JSON.stringify(namespace),JSON.stringify(key),memoryBodyDigest(memory),digest,JSON.stringify({...write,binding})));
    // Reconciliation reads an exact prior body before replaying an idempotent
    // literal put. An unknown native inference is never rerun here.
    const existing=prior?await provider.read({namespace,key}):null;assert();
    if(!existing||memoryBodyDigest(existing)!==memoryBodyDigest(memory))await stageVerifiedMemoryWrite(provider,write,assert);
    run.grant.commit(()=>{assert();data.sql.run("UPDATE mm_provider_journal SET state='acknowledged' WHERE user_id=$user AND id=?",id);});
   }
  }
  assert();data.assertPrepared(prepared,input);return {memoryIds:prepared.items.map(memory=>memory.id)};
 }
 private async admit(context:UserContext,raw:unknown,automatic=false,fixed?:IntakeReceipt,intakes?:readonly {id:string;materialId:string;revision:string}[]){
  const request=submitSchema.parse(raw),data=this.data(context),state=data.state(),settings=fixed?.settings??memorySettingsSchema.parse(JSON.parse(state.settings));
  if(automatic&&!fixed&&(!state.desired||!settings.automatic))throw new PrivateDataError('conflict',409);
  if(!fixed&&data.sql.get('SELECT 1 FROM mm_binding_locks WHERE user_id=$user'))throw new PrivateDataError('conflict',409);
  const binding=fixed?.binding??data.binding(),providerGrant=binding.kind==='plugin'?await this.providers.descriptor(context,binding):undefined;if(binding.kind==='plugin'){let grant;try{grant=this.plugins.domainGrant(context,binding.snapshotId,'repository');}catch{grant=this.plugins.domainGrant(context,binding.snapshotId,'engine');}fixed?grant.assertCurrent():grant.assertAdmission();}
  const evidence=request.materialIds.flatMap(id=>data.materialEvidence(id,intakes?.find(item=>item.materialId===id)?.revision,providerGrant?.sourceIds)),related:Memory[]=[];for(const id of request.memoryIds)related.push(await this.read(context,id));
  if(request.phase==='integrate'&&!related.length||request.phase==='extract'&&related.length)throw new PrivateDataError('invalid_data');
  const recipeBindings=request.phase==='extract'?(fixed?[fixed.strategy]:(request.recipes??settings.recipes??[settings.profile==='coding'?settings.codingRecipe:settings.recipe]).map(ref=>this.strategies.resolve(ref).binding)):[],selected=request.phase==='extract'?{strategy:recipeBindings[0],recipes:recipeBindings}:{integration:this.strategies.resolveIntegration(settings.integrationRecipe).binding};
  const old=data.sql.get('SELECT input FROM mm_jobs WHERE user_id=$user AND id=?',request.operationId),retained=old?scopedMemoryTaskSchema.parse(JSON.parse(String(old.input))).model:undefined,modelOperation='memory-job:'+request.operationId,lease=retained?undefined:await this.configuration.lease(context,'memory',modelOperation),model=retained??{snapshotId:lease!.snapshotId,operationId:modelOperation};
  const input=scopedMemoryTaskSchema.parse({model,jobId:request.operationId,...(automatic?{intakeIds:intakes!.map(item=>item.id)}:{}),phase:request.phase,...selected,inputs:[...new Map(evidence.map(record=>[record.id,{id:record.id,hash:memoryHashEvidence(record)}])).values()],related:related.map(memory=>({id:memory.id,version:memory.version,fingerprint:memory.fingerprint})),binding,generation:state.generation,deletionSnapshot:data.deletionSnapshot(),automatic,profile:settings.profile,timeZone:settings.timeZone});
  const encoded=JSON.stringify(input),prior=data.sql.get('SELECT input,tasks,state FROM mm_jobs WHERE user_id=$user AND id=?',input.jobId);
  if(prior){if(prior.input!==encoded)throw new PrivateDataError('conflict',409);if(prior.state!=='admitting')return this.job(context,input.jobId);}
  data.sql.run('INSERT OR IGNORE INTO mm_jobs(user_id,id,input) VALUES($user,?,?)',input.jobId,encoded);
  const ranges=evidence.flatMap(record=>memoryRangeChunks(record.ocrText,{offset:0,length:record.ocrText.length},settings.lifecycle.batchCharacters,Boolean(input.strategy?.workContract)).map(range=>({id:record.id,...range}))),groups:typeof ranges[]=[];let group:typeof ranges=[],characters=0;
  for(const range of ranges){if(group.length&&characters+range.length>settings.lifecycle.batchCharacters){groups.push(group);group=[];characters=0;}group.push(range);characters+=range.length;}if(group.length)groups.push(group);
  if(input.phase==='integrate'&&groups.length>1)groups.splice(0,groups.length,ranges);
  const tasks:Record<string,string>=prior?JSON.parse(String(prior.tasks)):{};
  for(const [index,part] of (input.phase==='extract'?recipeBindings: [undefined]).flatMap(strategy=>groups.map(ranges=>({strategy,ranges}))).entries()){
   const {strategy,ranges}=part,batchId=memoryUUID([input.jobId,index,ranges,strategy]),batch=scopedMemoryTaskSchema.parse({...input,...(strategy?{strategy}:{}),batchId,ranges}),encoded=JSON.stringify(batch);
   data.sql.run('INSERT OR IGNORE INTO mm_job_batches(user_id,job_id,id,input) VALUES($user,?,?,?)',input.jobId,batchId,encoded);
   for(const stage of ['extract','review','publish'] as const){const key=groups.length* Math.max(recipeBindings.length,1)===1?stage:stage+':'+index,previous=stage==='extract'?undefined:groups.length* Math.max(recipeBindings.length,1)===1?stage==='review'?'extract':'review':(stage==='review'?'extract:':'review:')+index,dependencies=previous?[tasks[previous]]:[],task=await this.execution.forUser(context).submit({kind:'memory.'+stage,operationId:'memory:'+input.jobId+':'+batchId,input:batch,dependencies});tasks[key]=task.id;data.sql.run('UPDATE mm_jobs SET tasks=? WHERE user_id=$user AND id=?',JSON.stringify(tasks),input.jobId);}
   data.sql.run("UPDATE mm_job_batches SET state='ready',tasks=? WHERE user_id=$user AND job_id=? AND id=?",JSON.stringify(Object.fromEntries(['extract','review','publish'].map(stage=>[stage,tasks[groups.length* Math.max(recipeBindings.length,1)===1?stage:stage+':'+index]]))),input.jobId,batchId);
  }
  data.sql.run("UPDATE mm_jobs SET state='ready' WHERE user_id=$user AND id=?",input.jobId);return this.job(context,input.jobId);
 }

 private job(context:UserContext,id:string){const data=this.data(context),row=data.sql.get('SELECT state,tasks,input FROM mm_jobs WHERE user_id=$user AND id=?',id);if(!row)throw missing();let current=true;try{data.assertInputs(scopedMemoryTaskSchema.parse(JSON.parse(String(row.input))));}catch{current=false;}
  const batches=data.sql.all('SELECT id,state,review FROM mm_job_batches WHERE user_id=$user AND job_id=? ORDER BY id',id).map(batch=>({id:batch.id,state:batch.state,...(current&&batch.review?{coverage:JSON.parse(String(batch.review)).coverage}:{})}));
  return {id,state:row.state,current,batches,tasks:Object.fromEntries(Object.entries(JSON.parse(String(row.tasks))).map(([stage,id])=>[stage,this.execution.forUser(context).get(String(id))]))};}

 forUser(context:UserContext){this.data(context).state();return Object.freeze({
  view:()=>{const data=this.data(context),state=data.state();return {revision:state.revision,generation:state.generation,desired:Boolean(state.desired),binding:data.binding(),settings:JSON.parse(state.settings),pendingExternal:Number(data.sql.get("SELECT count(*) n FROM mm_provider_journal WHERE user_id=$user AND state IN ('submitted','erase_submitted','erase_pending')")!.n)};},
  submit:(raw:unknown)=>{const request=submitSchema.parse(raw),id=request.operationId,key=context.userId+':'+id,fingerprint=memoryHash(request),pending=this.admissions.get(key);if(pending){if(pending.fingerprint!==fingerprint)throw new PrivateDataError('conflict',409);return pending.promise;}const task=this.admit(context,request),entry={fingerprint,promise:task};this.admissions.set(key,entry);void task.finally(()=>{if(this.admissions.get(key)===entry)this.admissions.delete(key);}).catch(()=>{});return task;},
  job:(id:string)=>this.job(context,id),
  read:(id:string)=>this.read(context,id),
  readVersion:(id:string,version:number)=>this.readVersion(context,id,version),
  reconcile:()=>this.scheduleReconcile(context),
  page:(raw:unknown)=>this.page(context,raw),
  control:(kind:'pause'|'resume'|'stop',raw:unknown)=>{const data=this.data(context),state=data.control(kind,raw);if(kind==='stop')for(const row of data.sql.all("SELECT id,tasks FROM mm_jobs WHERE user_id=$user AND json_extract(input,'$.automatic')=1 AND state IN ('ready','admitting')")){queueMemoryErases(data.sql,{jobId:String(row.id)});queueNativeCleanup(data.sql,String(row.id));data.sql.run("UPDATE mm_jobs SET state='cancelled',draft=NULL,review=NULL,prepared=NULL WHERE user_id=$user AND id=?",row.id);for(const id of Object.values(JSON.parse(String(row.tasks))))this.execution.forUser(context).cancel(String(id));}return {revision:state.revision,generation:state.generation,desired:Boolean(state.desired)};},
  cancel:async(id:string)=>{const data=this.data(context);const result=data.sql.transaction(()=>{const job=this.job(context,id);data.sql.run("UPDATE mm_jobs SET state='cancelled',draft=NULL,review=NULL,prepared=NULL WHERE user_id=$user AND id=?",id);data.sql.run("UPDATE mm_job_batches SET state='cancelled',draft=NULL,review=NULL,prepared=NULL WHERE user_id=$user AND job_id=?",id);queueMemoryErases(data.sql,{jobId:id});queueNativeCleanup(data.sql,id);for(const task of Object.values(job.tasks))this.execution.forUser(context).cancel(task.id);return {cancelled:true};});await this.scheduleReconcile(context);return result;},
  delete:async(id:string)=>{const data=this.data(context),result=data.sql.transaction(()=>{const value=data.delete(id);queueMemoryErases(data.sql,{memoryId:id});return value;});const cleanup=await this.scheduleReconcile(context);return {...result,cleanupTaskId:cleanup.id};},
 });}
 private lifecycle():DomainLifecycle{return {
  exportUser:async subject=>{this.runtime.services.assertSubject(subject,MEMORY_DOMAIN,'export');const sql=this.lifecycleSql(subject,'export'),records:Memory[]=[];for(const row of sql.all('SELECT * FROM mm_records WHERE user_id=$user ORDER BY id')){const host=memorySchema.parse(JSON.parse(String(row.json))),binding=JSON.parse(String(row.binding)) as ScopedMemoryBinding;if(binding.kind==='builtin'){records.push(host);continue;}const provider=await this.providers.maintenance(subject,binding,'export');try{const value=await provider.read({namespace:{ownerId:subject.userId,instanceId:binding.instanceId,bindingRevision:binding.revision},key:memoryProviderKey(host)});if(!value||memoryBodyDigest(value)!==row.body_digest)throw new ScopedMemoryError('memory_provider_unavailable');records.push(withMemoryHostState(value,host));}finally{await provider.close();}}return {domain:MEMORY_DOMAIN,version:1,deploymentId:subject.deploymentId,userId:subject.userId,payload:{format:'mote-scoped-memory-v1',coverage:{records:true,policy:true,activeAuthority:false,excluded:['model-snapshots','execution-checkpoints','plugin-runtime-files']},state:sql.get('SELECT settings,binding FROM mm_state WHERE user_id=$user'),records,evidence:sql.all('SELECT * FROM mm_evidence WHERE user_id=$user ORDER BY id'),deletions:sql.all('SELECT id,json FROM mm_deletions WHERE user_id=$user ORDER BY id')}};},
  deleteUser:async(subject,operationId)=>{const sql=this.lifecycleSql(subject,'delete');sql.transaction(()=>{sql.run('INSERT INTO mm_state VALUES($user,1,1,1,0,?,?) ON CONFLICT(user_id) DO UPDATE SET deleted=1,generation=generation+1,desired=0,settings=excluded.settings',JSON.stringify(defaultMemorySettings()),JSON.stringify({kind:'builtin',revision:1}));sql.run("UPDATE mm_jobs SET state='deleted',draft=NULL,review=NULL,prepared=NULL WHERE user_id=$user");sql.run("UPDATE mm_job_batches SET state='deleted',draft=NULL,review=NULL,prepared=NULL WHERE user_id=$user");queueMemoryErases(sql);queueNativeCleanup(sql);sql.run("UPDATE mm_intakes SET revoked=1,json='{}' WHERE user_id=$user");sql.run("UPDATE mm_binding_preparations SET json=json_remove(json,'$.records') WHERE user_id=$user");sql.run('DELETE FROM mm_records WHERE user_id=$user');sql.run('DELETE FROM mm_evidence WHERE user_id=$user');sql.run('DELETE FROM mm_deletions WHERE user_id=$user');sql.run('DELETE FROM mm_commands WHERE user_id=$user');sql.run('DELETE FROM mm_restore WHERE user_id=$user');});const reconciled=await reconcileMemory(sql,this.providers,subject);return {status:reconciled.status,operationId};},
  restoreUser:async(subject,archive,operationId)=>{
   const sql=this.lifecycleSql(subject,'restore');if(archive.domain!==MEMORY_DOMAIN||archive.version!==1||archive.userId!==subject.userId||archive.deploymentId!==subject.deploymentId)throw new PrivateDataError('invalid_data');
   const payload=z.object({format:z.literal('mote-scoped-memory-v1'),coverage:z.object({records:z.literal(true),policy:z.literal(true),activeAuthority:z.literal(false),excluded:z.tuple([z.literal('model-snapshots'),z.literal('execution-checkpoints'),z.literal('plugin-runtime-files')])}).strict(),state:z.object({settings:z.string(),binding:z.string()}).optional(),records:z.array(memorySchema),evidence:z.array(z.object({user_id:z.string(),id:z.string().uuid(),material_id:z.string(),material_revision:z.string(),block_id:z.string(),hash:z.string(),json:z.string()}).strict()),deletions:z.array(z.object({id:z.string().uuid(),json:z.string()}).strict())}).strict().parse(archive.payload),fingerprint=memoryHash(payload);
   const data=new ScopedMemoryData(sql,new PrivateData(sql,new PrivateCursor(this.cursorKey,subject.deploymentId,subject.userId)),new PrivateCursor(this.cursorKey,subject.deploymentId,subject.userId));
   sql.transaction(()=>{
    const prior=sql.get('SELECT fingerprint FROM mm_restore WHERE user_id=$user AND id=?',operationId);if(prior){if(prior.fingerprint!==fingerprint)throw new PrivateDataError('conflict',409);return;}
    const state=sql.get('SELECT * FROM mm_state WHERE user_id=$user') as MemoryState|undefined;if(state?.deleted)throw new PrivateDataError('scope_unavailable',503);
    const settings=memorySettingsSchema.parse(JSON.parse(payload.state?.settings??JSON.stringify(defaultMemorySettings())));
    if(!state)sql.run('INSERT INTO mm_state VALUES($user,0,0,1,0,?,?)',JSON.stringify(settings),JSON.stringify({kind:'builtin',revision:1}));
    for(const evidence of payload.evidence){if(evidence.user_id!==subject.userId)throw new PrivateDataError('invalid_data');const actual=data.materialEvidence(evidence.material_id,evidence.material_revision).find(record=>record.id===evidence.id);if(!actual||JSON.stringify(actual)!==evidence.json||memoryHashEvidence(actual)!==evidence.hash)throw new PrivateDataError('invalid_data');}
    for(const memory of payload.records){
     if(memory.evidenceIds.some(id=>!payload.evidence.some(row=>row.id===id)))throw new PrivateDataError('invalid_data');data.evidence(memory.evidenceIds);
     const value=memorySchema.parse({...memory,status:'stale',staleReason:'restored_archive'}),existing=sql.get('SELECT json FROM mm_records WHERE user_id=$user AND id=?',memory.id);if(existing&&String(existing.json)!==JSON.stringify(value))throw new PrivateDataError('conflict',409);
     sql.run('INSERT OR IGNORE INTO mm_records VALUES($user,?,?,?,?,?,?,?)',value.id,value.version,value.fingerprint,memoryBodyDigest(value),JSON.stringify({kind:'builtin',revision:1}),JSON.stringify(value),value.createdAt);
     sql.run('INSERT OR IGNORE INTO mm_versions VALUES($user,?,?,?,?)',value.id,value.version,value.fingerprint,JSON.stringify(value));for(const id of value.evidenceIds)sql.run('INSERT OR IGNORE INTO mm_dependencies VALUES($user,?,?,?)',value.id,id,memoryHashEvidence(data.evidence([id])[0]));
    }
    for(const deletion of payload.deletions){const value=JSON.parse(deletion.json);if(value.memoryId!==deletion.id||!Array.isArray(value.dependencies)||value.dependencies.some((id:string)=>!payload.evidence.some(row=>row.id===id)))throw new PrivateDataError('invalid_data');sql.run('INSERT OR IGNORE INTO mm_deletions VALUES($user,?,?)',deletion.id,deletion.json);}
    sql.run('INSERT INTO mm_restore VALUES($user,?,?)',operationId,fingerprint);
   });
  },
 };}
 private lifecycleSql(subject:UserDataSubject,purpose:'export'|'delete'|'restore'){return new PrivateSql(this.db,subject.userId,()=>this.runtime.services.assertSubject(subject,MEMORY_DOMAIN,purpose));}
 async close(){if(this.closed)return;this.closed=true;for(const dispose of this.disposers.reverse())await dispose();await this.intake.close();await this.bindings.close();await this.providers.close();}
}
import {memoryEvidenceFingerprint as memoryHashEvidence} from '../memory-contract.js';
