import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import React,{act} from 'react';
import type {Api} from '../src/api';
import {RuntimeSettings} from '../src/RuntimeSettings';
import {confirmNavigation} from '../src/unsaved';
import {useHashChoice} from '../src/useHashChoice';
import {settingsCategoryFromHash} from '../src/route-query';

async function setup(t:any){
 const dom=new JSDOM('<!doctype html><div id="root"></div>',{url:'http://localhost/#/system/models',pretendToBeVisual:true});
 const backups=new Map<string,PropertyDescriptor|undefined>();
 for(const [key,value] of Object.entries({window:dom.window,document:dom.window.document,location:dom.window.location,HTMLElement:dom.window.HTMLElement,localStorage:dom.window.localStorage,IS_REACT_ACT_ENVIRONMENT:true})){
  backups.set(key,Object.getOwnPropertyDescriptor(globalThis,key));Object.defineProperty(globalThis,key,{value,configurable:true,writable:true});
 }
 dom.window.localStorage.setItem('mote.language','zh-CN');
 const {createRoot}=await import('react-dom/client'),root=createRoot(dom.window.document.getElementById('root')!);
 t.after(async()=>{await act(async()=>root.unmount());dom.window.close();for(const [key,value] of backups){if(value)Object.defineProperty(globalThis,key,value);else Reflect.deleteProperty(globalThis,key);}});
 return {dom,root};
}

test('restoring runtime fields to the saved value clears the navigation warning',async t=>{
 const {dom,root}=await setup(t),baseline={interactiveConcurrency:2,agentConcurrency:8,llmConcurrency:4,memoryConcurrency:3};
 const writes:any[]=[];const api={request:async(_path:string,init:any)=>{if(init?.method==='PUT'){writes.push(JSON.parse(init.body));return {...JSON.parse(init.body),queues:{generated:true}};}return {...baseline,queues:{generated:true}};}} as Api;
 await act(async()=>root.render(React.createElement(RuntimeSettings,{api,kind:'execution'})));
 let prompts=0;dom.window.confirm=()=>{prompts++;return false;};
 const input=dom.window.document.querySelector('input')!;
 const edit=async(value:string)=>act(async()=>{Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype,'value')!.set!.call(input,value);input.dispatchEvent(new dom.window.Event('input',{bubbles:true}));});
 await edit('3');assert.equal(confirmNavigation(),false);assert.equal(prompts,1);
 await edit('2');assert.equal(confirmNavigation(),true);assert.equal(prompts,1);
 assert.equal(dom.window.document.querySelector('button')!.disabled,true);
 await edit('3');await act(async()=>dom.window.document.querySelector('form')!.dispatchEvent(new dom.window.Event('submit',{bubbles:true,cancelable:true})));
 assert.equal(writes.length,1);assert.equal(writes[0].interactiveConcurrency,3);assert.equal(Object.hasOwn(writes[0],'queues'),false);assert.equal(confirmNavigation(),true);
});

test('same-page query choices synchronize removal and a declined navigation restores the visible category',async t=>{
 const {dom,root}=await setup(t);let lastHash=dom.window.location.hash,deny=false;
 const guard=()=>{if(deny)dom.window.history.replaceState(null,'',lastHash);else lastHash=dom.window.location.hash;};
 dom.window.addEventListener('hashchange',guard);t.after(()=>dom.window.removeEventListener('hashchange',guard));
 function Categories(){const [category,choose]=useHashChoice('category',settingsCategoryFromHash);return React.createElement('div',null,React.createElement('output',null,category??'all'),React.createElement('button',{onClick:()=>choose('providers')},'providers'));}
 await act(async()=>root.render(React.createElement(Categories)));
 await act(async()=>{dom.window.location.hash='#/system/models?category=model';dom.window.dispatchEvent(new dom.window.HashChangeEvent('hashchange'));});
 assert.equal(dom.window.document.querySelector('output')!.textContent,'model');deny=true;
 await act(async()=>{dom.window.document.querySelector('button')!.click();dom.window.dispatchEvent(new dom.window.HashChangeEvent('hashchange'));});
 assert.equal(dom.window.document.querySelector('output')!.textContent,'model');assert.match(dom.window.location.hash,/category=model/);
 deny=false;await act(async()=>{dom.window.location.hash='#/system/models';dom.window.dispatchEvent(new dom.window.HashChangeEvent('hashchange'));});
 assert.equal(dom.window.document.querySelector('output')!.textContent,'all');
});
