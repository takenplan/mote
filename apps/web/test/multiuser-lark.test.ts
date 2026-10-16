import test from 'node:test';
import assert from 'node:assert/strict';
import React,{act} from 'react';
import {JSDOM} from 'jsdom';
import {setTimeout as delay} from 'node:timers/promises';
import {configureLocale} from '@mote/shared/i18n';
import {scopedCaptureFixture} from '../../server/test/fixtures/scoped-capture-host.js';
import {createApi,type Api} from '../src/api.js';
import {LarkSettings} from '../src/LarkSettings.js';
configureLocale(()=> 'zh-CN');

test('the original Lark settings select an owned connection and use actual task progress and source identities',async t=>{
 let complete!:()=>void,entered!:()=>void;const hold=new Promise<void>(r=>complete=r),ready=new Promise<void>(r=>entered=r),logged=new Set<string>();
 const calls:{user:string;kind:string}[]=[];
 const f=await scopedCaptureFixture(t,{connectorTransports:{lark:scope=>async(command,options)=>{calls.push({user:scope.userId,kind:command.kind});switch(command.kind){
  case 'version':return 'lark-cli 1.0.85';
  case 'status':return JSON.stringify({appId:'cli_generated',identities:{user:{available:logged.has(scope.userId),openId:'same-open-id',userName:'GENERATED_LARK_'+scope.userId,scope:'docx:document:readonly wiki:wiki:readonly search:docs:read space:document:retrieve calendar:calendar:readonly'}}});
  case 'login':return JSON.stringify({verification_url:'https://accounts.feishu.cn/generated/'+scope.userId,device_code:'GENERATED_'+scope.userId,expires_in:600});
  case 'complete':entered();await hold;if(options?.signal?.aborted)throw Error('Generated completion retired');logged.add(scope.userId);return '{}';
  case 'document':return JSON.stringify({data:{document:{document_id:'DocumentFixture123',revision_id:1,title:'GENERATED_DOC_'+scope.userId,content:'GENERATED_LARK_BODY_'+scope.userId}}});
  case 'calendars':return JSON.stringify({data:{calendar_list:[],has_more:false}});
  default:throw Error('Unexpected generated CLI I/O '+command.kind);
 }}}});t.after(()=>complete());
 const installed=await f.request(f.admin.token,'/api/admin/connectors/lark/install','POST',{expectedRevision:f.host.plugins!.catalog.revision(),operationId:crypto.randomUUID()});assert.equal(installed.statusCode,200,installed.body);
 for(const account of [f.a,f.b]){const inventory=(await f.request(account.token,'/api/connectors')).json();const saved=await f.request(account.token,'/api/connectors/same-lark','PUT',{expectedRevision:inventory.revision,connection:{provider:'lark',autoSync:false}});assert.equal(saved.statusCode,200,saved.body);const plugins=(await f.request(account.token,'/api/plugins')).json();assert.equal((await f.request(account.token,'/api/connectors/same-lark/enable','POST',{expectedRevision:plugins.revision})).statusCode,200);}
 const dom=new JSDOM('<!doctype html><div id="root"></div>',{url:'http://localhost/#/connections/lark',pretendToBeVisual:true}),before=new Map<string,PropertyDescriptor|undefined>();let cookie='',current:Api|undefined;const requests:{path:string;method:string;session:string;status:number}[]=[];
 for(const [key,value]of Object.entries({window:dom.window,document:dom.window.document,HTMLElement:dom.window.HTMLElement,Event:dom.window.Event,IS_REACT_ACT_ENVIRONMENT:true,fetch:async(path:string,init:RequestInit={})=>{const headers=new Headers(init.headers);headers.set('cookie',cookie);const r=await f.host.app.inject({url:path,method:init.method as any??'GET',headers:Object.fromEntries(headers),...(init.body?{payload:String(init.body)}:{})});requests.push({path,method:init.method??'GET',session:headers.get('x-mote-session-id')??'',status:r.statusCode});return new Response(r.rawPayload,{status:r.statusCode,headers:r.headers as Record<string,string>});}})){before.set(key,Object.getOwnPropertyDescriptor(globalThis,key));Object.defineProperty(globalThis,key,{value,configurable:true,writable:true});}
 const {createRoot}=await import('react-dom/client'),root=createRoot(dom.window.document.getElementById('root')!),d=dom.window.document;
 t.after(async()=>{complete();current?.close?.();await act(async()=>root.unmount());for(const [key,value]of before){if(value)Object.defineProperty(globalThis,key,value);else Reflect.deleteProperty(globalThis,key);}dom.window.close();});
 const login=async(username:string)=>{const r=await f.request(undefined,'/api/auth/login','POST',{username,password:'Generated-M13-archive-only-01',mode:'web'});assert.equal(r.statusCode,200,r.body);cookie=String(r.headers['set-cookie']).split(';')[0];const api=createApi({mode:'web',origin:'http://localhost',...r.json()},undefined,()=>current===api);current?.close?.();current=api;return api;},render=async(api:Api)=>act(async()=>{root.render(React.createElement(React.StrictMode,null,React.createElement(LarkSettings,{api,onSources:()=>{}})));await delay(20);});
 const wait=async(predicate:()=>boolean,label:string)=>{for(let n=0;n<500&&!predicate();n++)await act(async()=>delay(10));assert.ok(predicate(),label+' '+d.body.textContent);},button=(label:string)=>Array.from(d.querySelectorAll<HTMLButtonElement>('button')).find(value=>value.textContent===label),press=async(label:string)=>act(async()=>{const value=button(label);assert.ok(value,label+' '+d.body.textContent);value.click();await delay(20);});
 const choose=async()=>act(async()=>{const select=d.querySelector<HTMLSelectElement>('select[aria-label="连接 ID"]');assert.ok(select,'the original Lark page must choose an actual owned M10 instance');select.value='same-lark';select.dispatchEvent(new dom.window.Event('change',{bubbles:true}));await delay(20);});
 await render(await login('generated-a'));await wait(()=>!!d.querySelector('select[aria-label="连接 ID"]'),'owned connection selection');await choose();await wait(()=>!!button('扫码登录并授权只读权限')&&!button('扫码登录并授权只读权限')!.disabled,'actual completed environment check');assert.match(d.body.textContent!,/Lark CLI 1\.0\.85/);assert.ok(calls.some(c=>c.user===f.a.userId&&c.kind==='version'));
 await press('扫码登录并授权只读权限');await ready;await wait(()=>!!d.querySelector('.lark-authorization a'),'actual M05 waiting progress exposes authorization');assert.equal(d.querySelector<HTMLAnchorElement>('.lark-authorization a')!.href,'https://accounts.feishu.cn/generated/'+f.a.userId);
 const oldCancel=button('取消当前操作')!,beforeBRequests=requests.filter(r=>r.method==='POST').length;await render(await login('generated-b'));await choose();await act(async()=>{oldCancel.click();complete();await delay(30);});assert.equal(requests.filter(r=>r.method==='POST').length,beforeBRequests+1,'only B own environment check may be admitted');assert.doesNotMatch(d.body.textContent!,new RegExp(f.a.userId));assert.equal(d.querySelector('.lark-authorization a'),null);assert.ok(!requests.some(r=>r.path.startsWith('/api/connectors/lark')),'the Web renderer must not call the retired global vendor facade');
});
