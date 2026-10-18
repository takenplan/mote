import {useEffect,useRef,useState} from 'react';
import {moteText} from '@mote/shared/i18n';
import {type Api,bytes,errorMessage} from './api';
import {useResource} from './useResource';
import {resources} from './resource-cache';
import {useUnsavedChanges} from './unsaved';

type Values={retentionDays:number;maxStorageBytes:number};
export type InstanceStorageView={scope:'instance';revision:number;saved:Values;effective:Values;status:'applied'|'restart-required'|'invalid'};
const mib=1024*1024;
/** Retention and capacity remain instance policy; only an administrator edits
 * the existing saved/effective restart contract through the LIFE scoped port. */
export function ScopedStorageSettings({api}:{api:Api}){return <StorageSettings key={JSON.stringify(api.connection)} api={api}/>;}
function StorageSettings({api}:{api:Api}){
 const read=useResource<InstanceStorageView>(api,'/api/admin/storage-settings'),[base,setBase]=useState<InstanceStorageView>(),[days,setDays]=useState(''),[capacity,setCapacity]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(''),alive=useRef(false),request=useRef<AbortController|undefined>(undefined);
 const dirty=!!base&&(days!==String(base.saved.retentionDays)||capacity!==String(base.saved.maxStorageBytes/mib));
 useUnsavedChanges(dirty);
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;request.current?.abort();};},[api]);
 const reset=(view:InstanceStorageView)=>{setBase(view);setDays(String(view.saved.retentionDays));setCapacity(String(view.saved.maxStorageBytes/mib));setError('');setNotice('');};
 useEffect(()=>{if(read.data&&!dirty){setBase(read.data);setDays(String(read.data.saved.retentionDays));setCapacity(String(read.data.saved.maxStorageBytes/mib));}},[read.data]);
 async function save(){
  if(!base||busy||!alive.current)return;const controller=new AbortController();request.current=controller;setBusy(true);setError('');setNotice('');
  try{
   const retentionDays=Number(days),capacityMib=Number(capacity);
   if(!days||!Number.isInteger(retentionDays)||retentionDays<0||retentionDays>36500)throw Error(moteText('{0} 需要 {1}–{2} 之间的整数。',moteText('自定义保留天数'),0,36500));
   if(!capacity||!Number.isFinite(capacityMib)||!Number.isSafeInteger(capacityMib*mib)||capacityMib<1||capacityMib>1000000)throw Error(moteText('请检查此项的输入格式'));
   const next=await api.request<InstanceStorageView>('/api/admin/storage-settings',{method:'PUT',signal:controller.signal,body:JSON.stringify({revision:base.revision,retentionDays,maxStorageBytes:capacityMib*mib})});
   if(!alive.current||controller.signal.aborted)return;reset(next);resources(api).invalidate(path=>path==='/api/admin/storage-settings');if(next.status==='invalid')setError(moteText('配置应用失败'));else setNotice(moteText(next.status==='restart-required'?'已保存到配置文件；标记的设置需要重启后生效。':'已保存，立即生效。'));
  }catch(cause){if(alive.current&&!controller.signal.aborted)setError(errorMessage(cause));}finally{if(alive.current&&!controller.signal.aborted)setBusy(false);}
 }
 const dayOptions=[['0','持续保留'],['30','30 天'],['90','90 天'],['180','180 天'],['365','1 年']],capacityOptions=[['1024','1 GiB'],['5120','5 GiB'],['10240','10 GiB'],['51200','50 GiB'],['102400','100 GiB']];
 return <section className="panel config-builder" aria-label={moteText('保留与容量')}><div className="section-heading"><div><h2>{moteText('保留与容量')}</h2><p>{moteText('页面与手改文件使用同一份配置；保存后按各项生效方式应用。')}</p></div></div>{read.error!==undefined&&<p role="alert" className="notice error">{errorMessage(read.error)}</p>}{!base&&read.loading&&<p role="status">{moteText('正在读取节点设置…')}</p>}{base&&<><form onSubmit={event=>{event.preventDefault();void save();}}><fieldset className="model-settings-fields" disabled={busy}><div className="preference-grid"><label className="preference-field">{moteText('历史记录保留')}<select aria-label={moteText('历史记录保留')} value={days} onChange={event=>{setDays(event.target.value);setNotice('');}}>{!dayOptions.some(([value])=>value===days)&&<option value={days}>{moteText('当前自定义值 ·')} {days}</option>}{dayOptions.map(([value,label])=><option key={value} value={value}>{moteText(label)}</option>)}</select></label><label className="preference-field">{moteText('资料容量上限')}<select aria-label={moteText('资料容量上限')} value={capacity} onChange={event=>{setCapacity(event.target.value);setNotice('');}}>{!capacityOptions.some(([value])=>value===capacity)&&<option value={capacity}>{moteText('当前自定义值 ·')} {capacity} MiB</option>}{capacityOptions.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label></div><p className="preference-note">{moteText('正数保留周期会按采集时间自动清理旧记录。保存前请确认所选周期；需要重启的设置会保留当前有效值。')}</p><details className="preference-advanced"><summary>{moteText('自定义保留与容量')}</summary><div className="preference-grid"><label>{moteText('自定义保留天数')}<input aria-label={moteText('自定义保留天数')} type="number" min={0} max={36500} step={1} required value={days} onChange={event=>setDays(event.target.value)}/></label><label>{moteText('自定义容量（MiB）')}<input aria-label={moteText('自定义容量（MiB）')} type="number" min={1} max={1000000} step="any" required value={capacity} onChange={event=>setCapacity(event.target.value)}/></label></div></details>{error&&<p role="alert" className="notice error">{error}</p>}<div className="config-draft-footer"><span>{dirty?moteText('有未保存的修改，仅保留在当前页面'):moteText('当前没有未保存的修改')}</span><div><button type="button" className="button subtle" disabled={busy||!dirty} onClick={()=>reset(read.data??base)}>{moteText('还原草稿')}</button><button className="button primary" disabled={busy||!dirty}>{moteText('保存并应用')}</button></div></div></fieldset></form>{notice&&<p role="status">{notice}</p>}<section className="effective-settings"><h3>{moteText('当前生效值')}</h3><div className="effective-field"><strong>{moteText('历史记录保留')}</strong><span>{base.effective.retentionDays?base.effective.retentionDays+' '+moteText('天'):moteText('持续保留')}</span></div><div className="effective-field"><strong>{moteText('资料容量上限')}</strong><span>{bytes(base.effective.maxStorageBytes)}</span></div>{base.status==='restart-required'&&<p>{moteText('重启后生效')}</p>}{base.status==='invalid'&&<p role="alert">{moteText('配置应用失败')}</p>}</section></>}</section>;
}
