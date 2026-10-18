import test from 'node:test';
import assert from 'node:assert/strict';
import type {ServerResponse} from 'node:http';
import {randomUUID,createHash} from 'node:crypto';
import {setTimeout as delay} from 'node:timers/promises';
import {scopedMemoryFixture} from './fixtures/scoped-memory-host.js';
import {defaultMemorySettings} from '../src/scope/memory-schema.js';
import {memoryCandidateOutputContract} from '../src/memory-strategy-contract.js';
import {writeMessagesResponse} from '../../../scripts/fixtures/messages-provider.js';
import {EXECUTION_POLICIES} from '../src/execution-policy.js';

// These fixtures use the production composition, account APIs, durable executor,
// provider HTTP transport and Agent tool loop. Every source and credential is
// generated. Scripted replies prove the host journey, not model interpretation.
type Fixture=Awaited<ReturnType<typeof scopedMemoryFixture>>;
type Member={key:string;id:string;offset:number;length:number};
type Envelope={request:string;untrustedTaskContext:{memoryWork:{members:Member[]};untrustedMemoryDraft?:unknown};untrustedEvidence:{id:string;ocrText:string}[];authorizedContextRanges?:unknown};
const deferred=()=>{let resolve!:()=>void;const promise=new Promise<void>(done=>resolve=done);return {promise,resolve};};
const envelope=(body:any):Envelope=>JSON.parse(typeof body.messages[0].content==='string'?body.messages[0].content:body.messages[0].content[0].text);
const phase=(value:Envelope)=>value.untrustedTaskContext.untrustedMemoryDraft?'review':'extract';
const toolUses=(body:any)=>body.messages.flatMap((message:any)=>Array.isArray(message.content)?message.content.filter((part:any)=>part.type==='tool_use'):[]);
const coverage=(members:Member[],memories:unknown[]=[])=>members.map((member,index)=>({key:member.key,state:index===0&&memories.length?'checked':'no_candidates',candidateIndexes:index===0?memories.map((_memory,index)=>index):[]}));
const claim=(id:string,quote:string,title='Generated parity Memory')=>({domain:'personal',title,statement:'The generated narrator reported this supported event. ['+id+']',uncertainty:'Synthetic source only.',admission:{layer:'memory',reason:'Explicit generated future-use claim',scope:'The generated source only',attribution:'third_party'},evidenceIds:[id],evidence:[{id,quote}]});
const reply=(res:ServerResponse,answer:unknown,stage:number,citationIds:string[]=[])=>writeMessagesResponse(res,{stage,text:JSON.stringify({answer:JSON.stringify(answer),citationIds})});
async function until<T>(read:()=>Promise<T>|T,done:(value:T)=>boolean,label:string,timeout=15000){
 const deadline=Date.now()+timeout;let value:T;
 do{value=await read();if(done(value))return value;await delay(10);}while(Date.now()<deadline);
 assert.fail(label+': '+JSON.stringify(value!));
}
const job=(f:Fixture,user:any,id:string)=>f.request(user.token,'/api/memory/jobs/'+id).then(response=>{assert.equal(response.statusCode,200,response.body);return response.json();});
const tasks=(value:any)=>Object.values(value.tasks) as any[];
const failureTask=(value:any)=>tasks(value).find(task=>['blocked','failed','stale','cancelled'].includes(task.state));
async function batchSettings(f:Fixture,characters=256){
 const settings=defaultMemorySettings();settings.automatic=false;settings.integration=false;settings.lifecycle.batchCharacters=characters;
 await f.replace(f.a.token,'memory',settings);await f.replace(f.b.token,'memory',settings);
}
function script(f:Fixture,owner:string,handler:(res:ServerResponse,body:any,value:Envelope,raw:string)=>void|Promise<void>){
 const errors:unknown[]=[];
 f.responses.set(owner,(res,raw)=>{void Promise.resolve().then(()=>handler(res,JSON.parse(raw),envelope(JSON.parse(raw)),raw)).catch(error=>{errors.push(error);if(!res.headersSent){res.statusCode=422;res.end('Generated script assertion failed');}else res.destroy();});});
 return ()=>{assert.deepEqual(errors.map(error=>error instanceof Error?error.message:String(error)),[]);};
}

