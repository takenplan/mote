import {randomUUID,createHash} from 'node:crypto';
import {join} from 'node:path';
import {z} from 'zod';
import {recordingSelectionSchema,type RecordingSelection,type SourceItem} from '@mote/shared';
import {createFeishuRecordings} from '../connectors/lark-recordings.js';
import {createDingtalkRecordings,createDwsRunner} from '../connectors/dingtalk-recordings.js';
import {createLarkRunner,larkJson,authorizationUrl} from '../connectors/lark-cli.js';
import type {RecordingAccount,RecordingProvider,RecordingMetadata} from '../connectors/recordings.js';
import type {LarkContext,ConnectorState} from '../connectors/ports.js';
import {ExecutionFailure} from '../execution-engine.js';
import {ConnectorError} from '../connectors/types.js';
import type {ConnectorTransports} from './connector-contract.js';
import {connectorHash as hash} from './connector-vault.js';

type Saved={version:1;epoch:string;account?:RecordingAccount;selection:RecordingSelection};
type Ledger={get<T>(scope:string,key:string):T|undefined;set(scope:string,key:string,value:unknown):void;drop(scope:string,key:string):void;rows<T>(scope:string,prefix:string,limit?:number,errorOnly?:boolean):{key:string;value:T}[]};
type Work={id:string;metadata?:RecordingMetadata;transcript?:boolean;media?:boolean;error?:string;transcriptAttempts?:number;transcriptBlocked?:boolean;transcriptNextAt?:number;mediaAttempts?:number;mediaBlocked?:boolean;mediaNextAt?:number};
/** Reuses real fixed-command providers and decoding; M05 owns the sole executor.
 * The per-instance ledger retains discovery pages and independent transcript /
 * media checkpoints, so a failed audio fetch never discards collected text. */
