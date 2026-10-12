import {test} from 'node:test';import assert from 'node:assert/strict';
import {sourceTextFormat,decodeSourceText,sourceTextBoundaries} from '../dist/index.js';

test('declared speech text preserves literal Unicode, newlines and slashes while keeping speaker labels separate',()=>{
 const text='Generated “quoted” line.\nC:\\Notes\\fixture 😀.',metadata={speaker:'Generated speaker 1'},raw=JSON.stringify(metadata)+'\n'+text,format=sourceTextFormat({id:'chunk:generated',format:'speech-text',locator:{chunkId:'generated'}});
 assert.equal(format,'speech-text-v2');assert.deepEqual(decodeSourceText(format,raw),{kind:'speech',...metadata,text});
 const boundaries=sourceTextBoundaries(format,raw);assert.equal(boundaries[0],raw.indexOf('\n')+1);assert.equal(boundaries.at(-1),raw.length);assert.equal(raw.slice(boundaries[0]),text);assert.ok(!boundaries.includes(raw.length-2),'code-point mapping does not split the surrogate pair');
 assert.equal(sourceTextFormat({id:'generated',format:'plain'}),undefined,'captured JSON-looking prose is never decoded structurally');
 assert.equal(decodeSourceText(format,'untrusted invalid header\n'+text),undefined);
 const legacy=JSON.stringify({...metadata,text});assert.deepEqual(decodeSourceText('speech-json-v1',legacy),{kind:'speech',...metadata,text});assert.equal(sourceTextBoundaries('speech-json-v1',legacy).at(-1),legacy.length-2,'old serialized coordinates remain unchanged');
});
