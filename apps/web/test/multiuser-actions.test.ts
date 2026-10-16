import test from 'node:test';
import assert from 'node:assert/strict';
import React,{act} from 'react';
import {JSDOM} from 'jsdom';
import {setTimeout as delay} from 'node:timers/promises';
import {configureLocale} from '@mote/shared/i18n';
import {modelFixture} from '../../server/test/fixtures/scoped-actions.js';
import {password} from '../../server/test/fixtures/scoped-query-accounts.js';
import {createApi,type Api} from '../src/api.js';
import {Actions} from '../src/Actions.js';
configureLocale(()=> 'zh-CN');

test('the original Actions dialog displays the actual immutable M12 review before an OwnerQuestions approval',async t=>{
 const f=await modelFixture(t);
 for(const [user,label]of [[f.a,'A'],[f.b,'B']]as const){await f.ingest(user,label);await f.enable(user);await f.ok(user.token,'/api/actions/targets','POST',{deviceId:'same-device',deviceName:'Generated device '+label,calendars:[{id:'same-calendar',title:'Generated calendar '+label,accountId:'generated-account-'+label}]});}
 const [ap,bp]=await Promise.all([f.proposal(f.a),f.proposal(f.b)]),aProposal=ap.items[0],bProposal=bp.items[0];
 const dom=new JSDOM('<!doctype html><div id="root"></div>',{url:'http://localhost/#/actions',pretendToBeVisual:true}),before=new Map<string,PropertyDescriptor|undefined>();let cookie='',current:Api|undefined;
 const calls:{session:string;path:string;method:string;body:string;status:number}[]=[];
 for(const [key,value]of Object.entries({window:dom.window,document:dom.window.document,HTMLElement:dom.window.HTMLElement,Event:dom.window.Event,IS_REACT_ACT_ENVIRONMENT:true,fetch:async(path:string,init:RequestInit={})=>{const headers=new Headers(init.headers);headers.set('cookie',cookie);const r=await f.node.app.inject({url:path,method:init.method as any??'GET',headers:Object.fromEntries(headers),...(init.body?{payload:String(init.body)}:{})});calls.push({session:headers.get('x-mote-session-id')??'',path,method:init.method??'GET',body:String(init.body??''),status:r.statusCode});return new Response(r.rawPayload,{status:r.statusCode,headers:r.headers as Record<string,string>});}})){before.set(key,Object.getOwnPropertyDescriptor(globalThis,key));Object.defineProperty(globalThis,key,{value,configurable:true,writable:true});}
 const {createRoot}=await import('react-dom/client'),root=createRoot(dom.window.document.getElementById('root')!),d=dom.window.document;
 t.after(async()=>{current?.close?.();await act(async()=>root.unmount());for(const [key,value]of before){if(value)Object.defineProperty(globalThis,key,value);else Reflect.deleteProperty(globalThis,key);}dom.window.close();});
 const login=async(username:string)=>{const r=await f.request(undefined,'/api/auth/login','POST',{username,password,mode:'web'});assert.equal(r.statusCode,200,r.body);cookie=String(r.headers['set-cookie']).split(';')[0];const api=createApi({mode:'web',origin:'http://localhost',...r.json()},undefined,()=>current===api);current?.close?.();current=api;return api;};
 const render=async(api:Api)=>act(async()=>{root.render(React.createElement(Actions,{api,onOpen:()=>{}}));await delay(30);}),wait=async(ready:()=>boolean,label:string)=>{for(let n=0;n<400&&!ready();n++)await act(async()=>delay(10));assert.ok(ready(),label+' '+d.body.textContent);};
 const a=await login('generated-a');await render(a);await wait(()=>d.body.textContent?.includes('Generated A')??false,'actual A proposal');
 await act(async()=>{const edit=Array.from(d.querySelectorAll('button')).find(b=>b.textContent==='核对并添加');assert.ok(edit);edit.click();await delay(20);});
 const form=d.querySelector<HTMLFormElement>('form[aria-label="确认日程"]');assert.ok(form);
 await act(async()=>{const select=form.querySelector('select')!;select.value=JSON.stringify({deviceId:'same-device',calendarId:'same-calendar'});select.dispatchEvent(new dom.window.Event('change',{bubbles:true}));await delay(10);form.dispatchEvent(new dom.window.Event('submit',{bubbles:true,cancelable:true}));await delay(30);});
 await wait(()=>calls.some(c=>c.method==='POST'&&c.path==='/api/actions/'+aProposal.id+'/review')||calls.some(c=>c.method==='POST'&&c.path.endsWith('/confirm')),'actual review admission');
 assert.ok(calls.some(c=>c.method==='POST'&&c.path==='/api/actions/'+aProposal.id+'/review'),'the original modal must first create an immutable server review');
 assert.ok(!calls.some(c=>c.path.endsWith('/confirm')||c.path.endsWith('/reply')),'no approval occurs before the returned fixed content is displayed');
 await wait(()=>d.body.textContent?.includes('generated-account-A')??false,'actual fixed target account');
 assert.match(d.body.textContent!,/Generated calendar A/);assert.match(d.body.textContent!,/Generated device A/);assert.match(d.body.textContent!,/GENERATED_A_PRIVATE_APPOINTMENT/);
 assert.equal((await f.ok(f.a.token,'/api/actions')).items[0].status,'proposed');assert.equal((await f.ok(f.b.token,'/api/actions')).items[0].status,'proposed');
 const approve=Array.from(d.querySelectorAll('button')).find(b=>b.textContent==='确认添加到此日历');assert.ok(approve);
 await act(async()=>{approve.click();await delay(30);});
 await wait(()=>calls.some(c=>c.path.startsWith('/api/owner-questions/')&&c.path.endsWith('/reply')),'actual OwnerQuestions approval');
 const reply=calls.find(c=>c.path.endsWith('/reply'))!;assert.equal(reply.status,200,reply.body);assert.equal(JSON.parse(reply.body).choiceId,'approve');assert.ok(Number.isSafeInteger(JSON.parse(reply.body).expectedRevision));
 assert.equal((await f.ok(f.a.token,'/api/actions')).items.find((value:any)=>value.id===aProposal.id).status,'approved');assert.equal((await f.ok(f.b.token,'/api/actions')).items.find((value:any)=>value.id===bProposal.id).status,'proposed');
});
