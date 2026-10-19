import {useEffect,useRef,useState} from 'react';
import {z} from 'zod';
import {moteText} from '@mote/shared/i18n';
import type {ConfigServiceView} from '@mote/shared';
import {errorMessage,type Api} from './api';
import type {CatalogModel} from './model-reasoning';
import type {ScopedModelSettings} from './ScopedModelFields';

const catalogSchema=z.object({items:z.array(z.object({id:z.string().min(1),name:z.string().min(1),reasoningEfforts:z.array(z.string()).optional(),defaultReasoningEffort:z.string().optional(),serviceTiers:z.array(z.string()).optional()}))});
const probeSchema=z.object({ok:z.boolean(),code:z.enum(['ok','not_configured','timeout','provider_error','invalid_response']),message:z.string(),durationMs:z.number().finite().nonnegative()}).refine(value=>value.ok===(value.code==='ok'));
export type ModelToolsContext={revision:number;dirty:boolean;busy?:boolean;credentialApprovals?:Record<string,string>;onCredentialApproval?:(id:string,destination:string|undefined)=>void;onApplied:(view:ConfigServiceView)=>void};

/** Personal directory/probe uses the current draft; shared resources stay fixed. */
export function ScopedModelTools({api,id,name,kind='personal',tools,draft,allowCredentialReuse=false,requiresCredentialApproval=false,onSelect,onCatalog,directoryOnly=false}:{api:Api;id:string;name:string;kind?:'personal'|'shared';tools:ModelToolsContext;draft?:ScopedModelSettings;allowCredentialReuse?:boolean;requiresCredentialApproval?:boolean;onSelect?:(id:string)=>void;onCatalog?:(items:CatalogModel[])=>void;directoryOnly?:boolean}){
 const live=useRef(false),generation=useRef(0),request=useRef<AbortController|undefined>(undefined),onCatalogRef=useRef(onCatalog);onCatalogRef.current=onCatalog;
 const [operation,setOperation]=useState<'catalog'|'probe'|'copy'>(),[error,setError]=useState(''),[message,setMessage]=useState(''),[catalog,setCatalog]=useState<CatalogModel[]>([]),[copyName,setCopyName]=useState<string|null>(null),[includeCredentials,setIncludeCredentials]=useState(true),[reload,setReload]=useState(0);
 const operationRef=useRef<string|undefined>(undefined);
 const busy=!!operation||!!tools.busy,blocked=requiresCredentialApproval&&!allowCredentialReuse;
 const draftKey=JSON.stringify(draft),catalogKey=draft?JSON.stringify([draft.provider,draft.protocol,draft.baseUrl,draft.apiKey,draft.headers,draft.extraBody,allowCredentialReuse]):'';
 useEffect(()=>{live.current=true;return()=>{live.current=false;generation.current++;request.current?.abort();};},[api,id,kind]);
 useEffect(()=>{generation.current++;request.current?.abort();setOperation(undefined);operationRef.current=undefined;setError('');setMessage('');setCopyName(null);},[api,id,kind,tools.revision,draftKey,allowCredentialReuse]);
 async function run(operation:'catalog'|'probe'|'copy',automatic=false){
  if(!live.current||tools.busy||blocked||!!operationRef.current||(!automatic&&busy)||operation==='copy'&&tools.dirty)return;
  const controller=new AbortController(),epoch=++generation.current,current=()=>live.current&&epoch===generation.current&&!controller.signal.aborted;
  request.current?.abort();request.current=controller;operationRef.current=operation;setOperation(operation);setError('');if(operation!=='catalog')setMessage('');
  try{
   const reference={kind,id},input={revision:tools.revision,reference,...(kind==='personal'&&draft?{draft}:{}),...(allowCredentialReuse?{allowCredentialReuse:true}:{})};
   if(operation==='catalog'){
    const result=catalogSchema.parse(await api.request('/api/models/catalog',{method:'POST',body:JSON.stringify(input),signal:controller.signal}));
    if(current()){setCatalog(result.items);onCatalogRef.current?.(result.items);}
   }else if(operation==='probe'){
    const result=probeSchema.parse(await api.request('/api/models/probe',{method:'POST',body:JSON.stringify(input),signal:controller.signal}));
    if(current())setMessage(result.message+(tools.dirty?moteText('；保存后才会应用草稿。'):''));
   }else{
    if(kind!=='personal'||!copyName?.trim())return;
    const copyId=crypto.randomUUID(),next=await api.request<ConfigServiceView>('/api/models/profiles/'+encodeURIComponent(id)+'/copy',{method:'POST',body:JSON.stringify({revision:tools.revision,id:copyId,name:copyName.trim(),includeCredentials}),signal:controller.signal});
    if(current())tools.onApplied(next);
   }
  }catch(cause){if(current())setError(errorMessage(cause));}
  finally{if(current()){setOperation(undefined);operationRef.current=undefined;}}
 }
 useEffect(()=>{setCatalog([]);onCatalogRef.current?.([]);if(!draft||blocked||tools.busy||!draft.baseUrl&&draft.protocol!=='codex-app-server')return;const timer=setTimeout(()=>{void run('catalog',true);},500);return()=>{clearTimeout(timer);};},[api,id,kind,tools.revision,catalogKey,reload,blocked,tools.busy]);
 const canProbe=kind==='shared'||Boolean(draft?.model)||draft?.protocol==='mote-media';
 return <div className="provider-actions scoped-model-tools">
  {onSelect&&<label className="preference-field">{moteText('可用模型')}<select aria-label={moteText('可用模型')} disabled={busy||blocked} value="" onChange={event=>{if(live.current&&event.target.value)onSelect(event.target.value);}}><option value="">{operation==='catalog'?moteText('正在读取模型列表…'):moteText('选择模型，或在下方手动填写')}</option>{catalog.map(model=><option key={model.id} value={model.id}>{model.name===model.id?model.id:model.name+' · '+model.id}</option>)}</select></label>}
  <div className="provider-action-buttons"><button type="button" className="button subtle" disabled={busy||blocked} onClick={()=>draft?setReload(n=>n+1):void run('catalog')}>{moteText('刷新模型列表')}</button>{!directoryOnly&&<><button type="button" className="button subtle" disabled={busy||blocked||!canProbe} onClick={()=>void run('probe')}>{moteText('测试连接')}</button>{kind==='personal'&&<button type="button" className="button subtle" disabled={busy||tools.dirty} onClick={()=>{if(!live.current)return;setCopyName((name+moteText(' 副本')).slice(0,100));setIncludeCredentials(true);}}>{moteText('复制预设')}</button>}</>}</div>
  {!onSelect&&catalog.length>0&&<ul>{catalog.map(model=><li key={model.id}>{model.name} · {model.id}</li>)}</ul>}
  {draft&&<small>{moteText('根据当前地址和凭据自动加载；目录可见不代表支持工具调用，可使用下方测试连接验证。')}</small>}{!directoryOnly&&<small>{moteText('测试连接会由中央节点发送少量合成内容，最多等待 30 秒，可能产生少量费用；不会读取资料库。测试不会保存草稿。')}</small>}
  {copyName!==null&&<div className="provider-inline-form"><label>{moteText('副本名称')}<input aria-label={moteText('副本名称')} maxLength={100} value={copyName} onChange={event=>setCopyName(event.target.value)} disabled={busy}/></label><label className="provider-copy-choice"><input type="checkbox" aria-label={moteText('同时复制凭据和高级参数（仅在服务器内部复制）')} checked={includeCredentials} onChange={event=>setIncludeCredentials(event.target.checked)} disabled={busy}/>{moteText('同时复制凭据和高级参数（仅在服务器内部复制）')}</label><button type="button" className="button primary" disabled={busy||tools.dirty||!copyName.trim()} onClick={()=>void run('copy')}>{moteText('创建副本')}</button><button type="button" className="button subtle" disabled={busy} onClick={()=>setCopyName(null)}>{moteText('取消')}</button></div>}
  {error&&<p className="notice error" role="alert">{error}</p>}{message&&<p role="status">{message}</p>}
 </div>;
}