test('MEM-M01: production extraction and independent review receive the complete current output contract and example',async t=>{
 const f=await scopedMemoryFixture(t),material=await f.publish(f.a,'A');
 const submitted=await f.submit(f.a,[material.id]);await f.wait(f.a,submitted.id);
 assert.equal(f.requests.length,2,'extraction and independent review both execute');
 for(const request of f.requests){
  const value=envelope(request.body);
  assert.ok(value.request.includes(memoryCandidateOutputContract('range-evaluation@1')),'the exact shared host contract includes its JSON example and all candidate fields');
  assert.ok(value.request.includes('outer citationIds'));
  assert.ok(value.request.includes('coding:{kind:pitfall|decision|principle|preference'));
  assert.ok(value.request.includes('no candidate-count quota'));
 }
 const saved=(await f.request(f.a.token,'/api/memories')).json().items[0];
 assert.equal(saved.reviewReceipt.decision,'independent');assert.notEqual(saved.reviewReceipt.draftRunId,saved.reviewReceipt.reviewRunId);
});

test('MEM-M03: a legal empty result is independently reviewed and completes its exact range',async t=>{
 const f=await scopedMemoryFixture(t),material=await f.publish(f.a,'A');
 f.answers.set('A',(_raw,keys)=>({memories:[],coverage:keys.map(key=>({key,state:'no_candidates',candidateIndexes:[]}))}));
 const submitted=await f.submit(f.a,[material.id]),done=await f.wait(f.a,submitted.id);
 assert.equal(done.state,'committed');assert.equal(f.requests.length,2,'empty selection still receives independent review');
 assert.equal(done.batches[0].coverage.coverage[0].state,'no_candidates');
 assert.equal((await f.request(f.a.token,'/api/memories')).json().items.length,0);
 const before=f.requests.length;await f.restart();await delay(100);assert.equal(f.requests.length,before,'a completed empty range is not replayed on restart');
});

test('MEM-M03: incomplete partial proposals remain retryable in the original job across restart while committed siblings survive',async t=>{
 const f=await scopedMemoryFixture(t);await batchSettings(f);
 const first='GENERATED_COMPLETE_SIBLING: the narrator keeps the blue bicycle.',last='GENERATED_INCOMPLETE_TARGET: the narrator repaired the red bicycle.';
 const content=first.padEnd(255,'.')+'\n'+last.padEnd(255,'.')+'\n',material=await f.publish(f.a,'A','same-source','same-external',content);
 let incomplete=true;
 const verify=script(f,'A',(res,body,value)=>{
  const members=value.untrustedTaskContext.memoryWork.members,member=members[0],quote=member.offset===0?first:last,memories=[claim(member.id,quote,member.offset===0?'Generated complete sibling':'Generated retry target')];
  const rows=coverage(members,memories);
  if(member.offset!==0&&incomplete)Object.assign(rows[0],{state:'incomplete',reason:'Generated fixture has not assessed the entire final range.'});
  reply(res,{memories,coverage:rows},body.messages.length,[member.id]);
 });
 const submitted=await f.submit(f.a,[material.id]);
 const unfinished=await until(()=>job(f,f.a,submitted.id),value=>Boolean(failureTask(value)),'explicit incomplete must become unfinished execution');verify();
 assert.notEqual(unfinished.state,'committed');assert.equal(failureTask(unfinished).error?.code??failureTask(unfinished).error,'memory_evaluation_incomplete');
 assert.ok(unfinished.batches.some((batch:any)=>batch.coverage?.coverage.some((row:any)=>row.state==='incomplete'&&row.reason)),'unfinished range and reason remain inspectable');
 const saved=await until(async()=>(await f.request(f.a.token,'/api/memories')).json().items,items=>items.length===1,'completed sibling becomes available despite incomplete sibling');
 assert.equal(saved[0].title,'Generated complete sibling','the partial proposal never publishes');
 const successful=f.read(db=>db.prepare("SELECT id,attempts FROM execution_steps WHERE user_id=? AND state='succeeded' ORDER BY id").all(f.a.userId));
 const calls=f.requests.length;await f.restart();await delay(100);assert.equal(f.requests.length,calls,'unfinished work requires explicit retry rather than automatic paid replay');
 assert.equal((await f.request(f.b.token,'/api/memory/jobs/'+submitted.id+'/retry','POST',{})).statusCode,404);
 incomplete=false;const retried=await f.request(f.a.token,'/api/memory/jobs/'+submitted.id+'/retry','POST',{});assert.equal(retried.statusCode,200,retried.body);
 const completed=await f.wait(f.a,submitted.id);verify();assert.equal(completed.id,submitted.id);assert.equal(completed.state,'committed');
 assert.equal((await f.request(f.a.token,'/api/memories')).json().items.length,2);
 for(const task of successful)assert.deepEqual(f.read(db=>db.prepare("SELECT id,attempts FROM execution_steps WHERE id=? AND state='succeeded'").get(task.id)),task,'successful stage checkpoints keep their IDs and attempt counts');
 const later=f.requests.slice(calls).map(request=>envelope(request.body).untrustedTaskContext.memoryWork.members);
 assert.ok(later.length>0);assert.ok(later.every(members=>members.every(member=>member.offset!==0)),'retry never reevaluates the completed sibling range');
});

