import test from 'node:test';
import assert from 'node:assert/strict';
import {scopedMemoryFixture} from './fixtures/scoped-memory-host.js';
import {createHash,randomUUID} from 'node:crypto';
import {setTimeout as delay} from 'node:timers/promises';
import {defaultModelSettings} from '../src/model-settings.js';
import {defaultMemorySettings} from '../src/scope/memory-schema.js';

const envelope=(body:any)=>JSON.parse(typeof body.messages[0].content==='string'?body.messages[0].content:body.messages[0].content[0].text);

test('manual production Memory freezes creation time independently of the original source date',async t=>{
 const f=await scopedMemoryFixture(t),settings=defaultMemorySettings();settings.automatic=false;settings.integration=false;await f.replace(f.a.token,'memory',settings);
 const material=await f.publish(f.a,'A'),before=Date.now(),job=await f.submit(f.a,[material.id]);await f.wait(f.a,job.id);const after=Date.now();
 assert.equal(f.requests.length,2);
 const sent=f.requests.map(request=>envelope(request.body));
 for(const value of sent)assert.ok(Date.parse(value.currentTime)>=before&&Date.parse(value.currentTime)<=after,'model now must be the frozen job creation time, not 2026-01-01 source time');
 assert.equal(sent[0].currentTime,sent[1].currentTime,'independent review inherits the exact evaluation clock');
 assert.equal(sent[0].untrustedEvidence[0].capturedAt??Object.values(sent[0].evidenceContexts)[0]?.capturedAt,'2026-01-01T00:00:00.000Z');
});

test('pinned scoped extraction and independent review use the existing neutral procedure',async t=>{
 const f=await scopedMemoryFixture(t),settings=defaultMemorySettings();settings.automatic=false;settings.integration=false;await f.replace(f.a.token,'memory',settings);
 const material=await f.publish(f.a,'A'),job=await f.submit(f.a,[material.id]);await f.wait(f.a,job.id);
 assert.equal(f.requests.length,2);
 for(const request of f.requests){const value=envelope(request.body);assert.equal(value.requiredSkill,'memory-strategy');assert.match(value.procedure,/Use the explicitly supplied strategy/);assert.doesNotMatch(value.procedure,/A relation stays a proposal until the owner confirms it/);}
});

const deferred=()=>{let resolve!:()=>void;const promise=new Promise<void>(done=>resolve=done);return {promise,resolve};};
const personal={id:'mote.personal-memory',version:'5'},coding={id:'mote.coding-memory',version:'3'};
async function until<T>(read:()=>T|Promise<T>,done:(value:T)=>boolean,label:string){const end=Date.now()+15000;for(;;){const value=await read();if(done(value))return value;assert.ok(Date.now()<end,label+' '+JSON.stringify(value));await delay(10);}}

test('E1: concurrent duplicate manual admission, two recipes and batches keep one clock across midnight and restart',async t=>{
 let now='2037-04-10T23:59:58.000Z',clockReads=0;const f=await scopedMemoryFixture(t,undefined,undefined,()=>{clockReads++;return now;}),settings=defaultMemorySettings();settings.automatic=false;settings.integration=false;settings.recipes=[personal,coding];settings.lifecycle.batchCharacters=256;await f.replace(f.a.token,'memory',settings);
 f.answers.set('A',(_raw,keys)=>({memories:[],coverage:keys.map(key=>({key,state:'no_candidates',candidateIndexes:[]}))}));
 const material=await f.publish(f.a,'A','same-source','split-input','GENERATED_FIRST_RANGE'.padEnd(255,'.')+'\n'+'GENERATED_SECOND_RANGE'.padEnd(255,'.')+'\n'),operationId=randomUUID(),gate={entered:deferred(),release:deferred()};f.gates.set('A',gate);t.after(()=>gate.release.resolve());
 clockReads=0;const [first,concurrent]=await Promise.all([f.submit(f.a,[material.id],operationId),f.submit(f.a,[material.id],operationId)]);assert.equal(first.id,concurrent.id);assert.equal(clockReads,1,'one Host merges concurrent duplicate admission before taking another semantic clock');await gate.entered.promise;
 const persisted=()=>String(f.read(db=>db.prepare('SELECT input FROM mm_jobs WHERE user_id=? AND id=?').get(f.a.userId,first.id)!.input)),before=persisted(),context=JSON.parse(before).evaluationContext,model=JSON.parse(before).model;
 assert.equal(context.time,now);assert.ok(context.inputs.every((input:any)=>input.time===now));now='2037-04-11T00:00:04.000Z';gate.release.resolve();const completed=await f.wait(f.a,first.id);assert.equal(completed.batches.length,4);assert.equal(f.requests.length,8);
 for(const request of f.requests){const sent=envelope(request.body);assert.equal(sent.currentTime,context.time);assert.equal(sent.requiredSkill,'memory-strategy');assert.ok(sent.untrustedTaskContext.memoryWork.members.every((member:any)=>member.evaluationTime===context.time));}
 const tasks=f.read(db=>db.prepare("SELECT id,attempts FROM execution_steps WHERE user_id=? AND kind='memory.batch' ORDER BY id").all(f.a.userId));
 await f.submit(f.a,[material.id],operationId);assert.equal(persisted(),before);assert.deepEqual(JSON.parse(persisted()).model,model);assert.equal(f.requests.length,8);
 const different=await f.publish(f.a,'A','same-source','different-input');assert.equal((await f.request(f.a.token,'/api/memory/jobs','POST',{operationId,materialIds:[different.id]})).statusCode,409);
 await f.restart();await f.wait(f.a,first.id);assert.equal(persisted(),before);assert.equal(f.requests.length,8);assert.deepEqual(f.read(db=>db.prepare("SELECT id,attempts FROM execution_steps WHERE user_id=? AND kind='memory.batch' ORDER BY id").all(f.a.userId)),tasks);
});

