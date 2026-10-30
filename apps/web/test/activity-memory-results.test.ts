import test from 'node:test';
import assert from 'node:assert/strict';
import React,{act,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {JSDOM} from 'jsdom';
import {configureLocale} from '@mote/shared/i18n';
import {ActivityMemoryResults} from '../src/ActivityMemoryResults.js';
import {ApiError,type Api} from '../src/api.js';

configureLocale(()=> 'zh-CN');
const id=(index:number)=>'00000000-0000-4000-8000-'+String(index).padStart(12,'0');
function deferred<T>(){let resolve!:(value:T)=>void;const promise=new Promise<T>(done=>{resolve=done;});return {promise,resolve};}
async function fixture(t:import('node:test').TestContext){
 const dom=new JSDOM('<!doctype html><div id="root"></div>',{url:'http://localhost/#/activity?work=memory%3Agenerated'}),before=new Map<string,PropertyDescriptor|undefined>();
 for(const [key,value] of Object.entries({window:dom.window,document:dom.window.document,HTMLElement:dom.window.HTMLElement,IS_REACT_ACT_ENVIRONMENT:true})){before.set(key,Object.getOwnPropertyDescriptor(globalThis,key));Object.defineProperty(globalThis,key,{value,configurable:true,writable:true});}
 const root=createRoot(dom.window.document.getElementById('root')!);t.after(async()=>{await act(async()=>root.unmount());for(const [key,value] of before){if(value)Object.defineProperty(globalThis,key,value);else Reflect.deleteProperty(globalThis,key);}dom.window.close();});return {root,d:dom.window.document};
}
function client(initial:string[]){
 let ids=[...initial],failure=0,pageFailure=0,gate:ReturnType<typeof deferred<unknown>>|undefined;const reads:string[]=[];
 const api={request:async(path:string,init?:RequestInit)=>{reads.push(path);assert.ok(init?.signal,'all private reads are abortable');if(path.includes('/memory-results')){if(pageFailure)throw new ApiError('Generated page denied',pageFailure);const cursor=new URL('http://localhost'+path).searchParams.get('cursor'),after=cursor?ids.findIndex(x=>x===cursor)+1:0,selected=ids.slice(after,after+20);return {ids:selected,total:ids.length,nextCursor:after+20<ids.length?selected.at(-1):null};}if(path.startsWith('/api/memories/')){const current=decodeURIComponent(path.split('/').at(-1)!);if(gate){const waiting=gate;gate=undefined;return waiting.promise;}if(failure)throw new ApiError('Generated read denied',failure);return {id:current,title:'Generated '+current,status:'published',createdAt:'2026-09-20T01:00:00Z'};}throw Error('Unexpected '+path);}} as Api;
 return {api,reads,remove:(value:string)=>{ids=ids.filter(x=>x!==value);},fail:(status:number)=>{failure=status;},failPage:(status:number)=>{pageFailure=status;},block:()=>{gate=deferred<unknown>();return gate;}};
}
function View({api,opened}:{api:Api;opened:string[]}){const[cursors,setCursors]=useState<(string|undefined)[]>([undefined]);return React.createElement(ActivityMemoryResults,{api,workId:'memory:generated',cursors,onCursors:setCursors,revision:0,onOpen:value=>opened.push(value),onSettled:()=>{}});}
const click=(d:Document,text:string)=>{const element=[...d.querySelectorAll<HTMLButtonElement>('button')].find(button=>button.textContent?.trim()===text);assert.ok(element,text);element.click();};
test('a bounded second page opens the selected result after fresh membership and Memory reads',async t=>{
 const {root,d}=await fixture(t),client1=client(Array.from({length:22},(_,i)=>id(i+1))),opened:string[]=[];
 await act(async()=>root.render(React.createElement(View,{api:client1.api,opened})));assert.equal(d.querySelectorAll('[data-activity-memory-id]').length,20);assert.match(d.body.textContent!,/22 项/);
 await act(async()=>click(d,'下一页'));assert.equal(d.querySelectorAll('[data-activity-memory-id]').length,2);assert.match(d.body.textContent!,/第 2 页/);
 await act(async()=>d.querySelector<HTMLButtonElement>(`[data-activity-memory-id="${id(22)}"]`)!.click());assert.deepEqual(opened,[id(22)]);assert.ok(client1.reads.filter(path=>path.startsWith('/api/memories/'+id(22))).length>=2);
 await act(async()=>click(d,'上一页'));assert.equal(d.querySelectorAll('[data-activity-memory-id]').length,20);
});
test('membership changed while initial Memory read is pending never publishes a stale title',async t=>{
 const {root,d}=await fixture(t),c=client([id(1)]),opened:string[]=[],gate=c.block();
 await act(async()=>root.render(React.createElement(View,{api:c.api,opened})));assert.equal(d.querySelectorAll('[data-activity-memory-id]').length,0);c.remove(id(1));
 await act(async()=>gate.resolve({id:id(1),title:'Late private title',status:'published'}));assert.doesNotMatch(d.body.textContent!,/Late private title/);assert.match(d.body.textContent!,/状态已变化/);assert.deepEqual(opened,[]);
});
test('removing membership or withdrawing permission while a click is pending prevents navigation and removes the old title',async t=>{
 const {root,d}=await fixture(t),c=client([id(1)]),opened:string[]=[];await act(async()=>root.render(React.createElement(View,{api:c.api,opened})));
 const gate=c.block();await act(async()=>d.querySelector<HTMLButtonElement>('[data-activity-memory-id]')!.click());c.remove(id(1));await act(async()=>gate.resolve({id:id(1),title:'Previously readable',status:'published'}));assert.deepEqual(opened,[]);assert.equal(d.querySelector('[data-activity-memory-id]'),null);assert.match(d.body.textContent!,/暂不可用/);
 await act(async()=>root.unmount());
});
test('403, 404 and 503 never retain a title; retry obtains a fresh readable object',async t=>{
 for(const status of [403,404,503]){
  const {root,d}=await fixture(t),c=client([id(status)]),opened:string[]=[];c.fail(status);await act(async()=>root.render(React.createElement(View,{api:c.api,opened})));assert.equal(d.querySelector('[data-activity-memory-id]'),null);assert.match(d.body.textContent!,/暂不可用/);
  c.fail(0);await act(async()=>click(d,'重试'));assert.match(d.body.textContent!,new RegExp('Generated '+id(status)));await act(async()=>root.unmount());
 }
});
test('late responses from another owner cannot restore an old result',async t=>{
 const {root,d}=await fixture(t),first=client([id(1)]),second=client([id(2)]),opened:string[]=[],gate=first.block();await act(async()=>root.render(React.createElement(View,{api:first.api,opened})));
 await act(async()=>root.render(React.createElement(View,{api:second.api,opened})));assert.match(d.body.textContent!,new RegExp('Generated '+id(2)));await act(async()=>gate.resolve({id:id(1),title:'Old owner private title',status:'published'}));assert.doesNotMatch(d.body.textContent!,/Old owner private title/);assert.equal(d.querySelectorAll('[data-activity-memory-id]').length,1);
});
test('an already visible title disappears on the next actual authorization refresh',async t=>{
 const {root,d}=await fixture(t),c=client([id(1)]),opened:string[]=[];await act(async()=>root.render(React.createElement(View,{api:c.api,opened})));const focused=d.querySelector<HTMLButtonElement>('[data-activity-memory-id]')!;focused.focus();c.fail(403);
 await act(async()=>new Promise(resolve=>setTimeout(resolve,3200)));assert.equal(d.querySelector('[data-activity-memory-id]'),null);assert.equal(d.activeElement,focused,'withdrawal keeps focus on the same non-opening result row');assert.match(d.body.textContent!,/暂不可用/);assert.deepEqual(opened,[]);
});
test('automatic refresh preserves a focused result and does not cancel a slow intentional open',async t=>{
 const {root,d}=await fixture(t),c=client([id(1)]),opened:string[]=[];await act(async()=>root.render(React.createElement(View,{api:c.api,opened})));const focused=d.querySelector<HTMLButtonElement>('[data-activity-memory-id]')!;focused.focus();
 await act(async()=>new Promise(resolve=>setTimeout(resolve,3200)));assert.equal(d.activeElement,focused);assert.ok(d.querySelector('[data-activity-memory-id]'));
 const gate=c.block();await act(async()=>focused.click());await act(async()=>new Promise(resolve=>setTimeout(resolve,3200)));await act(async()=>gate.resolve({id:id(1),title:'Generated '+id(1),status:'published'}));assert.deepEqual(opened,[id(1)],'opening is not aborted by an unrelated refresh timer');
});
test('a failed activity result-page refresh moves focus to Retry and removes the old private titles',async t=>{
 const {root,d}=await fixture(t),c=client([id(1)]),opened:string[]=[];await act(async()=>root.render(React.createElement(View,{api:c.api,opened})));d.querySelector<HTMLButtonElement>('[data-activity-memory-id]')!.focus();c.failPage(503);
 await act(async()=>new Promise(resolve=>setTimeout(resolve,3200)));assert.doesNotMatch(d.body.textContent!,/Generated 00000000/);assert.equal(d.activeElement?.textContent,'重试');assert.ok(d.querySelector('[role=alert]'));assert.deepEqual(opened,[]);
});
test('a removed focused result returns focus to the results heading',async t=>{
 const {root,d}=await fixture(t),c=client([id(1),id(2)]),opened:string[]=[];await act(async()=>root.render(React.createElement(View,{api:c.api,opened})));d.querySelector<HTMLButtonElement>(`[data-activity-memory-id="${id(1)}"]`)!.focus();c.remove(id(1));
 await act(async()=>new Promise(resolve=>setTimeout(resolve,3200)));assert.equal(d.querySelector(`[data-activity-memory-id="${id(1)}"]`),null);assert.equal(d.activeElement?.textContent,'已保存成果');assert.ok(d.querySelector(`[data-activity-memory-id="${id(2)}"]`));
});