test('MEM-M03: omitted coverage cannot be settled as a legal empty result',async t=>{
 const f=await scopedMemoryFixture(t),material=await f.publish(f.a,'A');f.answers.set('A',()=>({memories:[],coverage:[]}));
 const submitted=await f.submit(f.a,[material.id]);
 const unfinished=await until(()=>job(f,f.a,submitted.id),value=>Boolean(failureTask(value)),'missing target coverage must fail or block');
 assert.notEqual(unfinished.state,'committed');assert.ok(unfinished.batches.every((batch:any)=>batch.state!=='committed'));
 assert.ok(unfinished.batches.some((batch:any)=>batch.validationFailures?.some((failure:any)=>failure.code==='coverage')),'the safe failure history identifies the missing coverage behind the terminal provider-validation error');
 assert.equal((await f.request(f.a.token,'/api/memories')).json().items.length,0);
 const calls=f.requests.length;await f.restart();await delay(100);assert.equal(f.requests.length,calls);
 f.answers.set('A',(_raw,keys)=>({memories:[],coverage:keys.map(key=>({key,state:'no_candidates',candidateIndexes:[]}))}));
 const retried=await f.request(f.a.token,'/api/memory/jobs/'+submitted.id+'/retry','POST',{});assert.equal(retried.statusCode,200,retried.body);
 assert.equal((await f.wait(f.a,submitted.id)).state,'committed');
});

test('MEM-M02: production extraction and review autonomously read same-job context without granting foreign originals or context targets',async t=>{
 const f=await scopedMemoryFixture(t);await batchSettings(f);
 const header='GENERATED_A_DIARY_HEADER: this is the narrator reviewing the year 2024.',event='GENERATED_A_TARGET_EVENT: I repaired my blue bicycle on April 20.',continuation='GENERATED_A_CONTINUATION: the repair succeeded on the next attempt.';
 const content=header.padEnd(255,'.')+'\n'+event.padEnd(255,'.')+'\n'+continuation.padEnd(255,'.')+'\n';
 const aMaterial=await f.publish(f.a,'A','same-source','same-external',content),bMaterial=await f.publish(f.b,'B','same-source','same-external','GENERATED_B_PRIVATE_CONTEXT: a different narrator and year.');assert.equal(aMaterial.id,bMaterial.id);
 const foreign=(await f.data(f.b)).materialEvidence(bMaterial.id)[0].id,operationId=randomUUID(),reads:{phase:string;id:string}[]=[];
 const verify=script(f,'A',(res,body,value,raw)=>{
  assert.ok(!raw.includes('GENERATED_B_PRIVATE_CONTEXT'));
  const members=value.untrustedTaskContext.memoryWork.members,member=members[0],uses=toolUses(body);
  if(member.offset!==256){reply(res,{memories:[],coverage:coverage(members)},body.messages.length);return;}
  assert.ok(value.authorizedContextRanges,'the frozen same-job read catalog reaches both phases');
  assert.ok(body.tools.some((tool:any)=>tool.name==='context_evidence'));
  if(!uses.some((use:any)=>use.name==='context_evidence'&&use.input.id===foreign))return writeMessagesResponse(res,{stage:body.messages.length,tool:{name:'context_evidence',args:{id:foreign,offset:0,length:30}}});
  if(!uses.some((use:any)=>use.name==='context_evidence'&&use.input.id===member.id&&use.input.offset===0))return writeMessagesResponse(res,{stage:body.messages.length,tool:{name:'context_evidence',args:{id:member.id,offset:0,length:header.length}}});
  if(!uses.some((use:any)=>use.name==='context_evidence'&&use.input.id===member.id&&use.input.offset===512))return writeMessagesResponse(res,{stage:body.messages.length,tool:{name:'context_evidence',args:{id:member.id,offset:512,length:continuation.length}}});
  assert.ok(raw.includes(header)&&raw.includes(continuation),'successful context pages are actually disclosed');
  assert.ok(raw.includes('toolError'),'the foreign original was rejected by the real tool boundary');
  reads.push({phase:phase(value),id:member.id});
  const memory=claim(member.id,event);memory.evidence.push({id:member.id,quote:header},{id:member.id,quote:continuation});
  reply(res,{memories:[memory],coverage:coverage(members,[memory])},body.messages.length,[member.id]);
 });
 f.answers.set('B',(_raw,keys)=>({memories:[],coverage:keys.map(key=>({key,state:'no_candidates',candidateIndexes:[]}))}));
 const aJob=await f.submit(f.a,[aMaterial.id],operationId),bJob=await f.submit(f.b,[bMaterial.id],operationId);assert.equal(aJob.id,bJob.id);
 await Promise.all([f.wait(f.a,aJob.id),f.wait(f.b,bJob.id)]);verify();
 assert.deepEqual(reads.map(read=>read.phase).sort(),['extract','review']);
 const saved=(await f.request(f.a.token,'/api/memories')).json().items;assert.equal(saved.length,1);assert.equal(saved[0].evidence.length,3);
 assert.deepEqual(new Set(saved[0].evidence.map((span:any)=>span.offset)),new Set([0,256,512]));
 assert.equal((await f.request(f.b.token,'/api/memories/'+saved[0].id)).statusCode,404);
 const inspection=(await f.request(f.a.token,'/api/memory/jobs/'+aJob.id+'/review')).json();
 assert.equal(inspection.batches.length,3,'context reads never create targets or extra completion checkpoints');
 assert.ok(!JSON.stringify((await f.request(f.b.token,'/api/memory/jobs/'+bJob.id+'/review')).json()).includes(header),'equal job IDs cannot cross owner draft/candidate boundaries');
 await f.restart();assert.equal((await f.request(f.a.token,'/api/memories')).json().items.length,1);assert.equal((await f.request(f.b.token,'/api/memories')).json().items.length,0);
});

