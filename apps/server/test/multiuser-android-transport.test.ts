import test,{type TestContext} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {randomUUID} from 'node:crypto';
import {gzipSync} from 'node:zlib';
import {buildApp} from '../src/app.js';
const password='Generated-M15-transport-only-01';
const headers={'x-mote-protocol-version':'2','x-mote-ingress-version':'3'};
async function fixture(t:TestContext){
 const directory=mkdtempSync(join(tmpdir(),'m15-transport-'));const node=await buildApp({dataDir:directory});
 t.after(async()=>{await node.app.close();rmSync(directory,{recursive:true,force:true});});await node.accounts!.initialize('generated-admin',password);
 const request=(token:string|undefined,url:string,method:any='GET',payload?:unknown,extra={})=>node.app.inject({url,method,headers:{...headers,...(token?{authorization:'Bearer '+token}:{}),...extra},...(payload===undefined?{}:{payload})});
 const login=async(username:string)=>(await request(undefined,'/api/auth/login','POST',{username,password,mode:'client'})).json();
 const admin=await login('generated-admin');
 for(const username of ['generated-a','generated-b'])assert.equal((await request(admin.token,'/api/admin/accounts','POST',{username,password})).statusCode,200);
 const users=await Promise.all(['generated-a','generated-b'].map(login));
 const devices=await Promise.all(users.map(async user=>{const response=await request(user.token,'/api/login/session','POST',{serverUrl:'http://127.0.0.1:47842',deviceId:'same-device',deviceName:'Generated Android',platform:'android'});assert.equal(response.statusCode,200,response.body);return response.json();}));
 const source={id:'same-source',name:'Generated Android',deviceId:'same-device',kind:'custom',platform:'android',retention:'snapshot'};
 for(const device of devices)assert.equal((await request(device.token,'/api/ingress/sources','POST',source)).statusCode,200);
 const capture=(id=randomUUID(),text='Generated private input')=>({id,deviceId:'same-device',deviceName:'Generated Android',platform:'android',capturedAt:'2026-01-01T00:00:00Z',durationMs:0,source:'note',ocrText:text});
 return {node,request,users,devices,source,capture};
}

test('Android compressed JSONL feeds real Ingress3 batch receipt with equal device and capture IDs for A/B',async t=>{
 const f=await fixture(t),input=f.capture();const bytes=gzipSync(Buffer.from(JSON.stringify(input)+'\n'));
 for(const [index,device] of f.devices.entries()){
  const response=await f.request(device.token,'/api/ingress/sources/same-source/captures','POST',bytes,{'content-type':'application/x-ndjson+gzip','x-mote-batch-id':'same-batch'});
  assert.equal(response.statusCode,200,response.body);const result=response.json();assert.equal(result.version,3);assert.equal(result.userId,f.users[index].userId);assert.equal(result.batchId,'same-batch');assert.deepEqual(result.captures,[{id:input.id,duplicate:false}]);
 }
 assert.equal((await f.request(f.devices[0].token,'/api/ingress/sources/same-source/captures','POST',bytes,{'content-type':'application/x-ndjson+gzip','x-mote-batch-id':'wrong-version','x-mote-ingress-version':'2'})).statusCode,426);
 const invalid=await f.request(f.devices[0].token,'/api/ingress/sources/same-source/captures','POST',Buffer.from('not gzip'),{'content-type':'application/x-ndjson+gzip','x-mote-batch-id':'broken'});assert.equal(invalid.statusCode,400);
});

test('actual device heartbeat and reconciliation remain account/device scoped and never act as ACK',async t=>{
 const f=await fixture(t);const a=f.devices[0].token,b=f.devices[1].token;const input=f.capture();
 assert.equal((await f.request(a,'/api/ingress/sources/same-source/captures','POST',{batchId:'first',items:[input]})).statusCode,200);
 const body={deviceId:'same-device',deviceName:'Generated A Android',platform:'android',status:'paused',queueDepth:7,sync:{mode:'manual',state:'idle',intervalMinutes:1,batchSize:100,pendingRecords:1}};
 const heartbeat=await f.request(a,'/api/ingress/devices/heartbeat','POST',body);assert.equal(heartbeat.statusCode,200,heartbeat.body);assert.equal(heartbeat.json().ok,true);
 assert.equal((await f.request(a,'/api/ingress/devices/heartbeat','POST',{...body,deviceId:'other-device'})).statusCode,403);
 assert.equal((await f.request(a,'/api/ingress/devices','POST',{id:'same-device',name:'Generated renamed',platform:'android'})).statusCode,200);
 const own=await f.request(f.users[0].token,'/api/ingress/devices');assert.equal(own.json().items[0].queueDepth,7);assert.equal(own.json().items[0].name,'Generated renamed');
 const reconcile=(token:string,device='same-device')=>f.request(token,`/api/ingress/devices/${device}/reconcile`,'POST',{ids:[input.id,randomUUID()]});
 const ar=await reconcile(a);assert.equal(ar.statusCode,200,ar.body);assert.equal(ar.json().items[0].state,'present');assert.equal(ar.json().items[1].state,'unavailable');assert.ok(!ar.body.includes('receipt'));
 const br=await reconcile(b);assert.equal(br.statusCode,200,br.body);assert.ok(br.json().items.every((v:any)=>v.state==='unavailable'));
 assert.equal((await reconcile(a,'other-device')).statusCode,403);
 const listed=await f.request(f.users[1].token,'/api/ingress/devices');assert.equal(listed.statusCode,200);assert.ok(!listed.body.includes('Generated A Android'));
 assert.equal((await f.request(a,'/api/captures/'+input.id)).statusCode,403);
 assert.equal((await f.request(a,'/api/ingress/devices/heartbeat','POST',{...body,userId:f.users[1].userId})).statusCode,401);
});
