import {randomUUID,createHash} from 'node:crypto';
import {join,dirname} from 'node:path';
import {readFileSync,writeFileSync,realpathSync} from 'node:fs';
import {privateDirectory,privateFile} from '../private-storage.js';
import type {ImportPythonPackConfig} from '../config.js';
import {PythonSourcePackExecutor,pythonImportOutputSchema} from '../python-source-pack-executor.js';
import type {DatabaseSync} from 'node:sqlite';
import {z} from 'zod';
import {importRequestSchema,FILE_PART_BYTES,type ImportJob} from '@mote/shared';
import {validBase64} from '../base64.js';
import {formatWork} from '../format-work.js';
import {importRecordSchema} from '../import-record.js';
import {importReviewGate} from '../import-review.js';
import {EXECUTION_POLICIES} from '../execution-policy.js';
import {ExecutionFailure} from '../execution-engine.js';
import {PrivateSql,PrivateDataError,missing} from './private-data-sql.js';
import type {ScopedRuntime} from './http.js';
import type {UserContext} from './context.js';
import type {IngressHost} from './ingress.js';
import {TaskError,type TaskExecution,type TaskRun} from './task-execution.js';
import type {PrivateData} from './private-data.js';
import type {ImportIntakeRegistry} from '../import-intake.js';
import {ScopedImportAttribution} from './import-attribution.js';
import {mapImportPreview} from './processing-import-map.js';
import {identityHash} from './originals.js';
import {projectImportProgress} from './processing-import-progress.js';
import type {MemoryHost} from './memory.js';
import {archiveRelativePath,MAX_FILE_BYTES} from '../archive-contract.js';
import {hostImportDirectory,readImportParts,ImportInputError} from '../import-host-directory.js';

const taskInput=z.object({jobId:z.string().uuid(),generation:z.number().int().nonnegative(),phase:z.enum(['prepare','commit']),manifest:z.string().regex(/^[a-f0-9]{64}$/).optional()}).strict();
type Input=z.infer<typeof taskInput>;
type Job=ImportJob&{processing:'automatic'|'preview';generation:number;authorizationEpoch:number;manifest?:string;confirmed?:string;prepareTask?:string;commitTask?:string;recordsProcessed:number;sourceFileIds?:string[];excludedFiles?:{fileId:string;reason:string}[];sourcePackRevision?:string;containers?:Record<string,{id:string;version:string;expanded:boolean}>};
const conflict=()=>new PrivateDataError('conflict',409),stamp=()=>new Date().toISOString();
const publicJob=({processing,generation,authorizationEpoch,manifest,confirmed,prepareTask,commitTask,recordsProcessed,sourcePackRevision,excludedFiles,sourceFileIds,containers,...job}:Job):ImportJob=>job;
const plain=(name:string)=>/\.(txt|md|markdown|csv|tsv|json|jsonl|ndjson|yaml|yml|log|ics|pdf|docx|xlsx)$/i.test(name);

/** M06 import phases use the existing shared M05 executor and M03 workspace.
 * Original bytes stay in M03; only the immutable preview/receipts live here.
 * This module constructs neither a Store, processor registry nor executor. */
