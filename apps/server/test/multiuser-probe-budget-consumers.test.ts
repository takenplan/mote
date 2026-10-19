import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import type {PluginCapabilityProbe} from '../src/scope/plugin-contract.js';
import {scopedProbeHost,probeDeferred,probeUntil} from './fixtures/scoped-probe-host.js';

const verified={capabilities:[{id:'generated.model',state:'verified' as const}],issues:[]};
for(const limit of [1,4])test(`ordinary HTTP and direct checks share the real installer base1 at configured Agent ${limit}; scoped Memory retains its own lane`,{timeout:60000},async t=>{
 let active=0,peak=0;const entered:string[]=[];
 const f=await scopedProbeHost(t,async input=>{active++;peak=Math.max(peak,active);entered.push(input.context.userId+':'+input.instance.id);try{await gate.promise;input.assertCurrent();return verified;}finally{active--;}}),gate=f.hold();
 await f.capacity(limit);const pkg=await f.installed();await f.configure(f.a,pkg,'same-instance');await f.configure(f.b,pkg,'same-instance');
 const first=await f.check(f.a,'same-instance');await probeUntil(()=>entered.length===1,()=>entered);
 const context=await f.host.authority.authenticate(f.b.token),direct=f.host.plugins!.forUser(context).check('same-instance');void direct.catch(()=>{});
 const install=await f.startInstall(1);await f.quietTurn();assert.equal(entered.length,1,'a direct check cannot use the restored-only budget');
 assert.equal(f.read(db=>db.prepare('SELECT state FROM execution_steps WHERE id=?').get(install.taskId)!.state),'waiting','a real catalog install shares the held manual physical base');
 // This is the actual scoped Memory handler, not the retired legacy pool.
 const memory=await f.ok(f.b.token,'/api/memory/bindings','POST',{operationId:randomUUID()});await f.succeeded(f.b,memory.task.id);
 assert.equal(f.read(db=>db.prepare('SELECT pool FROM execution_steps WHERE id=?').get(memory.task.id)!.pool),'memory.publication');assert.equal(active,1,'independent Memory publication does not release or consume a manual probe slot');
 gate.resolve();await f.succeeded(f.a,first.taskId);const checked=await direct;assert.equal(checked.checked,true);await probeUntil(()=>f.host.plugins!.catalog.view().packages.some(p=>p.id===install.id&&p.state==='installed'),()=>f.host.plugins!.catalog.view());
 assert.equal(entered.length,2);assert.equal(peak,1);assert.equal(f.read(db=>db.prepare("SELECT count(*) n FROM execution_steps WHERE kind='plugin.check' AND attempts!=1").get()!.n),0,'queueing never manufactures a probe retry');
});

for(const stage of ['callback','cleanup'] as const)test(`cancelled manual probe retains base and same-instance exclusion through the real ${stage} lifetime, then wakes queued work without retry`,{timeout:60000},async t=>{
 let first=true;const entered:string[]=[];const callbackEntered=probeDeferred(),workerClosed=probeDeferred(),cleanupEntered=probeDeferred();
 const f=await scopedProbeHost(t,async input=>{entered.push(input.context.userId+':'+input.instance.id);if(!first)return verified;first=false;
  const worker=input.runtime(),close=worker.close.bind(worker);worker.close=async()=>{await close();workerClosed.resolve();};callbackEntered.resolve();
  if(stage==='cleanup'){input.onClose(async()=>{cleanupEntered.resolve();await held.promise;});await new Promise<void>(resolve=>{if(input.signal.aborted)resolve();else input.signal.addEventListener('abort',()=>resolve(),{once:true});});}
  else await held.promise;
  input.assertCurrent();return verified;
 }),held=f.hold();await f.capacity(4);const pkg=await f.installed();await f.configure(f.a,pkg,'same-instance');await f.configure(f.b,pkg,'same-instance');
 const original=await f.check(f.a,'same-instance');await callbackEntered.promise;await f.ok(f.a.token,'/api/tasks/'+original.taskId+'/cancel','POST',{});
 await probeUntil(async()=>(await f.task(f.a,original.taskId)).state==='cancelled',()=>entered);
 if(stage==='callback')await workerClosed.promise;else await cleanupEntered.promise;
 const replacement=await f.check(f.a,'same-instance'),other=await f.check(f.b,'same-instance'),install=await f.startInstall(1);await f.quietTurn();
 assert.deepEqual(entered,[f.a.userId+':same-instance'],'cancelled durable state and closed worker cannot free an unsettled callback/cleanup turn');
 assert.equal((await f.task(f.a,replacement.taskId)).state,'waiting');assert.equal((await f.task(f.b,other.taskId)).state,'waiting');assert.equal(f.read(db=>db.prepare('SELECT state FROM execution_steps WHERE id=?').get(install.taskId)!.state),'waiting');
 held.resolve(); // No explicit tick, repeated check, retry or configuration nudge follows.
 await f.succeeded(f.a,replacement.taskId);await f.succeeded(f.b,other.taskId);await probeUntil(()=>f.host.plugins!.catalog.view().packages.some(p=>p.id===install.id&&p.state==='installed'),()=>entered);
 assert.equal(entered.length,3);assert.equal((await f.task(f.a,original.taskId)).state,'cancelled');assert.equal((await f.view(f.a)).instances[0].checked,true);
 for(const id of [original.taskId,replacement.taskId,other.taskId])assert.equal(f.read(db=>db.prepare('SELECT attempts FROM execution_steps WHERE id=?').get(id)!.attempts),1);
});

