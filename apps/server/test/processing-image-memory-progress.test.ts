import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {join} from 'node:path';
import {scopedFilesFixture} from './fixtures/scoped-files.js';
import {waitForScopedState} from './fixtures/scoped-process.js';
import {policy,generated,upload,done} from './fixtures/multiuser-perception-history-suite.js';

test('image and perception progress observe a reserved Memory intake waiting for its model without hiding completed OCR or admitting work',async t=>{
 const runs:string[]=[],f=await scopedFilesFixture(t,node=>generated(node as any,runs));await policy(f,f.a.token);
 const file=await upload(f,f.a.token,'memory-model-wait','2026-10-16T00:00:00Z');await done(f,f.a.token,file.id);
 const db=new DatabaseSync(join(f.directory,'mote.sqlite'),{readOnly:true});t.after(()=>db.close());
 let intake:any;
 await waitForScopedState(()=>{intake=db.prepare("SELECT i.id,i.material_id,i.revision,i.job_id,i.task_id,e.state,e.error FROM mm_intakes i JOIN execution_steps e ON e.user_id=i.user_id AND e.id=i.task_id WHERE i.user_id=? AND i.job_id IS NOT NULL AND e.state='waiting' AND e.error='memory_model_required' AND NOT EXISTS(SELECT 1 FROM mm_jobs j WHERE j.user_id=i.user_id AND j.id=i.job_id)").get(f.a.userId);return Boolean(intake);},()=>JSON.stringify(db.prepare('SELECT * FROM mm_intakes WHERE user_id=?').all(f.a.userId)),12000);
 const snapshot=()=>({intakes:db.prepare('SELECT * FROM mm_intakes WHERE user_id=? ORDER BY id').all(f.a.userId),tasks:db.prepare('SELECT task_id,input,grant_id FROM user_tasks WHERE user_id=? ORDER BY task_id').all(f.a.userId),external:db.prepare('SELECT * FROM task_external_calls WHERE user_id=? ORDER BY task_id,issuance_id').all(f.a.userId)}),before=snapshot();
 const image=await f.checked(f.a.token,'/api/images/'+file.id);assert.equal(image.jobs.find((job:any)=>job.name==='ocr').state,'succeeded');assert.deepEqual(image.memory,[{state:'waiting',count:0,error:'memory_model_required'}]);
 const page=await f.checked(f.a.token,'/api/perception');assert.ok(page.jobs.some((job:any)=>job.kind==='ocr'&&job.count>0));assert.deepEqual(runs,['one:memory-model-wait']);
 assert.equal((await f.request(f.b.token,'/api/images/'+file.id)).statusCode,404);assert.equal((await f.checked(f.b.token,'/api/perception')).jobs.length,0);
 assert.deepEqual(snapshot(),before);assert.equal(db.prepare('SELECT count(*) n FROM mm_jobs WHERE user_id=? AND id=?').get(f.a.userId,intake.job_id)!.n,0);
});
