import test from 'node:test';
import assert from 'node:assert/strict';
import {event,modelFixture} from './fixtures/scoped-actions.js';
import {waitForState} from './fixtures/scoped-query-accounts.js';
import {writeMessagesResponse} from '../../../scripts/fixtures/messages-provider.js';

type Fixture=Awaited<ReturnType<typeof modelFixture>>;
const quote='GENERATED_A_PRIVATE_APPOINTMENT';
const target={deviceId:'same-device',calendarId:'same-calendar'};
function script(f:Fixture,actions:(id:string)=>unknown[]){
 f.scripts.set('A',(body,_raw,res)=>{const envelope=JSON.parse(typeof body.messages[0].content==='string'?body.messages[0].content:body.messages[0].content[0].text),id=envelope.untrustedEvidence[0].id;writeMessagesResponse(res,{stage:1,text:JSON.stringify({answer:JSON.stringify({actions:actions(id)}),citationIds:[id]})});});
}
const proposal=(id:string,sameAs:string|null=null,kind='calendar.create',text=quote)=>({kind,sameAs,event,uncertainty:'Generated batch proposal',evidence:[{id,quote:text}]});
const jobs=(f:Fixture)=>f.read(db=>Number(db.prepare('SELECT count(*) n FROM ac_jobs WHERE user_id=?').get(f.a.userId)!.n));
async function settled(f:Fixture,minimum:number){
 return waitForState(()=>f.ok(f.a.token,'/api/actions'),page=>page.progress.jobs.length>0&&page.progress.jobs.every((job:any)=>job.status==='completed')&&page.progress.jobs.reduce((count:number,job:any)=>count+job.count,0)>=minimum,'actual committed Actions batch',30000);
}
async function append(f:Fixture,id:string){const before=jobs(f);await f.ingest(f.a,'A',id,'other-source');await f.ok(f.a.token,'/api/actions/retry','POST',{});return settled(f,before+1);}
async function original(f:Fixture){await f.ingest(f.a,'A');await f.enable(f.a);await f.proposal(f.a);const page=await settled(f,1);assert.equal(page.items.length,1);return page.items[0];}

for(const duplicateFirst of [true,false])test(`actual batch keeps a sameAs update reviewable with duplicate ${duplicateFirst?'before':'after'} it`,async t=>{
 const f=await modelFixture(t),initial=await original(f),changed={...event,title:'Generated rescheduled appointment'};
 script(f,id=>{const duplicate=proposal(id,initial.id),update={...proposal(id,initial.id,'calendar.update'),event:changed};return duplicateFirst?[duplicate,update,update]:[update,update,duplicate];});
 const page=await append(f,'duplicate-update'),updates=page.items.filter((action:any)=>action.kind==='calendar.update');
 assert.equal(page.items.length,2);assert.equal(updates.length,1);const update=updates[0],unchanged=page.items.find((action:any)=>action.id===initial.id);
 assert.equal(unchanged.version,initial.version);assert.deepEqual(unchanged.evidence,initial.evidence);assert.equal(update.related.version,initial.version);assert.equal(update.evidence.length,2);
 const approved=await f.ok(f.a.token,'/api/actions/'+update.id+'/confirm','POST',{version:update.version,event:update.event});
 assert.equal(approved.status,'succeeded');const after=await f.ok(f.a.token,'/api/actions');assert.deepEqual(after.items.find((action:any)=>action.id===initial.id).event,changed);
 assert.equal((await f.ok(f.b.token,'/api/actions')).items.length,0);
});

