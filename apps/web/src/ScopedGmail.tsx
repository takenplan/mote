import {useEffect,useRef,useState} from 'react';
import {moteText} from '@mote/shared/i18n';
import {type Api,errorMessage} from './api';
import {RequestedDetails} from './RequestedDetails';
import {useResource} from './useResource';
import {resources} from './resource-cache';
import {ScopedConnectorSettings} from './ScopedConnectorSettings';
type Connection={id:string;provider:string;generation:number;googleClientId?:string;googleRedirectUri?:string;autoSync:boolean;syncIntervalMs:number};
type Status={configured:boolean;connected:boolean;account?:string;state:string;hasMore:boolean;code?:string};
type Task={id:string;state:string;result?:{imported?:number;duplicates?:number;hasMore?:boolean};error?:string|{code?:string}};
const terminal=['succeeded','failed','cancelled','stale','blocked'];

/** Original Gmail card with an explicit current-account M10 instance. */
export function ScopedGmail({api,refresh,initiallyOpen=false}:{api:Api;refresh:()=>Promise<void>;initiallyOpen?:boolean}){
 const read=useResource<{revision:number;connections:Connection[]}>(api,'/api/connectors'),[selected,setSelected]=useState(''),[editor,setEditor]=useState<'new'|{id:string}>(),connections=(read.data?.connections??[]).filter(value=>value.provider==='gmail'),connection=connections.find(value=>value.id===selected);
 return <RequestedDetails className="source-item" requested={initiallyOpen}><summary>{moteText('连接 Gmail（只读）')}</summary><p>{moteText('同步邮件正文、发件人和时间，附件仅保留名称与引用。邮件内容作为资料，不自动执行其中的指令。断开后停止读取，已归档邮件保留。')}</p>
 {read.error!==undefined&&<p role="alert" className="error-banner">{errorMessage(read.error)}</p>}
 <label>{moteText('Gmail 连接')}<select aria-label={moteText('Gmail 连接')} value={selected} onChange={event=>setSelected(event.target.value)}><option value="">{moteText('选择连接')}</option>{connections.map(value=><option key={value.id} value={value.id}>{value.id}</option>)}</select></label>
 <button className="button subtle" disabled={!!editor||!read.data} onClick={()=>setEditor('new')}>{moteText('新建连接')}</button>
 {editor?<ScopedConnectorSettings key={editor==='new'?'new':editor.id} api={api} id={editor==='new'?undefined:editor.id} onSaved={id=>{setSelected(id);setEditor(undefined);read.refresh();}} onCancel={()=>setEditor(undefined)}/>:connection&&<GmailConnection key={connection.id+':'+connection.generation} api={api} connection={connection} revision={read.data!.revision} refresh={refresh} edit={()=>setEditor({id:connection.id})}/>}
 </RequestedDetails>;
}
function GmailConnection({api,connection,revision,refresh,edit}:{api:Api;connection:Connection;revision:number;refresh:()=>Promise<void>;edit:()=>void}){
 const path='/api/connectors/'+encodeURIComponent(connection.id),read=useResource<Status>(api,path),plugins=useResource<{revision:number;instances:Array<{id:string;desired:boolean}>}>(api,'/api/plugins'),plugin=plugins.data?.instances.find(value=>value.id==='connector.'+connection.id),[taskId,setTaskId]=useState<string>(),taskPath=taskId?'/api/tasks/'+encodeURIComponent(taskId):null,task=useResource<Task>(api,taskPath),[busy,setBusy]=useState(false),[error,setError]=useState(''),[url,setUrl]=useState(''),[message,setMessage]=useState(''),[removing,setRemoving]=useState<{revision:number}>();
 const alive=useRef(true),running=useRef(false),intent=useRef<{path:string;body:string}|undefined>(undefined),seen=useRef<string|undefined>(undefined);
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;intent.current=undefined;};},[api]);
 const live=()=>alive.current;
 useEffect(()=>taskPath&&task.data&&!terminal.includes(task.data.state)?resources(api).get(taskPath).poll(1000):undefined,[api,taskPath,task.data?.state]);
 useEffect(()=>{const value=task.data;if(!value||!terminal.includes(value.state)||seen.current===value.id+value.state)return;seen.current=value.id+value.state;read.refresh();if(value.state==='succeeded'){const result=value.result;if(Number.isSafeInteger(result?.imported)&&result!.imported!>=0&&Number.isSafeInteger(result?.duplicates)&&result!.duplicates!>=0)setMessage(moteText('已同步 {0} 条新版本，{1} 条已存在。',result!.imported!,result!.duplicates!)+(result?.hasMore?moteText(' 后续邮件将在下一轮继续同步。'):''));void refresh();}else setError(typeof value.error==='string'?value.error:value.error?.code??value.state);},[task.data?.id,task.data?.state]);
 async function run(action:()=>Promise<void>){if(running.current||!live())return;running.current=true;setBusy(true);setError('');setMessage('');try{await action();if(live())read.refresh();}catch(e){if(live())setError(errorMessage(e));}finally{if(live()){running.current=false;setBusy(false);}}}
 async function command(suffix:'sync'|'disconnect'){
  const target=path+'/'+suffix;let operation=intent.current;if(!operation||operation.path!==target)operation={path:target,body:JSON.stringify({operationId:crypto.randomUUID()})};intent.current=operation;
  const result=await api.request<Task>(operation.path,{method:'POST',body:operation.body});if(!live())return;if(!/^[a-f0-9]{64}$/.test(result.id))throw Error(moteText('服务返回的操作回执与当前账号不一致。'));intent.current=undefined;setTaskId(result.id);if(suffix==='disconnect')setUrl('');
 }
 async function lifecycle(action:'enable'|'pause'|'stop'){
  if(!plugins.data)return;await api.request(path+'/'+action,{method:'POST',body:JSON.stringify({expectedRevision:plugins.data.revision})});if(!live())return;setUrl('');resources(api).invalidate(key=>key==='/api/plugins'||key==='/api/connectors'||key===path);
 }
 const status=read.data;
 return <div className="gmail-connection">{(error||read.error!==undefined||task.error!==undefined||plugins.error!==undefined)&&<p role="alert" className="error-banner">{error||errorMessage(read.error??task.error??plugins.error)}</p>}
 <button className="button subtle" disabled={busy} onClick={edit}>{moteText('编辑连接')}</button>
 {plugin&&<div className="source-toolbar"><button className="button" disabled={busy} onClick={()=>void run(()=>lifecycle(plugin.desired?'pause':'enable'))}>{plugin.desired?moteText('暂停'):moteText('启用')}</button><button className="button" disabled={busy} onClick={()=>void run(()=>lifecycle('stop'))}>{moteText('停止')}</button><button className="button subtle" disabled={busy} onClick={()=>setRemoving({revision})}>{moteText('移除连接')}</button></div>}
 {removing&&<div role="dialog" aria-label={moteText('移除连接')}><p>{connection.id}</p><button className="button" disabled={busy} onClick={()=>void run(async()=>{await api.request(path,{method:'DELETE',body:JSON.stringify({expectedRevision:removing.revision})});if(!live())return;resources(api).invalidate(key=>key==='/api/plugins'||key==='/api/connectors'||key==='/api/configuration');})}>{moteText('确认移除')}</button><button className="button subtle" disabled={busy} onClick={()=>setRemoving(undefined)}>{moteText('取消')}</button></div>}
 {!status?.configured?<p className="muted">{moteText('Gmail 使用现有 Google OAuth 客户端与回调地址。请在 Google Cloud 启用 Gmail API，再到模型与服务配置客户端。')}</p>:<><p>{status.connected?status.account:moteText('尚未授权')} · {status.state==='permission_required'?moteText('需要重新授权'):status.state==='syncing'?moteText('同步中'):status.hasMore?moteText('历史邮件仍有后续分页'):moteText('等待下次同步')}</p>
 <div className="source-toolbar"><button className="button primary" disabled={busy||!plugin?.desired} onClick={()=>void run(async()=>{const result=await api.request<{authorizationUrl:string;taskId:string}>(path+'/start',{method:'POST',body:'{}'});if(!live())return;const target=new URL(result.authorizationUrl);if(target.protocol!=='https:'||target.hostname!=='accounts.google.com'||target.username||target.password||target.port)throw Error(moteText('授权地址不符合预期。'));setUrl(target.href);})}>{moteText('开始授权')}</button><button className="button" disabled={busy} onClick={()=>void run(async()=>{await api.request(path);})}>{moteText('刷新授权状态')}</button>{status.connected&&<><button className="button primary" disabled={busy||!plugin?.desired} onClick={()=>void run(()=>command('sync'))}>{status.hasMore?moteText('继续同步'):moteText('立即同步')}</button><button className="button" disabled={busy} onClick={()=>void run(()=>command('disconnect'))}>{moteText('断开账户')}</button></>}</div>
 {url&&<p><a href={url} target="_blank" rel="noreferrer noopener">{moteText('在系统浏览器打开 Google 授权页面')}</a></p>}</>}
 {task.data&&!terminal.includes(task.data.state)&&<p role="status">{moteText('正在处理')} · {task.data.state}</p>}{message&&<p role="status">{message}</p>}</div>;
}
