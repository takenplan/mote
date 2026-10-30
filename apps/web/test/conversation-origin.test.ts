import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readOriginTurn,conversationTurnRoute} from '../src/conversation-origin';
import type {Api} from '../src/api';
test('saved origin finds exact older turn, never a similar question, and rejects changed/revoked pages',async()=>{
 const wanted={id:'old',question:'same question'},signal=new AbortController().signal;
 const requests:string[]=[];
 const api={request:async(path:string)=>{requests.push(path);return path.includes('?')?{id:'c',revision:1,turns:[wanted]}:{id:'c',revision:1,turns:[{id:'new',question:'same question'}],nextCursor:'older'};}} as Api;
 assert.deepEqual(await readOriginTurn(api,'c','old',signal),wanted);assert.equal(requests.length,2);
 assert.equal(conversationTurnRoute('c','old'),'#/ask?conversation=c&turn=old');
 for(const replacement of [{id:'c',revision:2,turns:[wanted]},{id:'other',revision:1,turns:[wanted]}]){
  const changed={request:async(path:string)=>path.includes('?')?replacement:{id:'c',revision:1,turns:[],nextCursor:'older'}} as Api;
  await assert.rejects(readOriginTurn(changed,'c','old',signal));
 }
 const denied={request:async()=>{throw Error('403');}} as Api;
 await assert.rejects(readOriginTurn(denied,'c','old',signal),/403/);
 const deleted={request:async()=>({id:'c',turns:[{...wanted,evidenceDeleted:true}]})} as Api;
 assert.equal(await readOriginTurn(deleted,'c','old',signal),undefined);
});

test('saved record warns when its authorized source turn is historical without replacing its quote',async()=>{
 const {JSDOM}=await import('jsdom'),React=await import('react'),{createRoot}=await import('react-dom/client');
 const {NoteOrigin}=await import('../src/NoteOrigin.js');
 const {configureLocale,getLocale}=await import('@mote/shared/i18n');
 const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost/'}),previous=new Map<string,PropertyDescriptor|undefined>(),locale=getLocale();
 for(const [key,value]of Object.entries({window:dom.window,document:dom.window.document,IS_REACT_ACT_ENVIRONMENT:true})){
  previous.set(key,Object.getOwnPropertyDescriptor(globalThis,key));Object.defineProperty(globalThis,key,{value,configurable:true,writable:true});
 }
 configureLocale(()=> 'zh-CN');const root=createRoot(dom.window.document.getElementById('root')!);
 const snapshot='Generated question\n\nGenerated historical answer [1]';
 const capture={id:'saved',metadata:{noteOrigin:{kind:'conversation',text:snapshot,conversationId:'conversation',messageIds:['turn']}}} as import('../src/api').Capture;
 const api={request:async(path:string)=>{assert.equal(path,'/api/conversations/conversation');return {id:'conversation',revision:2,turns:[{id:'turn',question:'Generated question',evidenceStale:true,result:{answer:'Generated historical answer [1]',citations:[{id:'source'}]}}]};}} as Api;
 try{
  await React.act(async()=>root.render(React.createElement(NoteOrigin,{api,capture,onOpen:()=>{}})));
  const notice=dom.window.document.querySelector('[role="status"]');
  assert.equal(notice?.textContent,'这是历史版本，当前资料已更新。');
  assert.match(dom.window.document.querySelector('.note-origin')!.textContent!,/Generated question.*Generated historical answer \[1\]/s);
  assert.equal(dom.window.document.querySelector('a')?.getAttribute('href'),'#/ask?conversation=conversation&turn=turn');
  assert.equal(dom.window.document.querySelectorAll('nav button').length,1);
 }finally{
  await React.act(async()=>root.unmount());dom.window.close();configureLocale(()=>locale);
  for(const [key,value]of previous){if(value)Object.defineProperty(globalThis,key,value);else Reflect.deleteProperty(globalThis,key);}
 }
});

