import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {setTimeout as delay} from 'node:timers/promises';
import {scopedMemoryFixture} from './fixtures/scoped-memory-host.js';
import {defaultMemorySettings} from '../src/scope/memory-schema.js';
import {writeMessagesResponse} from '../../../scripts/fixtures/messages-provider.js';

type Fixture=Awaited<ReturnType<typeof scopedMemoryFixture>>;
type Domain='personal'|'coding';
type ModelCall={owner:string;domain?:Domain;review:boolean;integration:boolean};
const text=(owner:string)=>'GENERATED_MEMORY_'+owner+': Nora prefers generated tea.';

/** Inspect the real transport's host envelope, rather than dispatching on the
 * semantic contents of the generated originals. */
function envelope(raw:string):any{
 const visit=(value:any):any=>{
  if(typeof value==='string'){try{return visit(JSON.parse(value));}catch{return undefined;}}
  if(!value||typeof value!=='object')return undefined;
  if(value.untrustedEvidence&&value.untrustedTaskContext)return value;
  for(const item of Object.values(value)){const found=visit(item);if(found)return found;}
 };
 const found=visit(JSON.parse(raw));assert.ok(found,'real model request contains the supplied host context');return found;
}
function candidate(owner:string,id:string,domain:Domain,layer:'memory'|'observation'='memory',relatedMemoryIds?:string[]){
 return {domain,title:'Generated '+owner+' '+domain+' '+(relatedMemoryIds?'integration':layer),statement:'Nora prefers generated tea. ['+id+']',uncertainty:'Generated fixture tests transport and lifecycle only',admission:{layer,reason:'Generated explicitly scoped context',scope:'Nora in generated '+owner+' fixture',attribution:'third_party'},...(domain==='coding'?{coding:{kind:'pitfall',scope:'session',applicability:'Generated prototype',validation:'tested'}}:{}),...(relatedMemoryIds?{relatedMemoryIds}:{}),evidenceIds:[id],evidence:[{id,quote:text(owner)}]};
}
function scripted(f:Fixture,owner:string,calls:ModelCall[],options:{domains?:Domain[];observations?:boolean;onlyObservations?:boolean;supersede?:boolean;failReview?:()=>Domain|undefined}={}){
 f.responses.set(owner,(res,raw,keys)=>{
  const input=envelope(raw),context=input.untrustedTaskContext,interpretations=context.untrustedInterpretations?JSON.parse(context.untrustedInterpretations):undefined,integration=interpretations?.kind==='supplied-memory-cards',review=Boolean(context.untrustedMemoryDraft),domain=integration?interpretations.items[0].domain as Domain:undefined,id=input.untrustedEvidence[0].id;
  calls.push({owner,domain,review,integration});
  if(integration){
   assert.ok(interpretations.items.length);assert.ok(interpretations.items.every((memory:any)=>memory.domain===domain&&memory.admission.layer==='memory'),'a model call contains only selected Memory from its actual semantic domain');
   assert.ok(!raw.includes(text(owner==='A'?'B':'A')),'same-ID accounts never disclose one another\'s original');
   if(review&&domain===options.failReview?.()){res.writeHead(403,{'Content-Type':'application/json'}).end(JSON.stringify({error:{message:'Generated review denial'}}));return;}
  }
  const memories=integration?[{...candidate(owner,id,domain!,'memory',interpretations.items.map((memory:any)=>memory.id)),...(options.supersede?{relations:interpretations.items.map((memory:any)=>({kind:'supersedes',memoryId:memory.id,version:memory.version,fingerprint:memory.fingerprint}))}:{})}]:[
   ...(options.onlyObservations?[]:(options.domains??['personal','coding']).map(domain=>candidate(owner,id,domain))),
   ...(options.observations||options.onlyObservations?[candidate(owner,id,'personal','observation')]:[]),
  ];
  const answer={memories,...(!integration&&keys.length?{coverage:keys.map((key,index)=>({key,state:index===0?'checked':'no_candidates',candidateIndexes:index===0?memories.map((_,index)=>index):[]}))}:{})};
  writeMessagesResponse(res,{stage:f.requests.length,model:'generated-memory',text:JSON.stringify({answer:JSON.stringify(answer),citationIds:[id]})});
 });
}
async function until<T>(read:()=>T|Promise<T>,accept:(value:T)=>boolean,message:string){
 const deadline=Date.now()+15000;for(;;){const value=await read();if(accept(value))return value;assert.ok(Date.now()<deadline,message+' '+JSON.stringify(value));await delay(10);}
}
async function automaticJob(f:Fixture,user:any,windowId:string){
 const row=await until(()=>f.read(db=>db.prepare('SELECT job_id,state,json FROM mm_integration_windows WHERE user_id=? AND id=?').get(user.userId,windowId)),row=>Boolean(row?.job_id),'automatic integration admission');
 return {id:String(row!.job_id),window:JSON.parse(String(row!.json))};
}
async function setup(f:Fixture,user:any,minChanges=1){const settings=defaultMemorySettings();settings.lifecycle.consolidation.minChanges=minChanges;await f.replace(user.token,'memory',settings);}