test('MEM-M07: extraction and review repair exact quotes before quote-backed coverage and retain safe locations',async t=>{
 const f=await scopedMemoryFixture(t),quote='GENERATED_QUOTE_SOURCE: Nora said “tea”, preserving Unicode punctuation.',material=await f.publish(f.a,'A','same-source','same-external',quote),counts={extract:0,review:0},repairs:string[]=[];
 const verify=script(f,'A',(res,body,value,raw)=>{
  const current=phase(value),members=value.untrustedTaskContext.memoryWork.members,id=members[0].id,attempt=++counts[current];
  const memory=claim(id,attempt===1?quote.replace('“tea”','"tea"'):quote);
  if(attempt>1){repairs.push(raw);assert.ok(raw.includes('quote_not_found'),'specific quote diagnosis reaches the same provider session');assert.ok(raw.includes('Candidate index: 0.')&&raw.includes('Evidence entry index: 0.'));}
  reply(res,{memories:[memory],coverage:coverage(members,[memory])},body.messages.length,[id]);
 });
 const submitted=await f.submit(f.a,[material.id]),done=await f.wait(f.a,submitted.id);verify();
 assert.deepEqual(counts,{extract:2,review:2});assert.equal(repairs.length,2);
 const failures=done.batches.flatMap((batch:any)=>batch.validationFailures??[]);
 assert.deepEqual(failures.map((failure:any)=>({phase:failure.phase,code:failure.code})),[{phase:'extract',code:'quote_not_found'},{phase:'review',code:'quote_not_found'}]);
 assert.ok(failures.length<=20);
 for(const failure of failures){assert.ok(failure.at&&failure.runId);assert.equal(failure.details.candidateIndex,0);assert.equal(failure.details.spanIndex,0);assert.ok(failure.details.evidenceId);assert.ok(Number.isSafeInteger(failure.attempt));}
 const diagnostics=JSON.stringify(failures);assert.ok(!diagnostics.includes(quote)&&!diagnostics.includes('Nora')&&!diagnostics.includes('GENERATED_A_KEY')&&!diagnostics.includes('stack'));
 const saved=(await f.request(f.a.token,'/api/memories')).json().items;assert.equal(saved.length,1);assert.equal(saved[0].evidence[0].quote,quote);
 await f.restart();assert.deepEqual((await job(f,f.a,submitted.id)).batches.flatMap((batch:any)=>batch.validationFailures??[]),failures,'safe repair history survives restart');
});

