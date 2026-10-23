import test,{type TestContext} from 'node:test';
import assert from 'node:assert/strict';
import {getEventListeners} from 'node:events';
import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {setTimeout as delay} from 'node:timers/promises';
import {WorkerPluginRuntime} from '../src/plugin-runtime.js';

// Real generated child: deliberately returns success after cancellation so the
// regression tests both cooperative notification and the host's late fence.
const provider=String.raw`
import {access,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';
const exists=async path=>{try{await access(path);return true;}catch{return false;}};
export async function createMemoryProvider(config){
 if(config.holdInit){await writeFile(join(config.directory,'initializing'),'');while(!await exists(join(config.directory,'initialize-release')))await delay(5);}
 const state={active:[],aborted:[],completed:[]};
 return {async health(params){if(params.crash)process.exit(1);if(params.closeOutput){process.stdout.end();await new Promise(()=>{});}return state;},async put(params,signal){
  state.active.push(params.id);const aborted=()=>state.aborted.push(params.id);signal.addEventListener('abort',aborted,{once:true});
  try{while(!await exists(join(config.directory,params.id+'-release')))await delay(5);state.completed.push(params.id);return {id:params.id};}
  finally{signal.removeEventListener('abort',aborted);state.active=state.active.filter(id=>id!==params.id);}
 },async close(){}};
}`;
async function fixture(t:TestContext,holdInit=false){
 const directory=await mkdtemp(join(tmpdir(),'mote-plugin-cancel-')),entry=join(directory,'provider.mjs');await writeFile(entry,provider);
 const runtime=new WorkerPluginRuntime(entry,{directory,holdInit},directory);
 t.after(async()=>{await runtime.close();await rm(directory,{recursive:true,force:true});});return {directory,runtime};
}
async function until(check:()=>Promise<boolean>,label:string){
 const deadline=Date.now()+5000;while(!await check()){if(Date.now()>deadline)throw Error('Generated worker did not reach '+label);await delay(5);}
}
const state=(runtime:WorkerPluginRuntime)=>runtime.call('health',{}) as Promise<{active:string[];aborted:string[];completed:string[]}>;
const pendingCount=(runtime:WorkerPluginRuntime)=>(runtime as unknown as {pending:Map<number,unknown>}).pending.size;

test('cancellation reaches the actual child, fences ignored late success, and leaves a concurrent request intact',async t=>{
 const {directory,runtime}=await fixture(t),first=new AbortController(),second=new AbortController();
 const firstResult=runtime.call('put',{id:'first'},first.signal);const firstRejected=assert.rejects(firstResult,/revoked.*reconciliation/i);
 const secondResult=runtime.call('put',{id:'second'},second.signal);
 await until(async()=>{const current=await state(runtime);return current.active.includes('first')&&current.active.includes('second');},'both pending calls');
 first.abort();await firstRejected;
 await until(async()=>(await state(runtime)).aborted.includes('first'),'worker abort notification');
 assert.deepEqual((await state(runtime)).aborted,['first']);
 assert.equal(getEventListeners(first.signal,'abort').length,0);
 await writeFile(join(directory,'second-release'),'');assert.deepEqual(await secondResult,{id:'second'});
 assert.equal(getEventListeners(second.signal,'abort').length,0);
 await writeFile(join(directory,'first-release'),'');
 await until(async()=>(await state(runtime)).completed.includes('first'),'ignored late success');
 assert.equal(pendingCount(runtime),0,'late child completion cannot restore a cancelled promise or pending slot');
 assert.deepEqual((await state(runtime)).aborted,['first'],'one request cancellation does not abort its sibling');
});

test('a caller can cancel while initialization is held without cancelling shared initialization or sending its operation',async t=>{
 const {directory,runtime}=await fixture(t,true),controller=new AbortController();
 const result=runtime.call('put',{id:'never-issued'},controller.signal),rejected=assert.rejects(result,/revoked/);
 await until(async()=>{try{await readFile(join(directory,'initializing'));return true;}catch{return false;}},'held initialization');
 controller.abort();await rejected;assert.equal(getEventListeners(controller.signal,'abort').length,0);
 assert.equal(pendingCount(runtime),1,'only shared initialization remains');
 await writeFile(join(directory,'initialize-release'),'');assert.deepEqual(await state(runtime),{active:[],aborted:[],completed:[]});
 assert.equal(pendingCount(runtime),0);
});

test('close settles live calls, removes abort listeners, and rejects further requests',async t=>{
 const {runtime}=await fixture(t),controller=new AbortController();
 const result=runtime.call('put',{id:'closing'},controller.signal),rejected=assert.rejects(result,/unavailable.*recover/);
 await until(async()=>(await state(runtime)).active.includes('closing'),'held operation');
 await runtime.close();await rejected;assert.equal(getEventListeners(controller.signal,'abort').length,0);assert.equal(pendingCount(runtime),0);
 await assert.rejects(runtime.call('health',{}),/closed/);
});

test('an exited worker settles every outstanding request and removes each cancellation listener',async t=>{
 const {runtime}=await fixture(t),first=new AbortController(),second=new AbortController();
 const pending=runtime.call('put',{id:'lost'},first.signal),rejected=assert.rejects(pending,/unavailable.*recover/);
 await until(async()=>(await state(runtime)).active.includes('lost'),'operation before process failure');
 const crashed=assert.rejects(runtime.call('health',{crash:true},second.signal),/unavailable.*recover/);
 await Promise.all([rejected,crashed]);assert.equal(pendingCount(runtime),0);
 for(const controller of [first,second])assert.equal(getEventListeners(controller.signal,'abort').length,0);
 await runtime.close();await assert.rejects(runtime.call('health',{}),/closed/);
});

test('a lost worker output channel fails live work even while its process remains alive',async t=>{
 const {runtime}=await fixture(t),controller=new AbortController();
 const pending=runtime.call('put',{id:'lost-output'},controller.signal),rejected=assert.rejects(pending,/unavailable.*recover/);
 await until(async()=>(await state(runtime)).active.includes('lost-output'),'operation before output failure');
 await Promise.all([rejected,assert.rejects(runtime.call('health',{closeOutput:true}),/unavailable.*recover/)]);
 assert.equal(pendingCount(runtime),0);assert.equal(getEventListeners(controller.signal,'abort').length,0);
 await runtime.close();
});

test('failed initialization before a caller arrives is observed and teardown still finishes',async t=>{
 const directory=await mkdtemp(join(tmpdir(),'mote-plugin-init-failure-')),runtime=new WorkerPluginRuntime(join(directory,'missing.mjs'),{},directory);
 t.after(async()=>{await runtime.close();await rm(directory,{recursive:true,force:true});});
 await until(async()=>pendingCount(runtime)===0,'initialization failure');
 await assert.rejects(runtime.call('health',{}),/operation failure/);await runtime.close();
});
