import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {createHash} from 'node:crypto';
import type {CaptureRecord} from '@mote/shared';
import {withinEvidenceScope} from '../src/evidence-range.js';
import {blockDimensions,blockWithinScope,installEvidenceProjection} from '../src/scope/evidence-projection.js';
import type {MaterialDraft} from '../src/scope/material-model.js';
const hash=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const capture=(at:string,source:CaptureRecord['source']='file'):CaptureRecord=>({id:'00000000-0000-5000-a000-'+hash(at).slice(0,12),source,deviceId:'generated-device',deviceName:'Generated device',platform:'import',capturedAt:at,receivedAt:at,durationMs:0,appId:'generated.app',appName:'Generated source',windowTitle:'Generated title',ocrText:'Generated original',privacy:{excluded:false,redacted:false,mode:'none'},blobHash:null,imageMime:null,indexingStatus:'indexed',provenance:{sourceId:'generated-source',externalId:at,revision:'1',layer:'original',deleted:false}});
const closure=(captures:CaptureRecord[])=>({captures,materials:{}});
const draft=(originals:CaptureRecord[]):MaterialDraft=>({id:'mat_'+hash('generated'),kind:'document',schemaVersion:1,title:'Generated document',origin:{sourceId:'generated-source',externalId:'generated',firstAt:originals[0].capturedAt,lastAt:originals.at(-1)!.capturedAt},members:originals.map((record,index)=>({id:String(index),kind:'capture',ref:'capture:'+record.id})),blocks:originals.map((record,index)=>({id:'block-'+index,kind:'text',format:'plain',text:record.ocrText,memberIds:[String(index)]})),coverage:{state:'complete'},fidelity:{state:'lossless'},retention:{original:'retained',policy:'keep'}});

test('typed planned calendar intervals and source content times share JS and SQL eligibility',()=>{
 const db=new DatabaseSync(':memory:');try{installEvidenceProjection(db);
 const record=capture('2026-10-16T00:00:00Z','calendar');record.provenance!.calendar={start:'2026-10-25T10:00:00Z',end:'2026-10-25T11:00:00Z',allDay:false,status:'confirmed'};
 for(const [scope,expected] of [[{after:'2026-10-25T10:30:00Z',before:'2026-10-25T10:45:00Z'},true],[{after:'2026-10-25T11:00:00Z'},false],[{before:'2026-10-25T10:00:00Z'},false],[{after:'2026-10-16T00:00:00Z',before:'2026-10-17T00:00:00Z'},false]] as const){assert.equal(withinEvidenceScope(record,scope),expected);assert.equal(db.prepare('SELECT me_capture_matches(?,?) ok').get(JSON.stringify(record),JSON.stringify(scope))!.ok,Number(expected));}
 record.provenance!.calendar=undefined;record.provenance!.document={recordedAt:'2026-10-20T00:00:00Z',timeBasis:'recorded'};assert.ok(withinEvidenceScope(record,{after:'2026-10-20T00:00:00Z',before:'2026-10-21T00:00:00Z'}));
 }finally{db.close();}
});

test('a scoped Material uses only matching trusted members and never borrows one member for mixed lineage',()=>{
 const originals=[capture('2026-10-16T00:00:00Z'),capture('2026-10-18T00:00:00Z')],value=draft(originals),scope={after:'2026-10-18T00:00:00Z',before:'2026-10-19T00:00:00Z',source:'file' as const},db=new DatabaseSync(':memory:');
 try{installEvidenceProjection(db);assert.equal(blockWithinScope(value,value.blocks[0],closure(originals),'2026-10-22T00:00:00Z',scope),false);assert.equal(blockWithinScope(value,value.blocks[1],closure(originals),'2026-10-22T00:00:00Z',scope),true);assert.equal(blockDimensions(value,value.blocks[1],closure(originals),'2026-10-22T00:00:00Z')[0].source,'file');
 assert.equal(db.prepare('SELECT me_material_matches(?,?,?,?,NULL) ok').get(JSON.stringify(value),JSON.stringify(closure(originals)),'2026-10-22T00:00:00Z',JSON.stringify(scope))!.ok,1);
 value.blocks[1].memberIds.push('0');assert.equal(blockWithinScope(value,value.blocks[1],closure(originals),'2026-10-22T00:00:00Z',scope),false);assert.equal(db.prepare('SELECT me_material_matches(?,?,?,?,?) ok').get(JSON.stringify(value),JSON.stringify(closure(originals)),'2026-10-22T00:00:00Z',JSON.stringify(scope),'block-1')!.ok,0);
 }finally{db.close();}
});

test('ready image-only assets remain discoverable with their canonical image kind and original source',()=>{
 const originals=[capture('2026-10-18T00:00:00Z')],value=draft(originals);value.blocks=[{id:'image',kind:'asset',hash:'a'.repeat(64),mimeType:'image/png',memberIds:['0']}];value.coverage={state:'partial'};value.artifacts=[{key:'original-image',state:'ready',blockIds:['image']}];const db=new DatabaseSync(':memory:');try{installEvidenceProjection(db);for(const blockId of [null,'image:'+originals[0].id])assert.equal(db.prepare('SELECT me_material_matches(?,?,?,?,?) ok').get(JSON.stringify(value),JSON.stringify(closure(originals)),'2026-10-22T00:00:00Z',JSON.stringify({source:'file',kind:'file'}),blockId)!.ok,1);assert.equal(db.prepare('SELECT me_material_matches(?,?,?,?,NULL) ok').get(JSON.stringify(value),JSON.stringify(closure(originals)),'2026-10-22T00:00:00Z',JSON.stringify({kind:'message'}))!.ok,0);}finally{db.close();}
});


test('observed screen intervals retain measured overlap in JS and SQL scope selection',()=>{
 const record=capture('2026-10-18T10:00:00Z','screen');record.durationMs=60000;const db=new DatabaseSync(':memory:');try{installEvidenceProjection(db);for(const [scope,expected] of [[{after:'2026-10-18T09:59:30Z',before:'2026-10-18T09:59:45Z'},true],[{after:'2026-10-18T10:00:00Z'},false],[{before:'2026-10-18T09:59:00Z'},false]] as const){assert.equal(withinEvidenceScope(record,scope),expected);assert.equal(db.prepare('SELECT me_capture_matches(?,?) ok').get(JSON.stringify(record),JSON.stringify(scope))!.ok,Number(expected));}}finally{db.close();}
});
