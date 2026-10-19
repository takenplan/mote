import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createServer} from 'node:http';
import {setTimeout as delay} from 'node:timers/promises';
import {defaultModelSettings} from '../src/model-settings.js';
import {keepFixture} from './fixtures/keep-controls.js';
import {writeMessagesResponse} from '../../../scripts/fixtures/messages-provider.js';

const deferred=()=>{let resolve!:()=>void;const promise=new Promise<void>(r=>resolve=r);return {promise,resolve};};
async function until(check:()=>boolean|Promise<boolean>){const end=Date.now()+15000;while(!await check()){assert.ok(Date.now()<end,'bounded generated state transition timed out');await delay(10);}}

test('production startup keeps slow Insight independent of chat and hot concurrency reaches the durable scheduler',async t=>{
 const background=deferred(),interactive=deferred(),requests:{raw:string;owner:string}[]=[];
 const provider=createServer((req,res)=>{void(async()=>{
  let raw='';for await(const chunk of req)raw+=chunk;
  requests.push({raw,owner:String(req.headers['x-api-key']).includes('_A_')?'A':'B'});
  if(raw.includes('GENERATED_BACKGROUND_INSIGHT'))await background.promise;
  if(raw.includes('GENERATED_HELD_CHAT'))await interactive.promise;
  if(!res.destroyed)writeMessagesResponse(res,{stage:1,text:JSON.stringify({answer:'A generated fixture answer without archive claims.',citationIds:[]})});
 })().catch(()=>res.destroy());});
 await new Promise<void>(resolve=>provider.listen(0,'127.0.0.1',resolve));
 t.after(async()=>{background.resolve();interactive.resolve();provider.closeAllConnections();await new Promise<void>(resolve=>provider.close(()=>resolve()));});
 const f=await keepFixture(t),modelUrl='http://127.0.0.1:'+(provider.address() as {port:number}).port+'/v1';
 const ok=async(token:string,path:string,method='GET',body?:unknown)=>{const r=await f.request(token,path,method,body);assert.equal(r.status,200,r.text);return r.json();};
 for(const [user,label]of [[f.a,'A'],[f.b,'B']] as const){
  const configuration=await ok(user.token,'/api/configuration');
  await ok(user.token,'/api/configuration/models','PUT',{revision:configuration.revision,value:{profiles:[{id:'generated-model',name:'Generated lane fixture',settings:{...defaultModelSettings(),provider:'custom',protocol:'anthropic-messages',model:'generated-lanes',baseUrl:modelUrl,apiKey:'GENERATED_'+label+'_KEY',headers:{},extraBody:{}}}],selections:{chat:{kind:'personal',id:'generated-model'},insight:{kind:'personal',id:'generated-model'}}}});
 }
 let limits={interactiveConcurrency:2,agentConcurrency:2,llmConcurrency:2,memoryConcurrency:5};
 const configure=async(value:typeof limits)=>{const before=await ok(f.admin.token,'/api/admin/execution-settings');await ok(f.admin.token,'/api/admin/execution-settings','PUT',{revision:before.revision,...value});limits=value;};
 await configure(limits);
 assert.equal(f.node.execution!.engine.poolSnapshot('memory.models').background.limit,5,'the current Memory pool uses the configured value rather than a fixed two');
 const insightRuns=[{user:f.a,id:randomUUID()},{user:f.b,id:randomUUID()}];
 const backgroundCalls=()=>requests.filter(r=>r.raw.includes('GENERATED_BACKGROUND_INSIGHT'));
 try{
  for(const {user,id}of insightRuns)await ok(user.token,'/api/insight-runs','POST',{requestId:id,question:'GENERATED_BACKGROUND_INSIGHT '+id});
  await until(()=>backgroundCalls().length===2);
  assert.equal(f.node.execution!.engine.poolSnapshot('ask.models').background.running,2);
  for(let i=0;i<6;i++){
   const user=i%2?f.b:f.a,id=randomUUID();
   await ok(user.token,'/api/query-runs','POST',{id,input:{question:'GENERATED_FREE_CHAT '+i}});
   await until(async()=>(await ok(user.token,'/api/query-runs/'+id)).status==='completed');
  }
  for(const {user,id}of insightRuns)assert.equal((await ok(user.token,'/api/insight-runs/'+id)).status,'running','background transport stays held while chats complete');

  const heldCalls=()=>requests.filter(r=>r.raw.includes('GENERATED_HELD_CHAT'));
  const chats=Array.from({length:4},(_,i)=>({user:i%2?f.b:f.a,id:randomUUID()}));
  for(const {user,id}of chats)await ok(user.token,'/api/query-runs','POST',{id,input:{question:'GENERATED_HELD_CHAT '+id}});
  await until(()=>heldCalls().length===2);
  assert.deepEqual(new Set(heldCalls().map(call=>call.owner)),new Set(['A','B']),'both accounts receive their fair turn');
  assert.deepEqual(f.node.execution!.engine.poolSnapshot('ask.models').interactive,{limit:2,running:2,waiting:2});
  await configure({...limits,interactiveConcurrency:4});
  await until(()=>heldCalls().length===4);
  assert.equal(f.node.execution!.engine.poolSnapshot('ask.models').interactive.running,4,'saving four interactive slots reaches four actual model requests');
  await configure({...limits,interactiveConcurrency:1});
  const cancelled=randomUUID();await ok(f.a.token,'/api/query-runs','POST',{id:cancelled,input:{question:'GENERATED_HELD_CHAT_CANCELLED '+cancelled}});
  await until(()=>f.node.execution!.engine.poolSnapshot('ask.models').interactive.waiting===1);
  const pending=f.node.execution!.engine.list({userId:f.a.userId,kind:'ask.chat',state:'waiting'}).items.find(step=>step.input.runId===cancelled)!;
  assert.equal(pending.attempts,0,'durable capacity waiting consumes no processing failure attempt');
  await ok(f.a.token,'/api/query-runs/'+cancelled+'/cancel','POST',{});
  interactive.resolve();
  for(const {user,id}of chats)await until(async()=>(await ok(user.token,'/api/query-runs/'+id)).status==='completed');
  assert.equal(heldCalls().length,4,'cancelled queued work never issues after the capacity returns');
  assert.equal((await ok(f.a.token,'/api/query-runs/'+cancelled)).status,'cancelled');
 }finally{
  interactive.resolve();for(const {user,id}of insightRuns)await ok(user.token,'/api/insight-runs/'+id+'/cancel','POST',{});background.resolve();
 }
 await f.restart();
 assert.equal(f.node.execution!.engine.poolSnapshot('ask.models').interactive.limit,1,'restart restores the saved instance limit');
 assert.equal(f.node.execution!.engine.poolSnapshot('memory.models').background.limit,5);
 assert.ok(requests.every(call=>!call.raw.includes('GENERATED_A_KEY')&&!call.raw.includes('GENERATED_B_KEY')));
});