test('saved origin formats only an exact authorized answer and keeps the literal snapshot on changed or unavailable turns',async()=>{
 const {JSDOM}=await import('jsdom'),React=await import('react'),{createRoot}=await import('react-dom/client');
 const {NoteOrigin}=await import('../src/NoteOrigin.js'),{configureLocale,getLocale}=await import('@mote/shared/i18n');
 const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost/'}),previous=new Map<string,PropertyDescriptor|undefined>(),locale=getLocale();
 for(const [key,value]of Object.entries({window:dom.window,document:dom.window.document,IS_REACT_ACT_ENVIRONMENT:true})){
  previous.set(key,Object.getOwnPropertyDescriptor(globalThis,key));Object.defineProperty(globalThis,key,{value,configurable:true,writable:true});
 }
 configureLocale(()=> 'zh-CN');const root=createRoot(dom.window.document.getElementById('root')!),opened:string[]=[];
 const citation='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',answer='## Generated heading\n\n**Answer** ['+citation+'] and [authored label]',snapshot='Generated question\n\n'+answer;
 const capture={id:'saved',metadata:{noteOrigin:{kind:'conversation',text:snapshot,conversationId:'conversation',messageIds:['turn']}}} as import('../src/api').Capture;
 let mode:'same'|'changed'|'unavailable'='same';
 const api={request:async(path:string)=>{if(mode==='unavailable')throw Error('Generated forbidden');if(path.includes('/references/'))return{id:citation,available:true};return {id:'conversation',revision:1,turns:[{id:'turn',question:'Generated question',result:{answer:mode==='same'?answer:answer+' changed',citations:[{id:citation}]}}]};}} as Api;
 try{
  const mount=()=>React.act(async()=>root.render(React.createElement(NoteOrigin,{api,capture,onOpen:(ref:string)=>opened.push(ref)})));
  await mount();const origin=dom.window.document.querySelector('.note-origin')!;
  assert.equal(origin.querySelector('strong')?.textContent,'Answer');assert.doesNotMatch(origin.textContent!,/##|\*\*|bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/);assert.match(origin.textContent!,/\[authored label\]/);
  await React.act(async()=>origin.querySelector<HTMLButtonElement>('nav button')!.click());assert.deepEqual(opened,['capture:'+citation]);assert.equal(capture.metadata!.noteOrigin!.text,snapshot);
  await React.act(async()=>root.render(null));mode='changed';await mount();assert.match(dom.window.document.querySelector('[role=status]')!.textContent!,/不同/);assert.equal(dom.window.document.querySelector('pre')!.textContent,snapshot);assert.equal(dom.window.document.querySelector('nav'),null);
  await React.act(async()=>root.render(null));mode='unavailable';await mount();assert.match(dom.window.document.querySelector('[role=status]')!.textContent!,/暂不可读/);assert.equal(dom.window.document.querySelector('pre')!.textContent,snapshot);assert.equal(dom.window.document.querySelector('nav'),null);
 }finally{
  await React.act(async()=>root.unmount());dom.window.close();configureLocale(()=>locale);
  for(const [key,value]of previous){if(value)Object.defineProperty(globalThis,key,value);else Reflect.deleteProperty(globalThis,key);}
 }
});

test('saved-origin citation checks history availability and ignores late replies after snapshot or owner changes',async()=>{
 const {JSDOM}=await import('jsdom'),React=await import('react'),{createRoot}=await import('react-dom/client');
 const {NoteOrigin}=await import('../src/NoteOrigin.js'),{configureLocale,getLocale}=await import('@mote/shared/i18n');
 const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost/'}),previous=new Map<string,PropertyDescriptor|undefined>(),locale=getLocale();
 for(const [key,value]of Object.entries({window:dom.window,document:dom.window.document,IS_REACT_ACT_ENVIRONMENT:true})){
  previous.set(key,Object.getOwnPropertyDescriptor(globalThis,key));Object.defineProperty(globalThis,key,{value,configurable:true,writable:true});
 }
 configureLocale(()=> 'zh-CN');const root=createRoot(dom.window.document.getElementById('root')!),opened:string[]=[],citation='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
 const original='Generated question\n\nGenerated answer ['+citation+']';
 const record=(text=original)=>({id:'saved',metadata:{noteOrigin:{kind:'conversation',text,conversationId:'conversation',messageIds:['turn']}}} as import('../src/api').Capture);
 let mode:'denied'|'allowed'|'held'='denied',finish!:(value:unknown)=>void,signal:AbortSignal|undefined,gateReads=0,withdrawn=false;
 const api={request:async(path:string,init?:RequestInit)=>{if(path.includes('/references/')){gateReads++;signal=init?.signal as AbortSignal;if(mode==='held')return new Promise(resolve=>finish=resolve);return{id:citation,available:mode==='allowed'};}return{id:'conversation',revision:1,turns:[{id:'turn',question:'Generated question',evidenceDeleted:withdrawn,result:{answer:'Generated answer ['+citation+']',citations:[{id:citation}]}}]};}} as Api;
 const mount=(owner:Api,capture=record())=>React.act(async()=>root.render(React.createElement(NoteOrigin,{api:owner,capture,onOpen:(ref:string)=>opened.push(ref)})));
 const click=()=>React.act(async()=>dom.window.document.querySelector<HTMLButtonElement>('.note-origin nav button')!.click());
 try{
  await mount(api);await click();assert.equal(gateReads,1);assert.deepEqual(opened,[]);assert.match(dom.window.document.querySelector('[role=status]')!.textContent!,/引用不可用/);
  mode='allowed';await click();assert.deepEqual(opened,['capture:'+citation]);
  mode='held';await click();withdrawn=true;await React.act(async()=>finish({id:citation,available:true}));assert.deepEqual(opened,['capture:'+citation]);assert.match(dom.window.document.querySelector('[role=status]')!.textContent!,/引用不可用/);withdrawn=false;
  mode='held';await click();assert.ok(finish);await mount(api,record(original+' changed'));assert.equal(signal?.aborted,true);await React.act(async()=>finish({id:citation,available:true}));assert.deepEqual(opened,['capture:'+citation]);
  await mount(api);mode='held';finish=undefined as any;await click();assert.ok(finish);const other={request:async()=>{throw Error('Generated second owner unavailable');}} as Api;await mount(other);assert.equal(signal?.aborted,true);await React.act(async()=>finish({id:citation,available:true}));assert.deepEqual(opened,['capture:'+citation]);
 }finally{
  await React.act(async()=>root.unmount());dom.window.close();configureLocale(()=>locale);
  for(const [key,value]of previous){if(value)Object.defineProperty(globalThis,key,value);else Reflect.deleteProperty(globalThis,key);}
 }
});
