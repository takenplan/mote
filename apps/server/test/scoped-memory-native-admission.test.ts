import test from 'node:test';
import assert from 'node:assert/strict';
import {setTimeout as delay} from 'node:timers/promises';
import {scopedMemoryFixture} from './fixtures/scoped-memory-host.js';
import {generatedHindsightRelease} from './fixtures/scoped-memory-release.js';
import {hindsightHttpFixture} from './fixtures/hindsight-http.js';
const deferred=()=>{let resolve!:()=>void;const promise=new Promise<void>(done=>resolve=done);return {promise,resolve};};

test('each native relay model call shares Memory admission across accounts without metering capacity waiting',{timeout:45000},async t=>{
 const release=deferred(),entered=deferred();t.after(()=>release.resolve());const native=await hindsightHttpFixture();t.after(()=>native.close());const f=await scopedMemoryFixture(t,generatedHindsightRelease(),native.runtimeFactory),pkg=await f.install(),materials=[];
 for(const [user,owner]of [[f.a,'A'],[f.b,'B']]as const){materials.push(await f.publish(user,owner));await f.plugin(user,pkg,['same-source'],{modelProfileId:'personal:same-model'},['engine']);await f.bind(user,'same-instance');}
 const {queues:_,scope:__,revision,...settings}=(await f.request(f.admin.token,'/api/admin/execution-settings')).json(),configured=await f.request(f.admin.token,'/api/admin/execution-settings','PUT',{...settings,revision,llmConcurrency:1,agentConcurrency:1,memoryConcurrency:1});assert.equal(configured.statusCode,200,configured.body);
 const beforeB=(await f.request(f.b.token,'/api/usage')).json().items.length;let active=0,peak=0;const nativeCalls:string[]=[];native.faults.beforeSemantic=async userId=>{nativeCalls.push(userId);active++;peak=Math.max(peak,active);entered.resolve();await release.promise;active--;};
 const a=await f.submit(f.a,[materials[0].id]);await entered.promise;const b=await f.submit(f.b,[materials[1].id]);
 const end=Date.now()+10000;let queued=false;while(Date.now()<end){const view=(await f.request(f.admin.token,'/api/admin/execution-settings')).json();if(view.queues.memory.waiting===1){queued=true;break;}if(peak>1)break;await delay(10);}
 assert.equal(peak,1,'native requests use the same physical model limit as Agent queries');assert.equal(queued,true,'the other owner waits in real Memory model admission');assert.equal((await f.request(f.b.token,'/api/usage')).json().items.length,beforeB,'unissued native waiting has no execution-time fragment');release.resolve();await Promise.all([f.wait(f.a,a.id),f.wait(f.b,b.id)]);assert.equal(peak,1);assert.ok(nativeCalls.includes(f.a.userId)&&nativeCalls.includes(f.b.userId));
});
