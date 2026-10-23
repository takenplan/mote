import test, {type TestContext} from 'node:test';
import assert from 'node:assert/strict';
import React, {act} from 'react';
import {JSDOM} from 'jsdom';
import {setTimeout as delay} from 'node:timers/promises';
import {configureLocale} from '@mote/shared/i18n';
import {fixture} from '../../server/test/fixtures/scoped-actions.js';
import {createApi, type Api} from '../src/api.js';
import {ScopedConfiguration} from '../src/ScopedConfiguration.js';
configureLocale(()=>'zh-CN');

const intent=['memory:lifecycle.working.enabled'];
async function setup(t:TestContext){
 const f=await fixture(t),view=await f.ok(f.a.token,'/api/configuration'),memory=view.domains.find((domain:any)=>domain.id==='memory').saved;
 await f.ok(f.a.token,'/api/configuration/memory','PUT',{revision:view.revision,value:{...memory,automatic:false,integration:false,lifecycle:{...memory.lifecycle,consolidation:{...memory.lifecycle.consolidation,enabled:false},insights:{...memory.lifecycle.insights,enabled:false},working:{...memory.lifecycle.working,enabled:false}}}});
 const bBefore=await f.ok(f.b.token,'/api/configuration'),dom=new JSDOM('<!doctype html><div id="root"></div>',{url:'http://localhost/#/system/models?category=model',pretendToBeVisual:true}),prior=new Map<string,PropertyDescriptor|undefined>();
 type Gate={entered:boolean;revision?:number;release:()=>void;promise:Promise<void>};
 let held:Gate|undefined,current:Api|undefined,cookie='';const gates:Gate[]=[],calls:{path:string;method:string;revision?:number;automationIntent?:string[];status:number}[]=[];
 const holdNextConfiguration=()=>{let release!:()=>void;const gate:Gate={entered:false,promise:new Promise<void>(resolve=>release=resolve),release:()=>release()};gates.push(gate);held=gate;return gate;};
 t.after(()=>{for(const gate of gates)gate.release();});
 for(const[key,value]of Object.entries({window:dom.window,document:dom.window.document,location:dom.window.location,localStorage:dom.window.localStorage,HTMLElement:dom.window.HTMLElement,Event:dom.window.Event,IS_REACT_ACT_ENVIRONMENT:true,fetch:async(path:string,init:RequestInit={})=>{
  const headers=new Headers(init.headers);headers.set('cookie',cookie);const method=init.method??'GET',body=init.body?JSON.parse(String(init.body)):undefined,call={path,method,...(body?.revision!==undefined?{revision:body.revision}:{}),...(body?.automationIntent?{automationIntent:body.automationIntent}:{}),status:0};calls.push(call);
  const response=await f.node.app.inject({url:path,method:method as any,headers:Object.fromEntries(headers),...(init.body?{payload:String(init.body)}:{})});call.status=response.statusCode;
  if(path==='/api/configuration'&&method==='GET'&&held){const gate=held;held=undefined;gate.entered=true;gate.revision=response.json().revision;await gate.promise;}
  return new Response(response.rawPayload,{status:response.statusCode,headers:response.headers as Record<string,string>});
 }})){prior.set(key,Object.getOwnPropertyDescriptor(globalThis,key));Object.defineProperty(globalThis,key,{value,configurable:true,writable:true});}
 const login=await f.request(undefined,'/api/auth/login','POST',{username:'generated-a',password:'Generated-M11-account-password-01',mode:'web'});assert.equal(login.statusCode,200,login.body);cookie=String(login.headers['set-cookie']).split(';')[0];
 const api=createApi({...login.json(),mode:'web',origin:'http://localhost'},undefined,()=>current===api);current=api;
 const {createRoot}=await import('react-dom/client'),root=createRoot(dom.window.document.getElementById('root')!),d=dom.window.document;
 t.after(async()=>{for(const gate of gates)gate.release();api.close?.();await act(async()=>root.unmount());for(const[key,value]of prior){if(value)Object.defineProperty(globalThis,key,value);else Reflect.deleteProperty(globalThis,key);}dom.window.close();});
 const memoryEditor=()=>d.querySelector<HTMLElement>('.discovery-settings-advanced [data-domain="memory"]'),modelsEditor=()=>d.querySelector<HTMLElement>('.server-settings > [data-domain="models"]'),working=()=>memoryEditor()?.querySelector<HTMLInputElement>('[aria-label="启用对话工作记忆"]'),version=(editor:HTMLElement|undefined|null)=>editor?.querySelector(':scope > p')?.textContent?.trim(),save=()=>memoryEditor()?.querySelector<HTMLButtonElement>('.config-draft-footer button.primary');
 const clean=(editor:HTMLElement|undefined|null,revision:number)=>version(editor)==='版本 '+revision&&editor?.querySelector('.config-draft-footer > span')?.textContent==='当前没有未保存的修改'&&editor.querySelector<HTMLButtonElement>('.config-draft-footer button.primary')?.disabled===true;
 const ready=(revision:number)=>clean(memoryEditor(),revision)&&clean(modelsEditor(),revision)&&working()?.checked===false&&working()?.disabled===false&&working()?.matches(':disabled')===false;
 const observed=()=>JSON.stringify({memory:version(memoryEditor()),models:version(modelsEditor()),checked:working()?.checked,footer:memoryEditor()?.querySelector('.config-draft-footer')?.textContent,calls});
 const wait=async(read:()=>boolean,label:string)=>{const end=Date.now()+8000;while(!read()){assert.ok(Date.now()<end,label+': '+observed());await act(async()=>delay(10));}};
 const render=()=>act(async()=>{root.render(React.createElement(ScopedConfiguration,{api}));await delay(10);}),unmount=()=>act(async()=>{root.render(null);await delay(10);});
 const toggle=()=>act(async()=>{const control=working();assert.ok(control);assert.equal(control.disabled,false);assert.equal(control.matches(':disabled'),false);control.click();await delay(10);});
 const pressSave=()=>act(async()=>{const control=save();assert.ok(control);assert.equal(control.disabled,false);control.click();await delay(10);});
 const writes=()=>calls.filter(call=>call.path==='/api/configuration/memory'&&call.method==='PUT'),grants=()=>f.read(db=>db.prepare('SELECT task_id,grant_id,user_id FROM task_authorizations WHERE user_id=? ORDER BY task_id').all(f.a.userId));
 const policy=async()=>{const policies=await f.ok(f.a.token,'/api/ask-automations');return policies.items.find((row:any)=>row.input.kind==='working');};
 const assertPolicy=async()=>{const created=await policy();assert.ok(created);assert.equal(created.state,'active');assert.equal(created.input.includeExisting,false);assert.ok(created.task_id);assert.equal((await f.ok(f.a.token,'/api/tasks/'+created.task_id)).kind,'ask.automation');assert.equal((await f.request(f.b.token,'/api/tasks/'+created.task_id)).statusCode,404);assert.deepEqual((await f.ok(f.b.token,'/api/ask-automations')).items,[]);assert.deepEqual(await f.ok(f.b.token,'/api/configuration'),bBefore);return created;};
 const initial=await f.ok(f.a.token,'/api/configuration');await render();await wait(()=>ready(initial.revision),'initial clean current configuration');assert.equal(await policy(),undefined);const originalGrants=grants();
 const remountAfterPrice=async()=>{await unmount();await api.request('/api/usage/prices',{method:'PUT',body:JSON.stringify({provider:'custom',model:'generated-cas',currency:'USD',input:1,output:2,cacheRead:0,cacheWrite:0})});const next=await f.ok(f.a.token,'/api/configuration');assert.equal(next.revision,initial.revision+1);assert.equal(await policy(),undefined);const gate=holdNextConfiguration();await render();await wait(()=>gate.entered,'actual current GET held for delivery');assert.equal(gate.revision,next.revision);assert.equal(version(memoryEditor()),'版本 '+initial.revision);assert.equal(ready(next.revision),false);return {next,gate};};
 return {f,api,d,initial,remountAfterPrice,render,wait,ready,working,memoryEditor,modelsEditor,version,save,toggle,pressSave,writes,grants,originalGrants,policy,assertPolicy,observed};
}