test('real restored owner-equal-ID probes use only trusted independent capacity and drain a live decrease',{timeout:60000},async t=>{
 let restoring=false;const entered:string[]=[],gates=new Map<string,ReturnType<typeof probeDeferred>>();
 const probe:PluginCapabilityProbe=async input=>{if(restoring){const key=input.context.userId+':'+input.instance.id;entered.push(key);await gates.get(key)!.promise;}input.assertCurrent();return verified;};
 const f=await scopedProbeHost(t,probe);await f.capacity(3);const pkg=await f.installed();
 for(const user of [f.a,f.b])for(const id of ['same-instance','z-instance']){await f.configure(user,pkg,id);const check=await f.check(user,id);await f.succeeded(user,check.taskId);await f.enable(user,id);gates.set(user.userId+':'+id,f.hold());}
 await f.configure(f.a,pkg,'manual-only');gates.set(f.a.userId+':manual-only',f.hold());
 await f.restore();restoring=true;const a=await f.login('generated-a'),b=await f.login('generated-b');
 await probeUntil(()=>entered.length===3,()=>({entered,scopes:f.read(db=>db.prepare('SELECT * FROM lifecycle_future_scopes').all())}));assert.ok(entered.some(key=>key.startsWith(a.userId+':'))&&entered.some(key=>key.startsWith(b.userId+':')),'a waiting owner makes progress within the restored-only capacity');
 const manual=await f.check(a,'manual-only');await probeUntil(()=>entered.includes(a.userId+':manual-only'),()=>entered);assert.equal(entered.length,4,'one base manual callback coexists with three trusted restored callbacks');
 await f.capacity(1);const activeRestore=entered.filter(key=>!key.endsWith(':manual-only'));gates.get(activeRestore[0])!.resolve();gates.get(activeRestore[1])!.resolve();await probeUntil(()=>activeRestore.slice(0,2).every(key=>{const [owner,id]=key.split(':');return f.read(db=>db.prepare('SELECT e.state FROM plugin_user_checks c JOIN execution_steps e ON e.id=c.task_id WHERE c.user_id=? AND c.instance_id=?').get(owner,id)?.state)==='succeeded';}),()=>({entered,activeRestore}));await f.quietTurn();assert.equal(entered.length,4,'lowered restored budget admits no new probe while one prior restored callback remains');
 gates.get(activeRestore[2])!.resolve();await probeUntil(()=>entered.length===5,()=>entered);assert.equal(new Set(entered).size,5,'each actual restored scope enters once, including the queued equal-ID other-owner scope');
 for(const gate of gates.values())gate.resolve();await f.succeeded(a,manual.taskId);
 await probeUntil(()=>f.read(db=>db.prepare("SELECT count(*) n FROM lifecycle_future WHERE user_id IN (?,?) AND state='completed'").get(a.userId,b.userId)!.n)===2,()=>f.read(db=>db.prepare('SELECT * FROM lifecycle_future_scopes').all()));
 const receipts=f.read(db=>db.prepare("SELECT s.user_id,s.scope_key,s.probe_task_id,c.id,c.generation,c.signature,e.authorization_epoch FROM lifecycle_future_scopes s JOIN plugin_user_checks c ON c.user_id=s.user_id AND c.task_id=s.probe_task_id JOIN execution_steps e ON e.id=c.task_id WHERE s.scope_key LIKE 'plugin:%' ORDER BY s.user_id,s.scope_key").all());assert.equal(receipts.length,4);assert.equal(new Set(receipts.map(r=>r.probe_task_id)).size,4);
 for(const r of receipts)assert.equal(r.authorization_epoch,f.read(db=>db.prepare('SELECT authorization_epoch FROM auth_accounts WHERE user_id=?').get(r.user_id)!.authorization_epoch));

});

