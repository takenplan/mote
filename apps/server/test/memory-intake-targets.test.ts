import test from 'node:test';
import assert from 'node:assert/strict';
import {frozenMemoryCatalogMembers,snapshotMemoryCatalog} from '../src/scope/memory-catalog.js';
import {memoryEvidenceFingerprint} from '../src/memory-contract.js';
import {memoryEvaluationContext} from '../src/scope/memory-evaluation-context.js';
import {randomUUID} from 'node:crypto';
import {memorySchema} from '../src/memory-schema.js';
import {memoryBodyDigest} from '../src/memory-provider-contract.js';
import {freezeIntegrationAdmissions} from '../src/scope/memory-integration.js';
import {closeCaptureAdmissions} from '../src/scope/memory-admission-cutoff.js';
import {MemoryIntake,revokeCaptureIntakes} from '../src/scope/memory-intake.js';
import {ScopedMemoryData,memoryHash} from '../src/scope/memory-data.js';
import {PrivateCursor} from '../src/scope/private-data-sql.js';
import {MemoryStrategies} from '../src/memory-strategies.js';
import {evidenceFixture} from './fixtures/evidence-projection.js';

function fixture(t:any){
 const f=evidenceFixture(t),data=new ScopedMemoryData(f.sql,f.data,new PrivateCursor('generated-key','generated-host','generated-a')),context={userId:'generated-a'} as any,submitted:any[]=[],admissions:any[]=[];let spec:any,accepted:any;
 const execution={register:(value:any)=>{spec=value;return()=>{};},forUser:()=>({submitSync:(value:any)=>{submitted.push(value);return{id:'generated-task-'+submitted.length};},observe:()=>({state:'waiting'})})} as any;
 const intake=new MemoryIntake(()=>data,execution,new MemoryStrategies(),async(_context,id,materials,receipt)=>{admissions.push({id,materials,receipt});return {admitted:true};},()=>new Date().toISOString());t.after(()=>intake.close());
 intake.bindIngress({onAccepted:(callback:any)=>{accepted=callback;return()=>{};}} as any);
 const capture=(externalId:string,at:string,text:string)=>{const id=f.receive(externalId,at,text);accepted(context,{sourceId:'generated-source',captures:[{id,duplicate:false}]});return id;};
 const run=(input:any={})=>({context,task:{input},grant:{assert:()=>{},commit:(work:any)=>f.sql.transaction(work)}} as any);
 return {...f,data,context,submitted,admissions,intake,execution,capture,run,get spec(){return spec;}};
}

test('new ready capture advances after revoked history/policy edits without count or time debounce',async t=>{
 const f=fixture(t),old=f.capture('old','2026-10-16T00:00:00Z','GENERATED_OLD'),state=f.data.state();f.sql.run('UPDATE mm_capture_intakes SET revoked=1 WHERE user_id=$user AND capture_id=?',old);
 const settings=JSON.parse(state.settings);settings.timeZone='Asia/Shanghai';f.sql.run('UPDATE mm_state SET settings=? WHERE user_id=$user',JSON.stringify(settings));
 const fresh=f.capture('new','2026-10-18T00:00:00Z','GENERATED_NEW'),material=f.publish('aggregate',[old,fresh],['GENERATED_OLD','GENERATED_NEW']);f.intake.accept(f.run(),material,{captureId:fresh});
 assert.equal(f.submitted.length,1);const row=f.sql.get('SELECT * FROM mm_intakes WHERE user_id=$user')!,receipt=JSON.parse(String(row.json));assert.equal(receipt.targetIds.length,1);assert.equal(f.data.evidence(receipt.targetIds)[0].ocrText,'GENERATED_NEW');assert.equal(receipt.targetCaptureId,fresh);assert.equal(f.sql.get('SELECT revoked FROM mm_capture_intakes WHERE user_id=$user AND capture_id=?',old)!.revoked,1);
 await f.spec.execute(f.run(f.submitted[0].input));assert.equal(f.admissions.length,1,'one fresh ready intake runs despite default minChanges25/interval6h');assert.deepEqual(f.admissions[0].materials[0].targetIds,receipt.targetIds);assert.equal(f.sql.get('SELECT state FROM mm_intakes WHERE user_id=$user')!.state,'complete');
 f.intake.accept(f.run(),material,{captureId:fresh});assert.equal(f.submitted.length,1,'publication replay does not acquire new work');
});

