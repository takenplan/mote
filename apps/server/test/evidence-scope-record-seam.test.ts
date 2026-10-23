import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {Store} from '../src/store.js';
import {SourceStore} from '../src/sources.js';
import {scopeRecord} from '../src/evidence-scope-record.js';
import {evidenceInterval,withinEvidenceScope} from '../src/evidence-range.js';

function fixture(t:any){const directory=mkdtempSync(join(tmpdir(),'mote-scope-metadata-')),store=new Store(directory);t.after(()=>{store.close();rmSync(directory,{recursive:true,force:true});});return {store,sources:new SourceStore(store)};}
const base=()=>({id:randomUUID(),deviceId:'generated-device',deviceName:'Generated device',platform:'macos' as const,capturedAt:'2026-10-23T00:00:00.000Z',durationMs:60000,source:'screen' as const,appId:'generated.app',appName:'Generated App',privacy:{excluded:false,redacted:false,mode:'local' as const},ocrText:'GENERATED_PRIVATE_SCOPE_BODY'});

test('lightweight screen scope preserves absent series and exact observation interval without loading original contents',async t=>{
 const {store}=fixture(t),record=base();await store.ingest(record);const original=store.db.prepare('SELECT json FROM captures WHERE id=?').get(record.id)!.json,metadata=scopeRecord(store,record.id)!;
 assert.ok(!metadata.stateSeries);assert.equal(Object.hasOwn(metadata,'ocrText'),false);assert.equal(Object.hasOwn(metadata,'imageBase64'),false);assert.ok(!JSON.stringify(metadata).includes('GENERATED_PRIVATE_SCOPE_BODY'));
 assert.deepEqual(evidenceInterval(metadata),evidenceInterval(record));assert.deepEqual(evidenceInterval(metadata),{start:'2026-10-22T23:59:00.000Z',end:record.capturedAt,interval:true});
 for(const scope of [{},{deviceId:'generated-device'},{after:'2026-10-22T23:59:30.000Z',before:'2026-10-23T00:00:01.000Z'},{after:record.capturedAt},{before:'2026-10-22T23:59:00.000Z'},{source:'note' as const}])assert.equal(withinEvidenceScope(metadata,scope),withinEvidenceScope(record,scope),JSON.stringify(scope));
 assert.equal(store.db.prepare('SELECT json FROM captures WHERE id=?').get(record.id)!.json,original);
});

test('lightweight state series preserves every timing member across midnight and omits unrelated sample metadata',async t=>{
 const {store}=fixture(t),record={...base(),ocrText:'',durationMs:60000,capturedAt:'2026-10-22T23:59:00.000Z',source:'activity' as const,privacy:{excluded:false,redacted:false,mode:'local' as const,collection:'activity' as const},stateSeries:{version:1 as const,samples:[{at:'2026-10-22T23:59:00.000Z',durationMs:60000,idleSeconds:12,availableStorageBytes:1000},{at:'2026-10-23T00:04:00.000Z',durationMs:120000,idleSeconds:18,availableStorageBytes:900}]}};await store.ingest(record);const metadata=scopeRecord(store,record.id)!;
 assert.deepEqual(metadata.stateSeries,{version:1,samples:record.stateSeries.samples.map(({at,durationMs})=>({at,durationMs}))});assert.ok(!JSON.stringify(metadata).includes('idleSeconds'));assert.ok(!JSON.stringify(metadata).includes('availableStorageBytes'));
 assert.deepEqual(evidenceInterval(metadata),evidenceInterval(record));assert.deepEqual(evidenceInterval(metadata),{start:'2026-10-22T23:58:00.000Z',end:'2026-10-23T00:04:00.000Z',interval:true});
 for(const scope of [{after:'2026-10-23T00:00:00.000Z',before:'2026-10-23T00:03:00.000Z'},{before:'2026-10-22T23:59:00.000Z'},{after:'2026-10-23T00:04:00.000Z'}])assert.equal(withinEvidenceScope(metadata,scope),withinEvidenceScope(record,scope));
});

test('lightweight calendar scope uses its planned interval independently of receipt and body',async t=>{
 const {store,sources}=fixture(t);sources.register({id:'generated-calendar',name:'Generated calendar',kind:'custom',deviceId:'generated-device',platform:'import'});const receipt=await sources.upsert('generated-calendar',{externalId:'appointment',revision:'1',observedAt:'2026-10-01T00:00:00Z',title:'Generated appointment',text:'GENERATED_PRIVATE_CALENDAR_BODY',kind:'calendar',layer:'original',calendar:{start:'2026-11-02T10:00:00Z',end:'2026-11-02T11:00:00Z',allDay:false,status:'confirmed'}}),canonical=store.evidence([receipt.id])[0],metadata=scopeRecord(store,receipt.id)!;
 assert.deepEqual(evidenceInterval(metadata),evidenceInterval(canonical));assert.equal(Object.hasOwn(metadata,'ocrText'),false);assert.ok(!JSON.stringify(metadata).includes('GENERATED_PRIVATE_CALENDAR_BODY'));
 for(const scope of [{after:'2026-11-02T10:30:00Z',before:'2026-11-02T10:45:00Z'},{after:'2026-11-02T11:00:00Z'},{after:'2026-10-01T00:00:00Z',before:'2026-10-02T00:00:00Z'}])assert.equal(withinEvidenceScope(metadata,scope),withinEvidenceScope(canonical,scope));
 assert.equal(withinEvidenceScope(metadata,{after:'2026-11-02T10:30:00Z',before:'2026-11-02T10:45:00Z'}),true);
});
