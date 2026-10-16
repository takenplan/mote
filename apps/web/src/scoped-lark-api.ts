import type {LarkJob,LarkStatus} from '@mote/shared';
import {moteText} from '@mote/shared/i18n';
import {type Api} from './api';

type Task={id:string;state:string;progress?:{connector?:LarkJob};result?:unknown;failure?:{code:string}};
const terminal=new Set(['succeeded','failed','cancelled','stale','blocked']);
const status=(value:unknown):value is LarkStatus=>!!value&&typeof value==='object'&&['installed','configured','connected'].every(key=>typeof (value as any)[key]==='boolean')&&Array.isArray((value as any).missingScopes)&&!!(value as any).selection&&Array.isArray((value as any).selection.documents)&&Array.isArray((value as any).selection.calendarIds);

/** Thin presentation adapter for the original Lark panels. All HTTP still uses
 * the captured M01 Api, owned M10 instance and actual M05 task receipts. */
export function scopedLarkApi(api:Api,id:string):Api{
 const path='/api/connectors/'+encodeURIComponent(id);let view:LarkStatus|undefined,pending:{id:string;kind:LarkJob['kind']}|undefined,intent:{key:string;body:string}|undefined;
 const check=(signal?:AbortSignal|null)=>signal?.throwIfAborted();
 async function base(signal?:AbortSignal|null){if(!view){const next=await api.request<unknown>(path,{signal});check(signal);if(!status(next))throw Error(moteText('服务返回的操作回执与当前账号不一致。'));view??=next;}return view;}
 async function apply(task:Task,current:NonNullable<typeof pending>,signal?:AbortSignal|null){
  if(pending!==current)return;
  if(terminal.has(task.state)){
   if(task.state!=='succeeded'){
    // The task retains its failure, while the existing status GET reads the
    // complete durable document journal. Environment flags remain the last
    // actual CLI probe; a freshly opened adapter has not performed that probe.
    const fresh=await api.request<unknown>(path,{signal});check(signal);if(pending!==current)return;
    if(!status(fresh))throw Error(moteText('服务返回的操作回执与当前账号不一致。'));
    view={...view!,selection:fresh.selection,documentSync:fresh.documentSync,lastSyncAt:fresh.lastSyncAt};
   }
   pending=undefined;
   if(task.state==='succeeded'){if(status(task.result))view=task.result;else if(current.kind!=='selection')throw Error(moteText('服务返回的操作回执与当前账号不一致。'));else if(view)view={...view,job:undefined};}
   else if(view)view={...view,job:{id:task.id,kind:current.kind,state:task.state==='cancelled'?'cancelled':'failed',error:task.failure?.code??task.state}};
  }else if(view)view={...view,job:task.progress?.connector??{id:task.id,kind:current.kind,state:'running'}};
 }
 async function read(signal?:AbortSignal|null){await base(signal);const current=pending;if(current){const task=await api.request<Task>('/api/tasks/'+current.id,{signal});check(signal);await apply(task,current,signal);}return view!;}
 async function submit(operation:string,payload:unknown,kind:LarkJob['kind'],signal?:AbortSignal|null,wait=false){
  await base(signal);check(signal);const key=JSON.stringify([operation,payload]);if(intent?.key!==key)intent={key,body:JSON.stringify({operation,payload,operationId:crypto.randomUUID()})};
  const task=await api.request<Task>(path+'/operations',{method:'POST',body:intent.body,signal});check(signal);if(!/^[a-f0-9]{64}$/.test(task.id))throw Error(moteText('服务返回的操作回执与当前账号不一致。'));intent=undefined;const current={id:task.id,kind};pending=current;await apply(task,current,signal);
  if(wait){let value=task;while(!terminal.has(value.state)){await new Promise<void>((resolve,reject)=>{const timer=setTimeout(done,100);function done(){signal?.removeEventListener('abort',abort);resolve();}function abort(){clearTimeout(timer);reject(signal?.reason);}signal?.addEventListener('abort',abort,{once:true});});check(signal);value=await api.request<Task>('/api/tasks/'+task.id,{signal});check(signal);await apply(value,current,signal);}if(value.state!=='succeeded')throw Error(value.failure?.code??value.state);return value.result;}
  return read(signal);
 }
 async function request<T>(url:string,init:RequestInit={}):Promise<T>{
  check(init.signal);const suffix=url.slice('/api/connectors/lark'.length),body=init.body?JSON.parse(String(init.body)):{};let result:unknown;
  if(!url.startsWith('/api/connectors/lark'))return api.request<T>(url,init);
  if(!init.method||init.method==='GET'){
   result=suffix==='/calendars'?await submit('calendars',{},'selection',init.signal,true):suffix===''?await read(init.signal):undefined;
  }else if(suffix==='/check')result=await submit('check',{},'selection',init.signal,true);
  else if(suffix==='/selection')result=await submit('select',body,'selection',init.signal,true);
  else if(suffix==='/configure')result=await submit('configure',body,'configure',init.signal);
  else if(suffix==='/setup'||suffix==='/login'||suffix==='/preview')result=await submit(suffix.slice(1),body,suffix.slice(1) as LarkJob['kind'],init.signal);
  else if(suffix==='/sync'&&body.document)result=await submit('sync-document',body,'sync',init.signal);
  else if(suffix==='/sync'||suffix===''&&init.method==='DELETE'){
   const action=suffix==='/sync'?'sync':'disconnect',key=action;if(intent?.key!==key)intent={key,body:JSON.stringify({operationId:crypto.randomUUID()})};await base(init.signal);const task=await api.request<Task>(path+'/'+action,{method:'POST',body:intent.body,signal:init.signal});check(init.signal);intent=undefined;const current={id:task.id,kind:'sync' as const};pending=current;await apply(task,current,init.signal);result=await read(init.signal);
  }else if(suffix==='/cancel'&&pending){const current=pending,task=await api.request<Task>('/api/tasks/'+current.id+'/cancel',{method:'POST',body:'{}',signal:init.signal});check(init.signal);await apply(task,current,init.signal);result=await read(init.signal);}
  if(result===undefined)throw Error(moteText('暂不可用'));check(init.signal);return result as T;
 }
 return {connection:api.connection,raw:api.raw,request};
}
