import test from 'node:test';
import assert from 'node:assert/strict';
import {scopedMemoryResults,type ScopedMemoryJob} from '../src/ScopedMemoryProgress.js';

test('a continuous batch receipt exposes saved results while another batch is still running',()=>{
 const job:ScopedMemoryJob={id:'generated',state:'ready',current:true,batches:[],tasks:{
  'batch:0':{id:'saved',state:'succeeded',result:{memoryIds:['generated-saved']}},
  'batch:1':{id:'pending',state:'running',result:{memoryIds:['generated-pending']}},
 }};
 assert.deepEqual(scopedMemoryResults(job),['generated-saved']);
 job.tasks['batch:1'].state='succeeded';assert.deepEqual(scopedMemoryResults(job),['generated-saved','generated-pending']);
});
