import { moteText } from '@mote/shared/i18n';
import {useEffect,useRef,useState} from 'react';
import {ApiError,type Api,errorMessage} from './api';
import {useResource} from './useResource';
import {invalidateConfiguration} from './configuration-cache';

interface StorageState {
  enabled:boolean;
  revision:number;
  job:{state:'idle'|'running'|'completed'|'cancelled';total:number;processed:number;converted:number;skipped:number;failed:number};
}
export function ContentStorage({api,onChange}:{api:Api;onChange?:()=>void}) {
  const [view,setView]=useState<{api:Api;value:StorageState}>();
  const state=view?.api===api?view.value:undefined,activeApi=useRef(api);activeApi.current=api;
  const setState=(value:StorageState)=>{if(activeApi.current===api)setView(previous=>previous?.api===api&&previous.value.revision>value.revision?previous:{api,value});};
  const [error,setError]=useState('');
  const [busy,setBusy]=useState(false);
  const read=useResource<StorageState>(api,'/api/content-storage',state?.job.state==='running'?500:undefined);
  useEffect(()=>{setError('');setBusy(false);},[api]);
  useEffect(()=>{if(read.data)setState(read.data);if(read.error){setError(errorMessage(read.error));if(read.error instanceof ApiError&&[401,403,404,410].includes(read.error.status))setView(undefined);}},[api,read.data,read.error]);
  async function change(path:string,method:string,body:object) {
    setBusy(true);setError('');
    try{const next=await api.request<StorageState>(path,{method,body:JSON.stringify(body)});if(activeApi.current===api){setState(next);invalidateConfiguration(api);onChange?.();}}
    catch(e){if(activeApi.current===api)setError(e instanceof ApiError&&e.status===409?moteText('配置已被其他会话更新。请重新读取生效配置，再编辑并保存。'):errorMessage(e));}finally{if(activeApi.current===api)setBusy(false);}
  }
  const running=state?.job.state==='running';
  return <section className="panel" aria-labelledby="content-storage-title">
    <div className="section-heading"><div><h2 id="content-storage-title">{moteText("内容存储")}</h2><p>{moteText("中央节点 · 默认明文保存")}</p></div></div>
    <label className="check-field"><input type="checkbox" checked={state?.enabled??false} disabled={!state||busy||running}
      onChange={event=>void change('/api/content-storage','PUT',{enabled:event.target.checked,revision:state!.revision})}/>{moteText("加密后续保存的图片和原件")}</label>
    <p className="fine-print">{moteText("开关立即生效，已有文件保持原格式并可继续读取。记录正文和索引存储在 SQLite 中；客户端的本地存储可在各自开发者选项中设置。")}</p>
    <div className="diagnostics-actions">
      <button className="button subtle" disabled={!state||state.enabled||busy||running} onClick={()=>void change('/api/content-storage/decrypt','POST',{})}>{moteText("一次性批量解密")}</button>
      {running&&<button className="button subtle" disabled={busy} onClick={()=>void change('/api/content-storage/decrypt/cancel','POST',{})}>{moteText("取消解密")}</button>}
    </div>
    <p className="fine-print">{moteText("关闭上方加密后，可将已有图片、原件和待上传分片逐项转换为明文。任务在后台运行，离开页面仍会继续；取消后保留已完成结果，可再次运行。连接凭据不参与转换。")}</p>
    {!state&&!error&&<p role="status">{moteText("正在读取存储设置…")}</p>}
    {state&&state.job.state!=='idle'&&<div role="status" aria-live="polite">
      {running?moteText("正在解密"):state.job.state==='cancelled'?moteText("已取消"):moteText("处理完成")}{' '}{moteText("· 已检查")}{' '}{state.job.processed}/{state.job.total}{' '}{moteText("项 · 已转换")}{' '}{state.job.converted}{' '}{moteText("项 · 无需转换")}{' '}{state.job.skipped}{' '}{moteText("项 · 失败")}{' '}{state.job.failed}{' '}{moteText("项")}{running&&<progress aria-label={moteText("批量解密进度")} value={state.job.processed} max={Math.max(1,state.job.total)}/>}
      {state.job.failed>0&&<p>{moteText("失败项保留原文件，请检查原密钥和存储空间后重试。")}</p>}
    </div>}
    {error&&<p className="notice error" role="alert">{error}</p>}
    {error&&<button className="button subtle" disabled={busy} onClick={()=>void api.request<StorageState>('/api/content-storage').then(value=>{if(activeApi.current===api){setState(value);setError('');}},e=>{if(activeApi.current===api)setError(errorMessage(e));})}>{moteText('重新读取')}</button>}
  </section>;
}
