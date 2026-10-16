import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {modelFixture} from './fixtures/scoped-actions.js';
import {waitForState} from './fixtures/scoped-query-accounts.js';

const privateTables=['ac_proposals','ac_operations','ac_sources','ac_dependencies','ac_restore','ac_targets','ac_jobs'];
async function issued(t:Parameters<typeof modelFixture>[0]){
 const f=await modelFixture(t);await f.ingest(f.a,'A');await f.enable(f.a);await f.ok(f.a.token,'/api/actions/targets','POST',{deviceId:'same-device',deviceName:'GENERATED_PRIVATE_DEVICE_NAME',calendars:[{id:'same-calendar',title:'GENERATED_PRIVATE_CALENDAR',accountId:'GENERATED_PRIVATE_ACCOUNT'}]});const a=(await f.proposal(f.a)).items[0],approved=await f.ok(f.a.token,'/api/actions/'+a.id+'/confirm','POST',{version:a.version,event:a.event,target:{deviceId:'same-device',calendarId:'same-calendar'}});await f.ok(f.a.token,'/api/actions/'+a.id+'/claim','POST',{deviceId:'same-device'});const context=await f.node.authority.authenticate(f.a.token),callback=f.node.actions!.delivery.bindReceipt(context,a.id,'same-device',approved.operationId);return {...f,get node(){return f.node;},context,action:approved,callback};
}

test('an actual uncertain calendar receipt remains unknown during domain deletion and only an exact successful ACK settles it',async t=>{
 const f=await issued(t),id=randomUUID();await f.ok(f.a.token,'/api/actions/'+f.action.id+'/receipt','POST',{deviceId:'same-device',operationId:f.action.operationId,status:'uncertain'});
 const beforeB=f.read(db=>privateTables.map(table=>db.prepare('SELECT * FROM '+table+' WHERE user_id=?').all(f.b.userId))),receipt=await f.node.services.forUser(f.context).deleteUser('actions',id);assert.equal(receipt.status,'result_unknown');
 const retained=f.read(db=>({state:db.prepare('SELECT * FROM ac_state WHERE user_id=?').get(f.a.userId),rows:privateTables.map(table=>db.prepare('SELECT * FROM '+table+' WHERE user_id=?').all(f.a.userId))}));assert.ok(!JSON.stringify(retained).includes('GENERATED_PRIVATE'));assert.ok(!JSON.stringify(retained).includes('GENERATED_A_PRIVATE_APPOINTMENT'));for(const table of ['ac_sources','ac_dependencies','ac_restore','ac_targets','ac_jobs'])assert.equal(f.read(db=>Number(db.prepare('SELECT count(*) n FROM '+table+' WHERE user_id=?').get(f.a.userId)!.n)),0);
 assert.deepEqual(await f.callback({operationId:f.action.operationId,status:'succeeded',externalId:'generated-known-event'}),{acknowledged:true,published:false});assert.equal((await f.node.services.forUser(f.context).deleteUser('actions',id)).status,'complete');for(const table of privateTables)assert.equal(f.read(db=>Number(db.prepare('SELECT count(*) n FROM '+table+' WHERE user_id=?').get(f.a.userId)!.n)),0);assert.deepEqual(f.read(db=>privateTables.map(table=>db.prepare('SELECT * FROM '+table+' WHERE user_id=?').all(f.b.userId))),beforeB);
});

test('a settled Actions domain erases private metadata and retains only an inactive authorization tombstone',async t=>{
 const f=await issued(t);await f.callback({operationId:f.action.operationId,status:'succeeded',externalId:'generated-known-event'});assert.equal((await f.node.services.forUser(f.context).deleteUser('actions',randomUUID())).status,'complete');
 for(const table of privateTables)assert.equal(f.read(db=>Number(db.prepare('SELECT count(*) n FROM '+table+' WHERE user_id=?').get(f.a.userId)!.n)),0,table);const state=f.read(db=>db.prepare('SELECT * FROM ac_state WHERE user_id=?').get(f.a.userId)!);assert.equal(state.deleted,1);assert.equal(JSON.parse(String(state.settings)).enabled,false);assert.equal(state.policy_id,null);assert.equal(state.policy_task,null);assert.equal(state.review_devices,'[]');
});

test('actual M16 account deletion waits for the issued calendar fact then physically removes both Actions and todos',async t=>{
 const f=await issued(t),todoId=randomUUID();for(const [user,label] of [[f.a,'A'],[f.b,'B']] as const){const response=await f.request(user.token,'/api/todos','POST',{id:todoId,title:'GENERATED_TODO_'+label});assert.equal(response.statusCode,201,response.body);}const beforeB=await f.ok(f.b.token,'/api/todos'),id=randomUUID(),receipt=await f.ok(f.admin.token,'/api/admin/accounts/'+f.a.userId,'DELETE',{operationId:id});assert.ok(['working','result_unknown'].includes(receipt.state));
 await waitForState(()=>f.ok(f.admin.token,'/api/admin/account-deletions/'+id),value=>value.state==='result_unknown','actual deletion unknown calendar result');assert.deepEqual(await f.callback({operationId:f.action.operationId,status:'succeeded',externalId:'generated-known-event'}),{acknowledged:true,published:false});await f.ok(f.admin.token,'/api/admin/account-deletions/'+id+'/retry','POST',{});await waitForState(()=>f.ok(f.admin.token,'/api/admin/account-deletions/'+id),value=>value.state==='completed','actual physical M12 account deletion');
 for(const table of [...privateTables,'td_todos','td_restore'])assert.equal(f.read(db=>Number(db.prepare('SELECT count(*) n FROM '+table+' WHERE user_id=?').get(f.a.userId)!.n)),0,table);assert.deepEqual(await f.ok(f.b.token,'/api/todos'),beforeB);assert.equal((await f.request(f.a.token,'/api/actions')).statusCode,401);
});