test('a cached Memory edit keeps its original CAS revision and owner intent through a later full view, then requires visible reload and reconfirmation',async t=>{
 const ui=await setup(t),{next,gate}=await ui.remountAfterPrice();
 await ui.toggle();assert.equal(ui.working()!.checked,true);assert.equal(ui.writes().length,0);gate.release();
 await ui.wait(()=>ui.version(ui.modelsEditor())==='版本 '+next.revision,'clean Models consumes the genuine new GET');
 assert.equal(ui.version(ui.memoryEditor()),'版本 '+ui.initial.revision);assert.equal(ui.working()!.checked,true);assert.equal(ui.ready(next.revision),false);assert.equal(await ui.policy(),undefined);assert.equal(ui.writes().length,0);
 await ui.pressSave();await ui.wait(()=>!!ui.memoryEditor()?.querySelector('[role="alert"]'),'real stale CAS response is visible');
 assert.deepEqual(ui.writes(),[{path:'/api/configuration/memory',method:'PUT',revision:ui.initial.revision,automationIntent:intent,status:409}]);
 assert.match(ui.memoryEditor()!.textContent!,/配置或相关操作状态已变化/);assert.match(ui.memoryEditor()!.textContent!,/有未保存的修改/);assert.equal(ui.working()!.checked,true);assert.equal(ui.version(ui.memoryEditor()),'版本 '+ui.initial.revision);assert.equal(await ui.policy(),undefined);assert.deepEqual(ui.grants(),ui.originalGrants,'stale config cannot mint a task grant');
 await act(async()=>delay(30));assert.equal(ui.writes().length,1,'a conflict cannot trigger an automatic retry or revision replacement');assert.deepEqual(ui.grants(),ui.originalGrants);
 const reload=[...ui.memoryEditor()!.querySelectorAll<HTMLButtonElement>('button')].find(button=>button.textContent==='重新读取并还原草稿');assert.ok(reload);assert.equal(reload.disabled,false);
 await act(async()=>{reload.click();await delay(10);});await ui.wait(()=>ui.ready(next.revision),'explicit reload restores the current ungranted clean snapshot');assert.equal(await ui.policy(),undefined);assert.equal(ui.writes().length,1);assert.deepEqual(ui.grants(),ui.originalGrants,'reloading does not authorize automation');
 await ui.toggle();await ui.pressSave();await ui.wait(()=>ui.memoryEditor()?.querySelector('.config-draft-footer > span')?.textContent==='当前没有未保存的修改','explicitly reconfirmed current save completes');
 assert.deepEqual(ui.writes().map(call=>({revision:call.revision,automationIntent:call.automationIntent,status:call.status})),[{revision:ui.initial.revision,automationIntent:intent,status:409},{revision:next.revision,automationIntent:intent,status:200}]);
 const policy=await ui.assertPolicy();t.diagnostic(JSON.stringify({generatedOnly:true,staleRevision:ui.initial.revision,currentRevision:next.revision,explicitPolicyTask:policy.task_id,writes:ui.writes()}));
});

test('a still-clean configuration remount waits for the genuine current snapshot before the working owner edit',async t=>{
 const ui=await setup(t),{next,gate}=await ui.remountAfterPrice();assert.equal(ui.working()!.checked,false);assert.equal(ui.writes().length,0);assert.equal(await ui.policy(),undefined);
 gate.release();await ui.wait(()=>ui.ready(next.revision),'both clean editors consume the actual post-price revision before editing');assert.equal(ui.writes().length,0);assert.equal(await ui.policy(),undefined);assert.deepEqual(ui.grants(),ui.originalGrants);
 await ui.toggle();await ui.pressSave();await ui.wait(()=>ui.memoryEditor()?.querySelector('.config-draft-footer > span')?.textContent==='当前没有未保存的修改','one current snapshot save completes');
 assert.deepEqual(ui.writes(),[{path:'/api/configuration/memory',method:'PUT',revision:next.revision,automationIntent:intent,status:200}]);const policy=await ui.assertPolicy();t.diagnostic(JSON.stringify({generatedOnly:true,cleanRevision:next.revision,explicitPolicyTask:policy.task_id,writes:ui.writes()}));
});
