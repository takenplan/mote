import React,{useEffect,useRef,useState} from 'react';
import {moteText} from '@mote/shared/i18n';
import {errorMessage} from './api';
import {ProviderAuthorization} from './ProviderAuthorization';
import {useResource} from './useResource';
import type {RecordingApi,RecordingTask} from './scoped-recording-api';

export function authorizationProblem(error:unknown){
 const code=error instanceof Error?error.message:'';
 if(['lark_authorization_expired','dingtalk_authorization_expired'].includes(code))return moteText('授权链接已过期，请重新发起授权。');
 if(['lark_cli_missing','dingtalk_cli_missing','lark_cli_version_unsupported','dingtalk_cli_version_unsupported'].includes(code))return moteText('缺失或版本不符时，请管理员运行当前部署的 connectors-prepare，再重新检测。');
 if(code==='lark_not_configured')return moteText('请先创建飞书应用或保存已有应用配置，再发起授权。');
 if(['lark_operation_timeout','dingtalk_operation_timeout'].includes(code))return moteText('授权尚未完成或链接已过期，请重新发起授权。');
 return errorMessage(error);
}
export function RecordingAuthorization({api,provider,task,inactive}:{api:RecordingApi;provider:string;task?:RecordingTask;inactive:boolean}){
 const path='/api/connectors/'+provider+'-recordings',read=useResource<{connected:boolean;environment?:{installed:boolean;version?:string;configured:boolean;error?:string}}>(api,path,2000),scope=useRef(new AbortController());
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[appId,setAppId]=useState(''),[secret,setSecret]=useState(''),[brand,setBrand]=useState<'feishu'|'lark'>('feishu');
 useEffect(()=>{const controller=new AbortController();scope.current=controller;return()=>controller.abort();},[api]);
 const environment=read.data?.environment,running=task&&['waiting','running'].includes(task.state),disabled=inactive||busy||Boolean(running);
 async function run(operation:string,payload?:unknown){if(disabled)return;setBusy(true);setError('');try{await api.request(path+'/'+operation,{method:'POST',body:JSON.stringify(payload??{}),signal:scope.current.signal});if(!scope.current.signal.aborted)read.refresh();}catch(error){if(!scope.current.signal.aborted)setError(authorizationProblem(error));}finally{if(!scope.current.signal.aborted)setBusy(false);}}
 return <section className="panel lark-step recording-authorization"><div className="section-heading"><h2>{moteText('账号授权')}</h2>{environment?.version&&<span className="badge muted">{provider==='feishu'?'Lark CLI':'DWS'} {environment.version}</span>}</div><p>{moteText('CLI 由当前中央部署准备，账号凭据仅保存在当前连接的隔离目录。')}</p>
 <div className="lark-buttons"><button className="button subtle" disabled={disabled} onClick={()=>void run('check')}>{moteText('重新检测')}</button><button className="button primary" disabled={disabled} onClick={()=>void run('login')}>{read.data?.connected?moteText('重新授权 / 更换账号'):moteText('授权并连接账号')}</button>{provider==='feishu'&&<button className="button subtle" disabled={disabled||environment?.configured} onClick={()=>void run('setup')}>{moteText('创建飞书应用')}</button>}</div>
 {environment?.error&&<div className="notice error"><p>{moteText('连接环境尚未就绪。请核对当前部署的 CLI 和应用配置，再重新检测。')}</p><code>{environment.error}</code><p>{moteText('缺失或版本不符时，请管理员运行当前部署的 connectors-prepare，再重新检测。')}</p></div>}
 {provider==='feishu'&&<details className="lark-manual"><summary>{moteText('使用已有应用')}</summary><p>{moteText('凭据仅发往当前中央节点，并通过标准输入写入此连接的隔离配置。')}</p><form onSubmit={event=>{event.preventDefault();const value=secret;setSecret('');void run('configure',{appId,secret:value,brand});}}><label>App ID<input required pattern="cli_[A-Za-z0-9]+" maxLength={100} value={appId} disabled={disabled} onInput={event=>setAppId(event.currentTarget.value)}/></label><label>App Secret<input type="password" required autoComplete="new-password" value={secret} maxLength={1000} disabled={disabled} onInput={event=>setSecret(event.currentTarget.value)}/></label><label>{moteText('服务区域')}<select value={brand} disabled={disabled} onChange={event=>setBrand(event.target.value as 'feishu'|'lark')}><option value="feishu">{moteText('飞书（中国）')}</option><option value="lark">Lark</option></select></label><button className="button primary" disabled={disabled||!appId||!secret}>{moteText('保存应用配置')}</button></form></details>}
 {provider==='dingtalk'&&<p className="fine-print">{moteText('钉钉所在组织需开启 CLI 接入；请在授权页面核对账号、组织和读取权限。')}</p>}
 {running&&task.progress?.authorizationUrl&&<ProviderAuthorization provider={provider==='feishu'?'lark':'dingtalk'} url={task.progress.authorizationUrl} expiresAt={task.progress.expiresAt}/>}
 {error&&<p role="alert">{error}</p>}
 </section>;
}
