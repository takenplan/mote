import {EXECUTION_POLICIES} from './execution-policy.js';
import {ExecutionEngine,ExecutionFailure,type ExecutionStep} from './execution-engine.js';
import {randomUUID} from 'node:crypto';
import {z} from 'zod';
import {ProviderFailure,fileProcessingSchema,transcriptSchema} from '@mote/shared';
import {Store,StoreError,sha256} from './store.js';
import type {FileProcessorRuntime} from './file-processors.js';
import {MEDIA_CATALOG,type MediaAssets} from './media-assets.js';
import {requestLocalJson,isLoopback} from './local-http.js';
import {ProcessorAdmission} from './processor-admission.js';
import {mediaRuntimeSettings,type MediaRuntimeSettings} from './media-configuration.js';
async function managedOcrReady(media:MediaRuntimeSettings){
  const token=media.workerToken;if(!token)return false;
  const url=new URL(media.ocrEndpoint);url.pathname='/health';
  try{const value=await requestLocalJson(url,{headers:{Authorization:`Bearer ${token}`},signal:AbortSignal.timeout(1200),limit:4096}) as {version?:number;execution?:string;ocr?:boolean};
    return value.version===1&&value.execution==='local'&&value.ocr===true;
  }catch{return false;}
}

import {perceptionSettingsSchema} from './perception-configuration.js';
export {perceptionSettingsSchema} from './perception-configuration.js';