test('automatic integration preserves both actual domains, independent review and same-ID owner isolation',async t=>{
 const f=await scopedMemoryFixture(t),calls:ModelCall[]=[],operationId=randomUUID();
 for(const [user,owner]of [[f.a,'A'],[f.b,'B']] as const){await setup(f,user);scripted(f,owner,calls,{observations:true});}
 const materials=await Promise.all([f.publish(f.a,'A'),f.publish(f.b,'B')]);assert.equal(materials[0].id,materials[1].id);
 await Promise.all([f.submit(f.a,[materials[0].id],operationId).then(job=>f.wait(f.a,job.id)),f.submit(f.b,[materials[1].id],operationId).then(job=>f.wait(f.b,job.id))]);
 for(const [user,owner]of [[f.a,'A'],[f.b,'B']] as const){
  const automatic=await automaticJob(f,user,operationId);await f.wait(user,automatic.id);
  const episodes=(await f.request(user.token,'/api/memories?tier=episode')).json().items,selected=episodes.filter((memory:any)=>memory.admission.layer==='memory');
  assert.equal(episodes.length,3);assert.equal(automatic.window.selection.length,2);assert.deepEqual(new Set(automatic.window.selection.map((pin:any)=>pin.id)),new Set(selected.map((memory:any)=>memory.id)));
  const batches=f.read(db=>db.prepare('SELECT input,state,review FROM mm_job_batches WHERE user_id=? AND job_id=?').all(user.userId,automatic.id));
  assert.deepEqual(new Set(batches.map(row=>JSON.parse(String(row.input)).profile)),new Set(['personal','coding']));assert.ok(batches.every(row=>row.state==='committed'));
  assert.ok(batches.every(row=>JSON.parse(String(row.review)).receipt.decision==='independent'),'each nonempty domain integration has a genuine independent model review');
  const integrated=(await f.request(user.token,'/api/memories?tier=consolidated')).json().items;assert.equal(integrated.length,2);assert.deepEqual(new Set(integrated.map((memory:any)=>memory.domain)),new Set(['personal','coding']));
  for(const domain of ['personal','coding'])assert.equal(calls.filter(call=>call.owner===owner&&call.integration&&call.domain===domain).length,2);
  assert.equal((await f.request(user===f.a?f.b.token:f.a.token,'/api/memory/jobs/'+automatic.id)).json().id,automatic.id,'equal operation IDs resolve only the caller\'s owned job');
  assert.equal((await f.request(user.token,'/api/memory')).json().settings.profile,'personal');
 }
 const before=f.requests.length;await f.restart();for(const user of [f.a,f.b])await f.wait(user,(await automaticJob(f,user,operationId)).id);assert.equal(f.requests.length,before,'restart never replays successful domain checkpoints');
});

