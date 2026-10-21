import {EXECUTION_POLICIES} from '../execution-policy.js';
import {recordingMemoryRecipe} from './recording-memory.js';
import {z} from 'zod';
import {createHash,randomUUID} from 'node:crypto';
import {recordingSelectionSchema,type RecordingSelection,type RecordingStatus} from '@mote/shared';
import {ExecutionEngine,ExecutionFailure,type ExecutionStep,type ExecutionGrant} from '../execution-engine.js';
import {ArchivedFileStore} from '../archived-files.js';
import {PrivateFile} from './private-file.js';
import {ConnectorError,type ConnectorContext} from './types.js';
import type {ConnectorManifest} from './registry.js';
import {RecordingFlow,recordingPhases as phases,recordingFailure,recordingScan,recordingSuccessors,type RecordingPhase as Phase,type RecordingProvider,type RecordingAccount,type RecordingMetadata,type RecordingOutcome} from './recording-flow.js';
export type {RecordingProvider,RecordingAccount,RecordingMetadata} from './recording-flow.js';

const hash=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
type Saved={version:1;account?:RecordingAccount;selection:RecordingSelection;epoch:string};
const savedSchema=z.object({version:z.literal(1),account:z.object({id:z.string().min(1).max(1000),name:z.string().max(500).optional(),profile:z.string().max(300).optional()}).strict().optional(),selection:recordingSelectionSchema,epoch:z.string().uuid()}).strict();
const defaults=():RecordingSelection=>({enabled:false,start:new Date(Date.now()-30*86400000).toISOString(),autoSync:true,backupAudio:true});

/** Shared durable synchronization. Providers supply transport and decoding;
 * receipts, publication, recovery and cancellation remain host services. */
