import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {memorySchema} from '../src/memory-schema.js';
import {memoryBodyDigest} from '../src/memory-provider-contract.js';
import {memoryEvidenceFingerprint} from '../src/memory-contract.js';
import {ScopedMemoryData,memoryHash} from '../src/scope/memory-data.js';
import {PrivateCursor} from '../src/scope/private-data-sql.js';
import {MemoryIntegration,freezeIntegrationAdmissions} from '../src/scope/memory-integration.js';
import {evidenceFixture} from './fixtures/evidence-projection.js';

function fixture(t:any,labels=['first','second']){
 const f=evidenceFixture(t),data=new ScopedMemoryData(f.sql,f.data,new PrivateCursor('generated-key','generated-host','generated-a')),context={userId:'generated-a'} as any,submitted:any[]=[],admissions:any[]=[];let spec:any;
 const execution={register:(value:any)=>{spec=value;return async()=>{};},forUser:()=>({submitSync:(value:any)=>{submitted.push(value);return{id:'generated-task-'+submitted.length};}})} as any;
 const integration=new MemoryIntegration(()=>data,execution,async(_context,id,materials,memories,window)=>{admissions.push({id,materials,memories,window});return{id:randomUUID(),tasks:{}};});t.after(()=>integration.close());
 const capture=f.receive('original','2026-10-18T00:00:00Z','GENERATED_ORIGINAL'),material=f.publish('original',[capture],['GENERATED_ORIGINAL']),evidence=data.materialEvidence(material.id)[0],binding=data.binding(),pins=labels.map(label=>{
  const memory=memorySchema.parse({id:randomUUID(),version:1,fingerprint:memoryHash(label),createdAt:'2026-10-18T00:00:00Z',title:'Generated '+label,statement:'Generated statement',uncertainty:'Fixture only',status:'published',domain:'personal',tier:'episode',kind:'episodic',model:'generated',runId:'generated',evidenceIds:[evidence.id],evidence:[],admission:{layer:'memory',reason:'Generated',scope:'Generated only',attribution:'observed'}});
  f.sql.run('INSERT INTO mm_records VALUES($user,?,?,?,?,?,?,?)',memory.id,memory.version,memory.fingerprint,memoryBodyDigest(memory),JSON.stringify(binding),JSON.stringify(memory),memory.createdAt);f.sql.run('INSERT INTO mm_dependencies VALUES($user,?,?,?)',memory.id,evidence.id,memoryEvidenceFingerprint(evidence));return{id:memory.id,version:memory.version,fingerprint:memory.fingerprint};
 }).sort((a,b)=>a.id.localeCompare(b.id));
 const addWindow=(options:{at?:string;maxItems?:number;minChanges?:number}={})=>{const id=randomUUID(),settings=JSON.parse(data.state().settings);settings.lifecycle.consolidation.minChanges=options.minChanges??3;settings.lifecycle.consolidation.maxItems=options.maxItems??1;const window={generation:data.state().generation,settings,binding};f.sql.run("INSERT INTO mm_integration_windows VALUES($user,?,?,0,?,NULL,'pending',?)",id,JSON.stringify(window),'generated-admitted-'+id,options.at??'2000-01-01T00:00:00Z');return id;};
 const run=(id:string,beforeCommit?:()=>void)=>spec.execute({context,task:{input:{id}},grant:{assert:()=>{},commit:(work:any)=>f.sql.transaction(()=>{beforeCommit?.();return work();})}});
 return {...f,data,pins,admissions,submitted,addWindow,run};
}

test('two cutoff cohorts reserve each exact version once before publication and retain the owning continuation',async t=>{
 const f=fixture(t),first=f.addWindow(),second=f.addWindow();freezeIntegrationAdmissions(f.data);
 for(const id of [first,second])assert.deepEqual(JSON.parse(String(f.sql.get('SELECT json FROM mm_integration_windows WHERE user_id=$user AND id=?',id)!.json)).pending,f.pins,'cutoff preserves both original eligible cohorts without choosing their execution order');
 await f.run(first);assert.equal(f.admissions.length,1);assert.equal(f.submitted.length,1);const continuation=f.submitted[0].input.id;
 await f.run(second);assert.equal(f.admissions.length,1,'a second window cannot admit already reserved versions while the first model has not published');
 await f.run(continuation);assert.equal(f.admissions.length,2,'the exact same-window continuation retains its ancestor-owned remaining reservation');assert.deepEqual(new Set(f.admissions.flatMap(item=>item.memories)),new Set(f.pins.map(pin=>pin.id)));assert.equal(f.admissions.flatMap(item=>item.memories).length,2);
});

test('ordinary cutoff leaves earlier eligible execution free to claim a shared cohort despite another later due window',async t=>{
 const f=fixture(t),later=f.addWindow({at:'2099-01-01T00:00:00Z'}),earlier=f.addWindow({maxItems:2});freezeIntegrationAdmissions(f.data);const before=String(f.sql.get('SELECT json FROM mm_integration_windows WHERE user_id=$user AND id=?',later)!.json);
 assert.equal(f.sql.all('SELECT * FROM mm_integrated_versions WHERE user_id=$user').length,0,'cutoff does not allocate ownership or change policy timing');await f.run(earlier);assert.equal(f.admissions.length,1);assert.deepEqual(new Set(f.admissions[0].memories),new Set(f.pins.map(pin=>pin.id)));assert.equal(f.sql.get('SELECT json FROM mm_integration_windows WHERE user_id=$user AND id=?',later)!.json,before);
});