test('mixed new/history block has explicit limitation and cannot authorize its full text as a target',t=>{
 const f=fixture(t),old=f.capture('old','2026-10-16T00:00:00Z','GENERATED_OLD'),fresh=f.capture('new','2026-10-18T00:00:00Z','GENERATED_NEW'),first=f.publish('mixed',[old,fresh],['GENERATED_OLD','GENERATED_NEW']),draft=JSON.parse(String(f.sql.get('SELECT json FROM pd_material_versions WHERE user_id=$user AND material_id=? AND revision=?',first.id,first.revision)!.json));
 draft.blocks=[{id:'mixed',kind:'text',format:'plain',text:'GENERATED_OLD GENERATED_NEW',memberIds:['0','1']}];const material=f.data.privateData.publishMaterial(draft);f.intake.accept(f.run(),material,{captureId:fresh});
 assert.equal(f.submitted.length,0);const row=f.sql.get('SELECT * FROM mm_intakes WHERE user_id=$user')!,receipt=JSON.parse(String(row.json));assert.equal(row.state,'skipped');assert.equal(receipt.limitation,'target_lineage_unresolved');assert.deepEqual(receipt.targetIds,[]);
});

test('withdrawal after admission cannot mark a fresh intake complete',async t=>{
 const f=fixture(t),id=f.capture('new','2026-10-18T00:00:00Z','GENERATED_NEW'),material=f.publish('new',[id],['GENERATED_NEW']);f.intake.accept(f.run(),material,{captureId:id});assert.equal(f.submitted.length,1);
 f.sql.run('UPDATE mm_capture_intakes SET revoked=1 WHERE user_id=$user AND capture_id=?',id);await assert.rejects(f.spec.execute(f.run(f.submitted[0].input)));assert.equal(f.admissions.length,0);assert.equal(f.sql.get('SELECT state FROM mm_intakes WHERE user_id=$user')!.state,'pending');
});


test('historical context catalog keeps its exact read pin without promoting it into target inputs',t=>{
 const f=fixture(t),old=f.capture('old','2026-10-16T00:00:00Z','GENERATED_OLD'),fresh=f.capture('new','2026-10-18T00:00:00Z','GENERATED_NEW'),material=f.publish('aggregate',[old,fresh],['GENERATED_OLD','GENERATED_NEW']),records=f.data.materialEvidence(material.id),input={inputs:[{id:records[1].id,hash:memoryEvidenceFingerprint(records[1])}],readInputs:records.map(record=>({id:record.id,hash:memoryEvidenceFingerprint(record)})),ranges:[{id:records[0].id,offset:0,length:records[0].ocrText.length}],evaluationContext:memoryEvaluationContext('2026-10-23T00:00:00Z',records.map(record=>({id:record.id})))} as any;
 const members=frozenMemoryCatalogMembers(f.data,input);assert.equal(members[0].id,records[0].id);assert.ok(!input.inputs.some((pin:any)=>pin.id===members[0].id));assert.ok(snapshotMemoryCatalog(f.data,{memoryWork:{contextMembers:members}} as any));assert.throws(()=>frozenMemoryCatalogMembers(f.data,{...input,readInputs:input.readInputs.map((pin:any)=>({...pin,hash:'0'.repeat(64)}))}));
});

test('source disable after intake admission fences actual evidence and intake execution without revoking historical receipts',async t=>{
 const f=fixture(t),id=f.capture('new','2026-10-18T00:00:00Z','GENERATED_NEW'),material=f.publish('new',[id],['GENERATED_NEW']);f.intake.accept(f.run(),material,{captureId:id});const record=f.data.materialEvidence(material.id)[0];f.data.privateData.updateSource('generated-source',{enabled:false});assert.equal(f.sql.get('SELECT revoked FROM mm_capture_intakes WHERE user_id=$user AND capture_id=?',id)!.revoked,0);assert.throws(()=>f.data.evidence([record.id]));await assert.rejects(f.spec.execute(f.run(f.submitted[0].input)));assert.equal(f.admissions.length,0);
});


