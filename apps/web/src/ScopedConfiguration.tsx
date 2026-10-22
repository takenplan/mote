import {automationChecked,automationToggle,automationIntent} from './configuration-automation';
import {MemoryOperations} from './MemoryOperations';
import {MemoryRecipeSelection} from './MemoryRecipeSelection';
import {ScopedModelsForm,type ScopedModelsValue} from './ScopedModelsForm';
import {credentialDestination,scopedCredentialsNeedConfirmation} from './ScopedModelFields';
import {MemoryLifecycleFields} from './MemorySettings';
import {useEffect,useRef,useState} from 'react';
import {moteText} from '@mote/shared/i18n';
import type {ConfigDomainView,ConfigServiceView} from '@mote/shared';
import {errorMessage,type Api} from './api';
import {useResource} from './useResource';
import {resources} from './resource-cache';
import {useUnsavedChanges} from './unsaved';
import {FileProcessingSettings} from './FileProcessingSettings';
import {ContentStorage} from './ContentStorage';
import {ScopedStorageSettings} from './ScopedStorageSettings';
import {PerceptionSettings} from './PerceptionSettings';
import {ScopedConnectionFields} from './ScopedConnectionFields';
import {ModelStartGuide} from './ModelStartGuide';
import {useHashChoice} from './useHashChoice';
import {settingsCategoryFromHash,type SettingsCategory} from './route-query';

const categories:{id:SettingsCategory;title:string;description:string}[]=[
 {id:'providers',title:'模型连接（Provider）',description:'保存模型服务的地址与凭据，选择模型并按需测试连接'},
 {id:'model',title:'模块与模型',description:'为各模块分配预设和模型，设置记忆与回顾'},
 {id:'images',title:'图片',description:'统一文字识别、画面理解与历史补处理'},
 {id:'file-processing',title:'文件与语音',description:'本地语音模型、转写与文件处理策略'},
 {id:'storage',title:'保留与容量',description:'历史保留周期与资料库容量'},
 {id:'embedding',title:'检索索引',description:'全文检索与可选向量模型'},
 {id:'connectors',title:'来源与外部应用',description:'同步频率、Google 日历与 MCP'},
];
const domainNames:Record<string,string>={models:'模型连接与功能分配',modelPrices:'模型价格',memory:'记忆与洞察的节奏',mcpConnections:'外部 MCP 连接',connectorSettings:'来源与外部应用',agentTrace:'记录详细 Agent 过程',storage:'内容存储',actions:'行动设置',processing:'文件与语音',fileProcessingPolicy:'中央文件处理设置'};

