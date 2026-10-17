/** Generated production Operations/Queues/KEEP fixture for hidden renderer regression. */
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {setTimeout as delay} from 'node:timers/promises';
import {keepFixture} from '../../../server/test/fixtures/keep-controls.js';
import {ExecutionFailure} from '../../../server/src/execution-engine.js';
import {EXECUTION_POLICIES} from '../../../server/src/execution-policy.js';
import {requestContext} from '../../../server/src/scope/http.js';
const cleanups:Array<()=>unknown>=[];
const actors=new WeakMap<object,string>();
const mutations:Array<{actor:string;path:string;status:number;body:unknown}>=[];
let dropIndexAcknowledgements=false,closing=false;
const gates=new Map<string,()=>void>();
const f=await keepFixture({after:(fn:()=>unknown)=>cleanups.push(fn)} as any,node=>{
 node.app.addHook('preHandler',async req=>{
  if(!['POST','PUT','PATCH','DELETE'].includes(req.method)||!/^\/api\/(tasks|admin\/index)/.test(req.url))return;
  try{const c=await requestContext(req,node.authority,node.accounts);actors.set(req,c.userId);}catch{}
 });
 node.app.addHook('onSend',async(req,reply,payload)=>{
  if(['POST','PUT','PATCH','DELETE'].includes(req.method)&&/^\/api\/(tasks|admin\/index)/.test(req.url)){
   mutations.push({actor:actors.get(req)??'unresolved',path:req.url,status:reply.statusCode,body:req.body});
   if(req.url==='/api/admin/index/rebuild'&&reply.statusCode===200&&dropIndexAcknowledgements){reply.raw.destroy();}
  }
  return payload;
 });
});
const kind='processing.generated-hold',unknownKind='processing.generated-unknown',lockKind='keep.index-lock';
const parseInput=(raw:any)=>{assert.equal(typeof raw.label,'string');return {label:raw.label};};
const hold=async(key:string,signal:AbortSignal)=>{if(signal.aborted)return;await new Promise<void>(resolve=>{let done=false;const end=()=>{if(done)return;done=true;gates.delete(key);signal.removeEventListener('abort',end);resolve();};gates.set(key,end);signal.addEventListener('abort',end,{once:true});});};
f.node.execution!.register({kind,pool:kind,concurrency:()=>1,policy:EXECUTION_POLICIES.modelCall,parseInput,execute:async run=>{run.progress({label:run.task.input.label});await hold('slow:'+run.context.userId,run.signal);return {generated:true};}});
f.node.execution!.register({kind:unknownKind,pool:unknownKind,concurrency:()=>2,policy:EXECUTION_POLICIES.control,parseInput,execute:async run=>{run.external.begin('generated-only-unknown-outcome');return {generated:true};}});
f.node.execution!.register({kind:lockKind,pool:lockKind,concurrency:()=>1,policy:EXECUTION_POLICIES.control,parseInput,resources:()=>[{scope:'shared',key:'lexical-index-maintenance'}],execute:async run=>{await hold('index',run.signal);return {generated:true};}});
const checked=async(account:any,path:string,method='GET',body?:unknown)=>{const r=await f.request(account.token,path,method,body);assert.equal(r.status,200,r.text);return r.json();};
const tries=new Map<string,number>();
const retryKind='processing.generated-retry';
f.node.execution!.register({kind:retryKind,pool:retryKind,concurrency:()=>2,policy:EXECUTION_POLICIES.control,parseInput,execute:async run=>{const n=(tries.get(run.context.userId)??0)+1;tries.set(run.context.userId,n);if(n===1)throw new ExecutionFailure('permanent','generated_retry_fixture_failure');return {generated:true,retried:true};}});
const receipts:any={};
for(const [name,account] of [['a',f.a],['b',f.b]] as const){
 receipts[name]={slow:await checked(account,'/api/tasks','POST',{kind,operationId:'same-generated-operation',input:{label:'GENERATED_'+name.toUpperCase()}}),unknown:await checked(account,'/api/tasks','POST',{kind:unknownKind,operationId:'same-generated-unknown',input:{label:'GENERATED_'+name.toUpperCase()}})};
}
for(const [name,account] of [['a',f.a],['b',f.b]] as const)receipts[name].retry=await checked(account,'/api/tasks','POST',{kind:retryKind,operationId:'same-generated-retry',input:{label:'GENERATED_'+name.toUpperCase()}});
receipts.indexLock=await checked(f.admin,'/api/tasks','POST',{kind:lockKind,operationId:'generated-index-lock',input:{label:'GENERATED_INDEX_LOCK'}});
for(let i=0;i<150;i++){const a=await checked(f.a,'/api/tasks/'+receipts.a.unknown.id),b=await checked(f.b,'/api/tasks/'+receipts.b.unknown.id);if(a.state==='blocked'&&b.state==='blocked'&&gates.has('index'))break;if(i===149)throw Error('Generated tasks did not settle');await delay(20);}
assert.notEqual(receipts.a.slow.id,receipts.b.slow.id);
assert.equal((await f.request(f.b.token,'/api/tasks/'+receipts.a.slow.id)).status,404);
const labels=new Map([[f.a.userId,'a'],[f.b.userId,'b'],[f.admin.userId,'admin']]);
const snapshot=async()=>({generated:true,gates:[...gates.keys()].map(key=>key.startsWith('slow:')?'slow:'+labels.get(key.slice(5)):key),dropIndexAcknowledgements,mutations:mutations.map(v=>({...v,actor:labels.get(v.actor)??'unresolved'})),a:{tasks:await checked(f.a,'/api/tasks'),queues:await checked(f.a,'/api/tasks/queues'),steps:await checked(f.a,'/api/tasks/steps')},b:{tasks:await checked(f.b,'/api/tasks'),queues:await checked(f.b,'/api/tasks/queues'),steps:await checked(f.b,'/api/tasks/steps')},index:await checked(f.admin,'/api/admin/index')});
const control=createServer((req,res)=>{void(async()=>{
 for await(const _ of req){}
 if(req.url==='/generated/arm-index-ack-loss'&&req.method==='POST')dropIndexAcknowledgements=true;
 else if(req.url==='/generated/release-index-ack-loss'&&req.method==='POST')dropIndexAcknowledgements=false;
 else if(req.url==='/generated/release-index'&&req.method==='POST')gates.get('index')?.();
 else if(req.url==='/generated/release-slow'&&req.method==='POST'){for(const [key,release]of gates)if(key.startsWith('slow:'))release();}
 else if(req.url==='/generated/settle'&&req.method==='POST')await settle();
 else if(req.url==='/generated/close'&&req.method==='POST'){res.end('{"closing":true}');setTimeout(()=>void close(),20);return;}
 else if(req.url!=='/generated/status'){res.statusCode=404;res.end();return;}
 res.setHeader('content-type','application/json');res.end(JSON.stringify(await snapshot()));
})().catch(()=>{res.statusCode=500;res.end('{"error":"generated_control_failed"}');});});
await new Promise<void>(resolve=>control.listen(0,'127.0.0.1',resolve));
const address=control.address();assert.ok(address&&typeof address!=='string');
const safe={generatedOnly:true,origin:f.origin,control:'http://127.0.0.1:'+address.port,pid:process.pid,usernames:['generated-admin','generated-a','generated-b'],password:'Generated-only-password-2026',receipts:{a:{slow:receipts.a.slow.id,unknown:receipts.a.unknown.id,retry:receipts.a.retry.id},b:{slow:receipts.b.slow.id,unknown:receipts.b.unknown.id,retry:receipts.b.retry.id},indexLock:receipts.indexLock.id}};
console.log(JSON.stringify(safe));
async function settle(){
 // A's released pool slot can start B after the first release. Observe both
 // actual terminal receipts and empty live gates rather than assuming shutdown.
 for(let attempt=0;attempt<250;attempt++){
  for(const release of [...gates.values()])release();
  const states=await Promise.all([[f.a,receipts.a.slow.id],[f.b,receipts.b.slow.id],[f.admin,receipts.indexLock.id]].map(async([actor,id])=>(await checked(actor,'/api/tasks/'+id)).state));
  if(!gates.size&&states.every(state=>['succeeded','cancelled','failed'].includes(state)))return;
  await delay(20);
 }
 throw Error('Generated holders did not reach terminal states before close');
}
async function close(){
 if(closing)return;closing=true;dropIndexAcknowledgements=false;await settle();
 control.closeAllConnections();await new Promise<void>(resolve=>control.close(()=>resolve()));
 for(const fn of cleanups.reverse())await fn();
 console.log(JSON.stringify({generatedOnly:true,closed:true,mutations:mutations.map(v=>({...v,actor:labels.get(v.actor)??'unresolved'}))}));process.exit(0);
}
process.on('SIGINT',()=>void close());process.on('SIGTERM',()=>void close());
