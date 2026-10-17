import {formatEvidenceRef,matchesFileType,type ProcessingProfile} from '@mote/shared';
import {moteText} from '@mote/shared/i18n';
import {useLayoutEffect,useRef,useState} from 'react';
import {apiOwnerKey,errorMessage,type Api} from './api';
import {useResource} from './useResource';
import {resources} from './resource-cache';

type Options={processingProfileId?:string;mimeType?:string};
type Detail={captureId:string;item:{document?:{attachmentOf?:{captureId:string;fileId:string}}};processing:{processingRequired:boolean}};
const uuid=/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i;
const optionsValid=(value:Options)=>value&&typeof value==='object'&&Object.keys(value).every(key=>['processingProfileId','mimeType'].includes(key))&&(value.processingProfileId===undefined||/^[a-z][a-z0-9.-]{0,99}$/.test(value.processingProfileId))&&(value.mimeType===undefined||/^[a-z0-9.+-]+\/[a-z0-9.+-]+$/.test(value.mimeType));

/** An explicit adaptation of the existing parent/archive preparation command.
 * Only selected options survive reload; publication and idempotence belong to
 * M03's exact attachment binding, never a browser-created task/grant. */
export function AttachmentProcessing(props:{api:Api;parentId:string;fileId:string;mimeType?:string;onOpen?:(ref:string)=>void}){
 return <AttachmentProcessingContents key={JSON.stringify([props.api.connection,props.parentId,props.fileId,props.mimeType])} {...props}/>;
}
function AttachmentProcessingContents({api,parentId,fileId,mimeType,onOpen}:{api:Api;parentId:string;fileId:string;mimeType?:string;onOpen?:(ref:string)=>void}){
 const plans=useResource<{policy:{profiles:ProcessingProfile[]};processors:{id:string;mediaTypes:string[]}[]}>(api,'/api/file-processing');
 const [profile,setProfile]=useState(''),[declaredMime,setMime]=useState(mimeType??''),[pending,setPending]=useState<string>(),[error,setError]=useState(''),[busy,setBusy]=useState(false),[detail,setDetail]=useState<Detail>();
 const alive=useRef(false),request=useRef<AbortController|undefined>(undefined),intent=useRef<string|undefined>(undefined),key='mote.attachment-preparation.v1:'+JSON.stringify([apiOwnerKey(api),parentId,fileId]);
 useLayoutEffect(()=>{alive.current=true;try{const body=localStorage.getItem(key);if(body){const value=JSON.parse(body);if(!optionsValid(value))throw Error(moteText('服务返回的操作回执与当前账号不一致。'));intent.current=body;setPending(body);setProfile(value.processingProfileId??'');setMime(value.mimeType??mimeType??'');}}catch(e){setError(errorMessage(e));}return()=>{alive.current=false;request.current?.abort();request.current=undefined;};},[api,key,mimeType]);
 const live=(controller:AbortController)=>alive.current&&request.current===controller&&!controller.signal.aborted;
 async function prepare(){
  if(!alive.current||request.current)return;const controller=new AbortController();request.current=controller;setBusy(true);setError('');
  try{
   const body=intent.current??JSON.stringify({...(!mimeType||mimeType==='application/octet-stream'?{mimeType:declaredMime}:{}),...(profile?{processingProfileId:profile}:{})});
   if(!optionsValid(JSON.parse(body))||effectiveMime==='application/octet-stream')throw Error(moteText('请选择有效的附件 MIME 类型。'));
   localStorage.setItem(key,body);intent.current=body;setPending(body);
   const receipt=await api.request<{captureId:string;parentId:string;attachmentId:string;duplicate:boolean}>('/api/records/'+encodeURIComponent(parentId)+'/attachments/'+encodeURIComponent(fileId)+'/processing',{method:'POST',body,signal:controller.signal});if(!live(controller))return;
   if(!uuid.test(receipt.captureId)||receipt.parentId!==parentId||receipt.attachmentId!==fileId||typeof receipt.duplicate!=='boolean')throw Error(moteText('服务返回的操作回执与当前账号不一致。'));
   const value=await api.request<Detail>('/api/files/'+encodeURIComponent(receipt.captureId),{signal:controller.signal});if(!live(controller))return;
   if(value.captureId!==receipt.captureId||value.item?.document?.attachmentOf?.captureId!==parentId||value.item.document.attachmentOf.fileId!==fileId||typeof value.processing?.processingRequired!=='boolean')throw Error(moteText('服务返回的操作回执与当前账号不一致。'));
   if(localStorage.getItem(key)===body)localStorage.removeItem(key);intent.current=undefined;setPending(undefined);setDetail(value);resources(api).invalidate(path=>/^\/api\/(files|capture-browser|library|materials)([/?]|$)/.test(path));
  }catch(e){if(live(controller))setError(errorMessage(e));}finally{if(live(controller)){request.current=undefined;setBusy(false);}}
 }
 const effectiveMime=mimeType&&mimeType!=='application/octet-stream'?mimeType:declaredMime,choices=plans.data?.policy.profiles.filter(value=>value.processorId==='archive'||plans.data?.processors.some(processor=>processor.id===value.processorId&&processor.mediaTypes.some(type=>matchesFileType(type.endsWith('/')?type+'*':type,effectiveMime))))??[];
 return <div className="attachment-processing">
  {!detail?<><label>{moteText('处理方案')}<select aria-label={moteText('附件处理方案')} disabled={busy||!!pending} value={profile} onChange={event=>setProfile(event.target.value)}><option value="">{moteText('跟随默认设置')}</option>{choices.map(value=><option key={value.id} value={value.id}>{value.name}</option>)}{profile&&!choices.some(value=>value.id===profile)&&<option value={profile}>{profile} · {moteText('组件暂不可用')}</option>}</select></label>
   {(!mimeType||mimeType==='application/octet-stream')&&<label>{moteText('附件 MIME 类型')}<input aria-label={moteText('附件 MIME 类型')} disabled={busy||!!pending} value={declaredMime} onChange={event=>setMime(event.target.value)}/></label>}
   <button className="button subtle" type="button" disabled={busy||(!pending&&!plans.data)||!effectiveMime||effectiveMime==='application/octet-stream'} onClick={()=>void prepare()}>{busy?moteText('正在读取…'):pending?moteText('重试原操作'):moteText('处理附件')}</button>{pending&&<p className="muted">{moteText('重试保留原附件和处理方案；不会更换已经准入的处理。')}</p>}
  </>:<><p role="status">{detail.processing.processingRequired?moteText('附件已登记，可查看实际处理状态。'):moteText('无需内容处理')}</p>{onOpen&&<button type="button" className="button subtle" onClick={()=>{if(alive.current)onOpen(formatEvidenceRef('capture',detail.captureId));}}>{moteText('查看附件')}</button>}</>}
  {(error||plans.error!==undefined)&&<p role="alert">{error||errorMessage(plans.error)}{plans.error!==undefined&&<button className="text-button" type="button" onClick={plans.refresh}>{moteText('重新读取')}</button>}</p>}
 </div>;
}
