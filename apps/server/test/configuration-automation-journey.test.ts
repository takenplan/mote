import test,{type TestContext} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,readFileSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {parse,stringify} from 'yaml';
import {buildApp} from '../src/app.js';
import {defaultModelSettings} from '../src/model-settings.js';
import {defaultProcessingSettings} from '../src/scope/processing-schema.js';
import {source,item,waitForState} from './fixtures/scoped-query-accounts.js';
import {defaultMemorySettings} from '../src/scope/memory-schema.js';
import {z} from 'zod';
import {ExecutionFailure} from '../src/execution-engine.js';
import {connectorAuthority,connectionSchema,type ConnectorDefinition} from '../src/scope/connector-contract.js';

const password='Generated-config-policy-password',protocol={'x-mote-protocol-version':'2','x-mote-ingress-version':'3'};
async function fixture(t:TestContext,connectorDefinitions?:readonly ConnectorDefinition[]){
 const directory=mkdtempSync(join(tmpdir(),'mote-config-policy-')),node=await buildApp({dataDir:directory},{connectorDefinitions});
 t.after(async()=>{await node.app.close();rmSync(directory,{recursive:true,force:true});});await node.accounts!.initialize('generated-config-owner',password);
 const request=(token:string|undefined,url:string,method:any='GET',payload?:unknown)=>node.app.inject({method,url,headers:{...protocol,...(token?{authorization:'Bearer '+token}:{})},...(payload===undefined?{}:{payload})});
 const ok=async(token:string|undefined,url:string,method:any='GET',payload?:unknown)=>{const result=await request(token,url,method,payload);assert.equal(result.statusCode,200,url+' '+result.body);return result.json();};
 const a=await ok(undefined,'/api/auth/login','POST',{username:'generated-config-owner',password,mode:'client'});await ok(a.token,'/api/admin/accounts','POST',{username:'generated-config-other',password});const b=await ok(undefined,'/api/auth/login','POST',{username:'generated-config-other',password,mode:'client'});
 const read=<T>(work:(db:DatabaseSync)=>T)=>{const db=new DatabaseSync(join(directory,'mote.sqlite'),{readOnly:true});try{return work(db);}finally{db.close();}};
 const replace=async(token:string,domain:string,value:unknown,automationIntent?:string[])=>ok(token,'/api/configuration/'+domain,'PUT',{revision:(await ok(token,'/api/configuration')).revision,value,...(automationIntent?{automationIntent}:{})});
 return {node,directory,a,b,request,ok,read,replace,file:join(directory,'configuration','users',a.userId,'mote.yaml')};
}

test('schedule-only connector edits preserve authority while credential withdrawal remains distinct',()=>{
 const before=connectionSchema.parse({id:'generated',provider:'gmail',syncIntervalMs:60000,autoSync:true,googleClientSecret:'generated-secret'});
 assert.equal(connectorAuthority(before),connectorAuthority({...before,syncIntervalMs:120000,autoSync:false}));
 assert.notEqual(connectorAuthority(before),connectorAuthority({...before,googleClientSecret:undefined}));
});

