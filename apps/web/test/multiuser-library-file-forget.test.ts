import test from 'node:test';
import assert from 'node:assert/strict';
import React,{act} from 'react';
import {JSDOM} from 'jsdom';
import {setTimeout as delay} from 'node:timers/promises';
import {configureLocale} from '@mote/shared/i18n';
import {scopedFilesFixture} from '../../server/test/fixtures/scoped-files.js';
import {createApi,type Api} from '../src/api.js';
import {Archive} from '../src/Archive.js';
import {featuresReady} from '../src/features/runtime.js';
configureLocale(()=> 'zh-CN');

test('original Library Files recovers a lost delete ACK after reload and keeps the forgotten decision out of B',async t=>{
 const f=await scopedFilesFixture(t);await featuresReady;
 const a=await f.upload(f.a.token,'library-forget','GENERATED_LIBRARY_FILE_A'),b=await f.upload(f.b.token,'library-forget','GENERATED_LIBRARY_FILE_B');assert.equal(a.id,b.id);
 const dom=new JSDOM('<!doctype html><div id="root"></div>',{url:'http://localhost/#/library?view=files',pretendToBeVisual:true}),prior=new Map<string,PropertyDescriptor|undefined>();
 let cookie='',current:Api|undefined,lose=true;const deletes:{body:string;status:number;receipt:any}[]=[];
 for(const [key,value]of Object.entries({window:dom.window,document:dom.window.document,location:dom.window.location,localStorage:dom.window.localStorage,HTMLElement:dom.window.HTMLElement,Event:dom.window.Event,IS_REACT_ACT_ENVIRONMENT:true,fetch:async(path:string,init:RequestInit={})=>{
  const headers=new Headers(init.headers);headers.set('cookie',cookie);const response=await f.host.app.inject({url:path,method:init.method as any??'GET',headers:Object.fromEntries(headers),...(init.body?{payload:String(init.body)}:{})});
  if(init.method==='DELETE'){deletes.push({body:String(init.body),status:response.statusCode,receipt:response.json()});if(lose&&response.statusCode===200){lose=false;throw new TypeError('Generated committed Library delete ACK loss');}}
  return new Response(response.rawPayload,{status:response.statusCode,headers:response.headers as Record<string,string>});
 }})){prior.set(key,Object.getOwnPropertyDescriptor(globalThis,key));Object.defineProperty(globalThis,key,{value,configurable:true,writable:true});}
 const {createRoot}=await import('react-dom/client');let root=createRoot(dom.window.document.getElementById('root')!);const d=dom.window.document;
 t.after(async()=>{current?.close?.();await act(async()=>root.unmount());for(const[key,value]of prior){if(value)Object.defineProperty(globalThis,key,value);else Reflect.deleteProperty(globalThis,key);}dom.window.close();});
 const login=async(label:string)=>{const response=await f.request(undefined,'/api/auth/login','POST',{username:'generated-'+label,password:'Generated-joint-files-password',mode:'web'});assert.equal(response.statusCode,200,response.body);cookie=String(response.headers['set-cookie']).split(';')[0];const api=createApi({mode:'web',origin:'http://localhost',...response.json()},undefined,()=>current===api);current?.close?.();current=api;return api;};
 const render=async(api:Api)=>act(async()=>{root.render(React.createElement(Archive,{api,devices:[],range:{},activity:{apps:[],devices:[],totalDurationMs:0,captures:0},revision:0,tab:'files',setTab:()=>{},onOpen:()=>{}}));await delay(10);});
 const button=(label:string)=>Array.from(d.querySelectorAll<HTMLButtonElement>('button')).find(b=>b.textContent===label),wait=async(check:()=>boolean,label:string)=>{for(let n=0;n<500&&!check();n++)await act(async()=>delay(10));assert.ok(check(),label+' '+d.body.textContent);},press=async(label:string)=>act(async()=>{const control=button(label);assert.ok(control,label+' '+d.body.textContent);control.click();await delay(10);});
 const api=await login('a');await render(api);await wait(()=>!!d.querySelector('.file-card'),'original Files row');await act(async()=>{d.querySelector<HTMLButtonElement>('.file-card')!.click();await delay(10);});
 await wait(()=>!!button('删除中央归档'),'original Library file detail');assert.match(dom.window.location.hash,/selected=capture/);await press('删除中央归档');await press('确认删除归档');await wait(()=>deletes.length===1,'real deletion committed before dropped ACK');assert.equal(deletes[0].status,200);assert.equal((await f.request(f.a.token,'/api/files/'+a.id)).statusCode,404);
 // A normal browser reload keeps the saved typed Library selection and the
 // persisted original command, even though both current read endpoints 404.
 await act(async()=>root.unmount());root=createRoot(d.getElementById('root')!);await render(api);await wait(()=>!!button('重试删除提交'),'the Library wrapper must retain original-op recovery after deleted capture detail');
 await press('重试删除提交');await wait(()=>deletes.length===2,'original operation replay');assert.equal(deletes[0].body,deletes[1].body);assert.deepEqual(deletes[0].receipt.decision,deletes[1].receipt.decision);await wait(()=>!!button('允许再次采集'),'successful delete terminal decision');assert.match(d.body.textContent!,/中央归档已删除。/);
 const old=button('允许再次采集')!,before=deletes.length;await render(await login('b'));await wait(()=>!!d.querySelector('.file-card'),'B positive row');await act(async()=>{old.click();d.querySelector<HTMLButtonElement>('.file-card')!.click();await delay(10);});await wait(()=>!!button('删除中央归档'),'B current original detail');assert.equal(deletes.length,before);assert.equal(button('重试删除提交'),undefined);assert.doesNotMatch(d.body.textContent!,/中央归档已删除。|Generated committed Library delete ACK loss/);assert.equal((await f.request(f.b.token,'/api/files/'+b.id)).statusCode,200);
});
