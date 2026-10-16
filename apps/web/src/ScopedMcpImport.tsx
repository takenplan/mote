import {useEffect,useRef,useState} from 'react';
import type {ConfigServiceView} from '@mote/shared';
import {moteText} from '@mote/shared/i18n';
import {errorMessage,type Api} from './api';
import {useResource} from './useResource';
import {resources} from './resource-cache';
import {prepareWebMcpConnection,webMcpConnections} from './web-mcp';
import {RequestedDetails} from './RequestedDetails';

/** Keeps the existing Sources/MCP resource selection flow. M11 requires a saved
 * owner connection; no discovery or import body carries endpoint credentials. */
type Props={api:Api;refresh:()=>Promise<void>;requested:boolean};
export function ScopedMcpImport(props:Props){
 const connection=props.api.connection;
 return <OwnedMcpImport key={connection?.mode==='web'?JSON.stringify([connection.origin,connection.deploymentId,connection.userId,connection.credentialId,connection.viewScope]):'legacy'} {...props}/>;
}
function OwnedMcpImport({api,refresh,requested}:Props){
 const config=useResource<ConfigServiceView>(api,'/api/configuration'),sources=useResource<{items:{id:string;name:string;kind:string;enabled:boolean}[]}>(api,'/api/sources');
 const connections=config.data?webMcpConnections(config.data):[],[connectionId,setConnectionId]=useState(''),[sourceId,setSourceId]=useState('');
 const selected=connections.find(connection=>connection.id===connectionId),eligible=selected?.sourceIds.flatMap(id=>sources.data?.items.filter(source=>source.id===id&&source.kind==='mcp'&&source.enabled)??[])??[];
 const chosenSource=sourceId|| (eligible.length===1?eligible[0].id:'');
 const [baseline,setBaseline]=useState<ConfigServiceView>(),[id,setId]=useState(()=> 'mcp-'+crypto.randomUUID()),[name,setName]=useState(moteText('MCP 导入资料')),[url,setUrl]=useState(''),[token,setToken]=useState('');
 const [remote,setRemote]=useState<{uri:string;name:string}[]>([]),[uris,setUris]=useState<string[]>([]),[busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
 const controller=useRef<AbortController|undefined>(undefined),owner=useRef<Api|undefined>(api);owner.current=api;
 useEffect(()=>{if(config.data&&!baseline)setBaseline(config.data);},[config.data,baseline]);
 useEffect(()=>{owner.current=api;return()=>{controller.current?.abort();if(owner.current===api)owner.current=undefined;};},[api]);
 const active=()=>owner.current===api;
 async function action(task:(signal:AbortSignal)=>Promise<void>){if(busy)return;const request=new AbortController();controller.current=request;setBusy(true);setError('');setMessage('');try{await task(request.signal);}catch(cause){if(active()&&!request.signal.aborted)setError(errorMessage(cause));}finally{if(active()&&!request.signal.aborted)setBusy(false);}}
 return <RequestedDetails className="source-item" requested={requested}><summary>{moteText('其他 Chatbot 与 MCP')}</summary>
  <p><a href="#/connections/access">{moteText('对外授权')}</a> · <code>/mcp</code></p>
  <h3>{moteText('从 MCP 服务导入可见资料')}</h3><p className="muted">{moteText('选择资源后执行一次导入；不会迁移其他 Chatbot 的隐藏记忆，不会自动调用外部写入工具。')}</p>
  {Boolean(error||config.error||sources.error)&&<p role="alert" className="error-banner">{error||errorMessage(config.error||sources.error)}</p>}
  <label>{moteText('外部 MCP 连接')}<select aria-label={moteText('外部 MCP 连接')} value={connectionId} disabled={busy} onChange={event=>{setConnectionId(event.target.value);setSourceId('');setRemote([]);setUris([]);setMessage('');}}><option value="">{moteText('请选择')}</option>{connections.map(connection=><option key={connection.id} value={connection.id}>{connection.id} · {connection.url}</option>)}</select></label>
  {selected&&<><p>{selected.enabled===false?moteText('已暂停'):moteText('已启用')}</p><label>{moteText('来源')}<select aria-label={moteText('MCP 来源名称')} value={chosenSource} disabled={busy} onChange={event=>setSourceId(event.target.value)}><option value="">{moteText('请选择')}</option>{eligible.map(source=><option key={source.id} value={source.id}>{source.name}</option>)}</select></label>
   <button className="button" disabled={busy||selected.enabled===false} onClick={()=>void action(async signal=>{const result=await api.request<{resources:{uri:string;name:string}[]}>('/api/connectors/mcp/discover',{method:'POST',body:JSON.stringify({connectionId:selected.id}),signal});if(!active())return;setRemote(result.resources);setUris([]);if(!result.resources.length)setMessage(moteText('这个服务没有列出可直接读取的资源。可通过支持的 Chatbot 显式写回资料。'));})}>{moteText('列出可读取资源')}</button>
   {remote.map(resource=><label className="source-toolbar" key={resource.uri}><input type="checkbox" checked={uris.includes(resource.uri)} disabled={busy} onChange={event=>setUris(value=>event.target.checked?[...value,resource.uri]:value.filter(uri=>uri!==resource.uri))}/>{resource.name}</label>)}
   {uris.length>0&&<button className="button primary" disabled={busy||!chosenSource||selected.enabled===false} onClick={()=>void action(async signal=>{const result=await api.request<{imported:number;duplicates:number}>('/api/connectors/mcp/import',{method:'POST',body:JSON.stringify({connectionId:selected.id,sourceId:chosenSource,resourceUris:uris}),signal});if(!active())return;setMessage(moteText('导入完成：{0} 条新资料，{1} 条已存在。',result.imported,result.duplicates));await refresh();})}>{moteText('导入选定资源')}</button>}
  </>}
  <details className="source-item"><summary>{moteText('新增数据源')}</summary><form onSubmit={event=>{event.preventDefault();if(!baseline)return;void action(async signal=>{const next=await prepareWebMcpConnection(api,baseline,{id,sourceId:id,name,url,token},signal);if(!active())return;setBaseline(next);setConnectionId(id);setSourceId(id);setId('mcp-'+crypto.randomUUID());setUrl('');setToken('');resources(api).invalidate(path=>path==='/api/configuration'||path==='/api/sources');setMessage(moteText('已保存到配置文件'));await refresh();});}}>
   <label>{moteText('服务地址')}<input aria-label={moteText('MCP 服务地址')} type="url" value={url} placeholder="https://example.com/mcp" required disabled={busy} onChange={event=>setUrl(event.target.value)}/></label>
   <label>{moteText('来源名称')}<input aria-label={moteText('MCP 来源名称')} value={name} required disabled={busy} onChange={event=>setName(event.target.value)}/></label>
   <label>{moteText('远端 Bearer 令牌（如需）')}<input aria-label={moteText('远端 MCP 令牌')} type="password" autoComplete="off" value={token} disabled={busy} onChange={event=>setToken(event.target.value)}/></label>
   <button className="button primary" disabled={busy||!baseline}>{moteText('保存并应用')}</button><button className="button subtle" type="button" disabled={busy} onClick={()=>void action(async signal=>{const next=await api.request<ConfigServiceView>('/api/configuration',{signal});if(!active())return;setBaseline(next);setName(moteText('MCP 导入资料'));setUrl('');setToken('');config.refresh();})}>{moteText('重新读取并还原草稿')}</button>
  </form></details>{message&&<p role="status">{message}</p>}
 </RequestedDetails>;
}