test('visible lifecycle settings create policies only on explicit owner intent and retain future intent identity',async t=>{
 const f=await fixture(t),view=await f.ok(f.a.token,'/api/configuration'),memory=view.domains.find((domain:any)=>domain.id==='memory');
 assert.equal(memory.saved.lifecycle.working.enabled,true);assert.equal(memory.automation.find((item:any)=>item.path==='lifecycle.working.enabled').authorized,false);
 assert.equal(f.read(db=>db.prepare('SELECT count(*) n FROM ma_automations WHERE user_id=?').get(f.a.userId)!.n),0);
 const unchanged={...memory.saved,timeZone:'Asia/Shanghai'};await f.replace(f.a.token,'memory',unchanged);
 assert.equal(f.read(db=>db.prepare('SELECT count(*) n FROM ma_automations WHERE user_id=?').get(f.a.userId)!.n),0,'Unchanged true defaults do not authorize policies');
 await f.replace(f.a.token,'memory',unchanged,['memory:lifecycle.working.enabled','memory:lifecycle.insights.enabled']);
 const policies=await f.ok(f.a.token,'/api/ask-automations');assert.equal(policies.items.length,2);assert.ok(policies.items.every((policy:any)=>policy.input.includeExisting===false&&policy.input.sourceIds===undefined));
 const prior=f.read(db=>db.prepare('SELECT id,generation,task_id,cursor FROM ma_automations WHERE user_id=? ORDER BY id').all(f.a.userId));
 const working=policies.items.find((policy:any)=>policy.input.kind==='working');
 // A linked scheduled run may never borrow current lifecycle settings if its
 // persisted window is incomplete. Unscheduled interactive runs remain valid.
 const malformedWindow=randomUUID(),malformedRun=randomUUID(),windowDb=f.node.execution!.engine.store.db,owner=await f.node.authority.authenticate(f.a.token);windowDb.prepare("INSERT INTO ma_auto_windows VALUES(?,?,?,?,'running',0,?,?)").run(f.a.userId,malformedWindow,working.id,working.generation,JSON.stringify({at:new Date().toISOString(),sources:[],sourceIds:[],children:[]}),new Date().toISOString());windowDb.prepare('INSERT INTO ma_auto_runs VALUES(?,?,?,?,?)').run(f.a.userId,malformedRun,malformedWindow,working.id,working.generation);assert.throws(()=>f.node.ask!.automations.scope(owner,malformedRun),{code:'ask_automation_window_configuration_unavailable'});assert.equal(f.node.ask!.automations.scope(owner,randomUUID()),undefined);windowDb.prepare('DELETE FROM ma_auto_runs WHERE user_id=? AND run_id=?').run(f.a.userId,malformedRun);windowDb.prepare('DELETE FROM ma_auto_windows WHERE user_id=? AND id=?').run(f.a.userId,malformedWindow);
 await f.ok(f.a.token,'/api/ask-automations/'+working.id+'/pause','POST',{});assert.equal((await f.ok(f.a.token,'/api/ask-automations/'+working.id)).state,'paused');await f.replace(f.a.token,'memory',unchanged,['memory:lifecycle.working.enabled']);assert.equal((await f.ok(f.a.token,'/api/ask-automations/'+working.id)).state,'active','Visible explicit enable resumes the admitted policy');await f.ok(f.a.token,'/api/tasks/'+working.task_id+'/cancel','POST',{});assert.equal((await f.ok(f.a.token,'/api/configuration')).domains.find((domain:any)=>domain.id==='memory').automation.find((entry:any)=>entry.path==='lifecycle.working.enabled').enabled,false);await f.replace(f.a.token,'memory',unchanged,['memory:lifecycle.working.enabled']);assert.ok(['waiting','running'].includes((await f.ok(f.a.token,'/api/tasks/'+working.task_id)).state),'Visible enable retries a cancelled coordinator through the owner protocol');
 const tuned={...unchanged,lifecycle:{...unchanged.lifecycle,working:{...unchanged.lifecycle.working,enabled:false,intervalHours:99},insights:{...unchanged.lifecycle.insights,intervalHours:48}}};await f.replace(f.a.token,'memory',tuned);
 assert.deepEqual(f.read(db=>db.prepare('SELECT id,generation,task_id,cursor FROM ma_automations WHERE user_id=? ORDER BY id').all(f.a.userId)),prior);
 const state=await f.ok(f.a.token,'/api/ask-automations');assert.equal(state.items.find((policy:any)=>policy.input.kind==='working').settings.working.enabled,false);assert.equal(state.items.find((policy:any)=>policy.input.kind==='insights').settings.insights.intervalHours,48);
 const bView=await f.ok(f.b.token,'/api/configuration');assert.ok(bView.domains.find((domain:any)=>domain.id==='memory').automation.every((item:any)=>!item.authorized));
 const saved=parse(readFileSync(f.file,'utf8'));saved.memory.lifecycle.working.enabled=true;writeFileSync(f.file,stringify(saved));await f.ok(f.a.token,'/api/configuration/reload','POST',{});
 assert.deepEqual(f.read(db=>db.prepare('SELECT id,generation,task_id,cursor FROM ma_automations WHERE user_id=? ORDER BY id').all(f.a.userId)),prior,'File tuning preserves existing policy identity, never creates a fresh grant');
});

