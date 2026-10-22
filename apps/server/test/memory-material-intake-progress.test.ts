import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {materialIntakeProgress} from '../src/scope/memory-observations.js';
import {ScopedMemoryData} from '../src/scope/memory-data.js';
import {PrivateCursor} from '../src/scope/private-data-sql.js';
import {evidenceFixture} from './fixtures/evidence-projection.js';

function fixture(t:any){
 const f=evidenceFixture(t),data=new ScopedMemoryData(f.sql,f.data,new PrivateCursor('generated-key','generated-host','generated-a')),context={userId:'generated-a'} as any,tasks=new Map<string,any>(),jobs=new Map<string,any>(),lookups:string[]=[],material='mat_'+'a'.repeat(64),revision='b'.repeat(64),execution={forUser:()=>({observe:(id:string)=>{const task=tasks.get(id);if(!task)throw Error('missing actual task');return task;}})} as any;
 const receipt=(input:{id?:string;userId?:string;revision?:string;materialId?:string;state?:string;taskId?:string|null;jobId?:string|null;revoked?:number}={})=>{const id=input.id??randomUUID();f.db.prepare('INSERT INTO mm_intakes VALUES(?,?,?,?,?,?,?,?,?,?)').run(input.userId??'generated-a',id,input.materialId??material,input.revision??revision,'{}',input.revoked??0,input.taskId??null,input.jobId??null,'2026-10-23T00:00:00Z',input.state??'pending');return id;};
 const job=(id= randomUUID())=>{f.sql.run('INSERT INTO mm_jobs(user_id,id,input) VALUES($user,?,?)',id,'{}');return id;};
 const read=()=>materialIntakeProgress(data,context,execution,material,revision,id=>{lookups.push(id);const value=jobs.get(id);assert.ok(value,'only an existing actual job may be observed');return value;});
 const snapshot=()=>JSON.stringify({intakes:f.db.prepare('SELECT * FROM mm_intakes ORDER BY user_id,id').all(),jobs:f.db.prepare('SELECT * FROM mm_jobs ORDER BY user_id,id').all(),batches:f.db.prepare('SELECT * FROM mm_job_batches ORDER BY user_id,job_id,id').all()});
 return {...f,data,tasks,jobs,lookups,material,revision,receipt,job,read,snapshot};
}

test('a reserved job reports the actual missing-model coordinator and transitions to its real job without writes',t=>{
 const f=fixture(t),id=randomUUID(),task='generated-intake-task';f.receipt({jobId:id,taskId:task});f.tasks.set(task,{state:'waiting',reason:'memory_model_required'});const before=f.snapshot();assert.deepEqual(f.read(),[{state:'waiting',count:0,error:'memory_model_required'}]);assert.deepEqual(f.lookups,[]);assert.equal(f.snapshot(),before);
 f.job(id);f.jobs.set(id,{id,current:true,state:'ready',tasks:{batch:{state:'running'}}});const admitted=f.snapshot();assert.deepEqual(f.read(),[{state:'running',count:0,error:undefined}]);assert.deepEqual(f.lookups,[id]);assert.equal(f.snapshot(),admitted);
});

test('pending progress preserves every real task state and reason without model completion',t=>{
 const f=fixture(t),task='generated-task';f.receipt({jobId:randomUUID(),taskId:task});for(const state of ['waiting','running','blocked','failed','cancelled','stale']){f.tasks.set(task,{state,reason:'generated_'+state});assert.deepEqual(f.read(),[{state,count:0,error:'generated_'+state}]);}assert.deepEqual(f.lookups,[]);
});

test('a succeeded coordinator without a job retains receipt state and cannot fabricate completed Memory',t=>{
 const f=fixture(t),task='generated-task',id=f.receipt({taskId:task,jobId:randomUUID()});f.tasks.set(task,{state:'succeeded'});assert.equal(f.read()[0].state,'waiting');for(const state of ['complete','skipped'])for(const taskState of ['succeeded','running','failed']){f.tasks.set(task,{state:taskState,reason:'generated_older_task_reason'});f.sql.run('UPDATE mm_intakes SET state=? WHERE user_id=$user AND id=?',state,id);assert.deepEqual(f.read(),[{state,count:0,error:undefined}]);}assert.deepEqual(f.lookups,[]);
});

test('actual admitted job state, failure and completed count retain the existing projection',t=>{
 const f=fixture(t),id=f.job();f.receipt({jobId:id});for(const count of [2,1])f.sql.run('INSERT INTO mm_job_batches(user_id,job_id,id,input,prepared) VALUES($user,?,?,?,?)',id,randomUUID(),'{}',JSON.stringify({items:Array.from({length:count},()=>({generated:true}))}));
 for(const [current,state,tasks,expected] of [[true,'committed',{batch:{state:'succeeded'}},{state:'completed',count:3}],[false,'committed',{batch:{state:'succeeded'}},{state:'stale',count:0}],[true,'paused',{batch:{state:'waiting'}},{state:'paused',count:0}],[true,'ready',{batch:{state:'failed',failure:{code:'generated_denied'}}},{state:'failed',count:0,error:'generated_denied'}],[true,'awaiting_context',{batch:{state:'waiting'}},{state:'waiting_for_input',count:0}],[true,'ready',{batch:{state:'running'}},{state:'running',count:0}],[true,'ready',{batch:{state:'waiting'}},{state:'waiting',count:0}]] as const){f.jobs.set(id,{id,current,state,tasks});assert.deepEqual(JSON.parse(JSON.stringify(f.read()[0])),expected);}
});

test('exact owner, Material revision and revocation boundaries select only the current receipt',t=>{
 const f=fixture(t);f.receipt();f.receipt({userId:'generated-b'});f.receipt({revision:'c'.repeat(64)});f.receipt({materialId:'mat_'+'d'.repeat(64)});f.receipt({revoked:1});const foreign=randomUUID();f.db.prepare('INSERT INTO mm_jobs(user_id,id,input) VALUES(?,?,?)').run('generated-b',foreign,'{}');f.sql.run('UPDATE mm_intakes SET job_id=? WHERE user_id=$user AND revoked=0 AND revision=? AND material_id=?',foreign,f.revision,f.material);assert.deepEqual(f.read(),[{state:'waiting',count:0,error:undefined}]);assert.deepEqual(f.lookups,[]);
});

test('an invalid task reference is not silently swallowed as an absent Memory job',t=>{
 const f=fixture(t);f.receipt({taskId:'missing-task',jobId:randomUUID()});assert.throws(f.read,/missing actual task/);assert.deepEqual(f.lookups,[]);
});
