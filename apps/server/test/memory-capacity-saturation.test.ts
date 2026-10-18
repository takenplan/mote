import {test,type TestContext} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import type {QueryResult} from '@mote/shared';
import {Store} from '../src/store.js';
import {SourceStore} from '../src/sources.js';
import {MemoryStore} from '../src/memory.js';
import {MemoryPipeline,type MemoryPipelineQuery,type MemoryPipelineOptions} from '../src/memory-pipeline.js';
import {reviewMemory} from '../src/memory-review.js';
import type {MemoryWorkMember} from '../src/memory-work-contract.js';
import {MemoryPublication} from '../src/memory-publication.js';
import type {MemoryBindings} from '../src/memory-bindings.js';

// Eight independent generated facts fill exactly 512 UTF-16 code units. Repeating
// them creates a long original without importing any personal captured content.
const block=Array.from({length:8},(_,i)=>`Generated fact ${i}: owner selected synthetic option ${i}.`.padEnd(64,'.')).join('');
const text=(length:number)=>block.repeat(Math.ceil(length/block.length)).slice(0,length);
const work=(input:MemoryPipelineQuery)=>input.taskContext!.memoryWork as {members:MemoryWorkMember[];maxCandidates:number};

async function fixture(t:TestContext,lengths:number[],budget=12000,retained=false){
 const directory=mkdtempSync(join(tmpdir(),'mote-memory-capacity-'));
 let store=new Store(directory),memories=new MemoryStore(store),publication:MemoryPublication|undefined;
 const sources=new SourceStore(store);
 sources.register({id:'generated-capacity',name:'Generated capacity fixture',kind:'custom',deviceId:'generated',platform:'import'});
 const ids:string[]=[];
 for(const [index,length] of lengths.entries())ids.push((await sources.upsert('generated-capacity',{externalId:String(index),revision:'1',text:text(length),observedAt:'2026-10-13T00:00:00Z',kind:'file',layer:'original'})).id);
 const seen:MemoryPipelineQuery[]=[],reviews:MemoryPipelineQuery[]=[];
 let generate:(input:MemoryPipelineQuery)=>QueryResult=input=>output(input,1,false,'generated-extract'),review:(input:MemoryPipelineQuery,draft:QueryResult)=>QueryResult=(_input,draft)=>({...draft,runId:'generated-review'});
 let writes=0;
 function open(){
  if(retained){
   // Real publication journal with generated namespace discovery. Saturation
   // must fail before canonical provider writes, so no transport is needed.
   const binding={planId:'instance:generated-capacity',generation:1,namespace:{ownerId:'generated-owner',instanceId:'generated-capacity',bindingRevision:1}};
   store.db.exec('CREATE TABLE IF NOT EXISTS memory_plan_binding(id INTEGER PRIMARY KEY CHECK(id=1),json TEXT NOT NULL);CREATE TABLE IF NOT EXISTS memory_provider_receipts(id TEXT PRIMARY KEY,json TEXT NOT NULL);');
   store.db.prepare('INSERT OR IGNORE INTO memory_plan_binding VALUES(1,?)').run(JSON.stringify(binding));
   const bindings={binding:()=>structuredClone(binding),provider:()=>({async put(){writes++;throw Error('Saturated output must not reach a canonical provider write');}}),plugins:{references:()=>[]}} as unknown as MemoryBindings;
   publication=new MemoryPublication(store,memories,bindings);
  }
  const options:MemoryPipelineOptions={store,memories,publication,batchCharacters:budget,configured:()=>true,model:()=> 'generated-capacity-model',requireAdmission:true,query:async input=>{seen.push(input);return generate(input);},review:(input,draft)=>reviewMemory(input,draft,async reviewed=>{reviews.push(reviewed as MemoryPipelineQuery);return review(reviewed as MemoryPipelineQuery,draft);})};
  return new MemoryPipeline(options);
 }
 let pipeline=open();
 async function close(){await pipeline.close();await publication?.close();store.close();}
 t.after(async()=>{await close();rmSync(directory,{recursive:true,force:true});});
 function output(input:MemoryPipelineQuery,count:number,saturated:boolean,runId:string):QueryResult{
  const member=work(input).members[0],record=memories.readEvidence([member.id])[0];
  const candidates=Array.from({length:count},(_,index)=>{const offset=member.offset+index*64,quote=record.ocrText.slice(offset,Math.min(offset+64,member.offset+member.length));return {title:`Generated selection ${index}`,statement:`The owner selected synthetic option ${index} in this generated range [${member.id}]`,uncertainty:'Generated fixture only',admission:{layer:'memory',reason:'Explicit generated selection',scope:'This exact generated range',attribution:'user'},evidenceIds:[member.id],evidence:[{id:member.id,offset,quote}]};});
  return {runId,trace:[],citations:count?[{id:member.id,capturedAt:'2026-10-13T00:00:00Z',appName:'Generated capacity fixture',excerpt:''}]:[],answer:JSON.stringify({memories:candidates,coverage:work(input).members.map((member,index)=>({key:member.key,state:index===0&&count?'checked':'no_candidates',candidateIndexes:index===0?candidates.map((_,index)=>index):[]})),capacity:{saturated}})};
 }
 return {get store(){return store;},get memories(){return memories;},get publication(){return publication;},ids,seen,reviews,output,get pipeline(){return pipeline;},writes:()=>writes,setGenerate(fn:typeof generate){generate=fn;},setReview(fn:typeof review){review=fn;},async restart(){await close();store=new Store(directory);memories=new MemoryStore(store);pipeline=open();},create(artifactRefs?:{id:string;revision:string}[]){return pipeline.create({evidenceIds:ids,artifactRefs,workPackage:{id:'generated-capacity-package',goal:'Inspect all generated authorized ranges',instruction:'Preserve exact generated provenance and account for each supplied range'}});}};
}

