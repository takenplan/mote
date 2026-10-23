import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {ActionDiscovery} from '../src/scope/action-discovery.js';
import {AskAutomations} from '../src/scope/ask-automation.js';
import {PrivateSql} from '../src/scope/private-data-sql.js';
import {ScopeError} from '../src/scope/baseline.js';
import {defaultMemorySettings} from '../src/scope/memory-schema.js';
import type {ConfigurationEffect} from '../src/scope/configuration-coordination.js';

const owner='generated-wakeup-owner',other='generated-wakeup-other';
test('Actions configuration wake reads through its fixed guard and retries only the exact current owner watch',t=>{
 const db=new DatabaseSync(':memory:'),policy=randomUUID(),taskId='generated-watch',retried:string[]=[];let current=true,grant=true,guardCalls=0;
 t.after(()=>db.close());db.exec('CREATE TABLE ac_state(user_id TEXT PRIMARY KEY,generation INTEGER,policy_id TEXT,policy_task TEXT,deleted INTEGER)');db.prepare('INSERT INTO ac_state VALUES(?,1,?,?,0)').run(owner,policy,taskId);db.prepare('INSERT INTO ac_state VALUES(?,1,?,?,0)').run(other,policy,'foreign-watch');
 const guard=()=>{guardCalls++;if(!current)throw new ScopeError('invalid_identity',401);},sql=new PrivateSql(db,owner,guard),base={id:taskId,state:'waiting',kind:'actions.watch',ownership:{userId:owner},input:{id:policy,generation:1}};let step=structuredClone(base);
 const target={host:{execution:{engine:{get:(id:string)=>{assert.equal(id,taskId,'Owner-bound SQL cannot inspect the other account watch');return step;},isCurrentInputAuthority:()=>grant,retry:(id:string,ownerAction:boolean)=>{assert.equal(ownerAction,false);retried.push(id);}}}}};
 const wake=()=>ActionDiscovery.prototype.wake.call(target as unknown as ActionDiscovery,sql);wake();assert.deepEqual(retried,[taskId]);assert.ok(guardCalls>0);
 for(const changed of [{ownership:{userId:other}},{kind:'unrelated.task'},{input:{id:randomUUID(),generation:1}},{input:{id:policy,generation:2}},{input:{id:policy,generation:'1'}},{state:'running'}]){step={...structuredClone(base),...changed} as typeof base;wake();assert.equal(retried.length,1);}
 step=structuredClone(base);grant=false;wake();assert.equal(retried.length,1);grant=true;db.prepare('UPDATE ac_state SET deleted=1 WHERE user_id=?').run(owner);wake();assert.equal(retried.length,1);
 current=false;assert.throws(wake,{code:'invalid_identity'});assert.equal(retried.length,1,'Retired account/configuration binding cannot wake work');
});

test('Ask configuration completion reasserts the registered domain and never retries a mismatched or revoked coordinator',async t=>{
 const db=new DatabaseSync(':memory:'),policy=randomUUID(),generation=randomUUID(),taskId='generated-ask-watch',retried:string[]=[],observed:string[]=[];let current=true,grant=true,guardCalls=0,effect:ConfigurationEffect|undefined;
 db.exec('CREATE TABLE ma_automations(user_id TEXT,id TEXT,generation TEXT,state TEXT,input TEXT,settings TEXT,sources TEXT,task_id TEXT,cursor INTEGER,last_success INTEGER,created_at TEXT,PRIMARY KEY(user_id,id))');
 const settings=defaultMemorySettings();for(const user of [owner,other])db.prepare("INSERT INTO ma_automations VALUES(?,?,?,'active',?,?,'[]',?,0,0,?)").run(user,policy,generation,JSON.stringify({id:policy,kind:'working',includeExisting:false,timeZone:'UTC'}),JSON.stringify(settings.lifecycle),user===owner?taskId:'foreign-ask-watch',new Date().toISOString());
 const guard=()=>{guardCalls++;if(!current)throw new ScopeError('invalid_identity',401);},configuration={registerEffect:(_domain:string,registered:ConfigurationEffect)=>{effect=registered;},domainSubjectGuard:()=>guard},base={id:taskId,state:'waiting',kind:'ask.automation',ownership:{userId:owner},input:{id:policy,generation}};let step=structuredClone(base);
 const execution={register:()=>()=>{},engine:{abortLocal:()=>assert.fail('No retirement was admitted'),get:(id:string)=>{observed.push(id);assert.equal(id,taskId);return step;},isCurrentInputAuthority:()=>grant,retry:(id:string,ownerAction:boolean)=>{assert.equal(ownerAction,false);retried.push(id);}}},runtime={services:{registerUser:()=>{}}};
 const automations=new AskAutomations(runtime as any,db,configuration as any,execution as any,{} as any);t.after(async()=>{await automations.close();db.close();});assert.ok(effect);
 const candidate=await effect({userId:owner} as any,settings,settings,{source:'reload',revision:0,requested:false,intentPaths:[],processingPreserveImagePlan:false});candidate.publish?.();candidate.complete?.();assert.deepEqual(retried,[taskId]);assert.ok(guardCalls>=3);assert.deepEqual(observed,[taskId]);
 for(const changed of [{ownership:{userId:other}},{kind:'unrelated.task'},{input:{id:randomUUID(),generation}},{input:{id:policy,generation:randomUUID()}},{input:{id:policy,generation:undefined}},{state:'running'}]){step={...structuredClone(base),...changed} as typeof base;candidate.complete?.();assert.equal(retried.length,1);}
 step=structuredClone(base);grant=false;candidate.complete?.();assert.equal(retried.length,1);grant=true;current=false;assert.throws(()=>candidate.complete?.(),{code:'invalid_identity'});assert.equal(retried.length,1,'Expired configuration callback cannot requeue account work');
});
