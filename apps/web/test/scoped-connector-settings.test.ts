import test from 'node:test';
import assert from 'node:assert/strict';
import React,{act} from 'react';
import {JSDOM} from 'jsdom';
import {configureLocale} from '@mote/shared/i18n';
import type {Api} from '../src/api.js';
import {ScopedConnectorSettings} from '../src/ScopedConnectorSettings.js';

configureLocale(()=> 'zh-CN');

for(const provider of ['lark','feishu-recordings','dingtalk-recordings'] as const){
 test(provider+' new connection validates IDs in Unicode sets mode and saves user input',async t=>{
  const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost/',pretendToBeVisual:true});
  const previous=new Map<string,PropertyDescriptor|undefined>();
  for(const [key,value]of Object.entries({window:dom.window,document:dom.window.document,HTMLElement:dom.window.HTMLElement,IS_REACT_ACT_ENVIRONMENT:true})){
   previous.set(key,Object.getOwnPropertyDescriptor(globalThis,key));
   Object.defineProperty(globalThis,key,{value,configurable:true,writable:true});
  }
  const {createRoot}=await import('react-dom/client'),root=createRoot(dom.window.document.getElementById('root')!);
  t.after(async()=>{await act(async()=>root.unmount());for(const [key,value]of previous){if(value)Object.defineProperty(globalThis,key,value);else Reflect.deleteProperty(globalThis,key);}dom.window.close();});
  const writes:{path:string;body:unknown}[]=[],saved:string[]=[];
  const api={request:async(path:string,init?:RequestInit)=>{
   if(path==='/api/configuration')return {revision:7,domains:[{id:'connectorSettings',saved:{connections:[]}}]};
   assert.equal(init?.method,'PUT');writes.push({path,body:JSON.parse(String(init.body))});return {};
  }} as unknown as Api;
  await act(async()=>root.render(React.createElement(ScopedConnectorSettings,{api,provider,onSaved:id=>saved.push(id),onCancel:()=>{}})));
  const input=dom.window.document.querySelector<HTMLInputElement>('input[aria-label="连接 ID"]')!;
  const form=input.form!,save=form.querySelector<HTMLButtonElement>('button[type="submit"],button:not([type])')!;
  assert.equal(input.matches(':disabled'),false,'new connection ID is editable');
  assert.equal(save.disabled,true,'unchanged new connection cannot submit');
  // HTML patterns use v mode; the old unescaped hyphen throws here even though
  // it compiles as a server-side regex without the Unicode sets flag.
  const pattern=new RegExp('^(?:'+input.pattern+')$','v');
  const valid=['a','A0','feishu-recorder','a_b.c-9','a'.repeat(80)];
  const invalid=['','-a','_a','.a','a b','a/b','录音','a'.repeat(81)];
  const fill=async(value:string)=>act(async()=>{
   Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype,'value')!.set!.call(input,value);
   input.dispatchEvent(new dom.window.Event('input',{bubbles:true}));
  });
  for(const value of valid){assert.equal(pattern.test(value),true,value);await fill(value);assert.equal(input.checkValidity(),true,value);}
  for(const value of invalid){assert.equal(pattern.test(value),false,value);await fill(value);assert.equal(input.checkValidity(),false,value);}
  assert.equal(save.disabled,false,'input events enable the save action');
  await act(async()=>save.click());
  assert.deepEqual(writes,[],'invalid IDs are blocked by native form validation');
  await fill('generated-recorder_1.test');
  assert.equal(form.checkValidity(),true);
  await act(async()=>save.click());
  assert.deepEqual(saved,['generated-recorder_1.test']);
  assert.deepEqual(writes,[{path:'/api/connectors/generated-recorder_1.test',body:{expectedRevision:7,connection:{id:'generated-recorder_1.test',provider,autoSync:true,syncIntervalMs:300000}}}]);
 });
}
