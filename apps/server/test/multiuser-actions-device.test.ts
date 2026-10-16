import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture,modelFixture} from './fixtures/scoped-actions.js';
import {randomUUID} from 'node:crypto';

test('real device credentials may register only their own targets and review only an owner-granted calendar scope',async t=>{
 const f=await fixture(t),mint=(token:string,id='same-device')=>f.ok(token,'/api/login/session','POST',{serverUrl:'https://synthetic.invalid',deviceId:id,deviceName:'Generated device',platform:'macos'}),a=await mint(f.a.token),b=await mint(f.b.token),other=await mint(f.a.token,'other-device');
 for(const credential of [a,b])await f.ok(credential.token,'/api/actions/targets','POST',{deviceId:'same-device',deviceName:'Generated own device',calendars:[{id:'same-calendar',title:'Generated owned'}]});
 assert.equal((await f.request(a.token,'/api/actions')).statusCode,403);assert.equal((await f.request(b.token,'/api/actions')).statusCode,403);
 assert.equal((await f.request(a.token,'/api/actions/targets','POST',{deviceId:'other-device',deviceName:'Generated spoofed',calendars:[]})).statusCode,403);
 const view=await f.ok(f.a.token,'/api/actions');await f.ok(f.a.token,'/api/actions/settings','PUT',{revision:view.revision,authorizationRevision:view.authorizationRevision,settings:{enabled:false,timeZone:'America/New_York',reviewDeviceIds:['same-device']}});
 assert.equal((await f.ok(a.token,'/api/actions')).settings.timeZone,'America/New_York');assert.equal((await f.request(b.token,'/api/actions')).statusCode,403);assert.equal((await f.request(other.token,'/api/actions')).statusCode,403);
 for(const path of ['/api/todos','/api/query','/api/owner-questions','/api/actions/retry'])assert.equal((await f.request(a.token,path,path==='/api/query'||path.endsWith('retry')?'POST':'GET',path==='/api/query'?{question:'Generated'}:undefined)).statusCode,403);
 assert.equal((await f.request(a.token,'/api/actions/settings','PUT',{revision:0,authorizationRevision:0,settings:{enabled:true,timeZone:'UTC',reviewDeviceIds:[]}})).statusCode,403);
 const next=await f.ok(f.a.token,'/api/actions');await f.ok(f.a.token,'/api/actions/settings','PUT',{revision:next.revision,authorizationRevision:next.authorizationRevision,settings:{...next.settings,reviewDeviceIds:[]}});assert.equal((await f.request(a.token,'/api/actions')).statusCode,403);
});

test('settings failure preserves an already committed device withdrawal and never adds a replacement grant',async t=>{
 const f=await fixture(t),view=await f.ok(f.a.token,'/api/actions'),settings={enabled:false,timeZone:'UTC',reviewDeviceIds:['same-device']};await f.ok(f.a.token,'/api/actions/settings','PUT',{revision:view.revision,authorizationRevision:view.authorizationRevision,settings});const before=await f.ok(f.a.token,'/api/actions');
 const failed=await f.request(f.a.token,'/api/actions/settings','PUT',{revision:before.revision+100,authorizationRevision:before.authorizationRevision,settings:{enabled:true,timeZone:'America/New_York',reviewDeviceIds:['replacement-device']}});assert.equal(failed.statusCode,503,failed.body);assert.equal(failed.json().authorizationRevoked,true);assert.deepEqual(failed.json().revokedDeviceIds,['same-device']);const after=await f.ok(f.a.token,'/api/actions');assert.deepEqual(after.settings.reviewDeviceIds,[]);assert.equal(after.settings.enabled,false);assert.equal(after.settings.timeZone,'UTC');assert.equal(after.authorizationRevision,before.authorizationRevision+1);
});

test('calendar approval checks explicit timezone and native target before issuance, including wrong-device claims',async t=>{
 const f=await modelFixture(t);await f.ingest(f.a,'A');await f.enable(f.a);await f.ok(f.a.token,'/api/actions/targets','POST',{deviceId:'same-device',deviceName:'Generated',calendars:[{id:'same-calendar',title:'Generated'}]});const a=(await f.proposal(f.a)).items[0],path='/api/actions/'+a.id+'/confirm',target={deviceId:'same-device',calendarId:'same-calendar'};
 assert.equal((await f.request(f.a.token,path,'POST',{version:a.version,event:{...a.event,timeZone:null},target})).statusCode,400);assert.equal((await f.request(f.a.token,path,'POST',{version:a.version,event:{...a.event,timeZone:'invented-zone'},target})).statusCode,400);
 assert.equal((await f.request(f.a.token,path,'POST',{version:a.version,event:{...a.event,start:'2000-01-01T09:00:00Z',end:'2000-01-01T10:00:00Z'},target})).statusCode,409);
 assert.equal((await f.request(f.a.token,path,'POST',{version:a.version,event:a.event,target:{deviceId:'same-device',calendarId:'absent'}})).statusCode,409);
 const approved=await f.ok(f.a.token,path,'POST',{version:a.version,event:a.event,target}),wrong=await f.ok(f.a.token,'/api/login/session','POST',{serverUrl:'https://synthetic.invalid',deviceId:'wrong-device',deviceName:'Generated wrong device',platform:'macos'});
 assert.equal((await f.request(wrong.token,'/api/actions/'+a.id+'/claim','POST',{deviceId:'same-device'})).statusCode,403);assert.equal((await f.request(f.a.token,'/api/actions/'+a.id+'/claim','POST',{deviceId:'wrong-device'})).statusCode,403);
 assert.equal(f.read(db=>Number(db.prepare('SELECT count(*) n FROM task_external_calls WHERE user_id=?').get(f.a.userId)!.n)),0);assert.equal((await f.ok(f.a.token,'/api/actions')).items[0].operationId,approved.operationId);
});
