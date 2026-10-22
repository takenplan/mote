import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {UserContextAuthority,type OperationClaim,type VerifiedOperationIdentity} from '../src/scope/context.js';
import {ScopedServices} from '../src/scope/services.js';
import {TaskExecution} from '../src/scope/task-execution.js';
import {LifecycleOperations} from '../src/scope/lifecycle-operations.js';
import type {ScopedRuntime} from '../src/scope/http.js';
import {existsSync,mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {z} from 'zod';
import {Configurations} from '../src/scope/configuration.js';
import type {Accounts} from '../src/scope/accounts.js';

function identityFixture(){
  const deploymentId=randomUUID(),userId=randomUUID(),grant=randomUUID();
  const operation:OperationClaim={id:randomUUID(),purpose:'personal-import',digest:'a'.repeat(64),readDomains:['configuration','private-data'],writeDomains:['private-data']};
  let sessionCurrent=true,operationCurrent=true;
  const owner={deploymentId,userId,credentialId:randomUUID(),authorizationEpoch:2,administrator:true};
  const admitted:VerifiedOperationIdentity={...owner,administrator:false,credentialId:grant,operation};
  const authority=new UserContextAuthority(deploymentId,{verify:async key=>key==='session'?owner:undefined,isCurrent:()=>sessionCurrent},undefined,undefined,{verify:async key=>key===grant?admitted:undefined,isCurrent:identity=>operationCurrent&&JSON.stringify(identity)===JSON.stringify(admitted)});
  return {authority,owner,grant,operation,logout:()=>{sessionCurrent=false;},revoke:()=>{operationCurrent=false;}};
}

test('operation identity survives only session logout and is never session, task or administrator authority',async()=>{
  const f=identityFixture(),session=await f.authority.authenticate('session'),operation=await f.authority.restoreOperation(f.grant);
  f.logout();assert.throws(()=>f.authority.assert(session));f.authority.assert(operation);
  assert.equal(f.authority.isSession(operation),false);assert.equal(f.authority.isTask(operation),false);
  assert.throws(()=>f.authority.assertAdministrator(operation));assert.throws(()=>f.authority.assert({...operation}));
  await assert.rejects(f.authority.restoreOperation(f.operation.id));
  assert.ok(Object.isFrozen(f.authority.operation(operation)!.writeDomains));
  f.revoke();assert.throws(()=>f.authority.assert(operation));
});

test('operation services expose only admitted export/import domains and exact operation identity',async()=>{
  const f=identityFixture(),context=await f.authority.restoreOperation(f.grant),services=new ScopedServices(f.authority),effects:string[]=[];
  const archive=(domain:string)=>({domain,version:1,deploymentId:context.deploymentId,userId:context.userId,payload:{generated:true}});
  for(const id of ['configuration','private-data','other'])services.registerUser(id,{scope:'user',create:()=>({private:true}),lifecycle:{exportUser:async()=>archive(id),importUser:()=>{effects.push(id);},deleteUser:async(_subject,operationId)=>({status:'complete',operationId}),restoreUser:async()=>{effects.push('restore');}}});
  const scoped=services.forUser(context);
  assert.equal((await scoped.exportUser('configuration')).domain,'configuration');
  await assert.rejects(scoped.exportUser('other'));
  assert.throws(()=>scoped.get('private-data'));assert.throws(()=>scoped.deleteUser('private-data',f.operation.id));
  assert.throws(()=>scoped.restoreUser('private-data',archive('private-data'),f.operation.id));
  assert.throws(()=>scoped.importUser('private-data',archive('private-data'),randomUUID()));
  assert.throws(()=>scoped.importUser('other',archive('other'),f.operation.id));
  scoped.importUser('private-data',archive('private-data'),f.operation.id);assert.deepEqual(effects,['private-data']);
  // The direct host boundary refuses the identity before constructing any task
  // capability; denying only services.get('execution') would be insufficient.
  assert.throws(()=>TaskExecution.prototype.forUser.call({authority:f.authority} as TaskExecution,context));
});

test('accepted import verifier rereads digest, registry, state and account epoch',async t=>{
  const db=new DatabaseSync(':memory:'),deploymentId=randomUUID(),userId=randomUUID(),id=randomUUID(),grant=randomUUID();
  t.after(()=>db.close());const lifecycle=new LifecycleOperations(db,deploymentId);t.after(()=>lifecycle.close());
  let enabled=true,epoch=3;
  let plan=[{id:'configuration',mode:'preserve'},{id:'private-data',mode:'merge'}];
  lifecycle.bind({accounts:{assertAccountEnabled:(user:string,value:number)=>{assert.equal(user,userId);assert.equal(value,epoch);assert.ok(enabled);}},services:{personalImportDomains:()=>plan}} as unknown as ScopedRuntime);
  db.prepare("INSERT INTO lifecycle_operations VALUES(?,?, 'import',?,'working',?,?,?,NULL,1,?)").run(id,userId,epoch,JSON.stringify(plan.map(item=>item.id)),'2026-10-23T00:00:00Z','2026-10-23T00:00:00Z','a'.repeat(64));
  db.prepare("INSERT INTO lifecycle_domains VALUES(?,?,'preserved',?)").run(id,'configuration',grant);
  db.prepare("INSERT INTO lifecycle_domains VALUES(?,?,'waiting',?)").run(id,'private-data',randomUUID());
  const identity=await lifecycle.importVerifier.verify(grant);assert.ok(identity);
  assert.deepEqual(identity.operation.writeDomains,['private-data']);assert.equal(lifecycle.importVerifier.isCurrent(identity),true);
  assert.equal(await lifecycle.importVerifier.verify(id),undefined);
  enabled=false;assert.equal(lifecycle.importVerifier.isCurrent(identity),false);enabled=true;
  epoch++;assert.equal(lifecycle.importVerifier.isCurrent(identity),false);epoch--;
  plan=[...plan,{id:'new-domain',mode:'merge'}];assert.equal(lifecycle.importVerifier.isCurrent(identity),false);plan=plan.slice(0,2);
  db.prepare('UPDATE lifecycle_operations SET sha256=? WHERE id=?').run('b'.repeat(64),id);assert.equal(lifecycle.importVerifier.isCurrent(identity),false);
  db.prepare('UPDATE lifecycle_operations SET sha256=? WHERE id=?').run('a'.repeat(64),id);
  for(const state of ['completed','cancelled','failed']){db.prepare('UPDATE lifecycle_operations SET state=? WHERE id=?').run(state,id);assert.equal(lifecycle.importVerifier.isCurrent(identity),false);assert.equal(await lifecycle.importVerifier.verify(grant),undefined);}
});

test('operation configuration export after logout retains the live runtime without effects or watcher replacement',async t=>{
  const f=identityFixture(),directory=mkdtempSync(join(tmpdir(),'mote-operation-config-')),db=new DatabaseSync(':memory:');
  const accounts={assertAccountEnabled:(userId:string,epoch:number)=>{assert.equal(userId,f.owner.userId);assert.equal(epoch,f.owner.authorizationEpoch);}} as Accounts;
  const host=await Configurations.open({directory,db,authority:f.authority,accounts});
  t.after(async()=>{await host.close();db.close();rmSync(directory,{recursive:true,force:true});});
  let prepared=0,effects=0;
  host.registerDomain('generated',()=>({id:'generated',schema:z.object({enabled:z.boolean()}),defaultValue:{enabled:true},resolve:raw=>raw,prepare:()=>{prepared++;return {apply(){}};}}));
  host.registerEffect('generated',()=>{effects++;return {apply(){}};});
  const session=await f.authority.authenticate('session');await host.forUser(session).view();
  const entries=(host as unknown as {entries:Map<string,{service:{watcher?:unknown};subject:unknown}>}).entries,entry=entries.get(session.userId)!;
  const watcher=entry.service.watcher,path=join(directory,'configuration','users',session.userId,'mote.yaml'),before=readFileSync(path,'utf8'),counts={prepared,effects};
  assert.ok(watcher);f.logout();const operation=await f.authority.restoreOperation(f.grant);
  const archive=await host.lifecycle.exportUser(operation);
  assert.equal(archive.domain,'configuration');assert.equal(entries.get(session.userId),entry);assert.equal(entry.subject,session);assert.equal(entry.service.watcher,watcher);
  assert.deepEqual({prepared,effects},counts);assert.equal(readFileSync(path,'utf8'),before);
  assert.throws(()=>host.forUser(operation));f.revoke();await assert.rejects(host.lifecycle.exportUser(operation));
});

test('operation configuration reads bypass unfinished session initialization and leave no cached runtime after its failure',{timeout:5000},async t=>{
  const f=identityFixture(),directory=mkdtempSync(join(tmpdir(),'mote-operation-opening-')),db=new DatabaseSync(':memory:');
  const accounts={assertAccountEnabled:(userId:string,epoch:number)=>{assert.equal(userId,f.owner.userId);assert.equal(epoch,f.owner.authorizationEpoch);}} as Accounts;
  let host=await Configurations.open({directory,db,authority:f.authority,accounts});
  const domain={id:'generated',schema:z.object({enabled:z.boolean()}),defaultValue:{enabled:true},resolve:(raw:unknown)=>raw};
  host.registerDomain('generated',()=>domain);const session=await f.authority.authenticate('session');await host.forUser(session).view();await host.close();
  host=await Configurations.open({directory,db,authority:f.authority,accounts});
  let release!:()=>void,entered!:()=>void;const gate=new Promise<void>(resolve=>{release=resolve;}),started=new Promise<void>(resolve=>{entered=resolve;});
  t.after(async()=>{release();await host.close();db.close();rmSync(directory,{recursive:true,force:true});});
  let prepared=0,effects=0;
  host.registerDomain('generated',subject=>({...domain,prepare:async()=>{prepared++;entered();await gate;f.authority.assert(subject as typeof session);return {apply(){}};}}));
  host.registerEffect('generated',()=>{effects++;return {apply(){}};});
  const opening=host.forUser(session).view().then(()=>undefined,error=>error);await started;
  const entries=(host as unknown as {entries:Map<string,unknown>}).entries,pending=entries.get(session.userId),path=join(directory,'configuration','users',session.userId,'mote.yaml'),before=readFileSync(path,'utf8');
  f.logout();const operation=await f.authority.restoreOperation(f.grant);
  assert.equal((await host.lifecycle.exportUser(operation)).domain,'configuration');
  assert.equal(entries.get(session.userId),pending);assert.equal(prepared,1);assert.equal(effects,0);assert.equal(readFileSync(path,'utf8'),before);
  release();assert.ok(await opening);assert.equal(entries.size,0);
  assert.equal((await host.lifecycle.exportUser(operation)).domain,'configuration');
  assert.equal(entries.size,0);assert.equal(prepared,1);assert.equal(effects,0);assert.equal(readFileSync(path,'utf8'),before);
});

test('operation configuration export resolves fresh defaults without creating an account directory or runtime',async t=>{
  const f=identityFixture(),directory=mkdtempSync(join(tmpdir(),'mote-operation-defaults-')),db=new DatabaseSync(':memory:');
  const accounts={assertAccountEnabled:(userId:string,epoch:number)=>{assert.equal(userId,f.owner.userId);assert.equal(epoch,f.owner.authorizationEpoch);}} as Accounts;
  const host=await Configurations.open({directory,db,authority:f.authority,accounts});
  t.after(async()=>{await host.close();db.close();rmSync(directory,{recursive:true,force:true});});
  let resolved=0,prepared=0,effects=0;
  host.registerDomain('generated',()=>({id:'generated',schema:z.object({enabled:z.boolean()}),defaultValue:{enabled:true},resolve:raw=>{resolved++;assert.deepEqual(raw,{enabled:true});return raw;},prepare:()=>{prepared++;return {apply(){}};}}));
  host.registerEffect('generated',()=>{effects++;return {apply(){}};});
  const ownerDirectory=join(directory,'configuration','users',f.owner.userId),path=join(ownerDirectory,'mote.yaml');
  assert.equal(existsSync(ownerDirectory),false);f.logout();const operation=await f.authority.restoreOperation(f.grant);
  const archive=await host.lifecycle.exportUser(operation);assert.equal(archive.domain,'configuration');assert.ok(resolved>0);
  assert.deepEqual({prepared,effects},{prepared:0,effects:0});assert.equal(existsSync(path),false);assert.equal(existsSync(ownerDirectory),false);
  assert.equal((host as unknown as {entries:Map<string,unknown>}).entries.size,0);
  f.revoke();await assert.rejects(host.lifecycle.exportUser(operation));assert.equal(existsSync(ownerDirectory),false);
});


test('a new-epoch operation reads configuration without reusing or replacing the retired account runtime',async t=>{
  const deploymentId=randomUUID(),userId=randomUUID(),directory=mkdtempSync(join(tmpdir(),'mote-operation-epoch-')),db=new DatabaseSync(':memory:');
  let epoch=2,revoked=false;
  const owner={deploymentId,userId,credentialId:randomUUID(),authorizationEpoch:epoch,administrator:true};
  const identities=new Map<string,VerifiedOperationIdentity>();
  const admit=()=>{const grant=randomUUID();identities.set(grant,{deploymentId,userId,credentialId:grant,authorizationEpoch:epoch,administrator:false,operation:{id:randomUUID(),purpose:'personal-import',digest:'a'.repeat(64),readDomains:['configuration'],writeDomains:[]}});return grant;};
  const authority=new UserContextAuthority(deploymentId,{verify:async key=>key==='session'?owner:undefined,isCurrent:identity=>identity.authorizationEpoch===epoch&&identity.credentialId===owner.credentialId},undefined,undefined,{verify:async grant=>identities.get(grant),isCurrent:identity=>!revoked&&identity.authorizationEpoch===epoch&&JSON.stringify(identity)===JSON.stringify(identities.get(identity.credentialId))});
  const accounts={assertAccountEnabled:(id:string,value:number)=>{assert.equal(id,userId);assert.equal(value,epoch);}} as Accounts;
  const host=await Configurations.open({directory,db,authority,accounts});
  t.after(async()=>{await host.close();db.close();rmSync(directory,{recursive:true,force:true});});
  let prepared=0,effects=0;
  host.registerDomain('generated',()=>({id:'generated',schema:z.object({enabled:z.boolean()}),defaultValue:{enabled:true},resolve:raw=>raw,prepare:()=>{prepared++;return {apply(){}};}}));
  host.registerEffect('generated',()=>{effects++;return {apply(){}};});
  const session=await authority.authenticate('session'),oldOperation=await authority.restoreOperation(admit());await host.forUser(session).view();
  const entries=(host as unknown as {entries:Map<string,{accessKey:string;service:{watcher?:unknown};subject:unknown}>}).entries,entry=entries.get(userId)!;
  const watcher=entry.service.watcher,path=join(directory,'configuration','users',userId,'mote.yaml'),before=readFileSync(path,'utf8'),counts={prepared,effects};
  assert.ok(watcher);assert.equal(entry.accessKey,'account:2');
  epoch=3;assert.throws(()=>authority.assert(session));assert.throws(()=>authority.assert(oldOperation));
  const currentOperation=await authority.restoreOperation(admit());assert.equal(currentOperation.authorizationEpoch,3);assert.notEqual(currentOperation.credentialId,oldOperation.credentialId);
  const archive=await host.lifecycle.exportUser(currentOperation);assert.equal(archive.domain,'configuration');assert.deepEqual((archive.payload as {document:{generated:unknown}}).document.generated,{enabled:true});
  assert.equal(entries.get(userId),entry);assert.equal(entry.subject,session);assert.equal(entry.service.watcher,watcher);assert.equal(entry.accessKey,'account:2');
  assert.equal(readFileSync(path,'utf8'),before);assert.deepEqual({prepared,effects},counts);assert.throws(()=>host.forUser(currentOperation));
  await assert.rejects(host.lifecycle.exportUser(oldOperation));revoked=true;await assert.rejects(host.lifecycle.exportUser(currentOperation));
  assert.equal(entries.get(userId),entry);assert.equal(readFileSync(path,'utf8'),before);assert.deepEqual({prepared,effects},counts);
});
