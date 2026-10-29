import test from 'node:test';
import assert from 'node:assert/strict';
import Fastify from 'fastify';
import {registerActions} from '../src/actions.js';
import {join} from 'node:path';
import {fixture,owner,event,command} from './fixtures/managed-calendar.js';
import type {ActionProposal} from '@mote/shared';

type Fixture=Awaited<ReturnType<typeof fixture>>;
// Keep the real ingress, extraction and current evidence fingerprints. Null
// schedule fields are a permitted model output, controlled here without a model.
async function missing(f:Fixture,changes:Partial<ActionProposal>={}){
 const original=await f.add(),value={...original,...changes,event:{...original.event,start:null,end:null,timeZone:null,...changes.event}};
 f.node.store.db.prepare('UPDATE action_proposals SET json=? WHERE id=?').run(JSON.stringify(value),value.id);return f.node.actions.get(value.id);
}
const body=(a:ActionProposal)=>({version:a.version,start:event.start,end:event.end,timeZone:event.timeZone});
const post=(f:Fixture,a:ActionProposal,input:unknown=body(a),token=owner)=>f.request('/api/actions/'+a.id+'/information',input,token);
const snapshot=(f:Fixture,id:string)=>String(f.node.store.db.prepare('SELECT json FROM action_proposals WHERE id=?').get(id)!.json);

test('missing schedule information saves once without execution, then the existing unique grant reevaluates and claims once',async t=>{
 const f=await fixture(t),a=await missing(f);await f.grant();assert.deepEqual((await f.request('/api/managed-calendar-deliveries',undefined,f.paired.token)).items,[]);
 const grants=(await f.request('/api/action-capabilities')).grants,settings=f.node.actions.settings(),saved=await post(f,a);
 assert.equal(saved.version,a.version+1);assert.equal(saved.status,'proposed');assert.equal(saved.operationId,undefined);assert.equal(saved.managed,undefined);assert.equal(saved.target,undefined);assert.deepEqual(saved.event,{...a.event,start:event.start,end:event.end,timeZone:event.timeZone});
 for(const key of ['kind','uncertainty','evidence','related','createdAt'] as const)assert.deepEqual(saved[key],a[key]);assert.deepEqual((await f.request('/api/action-capabilities')).grants,grants);assert.deepEqual(f.node.actions.settings(),settings);assert.equal(f.nativeCalls,0);
 const stored=snapshot(f,a.id);await assert.rejects(()=>post(f,a),{status:409});await assert.rejects(()=>post(f,saved),{status:409});assert.equal(snapshot(f,a.id),stored);
 const queue=await f.request('/api/managed-calendar-deliveries',undefined,f.paired.token);assert.equal(queue.items.length,1);const queued=f.node.actions.get(a.id);assert.equal(queued.status,'approved');assert.equal(queued.managed?.state,'waiting_device');assert.ok(queued.operationId);
 const beforeReplay=snapshot(f,a.id);await assert.rejects(()=>post(f,a),{status:409});assert.equal(snapshot(f,a.id),beforeReplay,'lost ACK after managed advancement cannot save or issue a second operation');assert.equal((await f.request('/api/actions/'+a.id)).operationId,queued.operationId);
 const first=await f.request('/api/managed-calendar/'+a.id+'/claim',{},f.paired.token),second=await f.request('/api/managed-calendar/'+a.id+'/claim',{},f.paired.token);assert.equal(first.mutationAllowed,true);assert.equal(second.mutationAllowed,false);assert.equal(first.operationId,second.operationId);assert.equal(f.nativeCalls,0);
});

