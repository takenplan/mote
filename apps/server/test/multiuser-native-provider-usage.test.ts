import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {setTimeout as delay} from 'node:timers/promises';
import {scopedMemoryFixture} from './fixtures/scoped-memory-host.js';
import {generatedHindsightRelease,generatedMem0Release} from './fixtures/scoped-memory-release.js';
import {hindsightHttpFixture} from './fixtures/hindsight-http.js';
import {defaultModelSettings} from '../src/model-settings.js';
import type {HindsightRuntimeFactory} from '../src/scope/memory-providers.js';

const deferred=()=>{let resolve!:()=>void;return {promise:new Promise<void>(ready=>resolve=ready),resolve:()=>resolve()};};
const nativeUsage=async(f:Awaited<ReturnType<typeof scopedMemoryFixture>>,token:string)=>(await f.request(token,'/api/usage')).json().items.filter((item:any)=>item.attribution.agentId==='memory-provider');

for(const revoke of ['cancel','model'] as const)test('native Hindsight '+revoke+' retires a directly owned usage fragment and preserves its reported sample',async t=>{
 const native=await hindsightHttpFixture();t.after(()=>native.close());const entered=deferred(),release=deferred();let hold=false;t.after(release.resolve);
 // The generated native HTTP transport reports an in-flight cumulative sample
 // before its response. Keep the real Hindsight engine, M04 lease and M05 task.
 const runtimeFactory:HindsightRuntimeFactory=options=>native.runtimeFactory({...options,assertModelAuthority:async request=>{
  await options.assertModelAuthority?.(request);
  if(hold){hold=false;options.onUsage?.({measurement:'thread_cumulative',complete:true,requests:0,reportedRequests:0,inputTokens:10,outputTokens:5,totalTokens:15,cacheReadTokens:0,cacheWriteTokens:0},request);entered.resolve();await release.promise;}
 }});
 const f=await scopedMemoryFixture(t,generatedHindsightRelease(),runtimeFactory),pkg=await f.install();await f.plugin(f.a,pkg,['same-source'],{modelProfileId:'personal:same-model'},['engine']);await f.bind(f.a,'same-instance');const before=new Set((await nativeUsage(f,f.a.token)).map((item:any)=>item.id));
 hold=true;const job=await f.submit(f.a,[(await f.publish(f.a,'A')).id]);await entered.promise;const running=(await nativeUsage(f,f.a.token)).filter((item:any)=>!before.has(item.id));assert.equal(running.length,1);assert.equal(running[0].status,'running');assert.equal(running[0].tokens.totalTokens,15);
 if(revoke==='cancel'){const response=await f.request(f.a.token,'/api/memory/jobs/'+job.id+'/cancel','POST',{});assert.equal(response.statusCode,200,response.body);}else await f.replace(f.a.token,'models',{profiles:[],selections:{}});
 release.resolve();const end=Date.now()+10000;let receipts:any[]=[];for(;;){receipts=(await nativeUsage(f,f.a.token)).filter((item:any)=>!before.has(item.id));if(receipts.length===1&&receipts[0].status!=='running')break;assert.ok(Date.now()<end,JSON.stringify(receipts));await delay(10);}
 assert.equal(receipts[0].id,running[0].id);assert.equal(receipts[0].status,'failed');assert.equal(receipts[0].issuance.state,'settled');assert.equal(receipts[0].tokens.totalTokens,15);assert.equal(receipts[0].tokens.complete,false);assert.equal(receipts[0].estimatedCost,null);assert.equal((await nativeUsage(f,f.b.token)).length,0);
});

test('native Mem0 model revocation retires the existing opaque embedding fragment after the real SDK request returns',async t=>{
 const entered=deferred(),release=deferred();let hold=false,calls=0;t.after(release.resolve);
 const embedding=createServer(async(req,res)=>{let raw='';for await(const chunk of req)raw+=chunk;calls++;const body=JSON.parse(raw),inputs=Array.isArray(body.input)?body.input:[body.input];if(hold){hold=false;entered.resolve();await release.promise;}res.setHeader('content-type','application/json');res.end(JSON.stringify({object:'list',model:'generated-embedding',data:inputs.map((_:unknown,index:number)=>({object:'embedding',index,embedding:[1,0,0]}))}));});await new Promise<void>(resolve=>embedding.listen(0,'127.0.0.1',resolve));t.after(async()=>{embedding.closeAllConnections();await new Promise<void>(resolve=>embedding.close(()=>resolve()));});
 const embeddingBaseUrl='http://127.0.0.1:'+(embedding.address() as any).port+'/v1',f=await scopedMemoryFixture(t,generatedMem0Release()),pkg=await f.install();
 await f.replace(f.a.token,'models',{profiles:[{id:'same-model',name:'Generated language',settings:{...defaultModelSettings(),provider:'custom',protocol:'anthropic-messages',model:'generated-memory',baseUrl:f.modelUrl,apiKey:'GENERATED_A_KEY',headers:{},extraBody:{}}},{id:'same-embedding',name:'Generated embedding',settings:{...defaultModelSettings(),provider:'custom',protocol:'openai-completions',model:'generated-embedding',baseUrl:embeddingBaseUrl,apiKey:'GENERATED_EMBEDDING_KEY',headers:{},extraBody:{}}}],selections:{memory:{kind:'personal',id:'same-model'}}});
 await f.plugin(f.a,pkg,['same-source'],{embeddingBaseUrl,embeddingModel:'generated-embedding',embeddingDimension:3,embeddingSecretReference:'personal:same-embedding'});await f.wait(f.a,(await f.submit(f.a,[(await f.publish(f.a,'A')).id])).id);await f.bind(f.a,'same-instance');const before=new Set((await nativeUsage(f,f.a.token)).map((item:any)=>item.id)),priorCalls=calls;
 hold=true;const pending=f.request(f.a.token,'/api/memories?query=tea').then(response=>response);await entered.promise;const running=(await nativeUsage(f,f.a.token)).filter((item:any)=>!before.has(item.id));assert.equal(running.length,1);assert.equal(running[0].status,'running');await f.replace(f.a.token,'models',{profiles:[],selections:{}});release.resolve();assert.equal((await pending).statusCode,401,'the in-flight captured model authority is revoked');
 const receipts=(await nativeUsage(f,f.a.token)).filter((item:any)=>!before.has(item.id));assert.equal(receipts.length,1);assert.equal(receipts[0].id,running[0].id);assert.equal(receipts[0].status,'failed');assert.equal(receipts[0].issuance.state,'settled');assert.equal(receipts[0].tokens,undefined,'the opaque SDK cannot invent token counts');assert.equal(receipts[0].estimatedCost,null);assert.equal(calls,priorCalls+1,'retirement cannot send another embedding request');assert.equal((await nativeUsage(f,f.b.token)).length,0);
});