test('generic Actions save creates the actual watch, tuning/pause retains it, missing models wait clearly',async t=>{
 const f=await fixture(t);await f.replace(f.a.token,'processing',{...defaultProcessingSettings(),automatic:false,understandingEnabled:false});await f.replace(f.a.token,'memory',{...defaultMemorySettings(),automatic:false});await f.replace(f.a.token,'models',{profiles:[{id:'generated-chat',name:'Generated chat only',settings:{...defaultModelSettings(),provider:'custom',protocol:'openai-completions',baseUrl:'https://generated.invalid/v1',model:'generated',apiKey:'generated-key'}}],selections:{chat:{kind:'personal',id:'generated-chat'}}});await f.ok(f.a.token,'/api/ingress/sources','POST',source('generated-config-source'));await f.ok(f.a.token,'/api/ingress/sources/generated-config-source/items','POST',{batchId:'generated-config-batch',items:[item('Generated appointment evidence')]});await f.replace(f.a.token,'actions',{enabled:true,timeZone:'UTC'});
 const prior=f.read(db=>db.prepare('SELECT generation,policy_id,policy_task FROM ac_state WHERE user_id=?').get(f.a.userId)!);assert.ok(prior.policy_task);
 await f.node.execution!.tick();await f.node.execution!.engine.drain([String(prior.policy_task)]);
 const task=await f.ok(f.a.token,'/api/tasks/'+prior.policy_task);assert.equal(task.state,'waiting');assert.equal(task.error,'actions_memory_model_required');
 const actions=await f.ok(f.a.token,'/api/actions');assert.equal(actions.progress.configured,false);assert.equal(actions.progress.waitingReason,'actions_memory_model_required');
 await f.replace(f.a.token,'actions',{enabled:true,timeZone:'Asia/Shanghai'});assert.deepEqual(f.read(db=>db.prepare('SELECT generation,policy_id,policy_task FROM ac_state WHERE user_id=?').get(f.a.userId)),prior);
 await f.replace(f.a.token,'actions',{enabled:false,timeZone:'Asia/Shanghai'});assert.deepEqual(f.read(db=>db.prepare('SELECT generation,policy_id,policy_task FROM ac_state WHERE user_id=?').get(f.a.userId)),prior);
 await f.node.execution!.tick();await f.node.execution!.engine.drain([String(prior.policy_task)]);assert.equal((await f.ok(f.a.token,'/api/tasks/'+prior.policy_task)).error,'actions_paused');
 const b=await f.ok(f.b.token,'/api/actions');assert.equal(b.settings.enabled,false);assert.equal(f.read(db=>db.prepare('SELECT policy_task FROM ac_state WHERE user_id=?').get(f.b.userId)!.policy_task),null);
});

