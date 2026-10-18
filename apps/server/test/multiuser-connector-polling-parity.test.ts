import test,{type TestContext} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdirSync,writeFileSync} from 'node:fs';
import {dirname,join} from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';
import {scopedCaptureFixture} from './fixtures/scoped-capture-host.js';
import {defaultProcessingSettings} from '../src/scope/processing-schema.js';
import {defaultMemorySettings} from '../src/scope/memory-schema.js';
import {gmailScope} from '../src/connectors/gmail-adapter.js';
import {ExecutionFailure} from '../src/execution-engine.js';
import type {ConnectorTransports} from '../src/scope/connector-contract.js';

const connectionId='same-connection';
const calendarId='same-calendar';
const calendarSelection={documents:[],calendarIds:[calendarId],pastDays:1,futureDays:1,timeZone:'UTC',autoSync:true};
const recordingSelection={enabled:true,start:'2026-10-16T00:00:00Z',end:'2026-10-17T00:00:00Z',autoSync:true,backupAudio:true};
type ProviderCall={userId:string;kind:string};

/** Only provider transports are generated. These journeys enter the production
 * account, connector, plugin admission, durable scheduler and restart paths. */
async function pollingFixture(t:TestContext,transports:ConnectorTransports){
 const f=await scopedCaptureFixture(t,{connectorTransports:transports});
 const checked=async(token:string|undefined,url:string,method:any='GET',payload?:unknown)=>{
  const response=await f.request(token,url,method,payload);assert.equal(response.statusCode,200,url+' '+response.body);return response.json();
 };
 for(const actor of [f.a,f.b]){
  await checked(actor.token,'/api/configuration/processing','PUT',{revision:(await checked(actor.token,'/api/configuration')).revision,value:{...defaultProcessingSettings(),automatic:false}});
  await checked(actor.token,'/api/configuration/memory','PUT',{revision:(await checked(actor.token,'/api/configuration')).revision,value:{...defaultMemorySettings(),automatic:false}});
 }
 const wait=async(token:string,id:string,state='succeeded')=>{
  let task:any;
  for(let attempt=0;attempt<1000;attempt++){
   await f.host.execution!.tick();task=await checked(token,'/api/tasks/'+id);
   if(task.state===state)return task;
   if(!['waiting','running'].includes(task.state))assert.fail(JSON.stringify(task));
   await delay(5);
  }
  assert.fail('Generated connector task did not settle: '+JSON.stringify(task));
 };
 const run=async(token:string,suffix:string,payload:Record<string,unknown>={},state='succeeded')=>{
  const admitted=await checked(token,'/api/connectors/'+connectionId+'/'+suffix,'POST',{operationId:randomUUID(),...payload});return wait(token,admitted.id,state);
 };
 const operation=(token:string,operation:string,payload:Record<string,unknown>={})=>run(token,'operations',{operation,payload});
 const install=async(provider:string)=>checked(f.admin.token,'/api/admin/connectors/'+provider+'/install','POST',{expectedRevision:f.host.plugins!.catalog.revision(),operationId:randomUUID()});
 const configure=async(token:string,provider:string,syncIntervalMs=300000)=>{
  await checked(token,'/api/connectors/'+connectionId,'PUT',{expectedRevision:(await checked(token,'/api/connectors')).revision,connection:{provider,autoSync:true,syncIntervalMs,googleClientId:'generated-client',googleClientSecret:'generated-secret',googleRedirectUri:'https://generated.invalid/callback'}});
  await checked(token,'/api/connectors/'+connectionId+'/enable','POST',{expectedRevision:(await checked(token,'/api/plugins')).revision});
 };
 const timer=(userId:string)=>f.read(db=>{
  const row=db.prepare('SELECT e.id,e.input,e.state FROM connector_timers c JOIN execution_steps e ON e.id=c.task_id AND e.user_id=c.user_id WHERE c.user_id=? AND c.instance_id=?').get(userId,connectionId);
  assert.ok(row,'The recurring connector must retain a durable next cycle');return {id:String(row.id),state:String(row.state),input:JSON.parse(String(row.input))};
 });
 const status=(token:string)=>checked(token,'/api/connectors/'+connectionId);
 const oauth=async(token:string)=>{
  const started=await checked(token,'/api/connectors/'+connectionId+'/start','POST',{}),state=new URL(started.authorizationUrl).searchParams.get('state');assert.ok(state);
  const response=await f.request(undefined,'/oauth/google/callback?'+new URLSearchParams({state,code:'generated-oauth-code'}));assert.equal(response.statusCode,200,response.body);await wait(token,started.taskId);
 };
 return {f,checked,wait,run,operation,install,configure,timer,status,oauth};
}