export function processingImports(runtime:ScopedRuntime,db:DatabaseSync,ingress:IngressHost,execution:TaskExecution,intake:ImportIntakeRegistry,publishParsed:(context:UserContext,ref:string,operationId:string)=>unknown,sourcePackSpecs:readonly ImportPythonPackConfig[]=[],readProcessing:(context:UserContext,ref:string)=>{indexed:boolean;current:boolean}=()=>({indexed:false,current:false})){
 const sourcePacks=new Map(sourcePackSpecs.map(spec=>[spec.id,{spec,revision:identityHash(spec),executor:new PythonSourcePackExecutor({...spec,outputSchema:pythonImportOutputSchema})}]));
 let closed=false;const active=new Set<string>();const unregister:(()=>Promise<void>)[]=[];
 const sqlFor=(context:UserContext)=>{const assert=()=>{if(closed)throw new ExecutionFailure('stale','import_host_closed');runtime.authority.assert(context);},sql=new PrivateSql(db,context.userId,assert);if(sql.get('SELECT deleted FROM mp_state WHERE user_id=$user')?.deleted)throw conflict();return sql;};
 const load=(sql:PrivateSql,id:string):Job=>{z.string().uuid().parse(id);const row=sql.get('SELECT json FROM mp_import_jobs WHERE user_id=$user AND id=?',id);if(!row)throw missing();return JSON.parse(String(row.json));};
 const save=(sql:PrivateSql,job:Job)=>{job.updatedAt=stamp();sql.run('UPDATE mp_import_jobs SET json=? WHERE user_id=$user AND id=?',JSON.stringify(job),job.id);};
 const bound=(context:UserContext,input:Input)=>{const sql=sqlFor(context),job=load(sql,input.jobId);if(job.generation!==input.generation||job.authorizationEpoch!==context.authorizationEpoch||(input.phase==='prepare'?!['queued','preparing'].includes(job.status):job.status!=='importing'||!job.manifest||job.manifest!==input.manifest||job.confirmed!==input.manifest))throw conflict();return {sql,job};};
 const owner=(context:UserContext)=>{runtime.authority.assert(context);if(runtime.authority.isTask(context))throw conflict();};
 // Fixed packs own the mapping of every supplied original, including containers and media.
 const contentFiles=(job:Job)=>job.sourcePackId?job.files:job.files.filter(file=>!job.containers?.[file.id]&&!job.media?.some(item=>item.fileId===file.id)&&!job.excludedFiles?.some(item=>item.fileId===file.id));
 const deterministic=(job:Job)=>Object.values(job.containers??{}).some(pin=>!pin.expanded)||!contentFiles(job).length||!!job.sourcePackId||job.processing==='automatic'&&!job.instruction.trim()&&!job.sourcePackId&&contentFiles(job).every(file=>plain(file.name));
 const submit=(context:UserContext,job:Job,phase:Input['phase'])=>{
  const sql=sqlFor(context),input:Input={jobId:job.id,generation:job.generation,phase,...(phase==='commit'?{manifest:job.manifest}:{})};bound(context,input);
  const value=execution.forUser(context).submitSync({kind:'processing.import-'+phase,operationId:'import:'+job.id+':'+job.generation+':'+phase,input});
  if(phase==='prepare')job.prepareTask=value.id;else job.commitTask=value.id;save(sql,job);return value;
 };
 const submitPrepare=async(context:UserContext,job:Job)=>{
  const sql=sqlFor(context),input:Input={jobId:job.id,generation:job.generation,phase:'prepare'};bound(context,input);
  try{
   const value=await execution.forUser(context).submit({kind:deterministic(job)?'processing.import-decode':'processing.import-prepare',operationId:'import:'+job.id+':'+job.generation+':prepare',input});
   bound(context,input);job.prepareTask=value.id;save(sql,job);
  }catch(error){bound(context,input);job.status='needs_configuration';job.processingStatus='blocked';job.error=error instanceof ExecutionFailure?error.code:'import_model_unavailable';save(sql,job);}
 };
 const updateFromTask=(context:UserContext,job:Job)=>{
  const sql=sqlFor(context),id=job.status==='importing'?job.commitTask:job.prepareTask;if(!id||['completed','awaiting_confirmation','cancelled'].includes(job.status))return job;
  const state=execution.forUser(context).get(id);if(['failed','blocked','stale','cancelled'].includes(state.state)){job.status=state.state==='cancelled'?'cancelled':state.state==='blocked'?'needs_configuration':'failed';job.processingStatus='blocked';job.error=state.failure?.code??'import_interrupted';save(sql,job);}return job;
 };
 const prepare=async(run:TaskRun)=>{
  const input=taskInput.parse(run.task.input),{sql,job}=bound(run.context,input),originals=ingress.forUser(run.context);
  run.grant.commit(()=>{job.status='preparing';job.processingStatus='analyzing';save(sql,job);sql.run('DELETE FROM mp_import_records WHERE user_id=$user AND job_id=?',job.id);});
  return originals.withWorkspace(workspace=>workspace.withDirectory(async rootPath=>{
   const root=realpathSync(rootPath);
   // Use the existing pinned, bounded container worker; expanded originals stay
   // in M03, never in the preview DB or an unrestricted host path.
   for(const [fileId,pin] of Object.entries(job.containers??{})){
    if(pin.expanded)continue;run.grant.assert();bound(run.context,input);
    const file=job.files.find(file=>file.id===fileId)!,bytes=originals.archivedBytes(fileId),container=intake.container({file,prefix:bytes.subarray(0,4096)});
    if(!container||container.id!==pin.id||container.version!==pin.version)throw new ExecutionFailure('blocked','import_container_changed');
    const path=join(root,'containers',file.relativePath);privateDirectory(dirname(path));privateFile(path,true);writeFileSync(path,bytes,{mode:0o600});
    const prefix=file.relativePath+'.contents/',others=job.files.filter(file=>!job.containers?.[file.id]&&!file.relativePath.startsWith(prefix)),maxBytes=512*1024*1024-others.reduce((size,file)=>size+file.sizeBytes,0),maxFiles=4000-Object.keys(job.containers??{}).length-others.length;
    const expanded=await container.expand({path,output:join(root,'expanded',randomUUID()),maxBytes,maxFiles,signal:run.signal});run.grant.assert();bound(run.context,input);
    if(expanded.files.length>maxFiles||expanded.files.some(file=>!Number.isSafeInteger(file.bytes)||file.bytes<0||file.bytes>MAX_FILE_BYTES)||expanded.files.reduce((size,file)=>size+file.bytes,0)>maxBytes)throw new PrivateDataError('invalid_data',413);
    for(const child of expanded.files){
     run.signal.throwIfAborted();run.grant.assert();bound(run.context,input);const name=archiveRelativePath(prefix+child.name),bytes=readFileSync(child.path);if(bytes.length!==child.bytes)throw conflict();
     const retained=await ingress.retainArchive(run.context,name,bytes,child.mimeType,run.signal);run.grant.assert();bound(run.context,input);
     run.grant.commit(()=>{const prior=job.files.find(file=>file.relativePath===name);if(prior&&(prior.id!==retained.id||prior.hash!==retained.hash))throw conflict();if(!prior){job.files.push(retained);job.archive.files++;job.archive.bytes+=retained.sizeBytes;job.archive.expandedFiles++;sql.run('INSERT INTO mp_import_files VALUES($user,?,?)',job.id,retained.id);const format=job.sourcePackId?undefined:intake.format({file:retained,prefix:bytes.subarray(0,4096)});if(format?.excluded)(job.excludedFiles??=[]).push({fileId:retained.id,reason:format.reason});else if(format)(job.media??=[]).push({fileId:retained.id,format});}save(sql,job);});
    }
    run.grant.commit(()=>{pin.expanded=true;save(sql,job);});
   }
   if(!deterministic(job)&&!run.model){await submitPrepare(run.context,job);return {jobId:job.id,generation:job.generation,delegatedToModel:true};}
   const inputs=contentFiles(job).map(file=>{const path=join(root,'inputs',file.relativePath);privateDirectory(dirname(path));privateFile(path,true);writeFileSync(path,originals.archivedBytes(file.id),{mode:0o600});return {file,path};}),manifest=join(root,'prepared.jsonl');
   const readRecords=(path:string)=>readFileSync(path,'utf8').split('\n').filter(Boolean).map(line=>{const value=importRecordSchema.parse(JSON.parse(line)),lookup=(path:string)=>{const file=inputs.find(input=>input.path===path)?.file;if(!file)throw conflict();return file.id;};return {...value,evidencePaths:value.evidencePaths.map(lookup),attachments:value.attachments.map(lookup)};});
   let records:ReturnType<typeof readRecords>,summary='Original text decoded locally; attribution and event dates remain uninterpreted.',warnings:string[]=[],decision:ImportJob['reviewDecision'],dispositions:{fileId:string;status:'parsed'|'attachment'|'container'|'excluded'|'unsupported';reason:string}[]|undefined,partial=false;
   if(job.sourcePackId&&inputs.length){
    const pack=sourcePacks.get(job.sourcePackId);if(!pack||pack.revision!==job.sourcePackRevision)throw new ExecutionFailure('blocked','import_source_pack_changed');
    const result=await pack.executor.run({workspace:root,inputPaths:inputs.map(input=>input.path),signal:run.signal});run.grant.assert();bound(run.context,input);if(result.status!=='succeeded')throw new ExecutionFailure(result.status==='blocked'?'blocked':'permanent','python_pack_'+result.code);
    const lookup=(index:number)=>{if(!inputs[index])throw new ExecutionFailure('permanent','python_pack_invalid_output');return inputs[index].file.id;};records=result.output.records.map(record=>({item:record.item,evidencePaths:record.evidenceIndexes.map(lookup),attachments:record.attachmentIndexes.map(lookup)}));summary=result.output.summary;warnings=result.output.warnings;decision=result.output.reviewDecision;dispositions=result.output.dispositions?.map(item=>({fileId:lookup(item.index),status:item.status,reason:item.reason}));
   }else{
    privateFile(manifest,true);const decoded=await formatWork({kind:'plain',inputs,createdAt:job.createdAt,manifest},run.signal);run.grant.assert();bound(run.context,input);partial=decoded.partial;
    const bytes=readFileSync(manifest);if(bytes.length>32*1024*1024||createHash('sha256').update(bytes).digest('hex')!==decoded.hash)throw conflict();records=readRecords(manifest);if(records.length!==decoded.count)throw conflict();warnings=decoded.warnings;
    if(deterministic(job)){decision={confidence:partial?'low':'high',ambiguous:false,reason:partial?'Decoding reported incomplete coverage.':'Deterministic document decoding preserved original text without inferred attribution or dates.'};dispositions=inputs.map(({file})=>({fileId:file.id,status:'parsed',reason:'Deterministic document decoding preserved original text.'}));}
    // The host accounts for containers, metadata and media independently. A
    // text mapper may describe only the originals its reader actually exposes.
    else{const mapped=await mapImportPreview(run,{...job,files:inputs.map(input=>input.file)},records,root,()=>{run.grant.assert();bound(run.context,input);});records=mapped.records;summary=mapped.summary;warnings=[...warnings,...mapped.warnings].slice(0,200);decision=mapped.reviewDecision;dispositions=mapped.dispositions;}
   }
   const lookup=(id:string)=>{const path=inputs.find(input=>input.file.id===id)?.path;if(!path)throw conflict();return path;};
   privateFile(manifest,true);writeFileSync(manifest,records.map(record=>JSON.stringify({...record,evidencePaths:record.evidencePaths.map(lookup),attachments:record.attachments.map(lookup)})+'\n').join(''),{mode:0o600});
   if(dispositions){const path=join(root,'dispositions.json');privateFile(path,true);writeFileSync(path,JSON.stringify({items:dispositions.map(item=>({path:lookup(item.fileId),status:item.status,reason:item.reason}))}),{mode:0o600});}
   const validated=join(root,'validated.jsonl'),checked=await formatWork({kind:'manifest',workspace:root,path:manifest,output:validated,inputs,dispositions:true},run.signal);run.grant.assert();bound(run.context,input);records=readRecords(validated);
   run.grant.commit(()=>{
    bound(run.context,input);for(const [position,record] of records.entries())sql.run('INSERT INTO mp_import_records VALUES($user,?,?,?,?)',job.id,job.generation,position,JSON.stringify(record));
    job.manifest=identityHash(records);job.preview={count:checked.count+(job.media?.length??0),samples:checked.samples};job.progress.total=job.preview.count;job.summary=summary;job.warnings=[...warnings,...checked.warnings].slice(0,200);job.dispositions=checked.dispositions;const extra=[...(job.media??[]).map(item=>({fileId:item.fileId,path:job.files.find(file=>file.id===item.fileId)!.relativePath,status:'processing' as const,reason:item.format.reason})),...(!job.sourcePackId?Object.keys(job.containers??{}):[]).map(fileId=>({fileId,path:job.files.find(file=>file.id===fileId)!.relativePath,status:'container' as const,reason:'Container original retained; members accounted separately'})),...(job.excludedFiles??[]).map(item=>({fileId:item.fileId,path:job.files.find(file=>file.id===item.fileId)!.relativePath,status:'excluded' as const,reason:item.reason}))];if(extra.length){const base=job.dispositions??{counts:{parsed:0,attachment:0,container:0,excluded:0,unsupported:0},items:[]};job.dispositions={counts:{...base.counts,processing:job.media?.length??0,container:Object.keys(job.containers??{}).length,excluded:base.counts.excluded+(job.excludedFiles?.length??0)},items:[...base.items,...extra]};}job.reviewDecision=decision;job.reviewGate=importReviewGate(job,decision,deterministic(job)&&!job.sourcePackId&&!partial);job.status='awaiting_confirmation';job.processingStatus='preview_ready';save(sql,job);
    if(job.reviewGate.decision==='automatic'){job.confirmed=job.manifest;job.status='importing';job.processingStatus='saving';save(sql,job);submit(run.context,job,'commit');}
   });return {jobId:job.id,generation:job.generation,manifest:job.manifest};
  }));
 };
 const commit=async(run:TaskRun)=>{
  const input=taskInput.parse(run.task.input),{sql,job}=bound(run.context,input),originals=ingress.forUser(run.context),rows=sql.all('SELECT position,json FROM mp_import_records WHERE user_id=$user AND job_id=? AND generation=? ORDER BY position',job.id,job.generation),records=rows.map(row=>JSON.parse(String(row.json)));
  if(job.imageProfileId&&job.media?.some(item=>item.format.mimeType.startsWith('image/')))await ingress.prepareFileProfile(run.context,job.imageProfileId);
  if(identityHash(records)!==job.manifest||records.length+(job.media?.length??0)!==job.progress.total)throw conflict();
  const declaration=run.grant.commit(()=>{bound(run.context,input);originals.registerSource({id:job.sourceId,name:job.name,kind:'upload',deviceId:'mote-import',platform:'import',retention:'archive',enabled:true});return new ScopedImportAttribution(sql).freeze(job.sourceId,{id:job.id,version:job.generation+1,instruction:job.instruction});});
  for(const media of job.media??[]){
   if(media.captureId)continue;run.signal.throwIfAborted();run.grant.assert();bound(run.context,input);if(!intake.available(media.format))throw new ExecutionFailure('blocked','import_media_intake_changed');
   const file=originals.archivedFile(media.fileId),bytes=originals.archivedBytes(file.id),revision=createHash('sha256').update(JSON.stringify([file.hash,media.format.mimeType])).digest('hex');
   const receipt=run.grant.commit(()=>{bound(run.context,input);const receipt=originals.receiveSourceItemsWithOriginals(job.sourceId,'import-media:'+job.id+':'+job.generation+':'+file.id,[{externalId:'file:'+file.relativePath,revision,observedAt:job.createdAt,title:file.name,text:'',kind:'file',layer:'original',mimeType:media.format.mimeType,document:{fileId:file.id,path:file.relativePath,contentRole:'other',timeBasis:'unknown'}}],[{bytes,mime:media.format.mimeType,format:'file',...(media.format.mimeType.startsWith('image/')&&job.imageProfileId?{processingProfileId:job.imageProfileId}:{})}]),ack=receipt.captures[0];
    originals.attachArchivedFiles(ack.id,[file.id]);media.captureId=ack.id;if(ack.duplicate)job.progress.duplicates++;else{new ScopedImportAttribution(sql).bind(ack.id,declaration);job.progress.imported++;job.captureIds.push(ack.id);}job.progress.processed++;if(!ack.duplicate)for(const item of receipt.captures)if(item.original)publishParsed(run.context,item.original.ref,'import:'+job.id+':'+job.generation+':'+item.id);save(sql,job);return receipt;
   });
  }
  for(let index=job.recordsProcessed;index<records.length;index++){
   run.signal.throwIfAborted();run.grant.assert();bound(run.context,input);const record=importRecordSchema.parse(records[index]);
   const receipt=run.grant.commit(()=>{
    bound(run.context,input);const receipt=originals.receiveSourceItems(job.sourceId,'import:'+job.id+':'+job.generation+':'+index,[record.item]),ack=receipt.captures[0];
    for(const fileId of [...record.evidencePaths,...record.attachments]){if(!job.files.some(file=>file.id===fileId))throw conflict();}
    originals.attachArchivedFiles(ack.id,[...new Set([...record.evidencePaths,...record.attachments])]);
    if(ack.duplicate)job.progress.duplicates++;else{new ScopedImportAttribution(sql).bind(ack.id,declaration);job.progress.imported++;job.captureIds.push(ack.id);}
    job.recordsProcessed=index+1;job.progress.processed=index+1+(job.media?.filter(item=>item.captureId).length??0);if(!ack.duplicate)for(const item of receipt.captures)if(item.original)publishParsed(run.context,item.original.ref,'import:'+job.id+':'+job.generation+':'+item.id);save(sql,job);return receipt;
   });
  }
  run.grant.commit(()=>{bound(run.context,input);job.status='completed';job.processingStatus='saved';save(sql,job);});return {jobId:job.id,generation:job.generation,manifest:job.manifest};
 };
 for(const registration of [{kind:'processing.import-decode',phase:'prepare',model:false},{kind:'processing.import-prepare',phase:'prepare',model:true},{kind:'processing.import-commit',phase:'commit',model:false}] as const){const {kind,phase,model}=registration;unregister.push(execution.register({kind,pool:'processing.imports',concurrency:()=>1,policy:model?EXECUTION_POLICIES.modelCall:EXECUTION_POLICIES.deterministic,...(model?{modelFeature:'import' as const}:{}),parseInput:value=>taskInput.parse(value),authorizeInput:(context,value)=>{const input=taskInput.parse(value);if(input.phase!==phase)throw conflict();const {job}=bound(context,input);if(phase==='prepare'&&model===deterministic(job))throw conflict();},resources:input=>[{scope:'user',key:'import:'+input.jobId}],execute:run=>{const perform=async()=>{const key=identityHash([run.context.userId,run.task.input.jobId]);active.add(key);try{return await(phase==='prepare'?prepare:commit)(run);}finally{active.delete(key);}};return phase==='prepare'?run.localWork(perform):perform();},classify:error=>error instanceof ExecutionFailure?error:new ExecutionFailure(error instanceof PrivateDataError?'stale':'permanent','import_failed')}));}
 const prepareFresh=async(context:UserContext,id:string,raw:unknown={})=>{
  const sql=sqlFor(context),job=sql.transaction(()=>{
   owner(context);const job=load(sql,id),patch=z.object({instruction:z.string().max(12000).optional()}).strict().parse(raw),restored=job.authorizationEpoch!==context.authorizationEpoch;
   if(active.has(identityHash([context.userId,id]))||job.progress.processed>0&&!restored||job.status==='completed')throw conflict();
   for(const taskId of [job.prepareTask,job.commitTask])if(taskId){const state=execution.forUser(context).get(taskId).state;if(['waiting','running'].includes(state))throw conflict();if(state==='blocked')execution.forUser(context).cancel(taskId);}
   job.generation++;job.authorizationEpoch=context.authorizationEpoch;if(patch.instruction!==undefined)job.instruction=patch.instruction;
   delete job.manifest;delete job.confirmed;delete job.commitTask;delete job.prepareTask;delete job.preview;delete job.dispositions;delete job.reviewDecision;delete job.reviewGate;delete job.error;
   if(restored){job.progress={total:0,processed:0,imported:0,duplicates:0};job.recordsProcessed=0;job.media=job.media?.map(({captureId,processing,searchable,memory,...item})=>item);}
   job.status='queued';job.processingStatus='archived';job.progress.total=0;save(sql,job);return job;
  });await submitPrepare(context,job);return publicJob(updateFromTask(context,load(sql,id)));
 };
 const forUser=(context:UserContext)=>{const sql=sqlFor(context),get=(id:string)=>{const job=publicJob(updateFromTask(context,load(sql,id)));return {...job,...projectImportProgress(sql,job,execution.forUser(context),runtime.services.forUser(context).get<ReturnType<MemoryHost['forUser']>>('memory'),ref=>readProcessing(context,ref))};};return Object.freeze({
  capabilities:()=>intake.list(),sourcePacks:()=>({items:sourcePackSpecs.map(({id,version,description})=>({id,version,...(description?{description}:{})}))}),get,list:()=>({items:sql.all('SELECT id FROM mp_import_jobs WHERE user_id=$user ORDER BY rowid DESC LIMIT 100').map(row=>get(String(row.id)))}),
  create:async(raw:unknown)=>{
   owner(context);const request=importRequestSchema.parse(raw);if(request.directory)runtime.authority.assertAdministrator(context);if(request.sourcePackId&&!sourcePacks.has(request.sourcePackId))throw new PrivateDataError('invalid_data',422);
   const fingerprint=identityHash(request),id=request.requestId??randomUUID(),existing=sql.get('SELECT fingerprint FROM mp_import_jobs WHERE user_id=$user AND id=?',id);if(existing){if(existing.fingerprint!==fingerprint)throw conflict();return get(id);}
   let archivedFileIds=request.archivedFileIds;
   if(request.files){const service=ingress.forUser(context);archivedFileIds=[];let total=0;
    for(const [index,file] of request.files.entries()){
     if(!validBase64(file.dataBase64))throw new PrivateDataError('invalid_data');const bytes=Buffer.from(file.dataBase64,'base64');if(bytes.toString('base64')!==file.dataBase64)throw new PrivateDataError('invalid_data');total+=bytes.length;if(bytes.length>MAX_FILE_BYTES||total>256*1024*1024)throw new PrivateDataError('invalid_data',413);
     const hash=identityHash(['inline-import',context.userId,id,index]),uploadId=hash.slice(0,8)+'-'+hash.slice(8,12)+'-5'+hash.slice(13,16)+'-a'+hash.slice(17,20)+'-'+hash.slice(20,32);service.beginImportUpload({id:uploadId,name:file.name,sizeBytes:bytes.length,...(file.mimeType?{mimeType:file.mimeType}:{})});for(let offset=0;offset<bytes.length;offset+=FILE_PART_BYTES)service.importUploadPart(uploadId,offset/FILE_PART_BYTES,bytes.subarray(offset,offset+FILE_PART_BYTES));archivedFileIds.push((await service.commitImportUpload(uploadId)).id);
    }
   }
   if(request.directory){
    // The SQLite connection is opened by the host from its admitted vault;
    // neither request JSON nor a staged job chooses the protected directory.
    const vault=db.location('main');if(!vault)throw new PrivateDataError('scope_unavailable',503);
    const assert=()=>{sqlFor(context);owner(context);runtime.authority.assertAdministrator(context);};
    const entries=await hostImportDirectory(request.directory,dirname(vault),assert).catch(error=>{if(error instanceof ImportInputError)throw new TaskError(error.code,error.statusCode);throw error;}),service=ingress.forUser(context);archivedFileIds=[];
    if(!entries.length)throw new PrivateDataError('invalid_data');
    for(const [index,file] of entries.entries()){
     assert();const hash=identityHash(['directory-import',context.userId,id,index]),uploadId=hash.slice(0,8)+'-'+hash.slice(8,12)+'-5'+hash.slice(13,16)+'-a'+hash.slice(17,20)+'-'+hash.slice(20,32);
     service.beginImportUpload({id:uploadId,name:file.name,sizeBytes:file.sizeBytes});let part=0;
     for(const bytes of readImportParts(file.path,file.identity,assert))service.importUploadPart(uploadId,part++,bytes);
     archivedFileIds.push((await service.commitImportUpload(uploadId)).id);assert();
    }
   }
   const job=sql.transaction(()=>{
   owner(context);const prior=sql.get('SELECT fingerprint FROM mp_import_jobs WHERE user_id=$user AND id=?',id);if(prior){if(prior.fingerprint!==fingerprint)throw conflict();return load(sql,id);}
   const files=archivedFileIds!.map(id=>ingress.forUser(context).archivedFile(id));if(new Set(files.map(file=>file.relativePath)).size!==files.length||files.reduce((size,file)=>size+file.sizeBytes,0)>256*1024*1024)throw new PrivateDataError('invalid_data',413);
   // Preserve the original source/dedup identity, independent of request ID.
   const sourceId='import.'+createHash('sha256').update(JSON.stringify(files.map(file=>[file.relativePath,file.hash]).sort())).digest('hex').slice(0,32),at=stamp();
   const job:Job={id,name:request.name??files[0].name,instruction:request.instruction,sourceId,...(request.sourcePackId?{sourcePackId:request.sourcePackId,sourcePackRevision:sourcePacks.get(request.sourcePackId)!.revision}:{}),...(request.imageProfileId?{imageProfileId:request.imageProfileId}:{}),processing:request.processing,generation:0,authorizationEpoch:context.authorizationEpoch,recordsProcessed:0,sourceFileIds:files.map(file=>file.id),status:'queued',processingStatus:'archived',createdAt:at,updatedAt:at,files,summary:'',warnings:[],archive:{files:files.length,bytes:files.reduce((n,f)=>n+f.sizeBytes,0),expandedFiles:0},progress:{total:0,processed:0,imported:0,duplicates:0},captureIds:[]};
   for(const file of files){const prefix=ingress.forUser(context).archivedBytes(file.id).subarray(0,4096),container=intake.container({file,prefix});if(container){(job.containers??={})[file.id]={id:container.id,version:container.version,expanded:false};continue;}const pin=job.sourcePackId?undefined:intake.format({file,prefix});if(pin?.excluded)(job.excludedFiles??=[]).push({fileId:file.id,reason:pin.reason});else if(pin)(job.media??=[]).push({fileId:file.id,format:pin});}
   sql.run('INSERT INTO mp_import_jobs VALUES($user,?,?,?)',id,fingerprint,JSON.stringify(job));for(const file of files)sql.run('INSERT INTO mp_import_files VALUES($user,?,?)',id,file.id);return job;
  });if(job.status==='queued'&&!job.prepareTask)await submitPrepare(context,job);return get(job.id);},
  confirm:(id:string)=>sql.transaction(()=>{owner(context);const job=load(sql,id);if(['completed','importing'].includes(job.status))return publicJob(job);if(job.status!=='awaiting_confirmation'||!job.manifest)throw conflict();job.confirmed=job.manifest;job.status='importing';job.processingStatus='saving';save(sql,job);submit(context,job,'commit');return publicJob(job);}),
  prepare:(id:string,raw:unknown={})=>prepareFresh(context,id,raw),
  retry:async(id:string)=>{owner(context);const current=load(sql,id);if(current.authorizationEpoch!==context.authorizationEpoch||!current.manifest||current.confirmed!==current.manifest)return prepareFresh(context,id);const job=sql.transaction(()=>{
   owner(context);const job=load(sql,id);if(active.has(identityHash([context.userId,id]))||job.status==='completed')throw conflict();
   const phase=job.manifest&&job.confirmed===job.manifest?'commit':'prepare',taskId=phase==='commit'?job.commitTask:job.prepareTask;
   if(taskId&&['waiting','running','succeeded'].includes(execution.forUser(context).get(taskId).state))throw conflict();
   if(job.authorizationEpoch!==context.authorizationEpoch)throw conflict();
   job.status=phase==='commit'?'importing':'queued';job.processingStatus=phase==='commit'?'saving':'archived';delete job.error;save(sql,job);
   if(taskId)execution.forUser(context).retry(taskId);else if(phase==='commit')submit(context,job,phase);return job;
  });if(!job.prepareTask&&job.status==='queued')await submitPrepare(context,job);return get(job.id);},
  delete:(id:string)=>{const deleted=sql.transaction(()=>{
   owner(context);const job=load(sql,id);if(active.has(identityHash([context.userId,id])))throw conflict();
   for(const taskId of [job.prepareTask,job.commitTask])if(taskId&&['waiting','running'].includes(execution.forUser(context).get(taskId).state))throw conflict();
   const retainedSharedSource=!!sql.get("SELECT id FROM mp_import_jobs WHERE user_id=$user AND id<>? AND json_extract(json,'$.sourceId')=? LIMIT 1",id,job.sourceId),captures=sql.all('SELECT id FROM pd_captures WHERE user_id=$user AND source_id=?',job.sourceId).length;
   if(!retainedSharedSource&&sql.get('SELECT id FROM pd_sources WHERE user_id=$user AND id=?',job.sourceId))runtime.services.forUser(context).get<PrivateData>('private-data').deleteSource(job.sourceId);
   sql.run('DELETE FROM mp_import_jobs WHERE user_id=$user AND id=?',id);const removed=ingress.forUser(context).removeArchivedFiles(job.files.map(file=>file.id));return {deleted:true,captures:retainedSharedSource?0:captures,retainedSharedSource,...removed};
  });if(db.isTransaction||deleted.garbagePending)return {...deleted,garbagePending:true};try{ingress.forUser(context).gc();return deleted;}catch{return {...deleted,garbagePending:true};}},
  cancel:(id:string)=>sql.transaction(()=>{owner(context);const job=load(sql,id);if(['completed','cancelled'].includes(job.status))return publicJob(job);for(const taskId of [job.prepareTask,job.commitTask])if(taskId){const task=execution.forUser(context).get(taskId);if(['waiting','running','blocked'].includes(task.state))execution.forUser(context).cancel(taskId);}job.status='cancelled';save(sql,job);return publicJob(job);}),
 });};
 return {forUser,close:async()=>{closed=true;for(const stop of unregister.reverse())await stop();}};
}