test('concurrent connector save keeps the caller CAS and cannot leave an orphan plugin declaration',async t=>{
 const f=await fixture(t);await f.ok(f.a.token,'/api/admin/connectors/gmail/install','POST',{expectedRevision:f.node.plugins!.catalog.revision(),operationId:randomUUID()});
 const baseline=await f.ok(f.a.token,'/api/connectors'),host=f.node.plugins!,original=host.forUser.bind(host);let release!:()=>void,entered!:()=>void,held=true;
 const barrier=new Promise<void>(resolve=>release=resolve),ready=new Promise<void>(resolve=>entered=resolve);
 host.forUser=((context:any)=>{const service=original(context);return {...service,view:async()=>{const view=await service.view();if(held){held=false;entered();await barrier;}return view;}};}) as typeof host.forUser;
 t.after(()=>{release();host.forUser=original;});
 const first=f.request(f.a.token,'/api/connectors/generated-a','PUT',{expectedRevision:baseline.revision,connection:{provider:'gmail',syncIntervalMs:60000,autoSync:false}});await ready;
 const second=await f.ok(f.a.token,'/api/connectors/generated-b','PUT',{expectedRevision:baseline.revision,connection:{provider:'gmail',syncIntervalMs:900000,autoSync:false}});assert.equal(second.connections.find((item:any)=>item.id==='generated-b').syncIntervalMs,900000);release();
 const stale=await first;assert.equal(stale.statusCode,409,stale.body);const current=await f.ok(f.a.token,'/api/connectors');assert.deepEqual(current.connections.map((item:any)=>[item.id,item.syncIntervalMs]),[['generated-b',900000]]);
 assert.equal(f.read(db=>db.prepare("SELECT count(*) n FROM plugin_user_instances WHERE user_id=? AND id='connector.generated-a'").get(f.a.userId)!.n),0);
});


