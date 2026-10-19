import test from 'node:test';
import assert from 'node:assert/strict';
import React,{act} from 'react';
import {JSDOM} from 'jsdom';
import {configureLocale} from '@mote/shared/i18n';
import {ActionReview,readActionReview,type FixedActionReview} from '../src/ActionReview.js';
import {ApiError,type Api} from '../src/api.js';
import {resources} from '../src/resource-cache.js';

configureLocale(()=> 'zh-CN');
const actionId='00000000-0000-4000-8000-000000000001',questionId='00000000-0000-4000-8000-000000000002',operationId='00000000-0000-4000-8000-000000000003',when='2026-01-01T00:00:00Z';
const path='/api/actions/'+actionId+'/reviews/'+questionId;
const generated:FixedActionReview={id:questionId,provider:{id:'actions.calendar',version:'1'},operationId:'action-review:'+actionId,workId:actionId,title:'Generated approved appointment',prompt:'Generated fixed review',evidence:[],choices:[{id:'approve',label:'Confirm',answer:'Approve fixed content'},{id:'dismiss',label:'Dismiss',answer:'Dismiss fixed content'}],state:'closed',outcome:'approved',revision:2,createdAt:when,updatedAt:when,messages:[],execution:{operationId,status:'succeeded'},reviewedAction:{id:actionId,version:1,kind:'calendar.create',event:{title:'Generated approved appointment',start:'2099-01-01T09:00:00Z',end:'2099-01-01T10:00:00Z',timeZone:'UTC',allDay:false,location:'Generated location',description:'Generated fixed description'},target:{deviceId:'same-device',calendarId:'same-calendar'},targetDetails:{deviceId:'same-device',deviceName:'Generated device A',calendar:{id:'same-calendar',title:'Generated calendar A',accountId:'generated-account-A'}},evidence:[{id:'00000000-0000-4000-8000-000000000004',quote:'Generated evidence',fingerprint:'a'.repeat(64),source:'Generated source',capturedAt:when}],fingerprint:'b'.repeat(64)}};
async function fixture(t:import('node:test').TestContext){
 const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost',pretendToBeVisual:true}),before=new Map<string,PropertyDescriptor|undefined>();
 for(const [key,value]of Object.entries({window:dom.window,document:dom.window.document,HTMLElement:dom.window.HTMLElement,IS_REACT_ACT_ENVIRONMENT:true})){before.set(key,Object.getOwnPropertyDescriptor(globalThis,key));Object.defineProperty(globalThis,key,{value,configurable:true,writable:true});}
 const {createRoot}=await import('react-dom/client'),root=createRoot(dom.window.document.getElementById('root')!);
 t.after(async()=>{await act(async()=>root.unmount());for(const [key,value]of before){if(value)Object.defineProperty(globalThis,key,value);else Reflect.deleteProperty(globalThis,key);}dom.window.close();});
 return {d:dom.window.document,render:(api:Api,key='review')=>act(async()=>root.render(React.createElement(ActionReview,{key,api,actionId,questionId,onOpen:()=>{}})))};
}

test('reload of the original approved review displays succeeded without rewriting version one or issuing writes',async t=>{
 const {d,render}=await fixture(t),calls:string[]=[];
 const api={request:async(p:string,init?:RequestInit)=>{assert.equal(init?.method,undefined);calls.push(p);return structuredClone(generated);}} as Api;
 await render(api);assert.match(d.body.textContent!,/已写入已有日历/);assert.doesNotMatch(d.body.textContent!,/等待客户端写入/);assert.match(d.body.textContent!,/版本 1/);assert.match(d.body.textContent!,/Generated fixed description/);
 await render(api,'reload');assert.match(d.body.textContent!,/已写入已有日历/);assert.ok(calls.length>=2);assert.ok(calls.every(p=>p===path),'reads do not depend on the paginated Actions list');
});

test('approved, executing and uncertain keep observing the same operation; success stops polling and revoked reads clear it',async t=>{
 const {d,render}=await fixture(t);let current=structuredClone(generated),failure:unknown;current.execution!.status='approved';
 const api={request:async()=>{if(failure)throw failure;return structuredClone(current);}} as Api,resource=resources(api).get(path),poll=resource.poll;let pollers=0;
 t.mock.method(resource,'poll',(interval:number)=>{assert.equal(interval,3000);pollers++;const stop=poll(interval);return()=>{pollers--;stop();};});
 await render(api);assert.match(d.body.textContent!,/等待客户端写入/);assert.equal(pollers,1);
 for(const [status,label]of [['executing','正在写入 / 等待回执'],['uncertain','保存结果待核实'],['succeeded','已写入已有日历']]as const){current.execution!.status=status;await act(async()=>resource.invalidate());assert.ok(d.body.textContent!.includes(label));assert.equal(pollers,status==='succeeded'?0:1);assert.match(d.body.textContent!,/版本 1/);assert.deepEqual(current.reviewedAction,generated.reviewedAction);}
 failure=new ApiError('Generated revoked review',409);await act(async()=>resource.invalidate());assert.ok(d.querySelector('[role="alert"]'));assert.doesNotMatch(d.body.textContent!,/已写入已有日历/);
});

test('same review IDs on a replacement Api retire accepted state and late old execution reads',async t=>{
 const {d,render}=await fixture(t),open={...structuredClone(generated),state:'open' as const,revision:1};delete open.execution;delete open.outcome;
 let hold=false,release!:(value:unknown)=>void,writes=0;const held=new Promise(resolve=>release=resolve);
 const a={request:async(_p:string,init?:RequestInit)=>{if(init?.method==='POST'){writes++;hold=true;const {reviewedAction,execution,...question}=generated;return question;}return hold?held:structuredClone(open);}} as Api;
 await render(a);const oldApprove=Array.from(d.querySelectorAll('button')).find(b=>b.textContent==='确认添加到此日历')!;assert.ok(oldApprove);await act(async()=>oldApprove.click());
 const replacement=structuredClone(open);replacement.reviewedAction.targetDetails!.calendar.accountId='generated-account-B';
 const b={request:async(_p:string,init?:RequestInit)=>{assert.equal(init?.method,undefined);return replacement;}} as Api;
 await render(b);assert.match(d.body.textContent!,/generated-account-B/);assert.ok(Array.from(d.querySelectorAll('button')).some(button=>button.textContent==='确认添加到此日历'),'A accepted state cannot close B review');
 await act(async()=>{release(structuredClone(generated));oldApprove.click();});assert.equal(writes,1);assert.match(d.body.textContent!,/generated-account-B/);assert.doesNotMatch(d.body.textContent!,/已写入已有日历|generated-account-A/);
});

test('execution facts are accepted only for the closed approved question',()=>{
 const missing=structuredClone(generated);delete missing.execution;assert.throws(()=>readActionReview(missing,actionId,questionId));
 assert.throws(()=>readActionReview({...generated,state:'open'},actionId,questionId));assert.throws(()=>readActionReview({...generated,execution:{operationId:'other-operation',status:'succeeded'}},actionId,questionId));
});
