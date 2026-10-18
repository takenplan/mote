import test from 'node:test';
import assert from 'node:assert/strict';
import React,{act} from 'react';
import {JSDOM} from 'jsdom';
import {setTimeout as delay} from 'node:timers/promises';
import {configureLocale} from '@mote/shared/i18n';
import {recordingPhaseHost,barrier} from '../../server/test/fixtures/recording-phase-host.js';
import {createApi} from '../src/api.js';
import {RecordingsSettings} from '../src/RecordingsSettings.js';

test('saving an enabled original recording form returns editable while non-abort-compliant discovery is physically held',async t=>{
 configureLocale(()=> 'zh-CN');
 const p=await recordingPhaseHost(t),{f,state}=p;state.discoveryGate=barrier();
 const dom=new JSDOM('<!doctype html><div id="root"></div>',{url:'http://localhost/',pretendToBeVisual:true}),prior=new Map<string,PropertyDescriptor|undefined>(),submissions:string[]=[];
 const login=await f.request(undefined,'/api/auth/login','POST',{username:'generated-a',password:'Generated-M13-archive-only-01',mode:'web'});assert.equal(login.statusCode,200,login.body);
 const cookie=String(login.headers['set-cookie']).split(';')[0],api=createApi({mode:'web',origin:'http://localhost',...login.json()});
 for(const [key,value]of Object.entries({window:dom.window,document:dom.window.document,localStorage:dom.window.localStorage,HTMLElement:dom.window.HTMLElement,Event:dom.window.Event,IS_REACT_ACT_ENVIRONMENT:true,fetch:async(url:string,init:RequestInit={})=>{
  const headers=new Headers(init.headers);headers.set('cookie',cookie);if(init.method==='POST')submissions.push(url);
  const response=await f.host.app.inject({url,method:init.method as any??'GET',headers:Object.fromEntries(headers),...(init.body?{payload:String(init.body)}:{})});return new Response(response.rawPayload,{status:response.statusCode,headers:response.headers as Record<string,string>});
 }})){prior.set(key,Object.getOwnPropertyDescriptor(globalThis,key));Object.defineProperty(globalThis,key,{value,configurable:true,writable:true});}
 const {createRoot}=await import('react-dom/client'),root=createRoot(dom.window.document.getElementById('root')!),d=dom.window.document;
 t.after(async()=>{state.discoveryGate?.release();api.close?.();await act(async()=>root.unmount());for(const [key,value]of prior){if(value)Object.defineProperty(globalThis,key,value);else Reflect.deleteProperty(globalThis,key);}dom.window.close();});
 const wait=async(read:()=>boolean,label:string)=>{const end=performance.now()+6000;while(!read()){assert.ok(performance.now()<end,label+' '+d.body.textContent);await act(async()=>delay(10));}};
 const button=(label:string)=>Array.from(d.querySelectorAll<HTMLButtonElement>('button')).find(value=>value.textContent===label);
 const press=async(label:string)=>act(async()=>{const value=button(label);assert.ok(value,label);assert.equal(value.matches(':disabled'),false,label);value.click();await delay(20);});
 const toggle=async()=>act(async()=>{const value=d.querySelector<HTMLInputElement>('input[type="checkbox"]');assert.ok(value);assert.equal(value.matches(':disabled'),false,'The saved form stays editable');value.click();await delay(20);});
 const render=async()=>{await act(async()=>{root.render(React.createElement(React.StrictMode,null,React.createElement(RecordingsSettings,{api,onSources:()=>{},onOpen:()=>{}})));await delay(20);});await wait(()=>!!d.querySelector('select[aria-label="连接 ID"]'),'Owned recording inventory');await act(async()=>{const select=d.querySelector<HTMLSelectElement>('select[aria-label="连接 ID"]')!;select.value='recorder';select.dispatchEvent(new dom.window.Event('change',{bubbles:true}));await delay(20);});await wait(()=>!!d.querySelector('input[type="checkbox"]'),'Connected original recording form');};
 await render();await toggle();await press('保存并开始同步');await wait(()=>state.discoveryEntered,'The actual provider discovery must be held');
 await wait(()=>!d.querySelector('fieldset')?.matches(':disabled')&&!button('重试提交'),'An acknowledged save releases the form independently of acquisition');
 assert.equal(submissions.filter(url=>url.endsWith('/sync')).length,0,'Selection starts exactly once on the server');
 await act(async()=>root.render(null));await render();await toggle();await press('保存设置');
 await wait(()=>d.body.textContent!.includes('设置已保存。'),'A second selection can be saved while the old vendor ignores abort');
 assert.equal((await p.checked(f.a.token,'/api/connectors/recorder')).selection.enabled,false);assert.equal(state.discoveryEntered,true);
 state.discoveryGate.release();await act(async()=>delay(100));assert.equal((await p.page(f.a.token)).items.length,0,'A retired discovery cannot publish into the new selection');
 assert.equal(submissions.filter(url=>url.endsWith('/sync')).length,0);
});