for(const failedDomain of ['personal','coding'] as const)test('automatic '+failedDomain+' review failure preserves the other domain through restart and same-job retry',async t=>{
 const f=await scopedMemoryFixture(t),calls:ModelCall[]=[];let fail:Domain|undefined=failedDomain;await setup(f,f.a);scripted(f,'A',calls,{supersede:true,failReview:()=>fail});
 const extraction=await f.submit(f.a,[(await f.publish(f.a,'A')).id]);await f.wait(f.a,extraction.id);const automatic=await automaticJob(f,f.a,extraction.id);
 const batches=await until(()=>f.read(db=>db.prepare('SELECT input,state,draft,review,tasks FROM mm_job_batches WHERE user_id=? AND job_id=?').all(f.a.userId,automatic.id)),rows=>rows.length===2&&rows.some(row=>row.state==='committed')&&rows.some(row=>{const tasks=JSON.parse(String(row.tasks));return ['blocked','failed'].includes(String(f.read(db=>db.prepare('SELECT state FROM execution_steps WHERE id=?').get(tasks.review)?.state)));}),'independent domain failure and sibling publication');
 const completed=batches.find(row=>row.state==='committed')!,pending=batches.find(row=>row.state!=='committed')!;assert.notEqual(JSON.parse(String(completed.input)).profile,failedDomain);assert.equal(JSON.parse(String(pending.input)).profile,failedDomain);assert.ok(pending.draft);assert.equal(pending.review,null);
 const completedInput=JSON.parse(String(completed.input)),retired=f.read(db=>db.prepare('SELECT version,json FROM mm_records WHERE user_id=? AND id=?').get(f.a.userId,completedInput.related[0].id));assert.equal(retired!.version,completedInput.related[0].version+1);assert.ok(JSON.parse(String(retired!.json)).supersededBy,'the successful sibling actually supersedes its exact parent before the failed domain retries');
 const checkpoint={state:completed.state,draft:completed.draft,review:completed.review,tasks:completed.tasks},before=calls.length;await f.restart();assert.equal(calls.length,before,'restart does not replay failed model work or a committed sibling');
 fail=undefined;const retried=await f.request(f.a.token,'/api/memory/jobs/'+automatic.id+'/retry','POST',{});assert.equal(retried.statusCode,200,retried.body);await f.wait(f.a,automatic.id);
 assert.deepEqual(calls.slice(before),[{owner:'A',domain:failedDomain,review:true,integration:true}],'only the original failed domain reviewer reruns');
 const after=f.read(db=>db.prepare('SELECT state,draft,review,tasks FROM mm_job_batches WHERE user_id=? AND job_id=? AND json_extract(input,\'$.profile\')!=?').get(f.a.userId,automatic.id,failedDomain));assert.deepEqual({...after},checkpoint,'the successful domain checkpoint remains byte-for-byte intact');
 assert.equal((await f.request(f.a.token,'/api/memories?tier=consolidated')).json().items.length,2);
});

test('observations neither open consolidation windows nor count toward selected-Memory admission',async t=>{
 const f=await scopedMemoryFixture(t),calls:ModelCall[]=[];await setup(f,f.a,2);scripted(f,'A',calls,{onlyObservations:true});
 const observed=await f.submit(f.a,[(await f.publish(f.a,'A','same-source','observation-only')).id]);await f.wait(f.a,observed.id);
 assert.equal(f.read(db=>db.prepare('SELECT count(*) n FROM mm_integration_windows WHERE user_id=?').get(f.a.userId)!.n),0,'searchable observations do not register long-term work');
 scripted(f,'A',calls,{domains:['personal'],observations:true});const mixed=await f.submit(f.a,[(await f.publish(f.a,'A','same-source','mixed-layer')).id]);await f.wait(f.a,mixed.id);
 await until(()=>f.read(db=>db.prepare('SELECT e.state,e.error FROM mm_integration_windows w JOIN execution_steps e ON e.id=w.task_id WHERE w.user_id=? AND w.id=?').get(f.a.userId,mixed.id)),row=>row?.state==='waiting'&&row.error==='memory_integration_window_pending','selected-Memory-only threshold');
 assert.equal(calls.filter(call=>call.integration).length,0,'one selected Memory plus multiple observations does not meet minChanges=2');
 assert.equal((await f.request(f.a.token,'/api/memories?layer=observation')).json().items.length,2,'observations stay published and searchable in their original layer');
});

