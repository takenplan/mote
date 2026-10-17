import test from 'node:test';
import assert from 'node:assert/strict';
import {scopedFilesFixture} from './fixtures/scoped-files.js';

// Original Android98d fileSettings sends policy only when policyConfigured.
// A preview is not the user's persisted selection and cannot be silently saved.
test('original native scalar save preserves an unconfigured policy and the other owner',async t=>{
 const f=await scopedFilesFixture(t),view=await f.checked(f.a.token,'/api/file-processing');
 assert.equal(view.policyConfigured,false);const beforeB=await f.checked(f.b.token,'/api/file-processing');
 const response=await f.request(f.a.token,'/api/file-processing','PUT',{revision:view.revision,settings:{...view.settings,speakerCount:2}});
 assert.equal(response.statusCode,200,response.body);const saved=response.json();assert.equal(saved.policyConfigured,false);assert.equal(saved.settings.speakerCount,2);
 assert.deepEqual(await f.checked(f.b.token,'/api/file-processing'),beforeB);
});