test('configured restored capacity1 remains serial while a separate manual owner uses base1',{timeout:60000},async t=>{
 let restoring=false;const entered:string[]=[];const f=await scopedProbeHost(t,async input=>{if(restoring){entered.push(input.context.userId+':'+input.instance.id);await gates.get(input.context.userId+':'+input.instance.id)!.promise;}input.assertCurrent();return verified;}),gates=new Map<string,ReturnType<typeof probeDeferred>>();
 await f.capacity(1);const pkg=await f.installed();for(const id of ['a-first','z-next']){await f.configure(f.a,pkg,id);const check=await f.check(f.a,id);await f.succeeded(f.a,check.taskId);await f.enable(f.a,id);gates.set(f.a.userId+':'+id,f.hold());}await f.configure(f.b,pkg,'a-first');gates.set(f.b.userId+':a-first',f.hold());
 await f.restore();restoring=true;const a=await f.login('generated-a'),b=await f.login('generated-b');await probeUntil(()=>entered.length===1,()=>entered);const manual=await f.check(b,'a-first');await probeUntil(()=>entered.length===2,()=>entered);assert.equal(entered.filter(key=>key.startsWith(a.userId+':')).length,1);await f.quietTurn();assert.equal(entered.length,2);
 const first=entered.find(key=>key.startsWith(a.userId+':'))!;gates.get(first)!.resolve();await probeUntil(()=>entered.length===3,()=>entered);for(const gate of gates.values())gate.resolve();await f.succeeded(b,manual.taskId);await probeUntil(()=>f.read(db=>db.prepare('SELECT state FROM lifecycle_future WHERE user_id=?').get(a.userId)?.state)==='completed',()=>entered);assert.equal(new Set(entered).size,3);
});

test('a manual same-instance replacement cannot overlap an unsettled restored callback; explicit stop wins before late enable',{timeout:60000},async t=>{
 let restoring=false;const entered:string[]=[];const f=await scopedProbeHost(t,async input=>{if(restoring){entered.push(input.instance.id);if(input.instance.id==='same-instance'&&entered.filter(id=>id==='same-instance').length===1)await held.promise;}input.assertCurrent();return verified;}),held=f.hold();
 await f.capacity(3);const pkg=await f.installed();for(const id of ['same-instance','z-valid']){await f.configure(f.a,pkg,id);const check=await f.check(f.a,id);await f.succeeded(f.a,check.taskId);await f.enable(f.a,id);}await f.restore();restoring=true;const a=await f.login('generated-a');
 await probeUntil(async()=>entered.includes('same-instance')&&(await f.view(a)).instances.find((i:any)=>i.id==='z-valid')?.desired===true,()=>entered);
 const manual=await f.check(a,'same-instance');await f.quietTurn();assert.equal(entered.filter(id=>id==='same-instance').length,1,'separate capacity purposes cannot overlap the same owned physical instance');
 const install=await f.startInstall(1);await probeUntil(()=>f.host.plugins!.catalog.view().packages.some(p=>p.id===install.id&&p.state==='installed'),()=>entered);assert.equal(entered.filter(id=>id==='same-instance').length,1,'a waiting same-instance manual request cannot block an available installer or move the old restored flight into base capacity');
 const latest=await f.view(a);await f.ok(a.token,'/api/plugin-instances/same-instance/stop','POST',{expectedRevision:latest.revision});held.resolve();await probeUntil(async()=>!['waiting','running'].includes((await f.task(a,manual.taskId)).state),()=>entered);
 await f.login('generated-a');await probeUntil(()=>f.read(db=>db.prepare('SELECT state FROM lifecycle_future WHERE user_id=?').get(a.userId)?.state)==='completed',()=>f.read(db=>db.prepare('SELECT * FROM lifecycle_future_scopes').all()));
 const after=await f.view(a);assert.equal(after.instances.find((i:any)=>i.id==='same-instance').desired,false);assert.equal(after.instances.find((i:any)=>i.id==='z-valid').desired,true,'the successful neighboring scope remains enabled');
});

