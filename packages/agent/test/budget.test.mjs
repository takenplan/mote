import {fixtureCaptureId} from './capture-fixture-id.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { startBridge } from '../dist/bridge.js';
import { parseAnswer } from '../dist/index.js';

const small={id:fixtureCaptureId('generated-capacity-original'),capturedAt:'2026-01-01T00:00:00.000Z',appName:'Generated fixture',ocrText:'Previously delivered original evidence.'};
const originals=Array.from({length:6},(_,i)=>({...small,id:fixtureCaptureId('generated-page-'+i),ocrText:'字'.repeat(12000)}));
const base={search:async()=>[small],timeline:async()=>({items:[],nextCursor:null}),evidence:async()=>[small],activity:async()=>({}),devices:async()=>[]};
const answerFor=id=>JSON.stringify({answer:'Generated answer.',citationIds:[id]});
async function request(bridge,tool,args={}){const r=await fetch(bridge.url+'/'+tool,{method:'POST',headers:{Authorization:'Bearer '+bridge.token,'Content-Type':'application/json'},body:JSON.stringify(args)});return {status:r.status,body:await r.json()};}

test('ordinary evidence pages exceed retired per-result and cumulative character quotas without shrinking',async t=>{
 const bridge=await startBridge({...base,search:async()=>originals,evidence:async({ids})=>originals.filter(r=>ids.includes(r.id))},{question:'Generated broad state review'});t.after(()=>bridge.close());
 assert.equal((await request(bridge,'search_context',{limit:6})).status,200);
 const full=await request(bridge,'evidence',{ids:originals.map(r=>r.id)});
 assert.equal(full.status,200);assert.ok(JSON.stringify(full.body).length>48000);
 assert.equal(full.body.data.length,6);for(const r of full.body.data){assert.equal(r.ocrText.length,12000);assert.equal(r.textRange.nextOffset,null);}
 assert.ok(bridge.deliveredCharacters>48000);assert.equal('remainingCharactersBeforeResult' in full.body.toolUsage,false);assert.equal('remainingCalls' in full.body.toolUsage,false);
 assert.equal(parseAnswer(answerFor(originals[4].id),bridge.records).citations[0].id,originals[4].id);
 for(let i=0;i<30;i++)assert.equal((await request(bridge,'search_context',{limit:1})).status,200);
 assert.ok(bridge.trace.length>24,'default tool execution is governed by deadline and real failures, not a call quota');
});

test('large ordinary metadata is delivered intact without a replacement bridge byte quota',async t=>{
 const large={...small,provenance:{sourceId:'generated-source',externalId:'x'.repeat(1500000)}};
 const bridge=await startBridge({...base,search:async()=>[large]},{question:'Generated transport boundary'});t.after(()=>bridge.close());
 const delivered=await request(bridge,'search_context');assert.equal(delivered.status,200);
 assert.equal(delivered.body.data[0].provenance.externalId,large.provenance.externalId);
 assert.equal(bridge.records.size,1);assert.equal(bridge.trace.length,1);assert.ok(bridge.deliveredCharacters>1500000);
 assert.equal(parseAnswer(answerFor(small.id),bridge.records).citations[0].id,small.id);
});

test('large later results preserve previously delivered evidence and retain the full next result',async t=>{
 const large={...small,id:fixtureCaptureId('generated-transport-tail'),provenance:{externalId:'x'.repeat(1500000)}};
 const bridge=await startBridge({...base,timeline:async()=>({items:[large],nextCursor:null})},{question:'Generated prior evidence preservation'});t.after(()=>bridge.close());
 assert.equal((await request(bridge,'search_context')).status,200);const earlier=structuredClone(bridge.records.get(small.id)),before=bridge.deliveredCharacters;
 const delivered=await request(bridge,'timeline');assert.equal(delivered.status,200);
 assert.deepEqual(bridge.records.get(small.id),earlier);assert.equal(bridge.records.has(large.id),true);assert.ok(bridge.deliveredCharacters>before+1500000);assert.equal(bridge.trace.length,2);
});

test('only an explicitly configured caller tool limit is enforced and cannot remove existing evidence',async t=>{
 let searches=0;const bridge=await startBridge({...base,search:async()=>{searches++;return [small];}},{question:'Generated explicit caller contract'},2);t.after(()=>bridge.close());
 const found=await request(bridge,'search_context');assert.equal(found.status,200);assert.equal(found.body.toolUsage.remainingCalls,1);
 const expanded=await request(bridge,'evidence',{ids:[small.id]});assert.equal(expanded.status,200);assert.equal(expanded.body.toolUsage.remainingCalls,0);
 const before=bridge.deliveredCharacters,denied=await request(bridge,'search_context');assert.equal(denied.status,400);assert.equal(denied.body.toolError.code,'tool_budget_exceeded');assert.equal(searches,1);assert.equal(bridge.deliveredCharacters,before);
 assert.equal(parseAnswer(answerFor(small.id),bridge.records).citations[0].id,small.id);
});


test('initial extraction accepts exact authorized ranges beyond retired character estimates',async t=>{
 const source={...small,ocrText:'字'.repeat(180001)},range={id:source.id,offset:0,length:source.ocrText.length};
 const bridge=await startBridge({...base,evidence:async()=>[source]},{question:'Generated authorized target',evidenceIds:[source.id],evidenceRanges:[range]});t.after(()=>bridge.close());
 assert.equal(bridge.seedEvidence[0].ocrText,source.ocrText);assert.deepEqual(bridge.deliveredRanges,[range]);
 const seen=[],large={...source,ocrText:'字'.repeat(600000)},largeRange={...range,length:large.ocrText.length};
 const full=await startBridge({...base,evidence:async()=>[large]},{question:'Generated large authorized target',evidenceIds:[source.id],evidenceRanges:[largeRange],onEvidence:records=>seen.push(...records)});t.after(()=>full.close());
 assert.equal(full.seedEvidence[0].ocrText,large.ocrText);assert.deepEqual(full.deliveredRanges,[largeRange]);assert.equal(seen[0].ocrText,large.ocrText);
});
