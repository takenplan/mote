import test from 'node:test';
import assert from 'node:assert/strict';
import React,{act} from 'react';
import {JSDOM} from 'jsdom';
import {setTimeout as delay} from 'node:timers/promises';
import {noteCapture} from '@mote/shared';
import {configureLocale} from '@mote/shared/i18n';
import {scopedFilesFixture} from '../../server/test/fixtures/scoped-files.js';
import {defaultModelSettings} from '../../server/src/model-settings.js';
import {createApi,type Api,type Range} from '../src/api.js';
import {ScopedOverview} from '../src/ScopedSummary.js';
import {webFeatures} from '../src/features/registry.js';
import {useResource} from '../src/useResource.js';

configureLocale(()=> 'zh-CN');
function GeneratedHomeEntry({api}:{api:Api}){
 const data=useResource<{items:{textPreview:string}[]}>(api,'/api/captures?limit=1&projection=preview');
 return React.createElement('aside',{'data-generated-home':true},data.data?.items[0]?.textPreview);
}

test('original Home keeps entry actions, capture evidence and dynamic Home slots on scoped account data',async t=>{
 const f=await scopedFilesFixture(t);
 for(const [owner,label] of [[f.a,'A'],[f.b,'B']] as const){
  await f.checked(owner.token,'/api/ingress/devices','POST',{id:'same-device',name:'GENERATED_HOME_'+label+'_DEVICE',platform:'import'});
  await f.checked(owner.token,'/api/ingress/sources/same-source/captures','POST',{batchId:'generated-home',items:Array.from({length:6},(_,index)=>{const capture=noteCapture({id:'6d477b3e-fb43-5657-a18d-c143ad76430'+index,deviceId:'same-device',deviceName:'GENERATED_HOME_'+label+'_DEVICE',platform:'import',capturedAt:new Date(Date.now()-(6-index)*1000).toISOString(),text:'GENERATED_HOME_'+label+'_RECORD_'+index});return index===5?{...capture,privacy:{...capture.privacy,redacted:true,reason:'Generated redaction fixture'}}:capture;})});
 }
 // A selected profile exists, but lacks its required credential. The Home
 // setup hint must use the real selection resolver, not catalogue presence.
 const configuration=await f.checked(f.a.token,'/api/configuration');await f.checked(f.a.token,'/api/configuration/models','PUT',{revision:configuration.revision,value:{profiles:[{id:'generated-incomplete',name:'Generated incomplete connection',settings:{...defaultModelSettings(),provider:'custom',protocol:'anthropic-messages',model:'generated-incomplete',baseUrl:'http://127.0.0.1:9/v1',apiKey:'',allowUnauthenticatedLocal:false}}],selections:{chat:{kind:'personal',id:'generated-incomplete'}}}});
 assert.equal((await f.request(f.a.token,'/api/models/selection/chat')).statusCode,503);
 await f.checked(f.admin.token,'/api/admin/accounts','POST',{username:'generated-empty',password:'Generated-joint-files-password'});
 const dom=new JSDOM('<!doctype html><div id="root"></div>',{url:'http://localhost/#/today',pretendToBeVisual:true}),prior=new Map<string,PropertyDescriptor|undefined>();
 let cookie='',current:Api|undefined,hold=false,rolling=false,enter!:()=>void,release!:()=>void,rollingEnter!:()=>void,rollingRelease!:()=>void;const entered=new Promise<void>(resolve=>enter=resolve),gate=new Promise<void>(resolve=>release=resolve),rollingEntered=new Promise<void>(resolve=>rollingEnter=resolve),rollingGate=new Promise<void>(resolve=>rollingRelease=resolve),calls:string[]=[];
 for(const [key,value] of Object.entries({window:dom.window,document:dom.window.document,location:dom.window.location,HTMLElement:dom.window.HTMLElement,Event:dom.window.Event,IS_REACT_ACT_ENVIRONMENT:true,fetch:async(path:string,init:RequestInit={})=>{
  calls.push(path);const headers=new Headers(init.headers);headers.set('cookie',cookie);const response=await f.host.app.inject({url:path,method:init.method as any??'GET',headers:Object.fromEntries(headers),...(init.body?{payload:String(init.body)}:{})});
  if(hold&&path.startsWith('/api/captures?')&&path.includes('limit=4')){hold=false;enter();await gate;}
  if(rolling&&path.startsWith('/api/captures?')&&path.includes('limit=4')){rolling=false;rollingEnter();await rollingGate;}
  return new Response(response.rawPayload,{status:response.statusCode,headers:response.headers as Record<string,string>});
 }})){prior.set(key,Object.getOwnPropertyDescriptor(globalThis,key));Object.defineProperty(globalThis,key,{value,configurable:true,writable:true});}
 const feature=await webFeatures.install({id:'generated.home-parity',version:'1',components:[]},[{surface:'home',entry:{id:'generated-home-parity',featureId:'generated.home-parity',order:0,render:({api})=>React.createElement(GeneratedHomeEntry,{api})}}]);
 const {createRoot}=await import('react-dom/client'),root=createRoot(dom.window.document.getElementById('root')!),d=dom.window.document,pages:string[]=[],opened:string[]=[];
 t.after(async()=>{release();rollingRelease();current?.close?.();await act(async()=>root.unmount());await feature.dispose();for(const [key,value] of prior){if(value)Object.defineProperty(globalThis,key,value);else Reflect.deleteProperty(globalThis,key);}dom.window.close();});
 const login=async(label:string)=>{let api!:Api;await act(async()=>{const response=await f.request(undefined,'/api/auth/login','POST',{username:'generated-'+label,password:'Generated-joint-files-password',mode:'web'});assert.equal(response.statusCode,200,response.body);cookie=String(response.headers['set-cookie']).split(';')[0];api=createApi({mode:'web',origin:'http://localhost',...response.json()},undefined,()=>current===api);current?.close?.();current=api;await delay(20);});return api;};
 const render=async(api:Api,range:Range={},rangeSelectionKey='recent-day')=>act(async()=>{root.render(React.createElement(React.StrictMode,null,React.createElement(ScopedOverview,{api,range,rangeSelectionKey,onPage:page=>pages.push(page),onOpen:reference=>opened.push(reference)})));await delay(20);});
 const wait=async(read:()=>boolean,label:string)=>{for(let n=0;n<500&&!read();n++)await act(async()=>delay(10));assert.ok(read(),label+' '+d.body.textContent);};
 const press=async(label:string)=>act(async()=>{const button=Array.from(d.querySelectorAll<HTMLButtonElement>('button')).find(button=>button.textContent?.trim().startsWith(label));assert.ok(button,label);button.click();});
 const a=await login('a');await render(a);await wait(()=>d.querySelectorAll('.home-record-list .capture-card').length===4,'original four recent records');await wait(()=>d.querySelector('[data-generated-home]')?.textContent==='GENERATED_HOME_A_RECORD_5','dynamic Home contribution reads A account');
 assert.match(d.querySelector('.home-record-list')!.textContent!,/GENERATED_HOME_A_RECORD_5/);assert.doesNotMatch(d.querySelector('.home-record-list')!.textContent!,/GENERATED_HOME_A_RECORD_[01]|GENERATED_HOME_B/);
 assert.match(d.querySelector('.home-record-list .capture-card')!.textContent!,/已脱敏/,'the original complete capture renders its supplied privacy badge');
 await act(async()=>d.querySelector<HTMLButtonElement>('.home-record-list .capture-card')!.click());assert.deepEqual(opened,['capture:6d477b3e-fb43-5657-a18d-c143ad764305']);
 for(const label of ['打开资料库','全部功能','新增数据源','导入资料','写随手记','1 台已知设备','查看行动建议','配置问答模型'])await press(label);
 assert.equal(d.querySelector('[role=alert]'),null,'expected unconfigured selection preserves the setup hint without an error banner');
 assert.deepEqual(pages,['archive','featureGuide','sourceCatalog','imports','notes','devices','actions','settings']);
 assert.deepEqual(Array.from(d.querySelectorAll<HTMLAnchorElement>('.home-retrieval a')).map(link=>link.getAttribute('href')),['#/ask','#/library?view=memories','#/library/insights']);
 assert.ok(calls.some(path=>path.startsWith('/api/captures?')&&path.includes('limit=4')&&!path.includes('projection=')),'Home retains the original complete capture card fields');assert.ok(calls.includes('/api/insights'));assert.ok(calls.includes('/api/models/selection/chat'));assert.ok(!calls.some(path=>['/api/status','/api/devices','/api/model-settings'].includes(path)),'original Home uses authenticated account APIs');
 const card=d.querySelector('.home-record-list .capture-card')!;rolling=true;await render(a,{after:new Date(Date.now()-86400000).toISOString(),before:new Date(Date.now()+60000).toISOString()});await rollingEntered;assert.equal(d.querySelector('.home-record-list .capture-card'),card,'advancing the same time-range selection preserves the original card while its HTTP read is pending');await act(async()=>{rollingRelease();await delay(20);});await wait(()=>d.querySelectorAll('.home-record-list .capture-card').length===4,'rolling-range read completes');assert.equal(d.querySelector('.home-record-list .capture-card'),card,'same capture keeps its DOM after rolling-range success');
 await render(a,{after:'2000-01-01T00:00:00Z',before:'2001-01-01T00:00:00Z'},'explicit-empty-selection');await wait(()=>d.querySelectorAll('.home-record-list .capture-card').length===0,'an explicit different selection discards previous range cards');assert.equal(card.isConnected,false);
 await act(async()=>root.render(null));hold=true;await render(await login('a'));await entered;await render(await login('b'));await act(async()=>{release();await delay(20);});await wait(()=>d.querySelector('.home-record-list')?.textContent?.includes('GENERATED_HOME_B_RECORD_5')===true,'B positive original Home');await wait(()=>d.querySelector('[data-generated-home]')?.textContent==='GENERATED_HOME_B_RECORD_5','Home slot follows B account');assert.doesNotMatch(d.body.textContent!,/GENERATED_HOME_A/);
 await render(await login('a'));await wait(()=>d.querySelector('.home-record-list')?.textContent?.includes('GENERATED_HOME_A_RECORD_5')===true,'same-account re-login restores original recent data');assert.doesNotMatch(d.body.textContent!,/GENERATED_HOME_B/);
 await render(await login('empty'));await wait(()=>!d.querySelector('.home-record-list'),'new account has original empty Home');assert.ok(Array.from(d.querySelectorAll('button')).some(button=>button.textContent?.trim()==='导入资料'));assert.ok(Array.from(d.querySelectorAll('button')).some(button=>button.textContent?.includes('新增数据源')));assert.doesNotMatch(d.body.textContent!,/GENERATED_HOME_[AB]/);
 await act(async()=>{root.render(null);await delay(20);});
});