test('connector tuning retains durable timers and immutable inputs; unsupported snapshots are explicit and never execute',async t=>{
 t.mock.timers.enable({apis:['Date'],now:Date.parse('2026-10-23T00:00:00Z')});let syncs=0,logins=0;
 const definition:ConnectorDefinition={id:'generated.config-contract',version:'1',name:'Generated config contract',operations:{login:z.object({}).strict()},create:()=>({status:()=>({connected:true}),sync:async()=>{syncs++;return {complete:true};},disconnect:async()=>({}),close:async()=>{},operate:async operation=>{if(operation==='login'){logins++;throw new ExecutionFailure('blocked','generated_authorization_unknown');}return {};}})};
 const f=await fixture(t,[definition]);await f.ok(f.a.token,'/api/admin/connectors/'+definition.id+'/install','POST',{expectedRevision:f.node.plugins!.catalog.revision(),operationId:randomUUID()});
 await f.ok(f.a.token,'/api/connectors/generated','PUT',{expectedRevision:(await f.ok(f.a.token,'/api/connectors')).revision,connection:{provider:definition.id,syncIntervalMs:60000,autoSync:true}});await f.ok(f.a.token,'/api/connectors/generated/enable','POST',{expectedRevision:(await f.ok(f.a.token,'/api/plugins')).revision});
 const admitted=await f.ok(f.a.token,'/api/connectors/generated/sync','POST',{operationId:'generated-initial-sync'});await f.node.execution!.tick();await f.node.execution!.engine.drain([admitted.id]);assert.equal(syncs,1);
 const timer=()=>f.read(db=>{const row=db.prepare('SELECT e.* FROM connector_timers c JOIN execution_steps e ON e.id=c.task_id WHERE c.user_id=? AND c.instance_id=?').get(f.a.userId,'generated')!;return {id:String(row.id),state:String(row.state),input:JSON.parse(String(row.input))};}),initial=timer();assert.equal(initial.input.configurationVersion,2);assert.equal(initial.input.schedule.syncIntervalMs,60000);
 const saved=(await f.ok(f.a.token,'/api/configuration')).domains.find((domain:any)=>domain.id==='connectorSettings').saved;
 await f.replace(f.a.token,'connectorSettings',{connections:saved.connections.map((value:any)=>({...value,syncIntervalMs:120000}))});assert.deepEqual(timer().input,initial.input);assert.equal((await f.ok(f.a.token,'/api/connectors')).connections[0].syncAuthorized,true);
 t.mock.timers.tick(60001);await f.node.execution!.tick();await f.node.execution!.engine.drain([initial.id]);assert.equal(syncs,2);const successor=timer();assert.notEqual(successor.id,initial.id);assert.equal(successor.input.schedule.syncIntervalMs,120000);
 await f.replace(f.a.token,'connectorSettings',{connections:saved.connections.map((value:any)=>({...value,syncIntervalMs:120000,autoSync:false}))});t.mock.timers.tick(120001);await f.node.execution!.tick();assert.equal(timer().id,successor.id);assert.equal((await f.ok(f.a.token,'/api/tasks/'+successor.id)).error,'connector_timer_paused');assert.equal(syncs,2);
 const document=parse(readFileSync(f.file,'utf8'));document.connectorSettings.connections[0].autoSync=true;writeFileSync(f.file,stringify(document));await f.ok(f.a.token,'/api/configuration/reload','POST',{});await f.node.execution!.tick();await f.node.execution!.engine.drain([successor.id]);assert.equal(syncs,3,'Existing timer authority resumes from ordinary file tuning');
 const unsupported=timer(),db=f.node.execution!.engine.store.db,{configurationVersion:_version,...old}=unsupported.input;db.prepare('UPDATE user_tasks SET input=? WHERE task_id=?').run(JSON.stringify(old),unsupported.id);db.prepare('UPDATE execution_steps SET input=?,available_at=0 WHERE id=?').run(JSON.stringify(old),unsupported.id);await f.node.execution!.tick();assert.equal(f.node.execution!.engine.get(unsupported.id)!.error,'connector_task_version_unsupported');assert.equal(syncs,3,'Unsupported admitted representation never opens an adapter or creates a successor');assert.equal(timer().id,unsupported.id);
 // Generic durable grant/task withdrawal wins before domain version checks.
 db.prepare('UPDATE task_authorizations SET revoked=1 WHERE task_id=?').run(unsupported.id);db.prepare("UPDATE execution_steps SET state='waiting',available_at=0 WHERE id=?").run(unsupported.id);await f.node.execution!.tick();assert.equal(f.node.execution!.engine.get(unsupported.id)!.state,'stale');assert.equal(f.node.execution!.engine.get(unsupported.id)!.error,'input_changed');await f.ok(f.a.token,'/api/tasks/'+unsupported.id+'/cancel','POST',{});await f.node.execution!.tick();assert.equal(f.node.execution!.engine.get(unsupported.id)!.state,'cancelled');assert.equal(syncs,3);
 // A new legitimate owner operation uses the current representation, while
 // unknown external issuance still takes precedence over format rejection.
 const unknown=await f.ok(f.a.token,'/api/connectors/generated/operations','POST',{operation:'login',operationId:'generated-unknown-login',payload:{}});await f.node.execution!.tick();await f.node.execution!.engine.drain([unknown.id]);assert.equal(logins,1);const task=await f.ok(f.a.token,'/api/tasks/'+unknown.id);assert.equal(task.externalState,'issued');assert.equal(task.confirmUnknownRequired,true);const current=f.node.execution!.engine.get(unknown.id)!,{configurationVersion:_unknownVersion,...unknownOld}=current.input;db.prepare('UPDATE user_tasks SET input=? WHERE task_id=?').run(JSON.stringify(unknownOld),unknown.id);db.prepare("UPDATE execution_steps SET input=?,state='waiting',available_at=0 WHERE id=?").run(JSON.stringify(unknownOld),unknown.id);await f.node.execution!.tick();assert.match(f.node.execution!.engine.get(unknown.id)!.error!,/external_result_unknown|physical_cleanup_unknown/);assert.equal(logins,1);
 await f.ok(f.a.token,'/api/admin/accounts','POST',{username:'generated-fence-admin',password,administrator:true});await f.ok(f.a.token,'/api/admin/accounts/'+f.a.userId,'PATCH',{disabled:true});db.prepare("UPDATE execution_steps SET state='waiting',available_at=0 WHERE id=?").run(unknown.id);await f.node.execution!.tick();assert.equal(f.node.execution!.engine.get(unknown.id)!.state,'stale');assert.equal(f.node.execution!.engine.get(unknown.id)!.error,'input_changed');assert.equal(logins,1,'Account withdrawal wins over both unsupported input and unresolved external issuance');
});


