import {permissionStatus} from './permissions.js';
import {extractVisible} from './extract.js';
const HOST='dev.mote.visible_context';let connection,generation=0,busy=false;
const stable=value=>value&&typeof value==='object'?(Array.isArray(value)?value.map(stable):Object.fromEntries(Object.keys(value).sort().map(k=>[k,stable(value[k])]))):value;
const same=(a,b)=>JSON.stringify(stable(a))===JSON.stringify(stable(b));
const rect=w=>({x:w.left,y:w.top,width:w.width,height:w.height});
const canonical=value=>{try{const u=new URL(value);return /^https?:$/.test(u.protocol)&&!u.username&&!u.password?u.href:undefined;}catch{return undefined;}};
async function binding(){const w=await chrome.windows.getLastFocused({populate:true});if(!w.focused||w.incognito||w.type!=='normal'||w.state==='minimized'||!w.tabs)return;const tabs=w.tabs.filter(t=>t.active);if(tabs.length!==1)return;const tab=tabs[0];if(tab.incognito||tab.status!=='complete'||!tab.id||!canonical(tab.url))return;const frame=await chrome.webNavigation.getFrame({tabId:tab.id,frameId:0});if(!frame?.documentId||canonical(frame.url)!==canonical(tab.url))return;return {url:canonical(tab.url),windowId:w.id,tabId:tab.id,documentId:frame.documentId,window:rect(w)};}
async function sample(message,epoch){
 if(!message||message.type!=='sample'||typeof message.id!=='string'||message.id.length>64||typeof message.observationId!=='string'||message.observationId.length>64||typeof message.observedAt!=='string'||message.observedAt.length>64||!Array.isArray(message.origins)||message.origins.length>256||!Array.isArray(message.masks)||message.masks.length>200||typeof message.structured!=='boolean')return;
 const fail=status=>({id:message.id,status});if(busy)return fail('blocked');busy=true;
 try{const before=await binding();if(!before||canonical(message.context?.url)!==before.url||!same(before.window,message.context?.window)||message.binding&&!same({...before,viewport:message.binding.viewport,scroll:message.binding.scroll},message.binding))return fail('stale');
 const origin=new URL(before.url).origin;if(!message.origins.includes(origin)||!await chrome.permissions.contains({origins:[`${origin}/*`]}))return fail('blocked');
 const results=await chrome.scripting.executeScript({target:{tabId:before.tabId,documentIds:[before.documentId]},world:'ISOLATED',func:extractVisible,args:[{structured:message.structured,masks:message.masks,observedAt:message.observedAt,observationId:message.observationId}]});
 const result=results.length===1&&results[0].documentId===before.documentId?results[0].result:undefined;if(!result||result.blocked||canonical(result.identity?.url)!==before.url||!same(result.identity?.viewport,message.context.viewport))return fail('blocked');
 if(message.binding&&!same(message.binding.scroll,result.identity.scroll))return fail('stale');
 const after=await binding();if(epoch!==generation||!same(before,after))return fail('stale');return {id:message.id,status:'ok',binding:{...before,viewport:result.identity.viewport,scroll:result.identity.scroll},...(message.structured?{pages:result.pages??[],...(result.media?{media:result.media}:{})}:{})};
 }catch{return fail('failed');}finally{busy=false;}
}
function connect(){if(connection)return;try{const port=chrome.runtime.connectNative(HOST);connection=port;const epoch=++generation;port.onMessage.addListener(message=>{void (message?.type==='permission-status'?permissionStatus(message,chrome.permissions):sample(message,epoch)).then(reply=>{if(reply&&epoch===generation){try{port.postMessage(reply);}catch{}}});});port.onDisconnect.addListener(()=>{void chrome.runtime.lastError;if(connection!==port)return;connection=undefined;generation++;chrome.alarms?.create?.('reconnect',{delayInMinutes:0.5});setTimeout(connect,2000);});}catch{setTimeout(connect,2000);}}
chrome.alarms.onAlarm.addListener(alarm=>{if(alarm.name==='reconnect'&&!connection)connect();});
chrome.runtime.onStartup.addListener(()=>{if(!connection)connect();});chrome.runtime.onInstalled.addListener(()=>{if(!connection)connect();});connect();