function googleTransport(calls:ProviderCall[],failed:Set<string>):NonNullable<ConnectorTransports['google']>{
 const scopes=[gmailScope,'https://www.googleapis.com/auth/calendar.calendarlist.readonly','https://www.googleapis.com/auth/calendar.events.readonly'].join(' ');
 return scope=>({
  oauthFactory:()=>{
   const oauth:any={credentials:{},generateCodeVerifierAsync:async()=>({codeVerifier:'generated-verifier',codeChallenge:'generated-challenge'}),generateAuthUrl:(params:any)=>'https://generated.invalid/oauth?'+new URLSearchParams({state:params.state}),getToken:async()=>({tokens:{refresh_token:'generated-refresh',access_token:'generated-access',scope:scopes}}),setCredentials:(value:any)=>{oauth.credentials=value;},getAccessToken:async()=>({token:oauth.credentials.access_token})};return oauth;
  },
  fetch:(async url=>{
   const path=new URL(String(url)).pathname,kind=path.split('/').at(-1)!;calls.push({userId:scope.userId,kind});
   if(failed.has(scope.userId)&&['history','events'].includes(kind))return new Response(JSON.stringify({error:{message:'Generated recoverable network failure'}}),{status:503});
   const value=kind==='profile'?{emailAddress:'generated@fixture.invalid',historyId:'42'}:
    kind==='calendarList'?{items:[{id:calendarId,summary:'Generated calendar',timeZone:'UTC'}]}:
    kind==='events'?{items:[{id:'same-event',summary:'GENERATED_'+scope.userId,start:{dateTime:'2026-10-16T01:00:00Z'},end:{dateTime:'2026-10-16T02:00:00Z'}}],nextSyncToken:'generated-cursor'}:
    kind==='messages'?{messages:[{id:'same-message'}]}:
    kind==='same-message'?{id:'same-message',payload:{mimeType:'text/plain',headers:[{name:'subject',value:'Generated message'}],body:{data:Buffer.from('GENERATED_'+scope.userId).toString('base64url')}}}:
    kind==='history'?{history:[],historyId:'43'}:undefined;
   assert.ok(value,'Unexpected generated Google transport '+path);return new Response(JSON.stringify(value),{headers:{'content-type':'application/json'}});
  }) as typeof fetch,
 });
}