for(const blocker of ['no-grant','uncertainty','overlap','revoked','expired'] as const)test('saving schedule facts preserves the existing '+blocker+' dispatch blocker',async t=>{
 const f=await fixture(t),uncertainty='  Generated semantic uncertainty remains unresolved.  ',a=await missing(f,blocker==='uncertainty'?{uncertainty}:{});
 if(blocker!=='no-grant'){const grant=await f.grant();if(blocker==='overlap')await f.grant();if(blocker==='revoked')await f.request('/api/action-capability-grants/'+grant.id+'/revoke',command(grant.revision));}
 const input=blocker==='expired'?{version:a.version,start:'2000-01-01T12:00:00Z',end:'2000-01-01T13:00:00Z',timeZone:'UTC'}:body(a);
 const saved=await post(f,a,input);assert.equal(saved.status,'proposed');assert.equal(saved.uncertainty,a.uncertainty);assert.equal(saved.target,undefined);assert.equal(saved.operationId,undefined);
 for(let attempt=0;attempt<2;attempt++)assert.deepEqual((await f.request('/api/managed-calendar-deliveries',undefined,f.paired.token)).items,[]);
 assert.equal(f.node.actions.get(a.id).status,'proposed');assert.equal(f.nativeCalls,0);
});

test('only null fields may be supplied, while existing non-null bytes and every non-time field remain unchanged',async t=>{
 const f=await fixture(t),a=await missing(f,{event:{...event,end:null}}),before=snapshot(f,a.id);
 for(const input of [{...body(a),start:'2099-09-18T16:00:00+01:00'},{...body(a),timeZone:'Etc/UTC'},{...body(a),version:a.version+1}])await assert.rejects(()=>post(f,a,input),{status:409});assert.equal(snapshot(f,a.id),before);
 for(const input of [{...body(a),title:'Replacement'},{...body(a),uncertainty:''},{...body(a),target:{deviceId:'other',calendarId:'other'}},{...body(a),allDay:true},{...body(a),event:{...event}}])await assert.rejects(()=>post(f,a,input),{status:400});assert.equal(snapshot(f,a.id),before);
 const saved=await post(f,a);assert.deepEqual(saved.event,{...a.event,end:event.end});assert.equal(saved.version,a.version+1);
});

test('existing complete-event validation preserves all-day dates, exclusive ends and required explicit zones',async t=>{
 const f=await fixture(t),a=await missing(f,{event:{...event,allDay:true,start:null,end:null,timeZone:null}}),before=snapshot(f,a.id);
 for(const input of [{...body(a)},{...body(a),start:'2099-02-31',end:'2099-03-01'},{...body(a),start:'2099-09-18',end:'2099-09-18'},{...body(a),start:'2099-09-18',end:'2101-09-19'},{...body(a),start:'2099-09-18',end:'2099-09-19',timeZone:null},{...body(a),start:'2099-09-18',end:'2099-09-19',timeZone:'Mars/City'}])await assert.rejects(()=>post(f,a,input),{status:400});assert.equal(snapshot(f,a.id),before);
 const saved=await post(f,a,{version:a.version,start:'2099-09-18',end:'2099-09-19',timeZone:'Asia/Shanghai'});assert.equal(saved.event.allDay,true);assert.equal(saved.event.start,'2099-09-18');assert.equal(saved.event.end,'2099-09-19');
});

test('CAS conflicts, already handled actions and non-create/update kinds cannot mutate schedule information',async t=>{
 const f=await fixture(t);
 for(const kind of ['calendar.cancel','calendar.complete'] as const){const a=await missing(f,{kind});const before=snapshot(f,a.id);await assert.rejects(()=>post(f,a),{status:409});assert.equal(snapshot(f,a.id),before);}
 const a=await missing(f);f.node.actions.dismiss(a.id,a.version);const dismissed=snapshot(f,a.id);await assert.rejects(()=>post(f,a),{status:409});assert.equal(snapshot(f,a.id),dismissed);
 const concurrent=await missing(f);const results=await Promise.allSettled([post(f,concurrent),post(f,concurrent)]);assert.equal(results.filter(value=>value.status==='fulfilled').length,1);const rejected=results.find(value=>value.status==='rejected') as PromiseRejectedResult;assert.equal(rejected.reason.status,409);assert.equal(f.node.actions.get(concurrent.id).version,concurrent.version+1);
});

