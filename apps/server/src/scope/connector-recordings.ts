import {randomUUID,createHash} from 'node:crypto';
import {join} from 'node:path';
import {z} from 'zod';
import {recordingSelectionSchema,type RecordingSelection,type SourceItem} from '@mote/shared';
import {createFeishuRecordings} from '../connectors/lark-recordings.js';
import {createDingtalkRecordings,createDwsRunner,DWS_VERSION,type DwsRunner} from '../connectors/dingtalk-recordings.js';
import {createLarkRunner,larkJson,authorizationUrl,LARK_VERSION,type LarkRunner} from '../connectors/lark-cli.js';
import {RecordingFlow,recordingScan,recordingStage,type RecordingAccount,type RecordingProvider,type RecordingMetadata,type RecordingStageReceipt,type RecordingJob,type RecordingOutcome,type RecordingPhase} from '../connectors/recording-flow.js';
import type {LarkContext,ConnectorState} from '../connectors/ports.js';
import {ExecutionFailure} from '../execution-engine.js';
import {ConnectorError} from '../connectors/types.js';
import {larkConfigureSchema} from '../connectors/lark-adapter.js';
import {authorizationOutput} from '../connectors/authorization-output.js';
import type {ConnectorTransports} from './connector-contract.js';
import {connectorHash as hash} from './connector-vault.js';
import {RecordingRevisions} from './recording-revisions.js';
import type {IngressOriginalFormat} from './ingress.js';
import type {RecordingTaskPorts} from './recording-task-ports.js';

type Saved={version:1;epoch:string;account?:RecordingAccount;selection:RecordingSelection};
type Ledger={get<T>(scope:string,key:string):T|undefined;set(scope:string,key:string,value:unknown):void;drop(scope:string,key:string):void;rows<T>(scope:string,prefix:string,limit?:number,errorOnly?:boolean):{key:string;value:T}[]};
type ItemPhase='metadata'|'transcript'|'media';
type StageReceipt=Omit<RecordingStageReceipt,'state'>&{state:RecordingStageReceipt['state']|'cancelled'};
type Work={id:string;scanId?:string;metadata?:RecordingMetadata;stages:Record<ItemPhase,StageReceipt>;jobs:Partial<Record<ItemPhase,string>>};
type PhaseJob={epoch:string;scanId:string;job:RecordingJob;requests:string[];taskId?:string;outcome?:RecordingOutcome};
type Scan={id:string;epoch:string;parentId:string;start:number;end:number;full:boolean;at:number;jobs:string[]};
const newWork=(id:string):Work=>({id,stages:{metadata:recordingStage(),transcript:recordingStage(),media:recordingStage()},jobs:{}});
function aggregateError(work:Work,backupAudio:boolean){const current=work.stages;return [current.metadata,current.transcript,...(backupAudio?[current.media]:[])].find(stage=>stage.error)?.error;}
function phaseStatus(receipt:StageReceipt){return {state:receipt.state,archived:receipt.state==='succeeded',blocked:['blocked','failed','stale'].includes(receipt.state),attempts:receipt.attempts,...(receipt.availableAt&&receipt.state==='waiting'?{nextAttemptAt:receipt.availableAt}:{}),...(receipt.error?{error:receipt.error}:{})};}
/** Reuses real fixed-command providers and decoding; M05 owns the sole executor.
 * The per-instance ledger retains discovery pages and independent transcript /
 * media checkpoints, so a failed audio fetch never discards collected text. */