for(const provider of ['gmail','google-calendar'])test(provider+' retains its next automatic cycle after a terminal network failure and resumes that cycle through restart',async t=>{
 t.mock.timers.enable({apis:['Date'],now:Date.parse('2026-10-18T00:00:00Z')});
 const calls:ProviderCall[]=[],failed=new Set<string>(),p=await pollingFixture(t,{google:googleTransport(calls,failed)}),{f}=p;
 await p.install(provider);await p.configure(f.a.token,provider);await p.oauth(f.a.token);
 if(provider==='google-calendar')await p.operation(f.a.token,'select',{calendarIds:[calendarId]});
 await p.run(f.a.token,'sync');const cycle=p.timer(f.a.userId);assert.equal(cycle.state,'waiting');assert.ok(cycle.input.due>Date.now());
 failed.add(f.a.userId);t.mock.timers.tick(300001);const terminal=await p.wait(f.a.token,cycle.id,'blocked');assert.ok(terminal.failure);
 const successor=p.timer(f.a.userId);assert.notEqual(successor.id,cycle.id);assert.equal(successor.state,'waiting');assert.ok(successor.input.due>Date.now());
 const callsAtFailure=calls.length;failed.clear();await f.restart();assert.equal(p.timer(f.a.userId).id,successor.id);
 t.mock.timers.tick(300001);await p.wait(f.a.token,successor.id);assert.ok(calls.length>callsAtFailure,'Recovery must use the next real provider acquisition, without manual retry');
 assert.notEqual(p.timer(f.a.userId).id,successor.id);assert.equal((await p.checked(f.a.token,'/api/tasks/'+cycle.id)).state,'blocked','The previous failed cycle remains an independent historical result');
 const stoppedCycle=p.timer(f.a.userId);await p.checked(f.a.token,'/api/connectors/'+connectionId+'/stop','POST',{expectedRevision:(await p.checked(f.a.token,'/api/plugins')).revision});
 calls.length=0;await f.restart();t.mock.timers.tick(300001);let stoppedTask:any;
 for(let spin=0;spin<1000;spin++){
  await f.host.execution!.tick();stoppedTask=await p.checked(f.a.token,'/api/tasks/'+stoppedCycle.id);
  if(!['waiting','running'].includes(stoppedTask.state))break;
  await delay(5);
 }
 assert.ok(['stale','blocked','cancelled'].includes(stoppedTask.state),JSON.stringify(stoppedTask));
 assert.deepEqual(calls,[],'Stopping a connection fences its already-created successor across restart');
});

function larkTransport(calls:ProviderCall[]):NonNullable<ConnectorTransports['lark']>{
 return scope=>async command=>{
  calls.push({userId:scope.userId,kind:command.kind});
  switch(command.kind){
   case 'version':return 'lark-cli 1.0.98';
   case 'status':return JSON.stringify({appId:'cli_generated',identities:{user:{available:true,openId:'same-generated-user',scope:'docx:document:readonly wiki:wiki:readonly search:docs:read calendar:calendar:readonly space:document:retrieve minutes:minutes.basic:read minutes:minutes.artifacts:read minutes:minutes.media:export minutes:minutes.search:read'}}});
   case 'login':return JSON.stringify({verification_url:'https://accounts.feishu.cn/generated',device_code:'generated-device-code',expires_in:600});
   case 'complete':return '{}';
   case 'calendars':return JSON.stringify({data:{calendar_list:[{calendar_id:calendarId,summary:'Generated calendar',role:'owner'}],has_more:false}});
   case 'events':return JSON.stringify({data:{items:[{event_id:'same-event',summary:'GENERATED_'+scope.userId,start_time:{timestamp:'1792112400'},end_time:{timestamp:'1792116000'}}]}});
   case 'folder-list':return JSON.stringify({data:{files:[{token:'DocumentFixture123',name:'Generated preview document',type:'docx'}],has_more:false}});
   case 'document':return JSON.stringify({data:{document:{document_id:'same-document',revision_id:1,title:'Generated document',content:'GENERATED_DOCUMENT_'+scope.userId}}});
   case 'minutes-search':return JSON.stringify({data:{items:[],has_more:false}});
   default:throw Error('Unexpected generated Lark transport '+command.kind);
  }
 };
}

function dingtalkTransport(calls:ProviderCall[]):NonNullable<ConnectorTransports['dingtalk']>{
 return scope=>async command=>{
  calls.push({userId:scope.userId,kind:command.kind});
  if(command.kind==='status')return {authenticated:true,corp_id:'same-generated-corp',user_id:'same-generated-user'};
  if(command.kind==='search')return {minutes:[],complete:true};
  throw Error('Unexpected generated DWS transport '+command.kind);
 };
}

