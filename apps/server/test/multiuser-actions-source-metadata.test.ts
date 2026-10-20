import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {modelFixture} from './fixtures/scoped-actions.js';
import {source,waitForState} from './fixtures/scoped-query-accounts.js';

const target={deviceId:'same-device',calendarId:'same-calendar'};
async function proposals(t:Parameters<typeof modelFixture>[0]){
 const f=await modelFixture(t);
 await f.ingest(f.a,'A','pending-item');await f.ingest(f.a,'A','approved-item');await f.enable(f.a);
 await f.ok(f.a.token,'/api/actions/targets','POST',{deviceId:'same-device',deviceName:'Generated A',calendars:[{id:'same-calendar',title:'Generated A'}]});
 const page=await waitForState(()=>f.ok(f.a.token,'/api/actions'),value=>value.items.length===2,'two generated calendar proposals'),[pending,proposal]=page.items;
 const input={version:pending.version,event:pending.event,target},review=await f.ok(f.a.token,'/api/actions/'+pending.id+'/review','POST',input),approved=await f.ok(f.a.token,'/api/actions/'+proposal.id+'/confirm','POST',{version:proposal.version,event:proposal.event,target});
 return {...f,get node(){return f.node;},pending,review,approved};
}
function sourceEpoch(f:Awaited<ReturnType<typeof modelFixture>>,userId:string){return f.read(db=>String(db.prepare('SELECT epoch FROM ac_sources WHERE user_id=? AND id=?').get(userId,'same-source')!.epoch));}

test('renaming or saving unchanged source metadata preserves pending reviews and approved delivery across host restart',async t=>{
 const f=await proposals(t),aEpoch=sourceEpoch(f,f.a.userId),bEpoch=sourceEpoch(f,f.b.userId),beforeB=await f.ok(f.b.token,'/api/sources/same-source');
 for(const patch of [{name:'Generated renamed source'},{},{name:'Generated renamed source',enabled:true,retention:'snapshot',ownerRelation:null}] as const){
  await f.ok(f.a.token,'/api/sources/same-source','PATCH',patch);
  assert.equal(sourceEpoch(f,f.a.userId),aEpoch);assert.equal(sourceEpoch(f,f.b.userId),bEpoch);
  const page=await f.ok(f.a.token,'/api/actions');
  assert.equal(page.items.find((a:any)=>a.id===f.pending.id).status,'proposed');assert.equal(page.items.find((a:any)=>a.id===f.approved.id).status,'approved');
  assert.deepEqual((await f.ok(f.a.token,'/api/actions/'+f.pending.id+'/reviews/'+f.review.id)).reviewedAction,f.review.reviewedAction);
 }
 const reply=await f.ok(f.a.token,'/api/owner-questions/'+f.review.id+'/reply','POST',{requestId:randomUUID(),expectedRevision:f.review.revision,action:'answer',choiceId:'approve'});assert.equal(reply.state,'closed');
 await f.restart();assert.equal(sourceEpoch(f,f.a.userId),aEpoch);assert.deepEqual(await f.ok(f.b.token,'/api/sources/same-source'),beforeB);
 await f.ok(f.a.token,'/api/sources/same-source','PATCH',{name:'Generated renamed after approval'});
 for(const action of [f.pending,f.approved]){
  const claim=await f.ok(f.a.token,'/api/actions/'+action.id+'/claim','POST',{deviceId:'same-device'});assert.equal(claim.mutationAllowed,true);
  if(action.id===f.approved.id){
   await f.ok(f.a.token,'/api/actions/'+action.id+'/receipt','POST',{deviceId:'same-device',operationId:claim.operationId,status:'uncertain'});
   await f.restart();await f.ok(f.a.token,'/api/sources/same-source','PATCH',{name:'Generated rename with unknown external result'});
   const recovered=await f.ok(f.a.token,'/api/actions/'+action.id+'/claim','POST',{deviceId:'same-device'});assert.equal(recovered.mutationAllowed,false);assert.equal(recovered.status,'uncertain');assert.equal(recovered.operationId,claim.operationId);
  }
  const receipt={deviceId:'same-device',operationId:claim.operationId,status:'succeeded',externalId:'generated-event-'+action.id};
  assert.deepEqual(await f.ok(f.a.token,'/api/actions/'+action.id+'/receipt','POST',receipt),{acknowledged:true,published:true});
  assert.deepEqual(await f.ok(f.a.token,'/api/actions/'+action.id+'/receipt','POST',receipt),{acknowledged:true,published:true});
 }
 assert.equal(f.read(db=>Number(db.prepare('SELECT count(*) n FROM task_external_calls WHERE user_id=?').get(f.a.userId)!.n)),2,'renames and unknown-result recovery cannot issue another external write');
 assert.equal(sourceEpoch(f,f.b.userId),bEpoch);assert.equal((await f.ok(f.b.token,'/api/actions')).items.length,0);
});

