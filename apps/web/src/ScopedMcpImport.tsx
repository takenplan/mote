import {useEffect,useRef,useState} from 'react';
import type {ConfigServiceView} from '@mote/shared';
import {moteText} from '@mote/shared/i18n';
import {errorMessage,type Api} from './api';
import {useResource} from './useResource';
import {webMcpConnections} from './web-mcp';
import {RequestedDetails} from './RequestedDetails';

type Props={api:Api;refresh:()=>Promise<void>;requested:boolean};
export function ScopedMcpImport(props:Props){
 const connection=props.api.connection;
 return <OwnedMcpImport key={connection?.mode==='web'?JSON.stringify([connection.origin,connection.deploymentId,connection.userId,connection.credentialId,connection.viewScope]):'legacy'} {...props}/>;
}
/** The original one-time discovery/selection/import journey uses the same owner
 * importer as optional saved connections. Discovery never writes configuration. */
function OwnedMcpImport({api,refresh,requested}:Props){
 const config=useResource<ConfigServiceView>(api,'/api/configuration'),sources=useResource<{items:{id:string;name:string;kind:string;enabled:boolean}[]}>(api,'/api/sources');
 const connections=config.data?webMcpConnections(config.data):[],[connectionId,setConnectionId]=useState(''),[sourceId,setSourceId]=useState('');
 const selected=connections.find(connection=>connection.id===connectionId),eligible=selected?.sourceIds.flatMap(id=>sources.data?.items.filter(source=>source.id===id&&source.kind==='mcp'&&source.enabled)??[])??[];
 const chosenSource=sourceId||(eligible.length===1?eligible[0].id:'');
 const [name,setName]=useState(moteText('MCP 导入资料')),[url,setUrl]=useState(''),[token,setToken]=useState('');
 const [remote,setRemote]=useState<{uri:string;name:string}[]>([]),[uris,setUris]=useState<string[]>([]),[busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
 const controller=useRef<AbortController|undefined>(undefined),owner=useRef<Api|undefined>(api);owner.current=api;
 useEffect(()=>{owner.current=api;return()=>{controller.current?.abort();if(owner.current===api)owner.current=undefined;};},[api]);
 const active=()=>owner.current===api;
 const clearSelection=()=>{setRemote([]);setUris([]);setMessage('');};
 async function action(task:(signal:AbortSignal)=>Promise<void>){if(busy)return;const request=new AbortController();controller.current=request;setBusy(true);setError('');setMessage('');try{await task(request.signal);}catch(cause){if(active()&&!request.signal.aborted)setError(errorMessage(cause));}finally{if(active()&&!request.signal.aborted)setBusy(false);}}
 return <RequestedDetails className="source-item" requested={requested}><summary>{moteText('其他 Chatbot 与 MCP')}</summary>
  <p><a href="#/connections/access">{moteText('对外授权')}</a> · <code>/mcp</code></p>
  <h3>{moteText('从 MCP 服务导入可见资料')}</h3><p className="muted">{moteText('选择资源后执行一次导入；不会迁移其他 Chatbot 的隐藏记忆，不会自动调用外部写入工具。')}</p>
  {Boolean(error)&&<p role="alert" className="error-banner">{error}</p>}
  {connections.length>0&&<label>{moteText('外部 MCP 连接')}<select aria-label={moteText('外部 MCP 连接')} value={connectionId} disabled={busy} onChange={event=>{setConnectionId(event.target.value);setSourceId('');clearSelection();}}><option value="">{moteText('服务地址')}</option>{connections.map(connection=><option key={connection.id} value={connection.id}>{connection.id} · {connection.url}</option>)}</select></label>}
  {selected?<><p>{selected.enabled===false?moteText('已暂停'):moteText('已启用')}</p><label>{moteText('来源')}<select aria-label={moteText('MCP 来源名称')} value={chosenSource} disabled={busy} onChange={event=>setSourceId(event.target.value)}><option value="">{moteText('请选择')}</option>{eligible.map(source=><option key={source.id} value={source.id}>{source.name}</option>)}</select></label></>:<>
   <label>{moteText('服务地址')}<input aria-label={moteText('MCP 服务地址')} type="url" value={url} placeholder="https://example.com/mcp" disabled={busy} onChange={event=>{setUrl(event.target.value);clearSelection();}}/></label>
   <label>{moteText('来源名称')}<input aria-label={moteText('MCP 来源名称')} value={name} disabled={busy} onChange={event=>setName(event.target.value)}/></label>
   <label>{moteText('远端 Bearer 令牌（如需）')}<input aria-label={moteText('远端 MCP 令牌')} type="password" autoComplete="off" value={token} disabled={busy} onChange={event=>{setToken(event.target.value);clearSelection();}}/></label>
  </>}
  <button className="button" disabled={busy||(selected?selected.enabled===false:!url.trim())} onClick={()=>void action(async signal=>{const result=await api.request<{resources:{uri:string;name:string}[]}>('/api/connectors/mcp/discover',{method:'POST',body:JSON.stringify(selected?{connectionId:selected.id}:{url,token:token||undefined}),signal});if(!active())return;setRemote(result.resources);setUris([]);if(!result.resources.length)setMessage(moteText('这个服务没有列出可直接读取的资源。可通过支持的 Chatbot 显式写回资料。'));})}>{moteText('列出可读取资源')}</button>
  {remote.map(resource=><label className="source-toolbar" key={resource.uri}><input type="checkbox" checked={uris.includes(resource.uri)} disabled={busy} onChange={event=>setUris(value=>event.target.checked?[...value,resource.uri]:value.filter(uri=>uri!==resource.uri))}/>{resource.name}</label>)}
  {uris.length>0&&<button className="button primary" disabled={busy||(selected?!chosenSource||selected.enabled===false:!name.trim())} onClick={()=>void action(async signal=>{
   let targetSource=chosenSource;
   if(!selected){
    targetSource='mcp-'+crypto.randomUUID();
    await api.request('/api/ingress/devices',{method:'POST',body:JSON.stringify({id:'mcp-import',name,platform:'import'}),signal});if(!active())return;
    await api.request('/api/ingress/sources',{method:'POST',body:JSON.stringify({id:targetSource,name,kind:'mcp',deviceId:'mcp-import',platform:'import',retention:'snapshot',enabled:true}),signal});if(!active())return;
   }
   const result=await api.request<{imported:number;duplicates:number}>('/api/connectors/mcp/import',{method:'POST',body:JSON.stringify({...(selected?{connectionId:selected.id}:{url,token:token||undefined}),sourceId:targetSource,resourceUris:uris}),signal});if(!active())return;
   if(!selected)setToken('');setMessage(moteText('导入完成：{0} 条新资料，{1} 条已存在。',result.imported,result.duplicates));await refresh();
  })}>{moteText('导入选定资源')}</button>}
  {message&&<p role="status">{message}</p>}
 </RequestedDetails>;
}
