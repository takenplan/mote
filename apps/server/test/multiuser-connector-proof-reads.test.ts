import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {recordingPhaseHost} from './fixtures/recording-phase-host.js';

test('warmed connector plugin proofs observe release and committed generations without changing retained bindings or the other owner',async t=>{
 const p=await recordingPhaseHost(t),{f}=p;
 const admit=(token:string)=>p.checked(token,'/api/plugin-instances/connector.recorder/snapshots','POST',{});
 const a=await admit(f.a.token),b=await admit(f.b.token),context=await f.host.authority.authenticate(f.a.token),otherContext=await f.host.authority.authenticate(f.b.token),plugins=f.host.plugins!;
 const bound=plugins.binding(context,a.id),other=plugins.binding(otherContext,b.id);
 assert.deepEqual(Object.keys(bound).sort(),['assertCurrent','configuration','instanceId','packageId','sourceIds']);
 assert.equal(bound.instanceId,'connector.recorder');assert.equal(bound.packageId,a.packageId);assert.deepEqual(bound.configuration,{});assert.deepEqual(bound.sourceIds,[]);
 assert.ok(Object.isFrozen(bound));assert.ok(Object.isFrozen(bound.configuration));assert.ok(Object.isFrozen(bound.sourceIds));
 const count=process.env.MOTE_PROOF_BENCHMARK==='1'?3000:3;
 for(const [name,read] of [
  ['assertCurrent',()=>bound.assertCurrent()],
  ['assertStoredBinding',()=>assert.equal(plugins.assertStoredBinding(f.a.userId,a.id),context.authorizationEpoch)],
  ['binding',()=>{const current=plugins.binding(context,a.id);assert.equal(current.instanceId,bound.instanceId);assert.deepEqual(current.configuration,bound.configuration);}],
 ] as const){const cpu=process.cpuUsage(),start=performance.now();for(let i=0;i<count;i++)read();const wallMs=performance.now()-start,used=process.cpuUsage(cpu);if(count===3000)t.diagnostic(JSON.stringify({proofBenchmark:name,count,wallMs,cpuMs:(used.user+used.system)/1000}));}
 assert.throws(()=>plugins.binding(otherContext,a.id),error=>(error as any).statusCode===404);
 assert.throws(()=>plugins.assertStoredBinding(f.b.userId,a.id),error=>(error as any).statusCode===401);
 assert.throws(()=>plugins.assertStoredBinding(f.a.userId,randomUUID()),error=>(error as any).statusCode===404);
 await Promise.resolve();await p.checked(f.a.token,'/api/plugin-snapshots/'+a.id,'DELETE');
 assert.throws(()=>bound.assertCurrent(),error=>(error as any).statusCode===401);
 assert.throws(()=>plugins.assertStoredBinding(f.a.userId,a.id),error=>(error as any).statusCode===401);other.assertCurrent();
 const fresh=await admit(f.a.token),freshBound=plugins.binding(context,fresh.id);freshBound.assertCurrent();
 // A committed generation change from a second connection must invalidate
 // already warmed native statements before a configuration watcher runs.
 f.read(db=>db.prepare('UPDATE plugin_user_instances SET generation=generation+1 WHERE user_id=? AND id=?').run(f.a.userId,'connector.recorder'));
 assert.throws(()=>freshBound.assertCurrent(),error=>(error as any).statusCode===401);
 assert.throws(()=>plugins.assertStoredBinding(f.a.userId,fresh.id),error=>(error as any).statusCode===401);other.assertCurrent();
 const latest=await admit(f.a.token),latestBound=plugins.binding(context,latest.id);latestBound.assertCurrent();
 const view=await p.checked(f.a.token,'/api/plugins');await p.checked(f.a.token,'/api/plugin-instances/connector.recorder/stop','POST',{expectedRevision:view.revision});
 assert.throws(()=>latestBound.assertCurrent(),error=>(error as any).statusCode===401);other.assertCurrent();
});
