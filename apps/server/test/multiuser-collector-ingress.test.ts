import test,{type TestContext} from 'node:test';
import assert from 'node:assert/strict';
import {createHash,randomBytes} from 'node:crypto';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {buildApp} from '../src/app.js';
const password='Generated-collector-contract-01';
async function fixture(t:TestContext){
 const directory=await mkdtemp(join(tmpdir(),'mote-m14-ingress-')),node=await buildApp({dataDir:directory});t.after(async()=>{await node.app.close();await rm(directory,{recursive:true,force:true});});await node.accounts.initialize('generated-admin',password);
 const request=(token:string|undefined,url:string,method:any='GET',payload?:unknown)=>node.app.inject({url,method,headers:{'x-mote-protocol-version':'2','x-mote-ingress-version':'3',...(token?{authorization:'Bearer '+token}:{})},...(payload===undefined?{}:{payload})});
 const login=async(username:string)=>{const response=await request(undefined,'/api/auth/login','POST',{username,password,mode:'client'});assert.equal(response.statusCode,200,response.body);return response.json();};
 const admin=await login('generated-admin');for(const username of ['generated-a','generated-b'])assert.equal((await request(admin.token,'/api/admin/accounts','POST',{username,password})).statusCode,200);
 const a=await login('generated-a'),b=await login('generated-b');
 const device=async(token:string)=>{const verifier=randomBytes(32).toString('base64url'),challenge=createHash('sha256').update(verifier).digest('hex');const start=await request(undefined,'/api/login/requests','POST',{serverUrl:'https://synthetic.invalid',deviceId:'same-device',deviceName:'Generated device',platform:'macos',challenge});assert.equal(start.statusCode,200,start.body);const {id}=start.json();assert.equal((await request(token,`/api/login/requests/${id}/approve`,'POST',{})).statusCode,200);const result=await request(undefined,'/api/login/poll','POST',{id,verifier});assert.equal(result.statusCode,200,result.body);return result.json().token as string;};
 const register=async(token:string,id='same-source',deviceId='same-device')=>{const response=await request(token,'/api/ingress/sources','POST',{id,name:'Generated source',kind:'local-files',deviceId,platform:'macos',retention:'snapshot'});assert.equal(response.statusCode,200,response.body);};
 return {node,request,a,b,device,register};
}
test('collector source edits, exact heads and description CAS retain account and device authority',async t=>{
 const f=await fixture(t);await f.register(f.a.token);await f.register(f.b.token);await f.register(f.a.token,'other-source','other-device');const token=await f.device(f.a.token);
 const context='/api/ingress/sources/same-source/context';
 const initial=await f.request(token,context);assert.equal(initial.statusCode,200,initial.body);assert.equal(initial.json().version,0);
 const a=await f.request(token,context,'PATCH',{expectedVersion:0,description:'Generated A source context'});assert.equal(a.statusCode,200,a.body);assert.equal(a.json().version,1);
 assert.equal((await f.request(token,context,'PATCH',{expectedVersion:0,description:'Generated A source context'})).json().version,1);
 assert.equal((await f.request(token,context,'PATCH',{expectedVersion:0,description:'Changed stale description'})).statusCode,409);
 const b=await f.request(f.b.token,context,'PATCH',{expectedVersion:0,description:'Generated B source context'});assert.equal(b.statusCode,200,b.body);assert.equal((await f.request(token,context+'?version=1')).json().description,'Generated A source context');
 for(const suffix of ['/context','/head?externalId=same-external'])assert.equal((await f.request(token,'/api/ingress/sources/other-source'+suffix)).statusCode,404);
 assert.equal((await f.request(token,'/api/sources/same-source/context')).statusCode,403);
 assert.equal((await f.request(token,'/api/ingress/sources/same-source','PATCH',{enabled:false})).statusCode,400);
 assert.equal((await f.request(token,'/api/ingress/sources/same-source','PATCH',{name:'Generated edited A',retention:'reference',initialSync:'new_only'})).statusCode,200);
 assert.equal((await f.request(f.b.token,'/api/sources/same-source')).json().name,'Generated source');assert.equal((await f.request(f.b.token,context)).json().description,'Generated B source context');
 assert.equal((await f.request(token,'/api/ingress/sources/same-source/head?externalId=same-external')).json().revision,null);
 const item={externalId:'same-external',revision:'same-revision',observedAt:'2026-01-01T00:00:00Z',title:'Generated reference',text:'',kind:'file',layer:'reference'};
 assert.equal((await f.request(token,'/api/ingress/sources/same-source/items','POST',{batchId:'same-batch',items:[item]})).statusCode,200);
 assert.equal((await f.request(token,'/api/ingress/sources/same-source/head?externalId=same-external')).json().revision,'same-revision');assert.equal((await f.request(f.b.token,'/api/ingress/sources/same-source/head?externalId=same-external')).json().revision,null);
 assert.equal((await f.request(f.a.token,'/api/sources/same-source','PATCH',{enabled:false})).statusCode,200);
 assert.equal((await f.request(token,context)).statusCode,409);assert.equal((await f.request(token,context,'PATCH',{expectedVersion:1,description:'Paused edit'})).statusCode,409);assert.equal((await f.request(f.b.token,context)).statusCode,200);
});
