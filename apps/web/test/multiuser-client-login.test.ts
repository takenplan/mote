import test,{type TestContext} from 'node:test';
import assert from 'node:assert/strict';
import React,{act} from 'react';
import {JSDOM} from 'jsdom';
import {setTimeout as delay} from 'node:timers/promises';
import {randomBytes,createHash} from 'node:crypto';
import {configureLocale} from '@mote/shared/i18n';
import {scopedCaptureFixture} from '../../server/test/fixtures/scoped-capture-host.js';
import {createApi,type Api} from '../src/api.js';
import {ClientLoginApproval} from '../src/ClientLoginApproval.js';
configureLocale(()=> 'zh-CN');

async function harness(t:TestContext){
 const f=await scopedCaptureFixture(t),dom=new JSDOM('<!doctype html><div id="root"></div>',{url:'http://localhost',pretendToBeVisual:true});
 const login=await f.request(undefined,'/api/auth/login','POST',{username:'generated-a',password:'Generated-M13-archive-only-01',mode:'web'});assert.equal(login.statusCode,200,login.body);
 const cookie=String(login.headers['set-cookie']).split(';')[0],before=new Map<string,PropertyDescriptor|undefined>();let hold:string|undefined,release:(()=>void)|undefined;
 const posts:string[]=[];let current:Api|undefined;
 for(const [key,value]of Object.entries({window:dom.window,document:dom.window.document,HTMLElement:dom.window.HTMLElement,IS_REACT_ACT_ENVIRONMENT:true,fetch:async(path:string,init:RequestInit={})=>{
  const headers=new Headers(init.headers);headers.set('cookie',cookie);const response=await f.host.app.inject({url:path,method:init.method as any??'GET',headers:Object.fromEntries(headers),...(init.body?{payload:String(init.body)}:{})});
  if(init.method==='POST')posts.push(path);
  if(path===hold)await new Promise<void>(resolve=>release=resolve);
  return new Response(response.rawPayload,{status:response.statusCode,headers:response.headers as Record<string,string>});
 }})){before.set(key,Object.getOwnPropertyDescriptor(globalThis,key));Object.defineProperty(globalThis,key,{value,configurable:true,writable:true});}
 const {createRoot}=await import('react-dom/client'),root=createRoot(dom.window.document.getElementById('root')!);
 const api=createApi({mode:'web',origin:'http://localhost',...login.json()},undefined,()=>current===api);current=api;
 t.after(async()=>{release?.();api.close?.();await act(async()=>root.unmount());for(const[key,value]of before){if(value)Object.defineProperty(globalThis,key,value);else Reflect.deleteProperty(globalThis,key);}dom.window.close();});
 const request=async(name:string,purpose?:'central')=>{const verifier=randomBytes(32).toString('base64url'),result=await f.request(undefined,'/api/login/requests','POST',{serverUrl:'https://fixture.invalid',deviceId:'same-device',deviceName:name,platform:'android',challenge:createHash('sha256').update(verifier).digest('hex'),...(purpose?{purpose}:{})});assert.equal(result.statusCode,200,result.body);return result.json().id as string;};
 const render=(id:string)=>act(async()=>{root.render(React.createElement(ClientLoginApproval,{id,api,done:()=>{}}));await delay(15);});
 const wait=async(predicate:()=>boolean)=>{for(let i=0;i<100&&!predicate();i++)await act(async()=>delay(10));assert.ok(predicate(),dom.window.document.body.textContent??'');};
 const button=()=>dom.window.document.querySelector<HTMLButtonElement>('button')!;
 return {request,render,wait,button,document:dom.window.document,posts,hold:(id:string)=>{hold='/api/login/requests/'+id;},release:()=>release?.()};
}

test('browser approval distinguishes device collection from explicit native central access',async t=>{
 const h=await harness(t);await h.render(await h.request('Generated collector'));await h.wait(()=>!h.button().disabled);
 assert.doesNotMatch(h.document.body.textContent!,/所有中央功能/,'device approval must not promise private archive access');
 await h.render(await h.request('Generated central','central'));await h.wait(()=>!h.button().disabled);assert.match(h.document.body.textContent!,/所有中央功能/);
});

test('browser approval retires the old request before the next device details resolve',async t=>{
 const h=await harness(t);await h.render(await h.request('Generated first'));await h.wait(()=>!h.button().disabled);const old=h.button();
 const next=await h.request('Generated next');h.hold(next);await h.render(next);
 assert.equal(h.button().disabled,true,'new request cannot reuse the previous device description');
 await act(async()=>{old.click();await delay(10);});assert.deepEqual(h.posts,[],'a retired approval button cannot admit its old request');
 h.release();await h.wait(()=>!h.button().disabled);assert.match(h.document.body.textContent!,/Generated next/);
});