test('changed evidence and changed related calendar versions keep their existing invalidation before an information edit',async t=>{
 const f=await fixture(t),a=await missing(f),record=f.node.actions.read([a.evidence[0].id])[0];await f.node.sources.upsert('generated-source',{externalId:record.provenance!.externalId,revision:'2',observedAt:'2026-01-02T00:00:00Z',title:'Changed generated original',text:'Generated replacement without the old appointment.',kind:'message',layer:'original'});
 await assert.rejects(()=>post(f,a),{status:409});assert.equal(f.node.actions.get(a.id).status,'stale');assert.equal(f.node.actions.get(a.id).event.start,null);
 const original=await f.add(),update=await f.change(original,'calendar.update'),draft={...update,event:{...update.event,start:null,end:null,timeZone:null}};f.node.store.db.prepare('UPDATE action_proposals SET json=? WHERE id=?').run(JSON.stringify(draft),draft.id);
 await f.request('/api/actions/targets',{deviceId:'generated-device',deviceName:'Generated device',calendars:[{id:'generated-calendar',title:'Generated calendar'}]});const current=f.node.actions.get(original.id);assert.equal(f.node.actions.get(draft.id).status,'proposed');await f.request('/api/actions/'+original.id+'/confirm',{version:current.version,event:current.event,target:{deviceId:'generated-device',calendarId:'generated-calendar'}});await assert.rejects(()=>post(f,draft),{status:409});assert.equal(f.node.actions.get(draft.id).status,'stale');
});

test('a native update preserves the exact relation and destination and dispatches only through its original grant',async t=>{
 const f=await fixture(t);await f.grant();const first=await f.add();await f.client().deliver();const original=f.node.actions.get(first.id),update=await f.change(original,'calendar.update'),draft={...update,event:{...update.event,start:null,end:null,timeZone:null}};f.node.store.db.prepare('UPDATE action_proposals SET json=? WHERE id=?').run(JSON.stringify(draft),draft.id);
 const saved=await post(f,draft,{version:draft.version,start:'2099-09-19T15:00:00Z',end:'2099-09-19T16:00:00Z',timeZone:'UTC'});assert.deepEqual(saved.related,draft.related);assert.equal(saved.target,draft.target);assert.equal(saved.operationId,undefined);await f.client().deliver();await f.client().deliver();const result=f.node.actions.get(saved.id);assert.equal(result.status,'succeeded');assert.equal(result.target!.deviceId,original.target!.deviceId);assert.equal(result.target!.calendarId,original.target!.calendarId);assert.equal(result.externalId,original.externalId);assert.equal(f.nativeCalls,2);assert.equal(f.nativeChanges.length,1);
});

test('grant withdrawal after the save prevents a new claim and replay never revives its authority',async t=>{
 const f=await fixture(t),a=await missing(f),grant=await f.grant();await post(f,a);await f.request('/api/managed-calendar-deliveries',undefined,f.paired.token);const queued=f.node.actions.get(a.id);
 await f.request('/api/action-capability-grants/'+grant.id+'/revoke',command(grant.revision));await assert.rejects(()=>f.request('/api/managed-calendar/'+a.id+'/claim',{},f.paired.token),{status:403});await assert.rejects(()=>post(f,a),{status:409});assert.equal(f.node.actions.get(a.id).operationId,queued.operationId);assert.equal(f.nativeCalls,0);
});

