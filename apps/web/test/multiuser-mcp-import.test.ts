import test from 'node:test';
import assert from 'node:assert/strict';
import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import {JSDOM} from 'jsdom';
import {configureLocale} from '@mote/shared/i18n';
import {ScopedMcpImport} from '../src/ScopedMcpImport.js';
import type {Api} from '../src/api.js';
configureLocale(()=> 'zh-CN');
test('MCP resource draft belongs to its account even when B has the same configured IDs',async t=>{
 const dom=new JSDOM('<!doctype html><div id="root"></div>',{url:'http://localhost/',pretendToBeVisual:true}),before=new Map<string,PropertyDescriptor|undefined>();
 for(const [key,value]of Object.entries({window:dom.window,document:dom.window.document,HTMLElement:dom.window.HTMLElement,localStorage:dom.window.localStorage,IS_REACT_ACT_ENVIRONMENT:true})){before.set(key,Object.getOwnPropertyDescriptor(globalThis,key));Object.defineProperty(globalThis,key,{value,configurable:true,writable:true});}
 const root=createRoot(dom.window.document.getElementById('root')!);t.after(async()=>{await act(async()=>root.unmount());for(const [key,value]of before){if(value)Object.defineProperty(globalThis,key,value);else Reflect.deleteProperty(globalThis,key);}dom.window.close();});
 const calls:{owner:string;path:string;body?:unknown}[]=[];
 function api(owner:string):Api{return {connection:{mode:'web',origin:'http://localhost',deploymentId:'generated',userId:owner,credentialId:owner,username:owner,csrfToken:'generated'},request:async(path:string,init?:RequestInit)=>{
  const body=init?.body?JSON.parse(String(init.body)):undefined;calls.push({owner,path,body});
  if(path==='/api/configuration')return {revision:1,domains:[{id:'mcpConnections',saved:{connections:[{id:'same-connection',url:'https://synthetic.invalid/mcp',token:true,sourceIds:['same-source']}]}}]};
  if(path==='/api/sources')return {items:[{id:'same-source',name:owner+' source',kind:'mcp',enabled:true}]};
  if(path.endsWith('/discover')){assert.deepEqual(body,{connectionId:'same-connection'});return {resources:[{uri:'generated://'+owner,name:'GENERATED_'+owner+'_RESOURCE'}]};}
  if(path.endsWith('/import'))return {imported:1,duplicates:0};
  throw Error('Unexpected generated MCP request '+path);
 }} as Api;}
 const a=api('A'),b=api('B'),render=(api:Api)=>act(async()=>root.render(React.createElement(ScopedMcpImport,{api,refresh:async()=>{},requested:true}))),d=dom.window.document;
 await render(a);await act(async()=>{const select=d.querySelector<HTMLSelectElement>('[aria-label="外部 MCP 连接"]')!;select.value='same-connection';select.dispatchEvent(new dom.window.Event('change',{bubbles:true}));});
 await act(async()=>Array.from(d.querySelectorAll('button')).find(button=>button.textContent==='列出可读取资源')!.click());
 assert.match(d.body.textContent!,/GENERATED_A_RESOURCE/);await act(async()=>d.querySelector<HTMLInputElement>('input[type="checkbox"]')!.click());
 await render(b);assert.doesNotMatch(d.body.textContent!,/GENERATED_A_RESOURCE/);
 assert(!Array.from(d.querySelectorAll('button')).some(button=>button.textContent==='导入选定资源'));
 assert(!calls.some(call=>call.owner==='B'&&call.path.endsWith('/import')));
});
