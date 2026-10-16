import test from 'node:test';
import assert from 'node:assert/strict';
import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import {JSDOM} from 'jsdom';
import {mkdtempSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {setTimeout as delay} from 'node:timers/promises';
import {randomUUID} from 'node:crypto';
import {configureLocale} from '@mote/shared/i18n';
import {buildApp} from '../../server/src/app.js';
import {generatedScopedPluginRelease} from '../../server/test/fixtures/scoped-plugin-release.js';
import {PluginCenter} from '../src/PluginCenter.js';
import type {Api} from '../src/api.js';
configureLocale(()=> 'zh-CN');

test('original plugin page consumes actual M09 owned instances, preserves hidden refs and retires an open same-ID editor on switch',async t=>{
 const directory=mkdtempSync(join(tmpdir(),'mote-m13-plugin-page-')),release=generatedScopedPluginRelease(),node=await buildApp({dataDir:directory},{pluginReleaseTransport:release.transport});
 t.after(async()=>{await node.app.close();rmSync(directory,{recursive:true,force:true});});
 const request=(token:string|undefined,url:string,method:any='GET',payload?:unknown)=>node.app.inject({url,method,headers:{'x-mote-protocol-version':'2','x-mote-ingress-version':'3',...(token?{authorization:'Bearer '+token}:{})},...(payload===undefined?{}:{payload})});
 const password='Generated-M13-plugin-page-01';await node.accounts!.initialize('generated-admin',password);
 const login=async(username:string)=>{const r=await request(undefined,'/api/auth/login','POST',{username,password,mode:'client',durationMs:86400000});assert.equal(r.statusCode,200,r.body);return r.json();};
 const admin=await login('generated-admin');for(const username of ['generated-a','generated-b'])assert.equal((await request(admin.token,'/api/admin/accounts','POST',{username,password,administrator:false})).statusCode,200);
 const a=await login('generated-a'),b=await login('generated-b'),preview=await request(admin.token,'/api/plugins/resolve','POST',{repository:release.repository,tag:release.tag}),catalog=await request(admin.token,'/api/admin/plugins');assert.equal(preview.statusCode,200);
 assert.equal((await request(admin.token,'/api/plugins/install','POST',{previewId:preview.json().id,expectedRevision:catalog.json().revision,operationId:randomUUID()})).statusCode,200);
 const end=Date.now()+10000;while(node.plugins!.catalog.view().packages[0]?.state==='installing'){assert.ok(Date.now()<end);await delay(5);}
 const packageId=node.plugins!.catalog.view().packages[0].id;
 for(const [account,label]of [[a,'A_PRIVATE'],[b,'B_PRIVATE']] as const){const v=await request(account.token,'/api/plugins');assert.equal((await request(account.token,'/api/plugin-instances','POST',{expectedRevision:v.json().revision,instance:{id:'same-instance',packageId,name:label,configuration:{label,credential:'personal:'+label},desired:false,grants:{capabilities:['processor'],sourceIds:[],history:false}}})).statusCode,200);}
 const dom=new JSDOM('<!doctype html><div id="root"></div>',{url:'http://localhost/#/system/plugins',pretendToBeVisual:true}),before=new Map<string,PropertyDescriptor|undefined>();
 for(const [key,value]of Object.entries({window:dom.window,document:dom.window.document,HTMLElement:dom.window.HTMLElement,IS_REACT_ACT_ENVIRONMENT:true})){before.set(key,Object.getOwnPropertyDescriptor(globalThis,key));Object.defineProperty(globalThis,key,{value,configurable:true,writable:true});}
 const root=createRoot(dom.window.document.getElementById('root')!),calls:{owner:string;path:string;body:any}[]=[];
 t.after(async()=>{await act(async()=>root.unmount());for(const [key,value]of before){if(value)Object.defineProperty(globalThis,key,value);else Reflect.deleteProperty(globalThis,key);}dom.window.close();});
 const api=(account:any,owner:string):Api=>({connection:{mode:'web',origin:'http://localhost',deploymentId:'generated',userId:owner,credentialId:owner,csrfToken:'generated',username:owner,administrator:false},request:async(path,init)=>{const payload=init?.body?JSON.parse(String(init.body)):undefined;if(init?.method)calls.push({owner,path,body:payload});const r=await request(account.token,path,init?.method,payload);if(r.statusCode!==200)throw Error(r.statusCode+' '+r.body);return r.json();}} as Api);
 const d=dom.window.document,render=(value:Api)=>act(async()=>{root.render(React.createElement(PluginCenter,{api:value,onPage:()=>{}}));await delay(20);}),click=async(label:string)=>act(async()=>{const button=Array.from(d.querySelectorAll('button')).find(v=>v.textContent===label);assert.ok(button,label);button.click();await delay(20);});
 await render(api(a,'A'));assert.match(d.body.textContent!,/A_PRIVATE/);assert.doesNotMatch(d.body.textContent!,/B_PRIVATE|personal:A_PRIVATE/);
 await click('配置');assert.ok(d.querySelector('[role=dialog]'));await click('保存配置');
 assert.equal(calls.length,1);assert.equal(calls[0].path,'/api/plugin-instances');assert.equal(calls[0].body.preserveRedactedSecrets,true);assert.deepEqual(calls[0].body.instance.grants,{capabilities:['processor'],sourceIds:[],history:false});assert.equal(calls[0].body.instance.configuration.credential,undefined);
 await click('配置');await render(api(b,'B'));assert.equal(d.querySelector('[role=dialog]'),null);assert.match(d.body.textContent!,/B_PRIVATE/);assert.doesNotMatch(d.body.textContent!,/A_PRIVATE/);assert.equal(calls.length,1);
});