test('MEM-M02: cross-original context gains a durable dependency only after delivery and its deletion retracts the dependent Memory',async t=>{
 const f=await scopedMemoryFixture(t);await batchSettings(f);
 const targetText='GENERATED_CONTEXT_TARGET: I repaired the bicycle on April 20.',contextText='GENERATED_USED_CONTEXT: the narrator is reviewing the year 2024.',unusedText='GENERATED_UNUSED_CONTEXT: an unrelated authorized original.';
 const target=await f.publish(f.a,'A','target-source','same-external',targetText.padEnd(256,'.')),context=await f.publish(f.a,'A','context-source','same-external',contextText.padEnd(256,'.')),unused=await f.publish(f.a,'A','unused-source','same-external',unusedText.padEnd(256,'.'));
 const data=await f.data(f.a),targetId=data.materialEvidence(target.id)[0].id,contextId=data.materialEvidence(context.id)[0].id,unusedId=data.materialEvidence(unused.id)[0].id,reads:string[]=[];
 const verify=script(f,'A',(res,body,value,raw)=>{
  const members=value.untrustedTaskContext.memoryWork.members,member=members[0];
  if(member.id!==targetId){reply(res,{memories:[],coverage:coverage(members)},body.messages.length);return;}
  assert.ok(value.authorizedContextRanges,'all same-job originals remain available as a read catalog');
  if(!toolUses(body).some((use:any)=>use.name==='context_evidence'&&use.input.id===contextId))return writeMessagesResponse(res,{stage:body.messages.length,tool:{name:'context_evidence',args:{id:contextId,offset:0,length:contextText.length}}});
  assert.ok(raw.includes(contextText));reads.push(phase(value));
  const memory=claim(targetId,targetText,'Generated cross-original Memory');memory.evidenceIds.push(contextId);memory.statement+=' ['+contextId+']';memory.evidence.push({id:contextId,quote:contextText});
  reply(res,{memories:[memory],coverage:coverage(members,[memory])},body.messages.length,[targetId,contextId]);
 });
 const submitted=await f.submit(f.a,[target.id,context.id,unused.id]);await f.wait(f.a,submitted.id);verify();assert.deepEqual(reads.sort(),['extract','review']);
 const saved=(await f.request(f.a.token,'/api/memories')).json().items;assert.equal(saved.length,1);
 const dependencies=f.read(db=>db.prepare('SELECT evidence_id FROM mm_dependencies WHERE user_id=? AND memory_id=? ORDER BY evidence_id').all(f.a.userId,saved[0].id).map(row=>String(row.evidence_id)));
 assert.deepEqual(new Set(dependencies),new Set([targetId,contextId]));assert.ok(!dependencies.includes(unusedId),'authorization is not a successful read or support receipt');
 assert.equal((await f.request(f.a.token,'/api/sources/unused-source','DELETE')).statusCode,200);
 assert.equal((await f.request(f.a.token,'/api/memories/'+saved[0].id)).statusCode,200,'unread context is not a published Memory dependency');
 assert.equal((await f.request(f.a.token,'/api/sources/context-source','DELETE')).statusCode,200);
 assert.equal((await f.request(f.a.token,'/api/memories/'+saved[0].id)).statusCode,404,'read context deletion retracts dependent output');
 assert.equal(f.read(db=>Number(db.prepare("SELECT count(*) n FROM mm_job_batches WHERE user_id=? AND job_id=? AND (draft LIKE ? OR review LIKE ? OR prepared LIKE ?)").get(f.a.userId,submitted.id,'%'+contextText+'%','%'+contextText+'%','%'+contextText+'%')!.n)),0,'withdrawn context is removed from retained private candidate and review bodies');
 const calls=f.requests.length;await f.restart();await delay(100);assert.equal(f.requests.length,calls,'deletion and restart do not recreate authorization or replay completed model work');assert.equal((await f.request(f.a.token,'/api/memories')).json().items.length,0);
});

