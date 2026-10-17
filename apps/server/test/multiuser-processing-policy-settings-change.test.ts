import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {join} from 'node:path';
import sharp from 'sharp';
import {scopedFilesFixture} from './fixtures/scoped-files.js';
import {waitForScopedState} from './fixtures/scoped-process.js';

test('a processing scalar save re-admits unfinished named work even when the policy is unchanged',async t=>{
 const f=await scopedFilesFixture(t),page=await f.checked(f.a.token,'/api/file-processing');await f.checked(f.a.token,'/api/file-processing','PUT',{revision:page.revision,settings:{...page.settings,automatic:true,understandingEnabled:false},policy:{version:1,services:[{id:'media',name:'Generated pending connection',kind:'image',reference:{kind:'personal',id:'not-yet-present'}}],profiles:[{id:'image',name:'Generated image',processorId:'image.http',serviceId:'media',parameters:{},summarize:false},{id:'archive',name:'Generated archive',processorId:'archive',parameters:{},summarize:false}],rules:[{type:'image/*',profileId:'image'},{type:'*/*',profileId:'archive'}]}});
 const bytes=await sharp({create:{width:2,height:2,channels:3,background:'#216a87'}}).png().toBuffer(),file=await f.uploadBytes(f.a.token,'generated-scalar-change',bytes,'image/png');await waitForScopedState(async()=>['failed','blocked'].includes((await f.checked(f.a.token,'/api/files/'+file.id)).job?.state),()=> 'Waiting for generated missing connection',8000);
 const db=new DatabaseSync(join(f.directory,'mote.sqlite'),{readOnly:true});try{
  const last=()=>db.prepare('SELECT task_id FROM mp_admissions WHERE user_id=? AND original_id=? AND task_id IS NOT NULL ORDER BY rowid DESC LIMIT 1').get(f.a.userId,file.original.ref.slice(9))!.task_id,before=last(),current=await f.checked(f.a.token,'/api/file-processing');
  await f.checked(f.a.token,'/api/file-processing','PUT',{revision:current.revision,settings:{...current.settings,timeoutMs:current.settings.timeoutMs-1000},policy:current.policy});assert.notEqual(last(),before,'unfinished work must be admitted under the new processing generation');
  const input=JSON.parse(String(db.prepare('SELECT input FROM user_tasks WHERE task_id=?').get(last())!.input));assert.equal(input.settings.timeoutMs,current.settings.timeoutMs-1000);assert.equal((await f.checked(f.a.token,'/api/file-processing')).policy.profiles[0].id,'image');
 }finally{db.close();}
});
