import test,{type TestContext} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {scopedMemoryFixture} from './fixtures/scoped-memory-host.js';
import {scopedMemoryTaskSchema} from '../src/scope/memory-schema.js';
import {memoryEvidenceFingerprint} from '../src/memory.js';
import {memorySchema} from '../src/memory-schema.js';
import type {PreparedMemoryExtraction} from '../src/memory-contract.js';

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

function preparedFixture(records:Awaited<ReturnType<typeof fixture>>['records'],input:Awaited<ReturnType<typeof fixture>>['input'],selections:readonly (readonly string[])[]):PreparedMemoryExtraction{
 const at='2026-01-02T00:00:00Z',items=selections.map((ids,index)=>memorySchema.parse({id:randomUUID(),version:1,domain:'personal',tier:'episode',kind:'episodic',title:'Generated publication '+index,statement:'Generated publication retains its exact evidence.',uncertainty:'Generated fixture only.',admission:{layer:'observation',reason:'Generated evidence validation',scope:'Generated fixture',attribution:'observed'},evidenceIds:[...ids],evidence:ids.map(id=>{const record=records.find(record=>record.id===id)!;return {id,capturedAt:record.capturedAt,receivedAt:record.receivedAt,quote:record.ocrText,contentHash:memoryEvidenceFingerprint(record)};}),createdAt:at,status:'published',model:'generated-no-model',runId:'generated-publication',fingerprint:(index+1).toString(16).padStart(64,'0')}));
 return {at,resultHash:'1'.repeat(64),items,changed:items,expected:Object.fromEntries(items.map(item=>[item.id,null])),deletionSnapshot:input.deletionSnapshot};
}

test('whole-input Material mapping reads grow with evidence inputs and are refreshed for each call',async t=>{
 const {data,input,records,materials}=await fixture(t),get=data.sql.get.bind(data.sql);let mappingReads=0;const versions:unknown[]=[];
 data.sql.get=(sql,...args)=>{if(sql==='SELECT material_id FROM mm_evidence WHERE user_id=$user AND id=?')mappingReads++;if(sql==='SELECT json FROM pd_material_versions WHERE user_id=$user AND material_id=? AND revision=?')versions.push(args[0]);return get(sql,...args);};
 for(const size of [2,records.length]){
  const selected=scopedMemoryTaskSchema.parse({...input,inputs:records.slice(0,size).map(record=>({id:record.id,hash:memoryEvidenceFingerprint(record)}))});
  for(let call=0;call<2;call++){
   mappingReads=0;versions.length=0;assert.deepEqual(data.assertInputs(selected),records.slice(0,size));
   assert.ok(mappingReads<=size,'mapping must not rescan every evidence input for every Material pin');
   assert.deepEqual(versions,materials.slice(0,size).map(material=>material.id),'every selected pin still checks its own current dependency version on every call');
  }
 }
 mappingReads=0;versions.length=0;assert.deepEqual(data.assertInputs({...input,evidenceReadRanges:undefined}),records.slice(0,2));assert.equal(mappingReads,0);assert.deepEqual(versions,materials.map(material=>material.id),'without delivered read ranges, the original complete Material-pin guard remains in force');
 const unknown=scopedMemoryTaskSchema.parse({...input,inputs:[input.inputs[0],{id:randomUUID(),hash:input.inputs[1].hash}]});
 assert.throws(()=>data.assertInputs(unknown),error=>(error as {code?:string}).code==='not_found','an unknown required evidence mapping cannot skip the whole-input evidence guard');
});

test('prepared publication validates the whole input once per call and reads every selected item',async t=>{
 const {data,input,records}=await fixture(t),selections=[[records[0].id,records[1].id],[records[4].id],[records[0].id,records[2].id]],prepared=preparedFixture(records,input,selections),validate=data.assertInputs.bind(data),evidence=data.evidence.bind(data);let validations=0;const reads:string[][]=[];
 data.assertInputs=value=>{validations++;return validate(value);};data.evidence=ids=>{reads.push([...ids]);return evidence(ids);};
 for(let call=0;call<2;call++){
  reads.length=0;data.assertPrepared(prepared,input);assert.equal(validations,call+1,'only this synchronous publication check shares its whole-input validation');
  assert.deepEqual(reads,[input.inputs.map(pin=>pin.id),...selections],'all required and optional selections retain their individual evidence checks, including repeated evidence in different items');
 }
});

