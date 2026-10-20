import test from 'node:test';
import assert from 'node:assert/strict';
import {setTimeout as delay} from 'node:timers/promises';
import {scopedMemoryFixture} from './fixtures/scoped-memory-host.js';
import {defaultMemorySettings,type ScopedMemoryTask} from '../src/scope/memory-schema.js';
import {snapshotMemoryCatalog,assertMemoryCatalog,frozenMemoryCatalogMembers} from '../src/scope/memory-catalog.js';
import {randomUUID} from 'node:crypto';
import {memoryEvaluationContext} from '../src/scope/memory-evaluation-context.js';
import type {QueryInput} from '@mote/agent';

// Generated inputs through the production app and Memory Job API. The query
// wrapper only creates a deterministic lifecycle race at context.assembled;
// actual model transport, authorization and task settlement remain production.
const mutations=['unchanged','source-description','source-owner','material-owner','deleted-context','disabled-source','capture-privacy','unread-body'] as const;
for(const mutation of mutations)test('MEM-M02: scoped catalog metadata fences '+mutation+' between assembly and model transport',async t=>{
 const f=await scopedMemoryFixture(t),settings=defaultMemorySettings();settings.automatic=false;settings.integration=false;settings.lifecycle.batchCharacters=256;await f.replace(f.a.token,'memory',settings);
 const targetText='GENERATED_CATALOG_TARGET: a retained target original.',contextText='GENERATED_CATALOG_UNREAD: a separately authorized unread body.';
 const target=await f.publish(f.a,'A','target-source','same-external',targetText.padEnd(256,'.')),context=await f.publish(f.a,'A','context-source','same-external',contextText.padEnd(256,'.')),data=await f.data(f.a),targetId=data.materialEvidence(target.id)[0].id;
 // A terminal fake provider response counts sends without output repair,
 // independent review, additional tools or a real external model.
 if(mutation==='unread-body')f.answers.set('A',(_raw,keys)=>({memories:[],coverage:keys.map(key=>({key,state:'no_candidates',candidateIndexes:[]}))}));
 else f.responses.set('A',res=>{res.statusCode=422;res.end('Generated terminal provider refusal');});
 const host=f.node.memory as any,query=host.query.bind(host);let assembled=false;
 host.query=(run:any,input:ScopedMemoryTask,args:QueryInput)=>query(run,input,{...args,onTrace:(event:any)=>{
  if(event.type==='context.assembled'&&run.task.kind==='memory.batch'&&input.inputs.some(pin=>pin.id===targetId)&&!assembled){
   assembled=true;
   if(mutation==='source-description')data.privateData.updateSourceContext('context-source',{expectedVersion:0,description:'Generated changed owner description.'});
   if(mutation==='source-owner')data.privateData.updateSource('context-source',{ownerRelation:'third_party'});
   if(mutation==='material-owner')data.privateData.correctMaterialContext(context.id,context.revision,'third_party');
   if(mutation==='deleted-context')data.privateData.deleteSource('context-source');
   if(mutation==='disabled-source')data.privateData.updateSource('context-source',{enabled:false});
   if(mutation==='capture-privacy')data.sql.run("UPDATE pd_captures SET json=json_set(json,'$.privacy.excluded',1) WHERE user_id=$user AND source_id=?",'context-source');
   if(mutation==='unread-body'){
    const draft=f.read(db=>JSON.parse(String(db.prepare('SELECT json FROM pd_material_versions WHERE user_id=? AND material_id=? AND revision=?').get(f.a.userId,context.id,context.revision)!.json)));
    draft.blocks[0].text='GENERATED_REPLACED_UNREAD_BODY';data.privateData.publishMaterial(draft,context.revision);
   }
  }
  args.onTrace?.(event);
 }});
 const submitted=await f.submit(f.a,[target.id,context.id]),extract=f.read(db=>db.prepare("SELECT id FROM execution_steps WHERE user_id=? AND kind='memory.batch' AND json_extract(input,'$.jobId')=? AND EXISTS(SELECT 1 FROM json_each(input,'$.inputs') p WHERE json_extract(p.value,'$.id')=?)").get(f.a.userId,submitted.id,targetId));
 assert.ok(extract);const state=await f.terminal(String(extract.id));
 if(mutation==='unread-body'){
  assert.equal(state,'succeeded');
  const publish=f.read(db=>db.prepare("SELECT id FROM execution_steps WHERE user_id=? AND kind='memory.batch' AND json_extract(input,'$.jobId')=? AND EXISTS(SELECT 1 FROM json_each(input,'$.inputs') p WHERE json_extract(p.value,'$.id')=?)").get(f.a.userId,submitted.id,targetId));assert.ok(publish);
  assert.equal(await f.terminal(String(publish.id)),'succeeded','the independently reviewed target saves even though an unread sibling body changed');
  assert.equal(f.read(db=>db.prepare("SELECT state FROM mm_job_batches WHERE user_id=? AND job_id=? AND EXISTS(SELECT 1 FROM json_each(input,'$.inputs') p WHERE json_extract(p.value,'$.id')=?)").get(f.a.userId,submitted.id,targetId)!.state),'committed');
 }else assert.ok(['failed','blocked','stale'].includes(state));
 assert.equal(assembled,true,'the mutation occurs after the exact target and catalog were assembled');
 const sends=f.requests.filter(request=>{
  const content=request.body.messages[0].content,value=JSON.parse(typeof content==='string'?content:content[0].text);
  assert.ok(!request.raw.includes('catalogReceipt')&&!request.raw.includes('memory-catalog-receipt'),'host metadata receipts stay off the provider wire');
  return value.untrustedEvidence?.some((record:any)=>record.id===targetId);
 });
 assert.equal(sends.length,mutation==='unread-body'?2:mutation==='unchanged'?1:0,'only changed disclosed metadata or permission fences the independent target; an unread body revision still permits extraction and independent review');
 assert.equal((await f.request(f.a.token,'/api/memories')).json().items.length,0);
 if(mutation==='unread-body')assert.ok(sends.every(request=>!request.raw.includes(contextText)&&!request.raw.includes('GENERATED_REPLACED_UNREAD_BODY')),'neither old nor new unread body becomes a disclosure');
});