test('MEM-M08: a reviewed batch is searchable while later model requests and additional authorized batches remain outstanding',async t=>{
 const f=await scopedMemoryFixture(t);await batchSettings(f);const held=deferred(),entered=deferred();t.after(()=>held.resolve());
 const facts=Array.from({length:8},(_value,index)=>'GENERATED_BACKLOG_'+index+': Nora keeps generated bicycle '+index+'.'),materials=[];
 for(const [index,fact] of facts.entries())materials.push(await f.publish(f.a,'A','same-source','backlog-'+index,fact.padEnd(256,'.')));
 let reviewed=false,gateActive=false;const phases:{phase:string;target:string;taskId:string;fence:string;attempt:number;at:number}[]=[];
 const verify=script(f,'A',async(res,body,value)=>{
  const current=phase(value),members=value.untrustedTaskContext.memoryWork.members,member=members[0],quote=value.untrustedEvidence.find(record=>record.id===member.id)!.ocrText,memories=[claim(member.id,quote,'Generated searchable backlog result')];const step=f.read(db=>db.prepare("SELECT id,fence,attempts FROM execution_steps WHERE user_id=? AND kind='memory.batch' AND state='running' AND EXISTS(SELECT 1 FROM json_each(input,'$.inputs') p WHERE json_extract(p.value,'$.id')=?)").get(f.a.userId,member.id))!;phases.push({phase:current,target:member.id,taskId:String(step.id),fence:String(step.fence),attempt:Number(step.attempts),at:Date.now()});
  if(current==='extract'&&reviewed&&!gateActive){gateActive=true;entered.resolve();await held.promise;}
  if(current==='review')reviewed=true;
  reply(res,{memories,coverage:coverage(members,memories)},body.messages.length,[member.id]);
 });
 const submitted=await f.submit(f.a,materials.map(material=>material.id));
 await until(()=>gateActive,Boolean,'a later extract remains deliberately in flight');await entered.promise;
 const visible=await until(async()=>(await f.request(f.a.token,'/api/memories?query=backlog')).json().items,items=>items.length>0,'reviewed results publish before the later provider gate is released',5000);
 assert.ok(visible.length<materials.length,'more authorized work remains outstanding');
 const current=await job(f,f.a,submitted.id);assert.ok(tasks(current).some(task=>task.state==='running'));assert.ok(tasks(current).some(task=>task.state==='waiting'));
 const publishedBatch=current.batches.find((batch:any)=>batch.state==='committed');assert.ok(publishedBatch,'publication is a durable batch checkpoint before whole-job completion');
 const persisted=f.read(db=>db.prepare('SELECT draft,review,prepared FROM mm_job_batches WHERE user_id=? AND job_id=? AND id=?').get(f.a.userId,submitted.id,publishedBatch.id)!);
 assert.ok(persisted.draft&&persisted.review&&persisted.prepared,'same-batch extraction, review and save checkpoints are retained');
 const root='memory:'+createHash('sha256').update(JSON.stringify([f.a.userId,'memory:'+submitted.id])).digest('hex'),members=f.read(db=>db.prepare('SELECT step_id FROM execution_operation_steps WHERE operation_id=? AND active=1').all(root).map(row=>row.step_id));
 for(const task of tasks(current))assert.ok(members.includes(task.id),'the actual owner-bound Memory root aggregates every batch stage');
 for(const batch of f.read(db=>db.prepare('SELECT tasks FROM mm_job_batches WHERE user_id=? AND job_id=?').all(f.a.userId,submitted.id))){const children=JSON.parse(String(batch.tasks));assert.deepEqual(Object.keys(children),['batch'],'one continuously executing task owns all checkpoints');assert.equal(f.read(db=>db.prepare('SELECT kind FROM execution_steps WHERE id=?').get(children.batch))!.kind,'memory.batch');assert.equal(f.read(db=>db.prepare('SELECT count(*) n FROM execution_dependencies WHERE step_id=?').get(children.batch))!.n,0,'no stage-to-stage workflow re-entry');}

 assert.ok(phases.some(call=>call.phase==='review'),'an independent review precedes publication');verify();held.resolve();await f.wait(f.a,submitted.id);verify();
 assert.equal((await f.request(f.a.token,'/api/memories')).json().items.length,materials.length);
 for(const target of new Set(phases.map(call=>call.target))){const timeline=phases.filter(call=>call.target===target);assert.deepEqual(timeline.map(call=>call.phase),['extract','review']);assert.equal(new Set(timeline.map(call=>call.taskId)).size,1);assert.equal(new Set(timeline.map(call=>call.fence)).size,1,'one running lease continues directly into independent review');assert.ok(timeline.every(call=>call.attempt===1));assert.ok(timeline[1].at>=timeline[0].at);}
 t.diagnostic(JSON.stringify({continuousBatchTimeline:phases}));
});

