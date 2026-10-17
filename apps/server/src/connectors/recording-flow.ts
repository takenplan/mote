import {ProviderFailure,type RecordingSelection,type Transcript} from '@mote/shared';
import {z} from 'zod';
import {ExecutionFailure} from '../execution-engine.js';
import {EXECUTION_POLICIES} from '../execution-policy.js';
import {StoreError} from '../execution-storage.js';
import {ConnectorError} from './types.js';

export interface RecordingAccount {id:string;name?:string;profile?:string}
export interface RecordingMetadata {id:string;title:string;createdAt?:string;recordedAt?:string;durationMs:number;uri?:string}
export interface RecordingProvider {
 id:string;version:string;
 account(signal?:AbortSignal):Promise<RecordingAccount>;
 discover(account:RecordingAccount,range:{start:string;end:string;cursor?:string},signal:AbortSignal):Promise<{ids:string[];next?:string}>;
 metadata(account:RecordingAccount,id:string,signal:AbortSignal):Promise<RecordingMetadata>;
 transcript(account:RecordingAccount,metadata:RecordingMetadata,signal:AbortSignal):Promise<{rawText:string;transcript:Transcript|null;formatError?:'recording_transcript_format_unsupported'|'recording_timeline_invalid'}>;
 media(account:RecordingAccount,metadata:RecordingMetadata,signal:AbortSignal):Promise<{mimeType:string;bytes:Buffer}>;
 close?():Promise<void>;
}
export const recordingPhases=['discover','metadata','transcript','media'] as const;
export type RecordingPhase=typeof recordingPhases[number];
export type RecordingJob={phase:RecordingPhase;input:Record<string,unknown>};
export type RecordingOutcome=
 |{phase:'discover';ids:string[];next?:string}
 |{phase:'metadata';metadata:RecordingMetadata;accepted:boolean}
 |{phase:'transcript';id:string;empty:boolean;archive:unknown}
 |{phase:'media';id:string;archive:unknown};
export type RecordingExport={metadata:RecordingMetadata;rawText:string;transcript:Transcript|null;state:'ready'|'empty'|'unsupported';formatError?:string};
/** Host ports carry already-bound authority. No Store, user selector, path or
 * scheduler is part of the recording domain. Both hosts run this same flow. */
export interface RecordingFlowPorts {
 assertCurrent():void;
 signal:AbortSignal;
 seenCursor(job:RecordingJob,cursor:string):boolean;
 archive:{
  transcript(value:RecordingExport,authorize:()=>void):Promise<unknown>;
  existingMedia(id:string):unknown|undefined;
  media(metadata:RecordingMetadata,value:{mimeType:string;bytes:Buffer},authorize:()=>void):Promise<unknown>;
 };
}
const day=86400000;
export function recordingWindows(start:number,end:number){
 if(!Number.isFinite(start)||!Number.isFinite(end)||Math.max(1,Math.ceil((end-start)/(27*day)))>240)throw new ExecutionFailure('permanent','recording_range_limit');
 // A saved future start with no fixed end has no current discovery window.
 if(end<start)return [];
 const windows:{start:string;end:string}[]=[];
 for(let from=start;;){const to=Math.min(end,from+27*day);windows.push({start:new Date(from).toISOString(),end:new Date(to).toISOString()});if(to===end)return windows;from=to;}
}
export function recordingScan(selection:RecordingSelection,automatic:boolean,previous:{until:number;fullAt:number}|undefined,now:number){
 const full=!automatic||!previous||now-previous.fullAt>day,end=Date.parse(selection.end??new Date(now).toISOString()),start=full?Date.parse(selection.start):Math.max(Date.parse(selection.start),previous!.until-7*day);
 return {start,end,full,windows:recordingWindows(start,end)};
}
export function recordingFailure(error:unknown):ExecutionFailure {
 if(error instanceof ExecutionFailure)return error;
 if(error instanceof ProviderFailure)return new ExecutionFailure(error.details.category,error.details.code,error.details.retryAfterMs,error.details.executionStarted===false?{executionStarted:false}:undefined);
 if(error instanceof z.ZodError)return new ExecutionFailure('permanent','recording_contract_invalid');
 if(error instanceof StoreError&&[400,409,410,413].includes(error.statusCode))return new ExecutionFailure('blocked','recording_archive_rejected');
 if(error instanceof ConnectorError){
  if(['lark_operation_timeout','dingtalk_operation_timeout'].includes(error.code))return new ExecutionFailure('transient','provider_timeout');
  if(error.code==='recording_transcript_not_ready')return new ExecutionFailure('transient',error.code);
  if(['lark_permission_required','lark_not_connected','lark_not_configured','lark_cli_missing','dingtalk_cli_missing','dingtalk_not_connected','dingtalk_permission_required'].includes(error.code))return new ExecutionFailure('blocked','recording_authorization_required');
  if(['recording_identity_invalid','recording_pagination_invalid','recording_transcript_format_unsupported','recording_timeline_invalid'].includes(error.code))return new ExecutionFailure('permanent',error.code);
 }
 return new ExecutionFailure('permanent','recording_provider_failed');
}
export type RecordingStageReceipt={state:'waiting'|'running'|'succeeded'|'blocked'|'failed'|'stale'|'skipped';attempts:number;availableAt:number;error?:string};
export const recordingStage=():RecordingStageReceipt=>({state:'waiting',attempts:0,availableAt:0});
export function recordingStageFailure(receipt:RecordingStageReceipt,error:unknown,now:number):RecordingStageReceipt {
 const failure=recordingFailure(error),waiting=failure.category==='waiting',attempts=Math.max(0,receipt.attempts-Number(waiting||failure.facts?.executionStarted===false));
 return {state:failure.category==='blocked'?'blocked':failure.category==='stale'?'stale':failure.category==='permanent'||attempts>=EXECUTION_POLICIES.networkAcquisition.maxAttempts?'failed':'waiting',attempts,availableAt:now+Math.max(waiting?1:0,failure.retryAfterMs??(waiting?1000:Math.min(3600000,1000*2**(attempts-1)))),error:failure.code};
}
export function retryRecordingStage(receipt:RecordingStageReceipt){return ['failed','blocked'].includes(receipt.state)?recordingStage():receipt;}
export function recordingMetadataAllowed(selection:RecordingSelection,metadata:RecordingMetadata){const at=metadata.createdAt??metadata.recordedAt;return !at||!(Date.parse(at)<Date.parse(selection.start)||selection.end&&Date.parse(at)>Date.parse(selection.end));}
export function recordingSuccessors(selection:RecordingSelection,job:RecordingJob,result:RecordingOutcome):RecordingJob[]{
 if(result.phase!==job.phase)throw new ExecutionFailure('permanent','recording_contract_invalid');
 if(result.phase==='discover')return [...result.ids.map(id=>({phase:'metadata' as const,input:{id,discovery:job.input.discovery}})),...(result.next?[{phase:'discover' as const,input:{...job.input,cursor:result.next,page:Number(job.input.page??0)+1}}]:[])];
 if(result.phase==='metadata'&&result.accepted)return [{phase:'transcript',input:{id:result.metadata.id,metadata:result.metadata,discovery:job.input.discovery}},...(selection.backupAudio?[{phase:'media' as const,input:{id:result.metadata.id,metadata:result.metadata}}]:[])];
 return [];
}

