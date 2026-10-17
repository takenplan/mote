import type {RecordingStatus} from '@mote/shared';
import {moteText} from '@mote/shared/i18n';
import type {Api} from './api';

export type RecordingTask={id:string;state:string;failure?:{code:string};result?:unknown};
const terminal=new Set(['succeeded','failed','cancelled','stale','blocked']);
const invalid=()=>Error(moteText('服务返回的操作回执与当前账号不一致。'));
/** Original recording form, captured owner and one M10 instance; no vendor aliases reach HTTP. */
export function scopedRecordingApi(api:Api,id:string,provider:string,generation:number,onTask:(task:RecordingTask)=>void=()=>{}):Api{
 const path='/api/connectors/'+encodeURIComponent(id),legacy='/api/connectors/'+provider+'-recordings';
 const owner=api.connection?.mode==='web'?api.connection:undefined,storage=globalThis.localStorage??globalThis.window?.localStorage;
 const intentKey=owner?'mote.recording-command.v1:'+JSON.stringify([owner.origin,owner.deploymentId,owner.userId,owner.credentialId,id,generation]):undefined;
 let intent:{key:string;body:string}|undefined;
 async function status(signal?:AbortSignal|null){
  const value=await api.request<any>(path,{signal});signal?.throwIfAborted();
  const page=await api.request<{sourceId?:string}>(path+'/recordings?limit=1',{signal});signal?.throwIfAborted();
  if(value.provider!==provider||typeof value.connected!=='boolean'||!value.selection||!value.counts||!Number.isSafeInteger(value.counts.failed)||!Number.isSafeInteger(value.counts.pending))throw invalid();
  return {...value,...(page.sourceId?{sourceId:page.sourceId}:{}),steps:[]} as RecordingStatus;
 }
 async function request<T>(url:string,init:RequestInit={}):Promise<T>{
  const signal=init.signal;signal?.throwIfAborted();if(!url.startsWith(legacy))return api.request<T>(url,init);
  const suffix=url.slice(legacy.length),method=init.method??'GET';
  if(method==='GET'&&suffix==='')return await status(signal) as T;
  const operation=suffix==='/selection'?'select':suffix==='/retry'?'retry':suffix==='/connect'?'connect':undefined;
  const target=operation?path+'/operations':suffix==='/sync'?path+'/sync':method==='DELETE'&&suffix===''?path+'/disconnect':undefined;
  if(!target)throw invalid();
  const payload=suffix==='/retry'?{resume:true}:init.body?JSON.parse(String(init.body)):{};
  const key=JSON.stringify([target,operation,payload]);
  if(intent?.key!==key){
   const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(key))),v=>v.toString(16).padStart(2,'0')).join('');signal?.throwIfAborted();
   const saved=intentKey?storage?.getItem(intentKey):undefined,previous=saved?JSON.parse(saved):undefined;
   if(previous&&(!/^[a-f0-9]{64}$/.test(previous.fingerprint)||typeof previous.operationId!=='string'||!/^[a-f0-9-]{36}$/.test(previous.operationId)))throw invalid();
   const operationId=previous?.fingerprint===digest?previous.operationId:crypto.randomUUID();
   if(intentKey)storage?.setItem(intentKey,JSON.stringify({fingerprint:digest,operationId}));
   intent={key,body:JSON.stringify({operationId,...(operation?{operation,payload}:{})})};
  }
  // Keep identical operation/body after a lost admission ACK. M05 is authoritative.
  const task=await api.request<RecordingTask>(target,{method:'POST',body:intent.body,signal});signal?.throwIfAborted();if(!/^[a-f0-9]{64}$/.test(task.id))throw invalid();intent=undefined;if(intentKey)storage?.removeItem(intentKey);onTask(task);
  let current=task;
  while(!terminal.has(current.state)){
   await new Promise<void>((resolve,reject)=>{const timer=setTimeout(done,100);function done(){signal?.removeEventListener('abort',abort);resolve();}function abort(){clearTimeout(timer);reject(signal?.reason);}signal?.addEventListener('abort',abort,{once:true});});signal?.throwIfAborted();
   current=await api.request<RecordingTask>('/api/tasks/'+task.id,{signal});signal?.throwIfAborted();if(current.id!==task.id)throw invalid();onTask(current);
  }
  if(current.state!=='succeeded')throw Error(current.failure?.code??current.state);
  return await status(signal) as T;
 }
 return {connection:api.connection,raw:api.raw,request};
}
