import test,{type TestContext} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {buildApp} from '../src/app.js';
import {waitForScopedState} from './fixtures/scoped-process.js';

const password='Generated-M14-lifecycle-only-01',protocol={'x-mote-protocol-version':'2','x-mote-ingress-version':'3'};
const deferred=()=>{let resolve!:()=>void;const promise=new Promise<void>(r=>resolve=r);return {promise,resolve};};
async function fixture(t:TestContext){
 const directory=mkdtempSync(join(tmpdir(),'mote-m14-lifecycle-activity-'));let node=await buildApp({dataDir:directory});const releaseOnClose:(()=>void)[]=[];
 t.after(async()=>{for(const release of releaseOnClose)release();await node.app.close();rmSync(directory,{recursive:true,force:true});});
 const request=(token:string|undefined,url:string,method:any='GET',payload?:unknown)=>node.app.inject({url,method,headers:{...protocol,...(token?{authorization:'Bearer '+token}:{})},...(payload===undefined?{}:{payload})});
 const checked=async(token:string|undefined,url:string,method:any='GET',payload?:unknown)=>{const response=await request(token,url,method,payload);assert.equal(response.statusCode,200,response.body);return response.json();};
 const login=(username:string)=>checked(undefined,'/api/auth/login','POST',{username,password,mode:'client'});
 await node.accounts!.initialize('generated-admin',password);const admin=await login('generated-admin');
 for(const username of ['generated-a','generated-b'])await checked(admin.token,'/api/admin/accounts','POST',{username,password});
 const a=await login('generated-a'),b=await login('generated-b');
 return {get node(){return node;},request,checked,login,admin,a,b,releaseOnClose,restart:async()=>{await node.app.close();node=await buildApp({dataDir:directory});}};
}

test('real portable export enters owner Activity while held, completes with exact receipt and loses its artifact on cancel',async t=>{
 const f=await fixture(t),entered=deferred(),release=deferred(),domain='generated-activity-export';f.releaseOnClose.push(release.resolve);
 f.node.services.registerUser(domain,{scope:'user',create:()=>({}),lifecycle:{exportUser:async subject=>{if(subject.userId===f.a.userId){entered.resolve();await release.promise;}return {domain,version:1,userId:subject.userId,deploymentId:subject.deploymentId,payload:{body:'Generated A archive bytes, never an Activity payload'}};},deleteUser:async(_subject,operationId)=>({status:'complete',operationId}),restoreUser:async()=>{}}});
 const receipt=await f.checked(f.a.token,'/api/portable/exports','POST',{operationId:randomUUID()}),id='export:'+receipt.id;await entered.promise;
 const page=await f.checked(f.a.token,'/api/work-activity?state=active&limit=1');assert.equal(page.items.length,1);assert.equal(page.items[0].id,id);assert.equal(page.items[0].state,'running');assert.equal(page.items[0].progress.mode,'semantic');assert.equal(page.items[0].progress.total,undefined);
 for(const token of [f.b.token,f.admin.token]){assert.equal((await f.request(token,'/api/work-activity/'+id)).statusCode,404);assert.equal((await f.checked(token,'/api/work-activity')).items.length,0);}
 assert.equal((await f.checked(f.a.token,'/api/work-activity?sourceId=same-source')).items.length,0,'account exports have no invented source relationship');
 release.resolve();await waitForScopedState(async()=>(await f.checked(f.a.token,'/api/portable/exports/'+receipt.id)).state==='completed',()=> 'real export did not complete');
 const completed=await f.checked(f.a.token,'/api/work-activity/'+id);assert.equal(completed.state,'completed');assert.equal(completed.progress.mode,'semantic');assert.equal(completed.progress.stage,'finished');assert.equal(completed.artifacts.length,1);assert.equal(completed.artifacts[0].id,receipt.id);assert.deepEqual(completed.technical.operationIds,[]);assert.equal(completed.evidence.count,0);assert.doesNotMatch(JSON.stringify(completed),/archive bytes|grant_id|token_hash|password/);
 assert.equal((await f.request(f.a.token,'/api/portable/exports/'+receipt.id+'/content')).statusCode,200);
 await f.checked(f.a.token,'/api/portable/exports/'+receipt.id+'/cancel','POST',{});const cancelled=await f.checked(f.a.token,'/api/work-activity/'+id);assert.equal(cancelled.state,'cancelled');assert.deepEqual(cancelled.artifacts,[]);assert.equal((await f.request(f.a.token,'/api/portable/exports/'+receipt.id+'/content')).statusCode,409);
 await f.restart();assert.equal((await f.checked(f.a.token,'/api/work-activity/'+id)).state,'cancelled');
});

