import test,{type TestContext} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {createServer,type ServerResponse} from 'node:http';
import {buildApp} from '../src/app.js';
import {defaultModelSettings} from '../src/model-settings.js';
import {defaultProcessingSettings} from '../src/scope/processing-schema.js';
import {writeMessagesResponse} from '../../../scripts/fixtures/messages-provider.js';
import {queryAccounts,queryHttp,waitForState,deferred,item} from './fixtures/scoped-query-accounts.js';

async function fixture(t:TestContext){
 const directory=mkdtempSync(join(tmpdir(),'mote-m12-'));let node=await buildApp({dataDir:directory});
 t.after(async()=>{await node.app.close();rmSync(directory,{recursive:true,force:true});});
 const {request,ok}=queryHttp(()=>node),users=await queryAccounts(node,ok);
 return {get node(){return node;},directory,request,ok,...users,restart:async()=>{await node.app.close();node=await buildApp({dataDir:directory});}};
}

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

const event={title:'Generated appointment',start:'2099-02-01T09:00:00Z',end:'2099-02-01T10:00:00Z',timeZone:'UTC',allDay:false,location:'',description:''};
async function modelFixture(t:TestContext){
 const requests:{owner:string;raw:string;body:any}[]=[],scripts=new Map<string,(body:any,raw:string,res:ServerResponse)=>void|Promise<void>>();
 const provider=createServer((req,res)=>{void(async()=>{let raw='';for await(const chunk of req)raw+=chunk;const body=JSON.parse(raw),owner=String(req.headers['x-api-key']).includes('_A_')?'A':'B';requests.push({owner,raw,body});if(scripts.has(owner)){await scripts.get(owner)!(body,raw,res);return;}respond(body,raw,res,owner);})().catch(()=>res.destroy());});
 await new Promise<void>(resolve=>provider.listen(0,'127.0.0.1',resolve));t.after(async()=>{provider.closeAllConnections();await new Promise<void>(resolve=>provider.close(()=>resolve()));});
 const f=await fixture(t),replace=async(user:any,domain:string,value:unknown)=>{const view=await f.ok(user.token,'/api/configuration');return f.ok(user.token,'/api/configuration/'+domain,'PUT',{revision:view.revision,value});};
 for(const [user,label] of [[f.a,'A'],[f.b,'B']] as const){await replace(user,'processing',{...defaultProcessingSettings(),automatic:false,understandingEnabled:false});await replace(user,'models',{profiles:[{id:'same-model',name:'Generated action model',settings:{...defaultModelSettings(),provider:'custom',protocol:'anthropic-messages',model:'generated-actions',baseUrl:'http://127.0.0.1:'+(provider.address() as any).port+'/v1',apiKey:'GENERATED_'+label+'_KEY',headers:{},extraBody:{}}}],selections:{chat:{kind:'personal',id:'same-model'}}});}
 const enable=async(user:any)=>{const view=await f.ok(user.token,'/api/actions');return f.ok(user.token,'/api/actions/settings','PUT',{revision:view.revision,authorizationRevision:view.authorizationRevision,settings:{enabled:true,timeZone:'UTC',reviewDeviceIds:['same-device']}});};
 const ingest=async(user:any,label:string,externalId='same-item')=>f.ok(user.token,'/api/ingress/sources/same-source/items','POST',{batchId:'batch:'+externalId,items:[item('GENERATED_'+label+'_PRIVATE_APPOINTMENT',externalId)]});
 const proposal=(user:any)=>waitForState(()=>f.ok(user.token,'/api/actions'),value=>value.items.length>0,'actual Actions proposal');
 return {...f,requests,scripts,replace,enable,ingest,proposal};
}
function respond(body:any,raw:string,res:ServerResponse,owner:string){
 const uses=body.messages.flatMap((message:any)=>Array.isArray(message.content)?message.content.filter((part:any)=>part.type==='tool_use'):[]),ids=[...new Set(raw.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g)??[])];
 if(!uses.some((use:any)=>use.name==='evidence'))return writeMessagesResponse(res,{stage:uses.length+1,tool:{name:'evidence',args:{ids:ids.slice(0,1)}}});
 const id=raw.match(/"id":"([0-9a-f-]{36})"[^\n]*?GENERATED_/)?.[1]??ids[0];
 writeMessagesResponse(res,{stage:uses.length+1,text:JSON.stringify({answer:JSON.stringify({actions:[{kind:'calendar.create',event:{...event,title:'Generated '+owner},uncertainty:'Generated proposal',sameAs:null,evidence:[{id,quote:'GENERATED_'+owner+'_PRIVATE_APPOINTMENT'}]}]}),citationIds:[id]})});
}

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