export type PerceptionSettings=z.infer<typeof perceptionSettingsSchema>;
/** Durable screenshot adapter for the existing processor runtime. Ingest triggers create jobs atomically. */
export class Perception {
  readonly engine:ExecutionEngine;private owned:boolean;private closed=false;
  private readonly processorAdmission:ProcessorAdmission;
  private inFlight=new Map<string,Promise<unknown>>();
  private historicalPreviews=new Map<string,{expires:number;items:{id:string;hash:string}[]}>();
  private workerReady=false;private workerCheckedAt=0;private workerProbe?:Promise<void>;
  private unregister:Array<()=>Promise<void>>=[];private readonly media:MediaRuntimeSettings;private currentSettings:PerceptionSettings;
  constructor(private store:Store,private runtime:FileProcessorRuntime,engine?:ExecutionEngine,private mediaAssets?:MediaAssets,private probeOcr?:()=>Promise<boolean>,media?:Partial<MediaRuntimeSettings>,configuration?:PerceptionSettings){
    this.media=mediaRuntimeSettings(media);this.processorAdmission=new ProcessorAdmission(store);
    this.engine=engine??new ExecutionEngine(store);this.owned=!engine;
    this.currentSettings=perceptionSettingsSchema.parse(configuration??(mediaAssets?{enabled:true,ocrProcessorId:'image.http',ocrEndpoint:this.media.ocrEndpoint,concurrency:1}:{}));
    this.publishSettings();
    this.unregister.push(this.engine.register({kind:'perception.ocr',pool:'image-ocr',concurrency:()=>this.settings().concurrency,policy:EXECUTION_POLICIES.localProcessing,
      resourceKeys:()=>{const endpoint=this.processorEndpoint();return endpoint&&this.processorAdmission.resourceKey(endpoint)===this.processorAdmission.resourceKey(this.media.ocrEndpoint)?[this.processorAdmission.resourceKey(endpoint)]:[];},
      validate:step=>this.valid(step),admit:step=>this.admit(step),execute:(step,signal)=>this.process(step,signal),commit:(step,result)=>this.commit(step,result),project:step=>this.project(step),
      classify:error=>error instanceof z.ZodError?new ExecutionFailure('permanent','invalid_processor_output'):new ExecutionFailure('permanent','processor_failed'),
    }));
  }
  private execution(settings:PerceptionSettings){return sha256(JSON.stringify([settings.enabled,settings.allowExternalProcessing,settings.providerRevision,settings.ocrProcessorId,settings.ocrEndpoint,settings.ocrEndpoint===this.media.ocrEndpoint&&this.mediaAssets?MEDIA_CATALOG.ocr.version:'']));}
  private valid(step:ExecutionStep){return !this.closed&&step.input.kind==='ocr'&&this.store.imageReference(String(step.input.captureId))?.blobHash===step.input.blobHash&&this.execution(this.settings())===step.input.configRevision;}
  private processorEndpoint(){const settings=this.settings();return this.runtime.registry.list().find(processor=>processor.id===settings.ocrProcessorId)?.serviceKind==='image'&&isLoopback(settings.ocrEndpoint)?settings.ocrEndpoint:undefined;}
  private admit(step:ExecutionStep){
    const settings=this.settings(),url=settings.ocrEndpoint;
    if(!settings.enabled)return new ExecutionFailure('blocked','processing_disabled');
    if(!url)return new ExecutionFailure('blocked','provider_not_configured');
    if(url===this.media.ocrEndpoint&&this.mediaAssets&&!this.mediaAssets.ready('ocr'))return new ExecutionFailure('blocked','model_missing');
    if(url===this.media.ocrEndpoint&&this.mediaAssets&&!this.workerReady)return new ExecutionFailure('waiting','ocr_worker_unavailable',5000);
    if(!settings.allowExternalProcessing&&!['localhost','127.0.0.1','[::1]'].includes(new URL(url).hostname))return new ExecutionFailure('blocked','external_processing_disabled');
    try{const processor=this.runtime.registry.get(settings.ocrProcessorId);if(step.input.processorVersion&&step.input.processorVersion!==processor.version)return new ExecutionFailure('blocked','processor_version_unavailable');}catch{return new ExecutionFailure('blocked','processor_unavailable');}
    const endpoint=this.processorEndpoint();if(endpoint)try{this.processorAdmission.check(endpoint);}catch(error){if(error instanceof ProviderFailure)return new ExecutionFailure('waiting',error.details.code,error.details.retryAfterMs);throw error;}
  }
  private project(step:ExecutionStep){
    if(!this.valid(step))return;
    const state=step.state==='waiting'&&step.error==='processor_failed'?'failed':step.state;
    this.store.db.prepare('UPDATE perception_jobs SET state=?,attempts=?,available_at=?,error=? WHERE capture_id=? AND kind=?').run(state,step.attempts,step.availableAt,step.error??null,String(step.input.captureId),String(step.input.kind));
  }
  settings(){return structuredClone(this.currentSettings);}
  private publishSettings(){this.store.db.prepare("INSERT INTO settings VALUES('perception-effective',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run(JSON.stringify(this.currentSettings));}
  view(){return {recent:this.store.db.prepare("SELECT capture_id AS id,kind,state,error,auto_eligible AS autoEligible FROM perception_jobs WHERE kind='ocr' ORDER BY created_at DESC LIMIT 40").all(),settings:this.settings(),jobs:this.store.db.prepare("SELECT kind,state,auto_eligible AS autoEligible,count(*) AS count FROM perception_jobs WHERE kind='ocr' GROUP BY kind,state,auto_eligible").all()};}
  configure(raw:unknown){
    const previous=this.settings(),value=perceptionSettingsSchema.parse(raw);
    this.currentSettings=value;this.publishSettings();
    if(this.execution(previous)!==this.execution(value)){
      this.engine.cancelKind('perception.ocr');
      this.store.db.prepare("UPDATE perception_jobs SET state='waiting',attempts=0,available_at=0 WHERE kind='ocr' AND state IN ('failed','blocked','running')").run();
    }
    return this.view();
  }

  retry(id:string){
    if(!this.store.imageReference(id)?.blobHash)throw new StoreError('Screenshot not found',404);
    this.store.db.prepare("INSERT INTO perception_jobs(capture_id,kind,state,created_at,auto_eligible) VALUES(?,'ocr','waiting',?,1) ON CONFLICT(capture_id,kind) DO UPDATE SET state='waiting',attempts=0,available_at=0,requested=1,auto_eligible=1").run(id,Date.now());
    for(const step of this.engine.list({operationId:'capture:'+id,kind:'perception.ocr',limit:100}).items)if(this.valid(step)){if(step.state==='running')this.engine.cancel(step.id);if(step.input.requested)this.engine.retry(step.id,true);}
    this.store.db.prepare("UPDATE perception_jobs SET requested=1 WHERE capture_id=? AND kind='ocr'").run(id);return {queued:true};
  }
  previewHistoricalOcr(){
    const now=Date.now();for(const [token,preview] of this.historicalPreviews)if(preview.expires<now)this.historicalPreviews.delete(token);
    if(this.historicalPreviews.size>=20)this.historicalPreviews.delete(this.historicalPreviews.keys().next().value!);
    const rows=this.store.db.prepare("SELECT capture_id FROM perception_jobs WHERE kind='ocr' AND auto_eligible=0 AND state!='succeeded' ORDER BY created_at LIMIT 101").all();
    const items=rows.slice(0,100).flatMap(row=>{const id=String(row.capture_id),reference=this.store.imageReference(id);return reference?.blobHash?[{id,hash:reference.blobHash}]:[];});
    const token=randomUUID();this.historicalPreviews.set(token,{expires:now+600000,items});
    return {token,count:items.length,bounded:rows.length>100,items:items.map(({id})=>({id}))};
  }
  processHistoricalOcr(raw:unknown){
    const {token}=z.object({token:z.string().uuid()}).strict().parse(raw),preview=this.historicalPreviews.get(token);
    if(!preview||preview.expires<Date.now())throw new StoreError('OCR preview expired; refresh before processing',409);
    const db=this.store.db;db.exec('BEGIN IMMEDIATE');try{
      for(const item of preview.items){const row=db.prepare("SELECT state,auto_eligible FROM perception_jobs WHERE capture_id=? AND kind='ocr'").get(item.id);
        if(!row||Number(row.auto_eligible)!==0||row.state==='succeeded'||this.store.imageReference(item.id)?.blobHash!==item.hash)throw new StoreError('OCR preview changed; refresh before processing',409);
      }
      for(const item of preview.items)db.prepare("UPDATE perception_jobs SET auto_eligible=1,requested=1,state='waiting',attempts=0,available_at=0,error=NULL WHERE capture_id=? AND kind='ocr'").run(item.id);
      db.exec('COMMIT');this.historicalPreviews.delete(token);return {queued:preview.items.length};
    }catch(error){db.exec('ROLLBACK');throw error;}
  }
  /** Compatibility helper for callers/tests; production ticks the shared engine. */
  async tick(){await this.refreshWorker();const ids=this.prepare(true);await this.engine.drain(ids);}
  private refreshWorker(){
    if(this.closed||!this.mediaAssets||this.settings().ocrEndpoint!==this.media.ocrEndpoint)return Promise.resolve();
    if(!this.mediaAssets.ready('ocr')){this.workerReady=false;return Promise.resolve();}
    if(this.workerProbe)return this.workerProbe;
    this.workerProbe=(async()=>{
      const ready=await (this.probeOcr??(()=>managedOcrReady(this.media)))().catch(()=>false);if(this.closed||this.settings().ocrEndpoint!==this.media.ocrEndpoint)return;
      this.workerReady=ready;this.workerCheckedAt=Date.now();
      if(ready)for(const row of this.store.db.prepare("SELECT id FROM execution_steps WHERE kind='perception.ocr' AND state='waiting' AND error='ocr_worker_unavailable'").all()){
        const step=this.engine.get(String(row.id));if(step&&this.valid(step))this.engine.retry(step.id,false);
      }
    })().finally(()=>{this.workerProbe=undefined;});
    return this.workerProbe;
  }
  prepare(skipActive=false){
    if(this.closed)return [];
    if(Date.now()-this.workerCheckedAt>=5000)void this.refreshWorker().catch(()=>{});
    if(this.mediaAssets?.ready('ocr'))this.store.db.prepare("UPDATE perception_jobs SET state='waiting',error=NULL,available_at=0 WHERE kind='ocr' AND auto_eligible=1 AND state='blocked' AND error='model_missing'").run();
    const settings=this.settings(),now=Date.now(),ids:string[]=[];
    if(skipActive&&this.engine.hasActive('perception.ocr'))return ids;
    const jobs=this.store.db.prepare("SELECT * FROM perception_jobs WHERE kind='ocr' AND auto_eligible=1 AND state IN ('waiting','failed','blocked') AND attempts<4 AND available_at<=? ORDER BY created_at LIMIT 20").all(now);
    for(const job of jobs){
      const captureId=String(job.capture_id),original=this.store.imageReference(captureId);if(!original?.blobHash)continue;
      let processorVersion='';try{processorVersion=this.runtime.registry.get(settings.ocrProcessorId).version;}catch{}
      const input={captureId,kind:'ocr',processorVersion,blobHash:original.blobHash,configRevision:this.execution(settings),requested:Boolean(job.requested)};
      const stepId=this.engine.enqueue('capture:'+captureId,'perception.ocr',input,{generation:{slot:'ocr',version:input.configRevision}});
      if(job.state==='waiting'&&['cancelled','blocked','failed'].includes(this.engine.get(stepId)!.state))this.engine.retry(stepId);
      ids.push(stepId);
    }
    return ids;
  }
  private async process(step:ExecutionStep,signal:AbortSignal){
    const settings=this.settings(),id=String(step.input.captureId),url=settings.ocrEndpoint;
    const record=this.store.evidence([id])[0];
    if(!step.input.requested&&record.ocrText&&record.ocr?.status==='completed')return {skip:true};
    const processor=this.runtime.registry.get(settings.ocrProcessorId);
    const fingerprint=sha256(JSON.stringify([step.input.blobHash,processor.id,processor.version,'ocr',url,settings.providerRevision,url===this.media.ocrEndpoint&&this.mediaAssets?MEDIA_CATALOG.ocr.version:'']));
    const cached=this.store.db.prepare('SELECT json FROM perception_results WHERE fingerprint=? LIMIT 1').get(fingerprint);
    let result:unknown;
    if(cached)result=JSON.parse(String(cached.json)).transcript;
    else{
      let task=this.inFlight.get(fingerprint);
      if(!task){
        const image=this.store.image(id);
        const endpoint=this.processorEndpoint(),run=()=>processor.process({file:{id,title:'Screenshot',mimeType:image.mime,sizeBytes:image.bytes.length},settings:fileProcessingSchema.parse({imageEndpoint:url,...(url===this.media.ocrEndpoint&&this.mediaAssets?{apiKey:this.media.workerToken}:{})}),maxAudioMs:0,signal,readOriginal:async function*(){yield image.bytes;}});
        task=endpoint?this.processorAdmission.run(endpoint,run):run();
        this.inFlight.set(fingerprint,task);const forget=()=>{if(this.inFlight.get(fingerprint)===task)this.inFlight.delete(fingerprint);};signal.addEventListener('abort',forget,{once:true});void task.finally(()=>{forget();signal.removeEventListener('abort',forget);}).catch(()=>{});
      }
      result=await task;
    }
    const transcript=transcriptSchema.parse(result);if(transcript.durationMs!==0)throw new ExecutionFailure('permanent','invalid_image_duration');
    const text=transcript.segments.map(s=>s.text).join('\n');if(text.length>100000)throw new ExecutionFailure('permanent','image_text_limit');
    return {id:randomUUID(),fingerprint,text,engine:processor.id,engineVersion:processor.version,configRevision:step.input.configRevision,inputHash:step.input.blobHash,generatedAt:new Date().toISOString(),transcript};
  }
  private commit(step:ExecutionStep,result:unknown){
    if((result as {skip?:boolean}).skip)return;
    this.store.savePerception(String(step.input.captureId),'ocr',result as {id:string;text:string;fingerprint:string},false);
  }
  async close(){if(this.owned)await this.engine.close();else if(!this.engine.closed)this.engine.cancelKind('perception.ocr');this.closed=true;await Promise.all(this.unregister.splice(0).map(stop=>stop()));}
}
