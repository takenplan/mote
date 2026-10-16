import test from 'node:test';
import assert from 'node:assert/strict';
import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import {JSDOM} from 'jsdom';
import {setTimeout as delay} from 'node:timers/promises';
import {configureLocale} from '@mote/shared/i18n';
import {scopedMemoryFixture} from '../../server/test/fixtures/scoped-memory-host.js';
import {Memories} from '../src/Memories.js';
import type {Api} from '../src/api.js';
configureLocale(()=> 'zh-CN');

test('original Memories reads real M07 publication and opens its evidence through the declared context reader',async t=>{
 const f=await scopedMemoryFixture(t),am=await f.publish(f.a,'A'),bm=await f.publish(f.b,'B');assert.equal(am.id,bm.id);
 await Promise.all([f.wait(f.a,(await f.submit(f.a,[am.id])).id),f.wait(f.b,(await f.submit(f.b,[bm.id])).id)]);
 const dom=new JSDOM('<!doctype html><div id="root"></div>',{url:'http://localhost/#/library?view=memories',pretendToBeVisual:true}),before=new Map<string,PropertyDescriptor|undefined>();
 for(const [key,value]of Object.entries({window:dom.window,document:dom.window.document,HTMLElement:dom.window.HTMLElement,IS_REACT_ACT_ENVIRONMENT:true})){before.set(key,Object.getOwnPropertyDescriptor(globalThis,key));Object.defineProperty(globalThis,key,{value,configurable:true,writable:true});}
 const root=createRoot(dom.window.document.getElementById('root')!),calls:{owner:string;path:string;status:number}[]=[],opened:string[]=[];
 t.after(async()=>{await act(async()=>root.unmount());for(const [key,value]of before){if(value)Object.defineProperty(globalThis,key,value);else Reflect.deleteProperty(globalThis,key);}dom.window.close();});
 const api=(account:any,owner:string):Api=>({connection:{mode:'web',origin:'http://localhost',deploymentId:'generated',userId:owner,credentialId:owner,csrfToken:'generated',username:owner,administrator:false},request:async(path,init)=>{const r=await f.request(account.token,path,init?.method,init?.body?JSON.parse(String(init.body)):undefined);calls.push({owner,path,status:r.statusCode});if(r.statusCode!==200)throw Error(r.statusCode+' '+r.body);return r.json();}} as Api);
 const d=dom.window.document,render=(value:Api)=>act(async()=>{root.render(React.createElement(Memories,{key:value.connection!.userId,api:value,range:{},onOpen:(ref:string)=>opened.push(ref)}));await delay(30);});
 await render(api(f.a,'A'));
 const card=d.querySelector<HTMLButtonElement>('.workspace-select');assert.ok(card,'actual M07 published memory is visible through the original page: '+d.body.textContent);
 assert.match(card.textContent!,/Generated A/);assert.doesNotMatch(d.body.textContent!,/Generated B/);
 await act(async()=>{card.click();await delay(30);});assert.match(d.querySelector('.memory-detail')!.textContent!,/Nora prefers generated tea/);
 const evidence=d.querySelector<HTMLButtonElement>('.memory-evidence .evidence-card');assert.ok(evidence);await act(async()=>evidence.click());
 assert.match(opened[0],/^context:capture:/,'M07 normalized evidence belongs to the context reader, not raw captures');
 const read=await f.request(f.a.token,'/api/context/read','POST',{refs:[opened[0].slice(8)]});assert.equal(read.statusCode,200,read.body);assert.match(read.body,/GENERATED_MEMORY_A/);assert.doesNotMatch(read.body,/GENERATED_MEMORY_B/);
 await render(api(f.b,'B'));assert.match(d.body.textContent!,/Generated B/);assert.doesNotMatch(d.body.textContent!,/Generated A/);assert.equal(d.querySelector('.memory-detail'),null);
 assert.equal(calls.filter(call=>call.path.startsWith('/api/memories?')&&call.status!==200).length,0);
});
