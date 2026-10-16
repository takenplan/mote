import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {fixture,modelFixture} from './fixtures/scoped-actions.js';

test('actual accounts HTTP todo IDs, create receipts, CAS and signed pages are private across restart',async t=>{
 const f=await fixture(t),id=randomUUID(),input={id,title:'Generated A task'};
 const created=await f.request(f.a.token,'/api/todos','POST',input);
 assert.equal(created.statusCode,201,created.body);
 const first=created.json();assert.equal(first.dueAt,null);assert.equal(first.version,1);
 assert.deepEqual((await f.request(f.a.token,'/api/todos','POST',input)).json(),first);
 assert.equal((await f.request(f.a.token,'/api/todos','POST',{...input,title:'conflicting'})).statusCode,409);
 assert.equal((await f.request(f.b.token,'/api/todos/'+id,'PATCH',{version:1,status:'completed'})).statusCode,404);
 assert.equal((await f.request(f.b.token,'/api/todos','POST',{id,title:'Generated B task'})).statusCode,201);
 await f.ok(f.a.token,'/api/todos/'+id,'PATCH',{version:1,status:'completed'});
 assert.equal((await f.request(f.a.token,'/api/todos/'+id,'PATCH',{version:1,status:'cancelled'})).statusCode,409);
 for(let i=0;i<3;i++)assert.equal((await f.request(f.a.token,'/api/todos','POST',{title:'Generated A '+i})).statusCode,201);
 const page=await f.ok(f.a.token,'/api/todos?limit=1');assert.ok(page.nextCursor);
 assert.equal((await f.request(f.b.token,'/api/todos?limit=1&cursor='+encodeURIComponent(page.nextCursor))).statusCode,400);
 assert.equal((await f.request(f.a.token,'/api/todos','POST',{title:'forged',ownerId:f.b.userId})).statusCode,401);
 await f.restart();
 assert.equal((await f.ok(f.b.token,'/api/todos')).items[0].title,'Generated B task');
 assert.equal((await f.ok(f.a.token,'/api/todos?status=completed')).items[0].id,id);
 assert.deepEqual((await f.request(f.a.token,'/api/todos','POST',input)).json(),{...first,version:2,status:'completed',updatedAt:(await f.ok(f.a.token,'/api/todos?status=completed')).items[0].updatedAt});
});

test('real Harness proposes only owner evidence and interleaved OwnerQuestions approvals pin exact payloads',async t=>{
 const f=await modelFixture(t);
 for(const [user,label] of [[f.a,'A'],[f.b,'B']] as const){await f.ingest(user,label);await f.enable(user);await f.ok(user.token,'/api/actions/targets','POST',{deviceId:'same-device',deviceName:'Generated '+label,calendars:[{id:'same-calendar',title:'Generated '+label,accountId:'same-account'}]});}
 const [ap,bp]=await Promise.all([f.proposal(f.a),f.proposal(f.b)]),a=ap.items[0],b=bp.items[0];
 assert.equal(a.status,'proposed');assert.equal(b.status,'proposed');assert.ok(a.evidence[0].quote.includes('_A_'));assert.ok(b.evidence[0].quote.includes('_B_'));
 const target={deviceId:'same-device',calendarId:'same-calendar'},review=await f.ok(f.a.token,'/api/actions/'+a.id+'/review','POST',{version:a.version,event:a.event,target});
 assert.equal((await f.request(f.b.token,'/api/owner-questions/'+review.id+'/reply','POST',{requestId:randomUUID(),expectedRevision:review.revision,action:'answer',choiceId:'approve'})).statusCode,404);
 await f.ok(f.b.token,'/api/actions/'+b.id+'/confirm','POST',{version:b.version,event:b.event,target});
 const reply={requestId:randomUUID(),expectedRevision:review.revision,action:'answer',choiceId:'approve'};
 const approved=await f.ok(f.a.token,'/api/owner-questions/'+review.id+'/reply','POST',reply);assert.equal(approved.state,'closed');
 assert.deepEqual(await f.ok(f.a.token,'/api/owner-questions/'+review.id+'/reply','POST',reply),approved);
 assert.equal((await f.ok(f.a.token,'/api/actions')).items[0].status,'approved');
 for(const request of f.requests){assert.ok(!request.raw.includes(request.owner==='A'?'GENERATED_B_PRIVATE':'GENERATED_A_PRIVATE'));assert.ok(!JSON.stringify(request.body.tools).includes('calendar_create'));}
});

