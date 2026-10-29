import {moteText,getLocale} from '@mote/shared/i18n';
import type {DesktopApi,Status} from './contracts';
import type {ChromePermissionStatus} from './contracts/chrome';
const el=<T extends HTMLElement=HTMLElement>(id:string)=>document.getElementById(id) as T;
/** Preparation and recent browser permissions are separate facts. Neither starts capture. */
export function createChromeCaptureUi(api:DesktopApi){
 const originsInput=el<HTMLTextAreaElement>('chrome-origins');
 let saved:string[]=[],revision=0,requestId:string|undefined,preparing=false;
 const sameOrigins=()=>JSON.stringify(originsInput.value.split('\n').map(value=>value.trim()).filter(Boolean))===JSON.stringify(saved);
 function buttons(){el<HTMLButtonElement>('chrome-check').disabled=Boolean(requestId)||preparing||!sameOrigins();el<HTMLButtonElement>('chrome-setup').disabled=preparing||Boolean(requestId);el<HTMLButtonElement>('chrome-authorize').disabled=preparing||Boolean(requestId);el('chrome-check-cancel').hidden=!requestId;}
 function clear(){revision++;if(requestId)void api.cancelChromePermissions(requestId).catch(()=>{});requestId=undefined;el('chrome-checked-at').textContent='';el('chrome-permission-list').replaceChildren();buttons();}
 function message(text:string){el('chrome-check-result').textContent=text;}
 function render(value:ChromePermissionStatus){const list=el('chrome-permission-list');list.replaceChildren();
  if(value.state==='checked'){
   for(const item of value.origins){const row=document.createElement('div');row.className='chrome-permission-row';const origin=document.createElement('span'),state=document.createElement('span');origin.textContent=item.origin;state.textContent=item.allowed?moteText('已获准'):moteText('尚未获准');row.append(origin,state);list.append(row);}
   message(!value.origins.length?moteText('桥接已连接；尚未配置采集站点。'):value.origins.every(item=>item.allowed)?moteText('最近检查：桥接与站点权限已确认。'):moteText('所选站点尚未全部获准。请在 Chrome 完成授权后重新检查。'));
   el('chrome-checked-at').textContent=moteText('检查时间：{0}',new Date(value.checkedAt).toLocaleString(getLocale()));
  }else{
   el('chrome-checked-at').textContent='';message(value.state==='canceled'?moteText('检查已取消，状态尚未确认。'):value.state==='ambiguous'?moteText('检测到多个 Chrome 连接，暂不能确认当前浏览器权限。'):value.state==='busy'?moteText('桥接正在处理采集，请稍后重新检查。'):value.state==='stale'?moteText('检查期间连接或站点范围已改变，请重新检查。'):moteText('桥接尚未完成检查。请确认 Chrome 扩展已连接后重试。'));
  }
 }
 async function check(){if(requestId||preparing||!sameOrigins())return;const epoch=++revision,id=crypto.randomUUID(),scope=JSON.stringify(saved);requestId=id;el('chrome-permission-list').replaceChildren();el('chrome-checked-at').textContent='';message(moteText('正在检查桥接与站点权限…'));buttons();
  try{const value=await api.checkChromePermissions(id);if(epoch!==revision||scope!==JSON.stringify(saved)||!sameOrigins())return;if(value.state==='checked'&&(value.origins.length!==saved.length||value.origins.some((item,index)=>item.origin!==saved[index])))render({state:'stale',origins:[]});else render(value);}
  catch{if(epoch===revision)render({state:'unavailable',origins:[]});}
  finally{if(epoch===revision){requestId=undefined;buttons();}}
 }
 originsInput.addEventListener('input',()=>{clear();el('chrome-checked-at').textContent='';message(sameOrigins()?moteText('尚未检查桥接与站点权限。'):moteText('保存站点范围后，再重新检查权限。'));});
 el('chrome-check').addEventListener('click',()=>void check());
 el('chrome-check-cancel').addEventListener('click',()=>{clear();render({state:'canceled',origins:[]});});
 el('chrome-setup').addEventListener('click',()=>void(async()=>{if(preparing)return;clear();const epoch=revision;preparing=true;buttons();message(moteText('正在准备扩展与本机桥接…'));try{const setup=await api.setupChromeCapture();if(epoch!==revision)return;el('chrome-setup-result').textContent=moteText('扩展目录：{0}；扩展 ID：{1}',setup.extensionDirectory,setup.extensionId);el<HTMLDetailsElement>('chrome-install-details').open=true;message(moteText('本机桥接已准备，等待浏览器连接检查。'));}catch{if(epoch===revision)message(moteText('准备失败，可重试。'));}finally{preparing=false;buttons();}})());
 el('chrome-authorize').addEventListener('click',()=>{clear();const epoch=revision;void api.openChromeExtensions().then(()=>{if(epoch===revision)message(moteText('请在 Chrome 完成扩展安装和站点授权，再返回重新检查。'));}).catch(()=>{if(epoch===revision)message(moteText('无法打开 Chrome，请手动打开扩展管理。'));});});
 return {update(status:Status){const next=status.config.chromeOrigins??[];if(JSON.stringify(saved)!==JSON.stringify(next)){clear();saved=[...next];message(moteText('尚未检查桥接与站点权限。'));}buttons();},refresh:buttons,hide(){const pending=Boolean(requestId);clear();if(pending)render({state:'canceled',origins:[]});else message(moteText('尚未检查桥接与站点权限。'));},dispose:clear};
}
