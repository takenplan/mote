import test from 'node:test';
import assert from 'node:assert/strict';
import React,{act} from 'react';
import {JSDOM} from 'jsdom';
import {configureLocale} from '@mote/shared/i18n';
import {MediaPreparation} from '../src/MediaPreparation.js';
import {ApiError,type Api} from '../src/api.js';
import {resources} from '../src/resource-cache.js';
configureLocale(()=> 'zh-CN');
async function fixture(t:import('node:test').TestContext){
 const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost/'}),prior=new Map<string,PropertyDescriptor|undefined>();
 for(const [key,value] of Object.entries({window:dom.window,document:dom.window.document,HTMLElement:dom.window.HTMLElement,IS_REACT_ACT_ENVIRONMENT:true})){prior.set(key,Object.getOwnPropertyDescriptor(globalThis,key));Object.defineProperty(globalThis,key,{value,configurable:true,writable:true});}
 const {createRoot}=await import('react-dom/client'),root=createRoot(dom.window.document.getElementById('root')!);t.after(async()=>{await act(async()=>root.unmount());dom.window.close();for(const [key,descriptor]of prior){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else Reflect.deleteProperty(globalThis,key);}});
 const button=(label:string)=>{const node=[...dom.window.document.querySelectorAll('button')].find(node=>node.textContent===label);assert.ok(node,label);return node;};return {root,dom,button};
}
test('prepare does not enable processing, prevents duplicate clicks and offers cancel/retry after dependency failure',async t=>{
 const f=await fixture(t),calls:string[]=[];let state='idle';
 const api={request:async(path:string,init?:RequestInit)=>{if(init?.method==='POST'){calls.push(path);state=path.endsWith('/cancel')?'cancelled':'dependencies';return {};}assert.equal(path,'/api/media-preparation');return {ocr:{state,runtimeReady:false,model:{state:'not_installed',bytes:0,totalBytes:100}}};}} as Api;
 await act(async()=>f.root.render(React.createElement(MediaPreparation,{api,role:'ocr',title:'图片文字识别'})));assert.equal(calls.length,0);
 await act(async()=>f.button('一键安装').click());assert.deepEqual(calls,['/api/media-preparation/ocr']);assert.equal(f.button('安装中…').disabled,true);assert.match(f.dom.window.document.body.textContent!,/正在准备运行依赖/);
 await act(async()=>f.button('取消').click());assert.match(f.dom.window.document.body.textContent!,/安装已取消/);await act(async()=>f.button('重试').click());assert.equal(calls.length,3);
 state='failed';await act(async()=>resources(api).invalidate(()=>true));assert.match(f.dom.window.document.body.textContent!,/网络和可用空间/);assert.ok(f.button('重试'));assert.ok(calls.every(path=>path.startsWith('/api/media-preparation/')));
});
test('missing permission withdraws stale installation controls and a changed node ignores late preparation replies',async t=>{
 const f=await fixture(t);let release!:()=>void,denied=false;const pending=new Promise<void>(resolve=>release=resolve),oldCalls:string[]=[];
 const old={request:async(path:string,init?:RequestInit)=>{oldCalls.push(path);if(init?.method==='POST'){await pending;return {};}if(denied)throw new ApiError('generated revoked',403);return {ocr:{state:'idle',runtimeReady:false,model:{state:'not_installed',bytes:0,totalBytes:1}}};}} as Api;
 await act(async()=>f.root.render(React.createElement(MediaPreparation,{api:old,role:'ocr',title:'图片文字识别'})));
 await act(async()=>f.button('一键安装').click());let nextReads=0;const next={request:async()=>{nextReads++;return {ocr:{state:'unsupported',error:'platform_unsupported',runtimeReady:false,model:{state:'not_installed',bytes:0,totalBytes:1}}};}} as unknown as Api;
 await act(async()=>f.root.render(React.createElement(MediaPreparation,{api:next,role:'ocr',title:'图片文字识别'})));await act(async()=>release());assert.equal(nextReads,1);assert.equal(f.button('一键安装').disabled,true);assert.match(f.dom.window.document.body.textContent!,/暂不支持自动安装/);
 denied=true;await act(async()=>f.root.render(React.createElement(MediaPreparation,{api:old,role:'ocr',title:'图片文字识别'})));assert.match(f.dom.window.document.body.textContent!,/generated revoked/);assert.equal(f.button('一键安装').disabled,true);
});
test('checking a ready service refreshes actual health without another install and exposes a stopped worker',async t=>{
 const f=await fixture(t);let ready=true,reads=0;
 const api={request:async(path:string,init?:RequestInit)=>{assert.equal(path,'/api/media-preparation');assert.equal(init?.method,undefined);reads++;return {ocr:{state:ready?'ready':'idle',runtimeReady:ready,model:{state:'ready',bytes:100,totalBytes:100}}};}} as Api;
 await act(async()=>f.root.render(React.createElement(MediaPreparation,{api,role:'ocr',title:'图片文字识别'})));assert.match(f.dom.window.document.body.textContent!,/可使用/);
 ready=false;await act(async()=>f.button('检查状态').click());assert.equal(reads,2);assert.match(f.dom.window.document.body.textContent!,/服务尚未就绪/);assert.ok(f.button('重试'));
});
