import test from 'node:test';
import assert from 'node:assert/strict';
import React,{act,Suspense} from 'react';
import {JSDOM} from 'jsdom';
import {mkdtempSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {setTimeout as delay} from 'node:timers/promises';
import {generateKeyPairSync,sign} from 'node:crypto';
import {checkRelease,type ReleaseManifest} from '@mote/shared/release';
import {configureLocale} from '@mote/shared/i18n';
import {buildApp} from '../../server/src/app.js';
import {createApi,type Api} from '../src/api.js';
import '../src/features/runtime.js';
import {pages} from '../src/features/diagnostics.js';
import type {PageProps} from '../src/features/types.js';
configureLocale(()=> 'zh-CN');

test('original diagnostics page consumes actual instance-safe metadata and verified read-only release checks under its administrator',async t=>{
 const directory=mkdtempSync(join(tmpdir(),'mote-m13-management-')),password='Generated-M13-management-only-01',keys=generateKeyPairSync('rsa',{modulusLength:2048}),publicKey=keys.publicKey.export({format:'pem',type:'spki'}).toString();
 const manifest:ReleaseManifest={schemaVersion:1,component:'central',version:'0.5.0',tag:'central-v0.5.0',channel:'stable',publishedAt:new Date().toISOString(),repository:'utopiafar/mote',notesUrl:'https://github.com/utopiafar/mote/releases/tag/central-v0.5.0',assets:[{component:'server',platform:'source',arch:'all',format:'tar.gz',name:'mote-server-0.5.0.tar.gz',url:'https://github.com/utopiafar/mote/releases/download/central-v0.5.0/mote-server-0.5.0.tar.gz',size:1,sha256:'a'.repeat(64)}],images:[]};
 const payload=Buffer.from(JSON.stringify(manifest)),envelope=JSON.stringify({schemaVersion:1,keyId:'generated',payload:payload.toString('base64'),signature:sign('RSA-SHA256',payload,keys.privateKey).toString('base64')});let checks=0;
 const node=await buildApp({dataDir:directory},{updateDependencies:{checkRelease:async options=>{checks++;return checkRelease({...options,publicKey,keyId:'generated',fetch:async url=>String(url).includes('api.github.com')?Response.json([{tag_name:manifest.tag,draft:false,prerelease:false}]):new Response(envelope)});}}});t.after(async()=>{await node.app.close();rmSync(directory,{recursive:true,force:true});});await node.accounts!.initialize('generated-admin',password);
 const request=(token:string|undefined,url:string,method:any='GET',body?:unknown)=>node.app.inject({url,method,headers:{'x-mote-protocol-version':'2',...(token?{authorization:'Bearer '+token}:{})},...(body===undefined?{}:{payload:body})}),admin=(await request(undefined,'/api/auth/login','POST',{username:'generated-admin',password,mode:'client'})).json();assert.equal((await request(admin.token,'/api/admin/accounts','POST',{username:'generated-b',password})).statusCode,200);
 const dom=new JSDOM('<!doctype html><div id="root"></div>',{url:'http://localhost/#/system/diagnostics',pretendToBeVisual:true}),before=new Map<string,PropertyDescriptor|undefined>(),calls:{path:string;method:string;session:string}[]=[];let cookie='',current:Api|undefined;
 for(const [key,value]of Object.entries({window:dom.window,document:dom.window.document,HTMLElement:dom.window.HTMLElement,IS_REACT_ACT_ENVIRONMENT:true,__MOTE_WEB_VERSION__:'0.0.90',fetch:async(path:string,init:RequestInit={})=>{const headers=new Headers(init.headers);headers.set('cookie',cookie);calls.push({path,method:init.method??'GET',session:headers.get('x-mote-session-id')??''});const r=await node.app.inject({url:path,method:init.method as any??'GET',headers:Object.fromEntries(headers),...(init.body?{payload:String(init.body)}:{})});return new Response(r.rawPayload,{status:r.statusCode,headers:r.headers as Record<string,string>});}})){before.set(key,Object.getOwnPropertyDescriptor(globalThis,key));Object.defineProperty(globalThis,key,{value,configurable:true,writable:true});}
 const {createRoot}=await import('react-dom/client'),root=createRoot(dom.window.document.getElementById('root')!),d=dom.window.document;t.after(async()=>{current?.close?.();await act(async()=>root.unmount());for(const [key,value]of before){if(value)Object.defineProperty(globalThis,key,value);else Reflect.deleteProperty(globalThis,key);}dom.window.close();});
 const login=async(username:string)=>{const r=await request(undefined,'/api/auth/login','POST',{username,password,mode:'web'});assert.equal(r.statusCode,200,r.body);cookie=String(r.headers['set-cookie']).split(';')[0];const api=createApi({mode:'web',origin:'http://localhost',...r.json()},undefined,()=>current===api);current?.close?.();current=api;return api;},render=async(api:Api)=>act(async()=>{root.render(React.createElement(Suspense,{fallback:'loading'},pages[0].render({api,status:null} as unknown as PageProps)));await delay(30);});
 const a=await login('generated-admin');await render(a);for(let n=0;n<60&&!d.querySelector('.diagnostics-panel');n++)await act(async()=>delay(10));assert.ok(d.querySelector('.diagnostics-panel'),'original diagnostics route remains available without global status: '+d.body.textContent);
 for(let n=0;n<60&&!d.querySelector('.diagnostics-metrics');n++)await act(async()=>delay(10));assert.ok(d.querySelector('.diagnostics-metrics'),'actual instance snapshot does not require fabricated private queue fields: '+d.body.textContent);assert.doesNotMatch(d.querySelector('.diagnostics-metrics')!.textContent!,/端点上次上报待同步|索引待处理|进行中的 AI 查询/);
 const check=Array.from(d.querySelectorAll<HTMLButtonElement>('button')).find(b=>b.textContent==='检查更新');assert.ok(check);await act(async()=>{check.click();await delay(30);});for(let n=0;n<40&&!d.querySelector('.software-update')?.textContent?.includes('0.5.0');n++)await act(async()=>delay(10));assert.match(d.querySelector('.software-update')!.textContent!,/0\.5\.0/);assert.equal(checks,1);assert.deepEqual(calls.filter(r=>r.method==='POST').map(r=>[r.path,r.session]),[['/api/software-update/check',a.connection!.credentialId]]);
 const b=await login('generated-b'),beforeOrdinary=calls.length;await render(b);assert.match(d.body.textContent!,/管理员/);assert.equal(d.querySelector('.diagnostics-panel'),null);assert.equal(calls.length,beforeOrdinary,'ordinary page does not fetch administrator diagnostics or personal configuration as a fallback');
});
