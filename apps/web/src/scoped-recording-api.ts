import {recordingSelectionSchema,type RecordingStatus} from '@mote/shared';
import {moteText} from '@mote/shared/i18n';
import type {Api} from './api';

export type RecordingTask={id:string;state:string;failure?:{code:string};result?:unknown;progress?:{authorizationUrl?:string;expiresAt?:string;authorization?:string}};
type Command={operation:'connect'|'select'|'retry'|'sync'|'disconnect'|'check'|'setup'|'configure'|'login';payload:Record<string,unknown>;operationId:string;taskId?:string};
export type RecordingApi=Api&{resume:(signal:AbortSignal)=>Promise<RecordingStatus>;restoreAuthorization:(signal:AbortSignal)=>Promise<void>};
const terminal=new Set(['succeeded','failed','cancelled','stale','blocked']);
const invalid=()=>Error(moteText('服务返回的操作回执与当前账号不一致。'));
/** One explicit original form command retains its M05 identities until the
 * outcome is read. Storage contains command metadata only, never a grant. */
export function scopedRecordingApi(api:Api,id:string,provider:string,generation:number,onTask:(task:RecordingTask)=>void=()=>{},onRecovery:(value:{pending:boolean;busy:boolean})=>void=()=>{}):RecordingApi{
 const path='/api/connectors/'+encodeURIComponent(id),legacy='/api/connectors/'+provider+'-recordings';
 const owner=api.connection?.mode==='web'?api.connection:undefined,storage=globalThis.localStorage??globalThis.window?.localStorage;
 const intentKey=owner?'mote.recording-command.v3:'+JSON.stringify([owner.origin,owner.deploymentId,owner.userId,owner.credentialId,id,generation]):undefined;
 let active=false,intent:Command|undefined;
 function saved(){
  if(intent)return intent;
  const raw=intentKey?storage?.getItem(intentKey):undefined;if(!raw)return;
  const value=JSON.parse(raw);
  if(!value||Object.keys(value).some(key=>!['operation','operationId','payload','taskId'].includes(key))||!['connect','select','retry','sync','disconnect','login','setup','check','configure'].includes(value.operation)||!/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/.test(value.operationId)||!value.payload||typeof value.payload!=='object'||Array.isArray(value.payload))throw invalid();
  if(value.taskId!==undefined&&!/^[a-f0-9]{64}$/.test(value.taskId))throw invalid();
  if(value.operation==='configure'&&!value.taskId)throw invalid();
  if(value.operation==='select')recordingSelectionSchema.parse(value.payload);
  else if(value.operation==='retry'){if(JSON.stringify(value.payload)!=='{"resume":true}')throw invalid();}
  else if(Object.keys(value.payload).length)throw invalid();
  intent=value as Command;return intent;
 }
 function remember(command:Command){intent=command;if(intentKey&&(command.operation!=='configure'||command.taskId))storage?.setItem(intentKey,JSON.stringify(command.operation==='configure'?{...command,payload:{}}:command));onRecovery({pending:true,busy:active});}
 function clear(command:Command){if(intent!==command)return;intent=undefined;if(intentKey)storage?.removeItem(intentKey);onRecovery({pending:false,busy:active});}
 async function status(signal?:AbortSignal|null){
  const value=await api.request<any>(path,{signal});signal?.throwIfAborted();
  const page=await api.request<{sourceId?:string}>(path+'/recordings?limit=1',{signal});signal?.throwIfAborted();
  if(value.provider!==provider||typeof value.connected!=='boolean'||!value.selection||!value.counts||!Number.isSafeInteger(value.counts.failed)||!Number.isSafeInteger(value.counts.pending))throw invalid();
  onRecovery({pending:Boolean(saved()),busy:active});return {...value,...(page.sourceId?{sourceId:page.sourceId}:{}),steps:[]} as RecordingStatus;
 }
 async function wait(target:string,body:unknown,signal?:AbortSignal|null,command?:Command,awaitTerminal=true){
  const task=command?.taskId?await api.request<RecordingTask>('/api/tasks/'+command.taskId,{signal}):await api.request<RecordingTask>(target,{method:'POST',body:JSON.stringify(body),signal});signal?.throwIfAborted();if(!/^[a-f0-9]{64}$/.test(task.id)||command?.taskId&&task.id!==command.taskId)throw invalid();if(command&&['login','setup','check','configure'].includes(command.operation)){command.taskId=task.id;remember(command);}onTask(task);
  let current=task;
  while(awaitTerminal&&!terminal.has(current.state)){
   await new Promise<void>((resolve,reject)=>{const timer=setTimeout(done,100);function done(){signal?.removeEventListener('abort',abort);resolve();}function abort(){clearTimeout(timer);reject(signal?.reason);}signal?.addEventListener('abort',abort,{once:true});});signal?.throwIfAborted();
   current=await api.request<RecordingTask>('/api/tasks/'+task.id,{signal});signal?.throwIfAborted();if(current.id!==task.id)throw invalid();onTask(current);
  }
  return current;
 }
 async function perform(command:Command,signal?:AbortSignal|null){
  signal?.throwIfAborted();if(active)throw Error(moteText('另一个操作正在进行，请稍后重试。'));active=true;remember(command);
  try{
   const operation=command.operation,plain=operation==='sync'||operation==='disconnect';
   const task=await wait(plain?path+'/'+operation:path+'/operations',{operationId:command.operationId,...(!plain?{operation,payload:command.payload}:{})},signal,command,operation!=='sync');
   if(operation!=='sync'&&task.state!=='succeeded'||operation==='sync'&&terminal.has(task.state)&&task.state!=='succeeded'){clear(command);throw Error(task.failure?.code??task.state);}
   // Selection persists and admits its one background sync on the server.
   // A saved form is immediately editable; its durable acquisition is observed
   // independently and never submitted a second time by this consumer.
   if(operation==='select'&&task.result&&typeof task.result==='object'&&'syncTask' in task.result){
    const next=(task.result as {syncTask:RecordingTask}).syncTask;if(!next||!/^([a-f0-9]{64})$/.test(next.id)||!['waiting','running','succeeded','failed','blocked','cancelled','stale'].includes(next.state))throw invalid();onTask(next);
   }
   const next=await status(signal);signal?.throwIfAborted();clear(command);return next;
  }catch(error){if(command.operation==='configure'&&!command.taskId)clear(command);throw error;}finally{active=false;if(!signal?.aborted)onRecovery({pending:Boolean(saved()),busy:false});}
 }
 async function request<T>(url:string,init:RequestInit={}):Promise<T>{
  const signal=init.signal;signal?.throwIfAborted();if(!url.startsWith(legacy))return api.request<T>(url,init);
  const suffix=url.slice(legacy.length),method=init.method??'GET';
  if(method==='GET'&&suffix==='')return await status(signal) as T;
  const operation=suffix==='/selection'?'select':suffix==='/retry'?'retry':suffix==='/connect'?'connect':suffix==='/sync'?'sync':method==='DELETE'&&suffix===''?'disconnect':undefined;
  const authorization=['/check','/setup','/configure','/login'].includes(suffix)?suffix.slice(1) as Command['operation']:undefined;
  const selectedOperation=operation??authorization;if(!selectedOperation)throw invalid();
  const payload=suffix==='/retry'?{resume:true}:init.body?JSON.parse(String(init.body)):{};
  const previous=saved();
  if(previous&&(previous.operation!==selectedOperation||JSON.stringify(previous.payload)!==JSON.stringify(payload)))throw Error(moteText('提交结果待确认；重试会使用原操作，不会重新创建任务。'));
  return await perform(previous??{operation:selectedOperation,payload,operationId:crypto.randomUUID()},signal) as T;
 }
 return {connection:api.connection,raw:api.raw,request,restoreAuthorization:async signal=>{signal.throwIfAborted();const command=saved();if(command&&['login','setup','configure','check'].includes(command.operation)){await perform(command,signal);}},resume:async signal=>{signal.throwIfAborted();const command=saved();if(!command)throw invalid();return perform(command,signal);}};
}
