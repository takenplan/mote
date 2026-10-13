import test from 'node:test';
import assert from 'node:assert/strict';
import {extractionSeedScopeFitsBudget} from '../dist/index.js';

test('shared extraction seed accounting preserves the existing ID, range and UTF-16 bounds',()=>{
 const ids=Array.from({length:100},(_,index)=>'generated-'+index),ranges=ids.map(id=>({id,offset:0,length:1000}));
 assert.equal(extractionSeedScopeFitsBudget(ids,ranges),true,'the existing 100 originals and 100000 characters still fit');
 assert.equal(extractionSeedScopeFitsBudget([...ids,'generated-extra'],ranges),false);
 assert.equal(extractionSeedScopeFitsBudget(ids,[...ranges,{id:ids[0],offset:1000,length:1}]),false);
 assert.equal(extractionSeedScopeFitsBudget(ids,ranges.map((range,index)=>index===0?{...range,length:1001}:range)),false);
 assert.equal(extractionSeedScopeFitsBudget(undefined,ranges),false);
 for(const range of [{id:ids[0],offset:0,length:0},{id:ids[0],offset:-1,length:1},{id:ids[0],offset:0.5,length:1},{id:ids[0],offset:0,length:1.5},{id:'generated-outside',offset:0,length:1}])assert.equal(extractionSeedScopeFitsBudget(ids,[range]),false);
});