export class RecordingConnector {
 private saved:Saved={version:1,selection:defaults(),epoch:randomUUID()};
 private readonly file:PrivateFile<Saved>;
 readonly engine:ExecutionEngine;
 private readonly owned:boolean;
 private disposers:(()=>Promise<void>)[]=[];
 private timer?:ReturnType<typeof setInterval>;
 private initialized=false;private syncIntervalMs?:number;
 private closed=false;
 private error?:string;
 constructor(private ctx:ConnectorContext,readonly provider:RecordingProvider){
  new ArchivedFileStore(ctx.store);
  ctx.store.db.exec(`CREATE TABLE IF NOT EXISTS recording_media(source_id TEXT NOT NULL,external_id TEXT NOT NULL,file_id TEXT NOT NULL REFERENCES archived_files(id) ON DELETE CASCADE,PRIMARY KEY(source_id,external_id)); CREATE TABLE IF NOT EXISTS recording_exports(source_id TEXT NOT NULL,external_id TEXT NOT NULL,file_id TEXT NOT NULL REFERENCES archived_files(id) ON DELETE CASCADE,metadata TEXT NOT NULL,observed_at TEXT NOT NULL,state TEXT NOT NULL CHECK(state IN ('empty','unsupported')),PRIMARY KEY(source_id,external_id)); CREATE TABLE IF NOT EXISTS recording_cursors(source_id TEXT PRIMARY KEY,epoch TEXT NOT NULL,scanned_until TEXT NOT NULL,full_at INTEGER NOT NULL);`);
  this.file=new PrivateFile(ctx.config.connectors!.directory,`${provider.id}-recordings.json`);
  this.engine=ctx.sourcePipelines?.engine??new ExecutionEngine(ctx.store);this.owned=!ctx.sourcePipelines;
 }
 private sourceId(){return this.saved.account?`${this.provider.id}-recordings-${hash(this.saved.account.id).slice(0,24)}`:undefined;}
 private kind(phase:Phase){return `recording.${this.provider.id}.${phase}`;}
 private valid(step:ExecutionStep){return !this.closed&&this.saved.selection.enabled&&step.input.epoch===this.saved.epoch&&step.input.providerVersion===this.provider.version&&
  step.input.account===hash(this.saved.account?.id)&&Boolean(this.sourceId()&&this.ctx.sources.getSource(this.sourceId()!).enabled);}
 private authorize(step:ExecutionStep,grant:ExecutionGrant){grant.assert();if(!this.valid(step))throw new ExecutionFailure('stale','recording_binding_changed');}
 async init(){
  const value=await this.file.read();if(value)this.saved=savedSchema.parse(value);
  if(this.saved.account)this.registerSource();
  for(const phase of phases)this.disposers.push(this.engine.register({kind:this.kind(phase),pool:`recording.${phase}`,concurrency:()=>phase==='media'?1:2,
   policy:EXECUTION_POLICIES.networkAcquisition,timeoutMs:null,
   validate:step=>this.valid(step),resourceKeys:step=>[`recording:${this.provider.id}:${step.input.account}:${step.input.id??'discovery'}:${phase}`],
   execute:async(step,signal,grant)=>{
    const started=Date.now();this.observe(phase,'started',step);
    try{this.authorize(step,grant);
     const result=await this.execute(phase,step,signal,grant);this.observe(phase,'completed',step,{durationMs:Date.now()-started});return result;
    }catch(e){this.observe(phase,'failed',step,{durationMs:Date.now()-started});throw e;}
   },commit:(step,result)=>this.commit(phase,step,result),
   classify:recordingFailure,
  }));
  this.initialized=true;this.configureSyncInterval(this.ctx.config.connectors?.syncIntervalMs??300000);
  void this.engine.tick();
 }
 configureSyncInterval(intervalMs:number){
  // This wake also drives durable retries; retain the existing five-minute ceiling.
  const interval=Math.max(1000,Math.min(intervalMs,300000));
  if(this.timer&&this.syncIntervalMs===interval)return;
  if(this.timer)clearInterval(this.timer);this.timer=undefined;this.syncIntervalMs=interval;
  if(!this.initialized||this.closed)return;
  this.timer=setInterval(()=>{void this.tick().catch(()=>{this.error='recording_sync_failed';});},interval);this.timer.unref();
 }
 private observe(phase:Phase|'decode'|'publish',state:'started'|'completed'|'failed',step:ExecutionStep,extra:{count?:number;bytes?:number;durationMs?:number}={}){
  this.ctx.diagnostics?.record(`source.${state}`,{operation:`recording_${phase}`,attempt:step.attempts,...extra},state==='failed'?'warn':'info');
 }
 private registerSource(enable?:boolean){const id=this.sourceId()!;this.ctx.sources.register({id,name:`${this.provider.id} recordings`,kind:`${this.provider.id}.recordings`,deviceId:id,platform:'import',retention:'archive',enabled:enable??this.saved.selection.enabled});if(enable!==undefined)this.ctx.sources.update(id,{enabled:enable});if(this.ctx.sourcePipelines&&!this.ctx.store.db.prepare('SELECT 1 FROM source_pipeline_config WHERE source_id=?').get(id))this.ctx.sourcePipelines?.configure(id,{settleSeconds:0});if(enable===true&&this.ctx.memoryRecipeSettings&&!this.ctx.store.db.prepare('SELECT 1 FROM memory_recipe_settings WHERE source_id=?').get(id))this.ctx.memoryRecipeSettings?.configure({sourceId:id,recipes:[recordingMemoryRecipe]});}
  async connect(){if(this.closed)throw new ConnectorError('connector_closed');const account=await this.provider.account();
  this.cancel();if(this.sourceId())this.ctx.sources.update(this.sourceId()!,{enabled:false});const changed=this.saved.account?.id!==account.id;this.saved={...this.saved,account,selection:{...this.saved.selection,...(changed?{enabled:false}:{})},epoch:randomUUID()};await this.file.write(this.saved);this.registerSource(this.saved.selection.enabled);this.error=undefined;return this.status();}
  async select(raw:unknown){const selection=recordingSelectionSchema.parse(raw);if(!this.saved.account)throw new ConnectorError('recording_not_connected');
  if(Math.ceil((Date.parse(selection.end??new Date().toISOString())-Date.parse(selection.start))/(27*86400000))>240)throw new ConnectorError('recording_range_limit');
  this.cancel();this.saved={...this.saved,selection,epoch:randomUUID()};await this.file.write(this.saved);this.registerSource(selection.enabled);if(selection.enabled)this.sync();return this.status();}
 private cancel(){for(const phase of phases)this.engine.cancelKind(this.kind(phase));}
 async disconnect(){this.cancel();if(this.sourceId())this.ctx.sources.update(this.sourceId()!,{enabled:false});this.saved={...this.saved,account:undefined,selection:{...this.saved.selection,enabled:false},epoch:randomUUID()};await this.file.write(this.saved);return this.status();}
 private enqueue(phase:Phase,operationId:string,input:Record<string,unknown>){const bound={...input,epoch:this.saved.epoch,account:hash(this.saved.account!.id),providerVersion:this.provider.version};
  // A vendor may repeat an ID on another page/window. The first discovery
  // locator remains provenance; it must not create a second business phase.
  const metadataId=phase==='metadata'?hash([this.kind(phase),operationId,bound.epoch,bound.account,bound.providerVersion,input.id]):undefined;
  if(metadataId){const prior=this.engine.get(metadataId);if(prior)return prior;}
  // A failed media backup is one durable work item across discovery rounds.
  // Do not multiply blocked downloads or reset their retry budget every poll.
  if(phase==='media'){
   // Reuse earlier transcript-dependent receipts too; upgrading must not multiply failed backups.
   const prior=this.ctx.store.db.prepare("SELECT id FROM execution_steps WHERE kind=? AND json_extract(input,'$.epoch')=? AND json_extract(input,'$.account')=? AND json_extract(input,'$.providerVersion')=? AND json_extract(input,'$.id')=? LIMIT 1").get(this.kind(phase),bound.epoch,bound.account,bound.providerVersion,String(input.id));
   if(prior)return this.engine.get(String(prior.id));
  }
  if(phase==='transcript'){
   const prior=this.ctx.store.db.prepare("SELECT id FROM execution_steps WHERE kind=? AND state IN ('waiting','running','failed','blocked') AND json_extract(input,'$.epoch')=? AND json_extract(input,'$.id')=? LIMIT 1").get(this.kind(phase),bound.epoch,String(input.id));
   if(prior)return this.engine.get(String(prior.id));
  }
  return this.engine.enqueue(operationId,this.kind(phase),bound,phase==='media'?{id:hash([this.kind(phase),bound])}:metadataId?{id:metadataId}:{});}
 sync(full=true){if(!this.saved.account||!this.saved.selection.enabled)throw new ConnectorError('recording_not_connected');
  const existing=Number(this.ctx.store.db.prepare("SELECT count(*) n FROM execution_steps WHERE kind=? AND state IN ('waiting','running','blocked','failed') AND json_extract(input,'$.epoch')=?").get(this.kind('discover'),this.saved.epoch)!.n);if(existing)return this.status();
  const cursor=this.ctx.store.db.prepare('SELECT * FROM recording_cursors WHERE source_id=? AND epoch=?').get(this.sourceId()!,this.saved.epoch);
  const scan=recordingScan(this.saved.selection,!full,cursor?{until:Date.parse(String(cursor.scanned_until)),fullAt:Number(cursor.full_at)}:undefined,Date.now()),operation='recording-sync:'+randomUUID();
  for(const window of scan.windows)this.enqueue('discover',operation,{...window,page:0,runEnd:new Date(scan.end).toISOString(),runFull:scan.full});
  void this.engine.tick();return this.status();
 }
 async tick(){if(this.closed)return;if(this.saved.account&&this.saved.selection.enabled&&this.saved.selection.autoSync){try{this.sync(false);}catch{this.error='recording_sync_failed';}}await this.engine.tick();}
 async drain(){for(let n=0;n<100;n++){const steps=this.ctx.store.db.prepare("SELECT id FROM execution_steps WHERE kind IN (SELECT value FROM json_each(?)) AND state IN ('waiting','running') AND available_at<=? LIMIT 100").all(JSON.stringify(phases.map(p=>this.kind(p))),Date.now()) as {id:string}[];if(!steps.length)return;await this.engine.drain(steps.map(s=>s.id));}}
 private flow(step:ExecutionStep,signal:AbortSignal,grant:ExecutionGrant){
  const sourceId=this.sourceId()!,authorize=()=>{signal.throwIfAborted();this.authorize(step,grant);};
  const requireAllowed=(id:string)=>{authorize();if(this.ctx.store.db.prepare('SELECT 1 FROM file_forgotten WHERE source_id=? AND external_id=?').get(sourceId,id))throw new ExecutionFailure('stale','recording_evidence_changed');};
  return new RecordingFlow(this.provider,this.saved.account!,this.saved.selection,{signal,assertCurrent:authorize,
   seenCursor:(job,cursor)=>Boolean(this.ctx.store.db.prepare("SELECT 1 FROM execution_steps WHERE operation_id=? AND kind=? AND json_extract(input,'$.start')=? AND json_extract(input,'$.cursor')=?").get(step.operationId,this.kind('discover'),String(job.input.start),cursor)),
   archive:{
    transcript:async(value,check)=>{
     const {metadata,rawText,transcript}=value,id=metadata.id;requireAllowed(id);check();
     if(value.state!=='ready'){
      const bytes=Buffer.from(rawText),file=new ArchivedFileStore(this.ctx.store).putParts({name:`recording-export-${hash([sourceId,id])}.txt`,mimeType:'text/plain'},[bytes],bytes.length,()=>requireAllowed(id));
      if(value.state==='unsupported')grant.commit(()=>this.ctx.store.db.prepare("INSERT INTO recording_exports VALUES(?,?,?,?,?,'unsupported') ON CONFLICT(source_id,external_id) DO UPDATE SET file_id=excluded.file_id,metadata=excluded.metadata,observed_at=excluded.observed_at,state=excluded.state").run(sourceId,id,file.id,JSON.stringify(metadata),new Date().toISOString()));
      return {id,empty:true,fileId:file.id,metadata,observedAt:new Date().toISOString()};
     }
     if(!this.ctx.files)throw new ExecutionFailure('blocked','recording_storage_unavailable');
     const corpusTime=metadata.recordedAt??metadata.createdAt;
     const ack=await this.ctx.files.transcriptRevision(sourceId,{externalId:id,kind:'file',title:metadata.title,observedAt:new Date().toISOString(),deleted:false,
      ...(metadata.uri?{uri:metadata.uri}:{}),document:{contentRole:'transcript',...(corpusTime?{recordedAt:corpusTime,timeBasis:'recorded'}:{timeBasis:'unknown'})}},rawText,transcript!,()=>{check();requireAllowed(id);});
     this.observe('publish','completed',step,{count:ack.duplicate?0:1});
     const prior=this.ctx.store.db.prepare('SELECT file_id FROM recording_media WHERE source_id=? AND external_id=?').get(sourceId,id);
     if(prior)grant.commit(()=>new ArchivedFileStore(this.ctx.store).attach(ack.id,[String(prior.file_id)]));
     return {captureId:ack.id,id};
    },
    existingMedia:id=>{requireAllowed(id);const existing=this.ctx.store.db.prepare('SELECT file_id FROM recording_media WHERE source_id=? AND external_id=?').get(sourceId,id);return existing?{fileId:String(existing.file_id),id}:undefined;},
    media:async(metadata,media,check)=>{const id=metadata.id;check();requireAllowed(id);
     const file=new ArchivedFileStore(this.ctx.store).putRecordingMedia({name:`recording-${hash([sourceId,id])}.${({'audio/wav':'wav','audio/mp4':'m4a','audio/mpeg':'mp3','audio/flac':'flac','audio/ogg':'ogg'} as Record<string,string>)[media.mimeType]??'audio'}`,mimeType:media.mimeType,bytes:media.bytes},()=>{check();requireAllowed(id);});
     this.observe('media','completed',step,{bytes:media.bytes.length});return {fileId:file.id,id};
    },
   },
  });
 }
 private execute(phase:Phase,step:ExecutionStep,signal:AbortSignal,grant:ExecutionGrant){return this.flow(step,signal,grant).execute({phase,input:step.input});}
 private commit(phase:Phase,step:ExecutionStep,result:unknown){
  const outcome=result as RecordingOutcome,value='archive' in outcome?outcome.archive as any:outcome;
  // The host translates durable storage/publication only. Both hosts consume the
  // domain's exact successor plan, including date exclusion and audio independence.
  for(const next of recordingSuccessors(this.saved.selection,{phase,input:{...step.input,...(phase==='discover'?{discovery:step.id}:{})}},outcome))this.enqueue(next.phase,step.operationId,next.input);
  if(phase==='transcript'){
   if(this.ctx.store.db.prepare('SELECT 1 FROM file_forgotten WHERE source_id=? AND external_id=?').get(this.sourceId()!,value.id))throw new ExecutionFailure('stale','recording_evidence_changed');
   if(value.empty)this.ctx.store.db.prepare("INSERT INTO recording_exports VALUES(?,?,?,?,?,'empty') ON CONFLICT(source_id,external_id) DO UPDATE SET file_id=excluded.file_id,metadata=excluded.metadata,observed_at=excluded.observed_at,state=excluded.state").run(this.sourceId()!,value.id,value.fileId,JSON.stringify(value.metadata),value.observedAt);
   else this.ctx.store.db.prepare('DELETE FROM recording_exports WHERE source_id=? AND external_id=?').run(this.sourceId()!,value.id);
  }else if(outcome.phase==='discover'&&!outcome.next){
   const others=this.ctx.store.db.prepare("SELECT count(*) n FROM execution_steps WHERE operation_id=? AND kind=? AND id!=? AND state!='succeeded'").get(step.operationId,this.kind('discover'),step.id);
   if(Number(others!.n)===0)this.ctx.store.db.prepare('INSERT INTO recording_cursors VALUES(?,?,?,?) ON CONFLICT(source_id) DO UPDATE SET epoch=excluded.epoch,scanned_until=excluded.scanned_until,full_at=CASE WHEN excluded.full_at>0 THEN excluded.full_at ELSE recording_cursors.full_at END').run(this.sourceId()!,this.saved.epoch,String(step.input.runEnd),step.input.runFull?Date.now():0);
  }else if(phase==='media'){
   if(this.ctx.store.db.prepare('SELECT 1 FROM file_forgotten WHERE source_id=? AND external_id=?').get(this.sourceId()!,value.id))throw new ExecutionFailure('stale','recording_evidence_changed');
   this.ctx.store.db.prepare('INSERT OR REPLACE INTO recording_media VALUES(?,?,?)').run(this.sourceId()!,value.id,value.fileId);
   const head=this.ctx.store.db.prepare('SELECT capture_id FROM file_heads WHERE source_id=? AND external_id=?').get(this.sourceId()!,value.id);
   if(head&&this.ctx.store.isCurrentEvidence(String(head.capture_id))){new ArchivedFileStore(this.ctx.store).attach(String(head.capture_id),[value.fileId]);this.ctx.store.db.prepare("INSERT INTO changes(id,operation,changed_at) VALUES(?,'upsert',?)").run(String(head.capture_id),new Date().toISOString());}
  }
 }
 status():RecordingStatus {
  const sourceId=this.sourceId(),all=this.steps({limit:100,problemsFirst:true}).items;
  const transcripts=sourceId?Number(this.ctx.store.db.prepare('SELECT count(*) n FROM file_heads WHERE source_id=?').get(sourceId)!.n):0;
  const audio=sourceId?Number(this.ctx.store.db.prepare('SELECT count(*) n FROM recording_media WHERE source_id=?').get(sourceId)!.n):0;
  return {provider:this.provider.id,connected:Boolean(this.saved.account),accountName:this.saved.account?.name,sourceId,selection:this.saved.selection,
   steps:all,stepsTotal:this.count(['waiting','running','succeeded','failed','blocked','cancelled','stale']),
   counts:{transcripts,audio,empty:sourceId?Number(this.ctx.store.db.prepare("SELECT count(*) n FROM recording_exports WHERE source_id=? AND state='empty'").get(sourceId)!.n):0,pending:this.count(['running','waiting']),failed:this.count(['failed','blocked'])},...(this.error?{error:this.error}:{})};
 }
 steps(args:{cursor?:number;limit?:number;problemsFirst?:boolean}={}){
  const limit=Math.max(1,Math.min(args.limit??50,100)),clauses=["kind IN (SELECT value FROM json_each(?))","json_extract(input,'$.epoch')=?"],values:(string|number)[]=[JSON.stringify(phases.map(p=>this.kind(p))),this.saved.epoch];
  if(args.cursor!==undefined){clauses.push('rowid<?');values.push(args.cursor);}
  const rows=this.ctx.store.db.prepare(`SELECT rowid,id FROM execution_steps WHERE ${clauses.join(' AND ')} ORDER BY ${args.problemsFirst?"state IN ('failed','blocked') DESC,":''}rowid DESC LIMIT ?`).all(...values,limit+1);
  return {items:rows.slice(0,limit).map(row=>{const s=this.engine.get(String(row.id))!;return {id:s.id,phase:s.kind.split('.').at(-1)!,state:s.state,attempts:s.attempts,availableAt:s.availableAt,...(s.input.metadata?{title:(s.input.metadata as unknown as RecordingMetadata).title}:{}),...(s.error?{error:s.error}:{})};}),nextCursor:rows.length>limit?Number(rows[limit-1]!.rowid):null};
 }
 items(includeExports=false){
  const sourceId=this.sourceId();if(!sourceId)return {items:[]};
  const archived=new ArchivedFileStore(this.ctx.store);
  const rows=this.ctx.store.db.prepare('SELECT h.external_id,h.capture_id,m.file_id FROM file_heads h LEFT JOIN recording_media m ON m.source_id=h.source_id AND m.external_id=h.external_id JOIN captures c ON c.id=h.capture_id WHERE h.source_id=? ORDER BY c.received_at DESC LIMIT 30').all(sourceId) as {external_id:string;capture_id:string;file_id:string|null}[];
  const full=rows.map(row=>{const item=this.ctx.sources.getItem(sourceId,row.external_id)!;return {id:row.external_id,captureId:row.capture_id,title:item.title,observedAt:item.observedAt,recordedAt:item.document?.recordedAt,...(row.file_id?{audio:archived.get(row.file_id)}:{})};});
  if(!includeExports)return {items:full};
  const empty=this.ctx.store.db.prepare('SELECT e.*,m.file_id AS audio_id FROM recording_exports e LEFT JOIN recording_media m ON m.source_id=e.source_id AND m.external_id=e.external_id WHERE e.source_id=? ORDER BY e.observed_at DESC LIMIT 30').all(sourceId).map(row=>{const metadata=JSON.parse(String(row.metadata)) as RecordingMetadata;return {id:String(row.external_id),title:metadata.title,observedAt:String(row.observed_at),recordedAt:metadata.recordedAt,empty:row.state==='empty',unsupported:row.state==='unsupported',export:archived.get(String(row.file_id)),...(row.audio_id?{audio:archived.get(String(row.audio_id))}:{})};});
  return {items:[...empty,...full.filter(item=>!empty.some(receipt=>receipt.id===item.id))].sort((a,b)=>b.observedAt.localeCompare(a.observedAt)).slice(0,30)};
 }
 private count(states:string[]){return Number(this.ctx.store.db.prepare("SELECT count(*) n FROM execution_steps WHERE kind IN (SELECT value FROM json_each(?)) AND state IN (SELECT value FROM json_each(?)) AND json_extract(input,'$.epoch')=?").get(JSON.stringify(phases.map(p=>this.kind(p))),JSON.stringify(states),this.saved.epoch)!.n);}
 retry(){const rows=this.ctx.store.db.prepare("SELECT id FROM execution_steps WHERE kind IN (SELECT value FROM json_each(?)) AND state IN ('failed','blocked') AND json_extract(input,'$.epoch')=?").all(JSON.stringify(phases.map(p=>this.kind(p))),this.saved.epoch) as {id:string}[];for(const row of rows)if(this.valid(this.engine.get(row.id)!))this.engine.retry(row.id,true);void this.engine.tick();return this.status();}
 async close(){this.closed=true;clearInterval(this.timer);this.timer=undefined;for(const dispose of this.disposers)await dispose();if(this.owned)await this.engine.close();await this.provider.close?.();await this.file.flush();}
}

