import test from 'node:test';
import assert from 'node:assert/strict';
import React,{act} from 'react';
import {JSDOM} from 'jsdom';
import {configureLocale} from '@mote/shared/i18n';
import {ManagedMediaModels} from '../src/ManagedMediaModels.js';
import type {Api} from '../src/api.js';
configureLocale(()=> 'zh-CN');

test('managed models retain actual states, admin actions and retired-account controls',async t=>{
 const dom=new JSDOM('<!doctype html><div id="root"></div>',{url:'http://localhost/'}),before=new Map<string,PropertyDescriptor|undefined>();
 for(const[key,value]of Object.entries({window:dom.window,document:dom.window.document,HTMLElement:dom.window.HTMLElement,IS_REACT_ACT_ENVIRONMENT:true})){before.set(key,Object.getOwnPropertyDescriptor(globalThis,key));Object.defineProperty(globalThis,key,{value,configurable:true,writable:true});}
 const {createRoot}=await import('react-dom/client'),root=createRoot(dom.window.document.getElementById('root')!),calls:{owner:string;path:string;method:string;body?:unknown}[]=[];
 const wait=()=>new Promise(resolve=>setTimeout(resolve,20));
 let state='not_installed',runtimeReady=false,invalid=false,hold=false,release!:(value:unknown)=>void;
 const receipt=()=>({ocr:{state,bytes:4,totalBytes:8,source:'official',version:'generated',runtimeReady,...(state==='failed'?{error:'GENERATED_HASH_MISMATCH'}:{})}});
 const api=(owner:string,administrator:boolean)=>({connection:{mode:'web',userId:owner,administrator},request:async(path:string,init?:RequestInit)=>{
  calls.push({owner,path,method:init?.method??'GET',...(init?.body?{body:JSON.parse(String(init.body))}:{})});
  if(init?.method==='POST'){if(hold)return new Promise(resolve=>{release=resolve;});state=path.endsWith('cancel')?'cancelled':'downloading';return {};}
  assert.equal(path,'/api/media-models');return invalid?{}:receipt();
 }} as Api);
 t.after(async()=>{release?.({});await act(async()=>root.unmount());for(const[key,value]of before){if(value)Object.defineProperty(globalThis,key,value);else Reflect.deleteProperty(globalThis,key);}dom.window.close();});
 const render=(api:Api)=>act(async()=>{root.render(React.createElement(ManagedMediaModels,{api,role:'ocr'}));await wait();}),button=(label:string)=>[...dom.window.document.querySelectorAll<HTMLButtonElement>('button')].find(value=>value.textContent===label),press=(label:string)=>act(async()=>{assert.ok(button(label),label);button(label)!.click();await wait();}),text=()=>dom.window.document.body.textContent!;
 const ordinary=api('A',false);await render(ordinary);assert.match(text(),/尚未安装/);assert.match(text(),/仅管理员/);assert.equal(button('下载并安装 OCR 模型'),undefined);assert.equal(calls.some(value=>value.method==='POST'),false);
 const admin=api('admin',true);await render(admin);await press('下载并安装 OCR 模型');assert.deepEqual(calls.find(value=>value.method==='POST'),{owner:'admin',path:'/api/admin/media-models/ocr/install',method:'POST',body:{source:'auto'}});assert.match(text(),/下载中/);assert.ok(dom.window.document.querySelector('progress'));await press('取消下载');assert.match(text(),/已取消/);
 state='failed';await press('刷新');assert.match(text(),/处理失败/);assert.match(text(),/GENERATED_HASH_MISMATCH/);assert.ok(button('下载并安装 OCR 模型'));
 state='ready';await press('刷新');assert.match(text(),/模型文件已安装/);assert.match(text(),/正在准备本地 OCR 服务/);assert.equal(button('下载并安装 OCR 模型'),undefined);runtimeReady=true;await press('刷新');assert.match(text(),/OCR Worker 已就绪/);
 invalid=true;await press('刷新');assert.match(text(),/状态读取失败/);assert.equal(button('下载并安装 OCR 模型'),undefined);invalid=false;
 state='not_installed';await press('刷新');const retired=button('下载并安装 OCR 模型')!;hold=true;await press('下载并安装 OCR 模型');await render(api('B',false));await act(async()=>{release({});await wait();});assert.match(text(),/仅管理员/);const count=calls.length;await act(async()=>{retired.click();await wait();});assert.equal(calls.length,count,'retired administrator controls cannot install under B');
});