test('an unrelated frozen selection cannot borrow a legitimate continuation reservation',async t=>{
 const f=fixture(t),owner=f.addWindow();freezeIntegrationAdmissions(f.data);await f.run(owner);const continuation=f.submitted[0].input.id,child=JSON.parse(String(f.sql.get('SELECT json FROM mm_integration_windows WHERE user_id=$user AND id=?',continuation)!.json)),unrelated=f.addWindow();
 f.sql.run('UPDATE mm_integration_windows SET json=? WHERE user_id=$user AND id=?',JSON.stringify({...child,selection:child.pending}),unrelated);await assert.rejects(f.run(unrelated));assert.equal(f.admissions.length,1,'matching pins and policy do not establish continuation ancestry');await f.run(continuation);assert.equal(f.admissions.length,2);
});

for(const damage of ['metadata','missing'] as const)test('a '+damage+' ancestor cannot grant its reserved remainder to a continuation',async t=>{
 const f=fixture(t),owner=f.addWindow();freezeIntegrationAdmissions(f.data);await f.run(owner);const continuation=f.submitted[0].input.id;
 if(damage==='missing')f.sql.run('DELETE FROM mm_integration_windows WHERE user_id=$user AND id=?',owner);else{const parent=JSON.parse(String(f.sql.get('SELECT json FROM mm_integration_windows WHERE user_id=$user AND id=?',owner)!.json));parent.settings.timeZone='Asia/Shanghai';f.sql.run('UPDATE mm_integration_windows SET json=? WHERE user_id=$user AND id=?',JSON.stringify(parent),owner);}
 await f.run(continuation);assert.equal(f.admissions.length,1,'pin equality cannot replace complete trusted ancestry');assert.equal(f.data.assertCurrentRecord(f.data.row(f.pins[1].id)).id,f.pins[1].id,'denied ownership does not delete readable Memory');
});

test('reservation ownership is rechecked inside the admission transaction after candidate selection',async t=>{
 const f=fixture(t),id=f.addWindow({maxItems:2});freezeIntegrationAdmissions(f.data);await assert.rejects(f.run(id,()=>{for(const pin of f.pins)f.sql.run('INSERT INTO mm_integrated_versions VALUES($user,?,?,?,?)',pin.id,pin.version,pin.fingerprint,randomUUID());}));assert.equal(f.admissions.length,0,'a conflicting exact owner never reaches child admission');assert.equal(f.sql.get('SELECT job_id FROM mm_integration_windows WHERE user_id=$user AND id=?',id)!.job_id,null);
});

test('a current-version withdrawal can shrink an intermediate continuation without losing its valid grandchild',async t=>{
 const f=fixture(t,['first','second','third','fourth']),owner=f.addWindow();freezeIntegrationAdmissions(f.data);await f.run(owner);const child=f.submitted[0].input.id,retired=f.pins[1],prior=f.data.assertCurrentRecord(f.data.row(retired.id)),updated=memorySchema.parse({...prior,version:2,fingerprint:memoryHash('generated replacement version')});
 f.sql.run('UPDATE mm_records SET version=?,fingerprint=?,body_digest=?,json=? WHERE user_id=$user AND id=?',updated.version,updated.fingerprint,memoryBodyDigest(updated),JSON.stringify(updated),retired.id);await f.run(child);assert.equal(f.admissions.length,2);const grandchild=f.submitted[1].input.id;await f.run(grandchild);
 assert.equal(f.admissions.length,3,'the original root reservation still authorizes the exact valid grandchild after its parent scope shrinks');assert.deepEqual(f.admissions.flatMap(item=>item.memories),[f.pins[0].id,f.pins[2].id,f.pins[3].id]);assert.ok(!f.admissions.some(item=>item.memories.includes(retired.id)),'neither the retired pin nor a replacement version widens the frozen cohort');
});

for(const damage of ['reordered','widened','duplicated'] as const)test('a '+damage+' continuation pending scope cannot claim its ancestor reservation',async t=>{
 const f=fixture(t,['first','second','third','fourth']),owner=f.addWindow();freezeIntegrationAdmissions(f.data);await f.run(owner);const child=f.submitted[0].input.id,row=f.sql.get('SELECT json FROM mm_integration_windows WHERE user_id=$user AND id=?',child)!,window=JSON.parse(String(row.json));
 window.pending=damage==='reordered'?[...window.pending].reverse():damage==='widened'?[...window.pending,f.pins[0]]:[...window.pending,window.pending[0]];f.sql.run('UPDATE mm_integration_windows SET json=? WHERE user_id=$user AND id=?',JSON.stringify(window),child);await f.run(child);assert.equal(f.admissions.length,1,'an exact deterministic id does not authorize a changed continuation scope');
});
