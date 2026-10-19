import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {barrier,recordingPhaseHost,until} from './fixtures/recording-phase-host.js';
import {scopedCaptureFixture} from './fixtures/scoped-capture-host.js';

const operationPath=(id:string)=>'/api/operations/'+encodeURIComponent(id);
const listPath='/api/operations?kind=recording-sync&limit=20';

test('normal recording selection publishes real stage progress under an owner-bound recording parent',async t=>{
 const p=await recordingPhaseHost(t),{f,checked}=p;
 assert.equal((await checked(f.a.token,listPath)).items.length,0);
 p.state.mediaGate=barrier();
 const selected=await p.select(f.a.token),rootId=selected.result.syncTask.id;
 await until(()=>p.state.mediaEntered,'Generated recording media did not start');
 const root=await checked(f.a.token,'/api/tasks/'+rootId);
 assert.match(root.operationId,/^connector:[a-f0-9]{64}$/);
 const page=await checked(f.a.token,listPath);assert.equal(page.items.length,1);
 const parent=page.items[0];assert.match(parent.id,/^recording-sync:[a-f0-9]{64}$/);
 let detail=await checked(f.a.token,operationPath(parent.id));
 assert.ok(detail.steps.some((step:any)=>step.id===rootId));
 for(const phase of ['discover','metadata','transcript','media'])assert.ok(detail.steps.some((step:any)=>step.kind==='connector.recording.'+phase),phase);
 assert.equal(detail.steps.find((step:any)=>step.kind==='connector.recording.media').state,'running');
 const selectedB=await p.select(f.b.token),pageB=await checked(f.b.token,listPath);
 assert.equal(pageB.items.length,1);assert.notEqual(pageB.items[0].id,parent.id);
 assert.equal((await f.request(f.b.token,operationPath(parent.id))).statusCode,404);
 assert.equal((await f.request(f.a.token,operationPath(pageB.items[0].id))).statusCode,404);
 p.state.mediaGate.release();await p.settle(f.a.token);await p.settle(f.b.token);
 assert.equal((await p.waitTask(f.a.token,rootId)).state,'succeeded');
 assert.equal((await p.waitTask(f.b.token,selectedB.result.syncTask.id)).state,'succeeded');
 detail=await checked(f.a.token,operationPath(parent.id));assert.equal(detail.operation.state,'succeeded');
 const changes=await checked(f.a.token,'/api/operations/changes?since='+page.changeCursor);
 assert.ok(changes.ids.includes(parent.id));assert.ok(!changes.ids.includes(pageB.items[0].id));
 const ids=detail.steps.map((step:any)=>step.id).sort();assert.equal(new Set(ids).size,ids.length);
 await f.restart();detail=await checked(f.a.token,operationPath(parent.id));
 assert.deepEqual(detail.steps.map((step:any)=>step.id).sort(),ids);
 assert.equal((await checked(f.a.token,operationPath(root.operationId))).operation.id,root.operationId);
});

test('same recording command receipt restores missing parent metadata without replaying consumed work',async t=>{
 const p=await recordingPhaseHost(t),{f,checked}=p;
 const selected=await p.select(f.a.token);await p.settle(f.a.token);await p.waitTask(f.a.token,selected.result.syncTask.id);
 const operationId=randomUUID(),root=await checked(f.a.token,'/api/connectors/recorder/sync','POST',{operationId});
 assert.equal((await p.waitTask(f.a.token,root.id)).state,'succeeded');await p.settle(f.a.token);
 const parents=await checked(f.a.token,listPath);let detail:any;
 for(const parent of parents.items){const candidate=await checked(f.a.token,operationPath(parent.id));if(candidate.steps.some((step:any)=>step.id===root.id))detail=candidate;}
 assert.ok(detail,'explicit sync parent missing');const parentId=detail.operation.id;
 const ids=detail.steps.map((step:any)=>step.id).sort();
 const businessSnapshot=()=>f.read(db=>({
  tasks:db.prepare('SELECT * FROM execution_steps WHERE id IN (SELECT task_id FROM connector_commands WHERE user_id=?) ORDER BY id').all(f.a.userId),
  commands:db.prepare('SELECT * FROM connector_commands WHERE user_id=? ORDER BY instance_id,operation_id').all(f.a.userId),
  ledger:db.prepare('SELECT * FROM connector_ledger WHERE user_id=? ORDER BY instance_id,scope,key').all(f.a.userId),
 }));
 const before=businessSnapshot(),calls=p.calls.length;
 // Simulate the missing attribution left by the previous host. Business tasks,
 // command receipts and recording cursors remain untouched.
 f.read(db=>{db.exec('BEGIN IMMEDIATE');try{
  db.prepare('DELETE FROM operation_parents WHERE parent_id=?').run(parentId);
  db.prepare('DELETE FROM execution_operation_steps WHERE operation_id=?').run(parentId);
  db.prepare('DELETE FROM operation_progress WHERE id=?').run(parentId);db.exec('COMMIT');
 }catch(error){db.exec('ROLLBACK');throw error;}});
 assert.equal((await f.request(f.a.token,operationPath(parentId))).statusCode,404);
 for(let acknowledgment=0;acknowledgment<2;acknowledgment++){
  const receipt=await checked(f.a.token,'/api/connectors/recorder/sync','POST',{operationId});
  assert.equal(receipt.id,root.id);assert.equal(receipt.operationId,root.operationId);
  detail=await checked(f.a.token,operationPath(parentId));
  assert.deepEqual(detail.steps.map((step:any)=>step.id).sort(),ids);
 }
 assert.deepEqual(businessSnapshot(),before);assert.equal(p.calls.length,calls);
 assert.equal((await checked(f.a.token,operationPath(root.operationId))).operation.id,root.operationId);
 await f.restart();assert.deepEqual((await checked(f.a.token,operationPath(parentId))).steps.map((step:any)=>step.id).sort(),ids);
});

test('ordinary connector sync keeps its existing operation family',async t=>{
 let calls=0;
 const f=await scopedCaptureFixture(t,{connectorDefinitions:[{id:'generated-connector',version:'1',name:'Generated',create:()=>({status:()=>({connected:true}),sync:async()=>{calls++;return {complete:true};},disconnect:async()=>({}),close:async()=>{}})}]});
 const checked=async(token:string,path:string,method:any='GET',payload?:unknown)=>{const response=await f.request(token,path,method,payload);assert.equal(response.statusCode,200,response.body);return response.json();};
 await checked(f.admin.token,'/api/admin/connectors/generated-connector/install','POST',{expectedRevision:f.host.plugins!.catalog.revision(),operationId:randomUUID()});
 await checked(f.a.token,'/api/connectors/ordinary','PUT',{expectedRevision:(await checked(f.a.token,'/api/connectors')).revision,connection:{provider:'generated-connector',autoSync:false}});
 await checked(f.a.token,'/api/connectors/ordinary/enable','POST',{expectedRevision:(await checked(f.a.token,'/api/plugins')).revision});
 const root=await checked(f.a.token,'/api/connectors/ordinary/sync','POST',{operationId:randomUUID()});
 await until(async()=>{await f.host.execution!.tick();return (await checked(f.a.token,'/api/tasks/'+root.id)).state==='succeeded';},'Generated ordinary connector did not settle');
 assert.equal(calls,1);assert.match(root.operationId,/^connector:[a-f0-9]{64}$/);
 assert.equal((await checked(f.a.token,listPath)).items.length,0);
});
