import {randomUUID,createHash} from 'node:crypto';
import {join} from 'node:path';
import {z} from 'zod';
import {recordingSelectionSchema,type RecordingSelection,type SourceItem} from '@mote/shared';
import {createFeishuRecordings} from '../connectors/lark-recordings.js';
import {createDingtalkRecordings,createDwsRunner,DWS_VERSION,type DwsRunner} from '../connectors/dingtalk-recordings.js';
import {createLarkRunner,larkJson,authorizationUrl,LARK_VERSION,type LarkRunner} from '../connectors/lark-cli.js';
import {RecordingFlow,recordingScan,recordingWindows,recordingStage,recordingStageFailure,retryRecordingStage,recordingMetadataAllowed,type RecordingAccount,type RecordingProvider,type RecordingMetadata,type RecordingStageReceipt,type RecordingJob,type RecordingOutcome} from '../connectors/recording-flow.js';
import type {LarkContext,ConnectorState} from '../connectors/ports.js';
import {ExecutionFailure} from '../execution-engine.js';
import {ConnectorError} from '../connectors/types.js';
import {larkConfigureSchema} from '../connectors/lark-adapter.js';
import {authorizationOutput} from '../connectors/authorization-output.js';
import type {ConnectorTransports} from './connector-contract.js';
import {connectorHash as hash} from './connector-vault.js';
import {RecordingRevisions} from './recording-revisions.js';
import type {IngressOriginalFormat} from './ingress.js';

