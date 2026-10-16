import test from 'node:test';
import assert from 'node:assert/strict';
import React,{act} from 'react';
import {JSDOM} from 'jsdom';
import {setTimeout as delay} from 'node:timers/promises';
import {configureLocale} from '@mote/shared/i18n';
import {scopedMemoryFixture} from '../../server/test/fixtures/scoped-memory-host.js';
import {defaultModelSettings} from '../../server/src/model-settings.js';
import {ReferenceDetail} from '../src/ReferenceDetail.js';
import {Memories} from '../src/Memories.js';
import {MaterialDetail} from '../src/Materials.js';
import {memoryMaterialRoute} from '../src/memory-source-route.js';
import type {Api} from '../src/api.js';
configureLocale(()=> 'zh-CN');

test('original Memories reads real M07 publication and opens its evidence through the declared context reader',async t=>{
 const f=await scopedMemoryFixture(t),am=await f.publish(f.a,'A'),bm=await f.publish(f.b,'B');assert.equal(am.id,bm.id);
 await Promise.all([f.wait(f.a,(await f.submit(f.a,[am.id])).id),f.wait(f.b,(await f.submit(f.b,[bm.id])).id)]);
 const dom=new JSDOM('<!doctype html><div id="root"></div>',{url:'http://localhost/#/library?view=memories',pretendToBeVisual:true}),before=new Map<string,PropertyDescriptor|undefined>();
 for(const [key,value]of Object.entries({window:dom.window,document:dom.window.document,HTMLElement:dom.window.HTMLElement,IS_REACT_ACT_ENVIRONMENT:true})){before.set(key,Object.getOwnPropertyDescriptor(globalThis,key));Object.defineProperty(globalThis,key,{value,configurable:true,writable:true});}
 const {createRoot}=await import('react-dom/client');
 const root=createRoot(dom.window.document.getElementById('root')!),calls:{owner:string;path:string;status:number}[]=[],opened:string[]=[];
 t.after(async()=>{await act(async()=>root.unmount());for(const [key,value]of before){if(value)Object.defineProperty(globalThis,key,value);else Reflect.deleteProperty(globalThis,key);}dom.window.close();});
 const api=(account:any,owner:string):Api=>({connection:{mode:'web',origin:'http://localhost',deploymentId:'generated',userId:owner,credentialId:owner,csrfToken:'generated',username:owner,administrator:false},request:async(path,init)=>{const r=await f.request(account.token,path,init?.method,init?.body?JSON.parse(String(init.body)):undefined);calls.push({owner,path,status:r.statusCode});if(r.statusCode!==200)throw Error(r.statusCode+' '+r.body);return r.json();}} as Api);
 const d=dom.window.document,render=(value:Api)=>act(async()=>{root.render(React.createElement(Memories,{key:value.connection!.userId,api:value,range:{},onOpen:(ref:string)=>opened.push(ref)}));await delay(30);});
 await render(api(f.a,'A'));
 const card=d.querySelector<HTMLButtonElement>('.workspace-select');assert.ok(card,'actual M07 published memory is visible through the original page: '+d.body.textContent);
 assert.ok(calls.some(call=>call.path==='/api/memory/jobs'&&call.status===200),'existing job history consumes actual M07 jobs');
 assert.match(card.textContent!,/Generated A/);assert.doesNotMatch(d.body.textContent!,/Generated B/);
 const completed=d.querySelector<HTMLButtonElement>('.memory-job-history button');assert.ok(completed);await act(async()=>{completed.click();await delay(20);});for(let n=0;n<20&&!d.querySelector('.memory-progress');n++)await act(async()=>delay(10));assert.match(d.querySelector('.memory-progress')!.textContent!,/记忆提取完成/);assert.doesNotMatch(d.querySelector('.memory-progress')!.textContent!,/输入方案/);
 await act(async()=>{card.click();await delay(30);});assert.match(d.querySelector('.memory-detail')!.textContent!,/Nora prefers generated tea/);
 const evidence=d.querySelector<HTMLButtonElement>('.memory-evidence .evidence-card');assert.ok(evidence);await act(async()=>evidence.click());
 assert.match(opened[0],/^context:capture:/,'M07 normalized evidence belongs to the context reader, not raw captures');
 const memoryRef='memory:'+(await f.request(f.a.token,'/api/memories')).json().items[0].id;
 await act(async()=>{root.render(React.createElement(ReferenceDetail,{api:api(f.a,'A'),reference:memoryRef,onOpen:(ref:string)=>opened.push(ref)}));await delay(30);});
 for(let n=0;n<20&&!d.querySelector('.reference-detail .button');n++)await act(async()=>delay(10));
 const nested=Array.from(d.querySelectorAll<HTMLButtonElement>('button')).find(button=>button.textContent?.startsWith('查看原始记录'));assert.ok(nested,d.body.textContent!);await act(async()=>nested.click());assert.match(opened[1],/^context:capture:/,'expanded Memory retains the declared reader for nested evidence');
 const read=await f.request(f.a.token,'/api/context/read','POST',{refs:[opened[0].slice(8)]});assert.equal(read.statusCode,200,read.body);assert.match(read.body,/GENERATED_MEMORY_A/);assert.doesNotMatch(read.body,/GENERATED_MEMORY_B/);
 await render(api(f.b,'B'));assert.match(d.body.textContent!,/Generated B/);assert.doesNotMatch(d.body.textContent!,/Generated A/);assert.equal(d.querySelector('.memory-detail'),null);
 await act(async()=>{d.querySelector<HTMLButtonElement>('.workspace-select')!.click();await delay(20);});
 await act(async()=>Array.from(d.querySelectorAll<HTMLButtonElement>('button')).find(button=>button.textContent==='纠正记忆')!.click());
 await act(async()=>{const field=d.querySelector<HTMLTextAreaElement>('form.memory-correction textarea')!;Object.getOwnPropertyDescriptor(dom.window.HTMLTextAreaElement.prototype,'value')!.set!.call(field,'GENERATED_OWNER_CORRECTION_B');field.dispatchEvent(new dom.window.Event('input',{bubbles:true}));field.dispatchEvent(new dom.window.Event('change',{bubbles:true}));});
 const save=d.querySelector<HTMLButtonElement>('form.memory-correction button[type=submit]')!;assert.ok(save&&!save.disabled,'fixture input must first enter React correction state');await act(async()=>{save.click();await delay(30);});
 const corrected=calls.find(call=>call.owner==='B'&&/\/correct$/.test(call.path));assert.ok(corrected,'actual correction response must arrive');assert.equal(corrected.status,200,JSON.stringify(corrected));
 const correctionJob=(await f.request(f.b.token,'/api/memory/jobs')).json().items.find((job:any)=>job.tasks.correct);assert.ok(correctionJob);assert.equal(await f.terminal(correctionJob.tasks.correct.id),'succeeded');const done=(await f.request(f.b.token,'/api/memory/jobs/'+correctionJob.id)).json();assert.equal(done.state,'committed');assert.equal(done.current,false,'successful correction legitimately supersedes its related input version');
 for(let n=0;n<200&&!d.querySelector('.memory-detail')?.textContent?.includes('GENERATED_OWNER_CORRECTION_B');n++)await act(async()=>delay(20));assert.match(d.querySelector('.memory-detail')!.textContent!,/GENERATED_OWNER_CORRECTION_B/);
 assert.doesNotMatch((await f.request(f.a.token,'/api/memories')).body,/GENERATED_OWNER_CORRECTION_B/);
 assert.equal(calls.filter(call=>call.path.startsWith('/api/memories?')&&call.status!==200).length,0);
});


