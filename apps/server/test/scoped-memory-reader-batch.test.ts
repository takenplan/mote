import test,{type TestContext} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {scopedMemoryFixture} from './fixtures/scoped-memory-host.js';
import {scopedMemoryTaskSchema} from '../src/scope/memory-schema.js';
import {memoryEvidenceFingerprint} from '../src/memory.js';

async function fixture(t:TestContext){
 const f=await scopedMemoryFixture(t),settings=(await f.request(f.a.token,'/api/memory')).json().settings;
 await f.replace(f.a.token,'memory',{...settings,automatic:false,integration:false});
 const materials=await Promise.all(['first','tail','optional','changed','valid'].map(key=>f.publish(f.a,'A','same-source',key,'Generated reader '+key+'.'))),data=await f.data(f.a);
 const records=materials.map(material=>data.materialEvidence(material.id)[0]),pins=records.map(record=>({id:record.id,hash:memoryEvidenceFingerprint(record)}));
 const input=scopedMemoryTaskSchema.parse({jobId:randomUUID(),phase:'extract',inputs:pins.slice(0,2),readInputs:pins.slice(2),evidenceReadRanges:records.slice(2).map(record=>({id:record.id,offset:0,length:record.ocrText.length})),materialPins:materials.map(material=>({id:material.id,revision:material.revision,required:['material']})),related:[],binding:data.binding(),generation:data.state().generation,deletionSnapshot:data.deletionSnapshot(),automatic:false,profile:'personal',timeZone:'UTC'});
 t.after(()=>assert.equal(f.requests.length,0,'these scoped reads never request a model'));
 return {f,data,input,records,materials};
}

test('one scoped ordered read preserves duplicates and skips individual invalid optional originals',async t=>{
 const {data,input,records,materials}=await fixture(t);
 input.readInputs![0].hash='0'.repeat(64);
 data.privateData.correctMaterialContext(materials[3].id,materials[3].revision,'owner');
 let validations=0;const validate=data.assertInputs.bind(data);data.assertInputs=value=>{validations++;return validate(value);};
 const ids=[records[2].id,records[1].id,records[4].id,records[3].id,records[0].id,records[4].id,records[1].id];
 assert.deepEqual(data.readInputsInOrder(input,ids),[records[1],records[4],records[0],records[4],records[1]],'optional hash and current-Material failures do not hide later required records');
 assert.equal(validations,1,'the real whole-input validator succeeds once for this synchronous sequence');
 validations=0;assert.deepEqual(data.readInputsInOrder(input,[]),[]);assert.equal(validations,0,'an empty sequence adds no validation');
 assert.deepEqual(data.readInputs(input,[records[0].id,records[0].id]),[records[0]],'the existing batch API keeps its deduplication contract');
 assert.deepEqual(data.readInputs(input,[records[0].id]),[records[0]]);assert.equal(validations,2,'public readInputs still validates every independent call');
});

test('a later scoped read rejects an unrequested changed tail and propagates its original failure',async t=>{
 const {data,input,records,materials}=await fixture(t);
 assert.deepEqual(data.readInputsInOrder(input,[records[0].id]),[records[0]]);
 await Promise.resolve();
 data.privateData.correctMaterialContext(materials[1].id,materials[1].revision,'owner');
 let failure:unknown;const validate=data.assertInputs.bind(data);data.assertInputs=value=>{try{return validate(value);}catch(error){failure=error;throw error;}};
 assert.throws(()=>data.readInputsInOrder(input,[records[0].id]),error=>error===failure&&(error as {code?:string}).code==='conflict','a successful earlier call grants no cache lifetime across an await');
});

test('failed optional validation is not reused as success before a required scoped read',async t=>{
 const {data,input,records}=await fixture(t);input.inputs[1].hash='0'.repeat(64);
 const failures:unknown[]=[];let validations=0;const validate=data.assertInputs.bind(data);
 data.assertInputs=value=>{validations++;try{return validate(value);}catch(error){failures.push(error);throw error;}};
 assert.throws(()=>data.readInputsInOrder(input,[records[2].id,records[0].id]),error=>error===failures[1]&&(error as {code?:string}).code==='conflict');
 assert.equal(validations,2,'a failed optional attempt does not mark the full batch valid');
 assert.equal(failures.length,2);assert.notEqual(failures[0],failures[1]);
});

test('ordered reads cannot borrow another account with equal Material business IDs',async t=>{
 const {f,data,input,records,materials}=await fixture(t);
 const otherMaterial=await f.publish(f.b,'B','same-source','first','Generated other account original.');assert.equal(otherMaterial.id,materials[0].id);
 const other=await f.data(f.b);other.materialEvidence(otherMaterial.id);
 assert.deepEqual(data.readInputsInOrder(input,[records[0].id]),[records[0]]);
 assert.throws(()=>other.readInputsInOrder(input,[records[0].id]),'the original account data and fingerprints remain required');
});
