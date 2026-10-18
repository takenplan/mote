import test from 'node:test';
import assert from 'node:assert/strict';
import React,{act} from 'react';
import {JSDOM} from 'jsdom';
import {configureLocale} from '@mote/shared/i18n';
import {PerceptionSettings} from '../src/PerceptionSettings.js';
import type {Api} from '../src/api.js';
configureLocale(()=> 'zh-CN');

test('scoped Images retains image permissions and original preview/confirm controls, retiring A saves before B',async t=>{
 const dom=new JSDOM('<!doctype html><div id="root"></div>',{url:'http://localhost/'}),before=new Map<string,PropertyDescriptor|undefined>();
 for(const[key,value]of Object.entries({window:dom.window,document:dom.window.document,HTMLElement:dom.window.HTMLElement,IS_REACT_ACT_ENVIRONMENT:true})){before.set(key,Object.getOwnPropertyDescriptor(globalThis,key));Object.defineProperty(globalThis,key,{value,configurable:true,writable:true});}
 const {createRoot}=await import('react-dom/client'),root=createRoot(dom.window.document.getElementById('root')!),calls:{owner:string;path:string;body?:any}[]=[];
 let hold=false,release!:(value:any)=>void;
 const view=(owner:string)=>({revision:owner==='A'?1:4,settings:{providerRevision:'generated-'+owner,enabled:owner==='A',ocrProcessorId:'image.http',ocrEndpoint:'',allowExternalProcessing:false,allowQueryImages:false,understandingEnabled:false,profileId:'image'},model:null,jobs:[],backfills:[]});
 const api=(owner:string)=>({connection:{mode:'web',userId:owner},request:async(path:string,init?:RequestInit)=>{const body=init?.body?JSON.parse(String(init.body)):undefined;calls.push({owner,path,body});if(path==='/api/perception'){if(init?.method==='PUT'){if(hold)return new Promise(resolve=>{release=resolve;});return {...view(owner),revision:2,settings:body.settings};}return view(owner);}if(path==='/api/file-processing')return {policy:{profiles:[{id:'image',name:'Generated image',processorId:'archive'}]},processors:[]};if(path==='/api/sources')return {items:[]};if(path.endsWith('historical-preview'))return {token:'generated-preview-'+owner,count:2};if(path.endsWith('historical-process'))return {queued:2};throw Error(path);}} as Api);
 t.after(async()=>{release?.(view('A'));await act(async()=>root.unmount());for(const[key,value]of before){if(value)Object.defineProperty(globalThis,key,value);else Reflect.deleteProperty(globalThis,key);}dom.window.close();});
 const render=(value:Api)=>act(async()=>{root.render(React.createElement(PerceptionSettings,{api:value}));await new Promise(resolve=>setTimeout(resolve,20));}),button=(label:string)=>[...dom.window.document.querySelectorAll<HTMLButtonElement>('button')].find(item=>item.textContent===label)!,press=(label:string)=>act(async()=>{button(label).click();await new Promise(resolve=>setTimeout(resolve,20));});
 await render(api('A'));const label=[...dom.window.document.querySelectorAll('label')].find(item=>item.textContent?.includes('允许查询模型按需读取'))!;
 await act(async()=>label.querySelector<HTMLInputElement>('input')!.click());await press('保存图片设置');const write=calls.find(call=>call.path==='/api/perception'&&call.body)!;assert.equal(write.body.revision,1);assert.equal(write.body.settings.allowQueryImages,true);
 await press('预览处理范围');assert.equal(calls.find(call=>call.path.endsWith('historical-preview'))!.body.mode,'complete');await press('安排全部图片');assert.deepEqual(calls.find(call=>call.path.endsWith('historical-process'))!.body,{token:'generated-preview-A'});
 assert.ok(!calls.some(call=>call.path.startsWith('/api/media-models')),'ordinary personal image settings do not call host installation APIs');
 hold=true;await act(async()=>label.querySelector<HTMLInputElement>('input')!.click());const old=button('保存图片设置');await press('保存图片设置');await render(api('B'));await act(async()=>{release({...view('A'),revision:3});await new Promise(resolve=>setTimeout(resolve,20));});
 assert.equal(dom.window.document.querySelector<HTMLInputElement>('input[type="checkbox"]')!.checked,false);assert.doesNotMatch(dom.window.document.body.textContent!,/generated-A/);const count=calls.length;await act(async()=>{old.click();await new Promise(resolve=>setTimeout(resolve,20));});assert.equal(calls.length,count,'retired A buttons cannot submit under B');
});
