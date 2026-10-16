import test,{type TestContext} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,readFileSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {buildApp} from '../src/app.js';
import {defaultModelSettings,defaultModelDomain} from '../src/model-settings.js';
import {createApi,type WebConnection} from '../../web/src/api.js';
import {submitWebNote} from '../../web/src/web-notes.js';

const password='Generated-M13-HTTP-password-01',protocol={'x-mote-protocol-version':'2'};
async function fixture(t:TestContext){
 const directory=mkdtempSync(join(tmpdir(),'mote-m13-http-')),host=await buildApp({dataDir:directory});
 t.after(async()=>{await host.app.close();rmSync(directory,{recursive:true,force:true});});
 await host.accounts!.initialize('generated-admin',password);
 const login=async(username:string,mode='web')=>{const r=await host.app.inject({method:'POST',url:'/api/auth/login',headers:protocol,payload:{username,password,mode}});assert.equal(r.statusCode,200,r.body);return {r,...r.json()};};
 const admin=await login('generated-admin','client');
 for(const username of ['generated-a','generated-b']){const r=await host.app.inject({method:'POST',url:'/api/admin/accounts',headers:{...protocol,authorization:'Bearer '+admin.token},payload:{username,password}});assert.equal(r.statusCode,200,r.body);}
 const a=await login('generated-a'),b=await login('generated-b');let cookie=String(a.r.headers['set-cookie']).split(';')[0];
 const info=async(grant:any):Promise<WebConnection>=>{
  const r=await host.app.inject({url:'/api/auth/self',headers:{...protocol,cookie:String(grant.r.headers['set-cookie']).split(';')[0]}});assert.equal(r.statusCode,200,r.body);
  return {...r.json(),mode:'web',origin:'http://localhost',viewScope:grant.credentialId};
 };
 t.mock.method(globalThis,'fetch',async(path:unknown,init?:RequestInit)=>{
  const headers=Object.fromEntries(new Headers(init?.headers));headers.cookie=cookie;
  const r=await host.app.inject({method:(init?.method??'GET') as any,url:String(path),headers,...(init?.body?{payload:JSON.parse(String(init.body))}:{})});
  return new Response(r.body,{status:r.statusCode,headers:r.headers as Record<string,string>});
 });
 const ai=await info(a),bi=await info(b);
 return {directory,host,admin,a,b,ai,bi,login,api:()=>createApi(ai),cookie:(owner:'a'|'b')=>{cookie=String((owner==='a'?a:b).r.headers['set-cookie']).split(';')[0];}};
}

test('actual Web Api and production Cookie resolver keep equal note IDs private and stale tab mutations fail before changing B',async t=>{
 const f=await fixture(t),id='6d477b3e-fb43-4657-818d-c143ad76430f',note={id,deviceId:'same-device',deviceName:'Generated web',platform:'import' as const,client:'web' as const,capturedAt:'2026-10-16T12:00:00Z',text:'GENERATED_A_WEB_NOTE'};
 const a=f.api();await submitWebNote(a,note);
 assert.match(JSON.stringify(await a.request('/api/captures?kind=note')),/GENERATED_A_WEB_NOTE/);
 f.cookie('b');const b=createApi(f.bi);await submitWebNote(b,{...note,text:'GENERATED_B_WEB_NOTE'});
 const bBefore=JSON.stringify(await b.request('/api/captures?kind=note'));
 assert.match(bBefore,/GENERATED_B_WEB_NOTE/);assert.doesNotMatch(bBefore,/GENERATED_A_WEB_NOTE/);
 await assert.rejects(a.request('/api/captures/'+id,{method:'DELETE'}),error=>(error as any).code==='session_changed');
 assert.equal(JSON.stringify(await b.request('/api/captures?kind=note')),bBefore);
 f.cookie('a');assert.doesNotMatch(JSON.stringify(await a.request('/api/captures?kind=note')),/GENERATED_B_WEB_NOTE/);
});

test('actual personal and administrator configuration view edits preserve owned secrets, CAS, list identity and B state',async t=>{
 const f=await fixture(t),a=f.api(),settings={...defaultModelSettings(),provider:'custom',protocol:'openai-completions',baseUrl:'https://synthetic.invalid/v1',model:'generated-model',apiKey:'GENERATED_A_PRIVATE_KEY'};
 let view=await a.request<any>('/api/configuration');
 view=await a.request('/api/configuration/models',{method:'PUT',body:JSON.stringify({revision:view.revision,value:{profiles:[{id:'same-profile',name:'Generated A',settings}],selections:{chat:{kind:'personal',id:'same-profile'}}}})});
 const value=structuredClone(view.domains.find((domain:any)=>domain.id==='models').saved);assert.equal(value.profiles[0].settings.apiKey,true);value.profiles[0].name='Edited A';
 await a.request('/api/configuration/models',{method:'PUT',body:JSON.stringify({revision:view.revision,value,preserveRedactedSecrets:true})});
 const file=join(f.directory,'configuration','users',f.a.userId,'mote.yaml');assert.match(readFileSync(file,'utf8'),/GENERATED_A_PRIVATE_KEY/);
 await assert.rejects(a.request('/api/configuration/models',{method:'PUT',body:JSON.stringify({revision:view.revision,value,preserveRedactedSecrets:true})}),error=>(error as any).status===409);
 f.cookie('b');const b=createApi(f.bi),bBefore=JSON.stringify(await b.request('/api/configuration'));assert.doesNotMatch(bBefore,/GENERATED_A_PRIVATE_KEY|Edited A/);
 await assert.rejects(b.request('/api/admin/configuration/models'),error=>(error as any).status===403);
 const adminHeaders={...protocol,authorization:'Bearer '+f.admin.token};
 let shared=await f.host.app.inject({url:'/api/admin/configuration/models',headers:adminHeaders});
 const sharedValue={...defaultModelDomain(),deployment:{...settings,apiKey:'GENERATED_SHARED_KEY'}};
 shared=await f.host.app.inject({method:'PUT',url:'/api/admin/configuration/models',headers:adminHeaders,payload:{revision:shared.json().revision,value:sharedValue}});assert.equal(shared.statusCode,200,shared.body);
 const redacted=shared.json().domains[0].saved;redacted.deployment.model='edited-shared-model';
 shared=await f.host.app.inject({method:'PUT',url:'/api/admin/configuration/models',headers:adminHeaders,payload:{revision:shared.json().revision,value:redacted,preserveRedactedSecrets:true}});assert.equal(shared.statusCode,200,shared.body);assert.doesNotMatch(shared.body,/GENERATED_SHARED_KEY/);
 assert.equal(JSON.stringify(await b.request('/api/configuration')),bBefore);
});

test('a held successful production response cannot publish after Web account retirement while a new credential stays usable',async t=>{
 const f=await fixture(t);let current=true,entered!:()=>void,release!:()=>void;
 const seen=new Promise<void>(done=>{entered=done;}),gate=new Promise<void>(done=>{release=done;}),transport=globalThis.fetch;
 t.mock.method(globalThis,'fetch',async(...args:Parameters<typeof fetch>)=>{const response=await transport(...args);entered();await gate;return response;});
 const api=createApi(f.ai,undefined,()=>current),pending=api.request('/api/configuration'),rejected=assert.rejects(pending,/登录会话/);await seen;current=false;release();await rejected;
 f.cookie('b');const b=createApi(f.bi);assert.ok(await b.request('/api/configuration'));
});