test('an exact candidate ceiling remains failed at depth four through restart and one retry, preserving completed work',async t=>{
 const f=await fixture(t,[8192,64],8192);
 const interpretation='Generated fixed interpretation retained during target subdivision.';
 const artifact=f.store.archive.save('3'.repeat(64),'generated-capacity-context','1'.repeat(64),{kind:'semantic',text:interpretation,metadata:{evidenceRanges:f.ids.map((id,index)=>({id,offset:0,length:index===0?8192:64}))}},f.ids.map(id=>({id,fingerprint:f.store.archive.fingerprint(id)!})),'generated-only','1','2'.repeat(64));
 f.setGenerate(input=>f.output(input,input.evidenceIds.includes(f.ids[0])?8:1,false,'generated-extract-'+input.traceContext!.batchId));
 const job=f.create([{id:artifact.id,revision:artifact.revision}]),failed=await f.pipeline.run(job.id);
 const leaves=failed.batches.filter(batch=>batch.status==='failed');
 assert.equal(failed.status,'failed');assert.equal(leaves.length,16);assert.equal(failed.batches.length,32);
 assert.ok(leaves.every(batch=>batch.errorCode==='memory_capacity_saturated'&&batch.splitDepth===4&&batch.attempts===1&&batch.phase==='review'));
 assert.ok(leaves.every(batch=>!batch.validationFailures?.length),'valid complete coverage at the ceiling is a capacity disposition, not output validation failure');
 const ranges=leaves.flatMap(batch=>batch.evidenceRanges).sort((a,b)=>a.offset-b.offset);
 assert.deepEqual(ranges.map(range=>[range.id,range.offset,range.length]),Array.from({length:16},(_,index)=>[f.ids[0],index*512,512]));
 for(const leaf of leaves)assert.deepEqual(leaf.splitHistory!.map(split=>[split.errorCode,split.attempts,split.evidenceRanges[0].length]),[8192,4096,2048,1024].map(length=>['memory_capacity_saturated',1,length]));
 assert.equal(f.memories.list().length,1,'the completed short range is the only committed candidate');
 assert.equal(f.store.db.prepare('SELECT count(*) n FROM memory_checkpoints').get()!.n,1,'saturated ranges never checkpoint');
 const checkpoints=f.store.db.prepare('SELECT key FROM memory_checkpoints').all(),completed=failed.batches.find(batch=>batch.status==='completed'&&!batch.supersededBy)!;
 const extractCalls=f.seen.length,reviewCalls=f.reviews.length;
 assert.equal(extractCalls,32);assert.equal(reviewCalls,32);
 assert.ok(f.seen.every(input=>input.taskContext!.untrustedInterpretations!.includes(interpretation)),'subdivision retains the same bounded generated interpretation');
 await f.restart();
 assert.equal(f.pipeline.get(job.id).status,'failed');
 const retried=await f.pipeline.retry(job.id),retriedLeaves=retried.batches.filter(batch=>batch.status==='failed');
 assert.equal(retried.status,'failed');assert.equal(retried.batches.length,32);
 assert.deepEqual(retriedLeaves.map(batch=>batch.id),leaves.map(batch=>batch.id),'retry creates no depth-five descendants');
 assert.ok(retriedLeaves.every(batch=>batch.attempts===2&&batch.splitDepth===4&&batch.phase==='review'&&batch.errorCode==='memory_capacity_saturated'));
 assert.ok(retriedLeaves.every(batch=>batch.splitHistory!.length===4&&!batch.validationFailures?.length));
 assert.equal(f.seen.length,extractCalls,'restart and retry reuse the valid private extraction drafts');
 assert.equal(f.reviews.length,reviewCalls+16,'only failed leaf ranges receive another independent review');
 assert.equal(retried.batches.find(batch=>batch.id===completed.id)!.attempts,1);
 assert.deepEqual(retried.memoryIds,failed.memoryIds);assert.equal(f.memories.list().length,1);
 assert.deepEqual(f.store.db.prepare('SELECT key FROM memory_checkpoints').all(),checkpoints);
});