export class ScopedRecordingAdapter {
 private saved:Saved={version:1,epoch:randomUUID(),selection:{enabled:false,start:new Date(Date.now()-30*86400000).toISOString(),autoSync:true,backupAudio:true}};
 private file:ConnectorState<Saved>;
 private provider:RecordingProvider;
 private readonly pending=new Set<Promise<unknown>>();
 private initialized?:Promise<void>;
 private larkRunner?:LarkRunner;
 private dwsRunner?:DwsRunner;
 private authorize?:(progress:(value:unknown)=>void)=>Promise<void>;
 constructor(private ctx:LarkContext,provider:'feishu-recordings'|'dingtalk-recordings',scope:{userId:string;instanceId:string;directory:string},transports:ConnectorTransports|undefined,private assert:()=>void,private signal:AbortSignal,private ledger:Ledger,private tasks?:RecordingTaskPorts){
  this.file=ctx.state!<Saved>('recordings.json');
  if(provider==='feishu-recordings'){
   const runner=transports?.lark?.(scope)??createLarkRunner(scope.directory,{isolatedHome:true});this.provider=createFeishuRecordings(scope.directory,runner);this.larkRunner=runner;
   this.authorize=async progress=>{this.assert();const result=larkJson(await runner({kind:'login',scopes:['minutes:minutes.basic:read','minutes:minutes.artifacts:read','minutes:minutes.media:export','minutes:minutes.search:read']},{signal})),value=z.object({verification_url:z.string(),device_code:z.string().min(1),expires_in:z.number().positive().max(600)}).parse(result),url=authorizationUrl(value.verification_url);if(!url)throw new ConnectorError('lark_authorization_url_invalid');this.assert();progress({authorizationUrl:url,expiresAt:new Date(Date.now()+value.expires_in*1000).toISOString()});await runner({kind:'complete',deviceCode:value.device_code},{signal:AbortSignal.any([signal,AbortSignal.timeout(value.expires_in*1000)])});this.assert();};
  }else{
   const runner=transports?.dingtalk?.(scope)??createDwsRunner(join(scope.directory,'dws-runtime'),{isolatedHome:true});this.provider=createDingtalkRecordings(scope.directory,runner);this.dwsRunner=runner;
   this.authorize=async progress=>{await runner({kind:'login'},undefined,signal,authorizationOutput('dingtalk',url=>{this.assert();progress({authorizationUrl:url});}));this.assert();};
  }
  const providerInstance=this.provider,track=<T>(work:()=>Promise<T>)=>{const promise=Promise.resolve().then(work);this.pending.add(promise);void promise.then(()=>this.pending.delete(promise),()=>this.pending.delete(promise));return promise;};
  this.provider={...providerInstance,account:signal=>track(()=>providerInstance.account(signal)),discover:(account,range,signal)=>track(()=>providerInstance.discover(account,range,signal)),metadata:(account,id,signal)=>track(()=>providerInstance.metadata(account,id,signal)),transcript:(account,metadata,signal,authorize)=>track(()=>providerInstance.transcript(account,metadata,signal,authorize)),media:(account,metadata,signal,authorize)=>track(()=>providerInstance.media(account,metadata,signal,authorize))};
 }
 private async init(){await(this.initialized??=this.file.read().then(saved=>{if(saved){if(saved.version!==1||!z.string().uuid().safeParse(saved.epoch).success)throw new ConnectorError('recording_state_invalid',503);recordingSelectionSchema.parse(saved.selection);this.saved=saved;}}));this.assert();}
 private sourceId(){if(!this.saved.account)throw new ConnectorError('recording_not_connected',409);return this.provider.id+'-recordings-'+hash(this.saved.account.id).slice(0,24);}
 private async fence(){this.assert();if(!this.saved.account)throw new ConnectorError('recording_not_connected',409);if(this.signal.aborted)throw new ConnectorError('recording_cancelled',409);const current=await this.provider.account(this.signal);this.assert();if(current.id!==this.saved.account.id)throw new ConnectorError('recording_account_changed',409);}
 async status(){await this.init();const receipts=this.ledger.rows<Work>(this.saved.epoch,'work:').flatMap(row=>{const current=this.currentWork(row.value).stages;return [current.metadata,...(current.metadata.state==='succeeded'?[current.transcript,...(this.saved.selection.backupAudio?[current.media]:[])]:[])];});return {provider:this.provider.id,connected:Boolean(this.saved.account),...(this.saved.account?.name?{accountName:this.saved.account.name}:{}),environment:this.ledger.get('environment','status'),selection:this.saved.selection,counts:{...(this.saved.account?this.ctx.recordingArchiveCounts?.(this.sourceId()):{transcripts:0,audio:0,empty:0}),pending:receipts.filter(stage=>['waiting','running'].includes(stage.state)).length,failed:receipts.filter(stage=>['blocked','failed','stale'].includes(stage.state)).length}};}
 /** Read the existing current-selection journal; no provider probe or task is
  * admitted. Archived files outside this selection remain in canonical M03. */
 async recordingPage(limit:number,position:(epoch:string)=>string|undefined){
  await this.init();const epoch=this.saved.epoch,after=position(epoch),rows=this.ledger.rows<Work>(epoch,'work:');
  const index=after===undefined?-1:rows.findIndex(row=>row.key===after);if(after!==undefined&&index<0)throw new ConnectorError('invalid_cursor',400);
  const page=rows.slice(index+1,index+limit+2),visible=page.slice(0,limit),sourceId=this.saved.account?this.sourceId():undefined;
  const items=visible.map(({value:raw})=>{
   const work=this.currentWork(raw),current=work.stages,error=aggregateError(work,this.saved.selection.backupAudio);
   const transcript=sourceId?this.ctx.sources.getItem(sourceId,work.id+':export'):undefined,audio=sourceId?this.ctx.sources.getItem(sourceId,work.id+':audio'):undefined,metadata=transcript?.document?.originalMetadata;
   const corpusTime=work.metadata?.recordedAt??work.metadata?.createdAt;
   return {id:work.id,...(work.metadata?{title:work.metadata.title.slice(0,2000),...(corpusTime?{recordedAt:corpusTime}:{})}:{}),
    metadata:phaseStatus(current.metadata),transcript:phaseStatus(current.transcript),
    audio:{required:this.saved.selection.backupAudio,...phaseStatus(current.media)},
    ...(error?{error}:{}),...(transcript?{transcriptCaptureId:transcript.captureId}:{}),...(audio?{audioCaptureId:audio.captureId}:{}),
    ...(typeof metadata?.formatError==='string'&&metadata.formatError?{unsupported:true}:typeof metadata?.empty==='boolean'?{empty:metadata.empty}:{}),
   };
  });
  const latest=await this.file.read();this.assert();if(latest?latest.epoch!==epoch:Boolean(this.saved.account))throw new ConnectorError('recording_state_changed',409);
  return {epoch,sourceId,items,nextKey:page.length>limit?visible.at(-1)!.key:undefined};
 }
 async check(){
  await this.init();let environment:{installed:boolean;version?:string;configured:boolean;error?:string}={installed:false,configured:false};
  try{
   const version=this.larkRunner?(await this.larkRunner({kind:'version'},{signal:this.signal})).match(/\b(\d+\.\d+\.\d+)\b/)?.[1]:String((await this.dwsRunner!({kind:'version'},undefined,this.signal) as any)?.version).replace(/^v/,'');
   environment={installed:true,version,configured:!this.larkRunner};
   if(version!==(this.larkRunner?LARK_VERSION:DWS_VERSION))throw new ConnectorError(this.larkRunner?'lark_cli_version_unsupported':'dingtalk_cli_version_unsupported');
   if(this.larkRunner){const status=larkJson(await this.larkRunner({kind:'status'},{signal:this.signal}));environment.configured=typeof status.appId==='string'&&!!status.appId;}
  }catch(error){this.assert();environment.error=error instanceof ConnectorError?error.code:'recording_environment_check_failed';}
  this.assert();this.ledger.set('environment','status',environment);return this.status();
 }
 async setup(progress:(value:unknown)=>void){
  await this.init();if(!this.larkRunner)throw new ConnectorError('connector_operation_invalid',400);
  await this.larkRunner({kind:'setup'},{signal:this.signal,onOutput:authorizationOutput('lark',url=>{this.assert();progress({authorizationUrl:url,expiresAt:new Date(Date.now()+600000).toISOString()});})});
  this.assert();return this.check();
 }
 async configure(value:unknown){
  await this.init();if(!this.larkRunner)throw new ConnectorError('connector_operation_invalid',400);
  await this.larkRunner({kind:'configure',...larkConfigureSchema.parse(value)},{signal:this.signal});this.assert();return this.check();
 }
 async login(progress:(value:unknown)=>void){await this.init();await this.authorize!(progress);this.assert();await this.check();return this.connect();}
 private async memoryDefault(sourceId:string){
  if(this.ctx.recordingMemoryDefault&&this.ledger.get<boolean>('recording-memory-default',sourceId)){await this.ctx.recordingMemoryDefault(sourceId);this.assert();this.ledger.drop('recording-memory-default',sourceId);}
 }
 async connect(){
  await this.init();const account=await this.provider.account(this.signal);this.assert();
  if(this.saved.account?.id!==account.id){if(this.saved.account)this.ctx.sources.update(this.sourceId(),{enabled:false});this.saved={...this.saved,account,epoch:randomUUID(),selection:{...this.saved.selection,enabled:false}};}
  await this.file.write(this.saved);const sourceId=this.sourceId(),isNew=!this.ctx.sources.listSources().some(source=>source.id===sourceId);
  // Keep the new-source initialization intent before publishing the source, so
  // a restart or configuration conflict cannot silently lose its default.
  if(isNew)this.ledger.set('recording-memory-default',sourceId,true);
  this.ctx.sources.register({id:sourceId,name:this.provider.id+' recordings',kind:this.provider.id+'.recordings',deviceId:sourceId,platform:'import',retention:'archive',enabled:true});
  await this.memoryDefault(sourceId);
  return this.status();
 }
 async select(value:unknown){await this.init();const selection=recordingSelectionSchema.parse(value);this.assert();if(!this.saved.account)throw new ConnectorError('recording_not_connected',409);await this.memoryDefault(this.sourceId());if(JSON.stringify(selection)!==JSON.stringify(this.saved.selection))this.saved={...this.saved,epoch:randomUUID(),selection};await this.file.write(this.saved);return this.status();}
 async disconnect(){await this.init();this.saved={...this.saved,account:undefined,epoch:randomUUID(),selection:{...this.saved.selection,enabled:false}};await this.file.write(this.saved);return this.status();}
 private assertCollection(epoch:string){this.assert();this.signal.throwIfAborted();this.ctx.recordingEpochCurrent?.(epoch);if(!this.saved.selection.enabled)throw new ExecutionFailure('stale','recording_selection_required');if(!this.ctx.sources.getSource(this.sourceId()).enabled)throw new ExecutionFailure('blocked','recording_paused');}
 private job(key:string){const job=this.ledger.get<PhaseJob>('recording-jobs',key);if(!job)throw new ConnectorError('recording_job_missing',404);return job;}
 private currentWork(work:Work):Work{
  const stages={...work.stages};for(const phase of ['metadata','transcript','media'] as const){const key=work.jobs[phase];if(!key)continue;const job=this.job(key);if(job.taskId&&this.tasks){const task=this.tasks.get(job.taskId);stages[phase]={state:task.state,attempts:task.attempts,availableAt:task.availableAt,...(task.error?{error:task.error}:{})};}}
  return {...work,stages};
 }
 private updateWork(id:string,update:(work:Work)=>void){const work=this.ledger.get<Work>(this.saved.epoch,'work:'+id)??newWork(id);update(work);this.ledger.set(this.saved.epoch,'work:'+id,work);return work;}
 private scan(id:string){const scan=this.ledger.get<Scan>(this.saved.epoch,'scan:'+id);if(!scan)throw new ConnectorError('recording_scan_missing',404);return scan;}
 private async admit(key:string){const record=this.job(key);this.assertCollection(record.epoch);if(!this.tasks?.submit)throw new ConnectorError('recording_scheduler_unavailable',503);const task=await this.tasks.submit(record.job.phase,key,id=>{this.assertCollection(record.epoch);this.ledger.set('recording-jobs',key,{...this.job(key),taskId:id});});this.assertCollection(record.epoch);return task;}
 private async enqueue(scanId:string,job:RecordingJob){
  this.assertCollection(this.saved.epoch);const id=String(job.input.id??'');let reuse:string|undefined;
  if(job.phase!=='discover'){
   this.updateWork(id,work=>{
    const current=this.currentWork(work),phase=job.phase as ItemPhase;
    if(phase==='metadata'&&work.scanId!==scanId&&current.stages.metadata.state==='succeeded'){
     work.stages.metadata=recordingStage();delete work.jobs.metadata;
     if(['succeeded','skipped'].includes(current.stages.transcript.state)){work.stages.transcript=recordingStage();delete work.jobs.transcript;}
     if(current.stages.media.state==='skipped'){work.stages.media=recordingStage();delete work.jobs.media;}
    }
    if(phase==='metadata')work.scanId=scanId;
    reuse=work.jobs[phase];
   });
  }
  const key=reuse??hash([this.saved.epoch,scanId,job]);
  const parent=this.scan(scanId).parentId,existing=this.ledger.get<PhaseJob>('recording-jobs',key);
  if(!existing)this.ledger.set('recording-jobs',key,{epoch:this.saved.epoch,scanId,job,requests:[parent]} satisfies PhaseJob);
  else if(!existing.requests.includes(parent))this.ledger.set('recording-jobs',key,{...existing,requests:[...existing.requests,parent]});
  if(job.phase!=='discover')this.updateWork(id,work=>{work.jobs[job.phase as ItemPhase]=key;});
  const scan=this.scan(scanId);if(!scan.jobs.includes(key)){scan.jobs.push(key);this.ledger.set(this.saved.epoch,'scan:'+scanId,scan);}
  await this.admit(key);
  return key;
 }
 private flow(epoch:string,scanId:string){
  const source=this.sourceId(),selection=this.saved.selection,revisions=new RecordingRevisions(this.ctx.sources,source),assertCollection=()=>this.assertCollection(epoch);
  const publish=async(item:SourceItem,bytes:Buffer,format?:Extract<IngressOriginalFormat,`processor:${string}`|'recording-audio-backup'>)=>{const authorize=()=>{assertCollection();this.ctx.assertFileAllowed?.(source,item.externalId);};authorize();await this.fence();authorize();const contentHash=createHash('sha256').update(bytes).digest('hex');item.document={...item.document,originalMetadata:{...item.document?.originalMetadata,bodyHash:contentHash}};const receipt=await this.ctx.publishFile(source,revisions.revision(item),bytes,authorize,this.signal,format);return receipt;};
  return new RecordingFlow(this.provider,this.saved.account!,selection,{signal:this.signal,assertCurrent:assertCollection,
   beforeAcquire:(phase,id)=>{assertCollection();if(phase==='transcript'||phase==='media')this.ctx.assertFileAllowed?.(source,id+(phase==='transcript'?':export':':audio'));},
   seenCursor:(job,cursor)=>(this.ledger.get<string[]>(epoch,'seen:'+scanId+':'+hash([Date.parse(String(job.input.start)),Date.parse(String(job.input.end))]))??[]).includes(cursor),
   archive:{
    transcript:async(value,authorize)=>{
     const {metadata,rawText}=value,corpusTime=metadata.recordedAt??metadata.createdAt;authorize();
     const original:SourceItem={externalId:metadata.id+':export',revision:hash(rawText),observedAt:new Date().toISOString(),title:metadata.title.slice(0,2000),...(metadata.uri?{uri:metadata.uri}:{}),text:'',kind:'file',layer:'original',mimeType:this.provider.id==='dingtalk'?'application/json':'text/plain',deleted:false,document:{contentRole:'other',timeBasis:corpusTime?'recorded':'unknown',...(corpusTime?{recordedAt:corpusTime}:{}),originalMetadata:{provider:this.provider.id,recordingId:metadata.id,durationMs:metadata.durationMs,formatError:value.formatError??'',empty:value.state==='empty'}}};
     // The retained provider export is the single canonical speech input. Its
     // fixed local decoder publishes the complete transcript and exact segment
     // locators as one Material; publishing each segment as another SourceItem
     // would duplicate the same speech and fragment recording Memory context.
     return publish(original,Buffer.from(rawText),`processor:connector.${this.provider.id}-transcript`);
    },
    existingMedia:id=>{
     assertCollection();const item=this.ctx.sources.getItem(source,id+':audio'),metadata=item?.document?.originalMetadata;
     if(!item||item.deleted||item.kind!=='file'||item.layer!=='original'||!item.mimeType?.startsWith('audio/')||metadata?.provider!==this.provider.id||metadata.recordingId!==id||metadata.role!=='original-audio'||typeof metadata.bodyHash!=='string'||!/^[a-f0-9]{64}$/.test(metadata.bodyHash))return;
     // Selection epochs only authorize work; they do not erase a confirmed
     // archive fact. Reuse requires the exact current owner/source head and
     // retained original, never an old successful execution receipt alone.
     const existing=this.ctx.retainedFile?.(source,item.externalId);return existing?.id===item.captureId?existing:undefined;
    },
    media:async(metadata,media,authorize)=>{authorize();return publish({externalId:metadata.id+':audio',revision:createHash('sha256').update(media.bytes).digest('hex'),observedAt:new Date().toISOString(),title:metadata.title.slice(0,2000),text:'',kind:'file',layer:'original',mimeType:media.mimeType,deleted:false,document:{contentRole:'other',timeBasis:'unknown',originalMetadata:{provider:this.provider.id,recordingId:metadata.id,role:'original-audio'}}},media.bytes,'recording-audio-backup');},
   },
  });
 }
 async sync(automatic=false,retryOnly=false,requestId?:string){
  await this.init();if(!this.saved.account)throw new ConnectorError('recording_not_connected',409);this.assertCollection(this.saved.epoch);await this.memoryDefault(this.sourceId());
  if(!this.tasks?.parentId)throw new ConnectorError('recording_scheduler_unavailable',503);
  const epoch=this.saved.epoch,parent=requestId??this.tasks.parentId;
  let scanId=this.ledger.get<string>(epoch,'request:'+parent);
  if(!scanId){
   if(retryOnly)return this.status();
   const active=this.ledger.get<string>(epoch,'active-scan');
   if(active&&this.scan(active).jobs.some(key=>{const job=this.job(key);return job.job.phase==='discover'&&(!job.taskId||['waiting','running'].includes(this.tasks!.get(job.taskId).state));}))scanId=active;
   else {const previous=this.ledger.get<{until:number;fullAt:number}>(epoch,'scan-complete'),at=Date.now(),plan=recordingScan(this.saved.selection,automatic,previous,at);scanId=randomUUID();this.ledger.set(epoch,'scan:'+scanId,{id:scanId,epoch,parentId:parent,start:plan.start,end:plan.end,full:plan.full,at,jobs:[]} satisfies Scan);this.ledger.set(epoch,'active-scan',scanId);for(const range of plan.windows)await this.enqueue(scanId,{phase:'discover',input:{...range,page:0}});}
   this.ledger.set(epoch,'request:'+parent,scanId);
  }
  const scan=this.scan(scanId);for(const key of scan.jobs){const record=this.job(key);if(!record.requests.includes(parent))this.ledger.set('recording-jobs',key,{...record,requests:[...record.requests,parent]});if(!record.taskId)await this.admit(key);}
  // A second scan can reference metadata already admitted by an earlier one.
  // Observe and link its real successors too, so neither a parent completion
  // nor restart recovery can mistake a metadata receipt for completed archive.
  for(const key of scan.jobs){const record=this.job(key);if(record.scanId!==scanId&&record.outcome)for(const successor of this.flow(epoch,scanId).next(record.job,record.outcome))await this.enqueue(scanId,successor);}
  const tasks=this.scan(scanId).jobs.map(key=>({job:this.job(key),task:this.tasks!.get(this.job(key).taskId!)}));
  if(tasks.some(({task})=>['waiting','running'].includes(task.state)))throw new ExecutionFailure('waiting','recording_stages_pending',1000,{executionStarted:false});
  const failedDiscovery=tasks.find(({job,task})=>job.job.phase==='discover'&&task.state!=='succeeded');
  if(failedDiscovery){if(this.ledger.get<string>(epoch,'active-scan')===scanId)this.ledger.drop(epoch,'active-scan');throw new ExecutionFailure(failedDiscovery.task.state==='blocked'?'blocked':'permanent',failedDiscovery.task.failure?.code??failedDiscovery.task.error??'recording_discovery_failed');}
  const outcomes=tasks.flatMap(({job})=>job.outcome&&'archive' in job.outcome?[job.outcome.archive as {duplicate?:boolean}]:[]);
  return {imported:outcomes.filter(value=>value.duplicate===false).length,duplicates:outcomes.filter(value=>value.duplicate===true).length,failed:tasks.filter(({task})=>['blocked','failed','stale','cancelled'].includes(task.state)).length};
 }
 async executeStage(key:string,phase:RecordingPhase,taskId:string){
  await this.init();const record=this.job(key);if(record.job.phase!==phase||record.taskId!==taskId)throw new ConnectorError('recording_job_binding_invalid',409);this.assertCollection(record.epoch);
  const flow=this.flow(record.epoch,record.scanId),result=record.outcome??await flow.execute(record.job);this.assertCollection(record.epoch);
  this.ledger.set('recording-jobs',key,{...this.job(key),outcome:result});
  if(result.phase==='metadata'){
   this.updateWork(result.metadata.id,work=>{work.metadata=result.metadata;});
   if(!result.accepted)this.updateWork(result.metadata.id,work=>{for(const child of ['transcript','media'] as const)if(!work.jobs[child])work.stages[child]={state:'skipped',attempts:0,availableAt:0};});
  }
  const next=flow.next(record.job,result);
  if(result.phase==='discover'&&result.next){const window=record.scanId+':'+hash([Date.parse(String(record.job.input.start)),Date.parse(String(record.job.input.end))]),seen=this.ledger.get<string[]>(record.epoch,'seen:'+window)??[];if(!seen.includes(result.next))this.ledger.set(record.epoch,'seen:'+window,[...seen,result.next]);}
  for(const successor of next)await this.enqueue(record.scanId,successor);
  const scan=this.scan(record.scanId),discoveries=scan.jobs.map(id=>this.job(id)).filter(job=>job.job.phase==='discover');
  if(result.phase==='discover'&&discoveries.every(job=>job.outcome)){
   const previous=this.ledger.get<{until:number;fullAt:number}>(record.epoch,'scan-complete');this.ledger.set(record.epoch,'scan-complete',{until:Math.max(scan.end,previous?.until??scan.end),fullAt:Math.max(scan.full?scan.at:0,previous?.fullAt??0)});if(this.ledger.get<string>(record.epoch,'active-scan')===scan.id)this.ledger.drop(record.epoch,'active-scan');
  }
  return result;
 }
 async retry(){
  await this.init();this.assertCollection(this.saved.epoch);if(!this.tasks?.retry)throw new ConnectorError('recording_scheduler_unavailable',503);
  if(this.tasks.retryGroup?.read()!==undefined)return this.status();
  const selected:{key:string;taskId:string}[]=[];
  for(const row of this.ledger.rows<Work>(this.saved.epoch,'work:'))for(const phase of ['metadata','transcript','media'] as const){const key=row.value.jobs[phase];if(!key)continue;const job=this.job(key);if(job.taskId&&['failed','blocked'].includes(this.tasks.get(job.taskId).state))selected.push({key,taskId:job.taskId});}
  const attach=()=>{this.assertCollection(this.saved.epoch);for(const item of selected){const job=this.job(item.key);if(job.taskId!==item.taskId||job.epoch!==this.saved.epoch)throw new ConnectorError('recording_job_binding_invalid',409);if(this.tasks!.parentId&&!job.requests.includes(this.tasks!.parentId))this.ledger.set('recording-jobs',item.key,{...job,requests:[...job.requests,this.tasks!.parentId]});}};
  if(this.tasks.retryGroup)this.tasks.retryGroup.commit(selected.map(item=>item.taskId),attach);
  else{attach();for(const item of selected)this.tasks.retry(item.taskId);}
  return this.status();
 }
 async close(){await this.provider.close?.();await Promise.allSettled([...this.pending]);await this.file.flush();}
}
