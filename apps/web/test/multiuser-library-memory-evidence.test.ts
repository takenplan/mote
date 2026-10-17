import test from 'node:test';
import assert from 'node:assert/strict';
import React,{act} from 'react';
import {JSDOM} from 'jsdom';
import {setTimeout as delay} from 'node:timers/promises';
import {configureLocale} from '@mote/shared/i18n';
import {scopedMemoryFixture} from '../../server/test/fixtures/scoped-memory-host.js';
import {Archive} from '../src/Archive.js';
import {featuresReady} from '../src/features/runtime.js';
import {ApiError,type Api} from '../src/api.js';

configureLocale(()=> 'zh-CN');

test('original Library Memory supporting links read retained context, survive reload, and retire a held A read before B',async t=>{
 const f=await scopedMemoryFixture(t);await featuresReady;
 for(const [user,label]of [[f.a,'A'],[f.b,'B']]as const){const material=await f.publish(user,label);await f.wait(user,(await f.submit(user,[material.id])).id);}
 const dom=new JSDOM('<!doctype html><div id="root"></div>',{url:'http://localhost/#/library?view=memories',pretendToBeVisual:true}),before=new Map<string,PropertyDescriptor|undefined>();
 for(const [key,value]of Object.entries({window:dom.window,document:dom.window.document,location:dom.window.location,localStorage:dom.window.localStorage,HTMLElement:dom.window.HTMLElement,IS_REACT_ACT_ENVIRONMENT:true})){before.set(key,Object.getOwnPropertyDescriptor(globalThis,key));Object.defineProperty(globalThis,key,{value,configurable:true,writable:true});}
 const {createRoot}=await import('react-dom/client');let root=createRoot(dom.window.document.getElementById('root')!);
 const calls:{owner:string;path:string;body?:any}[]=[];let hold=false,arrived!:()=>void,release!:()=>void;
 const entered=new Promise<void>(resolve=>arrived=resolve),barrier=new Promise<void>(resolve=>release=resolve);
 const api=(user:any,owner:string):Api=>({connection:{mode:'web',origin:'http://localhost',deploymentId:f.node.deploymentId,userId:user.userId,credentialId:user.credentialId,csrfToken:'generated',username:owner,administrator:false},request:async(path,init)=>{
  const body=init?.body?JSON.parse(String(init.body)):undefined;calls.push({owner,path,body});
  const response=await f.request(user.token,path,init?.method,body);if(response.statusCode!==200)throw new ApiError(response.body,response.statusCode);
  if(hold&&owner==='A'&&path==='/api/context/read'){arrived();await barrier;}
  return response.json();
 }} as Api),a=api(f.a,'A'),b=api(f.b,'B'),d=dom.window.document;
 t.after(async()=>{release();await act(async()=>root.unmount());for(const[key,value]of before){if(value)Object.defineProperty(globalThis,key,value);else Reflect.deleteProperty(globalThis,key);}dom.window.close();});
 const render=(api:Api)=>act(async()=>{root.render(React.createElement(Archive,{api,devices:[],range:{},activity:{apps:[],devices:[],totalDurationMs:0,captures:0},revision:0,tab:'memories',setTab:()=>{},onOpen:()=>{}}));await delay(10);});
 const wait=async(check:()=>boolean,label:string)=>{for(let n=0;n<500&&!check();n++)await act(async()=>delay(10));assert.ok(check(),label+' '+d.body.textContent);};
 const openMemory=async(owner:string)=>{await wait(()=>Array.from(d.querySelectorAll<HTMLButtonElement>('.workspace-select')).some(button=>button.textContent?.includes('Generated '+owner)),'current owned Memory card');await act(async()=>{Array.from(d.querySelectorAll<HTMLButtonElement>('.workspace-select')).find(button=>button.textContent?.includes('Generated '+owner))!.click();await delay(10);});await wait(()=>!!d.querySelector('.memory-evidence .evidence-card'),'original supporting-evidence control');await act(async()=>{d.querySelector<HTMLButtonElement>('.memory-evidence .evidence-card')!.click();await delay(10);});};
 const detail=()=>d.querySelector('.library-detail')?.textContent??'';

 await render(a);await openMemory('A');
 await wait(()=>detail().includes('GENERATED_MEMORY_A')||!!d.querySelector('.library-detail [role="alert"]'),'supporting reader terminal result');
 assert.match(detail(),/GENERATED_MEMORY_A/,'the actual Library split reader must resolve the navigation-only context prefix');
 assert.doesNotMatch(detail(),/GENERATED_MEMORY_B/);
 assert.match(new URLSearchParams(dom.window.location.hash.split('?')[1]).get('selected')!,/^context:capture:/,'the navigation tag remains in the saved Library selection');
 const first=calls.find(call=>call.path==='/api/context/read')!;assert.match(first.body.refs[0],/^capture:/);assert.ok(!first.body.refs[0].startsWith('context:'));
 assert.ok(!calls.some(call=>call.path.startsWith('/api/capture-browser/')),'a context link must not fall back to the raw archive reader');

 await act(async()=>root.unmount());root=createRoot(d.getElementById('root')!);await render(a);
 await wait(()=>detail().includes('GENERATED_MEMORY_A'),'same-owner Library selection restores through the context reader');
 // An already successful A HTTP read may arrive after the original Library has
 // remounted for B. Its text still belongs to its captured A consumer.
 await act(async()=>root.unmount());root=createRoot(d.getElementById('root')!);hold=true;await render(a);await entered;
 await render(b);assert.doesNotMatch(detail(),/GENERATED_MEMORY_A/);await openMemory('B');
 await wait(()=>detail().includes('GENERATED_MEMORY_B'),'B positive supporting-evidence reader');release();await act(async()=>delay(20));
 assert.match(detail(),/GENERATED_MEMORY_B/);assert.doesNotMatch(detail(),/GENERATED_MEMORY_A/);
 assert.ok(calls.some(call=>call.owner==='B'&&call.path==='/api/context/read'));
});