test('E2: delayed real M06 publications retain distinct receipt clocks while two recipes still share each mixed package',async t=>{
 let now='2037-04-10T08:00:00.000Z';const f=await scopedMemoryFixture(t,undefined,undefined,()=>now),settings=defaultMemorySettings();settings.integration=false;settings.recipes=[personal,coding];settings.lifecycle.extraction.minChanges=2;await f.replace(f.a.token,'memory',settings);f.answers.set('A',(_raw,keys)=>({memories:[],coverage:keys.map(key=>({key,state:'no_candidates',candidateIndexes:[]}))}));
 await f.replace(f.a.token,'models',{profiles:[{id:'same-model',name:'Generated fixed model',settings:{...defaultModelSettings(),provider:'custom',protocol:'anthropic-messages',model:'generated-memory',baseUrl:f.modelUrl,apiKey:'GENERATED_A_KEY',headers:{},extraBody:{}}}],selections:{memory:{kind:'personal',id:'same-model'},file:{kind:'personal',id:'same-model'}}});
 const first=await f.upload(f.a,'A','first-upload'),firstCapture=first.captures[0].id,firstClock=now;now='2037-04-11T09:00:00.000Z';const second=await f.upload(f.a,'A','second-upload'),secondCapture=second.captures[0].id,secondClock=now;
 const receipt=(id:string)=>String(f.read(db=>db.prepare('SELECT json FROM mm_capture_intakes WHERE user_id=? AND capture_id=?').get(f.a.userId,id)!.json)),before=receipt(firstCapture);assert.equal(JSON.parse(before).evaluationTime,firstClock);assert.equal(JSON.parse(receipt(secondCapture)).evaluationTime,secondClock);assert.equal(f.requests.length,0,'reception alone has not generated Memory');
 now='2037-06-01T10:00:00.000Z';const bytes=Buffer.from('GENERATED_MEMORY_A: Nora prefers generated tea.'),duplicate=await f.request(f.a.token,'/api/ingress/sources/same-source/uploads','POST',{batchId:'duplicate-transport',revision:{sourceId:'same-source',item:{externalId:'first-upload',revision:'same-revision',observedAt:'2026-01-01T00:00:00Z',title:'Generated original',text:'',kind:'file',layer:'original',mimeType:'text/plain'},sizeBytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),relativePath:'generated.txt'}});assert.equal(duplicate.statusCode,200,duplicate.body);assert.equal(duplicate.json().receipt.captures[0].duplicate,true);assert.equal(receipt(firstCapture),before,'duplicate ACK cannot mint a later evaluation time');
 for(const received of [first,second]){const response=await f.request(f.a.token,'/api/processing','POST',{originalRef:received.captures[0].original.ref,operationId:randomUUID()});assert.equal(response.statusCode,200,response.body);await until(async()=>(await f.request(f.a.token,'/api/tasks/'+response.json().id)).json(),value=>value.state==='succeeded','real delayed M06 publication');}
 const jobs=await until(()=>f.read(db=>db.prepare('SELECT id,input FROM mm_jobs WHERE user_id=?').all(f.a.userId)),rows=>rows.length===2,'both automatic recipe jobs');for(const job of jobs)await f.wait(f.a,String(job.id));assert.equal(f.requests.length,4);
 const intakes=f.read(db=>db.prepare('SELECT job_id,json,state FROM mm_intakes WHERE user_id=?').all(f.a.userId));assert.equal(intakes.length,4);assert.ok(intakes.every(row=>row.state==='complete'));assert.ok(jobs.every(job=>intakes.filter(row=>row.job_id===job.id).length===2),'evaluation metadata never splits existing policy grouping');
 for(const request of f.requests){const sent=envelope(request.body),members=sent.untrustedTaskContext.memoryWork.members;assert.equal(members.length,2);assert.deepEqual(new Set(members.map((member:any)=>member.evaluationTime)),new Set([firstClock,secondClock]));assert.equal(sent.currentTime,members[0].evaluationTime,'first actual target chooses model now');assert.equal(sent.currentTime,firstClock);assert.equal(sent.requiredSkill,'memory-strategy');}
 const calls=f.requests.length;now='2038-01-01T00:00:00.000Z';await f.restart();for(const job of jobs)await f.wait(f.a,String(job.id));assert.equal(f.requests.length,calls);assert.equal(receipt(firstCapture),before);
});