test('MEM-M03: an incomplete batch retains reviewed gaps without opening an owner question before evaluation completes',async t=>{
 const f=await scopedMemoryFixture(t);await batchSettings(f,12000);const first=await f.publish(f.a,'A','same-source','mixed-first','GENERATED_MIXED_INCOMPLETE_TARGET'),second=await f.publish(f.a,'A','same-source','mixed-second','GENERATED_MIXED_OWNER_QUESTION_TARGET');let incomplete=true;
 const verify=script(f,'A',(res,body,value)=>{
  const members=value.untrustedTaskContext.memoryWork.members;assert.equal(members.length,2);
  const rows=incomplete?members.map((member,index)=>index===0?{key:member.key,state:'incomplete',candidateIndexes:[],reason:'Generated target has not been fully assessed.'}:{key:member.key,state:'needs_owner_input',candidateIndexes:[],question:{prompt:'Which generated participant does this declaration describe?',choices:[],evidence:[{id:member.id,quote:value.untrustedEvidence.find(record=>record.id===member.id)!.ocrText}],reason:'Generated consequential attribution gap.'}}):coverage(members);
  reply(res,{memories:[],coverage:rows},body.messages.length);
 });
 const submitted=await f.submit(f.a,[first.id,second.id]);await until(()=>job(f,f.a,submitted.id),value=>Boolean(failureTask(value)),'the entire incomplete batch remains blocked');verify();assert.equal(f.read(db=>db.prepare('SELECT count(*) n FROM oq_questions WHERE user_id=?').get(f.a.userId))!.n,0,'an unfinished batch cannot create an actionable owner continuation');
 incomplete=false;const retry=await f.request(f.a.token,'/api/memory/jobs/'+submitted.id+'/retry','POST',{});assert.equal(retry.statusCode,200,retry.body);await f.wait(f.a,submitted.id);verify();assert.equal(f.requests.length,3,'retry preserves the valid extraction and reruns only the unfinished reviewer');
});

for(const disposition of ['save','cancel','revoke'] as const)test('owner questions become actionable only with a saved evaluation after a held publisher: '+disposition,async t=>{
 const f=await scopedMemoryFixture(t),entered=deferred(),release=deferred();t.after(()=>release.resolve());await batchSettings(f,12000);
 f.node.execution!.register({kind:'generated.publisher',pool:'generated.publisher',concurrency:()=>2,policy:EXECUTION_POLICIES.control,parseInput:()=>({}),resources:()=>[{scope:'user',key:'memory-publication'}],execute:async()=>{entered.resolve();await release.promise;return null;}});
 const context=await f.node.authority.authenticate(f.a.token),holder=await f.node.execution!.forUser(context).submit({kind:'generated.publisher',operationId:randomUUID(),input:{}});await entered.promise;
 const material=await f.publish(f.a,'A'),other=await f.publish(f.b,'B');
 for(const owner of ['A','B'])f.answers.set(owner,(_raw,keys,ids)=>({memories:[],coverage:keys.map(key=>({key,state:'needs_owner_input',candidateIndexes:[],question:{prompt:'Who is the generated speaker?',choices:[],evidence:[{id:ids[0],quote:'GENERATED_MEMORY_'+owner+': Nora prefers generated tea.'}]}}))}));
 const a=await f.submit(f.a,[material.id]),b=await f.submit(f.b,[other.id]);await f.wait(f.b,b.id);
 await until(()=>f.read(db=>Boolean(db.prepare('SELECT review FROM mm_job_batches WHERE user_id=? AND job_id=? AND review IS NOT NULL').get(f.a.userId,a.id))),Boolean,'A finishes review and waits for its publisher');
 const questions=async(user:any)=>(await f.request(user.token,'/api/owner-questions')).json().items;
 assert.deepEqual(await questions(f.a),[],'there is no answerable question before saving');const foreign=(await questions(f.b))[0];assert.ok(foreign);assert.equal((await f.request(f.a.token,'/api/owner-questions/'+foreign.id+'/reply','POST',{requestId:randomUUID(),expectedRevision:foreign.revision,action:'unknown'})).statusCode,404,'the real reply endpoint cannot operate on another owner');
 const queues=(await f.request(f.admin.token,'/api/admin/execution-settings')).json().queues;assert.equal(queues.memory.active,0,'publisher waiting holds no physical model admission');
 if(disposition==='cancel')assert.equal((await f.request(f.a.token,'/api/memory/jobs/'+a.id+'/cancel','POST',{})).statusCode,200);
 if(disposition==='revoke')await f.replace(f.a.token,'models',{profiles:[],selections:{}});
 release.resolve();await f.terminal(holder.id);
 if(disposition==='save'){
  await f.wait(f.a,a.id);const question=(await questions(f.a))[0];assert.ok(question);assert.equal((await job(f,f.a,a.id)).batches[0].state,'awaiting_context');
  const closed=await f.request(f.a.token,'/api/owner-questions/'+question.id+'/reply','POST',{requestId:randomUUID(),expectedRevision:question.revision,action:'unknown'});assert.equal(closed.statusCode,200,closed.body);assert.equal(closed.json().state,'closed');assert.equal((await job(f,f.a,a.id)).state,'committed');
 }else{await f.terminal(a.tasks.batch.id);assert.deepEqual(await questions(f.a),[]);assert.equal(f.read(db=>db.prepare('SELECT count(*) n FROM mm_records WHERE user_id=?').get(f.a.userId))!.n,0);}
 assert.equal((await questions(f.b))[0].id,foreign.id,'B keeps its saved question');
});

