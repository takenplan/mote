import test from 'node:test';
import assert from 'node:assert/strict';
import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import {JSDOM} from 'jsdom';
import {configureLocale,getLocale} from '@mote/shared/i18n';
import type {FeatureCapability,FeatureInventory} from '@mote/shared';
import {CodingReceiptPanel} from '../src/CodingReceiptPanel.js';
import {resolveDiscoveryTarget} from '../src/discovery-availability.js';
import {webFeatures} from '../src/features/registry.js';
import {resources} from '../src/resource-cache.js';
import type {Api} from '../src/api.js';

const activityId='http:GET:/api/work-activity',codingId='http:GET:/api/coding/uploads';
const capability=(id:string,version='1',state:FeatureCapability['state']='active'):FeatureCapability=>({id,version,state,featureId:'generated.receipt-server',surface:'data'});
const inventory=(capabilities:FeatureCapability[]):FeatureInventory=>({schemaVersion:1,revision:1,features:[],capabilities});
const workTarget={pageId:'archive',collectionId:'work-activity',href:'#/library?view=work-activity'};

async function fixture(t:import('node:test').TestContext,capabilities:FeatureCapability[]){
  const dom=new JSDOM('<!doctype html><div id="root"></div>',{url:'http://localhost/#/library?view=work-activity',pretendToBeVisual:true});
  const previousLocale=getLocale(),previous=new Map<string,PropertyDescriptor|undefined>();
  configureLocale(()=>'zh-CN');
  for(const [key,value] of Object.entries({window:dom.window,document:dom.window.document,HTMLElement:dom.window.HTMLElement,localStorage:dom.window.localStorage,IS_REACT_ACT_ENVIRONMENT:true})){
    previous.set(key,Object.getOwnPropertyDescriptor(globalThis,key));
    Object.defineProperty(globalThis,key,{value,configurable:true,writable:true});
  }
  const root=createRoot(dom.window.document.getElementById('root')!);
  const disposals:(()=>unknown)[]=[],reads:string[]=[];
  let currentInventory=inventory(capabilities);
  const api={request:async(path:string)=>{
    reads.push(path);
    if(path==='/api/features')return structuredClone(currentInventory);
    if(path.startsWith('/api/coding/uploads'))return {items:[],nextOffset:null};
    throw new Error('Unexpected generated fixture read '+path);
  }} as Api;
  const shell=await webFeatures.install({id:'generated.receipt-shell',version:'1',components:[]},[
    {surface:'page',entry:{id:'archive',route:'library',featureId:'generated.receipt-shell',render:()=>null}},
    {surface:'collection',entry:{id:'work-activity',featureId:'generated.receipt-shell',label:'Generated work',order:1,requires:[activityId],render:()=>null}},
  ]);
  disposals.push(()=>shell.dispose());
  t.after(async()=>{
    await act(async()=>root.unmount());
    for(const dispose of disposals.reverse())await dispose();
    for(const [key,value] of previous){if(value)Object.defineProperty(globalThis,key,value);else Reflect.deleteProperty(globalThis,key);}
    configureLocale(()=>previousLocale);
    dom.window.close();
  });
  const workAvailable=()=>{
    const result=resolveDiscoveryTarget(workTarget,{pages:webFeatures.pages(),collections:webFeatures.collections(),inventory:currentInventory});
    assert.equal(result.state,'available');
    assert.equal(result.href,'#/library?view=work-activity');
  };
  const installCoding=async()=>{
    const fiber=await webFeatures.install({id:'generated.receipt-coding',version:'1',components:[]},[
      {surface:'collection',entry:{id:'coding-status',featureId:'generated.receipt-coding',label:'Generated Coding status',order:2,requires:[codingId],render:()=>null}},
    ]);
    disposals.push(()=>fiber.dispose());
    return fiber;
  };
  const mount=async()=>{await act(async()=>root.render(React.createElement(CodingReceiptPanel,{api})));};
  const updateInventory=async(next:FeatureCapability[])=>{
    currentInventory=inventory(next);
    await act(async()=>resources(api).invalidate(key=>key==='/api/features'));
  };
  return {d:dom.window.document,reads,mount,installCoding,updateInventory,workAvailable};
}

test('an absent local Coding contribution does not read Coding uploads even when the server advertises support',async t=>{
  const f=await fixture(t,[capability(activityId),capability(codingId)]);
  await f.mount();
  assert.ok(f.reads.includes('/api/features'));
  assert.equal(f.reads.some(path=>path.startsWith('/api/coding/uploads')),false);
  assert.equal(f.d.querySelector('.coding-receipt-summary'),null);
  f.workAvailable();
});

for(const [name,coding] of [
  ['missing',undefined],
  ['unavailable',capability(codingId,'1','unavailable')],
  ['version-mismatched',capability(codingId,'2')],
] as const)test('a remote Coding capability that is '+name+' leaves unrelated work available and never reads Coding uploads',async t=>{
  const f=await fixture(t,[capability(activityId),...(coding?[coding]:[])]);
  await f.installCoding();
  await f.mount();
  assert.equal(f.reads.some(path=>path.startsWith('/api/coding/uploads')),false);
  assert.equal(f.d.querySelector('.coding-receipt-summary'),null);
  f.workAvailable();
});

test('compatible Coding support renders its receipt and withdraws when remote support or its local contribution is removed',async t=>{
  const f=await fixture(t,[capability(activityId),capability(codingId)]),coding=await f.installCoding();
  await f.mount();
  assert.ok(f.d.querySelector('.coding-receipt-summary'));
  assert.match(f.d.body.textContent!,/当前页 0 个来源/);
  assert.equal(f.reads.filter(path=>path.startsWith('/api/coding/uploads')).length,1,'summary and detail share the same read resource');
  await f.updateInventory([capability(activityId)]);
  assert.equal(f.d.querySelector('.coding-receipt-summary'),null);
  assert.equal(f.reads.filter(path=>path.startsWith('/api/coding/uploads')).length,1);
  f.workAvailable();
  await f.updateInventory([capability(activityId),capability(codingId)]);
  assert.ok(f.d.querySelector('.coding-receipt-summary'));
  const readsBeforeDisposal=f.reads.filter(path=>path.startsWith('/api/coding/uploads')).length;
  await act(async()=>coding.dispose());
  assert.equal(f.d.querySelector('.coding-receipt-summary'),null);
  assert.equal(f.reads.filter(path=>path.startsWith('/api/coding/uploads')).length,readsBeforeDisposal);
  f.workAvailable();
});
