import type {EventFields,ServerDiagnostics} from './diagnostics.js';

/** These clocks measure observations only. They never decide execution authority. */
export type ObservationClock=Readonly<{monotonic:number;wall:number}>;
export function observationClock():ObservationClock|undefined {
 try{const monotonic=performance.now(),wall=Date.now();if(Number.isFinite(monotonic)&&monotonic>=0&&Number.isFinite(wall))return {monotonic,wall};}catch{/* Diagnostics cannot affect execution. */}
}
export type ObservationName='host_tick'|'lease_renew'|'lease_recover'|'reader_prepare'|'catalog_snapshot'|'query_assert'|'reader_search'|'reader_timeline'|'reader_evidence'|'reader_activity'|'reader_devices'|'reader_image'|'reader_memories';
export type ObservationPhase='host'|'extract'|'review'|'coding_understanding';
export type ObservationIdentity=Readonly<{taskId?:string;attemptId?:string;attempt?:number;jobId?:string;batchId?:string;phase?:ObservationPhase}>;
type Timing=Partial<Pick<EventFields,'durationMs'|'elapsedMs'|'delayMs'|'clockForwardMs'|'clockBackwardMs'|'leaseRemainingMs'|'leaseOverdueMs'>>;
export type ExecutionLeaseObservation=(ObservationIdentity&Timing&{type:'renew';taskId:string;attempt:number;outcome:'renewed'|'cas_missed'|'renew_exception'})|(ObservationIdentity&{type:'recover';taskId:string;attempt:number;leaseOverdueMs:number});
type Event='task.loop_timing'|'task.lease_timing'|'task.lease_renewal'|'task.lease_recovered'|'memory.reader_timing';
type State='completed'|'failed'|'cas_missed'|'recovered'|'summary';
type Reason='renewed'|'cas_missed'|'renew_exception'|'expired_fence'|'timer_late'|'window_summary'|'suppressed_summary';
type Counts={count:number;failed:number;durationMs:number;elapsedMs:number};
const names:readonly ObservationName[]=['host_tick','lease_renew','lease_recover','reader_prepare','catalog_snapshot','query_assert','reader_search','reader_timeline','reader_evidence','reader_activity','reader_devices','reader_image','reader_memories'];
const phases:readonly ObservationPhase[]=['host','extract','review','coding_understanding'];
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const taskKey=/^[a-f0-9]{64}$/;
const numeric=(value:unknown):value is number=>typeof value==='number'&&Number.isFinite(value)&&value>=0&&value<=Number.MAX_SAFE_INTEGER;
const emptyCounts=():Counts=>({count:0,failed:0,durationMs:0,elapsedMs:0});
export function observationGap(previous:ObservationClock|undefined,current:ObservationClock|undefined,intervalMs:number):Timing {
 if(!previous||!current)return {};
 const elapsedMs=current.monotonic-previous.monotonic,wall=current.wall-previous.wall;
 if(!numeric(elapsedMs)||!Number.isFinite(wall))return {};
 const difference=wall-elapsedMs;
 return {elapsedMs,delayMs:Math.max(0,elapsedMs-intervalMs),clockForwardMs:Math.max(0,difference),clockBackwardMs:Math.max(0,-difference)};
}

/** One bounded observer per existing logger; no timer, writer or task history.
 * hostTick observes the existing 500ms delegation pump, never scheduling it. */
