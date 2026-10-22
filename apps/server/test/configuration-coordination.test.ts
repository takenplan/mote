import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,readFileSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {z} from 'zod';
import {parse,stringify} from 'yaml';
import {ConfigService} from '../src/config-service.js';
import {ConfigurationCoordination,configurationEnables,type ConfigurationChange} from '../src/scope/configuration-coordination.js';
import {UserContextAuthority,type VerifiedIdentity} from '../src/scope/context.js';
import {ScopedServices} from '../src/scope/services.js';
import {TaskAuthorization} from '../src/scope/task-authorization.js';
import {TaskExecution} from '../src/scope/task-execution.js';
import type {Accounts} from '../src/scope/accounts.js';
import {EXECUTION_POLICIES} from '../src/execution-policy.js';

function identity(){const value:VerifiedIdentity={deploymentId:'generated-config-host',userId:'generated-owner',credentialId:'generated-session',authorizationEpoch:1,administrator:false};return {value,verifier:{verify:async(token:string)=>token==='generated-token'?value:undefined,isCurrent:(candidate:Readonly<VerifiedIdentity>)=>candidate===value||candidate.credentialId===value.credentialId}};}

test('intent distinguishes explicit owner enablement from untouched defaults and untrusted metadata',async()=>{
 const id=identity(),authority=new UserContextAuthority(id.value.deploymentId,id.verifier),context=await authority.authenticate('generated-token'),coordination=new ConfigurationCoordination(),seen:ConfigurationChange[]=[];
 coordination.register('memory',(_subject,_next,_previous,change)=>{seen.push(change);return {apply(){}};});
 const document={version:1 as const,revision:0,memory:{enabled:true}},request=coordination.request(context,{memory:{enabled:true}},['memory:lifecycle.working.enabled']);
 await coordination.prepare(context,document,document,{source:'update',revision:0,requestedDomains:['memory'],request});
 assert.equal(configurationEnables(seen.at(-1)!,'lifecycle.working.enabled',true,true),true);
 const untouched=coordination.request(context,{memory:{enabled:true}});await coordination.prepare(context,document,document,{source:'update',revision:0,requestedDomains:['memory'],request:untouched});
 assert.equal(configurationEnables(seen.at(-1)!,'lifecycle.working.enabled',true,true),false);
 assert.equal(configurationEnables(seen.at(-1)!,'lifecycle.working.enabled',true,false),true);
 await coordination.prepare(context,{...document,memory:{enabled:false}},document,{source:'reload',revision:0,requestedDomains:['memory'],request});
 assert.equal(seen.at(-1)!.context,undefined);assert.equal(configurationEnables(seen.at(-1)!,'lifecycle.working.enabled',true,false),false);
 const forged={context,values:{memory:{}},intent:['memory:lifecycle.working.enabled']};await coordination.prepare(context,document,document,{source:'initialize',revision:0,requestedDomains:['memory'],request:forged});assert.equal(seen.at(-1)!.context,undefined);
 assert.throws(()=>coordination.request(context,{memory:{}},['memory:sourceIds']),{code:'config_invalid'});
 assert.throws(()=>coordination.request(context,{actions:{}},['memory:lifecycle.working.enabled']),{code:'config_invalid'});
});

test('session provenance excludes durable task and MCP identities even when their account fields match',async()=>{
 const id=identity(),durable={verify:async()=>id.value,isCurrent:()=>true},authority=new UserContextAuthority(id.value.deploymentId,id.verifier,durable,durable);
 assert.equal(authority.isSession(await authority.authenticate('generated-token')),true);
 assert.equal(authority.isSession(await authority.restoreTask('generated-grant')),false);
 assert.equal(authority.isSession(await authority.authenticateMcp('generated-mcp')),false);
});

