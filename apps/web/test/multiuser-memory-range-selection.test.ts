import test from 'node:test';
import assert from 'node:assert/strict';
import React,{act} from 'react';
import {JSDOM} from 'jsdom';
import {setTimeout as delay} from 'node:timers/promises';
import {configureLocale} from '@mote/shared/i18n';
import {scopedMemoryFixture} from '../../server/test/fixtures/scoped-memory-host.js';
import {Memories} from '../src/Memories.js';
import type {Api} from '../src/api.js';
configureLocale(()=> 'zh-CN');

test('the original range and raw-source Memory actions admit exact scoped inputs and retain the immutable body after lost ACK',async t=>{
 const f=await scopedMemoryFixture(t),a=await f.publish(f.a,'A');await f.publish(f.b,'B');
 const dom=new JSDOM('<!doctype html><div id="root"></div>',{url:'http://localhost/#/library?view=memories',pretendToBeVisual:true}),before=new Map<string,PropertyDescriptor|undefined>();for(const [key,value]of Object.entries({window:dom.window,document:dom.window.document,HTMLElement:dom.window.HTMLElement,IS_REACT_ACT_ENVIRONMENT:true})){before.set(key,Object.getOwnPropertyDescriptor(globalThis,key));Object.defineProperty(globalThis,key,{value,configurable:true,writable:true});}
 const {createRoot}=await import('react-dom/client'),root=createRoot(dom.window.document.getElementById('root')!),d=dom.window.document,calls:{path:string;body:any;status:number}[]=[];let lose=true;
 t.after(async()=>{await act(async()=>root.unmount());for(const [key,value]of before){if(value)Object.defineProperty(globalThis,key,value);else Reflect.deleteProperty(globalThis,key);}dom.window.close();});
 const api={connection:{mode:'web',origin:'http://localhost',deploymentId:f.node.deploymentId,userId:f.a.userId,credentialId:'A',csrfToken:'generated',username:'A',administrator:false},request:async(path:string,init?:RequestInit)=>{const body=init?.body?JSON.parse(String(init.body)):undefined,r=await f.request(f.a.token,path,init?.method,body);calls.push({path,body,status:r.statusCode});if(r.statusCode!==200)throw Error(r.statusCode+' '+r.body);if(path==='/api/memory/jobs'&&body&&lose){lose=false;throw Error('Generated lost range ACK');}return r.json();}} as Api;
 const wait=async(check:()=>boolean,label:string)=>{for(let n=0;n<400&&!check();n++)await act(async()=>delay(10));assert.ok(check(),label+' '+d.body.textContent);};
 await act(async()=>{root.render(React.createElement(Memories,{api,range:{after:'2026-01-01T00:00:00Z',before:'2026-01-02T00:00:00Z',deviceId:'same-device'},onOpen:()=>{}}));await delay(30);});
 await wait(()=>!!d.querySelector('.memory-actions button:not(:disabled)'),'original range action ready');await act(async()=>{d.querySelector<HTMLButtonElement>('.memory-actions button')!.click();await delay(30);});
 const admission=calls.find(call=>call.body&&call.path.includes('memory')&&call.path!=='/api/context/read');assert.ok(admission);assert.equal(admission.path,'/api/memory/jobs','the original range action must leave the retired global job route');assert.equal(admission.status,200,JSON.stringify(admission));assert.deepEqual(admission.body.materialRevisions,{[a.id]:a.revision});assert.equal(admission.body.evidencePins.length,1);await wait(()=>d.body.textContent!.includes('Generated lost range ACK'),'actual admitted ACK loss');await f.publish(f.a,'A','same-source','later-range-member');
 await act(async()=>{d.querySelector<HTMLButtonElement>('.memory-actions button')!.click();await delay(30);});const attempts=calls.filter(call=>call.path==='/api/memory/jobs'&&call.body);assert.equal(attempts.length,2);assert.deepEqual(attempts[1].body,attempts[0].body,'ACK retry cannot expand to later range members');await f.wait(f.a,admission.body.operationId);
 const capture=(await f.request(f.a.token,'/api/capture-browser/previews?limit=60')).json().items.find((item:any)=>item.id);await act(async()=>{dom.window.location.hash='#/library?view=memories&memorySource=capture:'+capture.id;dom.window.dispatchEvent(new dom.window.HashChangeEvent('hashchange'));await delay(30);});await wait(()=>!!d.querySelector('.memory-source-selection')&&!d.querySelector<HTMLButtonElement>('.memory-actions button')!.disabled,'original raw action ready');await act(async()=>{d.querySelector<HTMLButtonElement>('.memory-actions button')!.click();await delay(30);});await wait(()=>calls.filter(call=>call.path==='/api/memory/jobs'&&call.body).length===3,'raw source action uses existing M07 admission');assert.ok(calls.some(call=>call.path.startsWith('/api/memory/selection?')&&call.path.includes('captureId=')));
});
