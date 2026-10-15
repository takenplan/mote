import test from 'node:test';
import assert from 'node:assert/strict';
import {UserContextAuthority,type DurableIdentityVerifier,type IdentityVerifier,type VerifiedIdentity} from '../src/scope/context.js';
import {ScopedServices} from '../src/scope/services.js';

const identity=(patch:Partial<VerifiedIdentity>={}):VerifiedIdentity=>({deploymentId:'generated-deployment',userId:'generated-user-a',credentialId:'generated-session-a',authorizationEpoch:1,administrator:true,...patch});
function fixture(){
  let sessionCurrent=true,accountEnabled=true,epoch=1;
  const session=identity(),tasks=new Map<string,VerifiedIdentity>([['generated-task-grant',identity({credentialId:'generated-task-grant'})]]);
  const verifier:IdentityVerifier={verify:async token=>token==='generated-session'?session:undefined,isCurrent:value=>sessionCurrent&&accountEnabled&&value.credentialId===session.credentialId&&value.userId===session.userId&&value.authorizationEpoch===epoch};
  const taskVerifier:DurableIdentityVerifier={verify:async grantId=>tasks.get(grantId),isCurrent:value=>accountEnabled&&value.authorizationEpoch===epoch&&[...tasks.values()].some(task=>task.deploymentId===value.deploymentId&&task.userId===value.userId&&task.credentialId===value.credentialId&&task.authorizationEpoch===value.authorizationEpoch)};
  const authority=new UserContextAuthority('generated-deployment',verifier,taskVerifier);
  return {authority,verifier,taskVerifier,tasks,logout:()=>{sessionCurrent=false;},disable:()=>{accountEnabled=false;},reset:()=>{epoch++;}};
}

test('durable task contexts survive session logout but reject disabled and reset account epochs',async()=>{
  for(const revoke of ['disable','reset'] as const){
    const f=fixture(),session=await f.authority.authenticate('generated-session'),task=await f.authority.restoreTask('generated-task-grant');
    assert.ok(Object.isFrozen(task));assert.equal(task.userId,session.userId);assert.equal(task.authorizationEpoch,1);
    f.logout();assert.throws(()=>f.authority.assert(session),{code:'invalid_identity'});f.authority.assert(task);
    f[revoke]();assert.throws(()=>f.authority.assert(task),{code:'invalid_identity'});
    await assert.rejects(f.authority.restoreTask('generated-task-grant'),{code:'invalid_identity'});
  }
});

test('task grants cannot issue administrator capabilities or authenticate a normal credential',async()=>{
  const f=fixture(),session=await f.authority.authenticate('generated-session'),task=await f.authority.restoreTask('generated-task-grant');
  f.authority.assertAdministrator(session);
  assert.throws(()=>f.authority.assertAdministrator(task),{code:'invalid_identity',statusCode:403});
  const services=new ScopedServices(f.authority);
  services.registerInstance('generated-instance',{scope:'instance',service:{secret:'generated-only'}});
  assert.throws(()=>services.forInstance(task),{statusCode:403});
  await assert.rejects(f.authority.authenticate('generated-task-grant'),{code:'invalid_identity'});
  await assert.rejects(f.authority.restoreTask('generated-session'),{code:'invalid_identity'});
});

test('copied, deserialized, foreign and revoked task contexts never become host identities',async()=>{
  const f=fixture(),task=await f.authority.restoreTask('generated-task-grant');
  for(const fake of [{...task},structuredClone(task),JSON.parse(JSON.stringify(task)),Object.create(task),undefined])assert.throws(()=>f.authority.assert(fake),{code:'invalid_identity'});
  assert.throws(()=>fixture().authority.assert(task),{code:'invalid_identity'});
  assert.throws(()=>{(task as any).userId='generated-user-b';});
  f.tasks.clear();assert.throws(()=>f.authority.assert(task),{code:'invalid_identity'});
});

test('restoration validates the durable verifier result before issuing an immutable identity',async()=>{
  const f=fixture();
  for(const patch of [{deploymentId:'other-deployment'},{userId:'../user'},{credentialId:''},{authorizationEpoch:-1},{authorizationEpoch:1.5},{administrator:undefined}] as Partial<VerifiedIdentity>[]){
    f.tasks.set('generated-task-grant',identity(patch));
    await assert.rejects(f.authority.restoreTask('generated-task-grant'),{code:'invalid_identity'});
  }
  for(const value of [undefined,null,{},'', '../grant','missing-grant'])await assert.rejects(f.authority.restoreTask(value),{code:'invalid_identity'});
  await assert.rejects(new UserContextAuthority('generated-deployment',f.verifier).restoreTask('generated-task-grant'),{code:'invalid_identity'});
  const supplied=identity({credentialId:'generated-task-grant'});f.tasks.set('generated-task-grant',supplied);
  const task=await f.authority.restoreTask('generated-task-grant');
  (supplied as {userId:string}).userId='generated-user-b';assert.equal(task.userId,'generated-user-a');
  assert.throws(()=>f.authority.assert(task),{code:'invalid_identity'});
});

test('a durable grant withdrawn while its verifier is awaiting cannot issue a usable context',async()=>{
  let finish!:(value:VerifiedIdentity)=>void,current=true;
  const authority=new UserContextAuthority('generated-deployment',{verify:async()=>undefined,isCurrent:()=>false},{verify:()=>new Promise(resolve=>{finish=resolve;}),isCurrent:()=>current});
  const pending=authority.restoreTask('generated-task-grant');current=false;finish(identity({credentialId:'generated-task-grant'}));
  await assert.rejects(pending,{code:'invalid_identity'});
});