test('a synthetic fixed proposal target is retained and only its exact authorized destination may adopt the completed information',async t=>{
 const f=await fixture(t);await f.grant();
 // Current extraction does not emit proposed.target. These defensive stored
 // states test preservation, rather than claim an observed production failure.
 for(const target of [{deviceId:'generated-device',calendarId:'generated-other-calendar'},{deviceId:'generated-other-device',calendarId:'generated-calendar'},{deviceId:'generated-device',calendarId:'generated-calendar'}]){
  const a=await missing(f,{target}),saved=await post(f,a);assert.deepEqual(saved.target,target);await f.request('/api/managed-calendar-deliveries',undefined,f.paired.token);const current=f.node.actions.get(a.id);assert.deepEqual(current.target,target);
  const matches=target.deviceId==='generated-device'&&target.calendarId==='generated-calendar';assert.equal(current.status,matches?'approved':'proposed');assert.equal(current.managed?.state,matches?'waiting_device':undefined);assert.equal(!!current.operationId,matches);
 }
 assert.equal(f.nativeCalls,0);
});

test('a synthetic proposal target conflicting with its current native relation remains pending after the information save',async t=>{
 const f=await fixture(t);await f.grant();const first=await f.add();await f.client().deliver();const original=f.node.actions.get(first.id),update=await f.change(original,'calendar.update');
 const draft={...update,target:{deviceId:'generated-device',calendarId:'generated-other-calendar'},event:{...update.event,start:null,end:null,timeZone:null}};f.node.store.db.prepare('UPDATE action_proposals SET json=? WHERE id=?').run(JSON.stringify(draft),draft.id);
 const saved=await post(f,draft);assert.deepEqual(saved.target,draft.target);assert.deepEqual(saved.related,draft.related);await f.client().deliver();const current=f.node.actions.get(draft.id);assert.equal(current.status,'proposed');assert.deepEqual(current.target,draft.target);assert.deepEqual(current.related,draft.related);assert.equal(current.operationId,undefined);assert.equal(current.managed,undefined);assert.equal(f.nativeCalls,1);assert.equal(f.nativeChanges.length,0);
});

test('paired owner devices retain the existing owner contract while collector, readonly and revoked HTTP identities cannot write',async t=>{
 const f=await fixture(t),a=await missing(f),session=await f.node.connections.session('https://generated.invalid','Generated owner review',{deviceId:'generated-review-A',deviceName:'Generated review A',platform:'macos'});
 // buildApp intentionally filters every scope=owner identity before this router.
 const settings=f.node.actions.settings(),saved=await post(f,a,body(a),session.token);assert.equal(saved.version,a.version+1);assert.equal(saved.target,undefined);assert.deepEqual(f.node.actions.settings(),settings);
 const fixed=await missing(f,{target:{deviceId:'generated-device',calendarId:'generated-calendar'}}),updated=await post(f,fixed,body(fixed),session.token);assert.deepEqual(updated.target,fixed.target);assert.equal(updated.operationId,undefined);
 const blocked=await missing(f);await assert.rejects(()=>post(f,blocked,body(blocked),f.paired.token),{status:403},'the full application collector route allowlist is unchanged');
 const mcp=await f.node.connections.mintMcp({serverUrl:'https://generated.invalid',label:'Generated query readonly',access:'read'},{directory:join(f.node.store.directory,'generated-mcp'),mcpEnabled:true});const readToken=mcp.config.mcpServers.mote.headers.Authorization.slice(7);await assert.rejects(()=>post(f,blocked,body(blocked),readToken),{status:403});
 await f.node.connections.revoke(session.credentialId);await assert.rejects(()=>post(f,blocked,body(blocked),session.token),{status:401});assert.equal(f.node.actions.get(blocked.id).version,blocked.version);
});