test('operator scheduling reload survives configuring-session logout without granting unowned defaults',async t=>{
 const f=await fixture(t),memory=(await f.ok(f.a.token,'/api/configuration')).domains.find((domain:any)=>domain.id==='memory').saved;
 await f.replace(f.a.token,'memory',memory,['memory:lifecycle.working.enabled','memory:lifecycle.insights.enabled']);await f.replace(f.a.token,'actions',{enabled:true,timeZone:'UTC'});await f.ok(f.b.token,'/api/configuration');
 const host=f.node.configuration!,entries=(host as any).entries as Map<string,{subject:any;service:any}>,entry=entries.get(f.a.userId)!,guard=host.domainSubjectGuard(entry.subject);guard();
 for(const subject of [{...entry.subject},await f.node.authority.authenticate(f.a.token)])assert.throws(host.domainSubjectGuard(subject),{code:'invalid_identity'});
 const identities=f.read(db=>db.prepare('SELECT id,generation,task_id,cursor FROM ma_automations WHERE user_id=? ORDER BY id').all(f.a.userId)),watch=f.read(db=>db.prepare('SELECT generation,policy_id,policy_task FROM ac_state WHERE user_id=?').get(f.a.userId));
 await f.ok(f.a.token,'/api/auth/logout','POST',{});await f.ok(f.b.token,'/api/auth/logout','POST',{});guard();
 const aFile=parse(readFileSync(f.file,'utf8'));aFile.memory.timeZone='Asia/Shanghai';aFile.memory.lifecycle.working.enabled=false;aFile.actions.timeZone='Asia/Shanghai';aFile.actions.enabled=false;writeFileSync(f.file,stringify(aFile));
 const bFile=join(f.directory,'configuration','users',f.b.userId,'mote.yaml'),bDocument=parse(readFileSync(bFile,'utf8'));bDocument.memory.timeZone='Asia/Shanghai';bDocument.actions={enabled:true,timeZone:'UTC'};writeFileSync(bFile,stringify(bDocument));
 await waitForState(async()=>f.read(db=>({actions:JSON.parse(String(db.prepare('SELECT settings FROM ac_state WHERE user_id=?').get(f.a.userId)!.settings)),memory:JSON.parse(String(db.prepare('SELECT settings FROM mm_state WHERE user_id=?').get(f.a.userId)!.settings)),b:db.prepare('SELECT policy_task,settings FROM ac_state WHERE user_id=?').get(f.b.userId)})),value=>value.actions.timeZone==='Asia/Shanghai'&&value.actions.enabled===false&&value.memory.timeZone==='Asia/Shanghai'&&JSON.parse(String(value.b!.settings)).enabled===true,'account-bound file scheduling after logout');
 assert.deepEqual(f.read(db=>db.prepare('SELECT id,generation,task_id,cursor FROM ma_automations WHERE user_id=? ORDER BY id').all(f.a.userId)),identities);assert.deepEqual(f.read(db=>db.prepare('SELECT generation,policy_id,policy_task FROM ac_state WHERE user_id=?').get(f.a.userId)),watch);assert.equal(f.read(db=>db.prepare('SELECT count(*) n FROM ma_automations WHERE user_id=?').get(f.b.userId)!.n),0);assert.equal(f.read(db=>db.prepare('SELECT policy_task FROM ac_state WHERE user_id=?').get(f.b.userId)!.policy_task),null);
 const renewed=await f.ok(undefined,'/api/auth/login','POST',{username:'generated-config-owner',password,mode:'client'});await f.ok(renewed.token,'/api/configuration');assert.throws(guard,{code:'invalid_identity'},'Retired factory binding cannot borrow a replacement entry');const current=entries.get(f.a.userId)!,currentGuard=host.domainSubjectGuard(current.subject);currentGuard();await f.ok(renewed.token,'/api/admin/accounts','POST',{username:'generated-second-admin',password,administrator:true});await f.ok(renewed.token,'/api/admin/accounts/'+f.a.userId,'PATCH',{disabled:true});assert.throws(currentGuard,{code:'invalid_identity'});await assert.rejects(current.service.reload(),{code:'invalid_identity'});
});
