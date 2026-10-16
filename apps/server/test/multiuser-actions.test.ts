import test,{type TestContext} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {buildApp} from '../src/app.js';
import {queryAccounts,queryHttp} from './fixtures/scoped-query-accounts.js';

async function fixture(t:TestContext){
 const directory=mkdtempSync(join(tmpdir(),'mote-m12-'));let node=await buildApp({dataDir:directory});
 t.after(async()=>{await node.app.close();rmSync(directory,{recursive:true,force:true});});
 const {request,ok}=queryHttp(()=>node),users=await queryAccounts(node,ok);
 return {get node(){return node;},directory,request,ok,...users,restart:async()=>{await node.app.close();node=await buildApp({dataDir:directory});}};
}

test('actual accounts HTTP todo IDs, create receipts, CAS and signed pages are private across restart',async t=>{
 const f=await fixture(t),id=randomUUID(),input={id,title:'Generated A task'};
 const created=await f.request(f.a.token,'/api/todos','POST',input);
 assert.equal(created.statusCode,201,created.body);
 const first=created.json();assert.equal(first.dueAt,null);assert.equal(first.version,1);
 assert.deepEqual((await f.request(f.a.token,'/api/todos','POST',input)).json(),first);
 assert.equal((await f.request(f.a.token,'/api/todos','POST',{...input,title:'conflicting'})).statusCode,409);
 assert.equal((await f.request(f.b.token,'/api/todos/'+id,'PATCH',{version:1,status:'completed'})).statusCode,404);
 assert.equal((await f.request(f.b.token,'/api/todos','POST',{id,title:'Generated B task'})).statusCode,201);
 await f.ok(f.a.token,'/api/todos/'+id,'PATCH',{version:1,status:'completed'});
 assert.equal((await f.request(f.a.token,'/api/todos/'+id,'PATCH',{version:1,status:'cancelled'})).statusCode,409);
 for(let i=0;i<3;i++)assert.equal((await f.request(f.a.token,'/api/todos','POST',{title:'Generated A '+i})).statusCode,201);
 const page=await f.ok(f.a.token,'/api/todos?limit=1');assert.ok(page.nextCursor);
 assert.equal((await f.request(f.b.token,'/api/todos?limit=1&cursor='+encodeURIComponent(page.nextCursor))).statusCode,400);
 assert.equal((await f.request(f.a.token,'/api/todos','POST',{title:'forged',ownerId:f.b.userId})).statusCode,401);
 await f.restart();
 assert.equal((await f.ok(f.b.token,'/api/todos')).items[0].title,'Generated B task');
 assert.equal((await f.ok(f.a.token,'/api/todos?status=completed')).items[0].id,id);
 assert.deepEqual((await f.request(f.a.token,'/api/todos','POST',input)).json(),{...first,version:2,status:'completed',updatedAt:(await f.ok(f.a.token,'/api/todos?status=completed')).items[0].updatedAt});
});

test('actual Actions settings and equal device/calendar targets are owner bound and grants stay separate',async t=>{
 const f=await fixture(t);
 const before=await f.request(f.a.token,'/api/actions');assert.equal(before.statusCode,200,before.body);
 const a=before.json();assert.equal(a.settings.enabled,false);
 const settings={enabled:false,timeZone:'UTC',reviewDeviceIds:['same-device']};
 await f.ok(f.a.token,'/api/actions/settings','PUT',{revision:a.revision,authorizationRevision:a.authorizationRevision,settings});
 for(const [user,label] of [[f.a,'A'],[f.b,'B']] as const)await f.ok(user.token,'/api/actions/targets','POST',{deviceId:'same-device',deviceName:'Generated '+label,calendars:[{id:'same-calendar',title:'Generated '+label}]});
 const av=await f.ok(f.a.token,'/api/actions'),bv=await f.ok(f.b.token,'/api/actions');
 assert.deepEqual(av.settings.reviewDeviceIds,['same-device']);assert.deepEqual(bv.settings.reviewDeviceIds,[]);
 assert.equal(av.targets[0].deviceName,'Generated A');assert.equal(bv.targets[0].deviceName,'Generated B');
 assert.equal((await f.request(f.a.token,'/api/actions/targets','POST',{ownerId:f.b.userId,deviceId:'same-device',deviceName:'forged',calendars:[]})).statusCode,401);
 await f.restart();assert.equal((await f.ok(f.a.token,'/api/actions')).settings.timeZone,'UTC');
});