test('E2: receipt refused while automatic extraction is off remains refused after resume, delayed M06 and restart',async t=>{
 let now='2037-04-10T08:00:00.000Z';const f=await scopedMemoryFixture(t,undefined,undefined,()=>now),settings=defaultMemorySettings();settings.automatic=false;settings.integration=false;await f.replace(f.a.token,'memory',settings);const received=await f.upload(f.a,'A','refused'),captureId=received.captures[0].id,clock=now;settings.automatic=true;await f.replace(f.a.token,'memory',settings);now='2038-01-01T00:00:00.000Z';
 await f.replace(f.a.token,'models',{profiles:[{id:'same-model',name:'Generated fixed model',settings:{...defaultModelSettings(),provider:'custom',protocol:'anthropic-messages',model:'generated-memory',baseUrl:f.modelUrl,apiKey:'GENERATED_A_KEY',headers:{},extraBody:{}}}],selections:{memory:{kind:'personal',id:'same-model'},file:{kind:'personal',id:'same-model'}}});
 const processed=await f.request(f.a.token,'/api/processing','POST',{originalRef:received.captures[0].original.ref,operationId:randomUUID()});assert.equal(processed.statusCode,200,processed.body);await until(async()=>(await f.request(f.a.token,'/api/tasks/'+processed.json().id)).json(),value=>value.state==='succeeded','refused receipt still allows ordinary M06');await f.restart();await delay(100);
 const retained=f.read(db=>db.prepare('SELECT json,revoked FROM mm_capture_intakes WHERE user_id=? AND capture_id=?').get(f.a.userId,captureId))!;assert.equal(retained.revoked,1);assert.equal(JSON.parse(String(retained.json)).evaluationTime,clock);assert.equal(f.requests.length,0);assert.equal(f.read(db=>db.prepare('SELECT count(*) n FROM mm_jobs WHERE user_id=?').get(f.a.userId)!.n),0);
});

test('E9/E10: missing private evaluation context fails closed without repairing old tasks or replaying retained canonical Memory',async t=>{
 const f=await scopedMemoryFixture(t),settings=defaultMemorySettings();settings.automatic=false;settings.integration=false;await f.replace(f.a.token,'memory',settings);const material=await f.publish(f.a,'A');await f.wait(f.a,(await f.submit(f.a,[material.id])).id);const canonical=(await f.request(f.a.token,'/api/memories')).json().items[0],fork=f.node.configuration.forkLease.bind(f.node.configuration),entered=deferred(),release=deferred();t.after(()=>release.resolve());f.node.configuration.forkLease=async(...args:Parameters<typeof fork>)=>{const lease=await fork(...args);entered.resolve();await release.promise;return lease;};const id=randomUUID(),pending=f.submit(f.a,[material.id],id);await entered.promise;const pause=await f.request(f.a.token,'/api/memory/jobs/'+id+'/pause','POST',{});assert.equal(pause.statusCode,200,pause.body);release.resolve();await pending;assert.equal(f.requests.length,2);
 f.read(db=>{db.prepare("UPDATE mm_jobs SET input=json_remove(input,'$.evaluationContext') WHERE user_id=? AND id=?").run(f.a.userId,id);db.prepare("UPDATE mm_job_batches SET input=json_remove(input,'$.evaluationContext') WHERE user_id=? AND job_id=?").run(f.a.userId,id);db.prepare("UPDATE user_tasks SET input=json_remove(input,'$.evaluationContext') WHERE user_id=? AND json_extract(input,'$.jobId')=?").run(f.a.userId,id);db.prepare("UPDATE execution_steps SET input=json_remove(input,'$.evaluationContext') WHERE user_id=? AND json_extract(input,'$.jobId')=?").run(f.a.userId,id);});
 const input=()=>String(f.read(db=>db.prepare('SELECT input FROM mm_jobs WHERE user_id=? AND id=?').get(f.a.userId,id)!.input)),before=input();await f.restart();const resume=await f.request(f.a.token,'/api/memory/jobs/'+id+'/resume','POST',{});assert.equal(resume.statusCode,200,resume.body);await until(()=>f.read(db=>db.prepare("SELECT state FROM execution_steps WHERE user_id=? AND kind='memory.batch' AND json_extract(input,'$.jobId')=?").get(f.a.userId,id)),row=>Boolean(row&&['failed','blocked','stale'].includes(String(row.state))),'resumed missing-context task fails closed before any model request');assert.equal(input(),before);assert.equal(Object.hasOwn(JSON.parse(input()),'evaluationContext'),false);assert.equal(f.requests.length,2);const read=await f.request(f.a.token,'/api/memories/'+canonical.id);assert.equal(read.statusCode,200,read.body);assert.equal(read.json().statement,canonical.statement);
});
