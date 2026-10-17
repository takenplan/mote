import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {join} from 'node:path';
import {scopedFilesFixture} from './fixtures/scoped-files.js';
import {waitForScopedState} from './fixtures/scoped-process.js';

test('original processing preview and explicit reprocess retain owner and stale-state boundaries',async t=>{
 const f=await scopedFilesFixture(t),policy={version:1,services:[],profiles:[{id:'text',name:'Generated text',processorId:'text.utf8',parameters:{},summarize:false},{id:'archive',name:'Generated original only',processorId:'archive',parameters:{},summarize:false}],rules:[{type:'text/*',profileId:'text'},{type:'*/*',profileId:'archive'}]};
 for(const account of [f.a,f.b]){const page=await f.checked(account.token,'/api/file-processing');await f.checked(account.token,'/api/file-processing','PUT',{revision:page.revision,settings:{...page.settings,automatic:true},policy});}
 const a=await f.upload(f.a.token,'same-preview-file','GENERATED_A_PREVIEW'),b=await f.upload(f.b.token,'same-preview-file','GENERATED_B_PREVIEW');assert.equal(a.id,b.id);
 for(const [account,file]of [[f.a,a],[f.b,b]])await waitForScopedState(async()=>Boolean((await f.checked(account.token,'/api/files/'+file.id)).processing.indexed),()=> 'Waiting for generated text publication',8000);
 const page=await f.checked(f.a.token,'/api/file-processing'),preview=await f.request(f.a.token,'/api/file-processing/preview','POST',{revision:page.revision,sourceId:'same-source',type:'text/*',profileId:'text'});assert.equal(preview.statusCode,200,preview.body);const selected=preview.json();assert.equal(selected.count,1);assert.equal(selected.items[0].id,a.id);assert.equal(selected.bounded,false);
 const db=new DatabaseSync(join(f.directory,'mote.sqlite'),{readOnly:true});try{
  const tasks=(user:string)=>db.prepare("SELECT u.task_id FROM user_tasks u JOIN execution_steps e ON e.id=u.task_id AND e.user_id=u.user_id WHERE u.user_id=? AND e.kind='processing.pipeline' ORDER BY u.task_id").all(user),beforeA=tasks(f.a.userId),beforeB=tasks(f.b.userId);
  assert.equal((await f.request(f.b.token,'/api/file-processing/reprocess','POST',{token:selected.token})).statusCode,409);assert.deepEqual(tasks(f.b.userId),beforeB);
  const result=await f.checked(f.a.token,'/api/file-processing/reprocess','POST',{token:selected.token});assert.equal(result.queued,1);assert.equal(tasks(f.a.userId).length,beforeA.length+1);assert.deepEqual(tasks(f.b.userId),beforeB);
  assert.equal((await f.request(f.a.token,'/api/file-processing/reprocess','POST',{token:selected.token})).statusCode,409,'a consumed preview cannot repeat admission');
  await waitForScopedState(async()=>Boolean((await f.checked(f.a.token,'/api/files/'+a.id)).processing.indexed),()=> 'Waiting for explicit reprocessing',8000);
  const fresh=await f.checked(f.a.token,'/api/file-processing/preview','POST',{revision:page.revision,type:'text/*'});await f.checked(f.a.token,'/api/files/'+a.id+'/retry','POST',{operationId:randomUUID(),stage:'transcribe'});
  assert.equal((await f.request(f.a.token,'/api/file-processing/reprocess','POST',{token:fresh.token})).statusCode,409,'a changed file invalidates the whole preview');
  assert.deepEqual(tasks(f.b.userId),beforeB);assert.equal((await f.checked(f.b.token,'/api/files/'+b.id+'/chunks')).items[0].ocrText,'GENERATED_B_PREVIEW');
 }finally{db.close();}
});