test('member partition and text bisection share the depth budget, leaving 2166-character terminal ranges',async t=>{
 const f=await fixture(t,[4332,64,64,64,64,64,64]);
 f.setGenerate(input=>{const members=work(input).members,hasLong=members.some(member=>member.id===f.ids[0]);return f.output(input,hasLong?8:0,hasLong&&members.length>1,'generated-mixed-extract');});
 const failed=await f.pipeline.run(f.create().id),leaves=failed.batches.filter(batch=>batch.status==='failed');
 assert.equal(failed.status,'failed');assert.equal(leaves.length,2);
 assert.deepEqual(leaves.flatMap(batch=>batch.evidenceRanges).sort((a,b)=>a.offset-b.offset).map(range=>[range.id,range.offset,range.length]),[[f.ids[0],0,2166],[f.ids[0],2166,2166]]);
 assert.ok(leaves.every(batch=>batch.splitDepth===4&&batch.errorCode==='memory_capacity_saturated'));
 for(const leaf of leaves){assert.deepEqual(leaf.splitHistory!.map(split=>split.evidenceRanges.length),[7,4,2,1]);assert.deepEqual(leaf.splitHistory!.map(split=>split.evidenceRanges[0].length),[4332,4332,4332,4332]);}
 assert.equal(f.store.db.prepare('SELECT count(*) n FROM memory_checkpoints').get()!.n,6,'all six complete short originals checkpoint independently');
 assert.equal(f.memories.list().length,0,'no candidate from the saturated long original commits');
});

test('a retained reviewed saturation verdict survives full store restart and retry without another model call',async t=>{
 const f=await fixture(t,[8192],12000,true);
 f.setGenerate(input=>f.output(input,8,false,'generated-retained-extract-'+input.traceContext!.batchId));
 const job=f.create(),failed=await f.pipeline.run(job.id),leaves=failed.batches.filter(batch=>batch.status==='failed');
 assert.equal(failed.status,'failed');assert.equal(leaves.length,16);assert.equal(f.seen.length,31);assert.equal(f.reviews.length,31);
 assert.ok(leaves.every(batch=>batch.splitDepth===4&&batch.attempts===1&&batch.errorCode==='memory_capacity_saturated'));
 const outputs=f.store.db.prepare('SELECT id,json FROM memory_publication_outputs ORDER BY id').all();
 assert.equal(outputs.length,31,'every reviewed subdivision result is retained before split commit, including the terminal leaves');
 for(const leaf of leaves){const output=f.publication!.retainedOutput<{subdivide:string;result:QueryResult;reviewReceipt:{decision:string}}>(leaf.id)!;assert.equal(output.subdivide,'memory_capacity_saturated');assert.equal(output.reviewReceipt.decision,'independent');assert.equal(JSON.parse(output.result.answer).capacity.saturated,false,'the host ceiling can saturate a retained result whose model flag is false');}
 assert.equal(f.writes(),0);assert.equal(f.memories.list().length,0);assert.equal(f.store.db.prepare('SELECT count(*) n FROM memory_checkpoints').get()!.n,0);
 await f.restart();
 const retried=await f.pipeline.retry(job.id);
 assert.equal(retried.status,'failed');assert.equal(retried.batches.length,31);
 assert.deepEqual(retried.batches.filter(batch=>batch.status==='failed').map(batch=>[batch.id,batch.attempts,batch.splitDepth,batch.errorCode]),leaves.map(batch=>[batch.id,1,4,'memory_capacity_saturated']));
 assert.equal(f.seen.length,31);assert.equal(f.reviews.length,31,'retained reviewed outputs bypass extraction and independent review on retry');
 assert.deepEqual(f.store.db.prepare('SELECT id,json FROM memory_publication_outputs ORDER BY id').all(),outputs,'retry replays the same saved verdict, rather than refreshing it');
 assert.equal(f.writes(),0);assert.equal(f.memories.list().length,0);assert.equal(f.store.db.prepare('SELECT count(*) n FROM memory_checkpoints').get()!.n,0);
});

for(const variant of ['review-clears-extractor-saturation','review-reports-zero-candidate-saturation','below-ceiling-completes'] as const)test(variant,async t=>{
 const f=await fixture(t,[511]);
 f.setGenerate(input=>f.output(input,7,variant==='review-clears-extractor-saturation','generated-extract'));
 f.setReview(input=>f.output(input,variant==='review-reports-zero-candidate-saturation'?0:7,variant==='review-reports-zero-candidate-saturation','generated-review'));
 const done=await f.pipeline.run(f.create().id);
 assert.equal(f.seen.length,1);assert.equal(f.reviews.length,1);
 if(variant==='review-reports-zero-candidate-saturation'){
  assert.equal(done.status,'failed');assert.equal(done.batches[0].errorCode,'memory_capacity_saturated');assert.equal(done.batches[0].splitDepth,undefined,'the lone range is below the existing 512-character split floor');assert.equal(f.memories.list().length,0);assert.equal(f.store.db.prepare('SELECT count(*) n FROM memory_checkpoints').get()!.n,0);
 }else{
  assert.equal(done.status,'completed');assert.equal(done.memoryIds.length,7);assert.equal(f.store.db.prepare('SELECT count(*) n FROM memory_checkpoints').get()!.n,1);assert.equal(done.batches[0].reviewReceipt?.decision,'independent');
 }
});
