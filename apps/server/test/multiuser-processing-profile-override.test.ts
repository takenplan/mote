import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {join} from 'node:path';
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