test('actual batch accumulates repeated sameAs proof once and preserves a dismissed decision',async t=>{
 const f=await modelFixture(t),initial=await original(f),dismissed=await f.ok(f.a.token,'/api/actions/'+initial.id+'/dismiss','POST',{version:initial.version});
 script(f,id=>[proposal(id,initial.id,'calendar.create','GENERATED_A'),proposal(id,initial.id,'calendar.create','PRIVATE_APPOINTMENT')]);
 const page=await append(f,'two-duplicates');assert.equal(page.items.length,1);assert.equal(page.items[0].status,'dismissed');assert.equal(page.items[0].version,dismissed.version+1);assert.equal(page.items[0].evidence.length,3);
 assert.deepEqual(page.items[0].evidence.map((proof:any)=>proof.quote),[quote,'GENERATED_A','PRIVATE_APPOINTMENT']);
 await f.restart();const restarted=await f.ok(f.a.token,'/api/actions');assert.deepEqual(restarted.items[0],page.items[0]);
});

test('actual batch removes exact new proposals while equal event fields with distinct proof remain separate',async t=>{
 const f=await modelFixture(t);script(f,id=>[proposal(id),proposal(id),proposal(id,null,'calendar.create','PRIVATE_APPOINTMENT')]);
 await f.ingest(f.a,'A');await f.enable(f.a);await f.proposal(f.a);const page=await settled(f,1);
 assert.equal(page.items.length,2);assert.ok(page.items.every((action:any)=>action.status==='proposed'));assert.ok(page.items.every((action:any)=>JSON.stringify(action.event)===JSON.stringify(event)));
 assert.deepEqual(new Set(page.items.map((action:any)=>action.evidence[0].quote)),new Set([quote,'PRIVATE_APPOINTMENT']));
 assert.equal(f.read(db=>Number(db.prepare('SELECT count(*) n FROM ac_operations WHERE user_id=?').get(f.a.userId)!.n)),0);
});

test('actual duplicates leave approved, executing and uncertain native changes pinned to their original',async t=>{
 const f=await modelFixture(t),initial=await original(f);
 await f.ok(f.a.token,'/api/actions/targets','POST',{deviceId:'same-device',deviceName:'Generated A',calendars:[{id:'same-calendar',title:'Generated A'}]});
 const exported=await f.ok(f.a.token,'/api/actions/'+initial.id+'/confirm','POST',{version:initial.version,event:initial.event,target});
 await f.ok(f.a.token,'/api/actions/'+initial.id+'/claim','POST',{deviceId:'same-device'});
 await f.ok(f.a.token,'/api/actions/'+initial.id+'/receipt','POST',{deviceId:'same-device',operationId:exported.operationId,status:'succeeded',externalId:'generated-original-native'});
 const originalAction=(await f.ok(f.a.token,'/api/actions')).items.find((action:any)=>action.id===initial.id);
 script(f,id=>[{...proposal(id,initial.id,'calendar.update'),event:{...event,title:'Generated changed appointment'}}]);
 const updatePage=await append(f,'native-update'),update=updatePage.items.find((action:any)=>action.kind==='calendar.update');
 const approved=await f.ok(f.a.token,'/api/actions/'+update.id+'/confirm','POST',{version:update.version,event:update.event,target});
 script(f,id=>[proposal(id,initial.id)]);
 for(const status of ['approved','executing','uncertain']){
  if(status==='executing')await f.ok(f.a.token,'/api/actions/'+update.id+'/claim','POST',{deviceId:'same-device'});
  if(status==='uncertain')await f.ok(f.a.token,'/api/actions/'+update.id+'/receipt','POST',{deviceId:'same-device',operationId:approved.operationId,status:'uncertain'});
  const page=await append(f,'duplicate-during-'+status),current=page.items.find((action:any)=>action.id===initial.id),change=page.items.find((action:any)=>action.id===update.id);
  assert.equal(page.items.length,2);assert.equal(current.version,originalAction.version);assert.deepEqual(current.evidence,originalAction.evidence);assert.equal(change.status,status);assert.equal(change.related.version,originalAction.version);
 }
 await f.restart();const claim=await f.ok(f.a.token,'/api/actions/'+update.id+'/claim','POST',{deviceId:'same-device'});assert.equal(claim.mutationAllowed,false);
});