test('original Material detail and manual Memory selection retain canonical revision and the chosen account model through publication',async t=>{
 const f=await scopedMemoryFixture(t),am=await f.publish(f.a,'A'),bm=await f.publish(f.b,'B');assert.equal(am.id,bm.id);
 const profile={id:'same-model',name:'Generated default',settings:{...defaultModelSettings(),provider:'custom',protocol:'anthropic-messages',model:'generated-memory',baseUrl:f.modelUrl,apiKey:'GENERATED_A_KEY',headers:{},extraBody:{}}};await f.replace(f.a.token,'models',{profiles:[profile,{...profile,id:'only-a',name:'Generated temporary choice',settings:{...profile.settings,model:'generated-memory-web-choice'}}],selections:{memory:{kind:'personal',id:'same-model'}}});
 const defaultBefore=(await f.request(f.a.token,'/api/models/selection/memory')).json();let dropAdmission=true;
 const dom=new JSDOM('<!doctype html><div id="root"></div>',{url:'http://localhost/#/library',pretendToBeVisual:true}),before=new Map<string,PropertyDescriptor|undefined>();
 for(const [key,value]of Object.entries({window:dom.window,document:dom.window.document,HTMLElement:dom.window.HTMLElement,IS_REACT_ACT_ENVIRONMENT:true})){before.set(key,Object.getOwnPropertyDescriptor(globalThis,key));Object.defineProperty(globalThis,key,{value,configurable:true,writable:true});}
 const {createRoot}=await import('react-dom/client'),root=createRoot(dom.window.document.getElementById('root')!),calls:{path:string;body:any;status:number}[]=[];
 t.after(async()=>{await act(async()=>root.unmount());for(const [key,value]of before){if(value)Object.defineProperty(globalThis,key,value);else Reflect.deleteProperty(globalThis,key);}dom.window.close();});
 const api={connection:{mode:'web',origin:'http://localhost',deploymentId:'generated',userId:'A',credentialId:'A',csrfToken:'generated',username:'A',administrator:false},request:async(path:string,init?:RequestInit)=>{const body=init?.body?JSON.parse(String(init.body)):undefined,r=await f.request(f.a.token,path,init?.method,body);calls.push({path,body,status:r.statusCode});if(path==='/api/memory/jobs'&&body&&r.statusCode===200&&dropAdmission){dropAdmission=false;throw Error('Generated lost admission acknowledgement');}if(r.statusCode!==200)throw Error(r.statusCode+' '+r.body);return r.json();}} as Api;
 const d=dom.window.document;
 await act(async()=>{root.render(React.createElement(MaterialDetail,{api,material:am,onOpen:()=>{}}));await delay(30);});
 for(let n=0;n<30&&!d.querySelector('a[href*="memoryMaterial"]');n++)await act(async()=>delay(10));
 const link=d.querySelector<HTMLAnchorElement>('a[href*="memoryMaterial"]');assert.ok(link,'original Material detail exposes the actual M07 canonical selection: '+d.body.textContent);assert.equal(link.getAttribute('href'),memoryMaterialRoute(am.ref));
 dom.window.location.hash=link.getAttribute('href')!;
 await act(async()=>{root.render(React.createElement(Memories,{api,range:{},onOpen:()=>{}}));await delay(30);});
 for(let n=0;n<30&&d.querySelector<HTMLButtonElement>('.memory-actions button')?.disabled;n++)await act(async()=>delay(10));
 const extract=d.querySelector<HTMLButtonElement>('.memory-actions button');assert.ok(extract&&!extract.disabled,'canonical Material preflight makes the existing single-source form ready: '+d.body.textContent);
 await act(async()=>{const select=d.querySelector<HTMLSelectElement>('select[aria-label="本次模型"]')!;select.value='personal:only-a';select.dispatchEvent(new dom.window.Event('change',{bubbles:true}));});
 await act(async()=>{extract.click();await delay(30);});
 const admission=calls.find(call=>call.body&&call.path.includes('memory')&&call.body.materialIds);assert.ok(admission,'original form sends canonical IDs, not normalized evidence UUIDs: '+JSON.stringify(calls));assert.equal(admission.path,'/api/memory/jobs');assert.equal(admission.status,200,JSON.stringify(admission));assert.deepEqual(admission.body.materialRevisions,{[am.id]:am.revision});assert.deepEqual(admission.body.modelReference,{kind:'personal',id:'only-a'});
 assert.match(d.body.textContent!,/Generated lost admission acknowledgement/);await act(async()=>{d.querySelector<HTMLButtonElement>('.memory-actions button')!.click();await delay(30);});const attempts=calls.filter(call=>call.path==='/api/memory/jobs'&&call.body);assert.equal(attempts.length,2);assert.deepEqual(attempts[1].body,admission.body,'uncertain retry retains exactly the admitted operation and pinned input');
 const done=await f.wait(f.a,admission.body.operationId);assert.equal(done.state,'committed');
 for(let n=0;n<150&&!d.querySelector('.memory-progress')?.textContent?.includes('记忆提取完成');n++)await act(async()=>delay(20));assert.match(d.querySelector('.memory-progress')!.textContent!,/记忆提取完成/);
 assert.ok(f.requests.length>=2);assert.ok(f.requests.every(r=>r.body.model==='generated-memory-web-choice'&&r.key==='GENERATED_A_KEY'&&!r.raw.includes('GENERATED_MEMORY_B')));assert.deepEqual((await f.request(f.a.token,'/api/models/selection/memory')).json(),defaultBefore);assert.equal((await f.request(f.b.token,'/api/memories')).json().items.length,0);
});