test('the registered review router preserves explicit non-owner authorization and own-device checks for target and relation',async t=>{
 const f=await fixture(t),app=Fastify();t.after(()=>app.close());app.setErrorHandler((error,_req,reply)=>reply.code(error.name==='ZodError'?400:(error as {statusCode?:number}).statusCode??500).send({error:error.message}));
 // Module HTTP contract uses real redeemed non-owner credentials. buildApp's
 // stricter collector allowlist remains covered separately above and unchanged.
 app.addHook('onRequest',async(req,reply)=>{if(req.headers.authorization==='Bearer '+owner)return;const c=f.node.connections.authenticate(req.headers.authorization);if(!c)return reply.code(401).send({error:'unauthorized'});f.node.connections.assertActive(c);});
 registerActions(app,f.node.actions,f.node.connections,req=>{const c=f.node.connections.authenticate(req.headers.authorization);return c&&!f.node.connections.isOwner(c)?c:undefined;});
 const origin=await app.listen({host:'127.0.0.1',port:0});const request=async(a:ActionProposal,token:string)=>{const response=await fetch(origin+'/api/actions/'+a.id+'/information',{method:'POST',headers:{authorization:'Bearer '+token,'content-type':'application/json'},body:JSON.stringify(body(a))});const value=await response.json();if(!response.ok)throw Object.assign(Error(JSON.stringify(value)),{status:response.status});return value;};
 const a=await missing(f);await assert.rejects(()=>request(a,f.paired.token),{status:403});
 const invitation=await f.request('/api/connections/collector-invitations',{serverUrl:'https://generated.invalid',label:'Generated other reviewer'}),other=await f.request('/api/connections/redeem',{code:invitation.invitation.code,deviceId:'generated-review-B',deviceName:'Generated reviewer B',platform:'macos'});
 const settings=await f.request('/api/actions');await f.request('/api/actions/settings',{revision:settings.revision,authorizationRevision:settings.authorizationRevision,settings:{...settings.settings,reviewDeviceIds:['generated-device','generated-review-B']}},owner,'PUT');
 const fixed=await missing(f,{target:{deviceId:'generated-review-B',calendarId:'generated-B'}});await assert.rejects(()=>request(fixed,f.paired.token),{status:403});assert.equal(f.node.actions.get(fixed.id).version,fixed.version);const saved=await request(fixed,other.token);assert.deepEqual(saved.target,fixed.target);assert.equal(saved.operationId,undefined);
 await f.grant();const first=await f.add();await f.client().deliver();const original=f.node.actions.get(first.id),update=await f.change(original,'calendar.update'),draft={...update,event:{...update.event,start:null,end:null,timeZone:null}};f.node.store.db.prepare('UPDATE action_proposals SET json=? WHERE id=?').run(JSON.stringify(draft),draft.id);
 await assert.rejects(()=>request(draft,other.token),{status:403});const allowed=await request(draft,f.paired.token);assert.deepEqual(allowed.related,draft.related);assert.equal(allowed.target,undefined);
 const current=await f.request('/api/actions');await f.request('/api/actions/settings',{revision:current.revision,authorizationRevision:current.authorizationRevision,settings:{...current.settings,reviewDeviceIds:[]}},owner,'PUT');const revoked=await missing(f);await assert.rejects(()=>request(revoked,f.paired.token),{status:403});assert.equal(f.node.actions.get(revoked.id).version,revoked.version);
});

test('an actual SQLite write failure rolls back the single information version and permits only an explicit retry',async t=>{
 const f=await fixture(t),a=await missing(f),before=snapshot(f,a.id),trigger='generated_information_'+a.id.replaceAll('-','');f.node.store.db.exec(`CREATE TRIGGER ${trigger} AFTER UPDATE OF json ON action_proposals WHEN NEW.id='${a.id}' BEGIN SELECT RAISE(ABORT,'generated_information_failure'); END`);
 await assert.rejects(()=>post(f,a),{status:500});assert.equal(snapshot(f,a.id),before);assert.equal(f.node.store.db.isTransaction,false);f.node.store.db.exec('DROP TRIGGER '+trigger);const saved=await post(f,a);assert.equal(saved.version,a.version+1);assert.equal(saved.operationId,undefined);assert.equal(f.nativeCalls,0);
});
