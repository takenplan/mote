import {useEffect,useRef,useState} from 'react';
import {z} from 'zod';
import {moteText} from '@mote/shared/i18n';
import {errorMessage,type Api} from './api';
import {useResource} from './useResource';
import {localModelState} from './processing-state';

export type ManagedMediaRole='ocr'|'dialogue'|'speaker-wespeaker';
const modelSchema=z.object({state:z.enum(['not_installed','downloading','verifying','installing','ready','failed','cancelled']),bytes:z.number().finite().nonnegative(),totalBytes:z.number().finite().nonnegative(),source:z.string(),runtimeReady:z.boolean(),error:z.string().optional(),missingDependencies:z.array(z.enum(['ffmpeg','faster_whisper','sherpa_onnx'])).optional()});
const activeStates=new Set(['downloading','verifying','installing']);
/** Instance health is readable by every account. Installation does not select
 * a personal model, enable processing or confirm historical work. */
export function ManagedMediaModels(props:{api:Api;role:ManagedMediaRole}){return <MediaModel key={JSON.stringify([props.api.connection,props.role])} {...props}/>;}
function MediaModel({api,role}:{api:Api;role:ManagedMediaRole}){
 const read=useResource<Record<string,unknown>>(api,'/api/media-models'),parsed=modelSchema.safeParse(read.data?.[role]),model=parsed.success?parsed.data:undefined;
 const administrator=api.connection?.mode==='web'&&api.connection.administrator;
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),alive=useRef(false),pending=useRef<AbortController|undefined>(undefined);
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;pending.current?.abort();};},[api]);
 const updating=!!model&&(activeStates.has(model.state)||model.state==='ready'&&!model.runtimeReady);
 useResource(api,updating?'/api/media-models':null,updating?2000:undefined);
 async function mutate(action:'install'|'cancel'){
  if(!alive.current||pending.current||!administrator)return;
  const controller=new AbortController();pending.current=controller;setBusy(true);setError('');
  try{await api.request('/api/admin/media-models/'+role+'/'+action,{method:'POST',signal:controller.signal,body:JSON.stringify(action==='install'?{source:role==='speaker-wespeaker'?'official':'auto'}:{})});if(alive.current&&!controller.signal.aborted)read.refresh();}
  catch(cause){if(alive.current&&!controller.signal.aborted)setError(errorMessage(cause));}
  finally{if(alive.current&&pending.current===controller){pending.current=undefined;setBusy(false);}}
 }
 const title=role==='ocr'?moteText('本地 OCR 模型：'):role==='dialogue'?moteText('本地转写与说话人模型：'):moteText('可选 WeSpeaker 中文声纹模型');
 const installLabel=role==='ocr'?moteText('下载并安装 OCR 模型'):role==='dialogue'?moteText('下载并安装本地音频模型'):moteText('安装可选声纹模型');
 return <div className="policy-card" data-media-role={role}><strong>{title}{localModelState(model?.state)}</strong>
  {model?.state==='ready'&&<p role="status">{role==='ocr'?model.runtimeReady?moteText('OCR Worker 已就绪'):moteText('模型已安装，正在准备本地 OCR 服务；就绪后会自动处理'):role==='dialogue'?model.runtimeReady?moteText('转写与说话人 Worker 已就绪'):model.missingDependencies?.length?moteText('模型已安装，服务缺少运行依赖：{0}',model.missingDependencies.join(', ')):moteText('模型已安装，等待音频 Worker 启动或安装 Native 运行时'):model.runtimeReady?moteText('已就绪'):moteText('等待音频 Worker')}</p>}
  {model&&activeStates.has(model.state)&&model.totalBytes>0&&<progress aria-label={title} value={model.bytes} max={model.totalBytes}/>}
  {administrator&&model&&model.state!=='ready'&&!activeStates.has(model.state)&&<button type="button" className="button" disabled={busy} onClick={()=>void mutate('install')}>{installLabel}</button>}
  {administrator&&model&&activeStates.has(model.state)&&<button type="button" className="button subtle" disabled={busy} onClick={()=>void mutate('cancel')}>{moteText('取消下载')}</button>}
  {!administrator&&model?.state!=='ready'&&<small>{moteText('仅管理员可安装本机模型。')}</small>}
  {role==='speaker-wespeaker'&&<p>{moteText('仅选用此插件的录音使用此模型；下载不会更改默认方案。')}</p>}
  {role==='dialogue'&&<p>{moteText('新上传录音默认在中央转写并区分匿名说话人；模型未就绪时先归档。单文件时长可在下方设置，不设每日限额。')}</p>}
  {read.data!==undefined&&!parsed.success&&<p role="alert">{moteText('状态读取失败，请重试。')}</p>}{model?.error&&<p role="alert">{model.error}</p>}{read.error!==undefined&&<p role="alert">{errorMessage(read.error)}</p>}{error&&<p role="alert">{error}</p>}
  <button type="button" className="text-button" disabled={busy} onClick={read.refresh}>{moteText('刷新')}</button>
 </div>;
}
