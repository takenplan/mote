import test from 'node:test';
import assert from 'node:assert/strict';
import React,{act} from 'react';
import {JSDOM} from 'jsdom';
import {createHash} from 'node:crypto';
import {setTimeout as delay} from 'node:timers/promises';
import {configureLocale} from '@mote/shared/i18n';
import {scopedFilesFixture} from '../../server/test/fixtures/scoped-files.js';
import {createApi,type Api} from '../src/api.js';
import {FileDetail} from '../src/Files.js';

configureLocale(()=> 'zh-CN');
const nativeFetch=globalThis.fetch;
const gate=()=>{let resolve!:()=>void;return {promise:new Promise<void>(done=>{resolve=done;}),resolve:()=>resolve()};};

// Declared M13 5cb Files consumer + accepted parser caf. This is the original
// FileDetail and real HTTP/Accounts/M03/SQLite; only a committed ACK is held.
test('original FileDetail offers a fresh action for a same-owner replacement after the prior DELETE success arrives late',async t=>{
 const entered=gate(),release=gate();let held=false,id='',expectedCookie='';const deletes:{body:any;receipt:any}[]=[];
 t.after(()=>release.resolve());
 const f=await scopedFilesFixture(t,host=>host.app.addHook('onSend',async(request,reply,payload)=>{
  if(id&&request.method==='DELETE'&&request.url==='/api/files/'+id&&request.headers.cookie===expectedCookie&&reply.statusCode===200){deletes.push({body:request.body,receipt:JSON.parse(String(payload))});if(!held){held=true;entered.resolve();await release.promise;}}
  return payload;
 }));
 await f.host.app.listen({host:'127.0.0.1',port:0});const address=f.host.app.server.address();assert.ok(address&&typeof address!=='string');const origin='http://127.0.0.1:'+address.port,protocol={'x-mote-protocol-version':'2','x-mote-ingress-version':'3'};
 const request=(token:string,path:string,method='GET',body?:unknown)=>nativeFetch(origin+path,{method,headers:{...protocol,authorization:'Bearer '+token,...(body===undefined?{}:{'content-type':'application/json'})},...(body===undefined?{}:{body:JSON.stringify(body)})});
 const ok=async(token:string,path:string,method='GET',body?:unknown)=>{const response=await request(token,path,method,body);assert.equal(response.status,200,await response.clone().text());return response.json() as Promise<any>;};
 const upload=async(token:string,text:string,title:string)=>{
  const bytes=Buffer.from(text),checksum=createHash('sha256').update(bytes).digest('hex');
  const value=await ok(token,'/api/ingress/sources/same-source/uploads','POST',{batchId:'same-batch',revision:{sourceId:'same-source',previousRevision:null,item:{externalId:'same-file',revision:'same-r1',observedAt:'2026-10-17T00:00:00Z',title,text:'',kind:'file',layer:'original',mimeType:'text/plain'},sizeBytes:bytes.length,sha256:checksum,relativePath:'generated.txt'}});
  await ok(token,'/api/ingress/uploads/'+value.id+'/parts/0','PUT',{bytes:bytes.toString('base64'),checksum});return (await ok(token,'/api/ingress/uploads/'+value.id+'/commit','POST',{})).captures[0];
 };
 const a=await upload(f.a.token,'GENERATED_A_OLD_BYTES','GENERATED_A_OLD_FILE'),b=await upload(f.b.token,'GENERATED_B_UNCHANGED_BYTES','GENERATED_B_FILE');assert.equal(a.id,b.id);id=a.id;
 const login=await nativeFetch(origin+'/api/auth/login',{method:'POST',headers:{...protocol,'content-type':'application/json'},body:JSON.stringify({username:'generated-a',password:'Generated-joint-files-password',mode:'web'})});assert.equal(login.status,200);expectedCookie=login.headers.get('set-cookie')!.split(';')[0];const session=await login.json() as any;
 const dom=new JSDOM('<!doctype html><div id="root"></div>',{url:origin+'/#/library',pretendToBeVisual:true}),prior=new Map<string,PropertyDescriptor|undefined>();let api:Api|undefined,root:ReturnType<(typeof import('react-dom/client'))['createRoot']>|undefined;
 for(const [key,value]of Object.entries({window:dom.window,document:dom.window.document,localStorage:dom.window.localStorage,HTMLElement:dom.window.HTMLElement,Event:dom.window.Event,IS_REACT_ACT_ENVIRONMENT:true,fetch:async(path:string,init:RequestInit={})=>{const headers=new Headers(init.headers);headers.set('cookie',expectedCookie);return nativeFetch(new URL(path,origin),{...init,headers});}})){prior.set(key,Object.getOwnPropertyDescriptor(globalThis,key));Object.defineProperty(globalThis,key,{value,configurable:true,writable:true});}
 try{
  const {createRoot}=await import('react-dom/client');root=createRoot(dom.window.document.getElementById('root')!);api=createApi({mode:'web',origin,...session});
  const d=dom.window.document,button=(label:string)=>Array.from(d.querySelectorAll<HTMLButtonElement>('button')).find(value=>value.textContent===label),wait=async(check:()=>boolean,label:string)=>{const end=Date.now()+5000;while(!check()&&Date.now()<end)await act(async()=>delay(10));assert.ok(check(),label+' '+d.body.textContent);},press=async(label:string)=>act(async()=>{const control=button(label);assert.ok(control,label+' '+d.body.textContent);control.click();await delay(10);});
  await act(async()=>{root!.render(React.createElement(FileDetail,{api:api!,id,onOpen:()=>{}}));await delay(10);});await wait(()=>!!button('删除中央归档'),'original forget entry');
  await press('删除中央归档');assert.equal(deletes.length,0);await press('确认删除归档');await entered.promise;
  const path='/api/files/'+id;assert.equal((await request(f.a.token,path)).status,404);const forgotten=await ok(f.a.token,path+'/forgotten');await ok(f.a.token,path+'/allow-again','POST',forgotten.decision);
  await ok(f.a.token,'/api/sources/same-source','DELETE',{});await ok(f.a.token,'/api/ingress/sources','POST',{id:'same-source',name:'Generated replacement source',kind:'local-files',deviceId:'same-device',platform:'import',retention:'archive'});
  const replacement=await upload(f.a.token,'GENERATED_A_NEW_BYTES','GENERATED_A_NEW_FILE');assert.equal(replacement.id,id);const current=await ok(f.a.token,path);assert.ok(current.originalGeneration>deletes[0].body.originalGeneration);
  assert.equal((await request(f.b.token,path)).status,200);assert.equal(deletes[0].receipt.decision.generation,deletes[0].body.originalGeneration+1);
  console.info(JSON.stringify({contract:'file-detail-late-delete',requestGeneration:deletes[0].body.originalGeneration,replacementGeneration:current.originalGeneration,receiptGeneration:deletes[0].receipt.decision.generation}));
  // Keep the same Api, route, FileDetail and capture ID. The real late callback
  // invalidates its resource, so the actual HTTP GET reads the new descriptor.
  release.resolve();await wait(()=>d.querySelector('h3')?.textContent==='GENERATED_A_NEW_FILE','replacement descriptor after the actual late ACK');
  assert.equal((await request(f.a.token,path)).status,200);assert.equal((await request(f.b.token,path)).status,200);
  assert.ok(button('删除中央归档'),'the new incarnation must offer its own explicit action, rather than retain the old deleted receipt: '+d.body.textContent);
  assert.ok(!d.body.textContent!.includes('中央归档已删除。'),'a successful old receipt cannot label the current replacement deleted');
  await press('删除中央归档');assert.equal(deletes.length,1,'opening the replacement confirmation sends nothing');await press('确认删除归档');await wait(()=>deletes.length===2,'fresh current-generation deletion');
  assert.equal(deletes[1].body.originalGeneration,current.originalGeneration);assert.notEqual(deletes[1].body.operationId,deletes[0].body.operationId);
  await wait(()=>!d.querySelector('h3')&&d.body.textContent!.includes('中央归档已删除。'),'fresh deletion reaches the real missing-detail receipt state');
  await act(async()=>{assert.equal((await request(f.a.token,path)).status,404);assert.equal((await request(f.b.token,path)).status,200);await delay(10);});
 }finally{
  release.resolve();if(root)await act(async()=>root!.unmount());api?.close?.();for(const [key,value]of prior){if(value)Object.defineProperty(globalThis,key,value);else Reflect.deleteProperty(globalThis,key);}dom.window.close();
 }
});