test('a saved batch receipt survives shutdown before task completion without redoing model work or opening duplicate questions',async t=>{
 const f=await scopedMemoryFixture(t),material=await f.publish(f.a,'A'),entered=deferred(),release=deferred();t.after(()=>release.resolve());
 f.answers.set('A',(_raw,keys,ids)=>({memories:[],coverage:keys.map(key=>({key,state:'needs_owner_input',candidateIndexes:[],question:{prompt:'Which generated speaker?',choices:[],evidence:[{id:ids[0],quote:'GENERATED_MEMORY_A: Nora prefers generated tea.'}]}}))}));
 // Hold only the projection boundary after the actual domain save. HTTP
 // admission, model calls, provider staging and the saved transaction are real.
 const host=f.node.memory as any,execute=host.execute.bind(host);host.execute=async(...args:any[])=>{const result=await execute(...args);entered.resolve();await release.promise;return result;};
 const created=await f.submit(f.a,[material.id]);await entered.promise;assert.equal(f.requests.length,2);assert.equal(f.read(db=>db.prepare("SELECT count(*) n FROM mm_batch_artifacts WHERE user_id=? AND job_id=? AND kind='saved'").get(f.a.userId,created.id))!.n,1);assert.equal((await f.request(f.a.token,'/api/owner-questions')).json().items.length,1);
 await f.restart();release.resolve();const done=await f.wait(f.a,created.id);assert.equal(done.tasks.batch.id,created.tasks.batch.id);assert.equal(f.requests.length,2,'retained save returns its receipt without another model call');assert.equal((await f.request(f.a.token,'/api/owner-questions')).json().items.length,1);
});

test('a saved integration resumes its task receipt after replacing its own related card',async t=>{
 const f=await scopedMemoryFixture(t),material=await f.publish(f.a,'A');await f.wait(f.a,(await f.submit(f.a,[material.id])).id);const parent=(await f.request(f.a.token,'/api/memories')).json().items[0],entered=deferred(),release=deferred();t.after(()=>release.resolve());
 f.answers.set('A',()=>({memories:[{...claim(parent.evidenceIds[0],'GENERATED_MEMORY_A: Nora prefers generated tea.','Generated consolidated replacement'),relatedMemoryIds:[parent.id],relations:[{kind:'supersedes',memoryId:parent.id,version:parent.version,fingerprint:parent.fingerprint}]}]}));
 const host=f.node.memory as any,execute=host.execute.bind(host);host.execute=async(...args:any[])=>{const value=await execute(...args);entered.resolve();await release.promise;return value;};
 const response=await f.request(f.a.token,'/api/memory/jobs','POST',{operationId:randomUUID(),materialIds:[material.id],memoryIds:[parent.id],phase:'integrate'});assert.equal(response.statusCode,200,response.body);const created=response.json();await until(()=>job(f,f.a,created.id),value=>{assert.ok(!failureTask(value),JSON.stringify(value));return value.batches.some((batch:any)=>batch.state==='committed');},'integration reaches the saved projection boundary');await entered.promise;
 const afterSave=f.requests.length;assert.equal((await f.request(f.a.token,'/api/memories/'+parent.id)).json().supersededBy!==undefined,true);
 await f.restart();release.resolve();const done=await f.wait(f.a,created.id);assert.equal(done.tasks.batch.id,created.tasks.batch.id);assert.equal(f.requests.length,afterSave,'the saved supersession does not invalidate or replay its own completed batch');assert.equal(done.state,'committed');
});