test('MEM-M02: frozen catalog metadata remains owner-bound across unread body revision without loading body readers or gaining quote authority',async t=>{
 const f=await scopedMemoryFixture(t),material=await f.publish(f.a,'A');f.answers.set('A',(_raw,keys)=>({memories:[],coverage:keys.map(key=>({key,state:'no_candidates',candidateIndexes:[]}))}));
 const submitted=await f.submit(f.a,[material.id]);await f.wait(f.a,submitted.id);
 const input=f.read(db=>JSON.parse(String(db.prepare('SELECT input FROM mm_job_batches WHERE user_id=? AND job_id=?').get(f.a.userId,submitted.id)!.input))) as ScopedMemoryTask,data=await f.data(f.a),other=await f.data(f.b),members=frozenMemoryCatalogMembers(data,input),task={turns:[],memoryWork:{members,contextMembers:[],authorizedMembers:members,history:[]}};
 assert.equal(members[0].evaluationTime,input.evaluationContext.inputs.find(pin=>pin.id===members[0].id)!.time);assert.notEqual(members[0].evaluationTime,members[0].contextTime,'source date and host semantic evaluation date are separate');
 assert.throws(()=>snapshotMemoryCatalog(data,{turns:[],memoryWork:{members:[{...members[0],contextTime:members[0].evaluationTime}]}}),'evaluation time cannot replace the source-bound catalog fence');
 assert.throws(()=>data.assertInputs({...input,evaluationContext:{...input.evaluationContext,inputs:[...input.evaluationContext.inputs,{id:randomUUID(),time:input.evaluationContext.time}]}}),'clock map may not authorize an extra original');assert.throws(()=>data.assertInputs({...input,evaluationContext:{...input.evaluationContext,inputs:[]}}),'every frozen pin needs its own clock');assert.throws(()=>memoryEvaluationContext(input.evaluationContext.time,[{id:members[0].id,time:input.evaluationContext.time},{id:members[0].id,time:'2038-01-01T00:00:00.000Z'}]),'same canonical ID with conflicting semantic clocks cannot be silently overwritten');
 const forged=structuredClone(input);forged.evaluationContext.inputs[0].time='2038-01-01T00:00:00.000Z';const snapshots=f.read(db=>Number(db.prepare('SELECT count(*) n FROM user_model_snapshots WHERE user_id=?').get(f.a.userId)!.n)),rejected=await f.request(f.a.token,'/api/tasks','POST',{kind:'memory.batch',operationId:randomUUID(),input:forged});assert.notEqual(rejected.statusCode,200,'a client cannot replace a retained task clock or acquire a lease under that forged snapshot');assert.equal(f.read(db=>Number(db.prepare('SELECT count(*) n FROM user_model_snapshots WHERE user_id=?').get(f.a.userId)!.n)),snapshots);
 const receipt=snapshotMemoryCatalog(data,task);assert.ok(receipt);assert.ok(!JSON.stringify(receipt).includes('Nora')&&!JSON.stringify(receipt).includes('prefers generated tea'));
 assert.throws(()=>assertMemoryCatalog(other,receipt),'an equal-ID receipt cannot cross owner authority');
 const draft=f.read(db=>JSON.parse(String(db.prepare('SELECT json FROM pd_material_versions WHERE user_id=? AND material_id=? AND revision=?').get(f.a.userId,material.id,material.revision)!.json)));
 draft.blocks[0].text='GENERATED_UNREAD_REVISION_ONLY';data.privateData.publishMaterial(draft,material.revision);
 assert.throws(()=>data.readInputs(input,input.inputs.map(pin=>pin.id)),'the old body grant remains retired after a body revision');
 data.evidence=()=>assert.fail('a catalog guard must not load original bodies');
 data.readInputs=()=>assert.fail('a catalog guard must not acquire body-read receipts');
 data.privateData.material=()=>assert.fail('a catalog guard must not load Material body rows');
 assert.deepEqual(frozenMemoryCatalogMembers(data,input),members,'metadata vectors remain the frozen ones that the prompt disclosed');
 assertMemoryCatalog(data,receipt);
 assert.deepEqual(snapshotMemoryCatalog(data,task),receipt);
 const calls=f.requests.length;await delay(50);assert.equal(f.requests.length,calls,'metadata validation creates no execution or replay');
});