test('one publication larger than maxItems advances a durable bounded continuation without another publication',async t=>{
 const f=await scopedMemoryFixture(t),calls:ModelCall[]=[],settings=defaultMemorySettings();settings.lifecycle.consolidation.minChanges=1;settings.lifecycle.consolidation.maxItems=1;await f.replace(f.a.token,'memory',settings);scripted(f,'A',calls,{observations:true});
 const extraction=await f.submit(f.a,[(await f.publish(f.a,'A')).id]);await f.wait(f.a,extraction.id);
 const rows=await until(()=>f.read(db=>db.prepare("SELECT id,json,created_at,job_id,state FROM mm_integration_windows WHERE user_id=? ORDER BY id").all(f.a.userId)),rows=>rows.length===2&&rows.every(row=>row.job_id&&row.state==='complete'),'remaining selected Memory advances to a second bounded window');
 for(const row of rows)await f.wait(f.a,String(row.job_id));
 const windows=rows.map(row=>JSON.parse(String(row.json)));assert.ok(windows.every(window=>window.selection.length===1),'maxItems bounds the whole window, across domains');assert.equal(new Set(rows.map(row=>row.created_at)).size,1,'the continuation retains the original window clock');assert.ok(windows.every(window=>window.generation===windows[0].generation&&JSON.stringify(window.settings)===JSON.stringify(windows[0].settings)&&JSON.stringify(window.binding)===JSON.stringify(windows[0].binding)),'the continuation retains the original automatic authority and configuration');
 assert.deepEqual(new Set(calls.filter(call=>call.integration).map(call=>call.domain)),new Set(['personal','coding']));assert.equal(calls.filter(call=>!call.integration).length,2,'no unrelated extraction/publication is needed to progress');
 const selected=(await f.request(f.a.token,'/api/memories?tier=episode&layer=memory')).json().items;assert.deepEqual(new Set(windows.flatMap(window=>window.selection.map((pin:any)=>pin.id))),new Set(selected.map((memory:any)=>memory.id)));
 assert.equal((await f.request(f.a.token,'/api/memories?tier=consolidated')).json().items.length,2);const before=calls.length;await f.restart();for(const row of rows)await f.wait(f.a,String(row.job_id));assert.equal(calls.length,before,'restart preserves both windows\' completed domain checkpoints');
});

test('pending consolidation observations project both actual domains and exclude observation cards',async t=>{
 const f=await scopedMemoryFixture(t),calls:ModelCall[]=[];await setup(f,f.a,3);scripted(f,'A',calls,{onlyObservations:true});const observation=await f.submit(f.a,[(await f.publish(f.a,'A','same-source','older-observation')).id]);await f.wait(f.a,observation.id);
 scripted(f,'A',calls,{observations:true});const mixed=await f.submit(f.a,[(await f.publish(f.a,'A','same-source','both-domains')).id]);await f.wait(f.a,mixed.id);
 const observationPage=await until(async()=>{const response=await f.request(f.a.token,'/api/memory/observations');assert.equal(response.statusCode,200,response.body);return response.json();},page=>page.items.some((item:any)=>item.kind==='consolidation'&&item.task?.state==='waiting'),'pending dual-domain observation');
 const window=observationPage.items.find((item:any)=>item.kind==='consolidation');assert.equal(window.pendingChanges,2,'one selected card from each domain is pending; neither observation counts');assert.equal(Date.parse(window.dueAt)-Date.parse(window.createdAt),3600000,'the original maximum-wait fallback is one hour');assert.equal(calls.filter(call=>call.integration).length,0);
});

