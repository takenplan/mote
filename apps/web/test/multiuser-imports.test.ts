import test from 'node:test';
import assert from 'node:assert/strict';
import React,{act} from 'react';
import {JSDOM} from 'jsdom';
import {createServer} from 'node:http';
import {setTimeout as delay} from 'node:timers/promises';
import {configureLocale} from '@mote/shared/i18n';
import {defaultModelSettings} from '../../server/src/model-settings.js';
import {defaultMemorySettings} from '../../server/src/scope/memory-schema.js';
import {scopedFilesFixture} from '../../server/test/fixtures/scoped-files.js';
import {writeMessagesResponse} from '../../../scripts/fixtures/messages-provider.js';
import {Imports} from '../src/Imports.js';
import {createApi,type Api} from '../src/api.js';
import {importQueue} from '../src/import-queue.js';
configureLocale(()=> 'zh-CN');

test('original import form uploads private originals, confirms actual preview and retires A controls before equal-ID B',async t=>{
 const f=await scopedFilesFixture(t),bytes=Buffer.from('GENERATED_IMPORT_A_ORIGINAL'),requests:{path:string;method:string;session:string;status:number;body:string}[]=[];
 for(const account of [f.a,f.b]){const config=await f.checked(account.token,'/api/configuration');await f.checked(account.token,'/api/configuration/memory','PUT',{revision:config.revision,value:{...defaultMemorySettings(),automatic:false}});}
 let modelCalls=0;
 const provider=createServer((req,res)=>{void(async()=>{
  for await(const _ of req){};modelCalls++;
  if(modelCalls===1){writeMessagesResponse(res,{stage:modelCalls,tool:{name:'timeline',args:{limit:100}}});return;}
  const job=(await f.checked(f.a.token,'/api/imports')).items.find((job:any)=>job.name==='GENERATED_IMPORT_A');assert.ok(job);const file=job.files[0];
  const raw=await f.request(f.a.token,'/api/archived-files/'+file.id+'/content');assert.equal(raw.statusCode,200,raw.body);assert.deepEqual(raw.rawPayload,bytes);
  writeMessagesResponse(res,{stage:modelCalls,text:JSON.stringify({answer:JSON.stringify({summary:'GENERATED_PRIVATE_PREVIEW',warnings:[],reviewDecision:{confidence:'high',ambiguous:false,reason:'Generated explicit preview.'},records:[{item:{externalId:file.relativePath+':0',revision:file.hash,observedAt:new Date().toISOString(),title:file.name,text:raw.rawPayload.toString(),kind:'file',layer:'original',mimeType:file.mimeType,document:{fileId:file.id,path:file.relativePath,contentRole:'other',timeBasis:'unknown',originalMetadata:{}}},evidencePaths:[file.id],attachments:[]}]}),citationIds:[]})});
 })().catch(error=>{res.destroy(error);});});
 await new Promise<void>((resolve,reject)=>{provider.once('error',reject);provider.listen(0,'127.0.0.1',()=>{provider.removeListener('error',reject);resolve();});});
 t.after(()=>new Promise<void>(resolve=>provider.close(()=>resolve())));const address=provider.address();assert.ok(address&&typeof address!=='string');const providerOrigin='http://127.0.0.1:'+address.port;
 const config=await f.checked(f.a.token,'/api/configuration');await f.checked(f.a.token,'/api/configuration/models','PUT',{revision:config.revision,value:{profiles:[{id:'generated-import',name:'Generated import model',settings:{...defaultModelSettings(),provider:'custom',protocol:'anthropic-messages',model:'generated-import',baseUrl:providerOrigin+'/v1',apiKey:'GENERATED_IMPORT_A'}}],selections:{import:{kind:'personal',id:'generated-import'}}}});
 const dom=new JSDOM('<!doctype html><div id="root"></div>',{url:'http://localhost/#/library?view=imports',pretendToBeVisual:true}),before=new Map<string,PropertyDescriptor|undefined>(),originalFetch=globalThis.fetch;let cookie='',current:Api|undefined;
 const entries={window:dom.window,document:dom.window.document,HTMLElement:dom.window.HTMLElement,Event:dom.window.Event,IS_REACT_ACT_ENVIRONMENT:true,fetch:async(path:string,init:RequestInit={})=>{
  if(/^https?:/.test(String(path))){assert.equal(new URL(String(path)).origin,providerOrigin,'only generated external model I/O');return originalFetch(path,init);}
  const headers=new Headers(init.headers);headers.set('cookie',cookie);const payload=init.body instanceof ArrayBuffer?Buffer.from(init.body):init.body===undefined?undefined:String(init.body),r=await f.host.app.inject({url:path,method:init.method as any??'GET',headers:Object.fromEntries(headers),...(payload===undefined?{}:{payload})});
  requests.push({path,method:init.method??'GET',session:headers.get('x-mote-session-id')??'',status:r.statusCode,body:typeof payload==='string'?payload:''});return new Response(r.rawPayload,{status:r.statusCode,headers:r.headers as Record<string,string>});
 }};
 for(const [key,value]of Object.entries(entries)){before.set(key,Object.getOwnPropertyDescriptor(globalThis,key));Object.defineProperty(globalThis,key,{value,configurable:true,writable:true});}
 const {createRoot}=await import('react-dom/client'),root=createRoot(dom.window.document.getElementById('root')!),d=dom.window.document;
 t.after(async()=>{if(current){importQueue(current).close();current.close?.();}await act(async()=>root.unmount());for(const [key,value]of before){if(value)Object.defineProperty(globalThis,key,value);else Reflect.deleteProperty(globalThis,key);}dom.window.close();});
 const login=async(username:string)=>{const r=await f.request(undefined,'/api/auth/login','POST',{username,password:'Generated-joint-files-password',mode:'web'});assert.equal(r.statusCode,200,r.body);cookie=String(r.headers['set-cookie']).split(';')[0];const api=createApi({mode:'web',origin:'http://localhost',...r.json()},undefined,()=>current===api);if(current){importQueue(current).close();current.close?.();}current=api;return api;};
 const render=async(api:Api)=>act(async()=>{root.render(React.createElement(React.StrictMode,null,React.createElement(Imports,{api,onOpen:()=>{},onMemories:()=>{},onSettings:()=>{},onChanged:()=>{}})));await delay(20);});
 const wait=async(predicate:()=>boolean,label:string)=>{for(let n=0;n<1500&&!predicate();n++)await act(async()=>delay(10));assert.ok(predicate(),label+' '+d.body.textContent);};
 const button=(label:string)=>Array.from(d.querySelectorAll<HTMLButtonElement>('button')).find(button=>button.textContent===label),press=async(label:string)=>act(async()=>{const value=button(label);assert.ok(value,label+' '+d.body.textContent);value.click();await delay(20);});
 const edit=async(label:string,text:string)=>act(async()=>{const field=Array.from(d.querySelectorAll<HTMLLabelElement>('label')).find(value=>value.textContent?.startsWith(label))!.querySelector<HTMLInputElement|HTMLTextAreaElement>('input,textarea')!;const prototype=field.tagName==='TEXTAREA'?dom.window.HTMLTextAreaElement.prototype:dom.window.HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(prototype,'value')!.set!.call(field,text);field.dispatchEvent(new dom.window.Event('input',{bubbles:true}));await delay(10);});
 await render(await login('generated-a'));await wait(()=>!d.body.textContent!.includes('正在读取…'),'actual history loaded');
 const input=d.querySelector<HTMLInputElement>('input[aria-label="选择导入文件"]')!;await act(async()=>{Object.defineProperty(input,'files',{configurable:true,value:[new File([bytes],'generated-a.txt',{type:'text/plain'})]});input.dispatchEvent(new dom.window.Event('change',{bubbles:true}));await delay(10);});await edit('资料名称','GENERATED_IMPORT_A');await edit('格式、作者与归属说明','GENERATED_OWNER_INSTRUCTION');await press('加入导入队列');
 await wait(()=>Array.from(d.querySelectorAll<HTMLButtonElement>('.workspace-select')).some(button=>button.textContent?.includes('GENERATED_IMPORT_A')&&button.textContent.includes('等待你确认')),'actual private preview ready');
 const a=(await f.checked(f.a.token,'/api/imports')).items.find((job:any)=>job.name==='GENERATED_IMPORT_A');assert.ok(a);assert.equal(a.status,'awaiting_confirmation');assert.equal(a.progress.imported,0);assert.equal((await f.checked(f.a.token,'/api/captures')).items.length,0);assert.ok(requests.some(r=>r.path==='/api/import-uploads'&&r.status===200));assert.ok(requests.some(r=>r.path.includes('/parts/0')&&r.status===200));
 await act(async()=>{Array.from(d.querySelectorAll<HTMLButtonElement>('.workspace-select')).find(button=>button.textContent?.includes('GENERATED_IMPORT_A'))!.click();await delay(20);});assert.match(d.body.textContent!,/GENERATED_IMPORT_A_ORIGINAL/);const oldConfirm=button('确认并开始导入')!;assert.ok(oldConfirm);
 const created=await f.request(f.b.token,'/api/imports','POST',{requestId:a.id,name:'GENERATED_IMPORT_B',processing:'automatic',files:[{name:'generated-b.txt',mimeType:'text/plain',dataBase64:Buffer.from('GENERATED_IMPORT_B_ORIGINAL').toString('base64')}]});assert.equal(created.statusCode,202,created.body);
 await render(await login('generated-b'));await wait(()=>d.body.textContent!.includes('GENERATED_IMPORT_B')&&!d.body.textContent!.includes('GENERATED_IMPORT_A'),'equal-ID B own history');const sent=requests.filter(r=>r.method==='POST'&&r.path.endsWith('/confirm')).length;await act(async()=>{oldConfirm.click();await delay(20);});assert.equal(requests.filter(r=>r.method==='POST'&&r.path.endsWith('/confirm')).length,sent);assert.equal((await f.checked(f.a.token,'/api/imports/'+a.id)).status,'awaiting_confirmation');
 await render(await login('generated-a'));await wait(()=>d.body.textContent!.includes('GENERATED_IMPORT_A')&&!d.body.textContent!.includes('GENERATED_IMPORT_B'),'A preview restores from actual backend');await act(async()=>{Array.from(d.querySelectorAll<HTMLButtonElement>('.workspace-select')).find(button=>button.textContent?.includes('GENERATED_IMPORT_A'))!.click();await delay(20);});await press('确认并开始导入');await wait(()=>d.body.textContent!.includes('记录已保存到中央归档'),'actual explicit confirmation completes');const done=await f.checked(f.a.token,'/api/imports/'+a.id);assert.equal(done.progress.imported,1);assert.equal(done.captureIds.length,1);assert.equal((await f.checked(f.b.token,'/api/imports/'+a.id)).name,'GENERATED_IMPORT_B');
});
