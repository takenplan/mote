import test from 'node:test';
import assert from 'node:assert/strict';
import {literalSearchProbe,transcriptProbe} from '../fixtures/read-path-probes.js';

test('literal search of the generated archive finishes within one second',async t=>{
  const durationMs=await literalSearchProbe(t);
  assert.ok(durationMs<1000,`fixture lexical search was too slow: ${durationMs}ms`);
});
test('100 rebuilt transcript fences finish within two seconds',async t=>{
  const durationMs=await transcriptProbe(t);
  assert.ok(durationMs<2000,'100 current transcript fences must finish within two seconds');
});