test('recording discovery exhausting all five transient attempts leaves an independent future cycle that recovers after restart',async t=>{
 t.mock.timers.enable({apis:['Date'],now:Date.parse('2026-10-18T00:00:00Z')});
 let fail=false,discoveryFailures=0,recover=false;
 const calls:ProviderCall[]=[],p=await pollingFixture(t,{dingtalk:scope=>async command=>{
  calls.push({userId:scope.userId,kind:command.kind});
  if(command.kind==='status')return {authenticated:true,corp_id:'same-generated-corp',user_id:'same-generated-user'};
  if(command.kind==='search'){
   if(fail){discoveryFailures++;throw new ExecutionFailure('transient','generated_discovery_network_failure');}
   return {minutes:recover?[{taskUuid:'same-recording'}]:[],complete:true};
  }
  if(command.kind==='metadata')return {basic:{taskUuid:command.id,title:'Generated recovery recording',startTime:Date.parse('2026-10-16T01:00:00Z'),duration:5000}};
  if(command.kind==='transcript')return {taskUuid:command.id,complete:true,paragraphList:[{paragraph:'GENERATED_RECOVERED_RECORDING'}]};
  if(command.kind==='media'){
   const path=join(scope.directory,'dws-runtime',command.output);mkdirSync(dirname(path),{recursive:true});writeFileSync(path,Buffer.concat([Buffer.from('RIFF0000WAVE'),Buffer.alloc(64)]));return {ok:true,succeeded:1,results:[{taskUuid:command.id}]};
  }
  throw Error('Unexpected generated recording recovery operation '+command.kind);
 }}),{f}=p;
 await p.install('dingtalk-recordings');await p.configure(f.a.token,'dingtalk-recordings');await p.operation(f.a.token,'connect');await p.operation(f.a.token,'select',recordingSelection);await p.run(f.a.token,'sync');
 const cycle=p.timer(f.a.userId);fail=true;t.mock.timers.tick(300001);let last:any;
 for(let attempt=1;attempt<=5;attempt++){
  for(let spin=0;spin<1000;spin++){
   await f.host.execution!.tick();last=await p.checked(f.a.token,'/api/tasks/'+cycle.id);
   if(last.attempts===attempt&&last.state===(attempt===5?'failed':'waiting'))break;
   await delay(5);
  }
  assert.equal(last.attempts,attempt,JSON.stringify(last));assert.equal(last.state,attempt===5?'failed':'waiting',JSON.stringify(last));
  if(attempt<5)t.mock.timers.tick(20000);
 }
 assert.equal(discoveryFailures,5,'The failed discovery cycle owns the existing five-call budget');
 const successor=p.timer(f.a.userId);assert.notEqual(successor.id,cycle.id);assert.equal(successor.state,'waiting');assert.ok(successor.input.due>Date.now());
 fail=false;recover=true;await f.restart();assert.equal(p.timer(f.a.userId).id,successor.id);t.mock.timers.tick(300001);await p.wait(f.a.token,successor.id);
 assert.equal(discoveryFailures,5,'A new periodic scan must not mutate the terminal previous cycle');
 const page=await p.checked(f.a.token,'/api/connectors/'+connectionId+'/recordings?limit=10');assert.equal(page.items.length,1);assert.equal(page.items[0].id,'same-recording');assert.equal(page.items[0].transcript.state,'succeeded');
 assert.equal((await p.checked(f.a.token,'/api/tasks/'+cycle.id)).state,'failed');
 assert.equal((await p.checked(f.b.token,'/api/connectors')).connections.length,0,'A successor cannot manufacture a connection or authorization for B');
});

