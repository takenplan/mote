import {ScopedModelsForm} from './ScopedModelsForm';
import {useEffect,useState} from 'react';
import {moteText} from '@mote/shared/i18n';
import type {ConfigDomainView,ConfigServiceView} from '@mote/shared';
import {errorMessage,type Api} from './api';
import {useResource} from './useResource';
import {resources} from './resource-cache';
import {useUnsavedChanges} from './unsaved';

/** Reuse the existing registry/saved/effective layout and M04 schema/CAS. */
function DomainEditor({api,domain,view,administrator=false}:{api:Api;domain:ConfigDomainView;view:ConfigServiceView;administrator?:boolean}){
 const [base,setBase]=useState(view),[text,setText]=useState(()=>JSON.stringify(domain.saved,null,2)),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 let modelValue:any;try{modelValue=JSON.parse(text);}catch{}
 const initial=JSON.stringify(base.domains.find(item=>item.id===domain.id)?.saved,null,2),dirty=text!==initial;
 useUnsavedChanges(dirty);
 useEffect(()=>{if(!dirty){setBase(view);setText(JSON.stringify(domain.saved,null,2));}},[view,domain]);
 return <details open={domain.id==='models'} className="panel advanced-config-group"><summary><strong>{domain.id==='models'?moteText('模型连接与功能分配'):domain.id==='modelPrices'?moteText('模型价格'):domain.id==='mcpConnections'?moteText('外部 MCP 连接'):domain.id}</strong> · {domain.status==='applied'?moteText('已应用'):domain.status==='restart-required'?moteText('重启后生效'):moteText('配置应用失败')}</summary>
  <p>{moteText('版本 {0}',base.revision)}</p><form onSubmit={event=>{event.preventDefault();if(busy)return;setBusy(true);setError('');setNotice('');void (async()=>{
   try{const value=JSON.parse(text),path=administrator?'/api/admin/configuration/models':'/api/configuration/'+encodeURIComponent(domain.id);const next=await api.request<ConfigServiceView>(path,{method:'PUT',body:JSON.stringify({revision:base.revision,value,preserveRedactedSecrets:true})});setBase(next);setText(JSON.stringify(next.domains.find(item=>item.id===domain.id)?.saved,null,2));resources(api).invalidate(key=>key==='/api/configuration'||key==='/api/models'||key==='/api/admin/configuration/models');setNotice(moteText('已保存到配置文件'));}catch(e){setError(errorMessage(e));}finally{setBusy(false);}
  })();}}>
   {domain.id==='models'&&modelValue&&<ScopedModelsForm api={api} value={modelValue} onChange={value=>setText(JSON.stringify(value,null,2))} administrator={administrator}/>}
   <details><summary>{moteText('高级设置')}</summary><label>{moteText('文件中保存的值')}<textarea aria-label={domain.id+' '+moteText('配置')} value={text} onChange={e=>setText(e.target.value)} rows={12} spellCheck={false}/></label></details>
   <p className="fine-print">{moteText('凭据的 true / false 仅表示配置状态；保持原值会保留同一条目的凭据。填写新值可替换，清空字符串可清除。')}</p>
   {error&&<p className="notice error" role="alert">{error}</p>}{notice&&<p role="status">{notice}</p>}
   <button className="button primary" disabled={busy||!dirty}>{moteText('保存并应用')}</button><button type="button" className="button subtle" disabled={busy} onClick={()=>{setBase(view);setText(JSON.stringify(domain.saved,null,2));setError('');}}>{moteText('重新读取并还原草稿')}</button>
  </form><details><summary>{moteText('当前生效值')}</summary><pre>{JSON.stringify(domain.effective,null,2)}</pre></details>
 </details>;
}
export function ScopedConfiguration({api,administrator=false}:{api:Api;administrator?:boolean}){
 const read=useResource<ConfigServiceView>(api,administrator?'/api/admin/configuration/models':'/api/configuration');
 return <section className="server-settings"><div className="page-heading settings-heading"><h1>{administrator?moteText('共享模型资源'):moteText('模型与服务')}</h1><button className="button subtle" onClick={read.refresh}>{moteText('刷新生效配置')}</button></div>
  {read.error!==undefined&&<p role="alert">{errorMessage(read.error)}</p>}{!read.data&&read.loading&&<p role="status">{moteText('正在读取节点设置…')}</p>}
  {read.data?.domains.map(domain=><DomainEditor key={domain.id} api={api} domain={domain} view={read.data!} administrator={administrator}/>)}
 </section>;
}
