import test from 'node:test';
import assert from 'node:assert/strict';
import {dialogueGroups} from '../src/dialogue-groups.js';
import type {Capture} from '../src/api.js';
const child=(id:number,extra:Record<string,unknown>={})=>({id:String(id),ocrText:'Generated '+id,fileEvidence:{artifactId:'generated-artifact',speaker:'SPEAKER_0',startMs:id*500,endMs:(id+1)*500,...extra}} as Capture);
test('display grouping preserves every uncertain child, reference and correction target across pages',()=>{
 const first=Array.from({length:100},(_,i)=>child(i,{uncertain:i%2===0})),next=[child(100),child(101)];
 const saved=structuredClone([...first,...next]),groups=dialogueGroups([...first,...next]);
 assert.equal(groups.length,1);assert.deepEqual(groups.flat(),saved);assert.equal(groups[0][100],next[0]);assert.equal(groups[0].filter(c=>c.fileEvidence?.uncertain).length,50);
});
test('speaker, overlap, gap, artifact, unknown labels and confirmed identity boundaries are preserved',()=>{
 for(const extra of [{speaker:'SPEAKER_1'},{overlap:true},{startMs:1801,endMs:2000},{artifactId:'other'},{speakerAttribution:{confirmationId:'other',name:'Generated name'}}])assert.equal(dialogueGroups([child(0),child(1,extra)]).length,2);
 assert.equal(dialogueGroups([child(0,{speaker:'SPEAKER_UNKNOWN'}),child(1,{speaker:'SPEAKER_UNKNOWN'})]).length,2);
 assert.equal(dialogueGroups([{id:'generated',ocrText:'text'} as Capture,{id:'generated-2',ocrText:'text'} as Capture]).length,2);
});
