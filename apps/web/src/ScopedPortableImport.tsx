import {useEffect,useRef,useState} from 'react';
import {moteText} from '@mote/shared/i18n';
import {type Api,dateTime,errorMessage} from './api';
import {useResource} from './useResource';
import {resources} from './resource-cache';
import {lifecycleReceipt,lifecycleLabel,type LifecycleReceipt} from './lifecycle-receipt';
const selectedImport=()=>{const id=new URLSearchParams(window.location.hash.split('?')[1]??'').get('import');return id&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(id)?id:undefined;};

/** Original file-picker flow over M16's single canonical merge engine. Archive
 * content remains in this account component only; durable history is server-owned. */
export function ScopedPortableImport({api}:{api:Api}){
 const connection=api.connection;if(connection?.mode!=='web')throw Error(moteText('服务返回的操作回执与当前账号不一致。'));
 const userId=connection.userId,deploymentId=connection.deploymentId,base='/api/portable/imports',input=useRef<HTMLInputElement>(null),owner=useRef(api),alive=useRef(true),inFlight=useRef(false),intent=useRef<{id:string;body:string}|undefined>(undefined),retryId=useRef<string|undefined>(undefined);owner.current=api;
 const [id,setId]=useState<string|undefined>(selectedImport),[cursor,setCursor]=useState<string>(),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const live=(fixed:Api)=>alive.current&&owner.current===fixed;
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;intent.current=undefined;};},[api]);
 useEffect(()=>{const changed=()=>setId(selectedImport());window.addEventListener('hashchange',changed);return()=>window.removeEventListener('hashchange',changed);},[api]);
 const select=(value:string)=>{setId(value);const [route,text]=window.location.hash.split('?'),query=new URLSearchParams(text);query.set('import',value);window.history.replaceState(window.history.state,'',route+'?'+query);window.dispatchEvent(new window.Event('mote:workspace-state'));};
 const path=id?base+'/'+encodeURIComponent(id):null,page=useResource<{items:unknown[];nextCursor:string|null}>(api,base+'?limit=20'+(cursor?'&cursor='+encodeURIComponent(cursor):'')),selected=useResource<unknown>(api,path);
 let receipt:LifecycleReceipt|undefined,items:LifecycleReceipt[]=[],readError=selected.error??page.error;
 try{if(selected.data)receipt=lifecycleReceipt(api,selected.data,'import',userId,id);items=(page.data?.items??[]).map(value=>lifecycleReceipt(api,value,'import',userId));}catch(e){readError=e;}
 useEffect(()=>path&&receipt?.state==='working'?resources(api).get(path).poll(1000):undefined,[api,path,receipt?.state]);
 useEffect(()=>{if(receipt&&receipt.state!=='working'){resources(api).invalidate(key=>key.startsWith(base+'?'));if(receipt.state==='completed')resources(api).invalidate(key=>!key.startsWith('/api/portable/'));}},[api,receipt?.id,receipt?.state]);
 const refresh=()=>resources(api).invalidate(key=>key.startsWith(base));
 async function submit(fixed:Api,operation:{id:string;body:string}){
  try{lifecycleReceipt(fixed,await fixed.request(base,{method:'POST',body:operation.body}),'import',userId,operation.id);if(!live(fixed))return;intent.current=undefined;refresh();}
  catch(e){if(live(fixed)){setError(errorMessage(e));refresh();}}
  finally{if(live(fixed)){inFlight.current=false;setBusy(false);}}
 }
 async function importFile(file?:File){
  if(!file||inFlight.current||!live(api))return;const fixed=api;inFlight.current=true;setBusy(true);setError('');
  try{const archive=JSON.parse(await file.text());if(!live(fixed))return;
   if(!archive||archive.format!=='mote-portable'||archive.version!==3||archive.deploymentId!==deploymentId||archive.userId!==userId)throw Error(moteText('请选择原部署和原账号的 Mote portable3 归档。'));
   const operationId=retryId.current??crypto.randomUUID();retryId.current=undefined;const operation={id:operationId,body:JSON.stringify({operationId,archive})};intent.current=operation;select(operationId);await submit(fixed,operation);
  }catch(e){if(live(fixed)){setError(errorMessage(e));inFlight.current=false;setBusy(false);}}
  finally{if(live(fixed)&&input.current)input.current.value='';}
 }
 function retry(){if(inFlight.current||!live(api))return;if(intent.current){inFlight.current=true;setBusy(true);setError('');void submit(api,intent.current);}else if(receipt){retryId.current=receipt.id;input.current?.click();}}
 async function cancel(){if(!receipt||inFlight.current||!live(api))return;const fixed=api,target=receipt.id;inFlight.current=true;setBusy(true);setError('');try{lifecycleReceipt(fixed,await fixed.request(base+'/'+target+'/cancel',{method:'POST',body:'{}'}),'import',userId,target);if(live(fixed)){intent.current=undefined;refresh();}}catch(e){if(live(fixed))setError(errorMessage(e));}finally{if(live(fixed)){inFlight.current=false;setBusy(false);}}}
 return <div className="portable-import"><div className="transfer-action"><div><h3>{moteText('导入归档')}</h3><p>{moteText('仅合并原部署和原账号的规范资料；当前设置、凭据和执行授权保持不变。')}</p></div><button className="button subtle" disabled={busy} onClick={()=>{if(!live(api))return;retryId.current=undefined;input.current?.click();}}>{moteText('选择文件')}</button><input ref={input} className="hidden" type="file" accept="application/json,.json" aria-label={moteText('导入 Mote 归档')} onChange={event=>void importFile(event.target.files?.[0])}/></div>
 {(error||readError!==undefined)&&<p className="error-banner" role="alert">{error||errorMessage(readError)}</p>}
 {receipt&&<section className="portable-import-receipt" aria-live="polite"><h3>{lifecycleLabel(receipt.state)}</h3><p>{dateTime(receipt.createdAt)}</p><p>{moteText('当前阶段：{0}',receipt.phase)}</p>{receipt.error&&<p role="status">{receipt.error}</p>}<details><summary>{moteText('覆盖范围与处理状态')}</summary>{receipt.domains.map(domain=><p key={domain.domain}>{domain.domain} · {domain.state}</p>)}</details>{receipt.state==='working'&&<button className="button subtle" disabled={busy} onClick={()=>void cancel()}>{moteText('取消导入')}</button>}</section>}
 {(intent.current||receipt?.state==='failed')&&<><p>{moteText('重试需使用同一归档和原操作；刷新后请选择原文件。')}</p><button className="button" disabled={busy} onClick={retry}>{moteText('重试导入')}</button></>}
 <div className="connection-list">{items.map(item=><button className="button subtle" key={item.id} onClick={()=>select(item.id)}>{dateTime(item.createdAt)} · {lifecycleLabel(item.state)}</button>)}</div><div className="processing-actions">{cursor&&<button className="button" onClick={()=>setCursor(undefined)}>{moteText('返回第一页')}</button>}{page.data?.nextCursor&&<button className="button" onClick={()=>setCursor(page.data!.nextCursor!)}>{moteText('下一页')}</button>}<button className="button subtle" onClick={refresh}>{moteText('刷新')}</button></div></div>;
}
