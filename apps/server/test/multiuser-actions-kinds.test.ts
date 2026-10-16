import test from 'node:test';
import assert from 'node:assert/strict';
import {modelFixture,event} from './fixtures/scoped-actions.js';
import {source,waitForState} from './fixtures/scoped-query-accounts.js';
import {writeMessagesResponse} from '../../../scripts/fixtures/messages-provider.js';

for(const kind of ['calendar.update','calendar.cancel','calendar.complete'] as const)test('real model '+kind+' pins the native original and preserves its successful receipt',async t=>{
 const f=await modelFixture(t),target={deviceId:'same-device',calendarId:'same-calendar'};
 await f.ingest(f.a,'A');await f.enable(f.a);await f.ok(f.a.token,'/api/actions/targets','POST',{deviceId:'same-device',deviceName:'Generated A',calendars:[{id:'same-calendar',title:'Generated'}]});
 const proposed=(await f.proposal(f.a)).items[0],original=await f.ok(f.a.token,'/api/actions/'+proposed.id+'/confirm','POST',{version:proposed.version,event:proposed.event,target});
 await f.ok(f.a.token,'/api/actions/'+original.id+'/claim','POST',{deviceId:'same-device'});await f.ok(f.a.token,'/api/actions/'+original.id+'/receipt','POST',{deviceId:'same-device',operationId:original.operationId,status:'succeeded',externalId:'generated-original-native'});
 f.scripts.set('A',(body,_raw,res)=>{const envelope=JSON.parse(typeof body.messages[0].content==='string'?body.messages[0].content:body.messages[0].content[0].text),id=envelope.untrustedEvidence[0].id,uses=body.messages.flatMap((message:any)=>Array.isArray(message.content)?message.content.filter((part:any)=>part.type==='tool_use'):[]),stage=uses.length+1;
  if(!uses.some((use:any)=>use.name==='action_catalog'))return writeMessagesResponse(res,{stage,tool:{name:'action_catalog',args:{id:original.id,limit:1}}});
  if(!uses.some((use:any)=>use.name==='evidence'))return writeMessagesResponse(res,{stage,tool:{name:'evidence',args:{ids:[id]}}});
  writeMessagesResponse(res,{stage,text:JSON.stringify({answer:JSON.stringify({actions:[{kind,event:{...event,title:'Generated edited appointment',start:'2099-02-02T09:00:00Z',end:'2099-02-02T10:00:00Z'},uncertainty:'Generated change',sameAs:original.id,evidence:[{id,quote:'GENERATED_A_PRIVATE_APPOINTMENT'}]}]}),citationIds:[id]})});
 });
 await f.ok(f.a.token,'/api/ingress/sources','POST',source('change-source'));await f.ingest(f.a,'A','same-item','change-source');await f.ok(f.a.token,'/api/actions/retry','POST',{});
 const page=await waitForState(()=>f.ok(f.a.token,'/api/actions'),value=>value.items.some((a:any)=>a.kind===kind),'actual model change proposal'),change=page.items.find((a:any)=>a.kind===kind);assert.equal(change.related.actionId,original.id);assert.equal(change.related.externalId,'generated-original-native');assert.equal(change.evidence.length,2);
 if(kind!=='calendar.update')assert.deepEqual(change.event,proposed.event);
 assert.equal((await f.request(f.a.token,'/api/actions/'+change.id+'/confirm','POST',{version:change.version,event:change.event,target:{...target,calendarId:'wrong-target'}})).statusCode,409);
 const approved=await f.ok(f.a.token,'/api/actions/'+change.id+'/confirm','POST',{version:change.version,event:change.event,target});
 if(kind==='calendar.complete'){assert.equal(approved.status,'succeeded');assert.equal((await f.request(f.a.token,'/api/actions/'+change.id+'/claim','POST',{deviceId:'same-device'})).statusCode,409);assert.equal(f.read(db=>Number(db.prepare('SELECT count(*) n FROM task_external_calls WHERE user_id=?').get(f.a.userId)!.n)),1);}
 else{await f.ok(f.a.token,'/api/actions/'+change.id+'/claim','POST',{deviceId:'same-device'});assert.equal((await f.request(f.a.token,'/api/actions/'+change.id+'/receipt','POST',{deviceId:'same-device',operationId:approved.operationId,status:'succeeded',externalId:'wrong-native'})).statusCode,409);await f.ok(f.a.token,'/api/actions/'+change.id+'/receipt','POST',{deviceId:'same-device',operationId:approved.operationId,status:'succeeded',externalId:'generated-original-native'});}
 const final=await f.ok(f.a.token,'/api/actions'),done=final.items.find((a:any)=>a.id===change.id),changed=final.items.find((a:any)=>a.id===original.id);assert.equal(done.status,'succeeded');
 if(kind==='calendar.update'){assert.equal(changed.event.title,'Generated edited appointment');assert.equal(changed.externalId,'generated-original-native');}else assert.equal(changed.resolution,kind==='calendar.cancel'?'cancelled':'completed');
});
