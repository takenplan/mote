import test from 'node:test';
import assert from 'node:assert/strict';
import React,{act} from 'react';
import {JSDOM} from 'jsdom';
import {configureLocale} from '@mote/shared/i18n';
import {ScopedStorageSettings,type InstanceStorageView} from '../src/ScopedStorageSettings.js';
import type {Api} from '../src/api.js';
configureLocale(()=> 'zh-CN');

test('instance storage controls keep original units, CAS revision and saved/effective restart feedback',async t=>{
 const dom=new JSDOM('<!doctype html><div id="root"></div>',{url:'http://localhost/'}),before=new Map<string,PropertyDescriptor|undefined>();
 for(const[key,value]of Object.entries({window:dom.window,document:dom.window.document,HTMLElement:dom.window.HTMLElement,IS_REACT_ACT_ENVIRONMENT:true})){before.set(key,Object.getOwnPropertyDescriptor(globalThis,key));Object.defineProperty(globalThis,key,{value,configurable:true,writable:true});}
 const {createRoot}=await import('react-dom/client'),root=createRoot(dom.window.document.getElementById('root')!),writes:any[]=[];
 const effective={retentionDays:30,maxStorageBytes:1024**3};let state:InstanceStorageView={scope:'instance',revision:7,saved:effective,effective,status:'applied'};
 const api={request:async(path:string,init?:RequestInit)=>{assert.equal(path,'/api/admin/storage-settings');if(init?.method==='PUT'){const body=JSON.parse(String(init.body));writes.push(body);state={scope:'instance',revision:8,saved:{retentionDays:body.retentionDays,maxStorageBytes:body.maxStorageBytes},effective,status:'restart-required'};}return state;}} as Api;
 t.after(async()=>{await act(async()=>root.unmount());for(const[key,value]of before){if(value)Object.defineProperty(globalThis,key,value);else Reflect.deleteProperty(globalThis,key);}dom.window.close();});
 await act(async()=>{root.render(React.createElement(ScopedStorageSettings,{api}));await new Promise(resolve=>setTimeout(resolve,20));});
 for(const[label,value]of [['历史记录保留','90'],['资料容量上限','5120']])await act(async()=>{const select=dom.window.document.querySelector<HTMLSelectElement>('select[aria-label="'+label+'"]')!;select.value=value;select.dispatchEvent(new dom.window.Event('change',{bubbles:true}));});
 await act(async()=>{dom.window.document.querySelector<HTMLButtonElement>('button.primary')!.click();await new Promise(resolve=>setTimeout(resolve,20));});
 assert.deepEqual(writes,[{revision:7,retentionDays:90,maxStorageBytes:5*1024**3}]);
 assert.match(dom.window.document.body.textContent!,/标记的设置需要重启后生效/);assert.match(dom.window.document.querySelector('.effective-settings')!.textContent!,/30 天/);
 assert.equal(dom.window.document.querySelector<HTMLSelectElement>('select[aria-label="资料容量上限"]')!.value,'5120');
 state={...state,revision:9,saved:{...state.saved,maxStorageBytes:5*1024**3+1}};await act(async()=>{root.render(React.createElement(ScopedStorageSettings,{api:{...api}}));await new Promise(resolve=>setTimeout(resolve,20));});
 await act(async()=>{const select=dom.window.document.querySelector<HTMLSelectElement>('select[aria-label="历史记录保留"]')!;select.value='180';select.dispatchEvent(new dom.window.Event('change',{bubbles:true}));});
 await act(async()=>{dom.window.document.querySelector<HTMLButtonElement>('button.primary')!.click();await new Promise(resolve=>setTimeout(resolve,20));});assert.equal(writes.at(-1).maxStorageBytes,5*1024**3+1,'changing retention preserves a capacity that is not a whole MiB');
});