type Saved={version:1;epoch:string;account?:RecordingAccount;selection:RecordingSelection};
type Ledger={get<T>(scope:string,key:string):T|undefined;set(scope:string,key:string,value:unknown):void;drop(scope:string,key:string):void;rows<T>(scope:string,prefix:string,limit?:number,errorOnly?:boolean):{key:string;value:T}[]};
type ItemPhase='metadata'|'transcript'|'media';
type Work={id:string;scanId?:string;metadata?:RecordingMetadata;stages:Record<ItemPhase,RecordingStageReceipt>};
const newWork=(id:string):Work=>({id,stages:{metadata:recordingStage(),transcript:recordingStage(),media:recordingStage()}});
function aggregateError(work:Work,backupAudio:boolean){const current=work.stages;return [current.metadata,current.transcript,...(backupAudio?[current.media]:[])].find(stage=>stage.error)?.error;}
function phaseStatus(receipt:RecordingStageReceipt){return {state:receipt.state,archived:receipt.state==='succeeded',blocked:['blocked','failed','stale'].includes(receipt.state),attempts:receipt.attempts,...(receipt.availableAt&&receipt.state==='waiting'?{nextAttemptAt:receipt.availableAt}:{}),...(receipt.error?{error:receipt.error}:{})};}
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
 constructor(private ctx:LarkContext,provider:'feishu-recordings'|'dingtalk-recordings',scope:{userId:string;instanceId:string;directory:string},transports:ConnectorTransports|undefined,private assert:()=>void,private signal:AbortSignal,private ledger:Ledger){
  this.file=ctx.state!<Saved>('recordings.json');
  if(provider==='feishu-recordings'){
   const runner=transports?.lark?.(scope)??createLarkRunner(scope.directory,{isolatedHome:true});this.provider=createFeishuRecordings(scope.directory,runner);this.larkRunner=runner;
   this.authorize=async progress=>{this.assert();const result=larkJson(await runner({kind:'login',scopes:['minutes:minutes.basic:read','minutes:minutes.artifacts:read','minutes:minutes.media:export','minutes:minutes.search:read']},{signal})),value=z.object({verification_url:z.string(),device_code:z.string().min(1),expires_in:z.number().positive().max(600)}).parse(result),url=authorizationUrl(value.verification_url);if(!url)throw new ConnectorError('lark_authorization_url_invalid');this.assert();progress({authorizationUrl:url,expiresAt:new Date(Date.now()+value.expires_in*1000).toISOString()});await runner({kind:'complete',deviceCode:value.device_code},{signal:AbortSignal.any([signal,AbortSignal.timeout(value.expires_in*1000)])});this.assert();};
  }else{
   const runner=transports?.dingtalk?.(scope)??createDwsRunner(join(scope.directory,'dws-runtime'),{isolatedHome:true});this.provider=createDingtalkRecordings(scope.directory,runner);this.dwsRunner=runner;
   this.authorize=async progress=>{await runner({kind:'login'},undefined,signal,authorizationOutput('dingtalk',url=>{this.assert();progress({authorizationUrl:url});}));this.assert();};
  }
  const providerInstance=this.provider,track=<T>(work:()=>Promise<T>)=>{const promise=Promise.resolve().then(work);this.pending.add(promise);void promise.then(()=>this.pending.delete(promise),()=>this.pending.delete(promise));return promise;};
  this.provider={...providerInstance,account:signal=>track(()=>providerInstance.account(signal)),discover:(account,range,signal)=>track(()=>providerInstance.discover(account,range,signal)),metadata:(account,id,signal)=>track(()=>providerInstance.metadata(account,id,signal)),transcript:(account,metadata,signal)=>track(()=>providerInstance.transcript(account,metadata,signal)),media:(account,metadata,signal)=>track(()=>providerInstance.media(account,metadata,signal))};
 }
 private async init(){await(this.initialized??=this.file.read().then(saved=>{if(saved){if(saved.version!==1||!z.string().uuid().safeParse(saved.epoch).success)throw new ConnectorError('recording_state_invalid',503);recordingSelectionSchema.parse(saved.selection);this.saved=saved;}}));this.assert();}
 private sourceId(){if(!this.saved.account)throw new ConnectorError('recording_not_connected',409);return this.provider.id+'-recordings-'+hash(this.saved.account.id).slice(0,24);}
 private async fence(){this.assert();if(!this.saved.account)throw new ConnectorError('recording_not_connected',409);if(this.signal.aborted)throw new ConnectorError('recording_cancelled',409);const current=await this.provider.account(this.signal);this.assert();if(current.id!==this.saved.account.id)throw new ConnectorError('recording_account_changed',409);}
 async status(){await this.init();const receipts=this.ledger.rows<Work>(this.saved.epoch,'work:').flatMap(row=>{const current=row.value.stages;return [current.metadata,...(current.metadata.state==='succeeded'?[current.transcript,...(this.saved.selection.backupAudio?[current.media]:[])]:[])];});return {provider:this.provider.id,connected:Boolean(this.saved.account),...(this.saved.account?.name?{accountName:this.saved.account.name}:{}),environment:this.ledger.get('environment','status'),selection:this.saved.selection,counts:{pending:receipts.filter(stage=>['waiting','running'].includes(stage.state)).length,failed:receipts.filter(stage=>['blocked','failed','stale'].includes(stage.state)).length}};}
 /** Read the existing current-selection journal; no provider probe or task is
  * admitted. Archived files outside this selection remain in canonical M03. */
 async recordingPage(limit:number,position:(epoch:string)=>string|undefined){
  await this.init();const epoch=this.saved.epoch,after=position(epoch),rows=this.ledger.rows<Work>(epoch,'work:');
  const index=after===undefined?-1:rows.findIndex(row=>row.key===after);if(after!==undefined&&index<0)throw new ConnectorError('invalid_cursor',400);
  const page=rows.slice(index+1,index+limit+2),visible=page.slice(0,limit),sourceId=this.saved.account?this.sourceId():undefined;
  const items=visible.map(({value:raw})=>{
   const work=raw,current=work.stages,error=aggregateError(work,this.saved.selection.backupAudio);
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
 async connect(){await this.init();const account=await this.provider.account(this.signal);this.assert();if(this.saved.account?.id!==account.id){if(this.saved.account)this.ctx.sources.update(this.sourceId(),{enabled:false});this.saved={...this.saved,account,epoch:randomUUID(),selection:{...this.saved.selection,enabled:false}};}await this.file.write(this.saved);this.ctx.sources.register({id:this.sourceId(),name:this.provider.id+' recordings',kind:this.provider.id+'.recordings',deviceId:this.sourceId(),platform:'import',retention:'archive',enabled:true});return this.status();}
 async select(value:unknown){await this.init();const selection=recordingSelectionSchema.parse(value);await this.fence();if(JSON.stringify(selection)!==JSON.stringify(this.saved.selection))this.saved={...this.saved,epoch:randomUUID(),selection};await this.file.write(this.saved);return this.status();}
 async disconnect(){await this.init();this.saved={...this.saved,account:undefined,epoch:randomUUID(),selection:{...this.saved.selection,enabled:false}};await this.file.write(this.saved);return this.status();}
 async sync(automatic=false,retryOnly=false){
  await this.init();if(!this.saved.account)throw new ConnectorError('recording_not_connected',409);
  const assertCollection=()=>{this.assert();this.signal.throwIfAborted();if(!this.ctx.sources.getSource(this.sourceId()).enabled)throw new ExecutionFailure('blocked','recording_paused');};
  assertCollection();await this.fence();if(!this.saved.selection.enabled)throw new ConnectorError('recording_selection_required',409);
  const source=this.sourceId(),selection=this.saved.selection,epoch=this.saved.epoch,revisions=new RecordingRevisions(this.ctx.sources,source,this.provider.id);
  let imported=0,duplicates=0;
  const publish=async(item:SourceItem,bytes:Buffer,format?:Extract<IngressOriginalFormat,`processor:${string}`|'recording-audio-backup'>)=>{assertCollection();await this.fence();const contentHash=createHash('sha256').update(bytes).digest('hex');item.document={...item.document,originalMetadata:{...item.document?.originalMetadata,bodyHash:contentHash}};const receipt=await this.ctx.publishFile(source,revisions.revision(item),bytes,assertCollection,this.signal,format);receipt.duplicate?duplicates++:imported++;return receipt;};
  const flow=new RecordingFlow(this.provider,this.saved.account!,selection,{signal:this.signal,assertCurrent:assertCollection,
   seenCursor:(job,cursor)=>(this.ledger.get<string[]>(epoch,'seen:'+hash([Date.parse(String(job.input.start)),Date.parse(String(job.input.end))]))??[]).includes(cursor),
   archive:{
    transcript:async(value,authorize)=>{
     const {metadata,rawText,transcript}=value,corpusTime=metadata.recordedAt??metadata.createdAt;authorize();
     const original:SourceItem={externalId:metadata.id+':export',revision:hash(rawText),observedAt:new Date().toISOString(),title:metadata.title.slice(0,2000),...(metadata.uri?{uri:metadata.uri}:{}),text:'',kind:'file',layer:'original',mimeType:this.provider.id==='dingtalk'?'application/json':'text/plain',deleted:false,document:{contentRole:'other',timeBasis:corpusTime?'recorded':'unknown',...(corpusTime?{recordedAt:corpusTime}:{}),originalMetadata:{provider:this.provider.id,recordingId:metadata.id,durationMs:metadata.durationMs,formatError:value.formatError??'',empty:value.state==='empty'}}};
     const receipt=await publish(original,Buffer.from(rawText),`processor:connector.${this.provider.id}-transcript`);
     const segments:SourceItem[]=[];
     // Empty and unsupported raw exports remain originals, never synthetic speech.
     // Only the provider's successfully decoded speech creates segment evidence.
     if(value.state==='ready')for(const [index,segment] of transcript!.segments.entries()){
      const item:SourceItem={externalId:metadata.id+':segment:'+index,revision:hash([segment,metadata]),observedAt:new Date().toISOString(),title:metadata.title.slice(0,2000),...(metadata.uri?{uri:metadata.uri}:{}),text:segment.text,kind:'file',layer:'snapshot',mimeType:'text/plain',deleted:false,document:{contentRole:'other',timeBasis:corpusTime?'recorded':'unknown',...(corpusTime?{recordedAt:corpusTime}:{}),originalMetadata:{provider:this.provider.id,recordingId:metadata.id,segment:index,speaker:segment.speaker??'',startMs:segment.startMs,endMs:segment.endMs,untimed:segment.untimed??false,uncertain:segment.uncertain??false}}};
      segments.push(item);
     }
     await revisions.replaceSegments(metadata.id,segments,original,authorize,()=>this.fence());
     return receipt;
    },
    existingMedia:()=>undefined,
    media:async(metadata,media,authorize)=>{authorize();return publish({externalId:metadata.id+':audio',revision:createHash('sha256').update(media.bytes).digest('hex'),observedAt:new Date().toISOString(),title:metadata.title.slice(0,2000),text:'',kind:'file',layer:'original',mimeType:media.mimeType,deleted:false,document:{contentRole:'other',timeBasis:'unknown',originalMetadata:{provider:this.provider.id,recordingId:metadata.id,role:'original-audio'}}},media.bytes,'recording-audio-backup');},
   },
  });
  const save=(key:string,work:Work)=>{this.assert();this.ledger.set(epoch,key,work);};
  const run=async(key:string,work:Work,job:RecordingJob):Promise<RecordingOutcome|undefined>=>{
   const phase=job.phase as ItemPhase,current=work.stages,receipt=current[phase];
   // Read-only acquisitions may resume after an interrupted host. Preserve every
   // completed sibling and charge only actual failed attempts, like M05 recovery.
   if(receipt.state==='running')current[phase]={...receipt,state:'waiting',attempts:Math.max(0,receipt.attempts-1),availableAt:0};
   const ready=current[phase];if(ready.state!=='waiting'||ready.availableAt>Date.now())return;
   current[phase]={...ready,state:'running',attempts:ready.attempts+1};delete current[phase].error;save(key,work);
   try{
    const result=await flow.execute(job);this.assert();
    if(result.phase==='metadata')work.metadata=result.metadata;
    current[phase]={state:'succeeded',attempts:current[phase].attempts,availableAt:0};save(key,work);return result;
   }catch(error){this.assert();if(this.signal.aborted)throw error;current[phase]=recordingStageFailure(current[phase],error,Date.now());save(key,work);}
  };
  const process=async(row:{key:string;value:Work})=>{
   const work=row.value,current=work.stages,metadataJob:RecordingJob={phase:'metadata',input:{id:work.id}};
   const result=await run(row.key,work,metadataJob)??(current.metadata.state==='succeeded'&&work.metadata?{phase:'metadata' as const,metadata:work.metadata,accepted:recordingMetadataAllowed(selection,work.metadata)}:undefined);
   if(!result)return;
   const next=flow.next(metadataJob,result);
   if(!next.length){for(const phase of ['transcript','media'] as const)if(current[phase].state!=='succeeded')current[phase]={state:'skipped',attempts:current[phase].attempts,availableAt:0};save(row.key,work);return;}
   // Transcript acquisition cannot hold up the independent original backup.
   await Promise.all(next.map(job=>run(row.key,work,job)));
  };
  // Discovery and its successors are the same domain plan used by the legacy
  // phase executor. This host only translates that plan into its scoped journal.
  if(!retryOnly){
   const previous=this.ledger.get<{until:number;fullAt:number}>(epoch,'scan-complete'),at=Date.now(),plan=recordingScan(selection,automatic,previous,at);
   let scan=this.ledger.get<{start:number;end:number;from:number;full:boolean;id?:string}>(epoch,'scan-active');
   if(!scan)scan={start:plan.start,end:plan.end,from:plan.start,full:plan.full};if(!scan.id)scan.id=randomUUID();this.ledger.set(epoch,'scan-active',scan);
   for(const range of recordingWindows(scan.from,scan.end)){
    const window=hash([Date.parse(range.start),Date.parse(range.end)]),cursor=this.ledger.get<string>(epoch,'cursor:'+window),seen=this.ledger.get<string[]>(epoch,'seen:'+window)??[];
    let job:RecordingJob={phase:'discover',input:{...range,...(cursor?{cursor}:{}),page:seen.length}};
    for(;;){
     const result=await flow.execute(job);this.assert();
     const next=flow.next(job,result),discovered:{key:string;value:Work}[]=[];let continuation:RecordingJob|undefined;
     for(const successor of next){
      if(successor.phase==='discover'){continuation=successor;continue;}
      const id=String(successor.input.id),key='work:'+id,work=this.ledger.get<Work>(epoch,key)??newWork(id),current=work.stages;
      if(work.scanId!==scan.id&&current.metadata.state==='succeeded'){
       // Ordinary Sync checks for revised vendor exports. Explicit retry never
       // reaches this branch and cannot replay a successful checkpoint.
       current.metadata=recordingStage();if(['succeeded','skipped'].includes(current.transcript.state))current.transcript=recordingStage();if(current.media.state==='skipped')current.media=recordingStage();delete work.metadata;
      }
      work.scanId=scan.id;save(key,work);discovered.push({key,value:work});
     }
     // Consume this durable page before requesting the next one. A slow or failed
     // later discovery page cannot delay already admitted recordings.
     for(const row of discovered)await process(row);
     if(!continuation){this.ledger.drop(epoch,'cursor:'+window);this.ledger.drop(epoch,'seen:'+window);scan.from=Date.parse(range.end);this.ledger.set(epoch,'scan-active',scan);break;}
     seen.push(String(continuation.input.cursor));this.ledger.set(epoch,'seen:'+window,seen);this.ledger.set(epoch,'cursor:'+window,continuation.input.cursor);job=continuation;
    }
   }
   this.ledger.set(epoch,'scan-complete',{until:scan.end,fullAt:scan.full?at:previous?.fullAt??0});this.ledger.drop(epoch,'scan-active');
  }
  for(const row of this.ledger.rows<Work>(epoch,'work:'))await process(row);
  this.assert();const failed=this.ledger.rows<Work>(epoch,'work:').reduce((count,row)=>count+Object.values(row.value.stages).filter(stage=>Boolean(stage.error)||['blocked','failed','stale'].includes(stage.state)).length,0);return {imported,duplicates,failed};
 }
 async retry(){await this.init();for(const row of this.ledger.rows<Work>(this.saved.epoch,'work:')){const work=row.value,current=work.stages;for(const phase of ['metadata','transcript','media'] as const)current[phase]=retryRecordingStage(current[phase]);this.ledger.set(this.saved.epoch,row.key,work);}return this.status();}
 async close(){await this.provider.close?.();await Promise.allSettled([...this.pending]);await this.file.flush();}
}