/** New providers use this same manifest; no new owner transport or task engine. */
export function recordingManifest(id:string,create:(ctx:ConnectorContext)=>RecordingProvider,options:Pick<RecordingStatus,'label'|'setup'>={}):ConnectorManifest{return {
 apiVersion:1,id:`${id}-recordings`,statusKey:`${id}-recordings`,sourceKinds:[{kind:`${id}.recordings`,capabilities:{lifecycle:'continuous',discovery:'provider-list',listening:'polling',readOriginal:'explicit-provider-read',synchronization:'revisions',externalWrite:false}}],
 create:ctx=>{
  ctx.store.db.exec('CREATE TABLE IF NOT EXISTS recording_media(source_id TEXT NOT NULL,external_id TEXT NOT NULL,file_id TEXT NOT NULL REFERENCES archived_files(id) ON DELETE CASCADE,PRIMARY KEY(source_id,external_id))');
  const provider=create(ctx);if(provider.id!==id)throw Error('Recording manifest and provider identity differ');const connector=new RecordingConnector(ctx,provider),status=()=>({...connector.status(),category:'recordings' as const,...options});return {status,init:()=>connector.init(),configureSyncInterval:interval=>connector.configureSyncInterval(interval),close:()=>connector.close(),configure:host=>{
   const path=`/api/connectors/${id}-recordings` as const;
   host.ownerRoute({method:'GET',path,handler:status});
   host.ownerRoute({method:'GET',path:`${path}/items`,handler:req=>connector.items(z.object({includeExports:z.enum(['true','false']).optional()}).strict().parse(req.query).includeExports==='true')});
   host.ownerRoute({method:'GET',path:`${path}/steps`,handler:req=>connector.steps(z.object({cursor:z.coerce.number().int().positive().optional(),limit:z.coerce.number().int().min(1).max(100).optional()}).strict().parse(req.query))});
   host.ownerRoute({method:'POST',path:`${path}/connect`,handler:()=>connector.connect()});
   host.ownerRoute({method:'PUT',path:`${path}/selection`,handler:req=>connector.select(req.body)});
   host.ownerRoute({method:'POST',path:`${path}/sync`,handler:()=>connector.sync()});
   host.ownerRoute({method:'POST',path:`${path}/retry`,handler:()=>connector.retry()});
   host.ownerRoute({method:'DELETE',path,handler:()=>connector.disconnect()});
  }};
 },
};}
