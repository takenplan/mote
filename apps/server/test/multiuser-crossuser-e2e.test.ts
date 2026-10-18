/** Cross-domain journeys through real HTTP/SQLite and the MCP SDK. Only the
 * external model endpoint is scripted by the existing Memory fixture. No
 * manually published Material or replacement runtime participates here. */
import test, {type TestContext} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {join} from 'node:path';
import {gunzipSync} from 'node:zlib';
import {memoryFixture, memoryText} from './fixtures/mcp-memory.js';
import {password, protocol, waitForState} from './fixtures/scoped-query-accounts.js';
import {call, value} from './fixtures/mcp.js';
import {createApi, type WebConnection} from '../../web/src/api.js';
import {writeMessagesResponse} from '../../../scripts/fixtures/messages-provider.js';

const nativeFetch=globalThis.fetch;
async function journey(t:TestContext){
 const f=await memoryFixture(t);
 await f.node.app.listen({host:'127.0.0.1',port:0});
 const base=f.node.app.listeningOrigin!;
 const request=(token:string|undefined,path:string,method='GET',body?:unknown,extra:Record<string,string>={})=>nativeFetch(base+path,{method,headers:{...protocol,...(token?{authorization:'Bearer '+token}:{}),...(body===undefined?{}:{'content-type':'application/json'}),...extra},...(body===undefined?{}:{body:JSON.stringify(body)})});
 const ok=async(...args:Parameters<typeof request>)=>{const r=await request(...args);assert.equal(r.status,200,await r.clone().text());return r.json();};
 const configure=async(token:string,domain:string,settings:unknown)=>ok(token,'/api/configuration/'+domain,'PUT',{revision:(await ok(token,'/api/configuration')).revision,value:settings});
 for(const user of [f.a,f.b]){
  await ok(user.token,'/api/sources/same-source','DELETE');
  await ok(user.token,'/api/ingress/sources','POST',{id:'same-source',name:'Generated files',kind:'local-files',deviceId:'same-device',platform:'import',retention:'archive'});
  const processing=await ok(user.token,'/api/processing');
  await configure(user.token,'processing',{...processing.settings,automatic:false,understandingEnabled:false,summarize:false,semanticTurns:false});
 }
 const upload=async(token:string,owner:string,id='same-file')=>{
  const bytes=Buffer.from(memoryText(owner)),checksum=createHash('sha256').update(bytes).digest('hex');
  const upload=await ok(token,'/api/ingress/sources/same-source/uploads','POST',{batchId:id,revision:{sourceId:'same-source',previousRevision:null,item:{externalId:id,revision:'same-r1',observedAt:'2026-10-17T00:00:00Z',title:id,text:'',kind:'file',layer:'original',mimeType:'text/plain'},sizeBytes:bytes.length,sha256:checksum,relativePath:id+'.txt'}});
  await ok(token,'/api/ingress/uploads/'+upload.id+'/parts/0','PUT',{bytes:bytes.toString('base64'),checksum});
  // Lose the successful commit body after the actual HTTP exchange, then retry
  // the exact operation. This is an ACK-loss probe, not a fabricated receipt.
  const lost=await request(token,'/api/ingress/uploads/'+upload.id+'/commit','POST',{});assert.equal(lost.status,200);await lost.arrayBuffer();
  const receipt=await ok(token,'/api/ingress/uploads/'+upload.id+'/commit','POST',{});
  assert.equal(receipt.captures.length,1);return {...receipt.captures[0],externalId:id};
 };
 const process=async(token:string,original:any)=>{
  const body={originalRef:original.original.ref,operationId:'process:'+original.id};
  const lost=await request(token,'/api/processing','POST',body);assert.equal(lost.status,200);await lost.arrayBuffer();
  const task=await ok(token,'/api/processing','POST',body);
  await waitForState(()=>ok(token,'/api/tasks/'+task.id),v=>v.state==='succeeded','real M05/M06 task');
  const externalId='processed:'+original.id;
  const material=await waitForState(()=>ok(token,'/api/materials'),v=>v.items.some((m:any)=>m.origin.externalId===externalId),'actual M06 Material');
  return {task,material:material.items.find((m:any)=>m.origin.externalId===externalId)};
 };
 const ticket=async(token:string,original:any)=>{
  const path='/api/ingress/originals/'+original.original.ref.slice(9),grant=await ok(token,path+'/tickets','POST',{});
  return path+'/content?ticket='+encodeURIComponent(grant.ticket);
 };
 return {...f,get node(){return f.node;},base,request,ok,upload,process,ticket,configure};
}
const sdk=async(client:Parameters<typeof call>[0],name:string,args:Record<string,unknown>={})=>{const r=await call(client,name,args);assert.equal(r.isError,undefined,JSON.stringify(r));return value(r);};