for(const control of ['disable-reenable','owner-relation','source-context','delete-recreate'] as const)test('source '+control+' still invalidates existing reviews and approvals without affecting another owner',async t=>{
 const f=await proposals(t),aEpoch=sourceEpoch(f,f.a.userId),bEpoch=sourceEpoch(f,f.b.userId),beforeB=await f.ok(f.b.token,'/api/sources/same-source');
 if(control==='disable-reenable'){await f.ok(f.a.token,'/api/sources/same-source','PATCH',{enabled:false});assert.notEqual(sourceEpoch(f,f.a.userId),aEpoch);assert.equal((await f.request(f.a.token,'/api/actions/'+f.approved.id+'/claim','POST',{deviceId:'same-device'})).statusCode,404);await f.ok(f.a.token,'/api/sources/same-source','PATCH',{enabled:true});}
 if(control==='owner-relation')await f.ok(f.a.token,'/api/sources/same-source','PATCH',{ownerRelation:'third_party'});
 if(control==='source-context')await f.ok(f.a.token,'/api/sources/same-source/context','PATCH',{expectedVersion:0,description:'Generated source attribution has changed'});
 if(control==='delete-recreate'){
  await f.ok(f.a.token,'/api/sources/same-source','DELETE');
  assert.equal(f.read(db=>Number(db.prepare('SELECT count(*) n FROM ac_sources WHERE user_id=? AND id=?').get(f.a.userId,'same-source')!.n)),0);
  assert.deepEqual(f.read(db=>db.prepare('SELECT proof,json FROM ac_proposals WHERE user_id=?').all(f.a.userId)).map(row=>JSON.parse(String(row.json)).evidence),[[],[]],'source deletion scrubs both suggestions immediately');
  await f.ok(f.a.token,'/api/ingress/sources','POST',source());
 }
 assert.notEqual(sourceEpoch(f,f.a.userId),aEpoch);
 assert.equal((await f.request(f.a.token,'/api/owner-questions/'+f.review.id+'/reply','POST',{requestId:randomUUID(),expectedRevision:f.review.revision,action:'answer',choiceId:'approve'})).statusCode,control==='delete-recreate'?404:409);
 assert.equal((await f.request(f.a.token,'/api/actions/'+f.approved.id+'/claim','POST',{deviceId:'same-device'})).statusCode,404);
 const page=await f.ok(f.a.token,'/api/actions');assert.ok(page.items.every((a:any)=>a.status==='stale'));assert.ok(page.items.every((a:any)=>a.evidence.length===0));
 assert.equal(f.read(db=>Number(db.prepare('SELECT count(*) n FROM task_external_calls WHERE user_id=?').get(f.a.userId)!.n)),0);
 assert.equal(sourceEpoch(f,f.b.userId),bEpoch);assert.deepEqual(await f.ok(f.b.token,'/api/sources/same-source'),beforeB);
});
