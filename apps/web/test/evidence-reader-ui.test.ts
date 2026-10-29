import test from 'node:test';
import assert from 'node:assert/strict';
import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import {JSDOM} from 'jsdom';
import {EvidenceDialog} from '../src/shell-components.js';
import {dateTime,type Api,type Capture} from '../src/api.js';

const id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const generated:Capture={id,source:'note',platform:'import',capturedAt:'2026-10-13T00:00:00Z',appName:'Generated note app',windowTitle:'Generated first line',deviceId:'generated-device',deviceName:'Generated device',ocrText:'Generated first line\n  Literal screen / media / file words <script>untrusted()</script>\n',durationMs:0,blobHash:null,indexingStatus:'pending',privacy:{redacted:false,mode:'standard'}};
async function fixture(t:any,capture:Capture){
 const dom=new JSDOM('<!doctype html><main><button id="origin">Open generated original</button></main><div id="root"></div>',{url:'http://localhost/#/library?source=note',pretendToBeVisual:true}),backups=new Map<string,PropertyDescriptor|undefined>();
 for(const [key,value]of Object.entries({window:dom.window,document:dom.window.document,HTMLElement:dom.window.HTMLElement,localStorage:dom.window.localStorage,IS_REACT_ACT_ENVIRONMENT:true})){backups.set(key,Object.getOwnPropertyDescriptor(globalThis,key));Object.defineProperty(globalThis,key,{value,configurable:true,writable:true});}
 dom.window.localStorage.setItem('mote.language','zh-CN');dom.window.HTMLElement.prototype.getClientRects=()=>[{}] as unknown as DOMRectList;
 const root=createRoot(dom.window.document.querySelector('#root')!),writes:string[]=[],opened:string[]=[],origin=dom.window.document.querySelector<HTMLButtonElement>('#origin')!;
 const api={request:async(path:string,init?:RequestInit)=>{if(path.startsWith('/api/operations/changes'))return {ids:[],cursor:0,hasMore:false,reset:false};if(path==='/api/capture-browser/'+id)return capture;if(init?.method==='DELETE'){writes.push(path);return {};}throw Error('Unexpected generated path '+path);},setAgentTimeout:()=>{}} as Api;
 origin.focus();await act(async()=>root.render(React.createElement(EvidenceDialog,{api,id:'capture:'+id,onOpen:ref=>opened.push(ref),onClose:()=>root.render(null),onDeleted:()=>{}})));
 t.after(async()=>{await act(async()=>root.unmount());dom.window.close();for(const [key,descriptor]of backups){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else Reflect.deleteProperty(globalThis,key);}});
 return {document:dom.window.document,origin,writes,opened};
}
test('note reader leads with the exact original, keeps real source facts and returns focus after Close',async t=>{
 const before=structuredClone(generated),{document:d,origin,writes}=await fixture(t,generated),body=d.querySelector('.evidence-text pre')!;
 await act(async()=>d.querySelector<HTMLButtonElement>('.reader-more-button')!.click());const help=d.querySelector<HTMLDetailsElement>('.evidence-processing-help')!;
 assert.equal(d.querySelector('.evidence-heading h2')!.textContent,generated.windowTitle);assert.equal(d.querySelector('.evidence-body-heading')!.textContent,'用户原文');
 assert.equal(body.textContent,generated.ocrText);assert.equal(body.querySelector('script'),null,'untrusted original remains literal');
 assert.match(d.querySelector('.evidence-caption')!.textContent!,/Generated note app/);assert.match(d.querySelector('.evidence-caption')!.textContent!,/Generated device/);assert.equal(d.querySelector('.evidence-caption time')!.textContent,dateTime(generated.capturedAt));assert.equal(d.querySelector('time')!.getAttribute('datetime'),generated.capturedAt);
 assert.equal(d.querySelector<HTMLDetailsElement>('.reader-source-details')!.open,false,'original text leads while source facts remain available on demand');
 const facts=Array.from(d.querySelectorAll('.reader-source-details>dl>div'));
 assert.ok(facts.some(row=>row.querySelector('dt')!.textContent==='窗口标题'&&row.querySelector('dd')!.textContent===generated.windowTitle));
 assert.ok(facts.some(row=>row.textContent==='索引状态等待索引'));assert.ok(facts.some(row=>row.textContent==='隐私处理未标记脱敏'));
 // Source facts and processing explanation remain available on demand.
 assert.equal(d.querySelector('[data-archive-state]')!.textContent,'资料已归档');assert.equal(d.querySelector('[data-processing-state]')!.getAttribute('data-processing-state'),'unknown');assert.equal(help.open,false);assert.equal(help.querySelector('summary')!.textContent,'归档与处理说明');
 assert.ok(body.compareDocumentPosition(help)&d.defaultView!.Node.DOCUMENT_POSITION_FOLLOWING);assert.ok(body.compareDocumentPosition(d.querySelector('.evidence-source-actions')!)&d.defaultView!.Node.DOCUMENT_POSITION_FOLLOWING);
 help.open=true;assert.match(help.textContent!,/OCR、索引和记忆分别处理/);
 const route=d.querySelector('.evidence-source-actions a')!.getAttribute('href')!;assert.equal(new URLSearchParams(route.split('?')[1]).get('memorySource'),'capture:'+id);
 await act(async()=>d.querySelector<HTMLButtonElement>('[aria-label="关闭资料操作"]')!.click());await act(async()=>d.querySelector<HTMLButtonElement>('[aria-label="关闭证据详情"]')!.click());assert.equal(d.querySelector('[role=dialog]'),null);assert.equal(d.activeElement,origin);assert.equal(d.querySelector('main')!.hasAttribute('inert'),false);assert.deepEqual(writes,[]);assert.deepEqual(generated,before);
});
test('screen reader keeps authored title, failed OCR/index/privacy facts and the actual delete confirmation',async t=>{
 const capture:Capture={...generated,source:'screen',platform:'macos',windowTitle:'Generated authored window',ocrText:'Exact generated OCR\n  final line ',indexingStatus:'failed',ocr:{status:'failed',updatedAt:'2026-10-13T00:01:00Z'},privacy:{redacted:true,mode:'standard'}},before=structuredClone(capture),{document:d,writes}=await fixture(t,capture);
 assert.equal(d.querySelector('.evidence-heading h2')!.textContent,capture.windowTitle);assert.equal(d.querySelector('.evidence-body-heading')!.textContent,'OCR 全文');assert.equal(d.querySelector('.evidence-text pre')!.textContent,capture.ocrText);
 assert.match(d.querySelector('.evidence-caption')!.textContent!,/屏幕采样/);assert.match(d.querySelector('.evidence-ocr-status')!.textContent!,/OCR 失败/);assert.match(d.querySelector('.reader-source-details>dl')!.textContent!,/索引失败/);assert.match(d.querySelector('.reader-source-details>dl')!.textContent!,/客户端报告已脱敏/);
 await act(async()=>d.querySelector<HTMLButtonElement>('.reader-more-button')!.click());await act(async()=>d.querySelector<HTMLButtonElement>('.danger-text')!.click());assert.match(d.querySelector('.evidence-footer')!.textContent!,/此操作无法撤销/);assert.deepEqual(writes,[]);
 await act(async()=>Array.from(d.querySelectorAll<HTMLButtonElement>('.evidence-footer button')).find(button=>button.textContent==='取消')!.click());assert.deepEqual(writes,[]);assert.equal(d.querySelector('.evidence-text pre')!.textContent,capture.ocrText);
 await act(async()=>d.querySelector<HTMLButtonElement>('.danger-text')!.click());await act(async()=>d.querySelector<HTMLButtonElement>('.evidence-footer .danger')!.click());assert.deepEqual(writes,['/api/captures/'+id]);assert.equal(d.querySelector('[role=dialog]'),null);assert.deepEqual(capture,before);
});