test('real HTTP intake → M03 original → M05/M06 → M07 → M08/MCP survives lost ACKs, logout and same-URL restart with equal A/B IDs',async t=>{
 const f=await journey(t),a=await f.upload(f.a.token,'A'),b=await f.upload(f.b.token,'B');
 assert.equal(a.id,b.id);assert.notEqual(a.original.ref,b.original.ref,'physical originals retain their own owner binding');
 const ar=await f.process(f.a.token,a),br=await f.process(f.b.token,b);
 assert.equal(ar.material.id,br.material.id);
 for(const [user,owner,record]of [[f.a,'A',ar],[f.b,'B',br]] as const){
  const body={operationId:'a3f00111-0000-4000-8000-000000000001',materialIds:[record.material.id]},lost=await f.request(user.token,'/api/memory/jobs','POST',body);assert.equal(lost.status,200,await lost.clone().text());await lost.arrayBuffer();
  const job=await f.ok(user.token,'/api/memory/jobs','POST',body);
  await waitForState(()=>f.ok(user.token,'/api/memory/jobs/'+job.id),v=>v.state==='committed','actual M07 publication');
  const memories=await f.ok(user.token,'/api/memories');assert.equal(memories.items.length,1);assert.equal(memories.items[0].title,'Generated '+owner);
  const chunks=await f.ok(user.token,'/api/files/'+a.id+'/chunks');assert.equal(chunks.items.map((v:any)=>v.ocrText).join(''),memoryText(owner));
 }
 const at=await f.ticket(f.a.token,a);assert.equal(await(await f.request(f.a.token,at)).text(),memoryText('A'));assert.equal((await f.request(f.b.token,at)).status,404);
 const grant=await f.mint(f.a.token),ac=await f.connect(grant),bc=await f.connect(await f.mint(f.b.token));
 for(const [client,owner,other]of [[ac.client,'A','B'],[bc.client,'B','A']]as const){
  const read=await sdk(client,'mote_material_read',{ref:'material:'+ar.material.id});assert.equal(read.text,memoryText(owner));
  const context=JSON.stringify(await sdk(client,'mote_context'));assert.match(context,new RegExp('Generated '+owner));assert.doesNotMatch(context,new RegExp('GENERATED_MCP_MEMORY_'+other+'|Generated '+other));
 }
 await f.upload(f.a.token,'A','second-file');const first=await f.ok(f.a.token,'/api/files?limit=1');assert.ok(first.nextCursor);
 assert.equal((await f.request(f.b.token,'/api/files?limit=1&cursor='+encodeURIComponent(first.nextCursor))).status,400);
 assert.equal((await f.request(f.b.token,'/api/tasks/'+ar.task.id)).status,404);
 await f.ok(f.a.token,'/api/auth/logout','POST',{});
 assert.equal((await f.request(f.a.token,'/api/files/'+a.id)).status,401);
 assert.equal((await f.request(f.a.token,'/api/files/'+b.id,'DELETE',{operationId:'old-a-delete',originalGeneration:0})).status,401);
 const fresh=await f.ok(undefined,'/api/auth/login','POST',{username:'generated-a',password,mode:'client'});
 assert.equal((await f.ok(fresh.token,'/api/tasks/'+ar.task.id)).state,'succeeded','logout does not cancel authorized durable work');
 assert.equal((await f.ok(f.b.token,'/api/files/'+b.id)).processing.indexed,true);
 const db=new DatabaseSync(join(f.root,'mote.sqlite'),{readOnly:true});
 try{for(const user of [f.a,f.b]){assert.equal(db.prepare('SELECT count(*) n FROM mm_jobs WHERE user_id=?').get(user.userId)!.n,1);assert.equal(db.prepare("SELECT count(*) n FROM execution_steps WHERE user_id=? AND kind='processing.extract'").get(user.userId)!.n,1);}}finally{db.close();}
 const port=new URL(f.base).port;await f.restart();await f.node.app.listen({host:'127.0.0.1',port:Number(port)});
 const second=await f.ok(fresh.token,'/api/files?limit=1&cursor='+encodeURIComponent(first.nextCursor));assert.equal(second.items.length,1);assert.notEqual(second.items[0].captureId,first.items[0].captureId);assert.equal(second.nextCursor,null);
 const resumed=await f.connect(grant);assert.equal((await sdk(resumed.client,'mote_material_read',{ref:'material:'+ar.material.id})).text,memoryText('A'));
 assert.equal((await f.request(f.b.token,at)).status,404);assert.equal((await f.ok(f.b.token,'/api/memories')).items[0].title,'Generated B');
});