for(const provider of ['lark','feishu-recordings','dingtalk-recordings'])test(provider+' selection background-sync switch prevents new provider calls from an existing poll after restart while another owner continues',async t=>{
 t.mock.timers.enable({apis:['Date'],now:Date.parse('2026-10-18T00:00:00Z')});
 const calls:ProviderCall[]=[],p=await pollingFixture(t,{lark:larkTransport(calls),dingtalk:dingtalkTransport(calls)}),{f}=p;
 await p.install(provider);
 const selection=provider==='lark'?calendarSelection:recordingSelection;
 for(const actor of [f.a,f.b]){
  await p.configure(actor.token,provider);await p.operation(actor.token,provider==='lark'?'login':'connect');
  await p.operation(actor.token,'select',selection);await p.run(actor.token,'sync');assert.equal(p.timer(actor.userId).state,'waiting');
 }
 const oldA=p.timer(f.a.userId),oldB=p.timer(f.b.userId);
 await p.operation(f.a.token,'select',{...selection,autoSync:false});
 await p.run(f.a.token,'sync');assert.equal((await p.status(f.a.token)).selection.autoSync,false,'The original manual sync remains available');
 calls.length=0;await f.restart();t.mock.timers.tick(300001);
 const skipped=await p.wait(f.a.token,oldA.id);assert.equal(skipped.result.skipped,true);await p.wait(f.b.token,oldB.id);
 assert.deepEqual(calls.filter(call=>call.userId===f.a.userId),[],'Disabled background sync must not probe, discover or acquire provider content');
 assert.ok(calls.some(call=>call.userId===f.b.userId),'An equal provider account ID owned by B retains its independent polling');
 t.mock.timers.tick(300001);await p.wait(f.b.token,p.timer(f.b.userId).id);
 assert.deepEqual(calls.filter(call=>call.userId===f.a.userId),[],'The disabled owner does not create another background cycle');
});

test('Lark automatic calendar polling preserves a new folder preview until explicit document sync confirms its body scope',async t=>{
 t.mock.timers.enable({apis:['Date'],now:Date.parse('2026-10-18T00:00:00Z')});
 const calls:ProviderCall[]=[],p=await pollingFixture(t,{lark:larkTransport(calls)}),{f}=p;
 await p.install('lark');await p.configure(f.a.token,'lark');await p.operation(f.a.token,'login');
 await p.operation(f.a.token,'select',calendarSelection);await p.run(f.a.token,'sync');const timer=p.timer(f.a.userId);
 await p.operation(f.a.token,'select',{...calendarSelection,folders:['FolderFixture123']});
 const preview=await p.operation(f.a.token,'preview');assert.equal(preview.result.documentSync.confirmed,false);assert.equal(preview.result.documentSync.previewTotal,1);
 assert.equal(calls.filter(call=>call.kind==='document').length,0,'Metadata preview does not collect a body');
 calls.length=0;await f.restart();t.mock.timers.tick(300001);await p.wait(f.a.token,timer.id);
 const automatic=await p.status(f.a.token);assert.equal(automatic.documentSync.confirmed,false);assert.equal(automatic.documentSync.previewTotal,1);assert.equal(automatic.documentSync.documents,0);
 assert.ok(calls.some(call=>call.kind==='events'),'The existing authorized calendar cycle still runs');
 assert.equal(calls.filter(call=>call.kind==='document'||call.kind==='folder-list').length,0,'Automatic polling cannot promote preview into confirmed body collection');
 const explicit=await p.run(f.a.token,'sync');assert.equal(explicit.result.documentSync.confirmed,true);assert.equal(explicit.result.documentSync.documents,1);
 assert.equal(calls.filter(call=>call.kind==='document').length,1,'The unchanged explicit sync step confirms and archives the previewed document');
});


