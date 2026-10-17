import test from 'node:test';
import assert from 'node:assert/strict';
import {scopedFilesFixture} from './fixtures/scoped-files.js';

// Native scalar settings use the existing processing domain while an explicit
// configured graph uses /file-processing. Both share the same whole-document CAS.
test('native scalar mapping keeps the policy preview unsaved and fences concurrent graph creation',async t=>{
 const f=await scopedFilesFixture(t),view=await f.checked(f.a.token,'/api/file-processing');
 assert.equal(view.policyConfigured,false);const beforeB=await f.checked(f.b.token,'/api/file-processing');
 const response=await f.request(f.a.token,'/api/configuration/processing','PUT',{revision:Number(view.revision),value:{...view.settings,speakerCount:2}});
 assert.equal(response.statusCode,200,response.body);const saved=await f.checked(f.a.token,'/api/file-processing');assert.equal(saved.policyConfigured,false);assert.equal(saved.settings.speakerCount,2);
 const policy={version:1,services:[],profiles:[{id:'archive',name:'Generated explicit archive',processorId:'archive',parameters:{},diarizationProcessor:'audio.diarize',summarize:false}],rules:[{type:'*/*',profileId:'archive'}]};
 const configured=await f.checked(f.a.token,'/api/file-processing','PUT',{revision:saved.revision,settings:saved.settings,policy});assert.equal(configured.policyConfigured,true);
 const stale=await f.request(f.a.token,'/api/configuration/processing','PUT',{revision:Number(saved.revision),value:{...saved.settings,speakerCount:3}});assert.equal(stale.statusCode,409,stale.body);
 assert.deepEqual(await f.checked(f.a.token,'/api/file-processing'),configured);assert.deepEqual(await f.checked(f.b.token,'/api/file-processing'),beforeB);
});