export class ExecutionObservability {
 private closed=false;
 private window:ObservationClock|undefined;
 private previousTick:ObservationClock|undefined;
 private routine=0;private failures=0;private dropped=0;
 private ticks=0;private delayMs=0;private elapsedMs=0;private clockForwardMs=0;private clockBackwardMs=0;
 private renewals=emptyCounts();
 private readonly reads=names.map(()=>emptyCounts());
 constructor(private readonly diagnostics:ServerDiagnostics,private readonly clock:()=>ObservationClock|undefined=observationClock){}
 enabled(){try{return !this.closed&&this.diagnostics.accepts('error');}catch{return false;}}
 private reset(){this.window=undefined;this.previousTick=undefined;this.routine=0;this.failures=0;this.dropped=0;this.ticks=0;this.delayMs=0;this.elapsedMs=0;this.clockForwardMs=0;this.clockBackwardMs=0;this.renewals=emptyCounts();for(let i=0;i<this.reads.length;i++)this.reads[i]=emptyCounts();}
 private sample():ObservationClock|undefined {
  try{
   if(!this.enabled()){if(this.window||this.previousTick)this.reset();return;}
   const now=this.clock();if(!now||!numeric(now.monotonic)||!Number.isFinite(now.wall))return;
   if(this.window&&now.monotonic<this.window.monotonic)this.reset();
   if(!this.window)this.window=now;
   return now;
  }catch{return;}
 }
 private identity(value:ObservationIdentity):EventFields {
  const out:EventFields={};
  if(typeof value.taskId==='string'){if(taskKey.test(value.taskId))out.taskKey=value.taskId;else if(uuid.test(value.taskId))out.taskId=value.taskId;}
  for(const key of ['attemptId','jobId','batchId'] as const)if(typeof value[key]==='string'&&uuid.test(value[key]!))out[key]=value[key];
  if(numeric(value.attempt))out.attempt=value.attempt;
  if(phases.includes(value.phase!))out.phase=value.phase;
  return out;
 }
 private emit(event:Event,name:ObservationName,state:State,level:'debug'|'info'|'warn',identity:ObservationIdentity={},metrics:EventFields={},reason?:Reason,summary=false){
  try{
   if(!this.enabled()||!names.includes(name)||!this.diagnostics.accepts(level))return;
   const critical=event==='task.lease_recovered'||event==='task.lease_renewal'&&state!=='completed';
   if(!summary){if(critical?this.failures>=20:this.routine>=40){this.dropped++;return;}if(critical)this.failures++;else this.routine++;}
   // Copy only numeric fields from a producer-owned list, never arbitrary text.
   const fields:EventFields={...this.identity(identity),name,state,...(reason?{reason}:{})};
   for(const key of ['durationMs','elapsedMs','delayMs','clockForwardMs','clockBackwardMs','leaseRemainingMs','leaseOverdueMs','count','failed','succeeded','skipped','dropped','intervalMs'] as const)if(numeric(metrics[key]))fields[key]=metrics[key];
   if(Buffer.byteLength(JSON.stringify(fields))>1024){this.dropped++;return;}
   this.diagnostics.record(event,fields,level);
  }catch{/* Logger failure must not replace a task result or abort a grant. */}
 }
 private advance(now:ObservationClock){
  try{
   if(!this.window||now.monotonic-this.window.monotonic<60000)return;
   for(let i=0;i<names.length;i++){const value=this.reads[i]!;if(value.count)this.emit(names[i]==='host_tick'?'task.loop_timing':'memory.reader_timing',names[i]!,'summary','info',{phase:'host'},{...value,succeeded:value.count-value.failed},'window_summary');}
   if(this.renewals.count)this.emit('task.lease_timing','lease_renew','summary','info',{phase:'host'},{...this.renewals,succeeded:this.renewals.count-this.renewals.failed},'window_summary');
   this.emit('task.loop_timing','host_tick','summary','info',{phase:'host'},{count:this.ticks,delayMs:this.delayMs,elapsedMs:this.elapsedMs,clockForwardMs:this.clockForwardMs,clockBackwardMs:this.clockBackwardMs,failed:this.renewals.failed,skipped:this.dropped,dropped:this.dropped,intervalMs:500},this.dropped?'suppressed_summary':'window_summary',true);
   const tick=this.previousTick;this.reset();this.window=now;this.previousTick=tick;
  }catch{/* Observation only. */}
 }
 hostTick(){
  try{const now=this.sample();if(!now)return;this.advance(now);const timing=observationGap(this.previousTick,now,500);this.previousTick=now;this.ticks++;
   this.delayMs=Math.max(this.delayMs,timing.delayMs??0);this.elapsedMs=Math.max(this.elapsedMs,timing.elapsedMs??0);this.clockForwardMs=Math.max(this.clockForwardMs,timing.clockForwardMs??0);this.clockBackwardMs=Math.max(this.clockBackwardMs,timing.clockBackwardMs??0);
   if((timing.delayMs??0)>=500)this.emit('task.loop_timing','host_tick','completed','info',{phase:'host'},{...timing,intervalMs:500},'timer_late');
  }catch{/* Observation only. */}
 }
 private complete(name:ObservationName,identity:ObservationIdentity,start:ObservationClock,failed:boolean){
  try{const now=this.sample();if(!now)return;this.advance(now);const durationMs=now.monotonic-start.monotonic;if(!numeric(durationMs))return;const index=names.indexOf(name);if(index<0)return;const value=this.reads[index]!;value.count++;if(failed)value.failed++;value.durationMs=Math.max(value.durationMs,durationMs);value.elapsedMs=Math.min(Number.MAX_SAFE_INTEGER,value.elapsedMs+durationMs);
   if(failed||durationMs>=100)this.emit(name==='host_tick'?'task.loop_timing':'memory.reader_timing',name,failed?'failed':'completed',failed?'warn':'info',identity,{durationMs});
  }catch{/* Observation only. */}
 }
 sync<T>(name:ObservationName,identity:ObservationIdentity,work:()=>T):T {
  const start=this.sample();if(!start)return work();let failed=true;
  try{const value=work();failed=false;return value;}finally{this.complete(name,identity,start,failed);}
 }
 async async<T>(name:ObservationName,identity:ObservationIdentity,work:()=>Promise<T>):Promise<T> {
  const start=this.sample();if(!start)return work();let failed=true;
  try{const value=await work();failed=false;return value;}finally{this.complete(name,identity,start,failed);}
 }
 lease(value:ExecutionLeaseObservation){
  try{const now=this.sample();if(!now)return;this.advance(now);
   if(value.type==='recover'){this.emit('task.lease_recovered','lease_recover','recovered','warn',{...value,phase:'host'},{leaseOverdueMs:value.leaseOverdueMs},'expired_fence');return;}
   if(!['renewed','cas_missed','renew_exception'].includes(value.outcome))return;
   this.renewals.count++;if(value.outcome!=='renewed')this.renewals.failed++;
   if(numeric(value.durationMs)){this.renewals.durationMs=Math.max(this.renewals.durationMs,value.durationMs);this.renewals.elapsedMs=Math.min(Number.MAX_SAFE_INTEGER,this.renewals.elapsedMs+value.durationMs);}
   this.emit('task.lease_renewal','lease_renew',value.outcome==='renewed'?'completed':value.outcome==='cas_missed'?'cas_missed':'failed',value.outcome==='renewed'?'debug':'warn',{...value,phase:'host'},value,value.outcome);
  }catch{/* Observation only. */}
 }
 close(){this.closed=true;this.reset();}
}
const observers=new WeakMap<ServerDiagnostics,ExecutionObservability>();
export function executionObservability(diagnostics:ServerDiagnostics|undefined):ExecutionObservability|undefined {
 if(!diagnostics)return;
 let observer=observers.get(diagnostics);if(!observer){observer=new ExecutionObservability(diagnostics);observers.set(diagnostics,observer);}return observer;
}
