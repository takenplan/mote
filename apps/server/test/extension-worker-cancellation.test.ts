import test,{type TestContext} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,readFileSync,existsSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {setTimeout as delay} from 'node:timers/promises';
import {WorkerPluginRuntime} from '../src/plugin-runtime.js';

const deferred=<T=void>()=>{let resolve!:(value:T)=>void,reject!:(error:unknown)=>void;const promise=new Promise<T>((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};};
async function bounded<T>(promise:Promise<T>){let timer:ReturnType<typeof setTimeout>|undefined;try{return await Promise.race([promise,new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(Error('Generated cooperative cancellation did not settle')),2000);})]);}finally{clearTimeout(timer);}}
const code=String.raw`
import {writeFile} from 'node:fs/promises';
export function createMotePlugin(){return {
 components:[{id:'generated.wait',version:'1',surface:'ingress',capability:'source',async invoke(input,host,signal){
  if(input.mode==='fire')void host.call('deferred',[]).catch(()=>{});
  await host.call('entered',[input.key]);
  if(input.mode==='sibling'){await host.call('release',[]);return {aborted:signal.aborted,pid:process.pid};}
  if(!signal.aborted)await new Promise(resolve=>signal.addEventListener('abort',resolve,{once:true}));
  await writeFile('cancelled-'+input.key,'observed');
  let rejected=false;try{await host.call('late',[]);}catch{rejected=true;}
  await writeFile('late-rejected-'+input.key,String(rejected));
  if(input.mode==='throw')signal.throwIfAborted();
  return {aborted:signal.aborted,pid:process.pid};
 }}],health(){return {ready:true,pid:process.pid};},close(){},
};}
`;
function fixture(t:TestContext,source=code){
 const directory=mkdtempSync(join(tmpdir(),'mote-worker-cancel-')),entry=join(directory,'plugin.mjs');
 writeFileSync(entry,source);
 const worker=new WorkerPluginRuntime(entry,{},directory);
 t.after(async()=>{await worker.close();rmSync(directory,{recursive:true,force:true});});
 return {worker,directory};
}

for(const mode of ['return','throw'])test('one worker invocation observes abort and cannot call the host after '+mode,async t=>{
 const {worker,directory}=fixture(t),entered=deferred(),controller=new AbortController();let lateCalls=0;
 const before=await worker.call('health',{}) as {pid:number};
 const result=worker.call('invoke',{componentId:'generated.wait',input:{key:mode,mode}},controller.signal,async method=>{if(method==='entered')entered.resolve();if(method==='late')lateCalls++;return {};});
 const rejection=assert.rejects(bounded(result),(error:any)=>error.statusCode===409);
 await bounded(entered.promise);controller.abort();await rejection;
 assert.equal(readFileSync(join(directory,'cancelled-'+mode),'utf8'),'observed');
 assert.equal(readFileSync(join(directory,'late-rejected-'+mode),'utf8'),'true');
 assert.equal(lateCalls,0);
 const after=await worker.call('health',{}) as {pid:number};
 assert.equal(after.pid,before.pid,'Cancelling one invocation must preserve its shared worker');
});

test('cancelling one invocation preserves an overlapping sibling and removes signal listeners',async t=>{
 const {worker,directory}=fixture(t),first=deferred(),second=deferred(),release=deferred(),controller=new AbortController();
 t.after(()=>release.resolve());
 let listeners=0;
 const add=controller.signal.addEventListener.bind(controller.signal),remove=controller.signal.removeEventListener.bind(controller.signal);
 controller.signal.addEventListener=((type:string,listener:any,options:any)=>{if(type==='abort')listeners++;return add(type,listener,options);}) as typeof controller.signal.addEventListener;
 controller.signal.removeEventListener=((type:string,listener:any,options:any)=>{if(type==='abort')listeners--;return remove(type,listener,options);}) as typeof controller.signal.removeEventListener;
 const cancelled=worker.call('invoke',{componentId:'generated.wait',input:{key:'first'}},controller.signal,async method=>{if(method==='entered')first.resolve();return {};});
 const rejected=assert.rejects(bounded(cancelled),(error:any)=>error.statusCode===409);
 const sibling=worker.call('invoke',{componentId:'generated.wait',input:{key:'second',mode:'sibling'}},undefined,async method=>{if(method==='entered')second.resolve();if(method==='release')await release.promise;return {};});
 await bounded(Promise.all([first.promise,second.promise]));controller.abort();await rejected;
 release.resolve();const result=await bounded(sibling) as {aborted:boolean};
 assert.equal(result.aborted,false);assert.equal(existsSync(join(directory,'cancelled-second')),false);assert.equal(listeners,0);
});

test('accepted host effects settle and preserve their parent failure after cooperative cancellation',async t=>{
 const {worker}=fixture(t),entered=deferred(),effect=deferred(),controller=new AbortController(),hostError=new Error('Generated private host failure');
 t.after(()=>effect.resolve());
 let settled=false;
 const result=worker.call('invoke',{componentId:'generated.wait',input:{key:'effect',mode:'fire'}},controller.signal,async method=>{
  if(method==='deferred'){await effect.promise;throw hostError;}
  if(method==='entered')entered.resolve();return {};
 }).finally(()=>{settled=true;});
 const rejected=assert.rejects(bounded(result),error=>error===hostError);
 await bounded(entered.promise);controller.abort();await delay(50);
 assert.equal(settled,false,'Accepted host work must be reconciled before the transport settles');
 effect.resolve();await rejected;
});

test('an initialization waiter can be cancelled without an unhandled failure when the scope closes',async t=>{
 const {worker}=fixture(t,'export async function createMotePlugin(){await new Promise(()=>{});}'),controller=new AbortController();
 const result=worker.call('health',{},controller.signal),rejected=assert.rejects(bounded(result),(error:any)=>error.statusCode===409);
 controller.abort();await rejected;await worker.close();
});
