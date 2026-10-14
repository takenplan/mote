import test from 'node:test';
import assert from 'node:assert/strict';
import {extractionSeedScopeValid} from '../dist/index.js';

test('shared extraction seed accounting preserves exact ID and range structure without character capacity estimates',()=>{
 const ids=Array.from({length:240},(_,index)=>'generated-'+index),ranges=ids.map(id=>({id,offset:0,length:1000}));
 assert.equal(extractionSeedScopeValid(ids,ranges),true,'all authorized originals retain exact ranges without a count quota');
 assert.equal(extractionSeedScopeValid([...ids,'generated-extra'],ranges),true);
 assert.equal(extractionSeedScopeValid(ids,[...ranges,{id:ids[0],offset:1000,length:1}]),true);
 assert.equal(extractionSeedScopeValid(ids,ranges.map((range,index)=>index===0?{...range,length:100001}:range)),true);
 assert.equal(extractionSeedScopeValid(undefined,ranges),false);
 assert.equal(extractionSeedScopeValid([''],[{id:'',offset:0,length:1}]),false);
 for(const range of [{id:ids[0],offset:0,length:0},{id:ids[0],offset:-1,length:1},{id:ids[0],offset:0.5,length:1},{id:ids[0],offset:0,length:1.5},{id:'generated-outside',offset:0,length:1}])assert.equal(extractionSeedScopeValid(ids,[range]),false);
});
