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

test('global disable keeps owned work paused across restart while file cancellation prevents resume',async t=>{
 const f=await scopedFilesFixture(t),page=await f.checked(f.a.token,'/api/file-processing');await f.checked(f.a.token,'/api/file-processing','PUT',{revision:page.revision,settings:{...page.settings,automatic:true,understandingEnabled:false},policy:{version:1,services:[{id:'media',name:'Generated absent service',kind:'image',reference:{kind:'personal',id:'not-installed'}}],profiles:[{id:'image',name:'Generated image',processorId:'image.http',serviceId:'media',parameters:{},summarize:false},{id:'archive',name:'Generated archive',processorId:'archive',parameters:{},summarize:false}],rules:[{type:'image/*',profileId:'image'},{type:'*/*',profileId:'archive'}]}});
 const bytes=await sharp({create:{width:2,height:2,channels:3,background:'#739a87'}}).png().toBuffer(),first=await f.uploadBytes(f.a.token,'generated-pause-cancel',bytes,'image/png'),second=await f.uploadBytes(f.a.token,'generated-pause-resume',bytes,'image/png');for(const file of [first,second])await waitForScopedState(async()=>['failed','blocked'].includes((await f.checked(f.a.token,'/api/files/'+file.id)).job?.state),()=> 'Waiting for absent generated service',8000);
 const current=await f.checked(f.a.token,'/api/file-processing'),bBefore=await f.checked(f.b.token,'/api/configuration');await f.checked(f.a.token,'/api/file-processing','PUT',{revision:current.revision,settings:{...current.settings,enabled:false},policy:current.policy});
 let paused:any;await waitForScopedState(async()=>{paused=await f.checked(f.a.token,'/api/files/'+first.id);return paused.job?.state==='blocked'&&paused.job?.error==='processing_disabled';},()=>JSON.stringify(paused),4000);assert.equal(paused.cancellation.canCancel,true);
 const later=await f.uploadBytes(f.a.token,'generated-arrived-disabled',bytes,'image/png');await waitForScopedState(async()=>{paused=await f.checked(f.a.token,'/api/files/'+later.id);return paused.job?.state==='blocked'&&paused.job?.error==='processing_disabled';},()=>JSON.stringify(paused),4000);assert.equal((await f.checked(f.a.token,'/api/files/'+first.id+'/cancel','POST',{})).state,'cancelled');
 await f.restart();const db=new DatabaseSync(join(f.directory,'mote.sqlite'),{readOnly:true});try{
  const tasks=(ref:string)=>db.prepare("SELECT u.task_id FROM user_tasks u JOIN execution_steps e ON e.id=u.task_id AND e.user_id=u.user_id WHERE u.user_id=? AND json_extract(u.input,'$.originalRef')=? AND e.kind='processing.pipeline' ORDER BY u.task_id").all(f.a.userId,ref),cancelled=tasks(first.original.ref),beforeSecond=tasks(second.original.ref).length,beforeLater=tasks(later.original.ref).length;
  const settings=await f.checked(f.a.token,'/api/file-processing');await f.checked(f.a.token,'/api/file-processing','PUT',{revision:settings.revision,settings:{...settings.settings,enabled:true},policy:settings.policy});assert.deepEqual(tasks(first.original.ref),cancelled);assert.equal(tasks(second.original.ref).length,beforeSecond+1);assert.equal(tasks(later.original.ref).length,beforeLater+1);assert.deepEqual(await f.checked(f.b.token,'/api/configuration'),bBefore);
 }finally{db.close();}
});