test('one config publication rolls back actual task/grant/operation admission and keeps prior authority',async t=>{
 const directory=mkdtempSync(join(tmpdir(),'mote-config-coordination-')),db=new DatabaseSync(':memory:'),id=identity(),accounts={assertAccountEnabled:(user:string,epoch:number)=>{assert.equal(user,id.value.userId);assert.equal(epoch,1);}} as Accounts,grants=new TaskAuthorization(db,accounts,id.value.deploymentId),authority=new UserContextAuthority(id.value.deploymentId,id.verifier,grants),services=new ScopedServices(authority),execution=new TaskExecution(db,authority,services,grants),context=await authority.authenticate('generated-token');
 let executions=0,fail=false,admitted:string|undefined;
 execution.register({kind:'generated.config-policy',pool:'generated.config',concurrency:()=>1,policy:EXECUTION_POLICIES.deterministic,parseInput:raw=>z.object({label:z.string()}).strict().parse(raw),execute:async()=>{executions++;return null;}});
 const previous=execution.forUser(context).submitSync({kind:'generated.config-policy',operationId:'previous',input:{label:'previous'}}),before={};
 for(const table of ['user_tasks','task_authorizations','execution_steps','operation_progress'])Object.assign(before,{[table]:db.prepare('SELECT count(*) n FROM '+table).get()!.n});
 const service=new ConfigService({path:join(directory,'mote.yaml'),watch:false,initialDocument:{version:1,revision:0},publication:work=>{db.exec('BEGIN IMMEDIATE');try{work();db.exec('COMMIT');}catch(error){db.exec('ROLLBACK');throw error;}},prepareTransaction:(_next,_old,transaction)=>({apply(){},publish(){if(transaction.source!=='update')return;admitted=execution.forUser(context).submitSync({kind:'generated.config-policy',operationId:'new',input:{label:'new'}}).id;db.prepare('INSERT INTO generated_policy VALUES(?)').run(admitted);if(fail)throw Error('Generated failure after real enqueue');},rollback(){}})});
 service.register({id:'actions',schema:z.object({enabled:z.boolean()}),defaultValue:{enabled:false},resolve:value=>value});db.exec('CREATE TABLE generated_policy(task_id TEXT PRIMARY KEY)');
 t.after(async()=>{await service.close();await execution.close();db.close();rmSync(directory,{recursive:true,force:true});});await service.initialize();fail=true;
 await assert.rejects(service.updateMany({actions:{enabled:true}},0),{code:'config_apply_failed'});
 assert.ok(admitted);assert.equal(execution.engine.get(admitted),undefined);assert.equal(db.prepare('SELECT count(*) n FROM generated_policy').get()!.n,0);
 for(const [table,count] of Object.entries(before))assert.equal(db.prepare('SELECT count(*) n FROM '+table).get()!.n,count,table);
 const prior=execution.engine.get(previous.id)!;grants.assertExecutionTaskIdentity(prior);assert.equal(prior.state,'waiting');assert.deepEqual(service.current('actions'),{enabled:false});
 await execution.tick();await execution.engine.drain([previous.id]);assert.equal(executions,1,'Only the previously authorized task executes');assert.equal(execution.engine.get(admitted),undefined);
 fail=false;await service.updateMany({actions:{enabled:true}},service.revision);assert.ok(execution.engine.get(admitted));
 const file=parse(readFileSync(service.path,'utf8'));file.actions.enabled=false;writeFileSync(service.path,stringify(file));await service.reload();assert.equal(service.current<{enabled:boolean}>('actions').enabled,false);
});

test('effect composition disposes partial preparation and preserves rollback timing/uncertainty',async t=>{
 const directory=mkdtempSync(join(tmpdir(),'mote-config-effects-')),id=identity(),authority=new UserContextAuthority(id.value.deploymentId,id.verifier),context=await authority.authenticate('generated-token'),document={version:1 as const,revision:0,actions:{enabled:true}};
 t.after(()=>rmSync(directory,{recursive:true,force:true}));
 const partial=new ConfigurationCoordination();let disposed=false;partial.register('actions',()=>({apply(){},dispose:async()=>{await Promise.resolve();disposed=true;}}));partial.register('actions',()=>{throw Error('Generated preparation failure');});await assert.rejects(partial.prepare(context,document,document,{source:'initialize',revision:0,requestedDomains:[]}));assert.equal(disposed,true);
 for(const afterPublish of [false,true]){
  const effects=new ConfigurationCoordination();let rolledBack=false;
  effects.register('actions',(_s,_n,_p,change)=>change.source==='initialize'?{apply(){}}:{apply(){},publish(){},rollback:async()=>{await Promise.resolve();rolledBack=true;}});
  effects.register('actions',(_s,_n,_p,change)=>change.source==='initialize'?{apply(){}}:{apply(){if(!afterPublish)throw Error('Generated apply failure');},publish(){throw Error('Generated publish failure');},rollback(){}});
  const service=new ConfigService({path:join(directory,String(afterPublish)+'.yaml'),watch:false,initialDocument:{version:1,revision:0},prepareTransaction:(next,previous,transaction)=>effects.prepare(context,next,previous,transaction)});service.register({id:'actions',schema:z.object({enabled:z.boolean()}),defaultValue:{enabled:false},resolve:value=>value});await service.initialize();
  await assert.rejects(service.updateMany({actions:{enabled:true}},0),{code:afterPublish?'config_commit_uncertain':'config_apply_failed'});await Promise.resolve();assert.equal(rolledBack,true);await service.close();
 }
});

