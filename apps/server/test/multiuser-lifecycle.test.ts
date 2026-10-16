import test,{type TestContext} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {buildApp} from '../src/app.js';

const password='Generated-M16-account-password';
const protocol={'x-mote-protocol-version':'2','x-mote-ingress-version':'3'};
async function fixture(t:TestContext){
 const directory=mkdtempSync(join(tmpdir(),'mote-m16-'));
 let node=await buildApp({dataDir:directory});
 t.after(async()=>{await node.app.close();rmSync(directory,{recursive:true,force:true});});
 await node.accounts!.initialize('generated-admin',password);
 const request=(token:string|undefined,method:any,url:string,payload?:unknown,headers:Record<string,string>={})=>node.app.inject({method,url,headers:{...protocol,...(token?{authorization:'Bearer '+token}:{}),...headers},...(payload===undefined?{}:{payload})});
 const login=async(username:string)=>{const response=await request(undefined,'POST','/api/auth/login',{username,password,mode:'client'});assert.equal(response.statusCode,200,response.body);return response.json();};
 const admin=await login('generated-admin');
 for(const username of ['generated-alice','generated-bob'])assert.equal((await request(admin.token,'POST','/api/admin/accounts',{username,password})).statusCode,200);
 const a=await login('generated-alice'),b=await login('generated-bob');
 const source={id:'same-source',name:'Generated source',kind:'local-files',deviceId:'same-device',platform:'import',retention:'archive'};
 for(const [owner,text] of [[a,'Generated A private'],[b,'Generated B private']] as const){
  assert.equal((await request(owner.token,'POST','/api/ingress/sources',source)).statusCode,200);
  assert.equal((await request(owner.token,'POST','/api/ingress/sources/same-source/items',{batchId:'same-batch',items:[{externalId:'same-external',revision:'same-revision',observedAt:'2026-01-01T00:00:00Z',title:'Generated',text,kind:'file',layer:'original'}]})).statusCode,200);
 }
 const restart=async()=>{await node.app.close();node=await buildApp({dataDir:directory});};
 return {directory,get node(){return node;},request,login,admin,a,b,restart};
}

test('portable 3 actual production entry exports only its owner, exact resumable bytes and no login grants',async t=>{
 const f=await fixture(t),operationId=randomUUID();
 const started=await f.request(f.a.token,'POST','/api/portable/exports',{operationId});
 assert.equal(started.statusCode,200,started.body);
 const id=started.json().id;
 let receipt=started.json();
 for(let tries=0;receipt.state==='working'&&tries<100;tries++){await new Promise(r=>setTimeout(r,10));receipt=(await f.request(f.a.token,'GET','/api/portable/exports/'+id)).json();}
 assert.equal(receipt.state,'completed',JSON.stringify(receipt));
 assert.equal(receipt.userId,f.a.userId);assert.equal(receipt.deploymentId,f.a.deploymentId);
 assert.equal((await f.request(f.b.token,'GET','/api/portable/exports/'+id)).statusCode,404);
 assert.equal((await f.request(f.admin.token,'GET','/api/portable/exports/'+id+'/content')).statusCode,404);
 const content=await f.request(f.a.token,'GET','/api/portable/exports/'+id+'/content');
 assert.equal(content.statusCode,200,content.body);assert.equal(content.headers['content-type'],'application/json; charset=utf-8');
 const archive=content.json();assert.equal(archive.version,3);assert.equal(archive.userId,f.a.userId);assert.match(content.body,/Generated A private/);assert.doesNotMatch(content.body,/Generated B private|password_hash|password_salt|token_hash/);
 for(const owner of [f.a,f.b,f.admin])assert.ok(!content.body.includes(owner.token));
 assert.equal(receipt.bytes,content.rawPayload.length);
 const part=await f.request(f.a.token,'GET','/api/portable/exports/'+id+'/content',undefined,{range:'bytes=10-39','if-range':content.headers.etag as string});
 assert.equal(part.statusCode,206);assert.deepEqual(part.rawPayload,content.rawPayload.subarray(10,40));
 assert.equal((await f.request(f.a.token,'GET','/api/portable/exports/'+id+'/content',undefined,{range:'bytes=999999999999-'})).statusCode,416);
 await f.restart();assert.deepEqual((await f.request(f.a.token,'GET','/api/portable/exports/'+id+'/content')).rawPayload,content.rawPayload);
 assert.equal((await f.request(f.a.token,'POST','/api/portable/exports',{operationId})).json().id,id);
 const cancelled=await f.request(f.a.token,'POST','/api/portable/exports/'+id+'/cancel',{});assert.equal(cancelled.statusCode,200);assert.equal(cancelled.json().state,'cancelled');
 assert.equal((await f.request(f.a.token,'GET','/api/portable/exports/'+id+'/content')).statusCode,409);
});

test('production account deletion revokes before erasure, is durable and cannot delete B or reenable a deleted account',async t=>{
 const f=await fixture(t),before=await f.request(f.b.token,'GET','/api/captures'),operationId=randomUUID();
 const ordinary=await f.request(f.a.token,'DELETE','/api/admin/accounts/'+f.b.userId,{operationId});assert.equal(ordinary.statusCode,403);
 const started=await f.request(f.admin.token,'DELETE','/api/admin/accounts/'+f.a.userId,{operationId});assert.equal(started.statusCode,200,started.body);
 assert.equal((await f.request(f.a.token,'GET','/api/captures')).statusCode,401);
 let receipt=started.json();for(let tries=0;['working','pending'].includes(receipt.state)&&tries<100;tries++){await new Promise(r=>setTimeout(r,10));receipt=(await f.request(f.admin.token,'GET','/api/admin/account-deletions/'+receipt.id)).json();}
 assert.equal(receipt.state,'completed',JSON.stringify(receipt));
 assert.deepEqual((await f.request(f.b.token,'GET','/api/captures')).json(),before.json());
 assert.equal((await f.request(f.admin.token,'PATCH','/api/admin/accounts/'+f.a.userId,{disabled:false})).statusCode,409);
 await f.restart();assert.deepEqual((await f.request(f.admin.token,'GET','/api/admin/account-deletions/'+receipt.id)).json(),receipt);
 assert.equal((await f.request(f.admin.token,'DELETE','/api/admin/accounts/'+f.a.userId,{operationId})).json().id,receipt.id);
 const db=new DatabaseSync(join(f.directory,'mote.sqlite'),{readOnly:true});try{assert.equal(db.prepare('SELECT count(*) n FROM pd_captures WHERE user_id=?').get(f.a.userId)!.n,0);assert.equal(db.prepare('SELECT count(*) n FROM pd_captures WHERE user_id=?').get(f.b.userId)!.n,1);}finally{db.close();}
});