test('an issued cancelled manual probe is not resent by check, explicit retry or real host restart',{timeout:60000},async t=>{
 let calls=0;const entered=probeDeferred();const f=await scopedProbeHost(t,async input=>{calls++;input.beginExternal();entered.resolve();await held.promise;input.assertCurrent();return verified;}),held=f.hold();const pkg=await f.installed();await f.configure(f.a,pkg,'same-instance');
 const check=await f.check(f.a,'same-instance');await entered.promise;await f.ok(f.a.token,'/api/tasks/'+check.taskId+'/cancel','POST',{});await probeUntil(async()=>(await f.task(f.a,check.taskId)).state==='cancelled',()=>calls);
 assert.equal((await f.request(f.a.token,'/api/plugin-instances/same-instance/check','POST',{})).statusCode,409);assert.equal((await f.request(f.a.token,'/api/tasks/'+check.taskId+'/retry','POST',{confirmUnknown:true})).statusCode,409);assert.equal(calls,1);
 held.resolve();await f.restart();const a=await f.login('generated-a');assert.equal((await f.request(a.token,'/api/plugin-instances/same-instance/check','POST',{})).statusCode,409);assert.equal((await f.request(a.token,'/api/tasks/'+check.taskId+'/retry','POST',{confirmUnknown:true})).statusCode,409);await f.quietTurn();assert.equal(calls,1,'unknown physical outcome is retained across startup and never retried automatically');
 assert.equal((await f.view(a)).instances[0].checked,false);
});

test('normal host shutdown cannot finish while a real probe callback ignores abort after its worker has closed',{timeout:60000},async t=>{
 const entered=probeDeferred(),workerClosed=probeDeferred();const f=await scopedProbeHost(t,async input=>{const worker=input.runtime(),close=worker.close.bind(worker);worker.close=async()=>{await close();workerClosed.resolve();};entered.resolve();await held.promise;input.assertCurrent();return verified;}),held=f.hold();
 const pkg=await f.installed();await f.configure(f.a,pkg,'same-instance');await f.check(f.a,'same-instance');await entered.promise;let closed=false;const closing=f.host.app.close().then(()=>{closed=true;});void closing.catch(()=>{});
 await workerClosed.promise;assert.equal(closed,false,'worker closure is not settlement of the full host capability callback');held.resolve();await closing;assert.equal(closed,true);
});

test('a rejected real cleanup retains the physical base until successful worker retirement, then wakes the original queued controls', {timeout:60000},async t=>{
 let rejectCleanup=true,first=true,cleanupCalls=0;const entered:string[]=[];const f=await scopedProbeHost(t,async input=>{entered.push(input.context.userId+':'+input.instance.id);if(first){first=false;input.onClose(async()=>{cleanupCalls++;if(rejectCleanup)throw Error('Generated cleanup rejected');});}return verified;});f.beforeClose(()=>{rejectCleanup=false;});
 const pkg=await f.installed();await f.configure(f.a,pkg,'same-instance');await f.configure(f.b,pkg,'same-instance');const original=await f.check(f.a,'same-instance');
 await probeUntil(async()=>(await f.task(f.a,original.taskId)).state==='blocked',()=>({entered,cleanupCalls}));assert.equal((await f.view(f.a)).instances[0].checked,false,'cleanup failure cannot publish a verification');
 const other=await f.check(f.b,'same-instance'),install=await f.startInstall(1);await f.quietTurn();assert.equal(entered.length,1);assert.equal((await f.task(f.b,other.taskId)).state,'waiting');assert.equal(f.read(db=>db.prepare('SELECT state FROM execution_steps WHERE id=?').get(install.taskId)!.state),'waiting');
 const generation=f.read(db=>Number(db.prepare('SELECT generation FROM plugin_user_instances WHERE user_id=? AND id=?').get(f.a.userId,'same-instance')!.generation));rejectCleanup=false;const latest=await f.view(f.a);await f.ok(f.a.token,'/api/plugin-instances/same-instance/stop','POST',{expectedRevision:latest.revision}); // The real stop writes a fresh revocation and retires the retained worker.
 assert.equal(f.read(db=>Number(db.prepare('SELECT generation FROM plugin_user_instances WHERE user_id=? AND id=?').get(f.a.userId,'same-instance')!.generation)),generation+1,'the recovery action must actually retire the old generation');
 await f.succeeded(f.b,other.taskId);await probeUntil(()=>f.host.plugins!.catalog.view().packages.some(p=>p.id===install.id&&p.state==='installed'),()=>({entered,cleanupCalls}));assert.ok(cleanupCalls>=2);assert.equal(entered.length,2);assert.equal(f.read(db=>db.prepare('SELECT attempts FROM execution_steps WHERE id=?').get(other.taskId)!.attempts),1,'the original waiting task advances without retry');
 const fresh=await f.check(f.a,'same-instance');await f.succeeded(f.a,fresh.taskId);assert.equal(entered.length,3);assert.equal((await f.task(f.a,original.taskId)).state,'blocked','late cleanup does not manufacture an old successful proof');
});