export class ScopedRecordingAdapter {
 private saved:Saved={version:1,epoch:randomUUID(),selection:{enabled:false,start:new Date(Date.now()-30*86400000).toISOString(),autoSync:true,backupAudio:true}};
 private file:ConnectorState<Saved>;
 private provider:RecordingProvider;
 private readonly pending=new Set<Promise<unknown>>();
 private initialized?:Promise<void>;
 private authorize?:(progress:(value:unknown)=>void)=>Promise<void>;
 constructor(private ctx:LarkContext,provider:'feishu-recordings'|'dingtalk-recordings',scope:{userId:string;instanceId:string;directory:string},transports:ConnectorTransports|undefined,private assert:()=>void,private signal:AbortSignal,private ledger:Ledger){
  this.file=ctx.state!<Saved>('recordings.json');
  if(provider==='feishu-recordings'){
   const runner=transports?.lark?.(scope)??createLarkRunner(scope.directory,{isolatedHome:true});this.provider=createFeishuRecordings(scope.directory,runner);
   this.authorize=async progress=>{this.assert();const result=larkJson(await runner({kind:'login',scopes:['minutes:minutes.basic:read','minutes:minutes.artifacts:read','minutes:minutes.media:export','minutes:minutes.search:read']},{signal})),value=z.object({verification_url:z.string(),device_code:z.string().min(1),expires_in:z.number().positive().max(600)}).parse(result),url=authorizationUrl(value.verification_url);if(!url)throw new ConnectorError('lark_authorization_url_invalid');this.assert();progress({authorizationUrl:url,expiresAt:new Date(Date.now()+value.expires_in*1000).toISOString()});await runner({kind:'complete',deviceCode:value.device_code},{signal:AbortSignal.any([signal,AbortSignal.timeout(value.expires_in*1000)])});this.assert();};
  }else{
   const runner=transports?.dingtalk?.(scope)??createDwsRunner(join(scope.directory,'dws-runtime'),{isolatedHome:true});this.provider=createDingtalkRecordings(scope.directory,runner);
   this.authorize=async progress=>{let buffer='';await runner({kind:'login'},undefined,signal,chunk=>{this.assert();buffer=(buffer+chunk).slice(-16000);for(const line of buffer.split(/\r?\n/).slice(0,-1))try{const url=new URL(line.trim());if(url.protocol==='https:'&&!url.username&&!url.password&&!url.port&&['dingtalk.com','dingtalk.cn','dingtalk.io'].some(domain=>url.hostname===domain||url.hostname.endsWith('.'+domain)))progress({authorizationUrl:url.toString()});}catch{}});this.assert();};
  }
  const providerInstance=this.provider,track=<T>(work:()=>Promise<T>)=>{const promise=Promise.resolve().then(work);this.pending.add(promise);void promise.then(()=>this.pending.delete(promise),()=>this.pending.delete(promise));return promise;};
  this.provider={...providerInstance,account:signal=>track(()=>providerInstance.account(signal)),discover:(account,range,signal)=>track(()=>providerInstance.discover(account,range,signal)),metadata:(account,id,signal)=>track(()=>providerInstance.metadata(account,id,signal)),transcript:(account,metadata,signal)=>track(()=>providerInstance.transcript(account,metadata,signal)),media:(account,metadata,signal)=>track(()=>providerInstance.media(account,metadata,signal))};
 }
 private async init(){await(this.initialized??=this.file.read().then(saved=>{if(saved){if(saved.version!==1||!z.string().uuid().safeParse(saved.epoch).success)throw new ConnectorError('recording_state_invalid',503);recordingSelectionSchema.parse(saved.selection);this.saved=saved;}}));this.assert();}
 private sourceId(){if(!this.saved.account)throw new ConnectorError('recording_not_connected',409);return this.provider.id+'-recordings-'+hash(this.saved.account.id).slice(0,24);}
 private async fence(){this.assert();if(this.signal.aborted)throw new ConnectorError('recording_cancelled',409);const current=await this.provider.account(this.signal);this.assert();if(current.id!==this.saved.account?.id)throw new ConnectorError('recording_account_changed',409);}
 async status(){await this.init();return {provider:this.provider.id,connected:Boolean(this.saved.account),selection:this.saved.selection,counts:{pending:this.ledger.rows<Work>(this.saved.epoch,'work:').filter(r=>!r.value.transcript||this.saved.selection.backupAudio&&!r.value.media).length,failed:this.ledger.rows<Work>(this.saved.epoch,'work:',-1,true).length}};}
 async login(progress:(value:unknown)=>void){await this.init();await this.authorize!(progress);return this.connect();}
 async connect(){await this.init();const account=await this.provider.account(this.signal);this.assert();if(this.saved.account?.id!==account.id){if(this.saved.account)this.ctx.sources.update(this.sourceId(),{enabled:false});this.saved={...this.saved,account,epoch:randomUUID(),selection:{...this.saved.selection,enabled:false}};}await this.file.write(this.saved);this.ctx.sources.register({id:this.sourceId(),name:this.provider.id+' recordings',kind:this.provider.id+'.recordings',deviceId:this.sourceId(),platform:'import',retention:'archive',enabled:false});return this.status();}
 async select(value:unknown){await this.init();const selection=recordingSelectionSchema.parse(value);await this.fence();if(JSON.stringify(selection)!==JSON.stringify(this.saved.selection))this.saved={...this.saved,epoch:randomUUID(),selection};await this.file.write(this.saved);this.ctx.sources.update(this.sourceId(),{enabled:selection.enabled});return this.status();}
 async disconnect(){await this.init();if(this.saved.account)this.ctx.sources.update(this.sourceId(),{enabled:false});this.saved={...this.saved,account:undefined,epoch:randomUUID(),selection:{...this.saved.selection,enabled:false}};await this.file.write(this.saved);return this.status();}
 async sync(automatic=false){
  await this.init();await this.fence();if(!this.saved.selection.enabled)throw new ConnectorError('recording_selection_required',409);
  const source=this.sourceId(),selection=this.saved.selection,epoch=this.saved.epoch;
  const previous=this.ledger.get<{until:number;fullAt:number}>(epoch,'scan-complete'),at=Date.now(),full=!automatic||!previous||at-previous.fullAt>86400000;
  let scan=this.ledger.get<{start:number;end:number;from:number;full:boolean}>(epoch,'scan-active');
  if(!scan){const end=Date.parse(selection.end??new Date(at).toISOString()),start=full?Date.parse(selection.start):Math.max(Date.parse(selection.start),previous!.until-7*86400000);scan={start,end,from:start,full};this.ledger.set(epoch,'scan-active',scan);}
  const lower=scan.start,end=scan.end,windows=Math.ceil((end-lower)/(27*86400000));if(windows>240)throw new ConnectorError('recording_range_too_large',413);
  let imported=0,duplicates=0,failed=0;
  const publish=async(item:SourceItem,bytes:Buffer,mime:string)=>{await this.fence();const contentHash=createHash('sha256').update(bytes).digest('hex'),prior=this.ctx.sources.getItem(source,item.externalId);item.document={...item.document,originalMetadata:{...item.document?.originalMetadata,bodyHash:contentHash}};item.revision=prior?.document?.originalMetadata?.bodyHash===contentHash?prior.revision:hash([contentHash,prior?.revision??'']);const receipt=await this.ctx.publishFile(source,item,bytes,()=>{this.assert();if(!this.ctx.sources.getSource(source).enabled)throw new ConnectorError('recording_paused',409);},this.signal);receipt.duplicate?duplicates++:imported++;return receipt;};
  // Window and page receipts advance only after all discovered work is durable.
  for(let from=scan.from;from<end;from+=27*86400000){const to=Math.min(end,from+27*86400000),window=hash([from,to]);let cursor=this.ledger.get<string>(epoch,'cursor:'+window),seen=new Set(this.ledger.get<string[]>(epoch,'seen:'+window)??[]);
   for(let page=0;page<10000;page++){
    await this.fence();const result=await this.provider.discover(this.saved.account!,{start:new Date(from).toISOString(),end:new Date(to).toISOString(),...(cursor?{cursor}:{})},this.signal);await this.fence();
    if(result.ids.length>100||result.next&&(result.next===cursor||seen.has(result.next)))throw new ConnectorError('recording_pagination_invalid',502);
    for(const id of result.ids){const work=this.ledger.get<Work>(epoch,'work:'+id);this.ledger.set(epoch,'work:'+id,work?.transcript?{...work,transcript:false,metadata:undefined,transcriptAttempts:0,transcriptBlocked:false,transcriptNextAt:0}:work??{id});}
    if(!result.next){this.ledger.drop(epoch,'cursor:'+window);this.ledger.drop(epoch,'seen:'+window);scan.from=to;this.ledger.set(epoch,'scan-active',scan);break;}seen.add(result.next);this.ledger.set(epoch,'seen:'+window,[...seen]);cursor=result.next;this.ledger.set(epoch,'cursor:'+window,cursor);if(page===9999)throw new ConnectorError('recording_pagination_limit',413);
   }
  }
  this.ledger.set(epoch,'scan-complete',{until:end,fullAt:scan.full?at:previous?.fullAt??0});this.ledger.drop(epoch,'scan-active');
  for(const row of this.ledger.rows<Work>(epoch,'work:')){
   const work=row.value;
   if(!work.transcript&&!work.transcriptBlocked&&(work.transcriptNextAt??0)<=Date.now())try{
    work.transcriptAttempts=(work.transcriptAttempts??0)+1;this.ledger.set(epoch,row.key,work);await this.fence();work.metadata??=await this.provider.metadata(this.saved.account!,work.id,this.signal);await this.fence();if(work.metadata.id!==work.id)throw new ConnectorError('recording_identity_invalid',502);this.ledger.set(epoch,row.key,work);
    const metadata=work.metadata;
    if(!work.transcript){
     const value=await this.provider.transcript(this.saved.account!,metadata,this.signal);await this.fence();
     const original:SourceItem={externalId:work.id+':export',revision:hash(value.rawText),observedAt:new Date().toISOString(),title:metadata.title.slice(0,2000),text:'',kind:'file',layer:'original',mimeType:'text/plain',deleted:false,document:{contentRole:'other',timeBasis:metadata.recordedAt||metadata.createdAt?'recorded':'unknown',...(metadata.recordedAt||metadata.createdAt?{recordedAt:metadata.recordedAt??metadata.createdAt}:{}),originalMetadata:{provider:this.provider.id,recordingId:work.id,formatError:value.formatError??'',empty:!value.transcript}}};
     await publish(original,Buffer.from(value.rawText),'text/plain');
     if(value.formatError)throw new ConnectorError(value.formatError,502);
     for(const [index,segment] of (value.transcript?.segments??[]).entries()){
      const item:SourceItem={externalId:work.id+':segment:'+index,revision:hash([segment,metadata]),observedAt:new Date().toISOString(),title:metadata.title.slice(0,2000),text:segment.text,kind:'file',layer:'snapshot',mimeType:'text/plain',deleted:false,document:{contentRole:'other',timeBasis:metadata.recordedAt||metadata.createdAt?'recorded':'unknown',...(metadata.recordedAt||metadata.createdAt?{recordedAt:metadata.recordedAt??metadata.createdAt}:{}),originalMetadata:{provider:this.provider.id,recordingId:work.id,segment:index,speaker:segment.speaker??'',startMs:segment.startMs,endMs:segment.endMs,untimed:segment.untimed??false,uncertain:segment.uncertain??false}}};
      const prior=this.ctx.sources.getItem(source,item.externalId);item.revision=prior?.text===item.text&&JSON.stringify(prior.document)===JSON.stringify(item.document)?prior.revision:hash([item.revision,prior?.revision??'']);await this.ctx.sources.upsert(source,item,()=>this.assert());
     }
     work.transcript=true;work.transcriptAttempts=0;work.transcriptNextAt=0;delete work.error;this.ledger.set(epoch,row.key,work);
    }
   }catch(error){this.assert();if(this.signal.aborted)throw error;work.error=this.failure(error,'recording_transcript_failed');const transient=this.transient(error);work.transcriptBlocked=!transient||(work.transcriptAttempts??0)>=5;work.transcriptNextAt=Date.now()+Math.min(3600000,1000*2**((work.transcriptAttempts??1)-1));failed++;this.ledger.set(epoch,row.key,work);}
   if(selection.backupAudio&&!work.media&&!work.mediaBlocked&&(work.mediaNextAt??0)<=Date.now()&&work.metadata)try{
    work.mediaAttempts=(work.mediaAttempts??0)+1;this.ledger.set(epoch,row.key,work);await this.fence();const media=await this.provider.media(this.saved.account!,work.metadata,this.signal);await this.fence();
    await publish({externalId:work.id+':audio',revision:createHash('sha256').update(media.bytes).digest('hex'),observedAt:new Date().toISOString(),title:work.metadata.title.slice(0,2000),text:'',kind:'file',layer:'original',mimeType:media.mimeType,deleted:false,document:{contentRole:'other',timeBasis:'unknown',originalMetadata:{provider:this.provider.id,recordingId:work.id,role:'original-audio'}}},media.bytes,media.mimeType);work.media=true;work.mediaAttempts=0;work.mediaNextAt=0;if(work.transcript)delete work.error;this.ledger.set(epoch,row.key,work);
   }catch(error){this.assert();if(this.signal.aborted)throw error;work.error=this.failure(error,'recording_media_failed');const transient=this.transient(error);work.mediaBlocked=!transient||(work.mediaAttempts??0)>=5;work.mediaNextAt=Date.now()+Math.min(3600000,1000*2**((work.mediaAttempts??1)-1));failed++;this.ledger.set(epoch,row.key,work);}
  }
  this.assert();failed=Math.max(failed,this.ledger.rows<Work>(epoch,'work:').filter(row=>row.value.error).length);return {imported,duplicates,failed};
 }
 private failure(error:unknown,fallback:string){return error instanceof ConnectorError||error instanceof ExecutionFailure?error.code:fallback;}
 private transient(error:unknown){return error instanceof ExecutionFailure&&error.category==='transient'||error instanceof ConnectorError&&['lark_operation_timeout','dingtalk_operation_timeout','recording_transcript_not_ready'].includes(error.code);}
 async retry(){await this.init();for(const row of this.ledger.rows<Work>(this.saved.epoch,'work:')){const work=row.value;if(!work.transcript){work.transcriptAttempts=0;work.transcriptBlocked=false;work.transcriptNextAt=0;}if(!work.media){work.mediaAttempts=0;work.mediaBlocked=false;work.mediaNextAt=0;}delete work.error;this.ledger.set(this.saved.epoch,row.key,work);}return this.status();}
 async close(){await this.provider.close?.();await Promise.allSettled([...this.pending]);await this.file.flush();}
}
