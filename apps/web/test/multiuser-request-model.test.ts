import test from 'node:test';
import assert from 'node:assert/strict';
import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import {JSDOM} from 'jsdom';
import {configureLocale} from '@mote/shared/i18n';
import {Conversations} from '../src/Conversations.js';
import {requestModelSelection} from '../src/ask-model-selection.js';
import type {Api} from '../src/api.js';
configureLocale(()=> 'zh-CN');

test('Web model selection uses an explicit scoped reference, legacy transport keeps its original field',()=>{
 assert.deepEqual(JSON.parse(JSON.stringify(requestModelSelection(true,'personal:same-model','generated-alt'))),{modelReference:{kind:'personal',id:'same-model'},modelOverride:'generated-alt'});
 assert.deepEqual(JSON.parse(JSON.stringify(requestModelSelection(true,'shared:same-model'))),{modelReference:{kind:'shared',id:'same-model'}});
 assert.deepEqual(JSON.parse(JSON.stringify(requestModelSelection(true,''))),{});
 assert.deepEqual(JSON.parse(JSON.stringify(requestModelSelection(false,'legacy-profile','generated-alt'))),{modelProfileId:'legacy-profile',modelOverride:'generated-alt'});
 assert.throws(()=>requestModelSelection(true,'legacy-profile'),/Invalid account model reference/);
});

test('same-ID model choice retires on A to B and the original composer sends only its current scoped reference',async t=>{
 const dom=new JSDOM('<!doctype html><div id="root"></div>',{url:'http://localhost/#/ask',pretendToBeVisual:true}),before=new Map<string,PropertyDescriptor|undefined>();
 for(const [key,value]of Object.entries({window:dom.window,document:dom.window.document,HTMLElement:dom.window.HTMLElement,IS_REACT_ACT_ENVIRONMENT:true})){before.set(key,Object.getOwnPropertyDescriptor(globalThis,key));Object.defineProperty(globalThis,key,{value,configurable:true,writable:true});}
 const root=createRoot(dom.window.document.getElementById('root')!),calls:{owner:string;body:any}[]=[];
 t.after(async()=>{await act(async()=>root.unmount());for(const [key,value]of before){if(value)Object.defineProperty(globalThis,key,value);else Reflect.deleteProperty(globalThis,key);}dom.window.close();});
 function api(owner:string):Api{return {connection:{mode:'web',origin:'http://localhost',deploymentId:'generated',userId:owner,credentialId:owner,csrfToken:'generated',username:owner},request:async(path:string,init?:RequestInit)=>{
  if(path==='/api/models')return {personal:[{id:'same-model',name:'Generated '+owner,settings:{model:'generated-'+owner}}],shared:[],selections:{}};
  if(path.startsWith('/api/operations/changes'))return {cursor:0,ids:[],reset:false,hasMore:false};
  if(path==='/api/query-runs'&&init?.method==='POST'){const body=JSON.parse(String(init.body));calls.push({owner,body});return {id:body.id,status:'failed',createdAt:'2026-01-01T00:00:00Z',updatedAt:'2026-01-01T00:00:00Z',events:[],error:{code:'generated'}};}
  if(path.startsWith('/api/query-runs/'))return {id:path.split('/').at(-1),status:'failed',createdAt:'2026-01-01T00:00:00Z',updatedAt:'2026-01-01T00:00:00Z',events:[],error:{code:'generated'}};
  if(path.startsWith('/api/conversations')||path==='/api/query-runs')return {items:[],nextCursor:null};
  throw Error('Unexpected model fixture path '+path);
 }} as Api;}
 const a=api('A'),b=api('B'),d=dom.window.document,render=(value:Api)=>act(async()=>root.render(React.createElement(Conversations,{api:value,configured:false,devices:[],renderAnswer:()=>null})));
 await render(a);await act(async()=>{const select=d.querySelector<HTMLSelectElement>('[aria-label="本次模型"]')!;select.value='personal:same-model';select.dispatchEvent(new dom.window.Event('change',{bubbles:true}));});
 assert.equal(d.querySelector<HTMLSelectElement>('[aria-label="本次模型"]')!.value,'personal:same-model');
 await render(b);assert.equal(d.querySelector<HTMLSelectElement>('[aria-label="本次模型"]')!.value,'','A choice must not silently select the same ID in B');assert.doesNotMatch(d.body.textContent!,/Generated A/);
 await act(async()=>{const select=d.querySelector<HTMLSelectElement>('[aria-label="本次模型"]')!;select.value='personal:same-model';select.dispatchEvent(new dom.window.Event('change',{bubbles:true}));});
 await act(async()=>Array.from(d.querySelectorAll('button')).find(button=>button.textContent==='我最近都做了些什么？')!.click());
 assert.equal(calls.length,1);assert.equal(calls[0].owner,'B');assert.deepEqual(calls[0].body.input.modelReference,{kind:'personal',id:'same-model'});assert.equal(calls[0].body.input.modelProfileId,undefined);
});