test('actual Web API over HTTP rejects late JSON and buffered export bodies after account switch, while B same-ID exports and mutations work',async t=>{
 const f=await journey(t),a=await f.upload(f.a.token,'A'),b=await f.upload(f.b.token,'B');await f.process(f.a.token,a);await f.process(f.b.token,b);
 const login=async(username:string)=>{const r=await f.request(undefined,'/api/auth/login','POST',{username,password,mode:'web'});assert.equal(r.status,200);return {...await r.json(),cookie:r.headers.get('set-cookie')!.split(';')[0]};};
 const wa=await login('generated-a'),wb=await login('generated-b');let cookie=wa.cookie,current=wa.credentialId;
 const info=(w:any):WebConnection=>({...w,mode:'web',origin:f.base,viewScope:w.credentialId});
 let hold=false,entered!:()=>void,release!:()=>void;const seen=new Promise<void>(r=>entered=r),gate=new Promise<void>(r=>release=r);t.after(()=>release());
 // Node lacks the browser cookie jar and relative URL base; this adapter changes
 // only transport addressing/cookies. Every response comes from real HTTP.
 t.mock.method(globalThis,'fetch',async(input:Parameters<typeof fetch>[0],init?:RequestInit)=>{
  if(typeof input!=='string'||!input.startsWith('/api/'))return nativeFetch(input,init);
  const headers=new Headers(init?.headers);headers.set('cookie',cookie);const r=await nativeFetch(f.base+input,{...init,headers});if(hold){hold=false;entered();await gate;}return r;
 });
 const api=createApi(info(wa),undefined,()=>current===wa.credentialId),raw=await api.raw('/api/files/'+a.id+'/export');
 hold=true;const pending=api.request('/api/materials'),rejected=assert.rejects(pending,(e:any)=>e.code==='session_changed');await seen;
 cookie=wb.cookie;current=wb.credentialId;release();await rejected;
 await assert.rejects(raw.arrayBuffer(),(e:any)=>e.code==='session_changed');
 const stale=await f.request(undefined,'/api/sources/same-source','PATCH',{name:'STALE_A_WRITE'}, {cookie,'x-mote-session-id':wa.credentialId,'x-mote-csrf':wa.csrfToken});assert.equal(stale.status,409);
 const bapi=createApi(info(wb),undefined,()=>current===wb.credentialId),body=await(await bapi.raw('/api/files/'+b.id+'/export')).arrayBuffer();assert.ok(gunzipSync(Buffer.from(body)).includes(Buffer.from(memoryText('B'))));assert.ok(!gunzipSync(Buffer.from(body)).includes(Buffer.from(memoryText('A'))));
 await bapi.request('/api/sources/same-source',{method:'PATCH',body:JSON.stringify({name:'Generated B changed'})});
 assert.equal((await f.ok(f.b.token,'/api/sources')).items.find((s:any)=>s.id==='same-source').name,'Generated B changed');
 assert.equal((await f.ok(f.a.token,'/api/sources')).items.find((s:any)=>s.id==='same-source').name,'Generated files');
 assert.equal((await f.ok(f.a.token,'/api/files/'+a.id)).processing.indexed,true);
});

