import test from 'node:test';
import assert from 'node:assert/strict';
import React,{act} from 'react';
import {JSDOM} from 'jsdom';
import {setTimeout as delay} from 'node:timers/promises';
import {existsSync} from 'node:fs';
import {join} from 'node:path';
import {ContentStorage} from '../src/ContentStorage.js';
import {StorageStatistics} from '../src/StorageStatistics.js';
import {createApi,type Api,type WebConnection} from '../src/api.js';
import {configureLocale} from '@mote/shared/i18n';
import {scopedFilesFixture} from '../../server/test/fixtures/scoped-files.js';
import {identityHash} from '../../server/src/scope/originals.js';
configureLocale(()=> 'zh-CN');

test('original storage pages encrypt actual generated originals, recover a lost ACK, cancel exact work and retire held A controls before B',async t=>{
 const f=await scopedFilesFixture(t),dom=new JSDOM('<!doctype html><div id="root"></div>',{url:'http://localhost/',pretendToBeVisual:true}),prior=new Map<string,PropertyDescriptor|undefined>();
 let cookie='',current:Api|undefined,lost=true,hold=false,corruptReport=false,enter!:()=>void,release!:()=>void;const entered=new Promise<void>(r=>enter=r),gate=new Promise<void>(r=>release=r),posts:{path:string;body:any}[]=[];t.after(()=>release());
 for(const [key,value]of Object.entries({window:dom.window,document:dom.window.document,localStorage:dom.window.localStorage,HTMLElement:dom.window.HTMLElement,Event:dom.window.Event,IS_REACT_ACT_ENVIRONMENT:true,fetch:async(path:string,init:RequestInit={})=>{
  const headers=new Headers(init.headers);headers.set('cookie',cookie);const response=await f.host.app.inject({url:path,method:init.method as any??'GET',headers:Object.fromEntries(headers),...(init.body?{payload:String(init.body)}:{})});
  if(init.method&&init.method!=='GET'){posts.push({path,body:JSON.parse(String(init.body))});if(path==='/api/content-storage'&&hold){enter();await gate;}if(path==='/api/content-storage/decrypt'&&lost){lost=false;throw Error('GENERATED_RESPONSE_ONLY_ACK_LOSS');}}
  let bytes=response.rawPayload;if(path==='/api/storage-statistics'&&corruptReport){corruptReport=false;bytes=Buffer.from(JSON.stringify({...response.json(),bytes:0}));}return new Response(new Uint8Array(bytes),{status:response.statusCode,headers:response.headers as Record<string,string>});
 }})){prior.set(key,Object.getOwnPropertyDescriptor(globalThis,key));Object.defineProperty(globalThis,key,{value,configurable:true,writable:true});}
 const {createRoot}=await import('react-dom/client'),root=createRoot(dom.window.document.getElementById('root')!),d:Document=dom.window.document;
 t.after(async()=>{release();current?.close?.();await act(async()=>root.unmount());for(const [key,value]of prior){if(value)Object.defineProperty(globalThis,key,value);else Reflect.deleteProperty(globalThis,key);}dom.window.close();});
 const login=async(label:string)=>{const response=await f.request(undefined,'/api/auth/login','POST',{username:'generated-'+label,password:'Generated-joint-files-password',mode:'web'});assert.equal(response.statusCode,200,response.body);cookie=String(response.headers['set-cookie']).split(';')[0];const api=createApi({...response.json(),mode:'web',origin:'http://localhost'} as WebConnection,undefined,()=>current===api);current?.close?.();current=api;return api;};
 const render=(api:Api)=>act(async()=>{root.render(React.createElement(React.StrictMode,null,React.createElement(React.Fragment,null,React.createElement(ContentStorage,{api}),React.createElement(StorageStatistics,{api,onUsage:()=>{}}))));await delay(20);});
 const wait=async(check:()=>boolean,label:string)=>{for(let n=0;n<500&&!check();n++)await act(async()=>delay(10));assert.ok(check(),label+' '+d.body.textContent);};
 const button=(label:string)=>Array.from(d.querySelectorAll<HTMLButtonElement>('button')).find(node=>node.textContent===label),press=(label:string)=>act(async()=>{const node=button(label);assert.ok(node,label);assert.equal(node.disabled,false,label);node.click();await delay(20);}),toggle=()=>act(async()=>{const node=d.querySelector<HTMLInputElement>('input[type="checkbox"]')!;assert.equal(node.disabled,false);node.click();await delay(20);});
 const a=await login('a');await render(a);await wait(()=>!!d.querySelector<HTMLInputElement>('input[type="checkbox"]')&&!d.querySelector<HTMLInputElement>('input[type="checkbox"]')!.disabled,'original current-account storage read');await wait(()=>d.body.textContent!.includes('共享数据库与索引、模型和外部服务卷不计入此视图'),'real physical statistics coverage');
 await toggle();await wait(()=>d.querySelector<HTMLInputElement>('input[type="checkbox"]')!.checked,'real encrypted write policy');const file=await f.upload(f.a.token,'generated-original-ui','GENERATED_ORIGINAL_STORAGE_UI');const path=join(f.directory,'originals',identityHash([f.host.deploymentId,f.a.userId]),'objects',file.original.hash,'0.aes');assert.equal(existsSync(path),true);
 await toggle();await wait(()=>!d.querySelector<HTMLInputElement>('input[type="checkbox"]')!.checked,'disable is a distinct configuration change');
 let physicalEnter!:()=>void,physicalRelease!:()=>void;const physicalReady=new Promise<void>(r=>physicalEnter=r),physicalGate=new Promise<void>(r=>physicalRelease=r);t.after(()=>physicalRelease());const context=await f.host.authority.authenticate(f.a.token),physical=f.host.ingress.forUser(context).withWorkspace(async()=>{physicalEnter();await physicalGate;});await physicalReady;
 await press('一次性批量解密');await wait(()=>!!button('重试原操作'),'response-only lost ACK preserves exact command');const first=posts.find(post=>post.path==='/api/content-storage/decrypt')!;assert.match(first.body.operationId,/^[a-f0-9-]{36}$/);
 await act(async()=>{root.render(null);await delay(10);});await render(a);await wait(()=>!!button('取消解密'),'real M05 receipt recovers on remount');const state=await f.checked(f.a.token,'/api/content-storage');assert.equal(state.job.operationId,first.body.operationId);await press('取消解密');await wait(()=>d.body.textContent!.includes('已取消'),'exact cancellation shown');assert.deepEqual(posts.find(post=>post.path.endsWith('/cancel'))!.body,{taskId:state.job.id});physicalRelease();await physical;
 await press('一次性批量解密');await wait(()=>d.body.textContent!.includes('处理完成'),'actual generated ciphertext converted');assert.equal(existsSync(path),false);const commands=posts.filter(post=>post.path==='/api/content-storage/decrypt');assert.equal(commands.length,2);assert.notEqual(commands[0].body.operationId,commands[1].body.operationId);
 hold=true;const retired=d.querySelector<HTMLInputElement>('input[type="checkbox"]')!;await toggle();await entered;await render(await login('b'));release();await wait(()=>!!d.querySelector<HTMLInputElement>('input[type="checkbox"]')&&!d.querySelector<HTMLInputElement>('input[type="checkbox"]')!.disabled,'B original positive');assert.equal(d.querySelector<HTMLInputElement>('input[type="checkbox"]')!.checked,false);assert.doesNotMatch(d.body.textContent!,/GENERATED_ORIGINAL_STORAGE_UI|已转换 1/);const count=posts.length;await act(async()=>{retired.click();await delay(15);});assert.equal(posts.length,count);hold=false;await toggle();await wait(()=>d.querySelector<HTMLInputElement>('input[type="checkbox"]')!.checked,'B explicit policy write positive');
 corruptReport=true;await press('刷新');await wait(()=>d.body.textContent!.includes('服务返回的操作回执与当前账号不一致。'),'malformed successful totals cannot show a false physical report');await press('刷新');await wait(()=>!d.body.textContent!.includes('服务返回的操作回执与当前账号不一致。')&&!!d.querySelector('.stats-grid'),'exact current report recovered');
 assert.ok(posts.every(post=>!('userId' in post.body)&&!('key' in post.body)&&!('path' in post.body)));assert.deepEqual(Object.keys(dom.window.localStorage).filter(key=>key.startsWith('mote.content-decrypt.v1:')),[]);
});
