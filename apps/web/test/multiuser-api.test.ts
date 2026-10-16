import test from 'node:test';
import assert from 'node:assert/strict';
import {createApi, type Connection} from '../src/api.js';

const connection=()=>({mode:'web',origin:'https://fixture.invalid',deploymentId:'deployment-fixture',userId:'user-a',credentialId:'session-a',csrfToken:'generated-csrf',username:'alice',administrator:false,expiresAt:Date.now()+60000} as unknown as Connection);
test('Web API pins Cookie requests to the original session with protocol and CSRF; callers cannot replace authority',async t=>{
 const calls:RequestInit[]=[];
 t.mock.method(globalThis,'fetch',async(_path:unknown,init?:RequestInit)=>{calls.push(init!);return Response.json({ok:true});});
 const api=createApi(connection());
 await api.request('/api/notes',{method:'POST',body:'{}',headers:{Authorization:'Bearer attacker','X-Mote-Session-Id':'session-b','X-Mote-CSRF':'other'}});
 const sent=new Headers(calls[0].headers);
 assert.equal(calls[0].credentials,'same-origin');assert.equal(sent.has('Authorization'),false);
 assert.equal(sent.get('X-Mote-Protocol-Version'),'2');assert.equal(sent.get('X-Mote-Session-Id'),'session-a');assert.equal(sent.get('X-Mote-CSRF'),'generated-csrf');
});
test('a retired API refuses a held submit before fetch, and rejects a successful old response',async t=>{
 let current=true,calls=0,deliver!:(value:Response)=>void;
 t.mock.method(globalThis,'fetch',()=>{calls++;return new Promise<Response>(resolve=>{deliver=resolve;});});
 const api=createApi(connection(),undefined,()=>current);
 const pending=api.request('/api/notes');const rejected=assert.rejects(pending,/session|登录/i);
 current=false;deliver(Response.json({items:[{id:'same-id',text:'A private'}]}));await rejected;
 await assert.rejects(api.request('/api/notes',{method:'POST',body:'{"text":"A draft"}'}),/session|登录/i);assert.equal(calls,1);
});
test('the JSON body await is also fenced and mutable caller credentials cannot retarget an API',async t=>{
 let current=true,body!:(value:unknown)=>void,session='';
 t.mock.method(globalThis,'fetch',async(_path:unknown,init?:RequestInit)=>{session=new Headers(init?.headers).get('X-Mote-Session-Id')!;const response=Response.json({});response.json=()=>new Promise(resolve=>{body=resolve;});return response;});
 const input=connection(),api=createApi(input,undefined,()=>current);
 (input as any).credentialId='session-b';
 const pending=api.request('/api/notes');const rejected=assert.rejects(pending,/session|登录/i);
 await new Promise(resolve=>setImmediate(resolve));assert.equal(session,'session-a');current=false;body({text:'A late body'});await rejected;
});