test('same URL replaced by another real deployment rejects old credentials, M03 tickets and pagination while fresh B can read and write',async t=>{
 const old=await journey(t),replacement=await journey(t),a=await old.upload(old.a.token,'A'),b=await replacement.upload(replacement.b.token,'B');
 await old.upload(old.a.token,'A','second-file');const page=await old.ok(old.a.token,'/api/files?limit=1'),ticket=await old.ticket(old.a.token,a);assert.ok(page.nextCursor);
 const oldDeployment=(await old.ok(old.a.token,'/api/auth/self')).deploymentId,port=Number(new URL(old.base).port);
 await old.restart();await replacement.restart();await replacement.node.app.listen({host:'127.0.0.1',port});
 assert.equal((await old.request(old.a.token,'/api/auth/self')).status,401);assert.equal((await old.request(old.a.token,ticket)).status,401);
 const fresh=await old.ok(undefined,'/api/auth/login','POST',{username:'generated-b',password,mode:'client'});assert.notEqual(fresh.deploymentId,oldDeployment);
 assert.equal((await old.request(fresh.token,'/api/files?limit=1&cursor='+encodeURIComponent(page.nextCursor))).status,400);
 assert.equal((await old.request(fresh.token,ticket)).status,404);
 assert.equal((await old.ok(fresh.token,'/api/files/'+b.id)).hasOriginal,true);
 await old.ok(fresh.token,'/api/sources/same-source','PATCH',{name:'Generated replacement B'});
 assert.equal((await old.ok(fresh.token,'/api/sources')).items.find((s:any)=>s.id==='same-source').name,'Generated replacement B');
});

test('held external model output cannot publish an old A job after account revocation, while B completes the same production chain',async t=>{
 const f=await journey(t),a=await f.upload(f.a.token,'A'),b=await f.upload(f.b.token,'B'),ar=await f.process(f.a.token,a),br=await f.process(f.b.token,b);
 let entered!:()=>void,release!:()=>void;const seen=new Promise<void>(r=>entered=r),gate=new Promise<void>(r=>release=r);t.after(()=>release());
 f.modelReplies.set('A',async(raw,res)=>{
  const id=raw.match(/[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-a[0-9a-f]{3}-[0-9a-f]{12}/)![0],keys=[...new Set([...raw.matchAll(/\\?"key\\?"\s*:\s*\\?"(member_[0-9]+)/g)].map(m=>m[1]))];
  entered();await gate;
  writeMessagesResponse(res,{stage:1,text:JSON.stringify({answer:JSON.stringify({memories:[{title:'Generated late A',statement:'Nora prefers generated tea. ['+id+']',uncertainty:'Synthetic original only',admission:{layer:'memory',reason:'Synthetic expressed preference',scope:'Nora in generated fixture',attribution:'third_party'},evidenceIds:[id],evidence:[{id,quote:memoryText('A')}]}],coverage:keys.map((key,index)=>({key,state:index===0?'checked':'no_candidates',candidateIndexes:index===0?[0]:[]}))}),citationIds:[id]})});
 });
 const body={operationId:'a3f00111-0000-4000-8000-000000000002',materialIds:[ar.material.id]},job=await f.ok(f.a.token,'/api/memory/jobs','POST',body);
 await seen;
 await f.ok(f.admin.token,'/api/admin/accounts/'+f.a.userId,'PATCH',{disabled:true});
 await f.ok(f.admin.token,'/api/admin/accounts/'+f.a.userId,'PATCH',{disabled:false});
 assert.equal((await f.request(f.a.token,'/api/memory/jobs/'+job.id)).status,401);
 const bj=await f.ok(f.b.token,'/api/memory/jobs','POST',{...body,materialIds:[br.material.id]});
 await waitForState(()=>f.ok(f.b.token,'/api/memory/jobs/'+bj.id),v=>v.state==='committed','B genuine memory publication during A revoke');
 release();
 const fresh=await f.ok(undefined,'/api/auth/login','POST',{username:'generated-a',password,mode:'client'});
 const retired=await waitForState(()=>f.ok(fresh.token,'/api/memory/jobs/'+job.id),v=>v.tasks.batch.state==='stale','A old task retirement after late response');
 assert.deepEqual(Object.keys(retired.tasks),['batch']);assert.equal(retired.tasks.batch.attempts,1);assert.equal(f.requests.filter(request=>request.owner==='A').length,1,'revoked extraction cannot enter independent review or save');
 assert.deepEqual((await f.ok(fresh.token,'/api/memories')).items,[]);
 assert.equal((await f.ok(f.b.token,'/api/memories')).items[0].title,'Generated B');
 assert.ok(f.requests.filter(r=>r.owner==='A').every(r=>!r.raw.includes(memoryText('B'))));
});
