import test from 'node:test';
import assert from 'node:assert/strict';
import React,{act} from 'react';
import {JSDOM} from 'jsdom';
import {randomUUID} from 'node:crypto';
import {setTimeout as delay} from 'node:timers/promises';
import {keepFixture} from '../../server/test/fixtures/keep-controls.js';
import {ApiError,apiOwnerKey,type Api} from '../src/api.js';
import {configureLocale} from '@mote/shared/i18n';

test('KEEP valid pending intent clear is local, survives remount, and next explicit submit gets a new operation',async t=>{
 configureLocale(()=> 'zh-CN');const f=await keepFixture(t),operationId=randomUUID();
 const accepted=await f.request(f.admin.token,'/api/admin/index/rebuild','POST',{operationId});assert.equal(accepted.status,200,accepted.text);
 const dom=new JSDOM('<!doctype html><div id="root"></div>',{url:'http://localhost/',pretendToBeVisual:true}),prior=new Map<string,PropertyDescriptor|undefined>(),calls:{path:string;method:string;body?:{operationId:string}}[]=[];
 for(const [key,value]of Object.entries({window:dom.window,document:dom.window.document,localStorage:dom.window.localStorage,HTMLElement:dom.window.HTMLElement,Event:dom.window.Event,IS_REACT_ACT_ENVIRONMENT:true})){prior.set(key,Object.getOwnPropertyDescriptor(globalThis,key));Object.defineProperty(globalThis,key,{value,configurable:true,writable:true});}
 const raw=async(path:string,init:RequestInit={})=>{calls.push({path,method:init.method??'GET',...(init.body?{body:JSON.parse(String(init.body))}:{})});return fetch(f.origin+path,{...init,headers:{'x-mote-protocol-version':'2','content-type':'application/json',authorization:'Bearer '+f.admin.token,...init.headers}});};
 const api={connection:{mode:'web',origin:f.origin,deploymentId:f.node.deploymentId,userId:f.admin.userId,credentialId:f.admin.credentialId,administrator:true,username:'generated-admin',csrfToken:'synthetic'},raw,request:async(path:string,init?:RequestInit)=>{const r=await raw(path,init),body=await r.json();if(!r.ok)throw new ApiError(body.error,r.status,undefined,body.error);return body;}} as Api;
 const ownKey='mote.index-rebuild.v1:'+apiOwnerKey(api),otherApi={...api,connection:{...api.connection!,userId:f.b.userId}} as Api,otherKey='mote.index-rebuild.v1:'+apiOwnerKey(otherApi),otherIntent=randomUUID();localStorage.setItem(ownKey,operationId);localStorage.setItem(otherKey,otherIntent);
 const [{IndexMaintenance},{createRoot}]=await Promise.all([import('../src/IndexMaintenance.js'),import('react-dom/client')]),root=createRoot(dom.window.document.getElementById('root')!),document=dom.window.document;
 t.after(async()=>{await act(async()=>root.unmount());for(const [key,value]of prior){if(value)Object.defineProperty(globalThis,key,value);else Reflect.deleteProperty(globalThis,key);}dom.window.close();});
 const button=(label:string)=>Array.from(document.querySelectorAll<HTMLButtonElement>('button')).find(value=>value.textContent===label),until=async(check:()=>boolean)=>{for(let n=0;n<100;n++){if(check())return;await act(async()=>delay(20));}assert.fail(document.body.textContent??'missing UI');};
 await act(async()=>root.render(React.createElement(IndexMaintenance,{key:'first',api})));await until(()=>!!button('移除本机待确认提交'));assert.ok(button('重试原操作'));
 await act(async()=>button('移除本机待确认提交')!.click());assert.equal(localStorage.getItem(ownKey),null);assert.equal(localStorage.getItem(otherKey),otherIntent);assert.deepEqual(calls.filter(call=>call.method!=='GET'),[],'clear sends neither rebuild nor cancel');
 await act(async()=>{const receipt=(await f.request(f.admin.token,'/api/admin/index')).json().job;assert.equal(receipt.id,accepted.json().id);assert.notEqual(receipt.state,'cancelled');});
 await act(async()=>root.render(React.createElement(IndexMaintenance,{key:'remount',api})));await until(()=>!!button('重建索引')&&!button('重建索引')!.disabled);assert.equal(button('重试原操作'),undefined);assert.equal(button('移除本机待确认提交'),undefined);assert.deepEqual(calls.filter(call=>call.method!=='GET'),[]);
 await act(async()=>button('重建索引')!.click());await until(()=>calls.filter(call=>call.method==='POST').length===1);const submit=calls.find(call=>call.method==='POST')!;assert.equal(submit.path,'/api/admin/index/rebuild');assert.notEqual(submit.body!.operationId,operationId);assert.equal(calls.some(call=>call.path.endsWith('/cancel')),false);
 await until(()=>!button('重试原操作'));assert.equal(localStorage.getItem(ownKey),null);assert.equal(localStorage.getItem(otherKey),otherIntent);
});
