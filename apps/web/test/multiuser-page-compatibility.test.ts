import test from 'node:test';
import assert from 'node:assert/strict';
import React,{Suspense} from 'react';
import {renderToPipeableStream} from 'react-dom/server';
import {PassThrough} from 'node:stream';
import {JSDOM} from 'jsdom';
import {configureLocale,getLocale} from '@mote/shared/i18n';
import '../src/features/runtime.js';
import {pages} from '../src/features/ask.js';
import {createApi,type WebConnection} from '../src/api.js';
import type {PageProps} from '../src/features/types.js';
const connection:WebConnection={mode:'web',origin:'https://fixture.invalid',deploymentId:'generated-deployment',userId:'a',credentialId:'generated-session',csrfToken:'generated-csrf',username:'generated-a',administrator:false};
test('existing Ask page renders for a scoped Web session without retired global status',async t=>{
 const locale=getLocale();configureLocale(()=> 'zh-CN');t.after(()=>configureLocale(()=>locale));
 const dom=new JSDOM('<!doctype html><body></body>',{url:'https://fixture.invalid/#/ask'}),previous=Object.getOwnPropertyDescriptor(globalThis,'window');Object.defineProperty(globalThis,'window',{value:dom.window,configurable:true});t.after(()=>{dom.window.close();if(previous)Object.defineProperty(globalThis,'window',previous);else Reflect.deleteProperty(globalThis,'window');});
 const props={api:createApi(connection),status:null,devices:[],insights:[],onPage:()=>{},onOpen:()=>{}} as unknown as PageProps;
 const html=await new Promise<string>((resolve,reject)=>{const output=new PassThrough();let text='';output.on('data',value=>text+=String(value));output.on('end',()=>resolve(text));const stream=renderToPipeableStream(React.createElement(Suspense,{fallback:'loading'},pages[0].render(props)),{onAllReady:()=>stream.pipe(output),onError:reject});});
 assert.match(html,/你只管问/);assert.match(html,/打开模型设置/);
});

test('Web insight composer retains per-request owned model selection after the M04 lease seam',async t=>{
 const {renderToStaticMarkup}=await import('react-dom/server'),{Insights}=await import('../src/Insights.js'),locale=getLocale();configureLocale(()=> 'zh-CN');t.after(()=>configureLocale(()=>locale));
 const html=renderToStaticMarkup(React.createElement(Insights,{api:createApi(connection),range:{},configured:true,onOpen:()=>{},onSettings:()=>{},onChanged:()=>{}}));
 assert.match(html,/生成个人回顾/);assert.match(html,/本次模型/);
});

test('Web conversation composer retains its original per-request preset and temporary model controls',async t=>{
 const {renderToStaticMarkup}=await import('react-dom/server'),{Conversations}=await import('../src/Conversations.js'),locale=getLocale();configureLocale(()=> 'zh-CN');t.after(()=>configureLocale(()=>locale));
 const dom=new JSDOM('<!doctype html><body></body>',{url:'https://fixture.invalid/#/ask'}),previous=Object.getOwnPropertyDescriptor(globalThis,'window');Object.defineProperty(globalThis,'window',{value:dom.window,configurable:true});t.after(()=>{dom.window.close();if(previous)Object.defineProperty(globalThis,'window',previous);else Reflect.deleteProperty(globalThis,'window');});
 const html=renderToStaticMarkup(React.createElement(Conversations,{api:createApi(connection),configured:true,devices:[],renderAnswer:()=>null}));
 assert.match(html,/本次模型/);assert.match(html,/临时模型 ID/);
});