/** Business transitions are independent of whether a host durably enqueues each
 * phase or resumes it inside its existing admitted task. Archive adapters only
 * translate the same outcome into that host's canonical storage contracts. */
export class RecordingFlow {
 constructor(readonly provider:RecordingProvider,readonly account:RecordingAccount,readonly selection:RecordingSelection,private ports:RecordingFlowPorts){}
 private assert(){this.ports.signal.throwIfAborted();this.ports.assertCurrent();}
 private async fence(){this.assert();const current=await this.provider.account(this.ports.signal);this.assert();if(current.id!==this.account.id)throw new ExecutionFailure('blocked','recording_account_changed');}
 async execute(job:RecordingJob):Promise<RecordingOutcome>{
  await this.fence();const {phase,input}=job,signal=this.ports.signal;
  if(phase==='discover'){
   if(Number(input.page??0)>=10000)throw new ExecutionFailure('permanent','recording_pagination_invalid');
   const result=await this.provider.discover(this.account,{start:String(input.start),end:String(input.end),...(input.cursor?{cursor:String(input.cursor)}:{})},signal);await this.fence();
   if(result.ids.length>100||result.next&&(result.next===input.cursor||this.ports.seenCursor(job,result.next)))throw new ExecutionFailure('permanent','recording_pagination_invalid');
   return {phase,ids:[...new Set(result.ids)],...(result.next?{next:result.next}:{})};
  }
  const id=String(input.id);
  if(phase==='metadata'){
   const metadata=await this.provider.metadata(this.account,id,signal);await this.fence();
   if(metadata.id!==id||!Number.isFinite(metadata.durationMs)||metadata.durationMs<0)throw new ExecutionFailure('permanent','recording_identity_invalid');
   return {phase,metadata,accepted:recordingMetadataAllowed(this.selection,metadata)};
  }
  const metadata=input.metadata as RecordingMetadata;
  if(!metadata||metadata.id!==id)throw new ExecutionFailure('permanent','recording_identity_invalid');
  if(phase==='transcript'){
   const result=await this.provider.transcript(this.account,metadata,signal);await this.fence();
   const empty=!result.transcript?.segments.length,state=result.formatError?'unsupported':empty?'empty':'ready';
   const archive=await this.ports.archive.transcript({...result,metadata,state,transcript:state==='ready'?result.transcript:null},()=>this.assert());this.assert();
   if(result.formatError)throw new ExecutionFailure('permanent',result.formatError);
   return {phase,id,empty,archive};
  }
  const existing=this.ports.archive.existingMedia(id);if(existing!==undefined)return {phase,id,archive:existing};
  const value=await this.provider.media(this.account,metadata,signal);await this.fence();
  const archive=await this.ports.archive.media(metadata,value,()=>this.assert());this.assert();return {phase,id,archive};
 }
 next(job:RecordingJob,result:RecordingOutcome):RecordingJob[]{
  return recordingSuccessors(this.selection,job,result);
 }
}
