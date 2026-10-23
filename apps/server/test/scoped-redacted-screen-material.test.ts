import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {evidenceFixture} from './fixtures/evidence-projection.js';
import {EvidenceProjection,materialOriginalsSql} from '../src/scope/evidence-projection.js';
import {materialId} from '../src/material-organizer-contract.js';
const secret='GENERATED_REDACTED_CONTENT_NOT_DISCLOSED';
const at='2026-10-18T00:00:05Z';
function rawScreen(f:ReturnType<typeof evidenceFixture>,redacted:boolean){const id=randomUUID();f.data.receiveCaptures([{id,deviceId:'generated-device',deviceName:'Generated screen',platform:'import',capturedAt:at,durationMs:2000,source:'screen',appId:'generated.app',appName:'Generated app',windowTitle:'',ocrText:redacted?secret:'GENERATED_VISIBLE_SCREEN',privacy:{excluded:false,redacted,mode:'local',collection:'content'}}],{sourceId:'generated-source',verify:()=>{}});f.sql.run('INSERT INTO ig_capture_scopes VALUES($user,?,?)',id,'generated-source');return id;}

test('current formal screen content cannot disclose redacted originals through lexical, vector, exact or Memory ports',async t=>{
 const f=evidenceFixture(t),id=rawScreen(f,true),before=f.sql.get('SELECT fingerprint,json FROM pd_captures WHERE user_id=$user AND id=?',id)!,material=f.publish('unsafe-redacted-screen',[id],[secret]);
 // Retained history validation can rebuild canonical anchors without granting
 // current model reads. It exercises the existing unsafe-anchor read boundary.
 const retained=f.reader.originals.restoreMaterialEvidence(material.id,material.revision);assert.equal(retained.length,1);const anchor=retained[0];
 f.sql.run('INSERT INTO ma_embeddings VALUES($user,?,?,?,?,?,?)',anchor.id,'generated-fingerprint','generated-receipt',String(f.sql.get('SELECT hash FROM mm_evidence WHERE user_id=$user AND id=?',anchor.id)!.hash),'generated-model','[1,0]');
 const vector=f.reader.vectorQuery('generated-model',{source:'screen'});assert.equal(f.sql.all(vector.sql,...vector.values).length,0);assert.equal(f.reader.records({source:'screen',limit:1}).items.length,0);assert.equal(f.reader.catalog({source:'screen',limit:1}).items.length,0);assert.equal(f.reader.lifecycleCandidates(0,1,{source:'screen'}).length,0);assert.equal(f.reader.snapshot({source:'screen'}).materials.length,0);
 assert.throws(()=>new EvidenceProjection(f.sql).material(material.id,material.revision));assert.throws(()=>f.reader.evidence([anchor.id]));assert.throws(()=>f.reader.originals.evidence([anchor.id]));assert.throws(()=>f.reader.originals.materialEvidence(material.id));await assert.rejects(f.reader.reader().materialRead!({ref:material.ref}));assert.throws(()=>f.reader.evidence([id]));
 const measured=f.reader.activity({});assert.equal(measured.totalDurationMs,2000);assert.ok(!JSON.stringify(measured).includes(secret));assert.deepEqual(f.sql.get('SELECT fingerprint,json FROM pd_captures WHERE user_id=$user AND id=?',id),before,'visibility leaves the canonical original immutable');
});

test('raw redacted transitive ancestors fail closed before LIMIT without displacing later eligible screen content',async t=>{
 const f=evidenceFixture(t),safe=rawScreen(f,false),bad=rawScreen(f,true),sourceId='generated-source';
 // Use canonical identities while placing both hidden Materials ahead of the
 // permitted one even when their publication timestamps are equal.
 const [goodExternal,parentExternal,nestedExternal]=['permitted-screen','redacted-parent','private-nested'].sort((a,b)=>materialId(sourceId,a)<materialId(sourceId,b)?-1:1);
 const good=f.publish(goodExternal,[safe],['GENERATED_VISIBLE_SCREEN']),parent=f.publish(parentExternal,[bad],[secret]),nested=f.data.publishMaterial({id:materialId(sourceId,nestedExternal),kind:'document',schemaVersion:1,title:'Generated nested',origin:{sourceId,externalId:nestedExternal},members:[{id:'parent',kind:'material',ref:parent.ref}],blocks:[{id:'text',kind:'text',format:'plain',text:secret,memberIds:['parent']}],coverage:{state:'complete'},fidelity:{state:'lossless'},retention:{original:'retained',policy:'keep'}});
 const unfilteredCatalog=f.sql.all('SELECT id FROM pd_materials WHERE user_id=$user ORDER BY updated_at DESC,id DESC').map(row=>String(row.id));assert.deepEqual(unfilteredCatalog,[nested.id,parent.id,good.id],'both hidden candidates precede the eligible catalog result');
 const unfilteredRecords=f.sql.all(`SELECT h.id,me_material_at(v.json,${materialOriginalsSql()},h.created_at,?) at FROM pd_materials h JOIN pd_material_versions v ON v.user_id=h.user_id AND v.material_id=h.id AND v.revision=h.revision WHERE h.user_id=$user AND v.user_id=$user ORDER BY at DESC,h.id DESC`,JSON.stringify({source:'screen'})).map(row=>String(row.id));assert.deepEqual(unfilteredRecords,[nested.id,parent.id,good.id],'both hidden candidates precede the eligible lexical result');
 const records=f.reader.records({source:'screen',limit:1}).items;assert.equal(records.length,1);assert.equal(records[0].ocrText,'GENERATED_VISIBLE_SCREEN');assert.equal(f.reader.catalog({source:'screen',limit:1}).items[0].id,good.id);assert.deepEqual(f.reader.lifecycleCandidates(0,1,{source:'screen'}).map(row=>String(row.id)),[good.id]);assert.throws(()=>f.reader.materialRecords(nested.id));await assert.rejects(f.reader.reader().materialRead!({ref:nested.ref}));
});