test('domain restart uses persisted exact targets and rejects missing or broadened current receipt fields',async t=>{
 const f=fixture(t),old=f.capture('old','2026-10-16T00:00:00Z','GENERATED_OLD'),fresh=f.capture('new','2026-10-18T00:00:00Z','GENERATED_NEW'),material=f.publish('persisted',[old,fresh],['GENERATED_OLD','GENERATED_NEW']);f.sql.run('UPDATE mm_capture_intakes SET revoked=1 WHERE user_id=$user AND capture_id=?',old);f.intake.accept(f.run(),material,{captureId:fresh});const row=f.sql.get('SELECT id,json FROM mm_intakes WHERE user_id=$user')!,saved=String(row.json),receipt=JSON.parse(saved),input=f.submitted[0].input;
 await f.intake.close();const recovered:any[]=[],restarted=new MemoryIntake(()=>f.data,f.execution,new MemoryStrategies(),async(_context,id,materials)=>{recovered.push({id,materials});},()=>new Date().toISOString());t.after(()=>restarted.close());
 for(const field of ['targetCaptureId','targetIds']){const invalid={...receipt};delete invalid[field];f.sql.run('UPDATE mm_intakes SET json=? WHERE user_id=$user AND id=?',JSON.stringify(invalid),row.id);await assert.rejects(f.spec.execute(f.run(input)));assert.equal(recovered.length,0);}
 const all=f.data.materialEvidence(material.id);f.sql.run('UPDATE mm_intakes SET json=? WHERE user_id=$user AND id=?',JSON.stringify({...receipt,targetIds:all.map(record=>record.id)}),row.id);await assert.rejects(f.spec.execute(f.run(input)));assert.equal(recovered.length,0,'persisted history cannot be promoted into targets');
 f.sql.run('UPDATE mm_intakes SET json=? WHERE user_id=$user AND id=?',saved,row.id);await f.spec.execute(f.run(input));assert.equal(recovered.length,1);assert.deepEqual(recovered[0].materials[0].targetIds,receipt.targetIds);assert.deepEqual(f.data.evidence(receipt.targetIds).map(record=>record.ocrText),['GENERATED_NEW']);assert.equal(f.sql.get('SELECT revoked FROM mm_capture_intakes WHERE user_id=$user AND capture_id=?',old)!.revoked,1);
});


for(const change of ['disable','pause'] as const)test('ordinary '+change+' closes future producers while admitted exact intake drains and resume never reopens history',async t=>{
 const f=fixture(t),id=f.capture('admitted','2026-10-18T00:00:00Z','GENERATED_ADMITTED'),late=f.capture('pre-admission','2026-10-18T00:00:00Z','GENERATED_LATE'),material=f.publish('admitted',[id],['GENERATED_ADMITTED']);f.intake.accept(f.run(),material,{captureId:id});const task=f.submitted[0],settings=JSON.parse(f.data.state().settings);
 if(change==='disable'){settings.automatic=false;f.sql.run('UPDATE mm_state SET settings=? WHERE user_id=$user',JSON.stringify(settings));revokeCaptureIntakes(f.sql,settings);}else f.data.control('pause',{expectedRevision:f.data.state().revision,operationId:randomUUID()});
 for(const capture of [id,late]){const producer=f.sql.get('SELECT json,revoked FROM mm_capture_intakes WHERE user_id=$user AND capture_id=?',capture)!;assert.equal(producer.revoked,0);assert.equal(JSON.parse(String(producer.json)).admissionClosed,true);}
 const disabled=f.capture('disabled','2026-10-18T00:00:00Z','GENERATED_DISABLED'),later=f.publish('later',[late],['GENERATED_LATE']);f.intake.accept(f.run(),later,{captureId:late});assert.equal(f.submitted.length,1);await f.spec.execute(f.run(task.input));assert.equal(f.admissions.length,1);assert.equal(f.sql.get('SELECT state,revoked FROM mm_intakes WHERE user_id=$user')!.revoked,0);
 if(change==='disable'){settings.automatic=true;f.sql.run('UPDATE mm_state SET settings=? WHERE user_id=$user',JSON.stringify(settings));revokeCaptureIntakes(f.sql,settings);}else f.data.control('resume',{expectedRevision:f.data.state().revision,operationId:randomUUID()});
 f.intake.accept(f.run(),later,{captureId:late});f.intake.accept(f.run(),f.publish('disabled',[disabled],['GENERATED_DISABLED']),{captureId:disabled});assert.equal(f.submitted.length,1,'resume cannot reopen pre-cutoff or disabled producer snapshots');assert.equal(f.sql.get('SELECT revoked FROM mm_capture_intakes WHERE user_id=$user AND capture_id=?',disabled)!.revoked,1);
 const fresh=f.capture('fresh','2026-10-19T00:00:00Z','GENERATED_FRESH');f.intake.accept(f.run(),f.publish('fresh',[fresh],['GENERATED_FRESH']),{captureId:fresh});assert.equal(f.submitted.length,2,'a genuinely fresh enabled producer can admit');
});

