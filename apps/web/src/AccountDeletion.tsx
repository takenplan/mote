import {useEffect,useRef,useState} from 'react';
import {moteText} from '@mote/shared/i18n';
import {type Api,dateTime,errorMessage} from './api';
import {useResource} from './useResource';
import {resources} from './resource-cache';
import {PluginModal} from './PluginModal';
import {changeWebAuthentication} from './web-auth';
import {lifecycleReceipt,lifecycleLabel,type LifecycleReceipt} from './lifecycle-receipt';

export function AccountDeletion({api,account}:{api:Api;account:{userId:string;username:string;deletionId?:string}}){
 const [dialog,setDialog]=useState<{api:Api;userId:string;username:string;operationId:string;opener:HTMLElement}|undefined>(undefined),[id,setId]=useState<string>(),[busy,setBusy]=useState(false),[error,setError]=useState(''),[show,setShow]=useState(false);
 const active=useRef(true);useEffect(()=>{active.current=true;return()=>{active.current=false;};},[]);
 const receiptId=id??account.deletionId,read=useResource<unknown>(api,show&&receiptId?'/api/admin/account-deletions/'+encodeURIComponent(receiptId):null,1000);
 let receipt:LifecycleReceipt|undefined,readError=read.error;try{if(read.data)receipt=lifecycleReceipt(api,read.data,'delete',account.userId,receiptId);}catch(e){readError=e;}
 async function submit(){const intent=dialog;if(!intent||busy||!active.current)return;setBusy(true);setError('');try{
  const request=()=>intent.api.request('/api/admin/accounts/'+encodeURIComponent(intent.userId),{method:'DELETE',body:JSON.stringify({operationId:intent.operationId})}),self=intent.api.connection?.mode==='web'&&intent.api.connection.userId===intent.userId;
  const value=await (self?changeWebAuthentication(request,false):request());if(self)intent.api.close?.();
  const result=lifecycleReceipt(intent.api,value,'delete',intent.userId,intent.operationId);if(!active.current)return;
  setDialog(undefined);setId(result.id);setShow(true);resources(intent.api).invalidate(key=>key==='/api/admin/accounts');
 }catch(e){if(active.current)setError(errorMessage(e));}finally{if(active.current)setBusy(false);}}
 async function retry(){if(!receiptId||busy||!active.current)return;const fixed=api,target=receiptId;setBusy(true);setError('');try{lifecycleReceipt(fixed,await fixed.request('/api/admin/account-deletions/'+target+'/retry',{method:'POST',body:'{}'}),'delete',account.userId,target);if(active.current)read.refresh();}catch(e){if(active.current)setError(errorMessage(e));}finally{if(active.current)setBusy(false);}}
 return <>{receiptId?<button className="button subtle" onClick={()=>setShow(value=>!value)}>{moteText('查看删除进度')}</button>:<button className="button subtle" onClick={event=>setDialog({api,userId:account.userId,username:account.username,operationId:crypto.randomUUID(),opener:event.currentTarget})}>{moteText('删除账号')}</button>}
 {(error||readError!==undefined)&&<p role="alert">{error||errorMessage(readError)}</p>}
 {receipt&&show&&<section className="account-deletion-receipt" aria-live="polite"><strong>{lifecycleLabel(receipt.state)}</strong><p>{moteText('账号访问已撤销；清除结果以此回执为准。')}</p><p>{dateTime(receipt.updatedAt)}</p>{receipt.error&&<p role="status">{receipt.error}</p>}<details><summary>{moteText('覆盖范围与处理状态')}</summary>{receipt.domains.map(domain=><p key={domain.domain}>{domain.domain} · {domain.state}</p>)}</details>{['failed','blocked','pending','result_unknown'].includes(receipt.state)&&<button className="button" disabled={busy} onClick={()=>void retry()}>{moteText('重试')}</button>}</section>}
 {dialog&&<PluginModal title={moteText('删除账号')} opener={dialog.opener} close={()=>setDialog(undefined)} busy={busy}><p><strong>{dialog.username}</strong></p><p>{moteText('确认后立即撤销此账号访问，并按持久回执清除资料。外部结果不确定时不会显示清除完成。')}</p><button className="button danger" disabled={busy} onClick={()=>void submit()}>{moteText('确认删除账号')}</button><button className="button subtle" disabled={busy} onClick={()=>setDialog(undefined)}>{moteText('取消')}</button></PluginModal>}</>;
}