test('Activity filters complete lifecycle visibility before LIMIT and never adopts exports from a prior account epoch',async t=>{
 const f=await fixture(t),ids:string[]=[];
 for(let index=0;index<12;index++)for(const owner of [f.a,f.b]){const receipt=await f.checked(owner.token,'/api/portable/exports','POST',{operationId:randomUUID()});await f.checked(owner.token,'/api/portable/exports/'+receipt.id+'/cancel','POST',{});if(owner===f.a)ids.push('export:'+receipt.id);}
 const seen=new Set<string>();let cursor:number|null=0;
 do{const page=await f.checked(f.a.token,'/api/work-activity?state=completed&limit=5&cursor='+cursor);for(const row of page.items){assert.ok(ids.includes(row.id));assert.equal(row.state,'cancelled');assert.ok(!seen.has(row.id));seen.add(row.id);}cursor=page.nextCursor;}while(cursor!==null);
 assert.equal(seen.size,12);assert.equal((await f.checked(f.a.token,'/api/work-activity?state=active&limit=1')).items.length,0);
 await f.checked(f.admin.token,'/api/admin/accounts/'+f.a.userId+'/password','POST',{password});const replacement=await f.login('generated-a');
 assert.equal((await f.checked(replacement.token,'/api/work-activity?state=completed')).items.length,0);assert.equal((await f.request(replacement.token,'/api/work-activity/'+ids[0])).statusCode,404);assert.equal((await f.request(replacement.token,'/api/portable/exports/'+ids[0].slice(7))).statusCode,409);
 assert.equal((await f.checked(f.b.token,'/api/work-activity?state=completed&limit=100')).items.length,12);
});

test('administrator Activity reports durable unknown deletion metadata without exposing the target private archive',async t=>{
 const f=await fixture(t),domain='generated-activity-erasure';let unknown=true;
 f.node.services.registerUser(domain,{scope:'user',create:()=>({}),lifecycle:{exportUser:async subject=>({domain,version:1,userId:subject.userId,deploymentId:subject.deploymentId,payload:{body:'Generated private deletion body'}}),deleteUser:async(_subject,operationId)=>({status:unknown?'result_unknown':'complete',operationId}),restoreUser:async()=>{}}});
 const receipt=await f.checked(f.admin.token,'/api/admin/accounts/'+f.a.userId,'DELETE',{operationId:randomUUID()}),id='delete:'+receipt.id;
 await waitForScopedState(async()=>(await f.checked(f.admin.token,'/api/admin/account-deletions/'+receipt.id)).state==='result_unknown',()=> 'real erasure did not stop with unknown result');
 const page=await f.checked(f.admin.token,'/api/work-activity?state=attention&limit=1');assert.equal(page.items[0]?.id,id);assert.equal(page.items[0].state,'needs_input');assert.equal(page.items[0].progress.mode,'semantic');
 const detail=await f.checked(f.admin.token,'/api/work-activity/'+id);assert.equal(detail.kind,'delete');assert.deepEqual(detail.artifacts,[]);assert.deepEqual(detail.evidence,{count:0,refs:[]});assert.doesNotMatch(JSON.stringify(detail),/private deletion body|grant_id|token_hash|password/);
 assert.equal((await f.request(f.a.token,'/api/work-activity/'+id)).statusCode,401);assert.equal((await f.request(f.b.token,'/api/work-activity/'+id)).statusCode,404);assert.equal((await f.checked(f.b.token,'/api/work-activity?state=attention')).items.length,0);
 unknown=false;await f.checked(f.admin.token,'/api/admin/account-deletions/'+receipt.id+'/retry','POST',{});await waitForScopedState(async()=>(await f.checked(f.admin.token,'/api/admin/account-deletions/'+receipt.id)).state==='completed',()=> 'explicit retry did not complete');
 assert.equal((await f.checked(f.admin.token,'/api/work-activity/'+id)).state,'completed');assert.deepEqual((await f.checked(f.admin.token,'/api/work-activity/'+id)).artifacts,[]);
});