/** Retains one scoped CAS draft, including separate saved/effective feedback. */
function DomainEditor({api,domain,view,administrator=false,mode='all',expandedByDefault=true}:{api:Api;domain:ConfigDomainView;view:ConfigServiceView;administrator?:boolean;mode?:'providers'|'assignments'|'all';expandedByDefault?:boolean}){
 const [base,setBase]=useState(view),[text,setText]=useState(()=>JSON.stringify(domain.saved,null,2)),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(''),[expanded,setExpanded]=useState(expandedByDefault),[credentialApprovals,setCredentialApprovals]=useState<Record<string,string>>({}),[automationPaths,setAutomationPaths]=useState<string[]>([]);
 const alive=useRef(false),request=useRef<AbortController|undefined>(undefined);
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;request.current?.abort();};},[api]);
 let value:any;try{value=JSON.parse(text);}catch{}
 const coordinatedDomain=base.domains.find(item=>item.id===domain.id)??domain,saved=coordinatedDomain.saved,initial=JSON.stringify(saved,null,2),dirty=text!==initial||automationPaths.length>0;
 useUnsavedChanges(dirty);
 useEffect(()=>{if(!dirty){setBase(view);setText(JSON.stringify(domain.saved,null,2));setCredentialApprovals({});setAutomationPaths([]);}},[view,domain]);
 const change=(next:unknown)=>{setText(JSON.stringify(next,null,2));setNotice('');setError('');};
 const apply=(next:ConfigServiceView)=>{if(!alive.current)return;setBase(next);setText(JSON.stringify(next.domains.find(item=>item.id===domain.id)?.saved,null,2));setCredentialApprovals({});setAutomationPaths([]);resources(api).invalidate(key=>key==='/api/configuration'||key==='/api/models'||key==='/api/admin/configuration/models');};
 async function save(){
  if(!alive.current||busy)return;const controller=new AbortController();request.current=controller;setBusy(true);setError('');setNotice('');
  try{
   const nextValue=JSON.parse(text),path=administrator?'/api/admin/configuration/models':'/api/configuration/'+encodeURIComponent(domain.id);
   let allowCredentialReuse=false;
   if(domain.id==='models'){
    const models=nextValue as ScopedModelsValue,previous=saved as ScopedModelsValue;
    const risky=models.profiles.filter(profile=>scopedCredentialsNeedConfirmation(profile.settings,previous.profiles.find(item=>item.id===profile.id)?.settings)).map(profile=>({id:profile.id,settings:profile.settings}));
    if(models.deployment&&scopedCredentialsNeedConfirmation(models.deployment,previous.deployment))risky.push({id:'__deployment__',settings:models.deployment});
    if(risky.some(profile=>credentialApprovals[profile.id]!==credentialDestination(profile.settings)))throw Error(moteText('服务或地址已改变。请填写新凭据、清除旧凭据，或明确允许在新地址复用。'));
    allowCredentialReuse=risky.length>0;
   }
   const next=await api.request<ConfigServiceView>(path,{method:'PUT',signal:controller.signal,body:JSON.stringify({revision:base.revision,value:nextValue,preserveRedactedSecrets:true,...(automationPaths.length?{automationIntent:automationIntent(domain.id,automationPaths)}:{}),...(allowCredentialReuse?{allowCredentialReuse:true}:{})})});
   if(!alive.current||controller.signal.aborted)return;apply(next);setNotice(next.domains.find(item=>item.id===domain.id)?.status==='restart-required'?moteText('已保存到配置文件；标记的设置需要重启后生效。'):moteText('已保存。选择此配置的新请求将立即使用这些设置。'));
  }catch(cause){if(alive.current&&!controller.signal.aborted)setError(errorMessage(cause));}finally{if(alive.current&&!controller.signal.aborted)setBusy(false);}
 }
 return <details open={expanded} onToggle={event=>setExpanded(event.currentTarget.open)} className="panel advanced-config-group" data-domain={domain.id}><summary><strong>{moteText(domainNames[domain.id]??domain.id)}</strong> · {domain.status==='applied'?moteText('已应用'):domain.status==='restart-required'?moteText('重启后生效'):moteText('配置应用失败')}</summary>
  <p>{moteText('版本 {0}',base.revision)}</p>{coordinatedDomain.automation?.some(item=>item.state==='waiting_authorization')&&<p role="status">{moteText('尚未授权')}</p>}{coordinatedDomain.automation?.some(item=>item.state==='paused')&&<p role="status">{moteText('已暂停')}</p>}{expanded&&<form onSubmit={event=>{event.preventDefault();void save();}}><fieldset className="model-settings-fields" disabled={busy}>
   {domain.id==='memory'&&value?.lifecycle&&<><p>{moteText('历史资料提取、长期整理与对话工作记忆达到增量门槛或最大等待时间时运行；自动洞察需要周期与增量门槛同时达到。窗口任务每分钟检查一次，进行中的窗口沿用启动时的设置。')}</p><MemoryLifecycleFields draft={{...value.lifecycle,...Object.fromEntries((['working','insights'] as const).map(kind=>[kind,{...value.lifecycle[kind],enabled:automationChecked(coordinatedDomain,'lifecycle.'+kind+'.enabled',value.lifecycle[kind].enabled,(saved as any)?.lifecycle[kind].enabled,automationPaths)}]))}} setDraft={lifecycle=>{for(const kind of ['working','insights'] as const){const path='lifecycle.'+kind+'.enabled',before=automationChecked(coordinatedDomain,path,value.lifecycle[kind].enabled,(saved as any)?.lifecycle[kind].enabled,automationPaths);if(lifecycle[kind].enabled!==before)setAutomationPaths(paths=>automationToggle(paths,path,lifecycle[kind].enabled));else lifecycle={...lifecycle,[kind]:{...lifecycle[kind],enabled:value.lifecycle[kind].enabled}};}change({...value,lifecycle});}} busy={busy}/><label>{moteText('默认时区')}<input aria-label={moteText('默认时区')} value={value.timeZone} onChange={event=>change({...value,timeZone:event.target.value})}/></label></>}
   {domain.id==='models'&&value&&<ScopedModelsForm api={api} value={value} savedValue={saved as ScopedModelsValue} onChange={change} administrator={administrator} mode={mode} tools={{revision:base.revision,dirty,busy,credentialApprovals,onCredentialApproval:(id,destination)=>setCredentialApprovals(previous=>{const next={...previous};if(destination)next[id]=destination;else delete next[id];return next;}),onApplied:apply}}/>}
   {domain.id==='agentTrace'&&value&&<><label className="preference-toggle"><span>{moteText('记录详细 Agent 过程')}</span><input type="checkbox" checked={value.traceEnabled} onChange={event=>change({...value,traceEnabled:event.target.checked})}/></label><p className="fine-print">{moteText('详细过程与运行日志使用相同的 JSON 行格式，包含 prompt、上下文、模型输出和工具过程，可能包含个人内容。关闭后立即停止新增详细记录。')}</p></>}
   {domain.id==='actions'&&value&&<><label><input type="checkbox" checked={automationChecked(coordinatedDomain,'enabled',value.enabled,(saved as any)?.enabled,automationPaths)} onChange={event=>{setAutomationPaths(paths=>automationToggle(paths,'enabled',event.target.checked));change({...value,enabled:event.target.checked});}}/>{moteText('分析已归档及后续新增的上传资料和持续采集内容')}</label><label>{moteText('解释时间使用的时区')}<input aria-label={moteText('默认时区')} value={value.timeZone} onChange={event=>change({...value,timeZone:event.target.value})}/></label><a href="#/actions">{moteText('发现设置与设备授权')}</a></>}
   {domain.id==='storage'&&value&&<label><input type="checkbox" checked={value.contentEncryptionEnabled} onChange={event=>change({...value,contentEncryptionEnabled:event.target.checked})}/>{moteText('加密后续保存的图片和原件')}</label>}
   {domain.id==='modelPrices'&&<a href="#/system/usage">{moteText('用量与费用')}</a>}
   {(domain.id==='connectorSettings'||domain.id==='mcpConnections')&&value&&<ScopedConnectionFields api={api} domain={domain.id} value={value} onChange={change}/>}
   {domain.id==='plugins'&&<a href="#/system/plugins">{moteText('自动记忆与插件')}</a>}
   {['processing','fileProcessingPolicy'].includes(domain.id)&&<a href="#/system/models?category=file-processing">{moteText('文件与语音')}</a>}
   <details><summary>{moteText('高级设置')}</summary><label>{moteText('文件中保存的值')}<textarea aria-label={domain.id+' '+moteText('配置')} value={text} onChange={event=>{setText(event.target.value);setNotice('');}} rows={12} spellCheck={false}/></label></details>
   {error&&<p className="notice error" role="alert">{error}</p>}{notice&&<p role="status">{notice}</p>}
   <div className="config-draft-footer"><span>{dirty?moteText('有未保存的修改，仅保留在当前页面'):moteText('当前没有未保存的修改')}</span><div><button className="button primary" disabled={busy||!dirty}>{moteText('保存并应用')}</button><button type="button" className="button subtle" disabled={busy} onClick={()=>{setBase(view);setText(JSON.stringify(domain.saved,null,2));setCredentialApprovals({});setAutomationPaths([]);setError('');setNotice('');}}>{moteText('重新读取并还原草稿')}</button></div></div>
  </fieldset></form>}{domain.id==='memory'&&expanded&&<><MemoryRecipeSelection api={api}/><MemoryOperations api={api}/></>}<details><summary>{moteText('当前生效值')}</summary><pre>{JSON.stringify(domain.effective,null,2)}</pre></details>
 </details>;
}
export function ScopedConfiguration(props:{api:Api;administrator?:boolean}){return <ScopedConfigurationContents key={JSON.stringify([props.api.connection,props.administrator])} {...props}/>;}
function ScopedConfigurationContents({api,administrator=false}:{api:Api;administrator?:boolean}){
 const [category,setCategory]=useHashChoice('category',settingsCategoryFromHash),read=useResource<ConfigServiceView>(api,administrator?'/api/admin/configuration/models':'/api/configuration'),selected=categories.find(item=>item.id===category);
 const domain=(id:string,mode:'providers'|'assignments'|'all'='all')=>{const found=read.data?.domains.find(item=>item.id===id);return found&&<DomainEditor key={id+mode} api={api} domain={found} view={read.data!} administrator={administrator} mode={mode}/>;};
 return <section className="server-settings"><button className="back-link workspace-back" onClick={()=>category?setCategory(null):window.location.hash='#/preferences'}>{moteText('返回上级')}</button><div className="page-heading settings-heading"><div><h1>{administrator?moteText('共享模型资源'):selected?moteText(selected.title):moteText('模型与服务')}</h1><p>{selected?moteText(selected.description):moteText('连接、记录与理解，各自有清楚的位置。')}</p></div><button className="button subtle" onClick={read.refresh}>{moteText('刷新生效配置')}</button></div>
  {read.error!==undefined&&<p role="alert">{errorMessage(read.error)}</p>}{!read.data&&read.loading&&<p role="status">{moteText('正在读取节点设置…')}</p>}
  {administrator?domain('models'):!category?<><ModelStartGuide/><div className="settings-category-label">{moteText('偏好设置')}</div><div className="preference-menu">{categories.map(item=><button key={item.id} aria-label={moteText(item.title)} className="preference-menu-row" onClick={()=>setCategory(item.id)}><span><strong>{moteText(item.title)}</strong><small>{moteText(item.description)}</small></span></button>)}</div></>:<>
   {category==='providers'&&<><ModelStartGuide step="connection"/>{domain('models','providers')}</>}
   {category==='model'&&<><ModelStartGuide step="module"/>{domain('models','assignments')}<details className="discovery-settings-advanced"><summary>{moteText('高级：记忆、洞察与自动处理节奏')}</summary>{domain('memory')}</details></>}
   {category==='file-processing'&&<FileProcessingSettings api={api}/>}
   {category==='images'&&<PerceptionSettings api={api} onMemory={()=>setCategory('model')} onAdvanced={()=>setCategory('file-processing')}/>}
   {category==='storage'&&<><ContentStorage api={api}/>{api.connection?.mode==='web'&&api.connection.administrator&&<ScopedStorageSettings api={api}/>}</>}
   {category==='embedding'&&<><p>{moteText('文本检索始终可用。配置向量索引后，文本会提交给你选择的 Embedding 服务。')}</p>{domain('models','assignments')}</>}
   {category==='connectors'&&<><p><a href="#/connections">{moteText('来源与外部应用')}</a></p>{domain('connectorSettings')}{domain('mcpConnections')}</>}
  </>}
  {!administrator&&read.data&&<details className="advanced-config-group"><summary>{moteText('部署与全部生效配置')}</summary>{read.data.domains.map(item=><DomainEditor key={item.id} api={api} domain={item} view={read.data!} expandedByDefault={false}/>)}</details>}
 </section>;
}