test('a below-threshold continuation retains its due clock and progresses after the maximum wait',async t=>{
 t.mock.timers.enable({apis:['Date'],now:Date.now()});
 const f=await scopedMemoryFixture(t),calls:ModelCall[]=[],settings=defaultMemorySettings();settings.lifecycle.consolidation.minChanges=2;settings.lifecycle.consolidation.maxItems=1;await f.replace(f.a.token,'memory',settings);scripted(f,'A',calls);
 const extraction=await f.submit(f.a,[(await f.publish(f.a,'A')).id]);await f.wait(f.a,extraction.id);const first=await automaticJob(f,f.a,extraction.id);await f.wait(f.a,first.id);
 const pending=await until(async()=>{const response=await f.request(f.a.token,'/api/memory/observations');assert.equal(response.statusCode,200,response.body);return response.json().items.find((item:any)=>item.kind==='consolidation'&&item.state==='pending'&&item.task?.state==='waiting'&&item.task?.reason==='memory_integration_window_pending');},item=>Boolean(item),'below-threshold frozen continuation');
 assert.equal(pending.pendingChanges,1);assert.equal(calls.filter(call=>call.integration).length,2,'the remaining card waits for count-or-maximum-wait admission');assert.equal(Date.parse(pending.dueAt)-Date.parse(pending.createdAt),3600000);
 t.mock.timers.setTime(Date.parse(pending.dueAt)+1);
 const next=await automaticJob(f,f.a,pending.id);await f.wait(f.a,next.id);assert.equal(calls.filter(call=>call.integration).length,4,'the original remaining card is integrated after its due time without a new publication');assert.equal((await f.request(f.a.token,'/api/memories?tier=consolidated')).json().items.length,2);
});

for(const change of ['cancel','stop'] as const)test('a frozen consolidation continuation cannot advance after '+change,async t=>{
 const f=await scopedMemoryFixture(t),calls:ModelCall[]=[],settings=defaultMemorySettings();settings.lifecycle.consolidation.minChanges=1;settings.lifecycle.consolidation.maxItems=1;await f.replace(f.a.token,'memory',settings);scripted(f,'A',calls);
 const respond=f.responses.get('A')!;let release!:()=>void,enter!:()=>void,held=false;const gate=new Promise<void>(done=>release=done),entered=new Promise<void>(done=>enter=done);t.after(()=>release());
 f.responses.set('A',(res,raw,keys,ids)=>{const input=envelope(raw),context=input.untrustedTaskContext,interpretations=context.untrustedInterpretations?JSON.parse(context.untrustedInterpretations):undefined;if(!held&&interpretations?.kind==='supplied-memory-cards'&&context.untrustedMemoryDraft){held=true;enter();void gate.then(()=>respond(res,raw,keys,ids));return;}respond(res,raw,keys,ids);});
 const extraction=await f.submit(f.a,[(await f.publish(f.a,'A')).id]);await f.wait(f.a,extraction.id);const current=await automaticJob(f,f.a,extraction.id);await entered;
 const continuation=await until(()=>f.read(db=>db.prepare("SELECT id,task_id FROM mm_integration_windows WHERE user_id=? AND id!=? AND state='pending'").get(f.a.userId,extraction.id)),Boolean,'the unstarted successor is already durable');
 const state=(await f.request(f.a.token,'/api/memory')).json(),changed=change==='cancel'?await f.request(f.a.token,'/api/memory/jobs/'+current.id+'/cancel','POST',{}):await f.request(f.a.token,'/api/memory/stop','POST',{expectedRevision:state.revision,operationId:randomUUID()});assert.equal(changed.statusCode,200,changed.body);release();
 await f.terminal(String(continuation!.task_id));assert.equal((await f.request(f.a.token,'/api/memories?tier=consolidated')).json().items.length,0,'the held reviewer and successor publish no derived result');
 const requests=f.requests.length;await f.restart();await delay(100);assert.equal(f.requests.length,requests,'restart cannot regrant a cancelled or stopped continuation');assert.equal(f.read(db=>db.prepare('SELECT job_id FROM mm_integration_windows WHERE user_id=? AND id=?').get(f.a.userId,continuation!.id))!.job_id,null);
});