test('actual calendar production adapter reconciles a lost local ledger and duplicate receipt without another mutation',async t=>{
 const f=await modelFixture(t);await f.ingest(f.a,'A');await f.enable(f.a);
 const {CalendarActions}=await import('../../desktop/src/calendar-actions.js'),ledger=new Map<string,string>(),external=new Map<string,string>();let mutations=0;
 const adapter=()=>new CalendarActions({deviceId:'same-device',deviceName:'Generated A'},{request:(path,body)=>f.ok(f.a.token,path,body?'POST':'GET',body),read:async key=>ledger.get(key),write:async(key,value)=>{ledger.set(key,value);},native:async(command,input:any)=>{if(command==='calendar-permission')return {permission:'granted',calendars:[{id:'same-calendar',title:'Generated A',writable:true}]};assert.equal(command,'calendar-create');if(external.has(input.id))return {externalId:external.get(input.id)};if(!input.createAllowed)throw Error('Unknown outcome: reconcile only');mutations++;const id='generated-native-event';external.set(input.id,id);return {externalId:id};}});
 await adapter().connect();const proposal=(await f.proposal(f.a)).items[0],target={deviceId:'same-device',calendarId:'same-calendar'},approved=await f.ok(f.a.token,'/api/actions/'+proposal.id+'/confirm','POST',{version:proposal.version,event:proposal.event,target});
 assert.equal((await f.request(f.b.token,'/api/actions/'+proposal.id+'/claim','POST',{deviceId:'same-device'})).statusCode,404);
 const claim=await f.request(f.a.token,'/api/actions/'+proposal.id+'/claim','POST',{deviceId:'same-device'});assert.equal(claim.statusCode,200,claim.body+JSON.stringify(await f.ok(f.a.token,'/api/tasks')));assert.equal(claim.json().mutationAllowed,true);
 external.set(proposal.id,'generated-native-event');mutations++;ledger.clear();
 const repeated=await f.ok(f.a.token,'/api/actions/'+proposal.id+'/claim','POST',{deviceId:'same-device'});assert.equal(repeated.mutationAllowed,false);
 assert.equal((await f.request(f.a.token,'/api/actions/'+proposal.id+'/receipt','POST',{deviceId:'same-device',operationId:randomUUID(),status:'succeeded',externalId:'generated-native-event'})).statusCode,403);
 await adapter().execute(proposal.id);assert.equal(mutations,1);
 const completed=(await f.ok(f.a.token,'/api/actions')).items[0];assert.equal(completed.status,'succeeded');assert.equal(completed.operationId,approved.operationId);
 await f.restart();await adapter().execute(proposal.id);assert.equal(mutations,1);
});

test('actual Actions settings and equal device/calendar targets are owner bound and grants stay separate',async t=>{
 const f=await fixture(t);
 const before=await f.request(f.a.token,'/api/actions');assert.equal(before.statusCode,200,before.body);
 const a=before.json();assert.equal(a.settings.enabled,false);
 const settings={enabled:false,timeZone:'UTC',reviewDeviceIds:['same-device']};
 await f.ok(f.a.token,'/api/actions/settings','PUT',{revision:a.revision,authorizationRevision:a.authorizationRevision,settings});
 for(const [user,label] of [[f.a,'A'],[f.b,'B']] as const)await f.ok(user.token,'/api/actions/targets','POST',{deviceId:'same-device',deviceName:'Generated '+label,calendars:[{id:'same-calendar',title:'Generated '+label}]});
 const av=await f.ok(f.a.token,'/api/actions'),bv=await f.ok(f.b.token,'/api/actions');
 assert.deepEqual(av.settings.reviewDeviceIds,['same-device']);assert.deepEqual(bv.settings.reviewDeviceIds,[]);
 assert.equal(av.targets[0].deviceName,'Generated A');assert.equal(bv.targets[0].deviceName,'Generated B');
 assert.equal((await f.request(f.a.token,'/api/actions/targets','POST',{ownerId:f.b.userId,deviceId:'same-device',deviceName:'forged',calendars:[]})).statusCode,401);
 await f.restart();assert.equal((await f.ok(f.a.token,'/api/actions')).settings.timeZone,'UTC');
});

test('explicit owned todo restore after domain deletion preserves create receipts and leaves B unchanged',async t=>{
 const f=await fixture(t),id=randomUUID(),input={id,title:'Generated restored A'};assert.equal((await f.request(f.a.token,'/api/todos','POST',input)).statusCode,201);assert.equal((await f.request(f.b.token,'/api/todos','POST',{id,title:'Generated B'})).statusCode,201);
 const context=await f.node.authority.authenticate(f.a.token),services=f.node.services.forUser(context),archive=await services.exportUser('todos'),before=await f.ok(f.b.token,'/api/todos');
 await services.deleteUser('todos','generated-delete');assert.equal((await f.request(f.a.token,'/api/todos')).statusCode,503);
 await services.restoreUser('todos',archive,'generated-restore');await services.restoreUser('todos',archive,'generated-restore');
 assert.equal((await f.ok(f.a.token,'/api/todos')).items[0].title,input.title);assert.equal((await f.request(f.a.token,'/api/todos','POST',input)).json().id,id);assert.deepEqual(await f.ok(f.b.token,'/api/todos'),before);
});
