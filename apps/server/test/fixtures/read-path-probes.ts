import assert from 'node:assert/strict';
import type {TestContext} from 'node:test';
import {randomUUID} from 'node:crypto';
import {mkdtemp,rm} from 'node:fs/promises';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {Store} from '../../src/store.js';
import {SourceStore} from '../../src/sources.js';
import {ContextQuery} from '../../src/context-query.js';
import {MaterialStore,materialId,type MaterialDraft} from '../../src/materials.js';

// The same generated scenarios preserve correctness and input scale in both
// entries. Only the explicit performance entry applies absolute speed limits.
const captured=(minutes:number)=>new Date(Date.parse('2026-09-18T00:00:00.000Z')+minutes*60000).toISOString();
async function contextQueryFixture(t:TestContext){
  const directory=await mkdtemp(join(tmpdir(),'mote-context-query-')),store=new Store(join(directory,'vault')),sources=new SourceStore(store);
  sources.register({id:'coding',name:'Generated coding source',kind:'coding-agent',deviceId:'fixture-device',platform:'import'});
  t.after(async()=>{store.close();await rm(directory,{recursive:true,force:true});});
  return {store,sources,query:new ContextQuery(store,sources)};
}
async function coding(store:Store,minutes:number,projectKey:string,sessionId:string,text:string,provider:'codex'|'claude'='codex'){
  const id=randomUUID();await store.ingest({id,deviceId:sessionId==='s-a'?'device-a':'device-b',deviceName:'Generated device',platform:'import',capturedAt:captured(minutes),durationMs:0,appId:'generated.agent',appName:'Generated Agent',windowTitle:'Generated coding turn',ocrText:text,source:'message',provenance:{sourceId:'coding',externalId:id,revision:'1',layer:'snapshot',document:{contentRole:'transcript',coding:{version:1,provider,sessionId,projectKey,eventId:id,role:'user',part:0,parts:1}}},privacy:{excluded:false,redacted:false,mode:'none'}});return id;
}
function materialFixture(t:TestContext){
  const directory=mkdtempSync(join(tmpdir(),'mote-formal-material-'));
  const store=new Store(directory);t.after(()=>{store.close();rmSync(directory,{recursive:true,force:true});});
  return {store,materials:new MaterialStore(store),directory};
}
function draft(sourceId='fixture-source',externalId='fixture-session'):MaterialDraft{
  return {id:materialId(sourceId,externalId),kind:'coding.session',schemaVersion:1,title:'Synthetic coding session',
    origin:{sourceId,externalId,firstAt:'2026-09-24T01:00:00.000Z',lastAt:'2026-09-24T01:05:00.000Z'},
    members:[{id:'source-1',kind:'source-item',ref:'source-item:fixture:1',revision:'v1',locator:{message:1}}],
    blocks:[{id:'message-1',kind:'text',format:'plain',text:'Generated first message',memberIds:['source-1'],locator:{message:1}}],
    coverage:{state:'complete'},fidelity:{state:'lossless'},retention:{original:'retained',policy:'keep'}};
}

export async function literalSearchProbe(t:TestContext){
  const {store,sources,query}=await contextQueryFixture(t);
  for(let i=0;i<120;i++)await coding(store,i%60,'github:utopiafar/mote',`s-${i%3}`,`generated filler ${i} ${i===119?'EFFICIENCY_ANCHOR':''}`);
  const started=performance.now();const result=query.search({query:'EFFICIENCY_ANCHOR',limit:5});const durationMs=performance.now()-started;
  assert.equal(result.items.length,1);assert.match(result.items[0].snippet,/EFFICIENCY_ANCHOR/);assert.ok(result.items[0].locator);assert.equal(sources.listSources().length,1);
  return durationMs;
}

export async function transcriptProbe(t:TestContext){
  const {store,materials}=materialFixture(t),captureId=randomUUID();
  await store.ingest({id:captureId,deviceId:'fixture',deviceName:'Generated',platform:'import',source:'note',
    capturedAt:'2026-09-24T01:00:00Z',durationMs:0,ocrText:'Generated transcript original'});
  const value:MaterialDraft={...draft('fixture-source','long-transcript'),
    members:[{id:'original',kind:'capture',ref:'capture:'+captureId}],
    blocks:Array.from({length:2000},(_,index)=>({id:'turn-'+index,kind:'text' as const,format:'plain',
      text:'Generated anonymous turn '+index,memberIds:['original']}))};
  const first=materials.publish(value),historical=materials.evidenceIds(first.ref);
  store.invalidateMemoryEvidence(captureId);
  assert.equal(materials.get(value.id)?.coverage.reason,'source_evidence_changed');
  const rebuilt=new MaterialStore(store),current=rebuilt.publish(value,{expectedRevision:first.revision});
  const anchors=rebuilt.evidenceIds(current.ref);
  assert.equal(anchors.length,2000);
  assert.equal(rebuilt.isCurrentEvidence(historical[0]),false);
  assert.equal(rebuilt.isCurrentEvidence(anchors[0]),true);
  const started=performance.now();
  // Model handoffs revalidate many anchors of this same current Material. Old
  // invalidations must not trigger a nested scan of every active transcript block.
  for(let index=0;index<100;index++)assert.equal(rebuilt.get(current.ref)?.coverage.state,'complete');
  const durationMs=performance.now()-started;
  store.invalidateMemoryEvidence(anchors[0]);
  assert.equal(rebuilt.get(current.ref)?.coverage.reason,'source_evidence_changed','indexing must preserve live revocation');
  assert.equal(rebuilt.get(first.ref)?.revision,first.revision,'the immutable historical revision remains addressable');
  return durationMs;
}