for(const change of ['stop','recipe'] as const)test('the admission cutoff preserves existing '+change+' revocation',async t=>{
 const f=fixture(t),id=f.capture('admitted','2026-10-18T00:00:00Z','GENERATED_ADMITTED'),material=f.publish('admitted',[id],['GENERATED_ADMITTED']);f.intake.accept(f.run(),material,{captureId:id});if(change==='stop')f.data.control('stop',{expectedRevision:f.data.state().revision,operationId:randomUUID()});else{const settings=JSON.parse(f.data.state().settings);settings.recipes=[{id:'mote.personal-memory',version:'2'}];revokeCaptureIntakes(f.sql,settings);}await assert.rejects(f.spec.execute(f.run(f.submitted[0].input)));assert.equal(f.admissions.length,0);
});

test('integration cutoff freezes only admitted unselected eligible pins and rolls back producer/window JSON together',t=>{
 const f=fixture(t),capture=f.capture('original','2026-10-18T00:00:00Z','GENERATED_ORIGINAL'),material=f.publish('original',[capture],['GENERATED_ORIGINAL']),evidence=f.data.materialEvidence(material.id)[0],at='2026-10-23T00:00:00Z',settings=JSON.parse(f.data.state().settings),binding=f.data.binding(),seed=(label:string)=>{const memory=memorySchema.parse({id:randomUUID(),version:1,fingerprint:memoryHash(label),createdAt:at,title:'Generated '+label,statement:'Generated statement',uncertainty:'Fixture only',status:'published',domain:'personal',tier:'episode',kind:'episodic',model:'generated',runId:'generated',evidenceIds:[evidence.id],evidence:[],admission:{layer:'memory',reason:'Generated',scope:'Generated only',attribution:'observed'}});f.sql.run('INSERT INTO mm_records VALUES($user,?,?,?,?,?,?,?)',memory.id,memory.version,memory.fingerprint,memoryBodyDigest(memory),JSON.stringify(binding),JSON.stringify(memory),at);f.sql.run('INSERT INTO mm_dependencies VALUES($user,?,?,?)',memory.id,evidence.id,memoryEvidenceFingerprint(evidence));return {id:memory.id,version:memory.version,fingerprint:memory.fingerprint};},first=seed('first'),base={generation:f.data.state().generation,settings,binding},window=randomUUID(),unadmitted=randomUUID();f.sql.run("INSERT INTO mm_integration_windows VALUES($user,?,?,0,?,NULL,'pending',?)",window,JSON.stringify(base),'generated-admitted-task',at);f.sql.run("INSERT INTO mm_integration_windows VALUES($user,?,?,0,NULL,NULL,'pending',?)",unadmitted,JSON.stringify(base),at);const before=String(f.sql.get('SELECT json FROM mm_integration_windows WHERE user_id=$user AND id=?',window)!.json),producer=String(f.sql.get('SELECT json FROM mm_capture_intakes WHERE user_id=$user AND capture_id=?',capture)!.json);
 assert.throws(()=>f.sql.transaction(()=>{closeCaptureAdmissions(f.sql);freezeIntegrationAdmissions(f.data);throw Error('Generated later publication failure');}));assert.equal(f.sql.get('SELECT json FROM mm_integration_windows WHERE user_id=$user AND id=?',window)!.json,before);assert.equal(f.sql.get('SELECT json FROM mm_capture_intakes WHERE user_id=$user AND capture_id=?',capture)!.json,producer);
 freezeIntegrationAdmissions(f.data);const frozen=String(f.sql.get('SELECT json FROM mm_integration_windows WHERE user_id=$user AND id=?',window)!.json);assert.deepEqual(JSON.parse(frozen).pending,[first]);assert.equal(f.sql.get('SELECT json FROM mm_integration_windows WHERE user_id=$user AND id=?',unadmitted)!.json,before);seed('later');freezeIntegrationAdmissions(f.data);assert.equal(f.sql.get('SELECT json FROM mm_integration_windows WHERE user_id=$user AND id=?',window)!.json,frozen,'cutoff never widens an existing pending set');assert.equal(f.sql.get('SELECT revoked FROM mm_integration_windows WHERE user_id=$user AND id=?',window)!.revoked,0);
});
