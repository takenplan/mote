import test from 'node:test';
import assert from 'node:assert/strict';
import {modelFixture,event} from './fixtures/scoped-actions.js';
import {source,waitForState} from './fixtures/scoped-query-accounts.js';
import {writeMessagesResponse} from '../../../scripts/fixtures/messages-provider.js';
const nativeCalls=(f:Awaited<ReturnType<typeof modelFixture>>)=>f.read(db=>db.prepare("SELECT c.*,o.id operation_id FROM task_external_calls c JOIN ac_operations o ON o.user_id=c.user_id AND o.task_id=c.task_id JOIN execution_steps e ON e.user_id=c.user_id AND e.id=c.task_id WHERE o.user_id=? AND e.kind='actions.delivery' ORDER BY c.issuance_id").all(f.a.userId));

for(const kind of ['calendar.update','calendar.cancel','calendar.complete'] as const)test('real model '+kind+' pins the native original and preserves its successful receipt',async t=>{
 const f=await modelFixture(t),target={deviceId:'same-device',calendarId:'same-calendar'};
 await f.ingest(f.a,'A');await f.enable(f.a);await f.ok(f.a.token,'/api/actions/targets','POST',{deviceId:'same-device',deviceName:'Generated A',calendars:[{id:'same-calendar',title:'Generated'}]});
 const proposed=(await f.proposal(f.a)).items[0],original=await f.ok(f.a.token,'/api/actions/'+proposed.id+'/confirm','POST',{version:proposed.version,event:proposed.event,target});
 await f.ok(f.a.token,'/api/actions/'+original.id+'/claim','POST',{deviceId:'same-device'});await f.ok(f.a.token,'/api/actions/'+original.id+'/receipt','POST',{deviceId:'same-device',operationId:original.operationId,status:'succeeded',externalId:'generated-original-native'});const nativeBefore=nativeCalls(f);assert.equal(nativeBefore.length,1);assert.equal(nativeBefore[0].operation_id,original.operationId);assert.equal(nativeBefore[0].request_key,'calendar-operation:'+original.operationId);assert.equal(nativeBefore[0].state,'succeeded');
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
 if(kind==='calendar.complete'){assert.equal(approved.status,'succeeded');assert.equal((await f.request(f.a.token,'/api/actions/'+change.id+'/claim','POST',{deviceId:'same-device'})).statusCode,409);assert.deepEqual(nativeCalls(f),nativeBefore,'Completion preserves the exact original native fact without another issuance');const operation=f.read(db=>db.prepare('SELECT task_id,issuance_id,claimed,ack FROM ac_operations WHERE user_id=? AND id=?').get(f.a.userId,approved.operationId));assert.deepEqual({...operation},{task_id:null,issuance_id:null,claimed:0,ack:null});}
 else{await f.ok(f.a.token,'/api/actions/'+change.id+'/claim','POST',{deviceId:'same-device'});assert.equal((await f.request(f.a.token,'/api/actions/'+change.id+'/receipt','POST',{deviceId:'same-device',operationId:approved.operationId,status:'succeeded',externalId:'wrong-native'})).statusCode,409);await f.ok(f.a.token,'/api/actions/'+change.id+'/receipt','POST',{deviceId:'same-device',operationId:approved.operationId,status:'succeeded',externalId:'generated-original-native'});}
 const final=await f.ok(f.a.token,'/api/actions'),done=final.items.find((a:any)=>a.id===change.id),changed=final.items.find((a:any)=>a.id===original.id);assert.equal(done.status,'succeeded');
 if(kind==='calendar.update'){assert.equal(changed.event.title,'Generated edited appointment');assert.equal(changed.externalId,'generated-original-native');}else assert.equal(changed.resolution,kind==='calendar.cancel'?'cancelled':'completed');
});
