import test,{type TestContext} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,readFileSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {buildApp} from '../src/app.js';
import {defaultModelSettings,defaultModelDomain} from '../src/model-settings.js';
import {createApi,type WebConnection} from '../../web/src/api.js';
import {submitWebNote} from '../../web/src/web-notes.js';
import {uploadNoteAttachment} from '../../web/src/note-attachments.js';

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
  return new Response(r.rawPayload,{status:r.statusCode,headers:r.headers as Record<string,string>});
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

test('Web feature metadata describes real routes and Library keeps owned canonical material/source paging',async t=>{
 const f=await fixture(t),a=f.api();
 const inventory=await a.request<any>('/api/features');
 assert.equal(inventory.schemaVersion,1);const ids=inventory.capabilities.map((item:any)=>item.id);
 for(const id of ['http:GET:/api/materials','http:GET:/api/library/catalog','http:GET:/api/features'])assert.ok(ids.includes(id),id);
 assert.ok(!ids.includes('http:GET:/api/imports'),'do not advertise absent legacy runtime');
 const note={id:'6d477b3e-fb43-4657-818d-c143ad76430f',deviceId:'same-device',deviceName:'Generated web',platform:'import' as const,client:'web' as const,capturedAt:'2026-10-16T12:00:00Z',text:'GENERATED_A_LIBRARY_NOTE'};
 await submitWebNote(a,note);f.cookie('b');const b=createApi(f.bi);await submitWebNote(b,{...note,text:'GENERATED_B_LIBRARY_NOTE'});f.cookie('a');
 const end=Date.now()+20000;let page:any;
 do{page=await a.request('/api/library/catalog?limit=1');if(page.items.length)break;await new Promise(done=>setTimeout(done,25));}while(Date.now()<end);
 assert.equal(page.items.length,1,'actual formal note producer reached canonical Material');
 const selected=page.items[0];assert.match(selected.ref,/^material:mat_/);assert.ok(page.sources.some((source:any)=>source.count>0));
 assert.match(JSON.stringify(await a.request('/api/materials/'+selected.id+'/read?revision='+selected.revision)),/GENERATED_A_LIBRARY_NOTE/);
 assert.doesNotMatch(JSON.stringify(page),/GENERATED_B_LIBRARY_NOTE/);
 f.cookie('b');assert.doesNotMatch(JSON.stringify(await b.request('/api/library/catalog?limit=1')),/GENERATED_A_LIBRARY_NOTE/);
 await assert.rejects(a.request('/api/library/catalog'),error=>(error as any).code==='session_changed');
});

test('Web attachment transport commits actual owned bytes and retries the same receipt without borrowing B authority',async t=>{
 const f=await fixture(t),a=f.api(),file=new File(['GENERATED_AUDIO_BYTES_ONLY'],'generated.wav',{type:'audio/wav',lastModified:0});
 const id=await uploadNoteAttachment(a,file,'same-device');assert.match(id,/^[a-f0-9-]{36}$/);
 assert.equal(await uploadNoteAttachment(a,file,'same-device'),id);
 const originals=await a.request<any>('/api/ingress/sources/notes-same-device/originals');assert.equal(originals.items.length,1);
 const original=originals.items[0],ticket=await a.request<any>('/api/ingress/originals/'+original.ref.slice(9)+'/tickets',{method:'POST',body:'{}'});
 assert.equal(await (await a.raw('/api/ingress/originals/'+original.ref.slice(9)+'/content?ticket='+encodeURIComponent(ticket.ticket))).text(),'GENERATED_AUDIO_BYTES_ONLY');
 f.cookie('b');const b=createApi(f.bi);await assert.rejects(b.request('/api/captures/'+id),error=>(error as any).status===404);
 await assert.rejects(uploadNoteAttachment(a,file,'same-device'),error=>(error as any).code==='session_changed');
 assert.equal((await b.request<any>('/api/captures')).items.length,0);
});

test('Web reference form transport retains metadata and retries one owned Ingress batch without fetching its URI',async t=>{
 const {saveWebReference}=await import('../../web/src/web-reference.js'),f=await fixture(t),a=f.api(),uri='nas://generated/reference-only.txt';
 await saveWebReference(a,'GENERATED_A_REFERENCE',uri);await saveWebReference(a,'GENERATED_A_REFERENCE',uri);
 const history=await a.request<any>('/api/sources/manual-references/history?externalId='+encodeURIComponent(uri));assert.equal(history.items.length,1);assert.equal(history.items[0].layer,'reference');assert.equal(history.items[0].uri,uri);assert.equal(history.items[0].text,'');
 f.cookie('b');const b=createApi(f.bi);await saveWebReference(b,'GENERATED_B_REFERENCE',uri);
 assert.doesNotMatch(JSON.stringify(await b.request('/api/source-items')),/GENERATED_A_REFERENCE/);
 await assert.rejects(saveWebReference(a,'STALE_A_REFERENCE',uri),error=>(error as any).code==='session_changed');
});
