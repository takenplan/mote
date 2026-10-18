import test from 'node:test';
import assert from 'node:assert/strict';
import React,{act} from 'react';
import {JSDOM} from 'jsdom';
import {setTimeout as delay} from 'node:timers/promises';
import {configureLocale} from '@mote/shared/i18n';
import {fixture,password} from '../../server/test/fixtures/mcp.js';
import {createApi,type Api} from '../src/api.js';
import {Sources} from '../src/Sources.js';
configureLocale(()=> 'zh-CN');

test('original target draft discovers without saving or creating a source, then imports selected resources for the current account',async t=>{
 const remote=await fixture(t),local=await fixture(t);await remote.node.app.listen({host:'127.0.0.1',port:0});
 await remote.ok(remote.a.token,'/api/sources/same-source','PATCH',{name:'GENERATED_ONE_SHOT_A'});
 await remote.ok(remote.b.token,'/api/sources/same-source','PATCH',{name:'GENERATED_ONE_SHOT_B'});
 const grants={a:await remote.mint(remote.a.token),b:await remote.mint(remote.b.token)},endpoint=remote.node.app.listeningOrigin+'/mcp';
 const nativeFetch=globalThis.fetch,dom=new JSDOM('<!doctype html><div id="root"></div>',{url:'http://localhost/#/connections?setup=mcp',pretendToBeVisual:true}),before=new Map<string,PropertyDescriptor|undefined>();
 let cookie='',current:Api|undefined,hold=false,release!:()=>void,entered!:()=>void;
 const gate=new Promise<void>(resolve=>release=resolve),ready=new Promise<void>(resolve=>entered=resolve),calls:{path:string;method:string;body:any;status:number;session:string}[]=[];
 for(const [key,value]of Object.entries({window:dom.window,document:dom.window.document,HTMLElement:dom.window.HTMLElement,Event:dom.window.Event,IS_REACT_ACT_ENVIRONMENT:true,fetch:async(input:RequestInfo|URL,init:RequestInit={})=>{
  if(typeof input!=='string'||!input.startsWith('/api/'))return nativeFetch(input,init);
  const headers=new Headers(init.headers);headers.set('cookie',cookie);
  const response=await local.node.app.inject({url:input,method:init.method as any??'GET',headers:Object.fromEntries(headers),...(init.body?{payload:String(init.body)}:{})});
  calls.push({path:input,method:init.method??'GET',body:init.body?JSON.parse(String(init.body)):undefined,status:response.statusCode,session:headers.get('x-mote-session-id')??''});
  if(hold&&input==='/api/connectors/mcp/discover'){hold=false;assert.equal(response.statusCode,200,response.body);entered();await gate;}
  return new Response(response.rawPayload,{status:response.statusCode,headers:response.headers as Record<string,string>});
 }})){before.set(key,Object.getOwnPropertyDescriptor(globalThis,key));Object.defineProperty(globalThis,key,{value,configurable:true,writable:true});}
 const {createRoot}=await import('react-dom/client'),root=createRoot(dom.window.document.getElementById('root')!),d=dom.window.document;
 t.after(async()=>{release();current?.close?.();await act(async()=>root.unmount());for(const [key,value]of before){if(value)Object.defineProperty(globalThis,key,value);else Reflect.deleteProperty(globalThis,key);}dom.window.close();});
 const login=async(username:string)=>{const response=await local.request(undefined,'/api/auth/login','POST',{username,password,mode:'web'});assert.equal(response.statusCode,200,response.body);cookie=String(response.headers['set-cookie']).split(';')[0];const api=createApi({mode:'web',origin:'http://localhost',...response.json()},undefined,()=>current===api);current?.close?.();current=api;return api;};
 const render=async(api:Api)=>act(async()=>{root.render(React.createElement(React.StrictMode,null,React.createElement(Sources,{api,onOpen:()=>{},onImport:()=>{}})));await delay(30);});
 const wait=async(predicate:()=>boolean,label:string)=>{for(let i=0;i<300&&!predicate();i++)await act(async()=>delay(10));assert.ok(predicate(),label+' '+d.body.textContent);};
 const button=(label:string)=>Array.from(d.querySelectorAll<HTMLButtonElement>('button')).find(value=>value.textContent===label);
 const press=async(label:string)=>act(async()=>{const target=button(label);assert.ok(target,label);assert.equal(target.disabled,false,label+' enabled');target.click();await delay(30);});
 const fill=async(label:string,value:string)=>act(async()=>{const input=d.querySelector<HTMLInputElement>('input[aria-label="'+label+'"]');assert.ok(input,label);Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype,'value')!.set!.call(input,value);input.dispatchEvent(new dom.window.Event('input',{bubbles:true}));input.dispatchEvent(new dom.window.Event('change',{bubbles:true}));await delay(10);});
 const resource=()=>Array.from(d.querySelectorAll<HTMLLabelElement>('label')).find(value=>value.textContent==='source-catalog')?.querySelector<HTMLInputElement>('input[type="checkbox"]');
 const a=await login('generated-a');await render(a);await wait(()=>!!d.querySelector('input[aria-label="MCP 服务地址"]'),'original draft fields');
 const initialConfig=await local.ok(local.a.token,'/api/configuration'),initialSources=await local.ok(local.a.token,'/api/sources');
 await fill('MCP 服务地址',endpoint);await fill('MCP 来源名称','Generated imported catalog');await fill('远端 MCP 令牌',grants.a.token);
 await press('列出可读取资源');await wait(()=>!!resource(),'resource discovery before save');
 assert.deepEqual(await local.ok(local.a.token,'/api/configuration'),initialConfig,'discovery does not save a connection or token');
 assert.deepEqual(await local.ok(local.a.token,'/api/sources'),initialSources,'discovery does not pre-create a source');
 assert.equal(calls.filter(call=>call.method!=='GET').length,1,'only discovery ran');
 await act(async()=>{resource()!.click();await delay(10);});await press('导入选定资源');await wait(()=>d.body.textContent!.includes('导入完成：1 条新资料，0 条已存在。'),'one-time import');
 const importedSources=(await local.ok(local.a.token,'/api/sources')).items.filter((source:any)=>!initialSources.items.some((prior:any)=>prior.id===source.id));assert.equal(importedSources.length,1);assert.equal(importedSources[0].name,'Generated imported catalog');
 const importedId=importedSources[0].id;assert.match(JSON.stringify(await local.ok(local.a.token,'/api/source-items?sourceId='+importedId)),/GENERATED_ONE_SHOT_A/);assert.doesNotMatch(JSON.stringify(await local.ok(local.b.token,'/api/source-items')),/GENERATED_ONE_SHOT_A/);
 assert.deepEqual(await local.ok(local.a.token,'/api/configuration'),initialConfig,'import also leaves persistent connection configuration untouched');
 assert.equal(d.querySelector<HTMLInputElement>('input[aria-label="远端 MCP 令牌"]')!.value,'');
 const mutations=calls.filter(call=>call.method!=='GET');assert.deepEqual(mutations.map(call=>call.path),['/api/connectors/mcp/discover','/api/ingress/devices','/api/ingress/sources','/api/connectors/mcp/import']);
 assert.deepEqual(mutations[0].body,{url:endpoint,token:grants.a.token});assert.deepEqual(mutations[3].body,{url:endpoint,token:grants.a.token,sourceId:importedId,resourceUris:['mote://sources']});
 // A late response and draft target cannot populate B's original fields/resources.
 await fill('远端 MCP 令牌',grants.a.token);hold=true;await press('列出可读取资源');await ready;
 const b=await login('generated-b');await render(b);release();await act(async()=>delay(30));assert.equal(resource(),undefined);assert.equal(button('导入选定资源'),undefined);assert.equal(d.querySelector<HTMLInputElement>('input[aria-label="MCP 服务地址"]')!.value,'');assert.equal(d.querySelector<HTMLInputElement>('input[aria-label="远端 MCP 令牌"]')!.value,'');
 await fill('MCP 服务地址',endpoint);await fill('远端 MCP 令牌',grants.b.token);await press('列出可读取资源');await wait(()=>!!resource(),'B positive discovery');
 await act(async()=>{resource()!.click();await delay(10);});await press('导入选定资源');await wait(()=>d.body.textContent!.includes('导入完成：1 条新资料，0 条已存在。'),'B one-time import');
 assert.match(JSON.stringify(await local.ok(local.b.token,'/api/source-items')),/GENERATED_ONE_SHOT_B/);assert.doesNotMatch(JSON.stringify(await local.ok(local.b.token,'/api/source-items')),/GENERATED_ONE_SHOT_A/);
 assert.ok(calls.every(call=>call.status<400),JSON.stringify(calls.filter(call=>call.status>=400)));
});