test('recording selection persists promptly while an old provider read ignores abort and fences its late result across restart',async t=>{
 let heldUser='',hold=false,entered!:()=>void,release!:()=>void;
 const entry=new Promise<void>(resolve=>entered=resolve),gate=new Promise<void>(resolve=>release=resolve);t.after(()=>release());
 const calls:ProviderCall[]=[],p=await pollingFixture(t,{dingtalk:scope=>async command=>{
  calls.push({userId:scope.userId,kind:command.kind});
  if(command.kind==='status')return {authenticated:true,corp_id:'same-generated-corp',user_id:'same-generated-user'};
  if(command.kind==='search'){if(hold&&scope.userId===heldUser){entered();await gate;}return {minutes:[{taskUuid:'same-recording'}],complete:true};}
  if(command.kind==='metadata')return {basic:{taskUuid:command.id,title:'Generated '+scope.userId,startTime:Date.parse('2026-10-16T01:00:00Z'),duration:5000}};
  if(command.kind==='transcript')return {taskUuid:command.id,complete:true,paragraphList:[{paragraph:'GENERATED_'+scope.userId}]};
  if(command.kind==='media'){const path=join(scope.directory,'dws-runtime',command.output);mkdirSync(dirname(path),{recursive:true});writeFileSync(path,Buffer.concat([Buffer.from('RIFF0000WAVE'),Buffer.alloc(64)]));return {ok:true,succeeded:1,results:[{taskUuid:command.id}]};}
  throw Error('Unexpected generated held recording operation '+command.kind);
 }}),{f}=p;
 await p.install('dingtalk-recordings');
 for(const actor of [f.a,f.b]){await p.configure(actor.token,'dingtalk-recordings');await p.operation(actor.token,'connect');await p.operation(actor.token,'select',recordingSelection);}
 heldUser=f.a.userId;hold=true;
 const old=await p.checked(f.a.token,'/api/connectors/'+connectionId+'/sync','POST',{operationId:randomUUID()});await entry;
 const next={...recordingSelection,enabled:false,autoSync:false,start:'2026-10-17T00:00:00Z',end:'2026-10-18T00:00:00Z'};
 const saved=await Promise.race([p.operation(f.a.token,'select',next),delay(3000).then(()=>{throw Error('Saving selection waited for the held external scan');})]);
 assert.deepEqual(saved.result.selection,next);assert.deepEqual((await p.status(f.a.token)).selection,next,'The current durable epoch is visible before the old provider returns');
 assert.equal((await p.checked(f.a.token,'/api/tasks/'+old.id)).state,'cancelled');
 await p.run(f.b.token,'sync');assert.equal((await p.checked(f.b.token,'/api/connectors/'+connectionId+'/recordings?limit=10')).items[0].transcript.state,'succeeded','B with the same external IDs remains independent');
 release();
 for(let spin=0;spin<1000;spin++){if(f.read(db=>Number(db.prepare('SELECT count(*) n FROM connector_activity WHERE user_id=?').get(f.a.userId)!.n))===0)break;await delay(5);}
 const source=(await p.checked(f.a.token,'/api/sources')).items.find((item:any)=>item.kind==='dingtalk.recordings');assert.ok(source);
 assert.equal((await p.checked(f.a.token,'/api/ingress/sources/'+source.id+'/originals')).items.length,0,'No late old-epoch transcript or audio is published');
 await f.restart();assert.deepEqual((await p.status(f.a.token)).selection,next);assert.equal((await p.checked(f.a.token,'/api/connectors/'+connectionId+'/recordings?limit=10')).items.length,0);
 assert.equal((await p.checked(f.b.token,'/api/connectors/'+connectionId+'/recordings?limit=10')).items[0].transcript.state,'succeeded');
});

test('recording polling retains the original five-minute wake ceiling for a longer configured connector interval',async t=>{
 t.mock.timers.enable({apis:['Date'],now:Date.parse('2026-10-18T00:00:00Z')});
 const calls:ProviderCall[]=[],p=await pollingFixture(t,{dingtalk:dingtalkTransport(calls)}),{f}=p;
 await p.install('dingtalk-recordings');await p.configure(f.a.token,'dingtalk-recordings',900000);await p.operation(f.a.token,'connect');await p.operation(f.a.token,'select',recordingSelection);await p.run(f.a.token,'sync');
 const cycle=p.timer(f.a.userId);assert.equal(cycle.input.due,Date.now()+300000);
 calls.length=0;t.mock.timers.tick(300001);await p.wait(f.a.token,cycle.id);assert.ok(calls.some(call=>call.kind==='search'),'The old recording tick directly starts the next discovery at the five-minute ceiling');
});
