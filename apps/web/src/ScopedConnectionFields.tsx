import {useEffect,useState} from 'react';
import {moteText} from '@mote/shared/i18n';
import type {Api} from './api';
import {useResource} from './useResource';

/** Reuses the source connection controls inside the same scoped domain draft. */
export function ScopedConnectionFields({api,domain,value,onChange}:{api:Api;domain:'connectorSettings'|'mcpConnections';value:{connections:any[]};onChange:(value:{connections:any[]})=>void}){
 const sources=useResource<{items:{id:string;name:string;kind:string}[]}>(api,domain==='mcpConnections'?'/api/sources':null);
 const update=(index:number,patch:Record<string,unknown>)=>onChange({...value,connections:value.connections.map((item,i)=>i===index?{...item,...patch}:item)});
 return <>{value.connections.map((connection,index)=><details className="policy-card" key={connection.id}><summary>{connection.id}{connection.provider?' · '+connection.provider:''}</summary><div className="preference-grid">
  <label>{moteText('连接 ID')}<input aria-label={moteText('连接 ID')} value={connection.id} readOnly/></label>
  {domain==='connectorSettings'?<><label><input type="checkbox" checked={connection.autoSync} onChange={event=>update(index,{autoSync:event.target.checked})}/>{moteText('自动同步')}</label><label>{moteText('同步间隔（分钟）')}<input aria-label={moteText('同步间隔（分钟）')} type="number" min={1} max={2147483647/60000} step="any" required value={connection.syncIntervalMs/60000} onChange={event=>update(index,{syncIntervalMs:Number(event.target.value)*60000})}/></label>
   {['gmail','google-calendar'].includes(connection.provider)&&<><label>{moteText('Google 客户端 ID')}<input aria-label={moteText('Google 客户端 ID')} maxLength={2000} required value={connection.googleClientId??''} onChange={event=>update(index,{googleClientId:event.target.value})}/></label><SecretField key={connection.id+':secret'} label={moteText('Google 客户端密钥')} value={connection.googleClientSecret} onChange={googleClientSecret=>update(index,{googleClientSecret})}/><label>{moteText('Google 授权回调地址')}<input aria-label={moteText('Google 授权回调地址')} type="url" required maxLength={4000} value={connection.googleRedirectUri??''} onChange={event=>update(index,{googleRedirectUri:event.target.value})}/></label></>}
  </>:<><label><input type="checkbox" checked={connection.enabled!==false} onChange={event=>update(index,{enabled:event.target.checked})}/>{moteText('已启用')}</label><label>{moteText('服务地址')}<input aria-label={moteText('MCP 服务地址')} type="url" required maxLength={2000} value={connection.url} onChange={event=>update(index,{url:event.target.value})}/></label><SecretField label={moteText('远端 MCP 令牌')} value={connection.token} onChange={token=>update(index,{token})}/><fieldset><legend>{moteText('来源')}</legend>{sources.data?.items.filter(source=>source.kind==='mcp').map(source=><label key={source.id}><input type="checkbox" checked={connection.sourceIds.includes(source.id)} onChange={event=>update(index,{sourceIds:event.target.checked?[...new Set([...connection.sourceIds,source.id])]:connection.sourceIds.filter((id:string)=>id!==source.id)})}/>{source.name}</label>)}<label>{moteText('可写来源 ID')}<input aria-label={moteText('可写来源 ID')} value={connection.sourceIds.join(',')} onChange={event=>update(index,{sourceIds:event.target.value.split(',').map(id=>id.trim()).filter(Boolean)})}/></label></fieldset></>}
 </div></details>)}<p><a href="#/connections">{moteText('新增数据源')}</a></p></>;
}
function SecretField({label,value,onChange}:{label:string;value:boolean|string|undefined;onChange:(value:string|boolean)=>void}){
 const [saved,setSaved]=useState(value===true);
 useEffect(()=>{if(typeof value==='boolean')setSaved(value);},[value]);
 return <div><label>{label}<input aria-label={label} type="password" autoComplete="new-password" value={typeof value==='string'?value:''} placeholder={value===true?moteText('已保存，隐藏凭据'):''} onChange={event=>onChange(event.target.value||saved)}/><small>{moteText('留空保留已保存密钥。')}</small></label>{saved&&<label><input type="checkbox" checked={value===''} onChange={event=>onChange(event.target.checked?'':true)}/>{moteText('清除已保存密钥')}</label>}</div>;
}
