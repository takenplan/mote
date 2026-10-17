import test from 'node:test';
import assert from 'node:assert/strict';
import {createApi,apiOwnerKey,type WebConnection} from '../src/api.js';
import {loginWeb,logoutWeb,discoverWebSession,authChangeKey} from '../src/web-auth.js';
import {NoteOutbox} from '../src/notes-state.js';
import {submitWebNote} from '../src/web-notes.js';
const origin='https://fixture.invalid';
const identity=(owner='a',credential='session-'+owner):WebConnection=>({mode:'web',origin,deploymentId:'same-deployment',userId:owner,credentialId:credential,csrfToken:'generated-csrf-'+owner,username:owner,administrator:false});
function globals(t:any){
 const before=new Map<string,PropertyDescriptor|undefined>();const values=new Map<string,string>();
 const storage={get length(){return values.size;},key:(i:number)=>[...values.keys()][i]??null,getItem:(key:string)=>values.get(key)??null,setItem:(key:string,value:string)=>values.set(key,value),removeItem:(key:string)=>values.delete(key)};
 for(const [key,value] of Object.entries({location:{origin},localStorage:storage,sessionStorage:storage})){before.set(key,Object.getOwnPropertyDescriptor(globalThis,key));Object.defineProperty(globalThis,key,{value,configurable:true});}
 t.after(()=>{for(const [key,value] of before){if(value)Object.defineProperty(globalThis,key,value);else Reflect.deleteProperty(globalThis,key);}});return storage;
}
test('Web login uses actual M01 contract and discovers account without persisting password, bearer or CSRF',async t=>{
 const storage=globals(t),calls:any[]=[];
 t.mock.method(globalThis,'fetch',async(path:unknown,init?:RequestInit)=>{calls.push([path,init]);assert.equal(new Headers(init?.headers).get('X-Mote-Protocol-Version'),'2');assert.equal(init?.credentials,'same-origin');return Response.json(path==='/api/auth/login'?{userId:'a',deploymentId:'same-deployment',credentialId:'session-a'}:identity());});
 const session=await loginWeb('a','generated-password-only',86400000);assert.equal(session.userId,'a');
 assert.equal(JSON.parse(calls[0][1].body).mode,'web');assert.deepEqual(calls.map(([path])=>path),['/api/auth/login','/api/auth/self']);
 const persisted=JSON.stringify([...Array(storage.length)].map((_,i)=>storage.getItem(storage.key(i)!)));
 assert.doesNotMatch(persisted,/password|csrf|session-a|Bearer/);assert.ok(storage.getItem(authChangeKey));
});
test('a login cannot overtake a pending logout Cookie response',async t=>{
 globals(t);let release!:(value:Response)=>void;const calls:string[]=[];
 t.mock.method(globalThis,'fetch',async(path:unknown)=>{calls.push(String(path));if(path==='/api/auth/logout')return new Promise<Response>(resolve=>{release=resolve;});return Response.json(path==='/api/auth/login'?{userId:'b',deploymentId:'same-deployment',credentialId:'session-b'}:identity('b'));});
 const logout=logoutWeb(identity()),login=loginWeb('b','generated-password-b',0);
 await new Promise(resolve=>setImmediate(resolve));assert.deepEqual(calls,['/api/auth/logout']);
 release(Response.json({revoked:true}));await logout;assert.equal((await login).userId,'b');assert.deepEqual(calls,['/api/auth/logout','/api/auth/login','/api/auth/self']);
});
test('draft and outbox identity survive same-account rotation, and separate same IDs across account/deployment',t=>{
 const storage=globals(t),a=createApi(identity()),rotated=createApi(identity('a','session-rotated')),b=createApi(identity('b')),other=createApi({...identity(),deploymentId:'other-deployment'});
 const draft={text:'Generated A draft',mood:''};new NoteOutbox(storage,apiOwnerKey(a)).saveDraft(draft);
 assert.deepEqual(new NoteOutbox(storage,apiOwnerKey(rotated)).draft(),draft);
 for(const api of [b,other])assert.deepEqual(new NoteOutbox(storage,apiOwnerKey(api)).draft(),{text:'',mood:''});
});
test('old tab self discovery cannot verify a replacement Cookie under its old API identity',async t=>{
 globals(t);let invalid=0;t.mock.method(globalThis,'fetch',async()=>Response.json(identity('b')));
 await assert.rejects(createApi(identity(),()=>invalid++).request('/api/auth/self'),/登录会话/);assert.equal(invalid,1);
});
test('note adapter retains event IDs through actual protocol requests and checks owner receipt',async t=>{
 globals(t);const calls:any[]=[];
 t.mock.method(globalThis,'fetch',async(path:unknown,init?:RequestInit)=>{calls.push([path,init]);return Response.json({userId:'a',deploymentId:'same-deployment',captures:[{id:'d342bfa0-55f9-43df-80e7-f06eb0fbb68d'}]});});
 const note={id:'d342bfa0-55f9-43df-80e7-f06eb0fbb68d',deviceId:'same-device',deviceName:'Generated web',platform:'import' as const,client:'web' as const,capturedAt:'2026-10-16T12:00:00Z',text:'Generated A note'};
 assert.equal((await submitWebNote(createApi(identity()),note)).id,note.id);assert.equal(calls.length,3);
 assert.equal(JSON.parse(calls[2][1].body).items[0].id,note.id);for(const [,init] of calls)assert.equal(new Headers(init.headers).get('X-Mote-Ingress-Version'),'3');
});
