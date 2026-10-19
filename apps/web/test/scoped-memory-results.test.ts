import test from 'node:test';
import assert from 'node:assert/strict';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {moteText} from '@mote/shared/i18n';
import {ScopedMemoryProgress,scopedMemoryResults,type ScopedMemoryJob} from '../src/ScopedMemoryProgress.js';

test('a continuous batch receipt exposes saved results while another batch is still running',()=>{
 const job:ScopedMemoryJob={id:'generated',state:'ready',current:true,batches:[{id:'first',state:'committed'},{id:'later',state:'ready'}],tasks:{
  'batch:0':{id:'saved',state:'succeeded',result:{memoryIds:['generated-saved']}},
  'batch:1':{id:'pending',state:'running',result:{memoryIds:['generated-pending']}},
 }};
 assert.deepEqual(scopedMemoryResults(job),['generated-saved']);
 const html=renderToStaticMarkup(createElement(ScopedMemoryProgress,{job,onAction:()=>{},onView:()=>{}}));assert.ok(html.includes(moteText('查看记忆')),'the actual progress component exposes the first saved card while later work remains active');assert.ok(html.includes('1 / 2'));
 job.tasks['batch:1'].state='succeeded';assert.deepEqual(scopedMemoryResults(job),['generated-saved','generated-pending']);
});
