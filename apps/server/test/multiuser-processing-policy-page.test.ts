import test from 'node:test';
import assert from 'node:assert/strict';
import {scopedFilesFixture} from './fixtures/scoped-files.js';

// This is the original settings page route and field order, with M04 reference
// values in services instead of a second endpoint/credential store.
test('the original file processing page retains owned named source and MIME rules',async t=>{
 const f=await scopedFilesFixture(t),page=await f.request(f.a.token,'/api/file-processing');assert.equal(page.statusCode,200,page.body);const view=page.json();
 const policy={version:1,services:[],profiles:[{id:'text',name:'Generated text processing',processorId:'text.utf8',parameters:{},diarizationProcessor:'audio.diarize',summarize:false},{id:'archive',name:'Generated original only',processorId:'archive',parameters:{},diarizationProcessor:'audio.diarize',summarize:false}],rules:[{sourceId:'same-source',type:'text/plain',profileId:'archive'},{type:'text/*',profileId:'text'},{type:'*/*',profileId:'archive'}]};
 const saved=await f.checked(f.a.token,'/api/file-processing','PUT',{revision:view.revision,settings:view.settings,policy});assert.equal(saved.policyConfigured,true);
 assert.equal((await f.checked(f.a.token,'/api/file-processing/match','POST',{sourceId:'same-source',mimeType:'text/plain'})).profile.id,'archive');
 assert.equal((await f.checked(f.a.token,'/api/file-processing/match','POST',{sourceId:'other-source',mimeType:'text/plain'})).profile.id,'text');
 assert.equal((await f.checked(f.a.token,'/api/file-processing/match','POST',{sourceId:'other-source',mimeType:'application/octet-stream'})).profile.id,'archive');
 const b=await f.checked(f.b.token,'/api/file-processing');assert.equal(b.policyConfigured,false,'same source/profile IDs do not import A settings into B');
 assert.equal((await f.request(f.a.token,'/api/file-processing','PUT',{revision:view.revision,settings:view.settings,policy})).statusCode,409,'the original page save remains configuration-CAS qualified');
});
