import test from 'node:test';
import assert from 'node:assert/strict';
import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import {JSDOM} from 'jsdom';
import {configureLocale} from '@mote/shared/i18n';
import type {CaptureTimelineGroup,CaptureTimelineMember,CaptureTimelinePage} from '@mote/shared';
import {LibraryTimeline} from '../src/LibraryTimeline.js';
import {ApiError,type Api} from '../src/api.js';
import {resources} from '../src/resource-cache.js';
configureLocale(()=> 'zh-CN');
const id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',other='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const originalAt='2026-10-28T23:59:00.000Z',firstAt='2026-10-29T00:00:10.000Z',lastAt='2026-10-29T00:00:20.000Z';
const member=(value=id):CaptureTimelineMember=>({record:{id:value,deviceId:'generated',deviceName:'Generated Mac',platform:'macos',capturedAt:originalAt,source:'activity',appName:'Generated actual app',windowTitle:'Generated literal record',durationMs:2000,hasImage:false,ocr:{status:'not_applicable'},textPreview:'Generated literal evidence'},firstAt,lastAt,sampleCount:2});
const group=(patch:Partial<CaptureTimelineGroup>={}):CaptureTimelineGroup=>({type:'group',id:'opaque-exact-group',kind:'source',source:'activity',deviceId:'generated',deviceName:'Generated Mac',day:'2026-10-29',firstAt,lastAt,recordCount:71,imageCount:0,sampleCount:null,...patch});
const page=(items:CaptureTimelinePage['items']=[group()],nextCursor:string|null=null):CaptureTimelinePage=>({revision:'exact-revision',items,nextCursor});
const members=(g=group(),items=[member()],nextCursor:string|null=null)=>({revision:'exact-revision',group:g,items,nextCursor});
const apiWith=(request:(path:string,init?:RequestInit)=>unknown)=>({request:async(path:string,init?:RequestInit)=>request(path,init)}) as Api;
const buttons=(d:Document,label:string,scope:ParentNode=d)=>[...scope.querySelectorAll<HTMLButtonElement>('button')].filter(b=>b.textContent===label);
const deferred=()=>{let resolve!:(value:unknown)=>void;return {promise:new Promise<unknown>(done=>resolve=done),resolve:(value:unknown)=>resolve(value)};};
async function fixture(t:any){const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost/#/library?view=records',pretendToBeVisual:true}),previous=new Map();for(const [key,value]of Object.entries({window:dom.window,document:dom.window.document,HTMLElement:dom.window.HTMLElement,IS_REACT_ACT_ENVIRONMENT:true})){previous.set(key,Object.getOwnPropertyDescriptor(globalThis,key));Object.defineProperty(globalThis,key,{value,configurable:true,writable:true});}const root=createRoot(dom.window.document.getElementById('root')!);t.after(async()=>{await act(async()=>root.unmount());for(const [key,value]of previous)if(value)Object.defineProperty(globalThis,key,value);else Reflect.deleteProperty(globalThis,key);dom.window.close();});return {root,d:dom.window.document,w:dom.window};}
const view=(api:Api,onOpen:(ref:string)=>void=()=>{},revision=0)=>React.createElement(LibraryTimeline,{api,devices:[{deviceId:'generated',deviceName:'Generated Mac',platform:'macos',status:'capturing',queueDepth:0,lastSeenAt:firstAt}],onOpen,revision});
async function open(d:Document,w:any){await act(async()=>{const details=d.querySelector<HTMLDetailsElement>('.library-time-group')!;details.open=true;details.dispatchEvent(new w.Event('toggle'));});}
async function change(d:Document,w:any,label:string,value:string){await act(async()=>{const el=d.querySelector<HTMLInputElement|HTMLSelectElement>('[aria-label="'+label+'"]')!;el.value=value;el.dispatchEvent(new w.Event('change',{bubbles:true}));});}

test('full host counts stay truthful while a folded group lazily pages exact projected members',async t=>{
 const {root,d,w}=await fixture(t),paths:string[]=[],opened:string[]=[];
 const api=apiWith(path=>{paths.push(path);return path.startsWith('/api/capture-browser/timeline/members?')?members(group(),[member(path.includes('cursor=')?other:id)],path.includes('cursor=')?null:'member-page-2'):page();});
 await act(async()=>root.render(view(api,ref=>opened.push(ref))));
 assert.equal(d.querySelector('details')!.open,false);assert.equal(paths.length,1);assert.match(d.querySelector('.library-time-count')!.textContent!,/71 条记录/);assert.doesNotMatch(d.querySelector('.library-time-count')!.textContent!,/样本/);
 await open(d,w);let query=new URL('http://localhost'+paths.at(-1)).searchParams;assert.equal(query.get('group'),'opaque-exact-group');assert.ok(query.get('timeZone'));assert.ok(query.get('after'));assert.ok(query.get('before'));
 const projected=new Date(firstAt).toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit',hour12:false});assert.ok(d.querySelector('.library-time-observation time')!.textContent!.startsWith(projected));
 await act(async()=>d.querySelector<HTMLButtonElement>('.library-time-observation')!.click());assert.deepEqual(opened,['capture:'+id]);
 await act(async()=>buttons(d,'下一页',d.querySelector('.library-time-member-pagination')!)[0]!.click());query=new URL('http://localhost'+paths.at(-1)).searchParams;assert.equal(query.get('cursor'),'member-page-2');assert.equal(query.get('group'),'opaque-exact-group');assert.match(d.querySelector('.library-time-member-pagination')!.textContent!,/第 2 页/);
 await act(async()=>d.querySelector<HTMLButtonElement>('.library-time-observation')!.click());assert.deepEqual(opened,['capture:'+id,'capture:'+other]);
});

test('dated projection identities never become original IDs and known samples use the host total',async t=>{
 const {root,d}=await fixture(t),opened:string[]=[];
 const note={...member(),record:{...member().record,source:'note' as const,windowTitle:'',appName:'随手记',textPreview:'Generated literal note title'}};
 const api=apiWith(()=>page([{type:'record',id:'signed-day-row-not-a-uuid',day:'2026-10-29',...note},group({id:'known-count',sampleCount:305,recordCount:71})]));
 await act(async()=>root.render(view(api,ref=>opened.push(ref))));await act(async()=>d.querySelector<HTMLButtonElement>('.library-time-record')!.click());assert.deepEqual(opened,['capture:'+id]);assert.equal(d.querySelector('.library-time-record strong')!.textContent,'Generated literal note title');assert.equal(d.querySelector('.library-time-record')!.getAttribute('data-reference'),'capture:'+id);assert.match(d.querySelector('.library-time-count')!.textContent!,/305 个样本/);assert.match(d.querySelector('.library-time-count')!.textContent!,/71 条记录/);
});

test('all filters remain scoped and new filters or owners cannot send a prior cursor or publish a late group',async t=>{
 const {root,d,w}=await fixture(t),paths:string[]=[],late=deferred();let lateSignal:AbortSignal|undefined;
 const api=apiWith((path,init)=>{paths.push(path);if(path.includes('cursor=')){lateSignal=init?.signal as AbortSignal;return late.promise;}return page([], 'old-page-2');});
 await act(async()=>root.render(view(api)));await act(async()=>buttons(d,'下一页')[0]!.click());
 await change(d,w,'筛选设备','generated');assert.equal(lateSignal?.aborted,true);let query=new URL('http://localhost'+paths.at(-1)).searchParams;assert.equal(query.get('deviceId'),'generated');assert.equal(query.has('cursor'),false);
 await change(d,w,'筛选记录来源','screen');await change(d,w,'筛选采集级别','content');await change(d,w,'筛选 OCR 状态','completed');
 // React text inputs use the input event, exercised by the real browser journey; set the controlled state through its native event here too.
 const app=d.querySelector<HTMLInputElement>('[aria-label="应用标识"]')!;await act(async()=>{Object.getOwnPropertyDescriptor(w.HTMLInputElement.prototype,'value')!.set!.call(app,'generated.app');app.dispatchEvent(new w.Event('input',{bubbles:true}));});
 query=new URL('http://localhost'+paths.at(-1)).searchParams;assert.equal(query.get('deviceId'),'generated');assert.equal(query.get('source'),'screen');assert.equal(query.get('collection'),'content');assert.equal(query.get('ocrStatus'),'completed');
 const nextPaths:string[]=[],nextApi=apiWith(path=>{nextPaths.push(path);return page();});await act(async()=>root.render(view(nextApi)));assert.ok(nextPaths.length);assert.ok(nextPaths.every(path=>!new URL('http://localhost'+path).searchParams.has('cursor')));assert.ok(nextPaths.every(path=>!new URL('http://localhost'+path).searchParams.has('deviceId')));
 await act(async()=>late.resolve(page([group({id:'old-owner',deviceName:'STALE OWNER'})])));assert.doesNotMatch(d.body.textContent!,/STALE OWNER/);
});

test('a changed or forbidden group withdraws its members; explicit reload keeps the same scope and never chooses another group',async t=>{
 const {root,d,w}=await fixture(t),paths:string[]=[];let failure=0;const pending=deferred();
 const api=apiWith(path=>{paths.push(path);if(path.includes('/members?')){if(failure)throw new ApiError('changed',failure,'changed');return members();}if(failure===409)return pending.promise;return page();});
 await act(async()=>root.render(view(api)));await change(d,w,'筛选设备','generated');await open(d,w);assert.ok(d.querySelector('.library-time-observation'));
 const memberPath=paths.at(-1)!;failure=503;await act(async()=>resources(api).get(memberPath).refresh());assert.ok(d.querySelector('.library-time-observation'),'a transient read failure retains this exact known group');
 failure=409;await act(async()=>resources(api).get(memberPath).refresh());assert.equal(d.querySelector('.library-time-observation'),null);assert.match(d.body.textContent!,/重新读取当前范围/);
 await act(async()=>d.querySelector<HTMLButtonElement>('.library-time-members [role="alert"] button')!.click());assert.equal(d.querySelector('.library-time-group')!.hasAttribute('open'),false);const query=new URL('http://localhost'+paths.at(-1)).searchParams;assert.equal(query.get('deviceId'),'generated');assert.equal(query.has('group'),false);assert.equal(query.has('cursor'),false);
 await act(async()=>pending.resolve(page([group({id:'new-signed-group'})])));assert.equal(d.querySelector('.library-time-group')!.getAttribute('data-group-id'),'new-signed-group');assert.equal(d.querySelector('.library-time-group')!.hasAttribute('open'),false);
});

test('wrong group identity or revision never publishes members; denied top-level data stays withdrawn through a slow retry',async t=>{
 const {root,d,w}=await fixture(t),paths:string[]=[];let wrong=true,wrongRevision=false,denied=false,slow=false;const pending=deferred();
 const api=apiWith(path=>{paths.push(path);if(path.includes('/members?'))return {...members(),revision:wrongRevision?'stale-revision':'exact-revision',group:group({id:wrong?'different-group':'opaque-exact-group'})};if(denied)throw new ApiError('denied',403,'denied');if(slow)return pending.promise;return page();});
 await act(async()=>root.render(view(api)));await open(d,w);assert.equal(d.querySelector('.library-time-observation'),null);assert.match(d.body.textContent!,/当前不可用/);
 wrong=false;wrongRevision=true;await act(async()=>resources(api).get(paths.find(path=>path.includes('/members?'))!).refresh());assert.equal(d.querySelector('.library-time-observation'),null,'exact group with stale revision still cannot display members');wrongRevision=false;await act(async()=>resources(api).get(paths.find(path=>path.includes('/members?'))!).refresh());assert.ok(d.querySelector('.library-time-observation'));
 denied=true;const first=paths[0]!;await act(async()=>resources(api).get(first).refresh());assert.equal(d.querySelector('.library-time-group'),null);
 denied=false;slow=true;await act(async()=>resources(api).get(first).refresh());assert.equal(d.querySelector('.library-time-group'),null,'a retry cannot redisplay withdrawn evidence before its response');await act(async()=>pending.resolve(page()));assert.ok(d.querySelector('.library-time-group'));
});

test('real Central grouping reaches the exact original and returning keeps the opened member page',async t=>{
 const {root,d,w}=await fixture(t);
 const {buildApp}=await import('../../server/src/app.js'),{Archive}=await import('../src/Archive.js'),{featuresReady}=await import('../src/features/bootstrap.js');await featuresReady;
 const {mkdtempSync,rmSync}=await import('node:fs'),{join}=await import('node:path'),{tmpdir}=await import('node:os');
 const directory=mkdtempSync(join(tmpdir(),'mote-timeline-consumer-')),token='generated-timeline-consumer-owner-123456';
 const node=await buildApp({dataDir:directory,token,tokenPath:'fixture',host:'127.0.0.1',port:0,maxStorageBytes:3_000_000,maxExportBytes:1_000_000,retentionDays:0,insightIntervalHours:0,allowedOrigins:[],model:'',modelBaseUrl:'',apiKey:'',allowUnauthenticatedLocal:false,embeddingModel:'',embeddingBaseUrl:'',embeddingApiKey:''},{backgroundWorker:false,agent:{configured:false,query:async()=>{throw Error('No models in timeline consumer regression');},close:async()=>{}}});
 t.after(async()=>{await node.app.close();rmSync(directory,{recursive:true,force:true});});
 const headers={authorization:'Bearer '+token,'x-mote-ingress-version':'2'};
 for(let index=0;index<25;index++){const at=new Date();at.setHours(10,0,index,0);const response=await node.app.inject({method:'POST',url:'/api/captures',headers,payload:{id:crypto.randomUUID(),deviceId:'generated',deviceName:'Generated Mac',platform:'macos',capturedAt:at.toISOString(),durationMs:1000,appId:'generated.app',appName:'Generated exact activity '+index,windowTitle:'',source:'activity',ocrText:'',metadata:{version:1,observedAt:at.toISOString()},privacy:{collection:'activity',mode:'none'}}});assert.equal(response.statusCode,201,response.body);}
 const paths:string[]=[],api=apiWith(async path=>{paths.push(path);const response=await node.app.inject({url:path,headers});assert.equal(response.statusCode,200,response.body);return response.json();});
 const priorLocation=Object.getOwnPropertyDescriptor(globalThis,'location'),priorStorage=Object.getOwnPropertyDescriptor(globalThis,'localStorage');Object.defineProperty(globalThis,'location',{value:w.location,configurable:true});Object.defineProperty(globalThis,'localStorage',{value:w.localStorage,configurable:true});t.after(()=>{for(const [key,prior]of [['location',priorLocation],['localStorage',priorStorage]] as const)if(prior)Object.defineProperty(globalThis,key,prior);else Reflect.deleteProperty(globalThis,key);});
 const props={api,devices:[],range:{},activity:{apps:[],devices:[],totalDurationMs:0,captures:0},revision:0,onOpen:()=>{},tab:'records',setTab:()=>{}};
 await act(async()=>root.render(React.createElement(Archive,props)));assert.match(d.querySelector('.library-time-count')!.textContent!,/25 条记录/);await open(d,w);assert.equal(d.querySelectorAll('.library-time-observation').length,24);
 await act(async()=>buttons(d,'下一页',d.querySelector('.library-time-member-pagination')!)[0]!.click());assert.equal(d.querySelectorAll('.library-time-observation').length,1);
 const opener=d.querySelector<HTMLButtonElement>('.library-time-observation')!,exact=opener.getAttribute('data-reference')!;opener.focus();await act(async()=>opener.click());assert.ok(paths.includes('/api/capture-browser/'+exact.slice(8)));assert.ok(d.querySelector('.library-master')!.hasAttribute('hidden'));assert.match(d.querySelector('.library-detail')!.textContent!,/Generated exact activity/);
 await act(async()=>buttons(d,'返回资料列表')[0]!.click());assert.equal(d.querySelector('.library-time-group')!.hasAttribute('open'),true);assert.match(d.querySelector('.library-time-member-pagination')!.textContent!,/第 2 页/);assert.equal(d.activeElement,opener);assert.equal(d.querySelector('.library-time-observation')!.getAttribute('data-reference'),exact);
});


test('unknown protocol failures remain readable by default and retain complete explicit diagnostics',async t=>{const {root,d}=await fixture(t);const api=apiWith(()=>{throw new ApiError('Internal protocol secret_fixture_code',503,'generated-request-id','unrecognized_fixture_read');});await act(async()=>root.render(view(api)));const alert=d.querySelector('[role="alert"]')!;assert.match(alert.querySelector('span')!.textContent!,/中央服务暂不可用/);assert.doesNotMatch(alert.textContent!,/secret_fixture_code|unrecognized_fixture_read/);const diagnostics=d.querySelector<HTMLDetailsElement>('.library-time-failure details')!;assert.equal(diagnostics.open,false);assert.match(diagnostics.textContent!,/503/);assert.match(diagnostics.textContent!,/unrecognized_fixture_read/);assert.match(diagnostics.textContent!,/generated-request-id/);});
