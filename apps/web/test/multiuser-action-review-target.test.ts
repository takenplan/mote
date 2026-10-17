import test from 'node:test';
import assert from 'node:assert/strict';
import React,{act} from 'react';
import {JSDOM} from 'jsdom';
import {setTimeout as delay} from 'node:timers/promises';
import {configureLocale} from '@mote/shared/i18n';
import {modelFixture,event} from '../../server/test/fixtures/scoped-actions.js';
import {source,password,waitForState} from '../../server/test/fixtures/scoped-query-accounts.js';
import {writeMessagesResponse} from '../../../scripts/fixtures/messages-provider.js';
import {createApi} from '../src/api.js';
import {OwnerQuestionConversation} from '../src/OwnerQuestions.js';
configureLocale(()=> 'zh-CN');

for(const kind of ['calendar.update','calendar.cancel','calendar.complete']as const)test('the original question entry binds the actual '+kind+' review to its required native target',async t=>{
 console.info('generated review phase',kind,'fixture');const f=await modelFixture(t),target={deviceId:'same-device',calendarId:'same-calendar'};
 await f.ingest(f.a,'A');await f.enable(f.a);await f.ok(f.a.token,'/api/actions/targets','POST',{deviceId:'same-device',deviceName:'Generated native device A',calendars:[{id:'same-calendar',title:'Generated native calendar A',accountId:'generated-native-account-A'}]});
 console.info('generated review phase',kind,'proposal');const proposal=(await f.proposal(f.a)).items[0],original=await f.ok(f.a.token,'/api/actions/'+proposal.id+'/confirm','POST',{version:proposal.version,event:proposal.event,target});
 await f.ok(f.a.token,'/api/actions/'+original.id+'/claim','POST',{deviceId:'same-device'});await f.ok(f.a.token,'/api/actions/'+original.id+'/receipt','POST',{deviceId:'same-device',operationId:original.operationId,status:'succeeded',externalId:'generated-native-event'});
 console.info('generated review phase',kind,'native-receipt');f.scripts.set('A',(body,_raw,res)=>{const envelope=JSON.parse(typeof body.messages[0].content==='string'?body.messages[0].content:body.messages[0].content[0].text),id=envelope.untrustedEvidence[0].id,uses=body.messages.flatMap((message:any)=>Array.isArray(message.content)?message.content.filter((part:any)=>part.type==='tool_use'):[]),stage=uses.length+1;
  if(!uses.some((use:any)=>use.name==='action_catalog'))return writeMessagesResponse(res,{stage,tool:{name:'action_catalog',args:{id:original.id,limit:1}}});
  if(!uses.some((use:any)=>use.name==='evidence'))return writeMessagesResponse(res,{stage,tool:{name:'evidence',args:{ids:[id]}}});
  writeMessagesResponse(res,{stage,text:JSON.stringify({answer:JSON.stringify({actions:[{kind,event:{...event,title:'Generated changed appointment',start:'2099-02-02T09:00:00Z',end:'2099-02-02T10:00:00Z'},uncertainty:'Generated change',sameAs:original.id,evidence:[{id,quote:'GENERATED_A_PRIVATE_APPOINTMENT'}]}]}),citationIds:[id]})});
 });
 await f.ok(f.a.token,'/api/ingress/sources','POST',source('change-source'));await f.ingest(f.a,'A','same-item','change-source');await f.ok(f.a.token,'/api/actions/retry','POST',{});
 console.info('generated review phase',kind,'change-wait');const page=await waitForState(()=>f.ok(f.a.token,'/api/actions'),value=>value.items.some((value:any)=>value.kind===kind),'actual model related change'),change=page.items.find((value:any)=>value.kind===kind);assert.equal(change.related.externalId,'generated-native-event');
 console.info('generated review phase',kind,'change-ready');const question=await f.ok(f.a.token,'/api/actions/'+change.id+'/review','POST',{version:change.version,event:change.event,target});assert.deepEqual(question.reviewedAction.target,target);assert.equal(question.reviewedAction.targetDetails.calendar.accountId,'generated-native-account-A');
 const login=await f.request(undefined,'/api/auth/login','POST',{username:'generated-a',password,mode:'web'});assert.equal(login.statusCode,200,login.body);const cookie=String(login.headers['set-cookie']).split(';')[0];
 const dom=new JSDOM('<!doctype html><div id="root"></div>',{url:'http://localhost/#/owner-questions/'+question.id,pretendToBeVisual:true}),before=new Map<string,PropertyDescriptor|undefined>();let omitTarget=true,reviewReads=0;
 for(const [key,value]of Object.entries({window:dom.window,document:dom.window.document,HTMLElement:dom.window.HTMLElement,Event:dom.window.Event,IS_REACT_ACT_ENVIRONMENT:true,fetch:async(path:string,init:RequestInit={})=>{const headers=new Headers(init.headers);headers.set('cookie',cookie);const r=await f.node.app.inject({url:path,method:init.method as any??'GET',headers:Object.fromEntries(headers),...(init.body?{payload:String(init.body)}:{})});if(path.includes('/reviews/')&&r.statusCode===200){reviewReads++;const value=r.json();if(omitTarget){delete value.reviewedAction.target;delete value.reviewedAction.targetDetails;}return new Response(JSON.stringify(value),{status:200,headers:r.headers as Record<string,string>});}return new Response(r.rawPayload,{status:r.statusCode,headers:r.headers as Record<string,string>});}})){before.set(key,Object.getOwnPropertyDescriptor(globalThis,key));Object.defineProperty(globalThis,key,{value,configurable:true,writable:true});}
 const api=createApi({mode:'web',origin:'http://localhost',...login.json()}),{createRoot}=await import('react-dom/client'),root=createRoot(dom.window.document.getElementById('root')!),d=dom.window.document;
 t.after(async()=>{api.close?.();await act(async()=>root.unmount());for(const [key,value]of before){if(value)Object.defineProperty(globalThis,key,value);else Reflect.deleteProperty(globalThis,key);}dom.window.close();});
 console.info('generated review phase',kind,'renderer');await act(async()=>{root.render(React.createElement(React.StrictMode,null,React.createElement(OwnerQuestionConversation,{api,id:question.id,onOpen:()=>{}})));await delay(30);});
 const wait=async(ready:()=>boolean,label:string)=>{for(let n=0;n<200&&!ready();n++)await act(async()=>delay(10));assert.ok(ready(),label+' '+d.body.textContent);};
 await wait(()=>reviewReads>0&&!d.body.textContent?.includes('正在读取…'),'actual review response consumed');
 const approve=()=>Array.from(d.querySelectorAll('button')).find(button=>button.textContent==='确认变更');
 if(kind==='calendar.complete'){assert.ok(approve(),'Mote-only completion does not acquire a native mutation requirement');return;}
 assert.equal(Boolean(approve()),false,'a native change with no fixed device/calendar must not expose approval');assert.ok(d.querySelector('[role="alert"]'));
 omitTarget=false;await act(async()=>{Array.from(d.querySelectorAll('button')).find(button=>button.textContent==='刷新')!.click();await delay(30);});await wait(()=>d.body.textContent?.includes('generated-native-account-A')??false,'unchanged exact target positive');assert.ok(approve());assert.equal((await f.ok(f.a.token,'/api/actions')).items.find((value:any)=>value.id===change.id).status,'proposed');
});
