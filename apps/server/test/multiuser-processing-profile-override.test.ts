import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import sharp from 'sharp';
import {bytesHash} from '../src/scope/originals.js';
import {scopedFilesFixture} from './fixtures/scoped-files.js';
import {waitForScopedState} from './fixtures/scoped-process.js';

test('an explicit root file profile is bound before automatic admission while equal-ID B inherits its own rule',async t=>{
 const f=await scopedFilesFixture(t),policy={version:1,services:[],profiles:[{id:'text',name:'Generated text',processorId:'text.utf8',parameters:{},summarize:false},{id:'archive',name:'Generated original only',processorId:'archive',parameters:{},summarize:false}],rules:[{type:'text/*',profileId:'text'},{type:'*/*',profileId:'archive'}]};
 for(const account of [f.a,f.b]){const page=await f.checked(account.token,'/api/file-processing');await f.checked(account.token,'/api/file-processing','PUT',{revision:page.revision,settings:{...page.settings,automatic:true},policy});}
 const upload=async(token:string,externalId:string,processingProfileId?:string)=>{const bytes=Buffer.from('Generated profile override original'),hash=bytesHash(bytes),input=await f.checked(token,'/api/ingress/sources/same-source/uploads','POST',{batchId:externalId,revision:{sourceId:'same-source',previousRevision:null,sizeBytes:bytes.length,sha256:hash,relativePath:externalId+'.txt',...(processingProfileId?{processingProfileId}:{}),item:{externalId,revision:'same-r1',observedAt:'2026-10-16T00:00:00Z',title:externalId,text:'',kind:'file',layer:'original',mimeType:'text/plain'}}});await f.checked(token,'/api/ingress/uploads/'+input.id+'/parts/0','PUT',{bytes:bytes.toString('base64'),checksum:hash});return {id:input.id,commit:()=>f.request(token,'/api/ingress/uploads/'+input.id+'/commit','POST',{})};};
 const staged=await upload(f.a.token,'same-profile-override','archive'),accepted=await staged.commit();assert.equal(accepted.statusCode,200,accepted.body);const a=accepted.json().captures[0],b=await f.upload(f.b.token,'same-profile-override','Generated B normal rule');assert.equal(a.id,b.id);const detail=await f.checked(f.a.token,'/api/files/'+a.id);
 assert.equal(detail.processing.processingRequired,false,'the explicit archive profile must override the text MIME rule before a task can start');assert.equal(detail.processing.appliedPolicy.profile.id,'archive');assert.equal(detail.job,null);assert.deepEqual((await staged.commit()).json(),accepted.json(),'lost commit ACK does not change the accepted profile');
 await waitForScopedState(async()=>Boolean((await f.checked(f.b.token,'/api/files/'+b.id)).processing.indexed),()=> 'Waiting for independent B default profile',8000);assert.equal((await f.checked(f.b.token,'/api/files/'+b.id+'/chunks')).items[0].ocrText,'Generated B normal rule');
 const unknown=await upload(f.a.token,'generated-unknown-profile','not-present'),rejected=await unknown.commit();assert.equal(rejected.statusCode,409,rejected.body);const db=new DatabaseSync(join(f.directory,'mote.sqlite'),{readOnly:true});try{assert.equal(db.prepare("SELECT count(*) n FROM pd_captures WHERE user_id=? AND external_id='generated-unknown-profile'").get(f.a.userId)!.n,0);}finally{db.close();}
});

test('confirmed image Imports bind their selected archive profile without admitting an OCR task',async t=>{
 const f=await scopedFilesFixture(t),bytes=await sharp({create:{width:2,height:2,channels:3,background:'#476d83'}}).png().toBuffer(),uploadId=randomUUID(),requestId=randomUUID(),jobs=[];
 for(const account of [f.a,f.b]){const page=await f.checked(account.token,'/api/file-processing');await f.checked(account.token,'/api/file-processing','PUT',{revision:page.revision,settings:{...page.settings,automatic:false},policy:{version:1,services:[],profiles:[{id:'archive',name:'Generated original only',processorId:'archive',parameters:{},summarize:false}],rules:[{type:'*/*',profileId:'archive'}]}});
  await f.checked(account.token,'/api/import-uploads','POST',{id:uploadId,name:'same-image.png',sizeBytes:bytes.length,mimeType:'image/png'});assert.equal((await f.request(account.token,'/api/import-uploads/'+uploadId+'/parts/0','PUT',bytes,{'content-type':'application/octet-stream'})).statusCode,200);const file=await f.checked(account.token,'/api/import-uploads/'+uploadId+'/commit','POST',{}),created=await f.request(account.token,'/api/imports','POST',{requestId,archivedFileIds:[file.id],processing:'preview',imageProfileId:'archive'});assert.equal(created.statusCode,202,created.body);
  await waitForScopedState(async()=>{const job=await f.checked(account.token,'/api/imports/'+requestId);if(['failed','needs_configuration'].includes(job.status))assert.fail(JSON.stringify(job));return job.status==='awaiting_confirmation';},()=> 'Waiting for private image preview',10000);assert.deepEqual((await f.checked(account.token,'/api/files')).items,[]);jobs.push({account,file});
 }
 const db=new DatabaseSync(join(f.directory,'mote.sqlite'),{readOnly:true});try{
  for(const {account,file}of jobs){assert.equal((await f.request(account.token,'/api/imports/'+requestId+'/confirm','POST',{})).statusCode,202);let complete:any;await waitForScopedState(async()=>{complete=await f.checked(account.token,'/api/imports/'+requestId);return ['completed','failed','needs_configuration'].includes(complete.status);},()=>JSON.stringify(complete),10000);assert.equal(complete.status,'completed',JSON.stringify(complete));assert.equal(complete.progress.imported,1);
   const detail=await f.checked(account.token,'/api/files/'+complete.media[0].captureId);assert.equal(detail.processing.appliedPolicy.profile.id,'archive');assert.equal(detail.processing.processingRequired,false);assert.equal(detail.job,null);assert.equal(complete.media[0].processing.state,'skipped');assert.equal(complete.media[0].processing.required,false);assert.equal(complete.media[0].searchable,false);assert.equal(db.prepare("SELECT count(*) n FROM user_tasks u JOIN execution_steps e ON e.id=u.task_id AND e.user_id=u.user_id WHERE u.user_id=? AND e.kind IN('processing.pipeline','processing.ocr')").get(account.userId)!.n,0);
   assert.deepEqual((await f.request(account.token,'/api/archived-files/'+file.id+'/content')).rawPayload,bytes);assert.equal((await f.request(account.token,'/api/imports/'+requestId+'/confirm','POST',{})).statusCode,202);
  }
 }finally{db.close();}
});
