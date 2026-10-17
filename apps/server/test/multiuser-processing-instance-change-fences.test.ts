import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {DatabaseSync} from 'node:sqlite';
import {join} from 'node:path';
import sharp from 'sharp';
import {defaultModelSettings,defaultModelDomain} from '../src/model-settings.js';
import {scopedFilesFixture} from './fixtures/scoped-files.js';
import {waitForScopedState} from './fixtures/scoped-process.js';

for(const control of ['cancel','source-withdraw','forget','account-disable','unknown','completed','unchanged-reference','intent-cancel','held-cancel','held-source-withdraw','held-forget','held-account-disable'])test('shared dependency recheck respects '+control+' across notification and restart',async t=>{
 const calls:string[]=[],server=createServer(async(req,res)=>{
  for await(const _ of req){}const key=String(req.headers.authorization);calls.push(key);
  if(key==='Bearer GENERATED_FENCE_OLD'&&control!=='completed'){
   res.statusCode=control==='unknown'?503:400;
   if(control!=='unknown')res.setHeader('X-Mote-Execution-Started','false');res.end('{}');return;
  }
  res.setHeader('X-Mote-Execution','local');res.end(JSON.stringify({durationMs:0,engine:'generated-shared-fence',segments:[{startMs:0,endMs:0,text:'GENERATED_FIXED_ORIGINAL'}]}));
 });
 await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(()=>new Promise<void>(resolve=>server.close(()=>resolve())));const address=server.address();assert.ok(address&&typeof address!=='string');
 const f=await scopedFilesFixture(t),settings=(key:string)=>({...defaultModelSettings(),provider:'custom',protocol:'mote-media',baseUrl:'http://127.0.0.1:'+address.port,apiKey:key,model:''});
 const instance=await f.checked(f.admin.token,'/api/admin/configuration/models');await f.checked(f.admin.token,'/api/admin/configuration/models','PUT',{revision:instance.revision,value:{...defaultModelDomain(),deployment:settings('GENERATED_FENCE_OLD')}});
 const page=await f.checked(f.a.token,'/api/file-processing');await f.checked(f.a.token,'/api/file-processing','PUT',{revision:page.revision,settings:{...page.settings,automatic:true,understandingEnabled:false},policy:{version:1,services:[{id:'image',name:'Generated fixed reference',kind:'image',reference:{kind:'shared',id:'env:deployment'}}],profiles:[{id:'image',name:'Generated image',processorId:'image.http',serviceId:'image',parameters:{},summarize:false},{id:'archive',name:'Generated original only',processorId:'archive',parameters:{},summarize:false}],rules:[{type:'image/*',profileId:'image'},{type:'*/*',profileId:'archive'}]}});
 const png=await sharp({create:{width:2,height:2,channels:3,background:'#625731'}}).png().toBuffer(),file=await f.uploadBytes(f.a.token,'generated-fenced-image',png,'image/png');let detail:any;
 await waitForScopedState(async()=>{detail=await f.checked(f.a.token,'/api/files/'+file.id);return control==='completed'?detail.processing.indexed:['failed','blocked','stale'].includes(detail.job?.state);},()=>JSON.stringify(detail),8000);
 const read=<T>(work:(db:DatabaseSync)=>T)=>{const db=new DatabaseSync(join(f.directory,'mote.sqlite'),{readOnly:true});try{return work(db);}finally{db.close();}};
 if(control==='unknown')assert.ok(read(db=>Number(db.prepare("SELECT count(*) n FROM task_external_calls WHERE user_id=? AND state IN('issued','unknown')").get(f.a.userId)!.n))>0,'the negative must contain an actual unresolved issuance');
 const retirement=control.replace(/^held-/,''),held=control.startsWith('held-');
 const applyRetirement=async()=>{
  if(retirement==='cancel')await f.checked(f.a.token,'/api/files/'+file.id+'/cancel','POST',{});
  if(retirement==='source-withdraw')await f.checked(f.a.token,'/api/sources/same-source','PATCH',{enabled:false});
  if(retirement==='forget')await f.checked(f.a.token,'/api/files/'+file.id,'DELETE',{operationId:'generated-fenced-forget',originalGeneration:detail.originalGeneration});
  if(retirement==='account-disable')await f.checked(f.admin.token,'/api/admin/accounts/'+f.a.userId,'PATCH',{disabled:true});
  if(retirement==='intent-cancel'){const root=read(db=>db.prepare("SELECT id FROM execution_steps WHERE user_id=? AND kind='processing.pipeline'").get(f.a.userId))!;await f.checked(f.a.token,'/api/tasks/'+root.id+'/cancel','POST',{});}
 };
 let enter!:()=>void,release!:()=>void;const entered=new Promise<void>(resolve=>enter=resolve),gate=new Promise<void>(resolve=>release=resolve);t.after(()=>release());
 if(held){const original=f.host.configuration!.refreshProcessingDependencies.bind(f.host.configuration);f.host.configuration!.refreshProcessingDependencies=async context=>{await original(context);if(context.userId===f.a.userId){enter();await gate;}};}else await applyRetirement();
 const count=()=>read(db=>db.prepare("SELECT count(*) n FROM execution_steps WHERE user_id=? AND kind='processing.pipeline'").get(f.a.userId)!.n),before=count(),current=await f.checked(f.admin.token,'/api/admin/configuration/models');
 await f.checked(f.admin.token,'/api/admin/configuration/models','PUT',{revision:current.revision,value:{...defaultModelDomain(),deployment:settings(control==='unchanged-reference'?'GENERATED_FENCE_OLD':'GENERATED_FENCE_NEW'),...(control==='unchanged-reference'?{profiles:[{id:'unused',name:'Generated unrelated resource',settings:settings('GENERATED_UNUSED')}]}:{})}});
 if(held){await entered;await applyRetirement();release();}
 const settled=async()=>{await f.host.configuration!.instance.reload();await f.host.execution!.tick();await waitForScopedState(async()=>read(db=>Number(db.prepare("SELECT count(*) n FROM execution_steps WHERE user_id=? AND kind='processing.recheck' AND state IN('waiting','running')").get(f.a.userId)!.n))===0,()=>'bounded recheck did not settle',5000);};
 await settled();assert.deepEqual(calls,['Bearer GENERATED_FENCE_OLD']);assert.equal(count(),before,'no retired, unchanged, complete or unknown unit is re-admitted');
 await f.restart();await settled();assert.deepEqual(calls,['Bearer GENERATED_FENCE_OLD']);assert.equal(count(),before);
 assert.equal(read(db=>Number(db.prepare('SELECT count(*) n FROM mp_publications WHERE user_id=?').get(f.a.userId)!.n)),control==='completed'?1:0);
});
