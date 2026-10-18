import test from 'node:test';
import assert from 'node:assert/strict';
import {perceptionDateBoundary} from '../src/perception-range.js';
test('inclusive image calendar days use local next midnight across daylight-saving transitions',()=>{
 const before=process.env.TZ;process.env.TZ='America/New_York';
 try{
  assert.equal(perceptionDateBoundary('2026-03-08'),'2026-03-08T05:00:00.000Z');
  assert.equal(perceptionDateBoundary('2026-03-08',true),'2026-03-09T04:00:00.000Z');
  assert.equal(perceptionDateBoundary('2026-11-01',true),'2026-11-02T05:00:00.000Z');
 }finally{if(before===undefined)delete process.env.TZ;else process.env.TZ=before;}
});
