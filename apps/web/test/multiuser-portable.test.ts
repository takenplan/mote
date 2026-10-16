import test from 'node:test';
import assert from 'node:assert/strict';
import React,{act,Suspense} from 'react';
import {JSDOM} from 'jsdom';
import {mkdtempSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {setTimeout as delay} from 'node:timers/promises';
import {configureLocale} from '@mote/shared/i18n';
import {buildApp} from '../../server/src/app.js';
import {createApi,type Api} from '../src/api.js';
import '../src/features/runtime.js';
import {pages} from '../src/features/storage.js';
import type {PageProps} from '../src/features/types.js';
configureLocale(()=> 'zh-CN');

test('original storage page uses actual owner portable receipts without global status and retires a held A download on B switch',async t=>{
 const directory=mkdtempSync(join(tmpdir(),'mote-m13-portable-')),node=await buildApp({dataDir:directory}),password='Generated-M13-portable-only-01';
 t.after(async()=>{await node.app.close();rmSync(directory,{recursive:true,force:true});});await node.accounts!.initialize('generated-admin',password);
 const request=(token:string|undefined,url:string,method:any='GET',body?:unknown)=>node.app.inject({url,method,headers:{'x-mote-protocol-version':'2',...(token?{authorization:'Bearer '+token}:{})},...(body===undefined?{}:{payload:body})});
 const admin=(await request(undefined,'/api/auth/login','POST',{username:'generated-admin',password,mode:'client'})).json();
 for(const username of ['generated-a','generated-b'])assert.equal((await request(admin.token,'/api/admin/accounts','POST',{username,password})).statusCode,200);
 const dom=new JSDOM('<!doctype html><div id="root"></div>',{url:'http://localhost/#/system/storage',pretendToBeVisual:true}),before=new Map<string,PropertyDescriptor|undefined>(),downloads:Blob[]=[],requests:{session:string;path:string;method:string}[]=[];
 let cookie='',current:Api|undefined,held=false,release!:()=>void,entered!:()=>void;const hold=new Promise<void>(r=>release=r),arrived=new Promise<void>(r=>entered=r);
 for(const [key,value]of Object.entries({window:dom.window,document:dom.window.document,HTMLElement:dom.window.HTMLElement,IS_REACT_ACT_ENVIRONMENT:true,fetch:async(path:string,init:RequestInit={})=>{const headers=new Headers(init.headers);headers.set('cookie',cookie);requests.push({session:headers.get('x-mote-session-id')??'',path,method:init.method??'GET'});const r=await node.app.inject({url:path,method:init.method as any??'GET',headers:Object.fromEntries(headers),...(init.body?{payload:String(init.body)}:{})});if(held&&path.endsWith('/content')){entered();await hold;}return new Response(r.rawPayload,{status:r.statusCode,headers:r.headers as Record<string,string>});}})){before.set(key,Object.getOwnPropertyDescriptor(globalThis,key));Object.defineProperty(globalThis,key,{value,configurable:true,writable:true});}
 const createURL=URL.createObjectURL,revokeURL=URL.revokeObjectURL,click=dom.window.HTMLAnchorElement.prototype.click;URL.createObjectURL=blob=>{downloads.push(blob as Blob);return 'blob:generated';};URL.revokeObjectURL=()=>{};dom.window.HTMLAnchorElement.prototype.click=()=>{};
 const {createRoot}=await import('react-dom/client'),root=createRoot(dom.window.document.getElementById('root')!),d=dom.window.document;
 t.after(async()=>{release();current?.close?.();await act(async()=>root.unmount());URL.createObjectURL=createURL;URL.revokeObjectURL=revokeURL;dom.window.HTMLAnchorElement.prototype.click=click;for(const [key,value]of before){if(value)Object.defineProperty(globalThis,key,value);else Reflect.deleteProperty(globalThis,key);}dom.window.close();});
 const login=async(username:string)=>{const r=await request(undefined,'/api/auth/login','POST',{username,password,mode:'web'});assert.equal(r.statusCode,200,r.body);cookie=String(r.headers['set-cookie']).split(';')[0];const identity=r.json(),api=createApi({mode:'web',origin:'http://localhost',...identity},undefined,()=>current===api);current?.close?.();current=api;return api;};
 const render=async(api:Api)=>act(async()=>{root.render(React.createElement(Suspense,{fallback:'loading'},pages[0].render({api,status:null,refresh:()=>{},disconnect:()=>{}} as unknown as PageProps)));await delay(30);});
 const button=(label:string)=>Array.from(d.querySelectorAll<HTMLButtonElement>('button')).find(b=>b.textContent===label),press=async(label:string)=>act(async()=>{const b=button(label);assert.ok(b,label+' '+d.body.textContent);b.click();await delay(30);});
 const a=await login('generated-a');await render(a);for(let n=0;n<50&&!button('导出');n++)await act(async()=>delay(10));assert.ok(button('导出'),'original storage route remains usable without retired global status');
 await press('导出');for(let n=0;n<100&&!button('下载归档');n++)await act(async()=>delay(20));assert.ok(button('下载归档'),d.body.textContent!);assert.ok(requests.some(r=>r.path==='/api/portable/exports'&&r.method==='POST'));
 await press('下载归档');assert.equal(downloads.length,1);const archive=JSON.parse(await downloads[0].text());assert.equal(archive.version,3);assert.equal(archive.userId,a.connection!.userId);assert.equal(archive.coverage.credentials,false);
 held=true;const pending=press('下载归档');await arrived;const b=await login('generated-b');await render(b);release();await pending;assert.equal(downloads.length,1,'held A bytes cannot create a B-session download');assert.doesNotMatch(d.body.textContent!,new RegExp(a.connection!.userId));assert.ok(!button('下载归档'),'B does not inherit A receipt');
 await press('导出');for(let n=0;n<100&&!button('下载归档');n++)await act(async()=>delay(20));assert.ok(button('下载归档'));await press('下载归档');assert.equal(downloads.length,2);assert.equal(JSON.parse(await downloads[1].text()).userId,b.connection!.userId);
 const mutations=requests.filter(r=>r.method==='POST'&&r.path==='/api/portable/exports');assert.deepEqual(mutations.map(r=>r.session),[a.connection!.credentialId,b.connection!.credentialId]);
});
