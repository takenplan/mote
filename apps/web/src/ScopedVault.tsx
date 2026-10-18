import {FilesExport} from './FilesExport';
import {useEffect,useRef,useState} from 'react';
import {moteText} from '@mote/shared/i18n';
import {ArrowDownToLine,Info,Unplug} from 'lucide-react';
import {type Api,errorMessage} from './api';
import {ScopedPortableImport} from './ScopedPortableImport';

export function ScopedVault({api,embedded,disconnect}:{api:Api;embedded?:boolean;disconnect:()=>void}){
 const connection=api.connection;if(connection?.mode!=='web')throw Error(moteText('服务返回的操作回执与当前账号不一致。'));
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),owner=useRef(api),alive=useRef(true),active=useRef<AbortController|undefined>(undefined);owner.current=api;
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;active.current?.abort();};},[api]);
 const live=(value:Api)=>alive.current&&owner.current===value;
 async function download(){if(busy||!live(api))return;const fixed=api,controller=new AbortController();active.current=controller;setBusy(true);setError('');try{
  const response=await fixed.raw('/api/export',{signal:controller.signal}),buffer=await response.arrayBuffer();if(!live(fixed)||controller.signal.aborted)return;
  const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',buffer)),v=>v.toString(16).padStart(2,'0')).join('');if(!live(fixed)||controller.signal.aborted)return;
  if(response.status!==200||response.headers.get('content-type')!=='application/json; charset=utf-8'||Number(response.headers.get('content-length'))!==buffer.byteLength||response.headers.get('etag')!=='"'+digest+'"')throw Error(moteText('归档校验失败，请重新导出。'));
  const filename=/filename="([^"]+)"/.exec(response.headers.get('content-disposition')??'')?.[1]??'mote-portable.json',url=URL.createObjectURL(new Blob([buffer],{type:'application/json'})),anchor=document.createElement('a');anchor.href=url;anchor.download=filename;anchor.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
 }catch(e){if(live(fixed)&&!controller.signal.aborted)setError(errorMessage(e));}finally{if(active.current===controller)active.current=undefined;if(live(fixed))setBusy(false);}}
 return <><div className={embedded?'section-heading':'page-heading'}>{embedded?<h2>{moteText('数据与备份')}</h2>:<h1>{moteText('数据与备份')}</h1>}<p>{moteText('知道留下了什么、存在哪里，也随时保留迁移的自由。')}</p></div>
 {error&&<p className="error-banner" role="alert">{error}</p>}
 <section className="panel storage-panel"><h2>{moteText('存储概况')}</h2><a className="button subtle" href="#/system">{moteText('查看运行状态与空间')}</a></section>
 <section className="panel transfer-panel"><div className="section-heading"><h2>{moteText('导入与导出')}</h2><ArrowDownToLine size={21}/></div><div className="transfer-action transfer-export"><div><h3>{moteText('导出资料')}</h3><p>{moteText('仅导出当前账号的规范资料；凭据、执行授权和实例备份不包含在内。')}</p></div><button className="button subtle" disabled={busy} onClick={()=>void download()}>{moteText('导出')}</button>{busy&&<button className="button subtle" onClick={()=>active.current?.abort()}>{moteText('取消')}</button>}</div>
 <FilesExport key={JSON.stringify(api.connection)} api={api}/>
 <ScopedPortableImport api={api}/>
 <div className="backup-note"><Info size={16}/><div><strong>{moteText('大资料库适合使用离线备份')}</strong><p>{moteText('实例备份与恢复由中央节点停机命令执行。')}</p><code>npm run backup -- --help</code></div></div></section>
 <section className="panel node-settings"><div><strong>{moteText('当前服务（中央节点）')}</strong><p>{connection.origin}</p></div><button className="button subtle" onClick={disconnect}><Unplug size={15}/>{moteText('退出登录')}</button></section></>;
}