test('composition attempts every sibling rollback after synchronous or asynchronous failure',async()=>{
 const id=identity(),authority=new UserContextAuthority(id.value.deploymentId,id.verifier),context=await authority.authenticate('generated-token'),document={version:1 as const,revision:0,actions:{enabled:true}};
 for(const asynchronous of [false,true]){const effects=new ConfigurationCoordination();let projection=0,disposed=0;
 effects.register('actions',()=>({apply(){},publish(){projection=1;},rollback(){projection=0;},dispose(){disposed++;}}));
 effects.register('actions',()=>({apply(){},publish(){},rollback:asynchronous?async()=>{throw Error('Generated async rollback failure');}:()=>{throw Error('Generated rollback failure');},dispose(){disposed++;}}));
 const candidate=await effects.prepare(context,document,document,{source:'initialize',revision:0,requestedDomains:[]});await candidate.apply();candidate.publish!();
 if(asynchronous)await assert.rejects(Promise.resolve().then(()=>candidate.rollback!()));else assert.throws(()=>candidate.rollback!());assert.equal(projection,0);await candidate.dispose!();assert.equal(disposed,2);
 }
});

test('whole-document effects publish after high-order domains and ordinary effects, with atomic reverse rollback',async t=>{
 const directory=mkdtempSync(join(tmpdir(),'mote-config-publication-')),db=new DatabaseSync(':memory:'),id=identity(),authority=new UserContextAuthority(id.value.deploymentId,id.verifier),context=await authority.authenticate('generated-token'),effects=new ConfigurationCoordination(),events:string[]=[];let fail=false,runtime=false,completions=0;
 db.exec('CREATE TABLE facts(domain INTEGER,projection INTEGER,receipt INTEGER);INSERT INTO facts VALUES(0,0,0)');
 const fact=(field:string)=>Number(db.prepare('SELECT '+field+' value FROM facts').get()!.value);
 effects.register('actions',(_subject,next,previous)=>{const value=(next as {enabled:boolean}).enabled,prior=(previous as {enabled:boolean}).enabled;return {applyOrder:5000,apply(){events.push('apply:ordinary');},publish(){events.push('publish:ordinary');assert.equal(db.isTransaction,true);assert.equal(fact('domain'),Number(value));db.prepare('UPDATE facts SET projection=?').run(Number(value));},rollback(){events.push('rollback:ordinary');db.prepare('UPDATE facts SET projection=?').run(Number(prior));}};});
 effects.registerPublication((_subject,next,previous)=>{const value=(next.actions as {enabled:boolean}).enabled,prior=(previous.actions as {enabled:boolean}).enabled;return {applyOrder:-5000,apply(){events.push('apply:final');},publish(){events.push('publish:final');assert.equal(db.isTransaction,true);assert.equal(fact('domain'),Number(value));assert.equal(fact('projection'),Number(value));db.prepare('UPDATE facts SET receipt=?').run(Number(value));if(fail)throw Error('Generated failure after final receipt');},rollback(){events.push('rollback:final');db.prepare('UPDATE facts SET receipt=?').run(Number(prior));},complete(){completions++;}};});
 const service=new ConfigService({path:join(directory,'mote.yaml'),watch:false,initialDocument:{version:1,revision:0},publication:work=>{db.exec('BEGIN IMMEDIATE');try{work();db.exec('COMMIT');}catch(error){db.exec('ROLLBACK');throw error;}},prepareTransaction:(next,previous,transaction)=>effects.prepare(context,next,previous,transaction)});
 service.register({id:'actions',schema:z.object({enabled:z.boolean()}),defaultValue:{enabled:false},resolve:value=>value,prepare:(next,previous)=>({applyOrder:1000,apply(){events.push('apply:domain');},publish(){events.push('publish:domain');runtime=next.enabled;db.prepare('UPDATE facts SET domain=?').run(Number(next.enabled));},rollback(){events.push('rollback:domain');runtime=previous.enabled;db.prepare('UPDATE facts SET domain=?').run(Number(previous.enabled));}})});
 t.after(async()=>{await service.close();db.close();rmSync(directory,{recursive:true,force:true});});
 for(const work of [()=>service.initialize(),()=>service.updateMany({actions:{enabled:true}},service.revision)]){events.length=0;await work();assert.deepEqual(events,['apply:final','apply:ordinary','apply:domain','publish:domain','publish:ordinary','publish:final']);}
 assert.equal(runtime,true);assert.equal(completions,2);fail=true;events.length=0;await assert.rejects(service.updateMany({actions:{enabled:false}},service.revision),{code:'config_apply_failed'});assert.deepEqual(events.slice(-3),['rollback:final','rollback:ordinary','rollback:domain']);assert.equal(runtime,true);assert.deepEqual({...db.prepare('SELECT * FROM facts').get()},{domain:1,projection:1,receipt:1});assert.deepEqual(service.current('actions'),{enabled:true});assert.equal(completions,2,'No postcommit finalization after rolled-back publication');
});