test('prepared publication preserves selected optional-evidence failures and original exceptions',async t=>{
 for(const fault of ['hash','revision','dependency','unknown','exception'] as const)await t.test(fault,async t=>{
  const {data,input,records,materials}=await fixture(t),prepared=preparedFixture(records,input,[[records[0].id],[records[4].id]]);
  if(fault==='hash')input.readInputs![2].hash='0'.repeat(64);
  if(fault==='revision')data.privateData.correctMaterialContext(materials[4].id,materials[4].revision,'owner');
  if(fault==='dependency')input.materialPins![4].required=['generated-missing-output'];
  if(fault==='unknown')prepared.items[1].evidenceIds=[randomUUID()];
  const failure=new Error('Generated selected evidence failure');
  if(fault==='exception'){const evidence=data.evidence.bind(data);data.evidence=ids=>{if(ids.includes(records[4].id))throw failure;return evidence(ids);};}
  assert.throws(()=>data.assertPrepared(prepared,input),error=>fault==='exception'?error===failure:(error as {code?:string}).code===(fault==='unknown'?'not_found':'conflict'));
 });
});

test('each prepared recheck and the final transaction reject a changed or deleted unselected required tail',async t=>{
 for(const fault of ['revision','deleted'] as const)await t.test(fault,async t=>{
  const {f,data,input,records,materials}=await fixture(t),prepared=preparedFixture(records,input,[[records[0].id]]),validate=data.assertInputs.bind(data);let validations=0;
  data.assertInputs=value=>{validations++;return validate(value);};data.assertPrepared(prepared,input);assert.equal(validations,1);
  await Promise.resolve();
  if(fault==='revision')data.privateData.correctMaterialContext(materials[1].id,materials[1].revision,'owner');else data.privateData.deleteMaterial(materials[1].id);
  const denied=(error:unknown)=>['conflict','not_found'].includes(String((error as {code?:string}).code));
  assert.throws(()=>data.assertPrepared(prepared,input),denied);assert.equal(validations,2,'a prior synchronous success does not authorize a later call');
  assert.throws(()=>data.commit(prepared,input),denied);assert.equal(validations,3,'the final publication transaction retains its whole-input guard');
  assert.equal(f.read(db=>Number(db.prepare('SELECT count(*) n FROM mm_records WHERE user_id=?').get(f.a.userId)!.n)),0,'no prepared item publishes after a whole-input failure');
 });
});

test('prepared publication cannot reuse another owner with equal Material business IDs',async t=>{
 const {f,data,input,records,materials}=await fixture(t),prepared=preparedFixture(records,input,[[records[0].id]]),other=await f.data(f.b);
 for(const [index,key]of ['first','tail'].entries()){const material=await f.publish(f.b,'B','same-source',key,'Generated other owner evidence.');assert.equal(material.id,materials[index].id);other.materialEvidence(material.id);}
 const otherInput={...input,generation:other.state().generation,binding:other.binding(),deletionSnapshot:other.deletionSnapshot()};
 data.assertPrepared(prepared,input);assert.throws(()=>other.assertPrepared(prepared,otherInput),error=>(error as {code?:string}).code==='not_found','a current other-owner envelope cannot authorize the original owner evidence');
 assert.equal(f.read(db=>Number(db.prepare('SELECT count(*) n FROM mm_records WHERE user_id=?').get(f.b.userId)!.n)),0);
});

test('each Material-mapping SQL read retains live authorization during one synchronous validation',async t=>{
 const {f,data,input}=await fixture(t),administrator=await f.node.authority.authenticate(f.admin.token),get=data.sql.get.bind(data.sql);let mappings=0;
 data.sql.get=(sql,...args)=>{if(sql==='SELECT material_id FROM mm_evidence WHERE user_id=$user AND id=?'&&++mappings===2)f.node.accounts!.disable(administrator,f.node.authority,f.a.userId,true);return get(sql,...args);};
 assert.throws(()=>data.assertInputs(input),error=>(error as {code?:string}).code==='invalid_identity');assert.equal(mappings,2,'withdrawal before the next mapping read is checked before returning its data');
 assert.throws(()=>data.assertInputs(input),error=>(error as {code?:string}).code==='invalid_identity','no prior successful prefix grants authority to a later invocation');
});