test('whole-document image preservation fact requires the exact opaque host update request',async()=>{
 const id=identity(),authority=new UserContextAuthority(id.value.deploymentId,id.verifier),context=await authority.authenticate('generated-token'),effects=new ConfigurationCoordination(),seen:ConfigurationChange[]=[],document={version:1 as const,revision:0,perception:{enabled:true}};
 effects.registerPublication((_subject,_next,_previous,change)=>{seen.push(change);return {apply(){}};});
 const request=effects.request(context,{perception:{enabled:true}},[],{processingPreserveImagePlan:true});
 await effects.prepare(context,document,document,{source:'update',revision:0,requestedDomains:['perception'],request});assert.equal(seen.at(-1)!.processingPreserveImagePlan,true);assert.equal(seen.at(-1)!.context,context);
 for(const source of ['initialize','reload'] as const){await effects.prepare(context,document,document,{source,revision:0,requestedDomains:[],request});assert.equal(seen.at(-1)!.processingPreserveImagePlan,false);assert.equal(seen.at(-1)!.context,undefined);}
 await effects.prepare(context,{...document,processingPreserveImagePlan:true},document,{source:'update',revision:0,requestedDomains:['perception'],request:{context,processingPreserveImagePlan:true}});assert.equal(seen.at(-1)!.processingPreserveImagePlan,false);assert.equal(seen.at(-1)!.context,undefined);
 assert.throws(()=>effects.request(context,{perception:{}},[],{processingPreserveImagePlan:false} as any),{code:'config_invalid'});
});

test('prepublication resource cleanup reverses actual apply order across ordinary and final effects',async()=>{
 const id=identity(),authority=new UserContextAuthority(id.value.deploymentId,id.verifier),context=await authority.authenticate('generated-token'),effects=new ConfigurationCoordination(),events:string[]=[],document={version:1 as const,revision:0,actions:{enabled:true}};
 effects.register('actions',()=>({applyOrder:100,apply(){events.push('apply:ordinary');throw Error('Generated resource install failure');},rollback(){events.push('rollback:ordinary');}}));
 effects.registerPublication(()=>({applyOrder:-100,apply(){events.push('apply:final');},rollback(){events.push('rollback:final');}}));
 const candidate=await effects.prepare(context,document,document,{source:'initialize',revision:0,requestedDomains:[]});await assert.rejects(Promise.resolve().then(()=>candidate.apply()));await candidate.rollback!();assert.deepEqual(events,['apply:final','apply:ordinary','rollback:ordinary','rollback:final']);
});
