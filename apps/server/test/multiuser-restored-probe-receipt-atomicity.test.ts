import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID,createHash} from 'node:crypto';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {setTimeout as delay} from 'node:timers/promises';
import {buildApp} from '../src/app.js';
import {generatedScopedPluginRelease} from './fixtures/scoped-plugin-release.js';
import {backupScopedInstance,restoreScopedInstance} from '../../../scripts/scoped-backup.mjs';

const password='Generated-atomic-restore-01';
const protocol={'x-mote-protocol-version':'2','x-mote-ingress-version':'3'};
const hash=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');

// No purpose flag or manually assembled recovery task: the real stopped archive
// and trusted password route create every coordinator, scope and child receipt.
test('restored probe receipt failure rolls back child/check/grant; restart retries one exact fresh identity',async t=>{
 const root=mkdtempSync(join(tmpdir(),'mote-restored-probe-atomic-'));
 const source=join(root,'source'),backup=join(root,'backup'),target=join(root,'target');
 const release=generatedScopedPluginRelease();
 let host=await buildApp({dataDir:source},{pluginReleaseTransport:release.transport});
 let directory=source;
 let targetProbeCalls=0;
 const registerProbe=(restored:boolean)=>host.plugins!.registerCapabilityProbe(['model'],async input=>{
  input.assertCurrent();
  if(restored)targetProbeCalls++;
  return {capabilities:[{id:'generated.model',state:'verified'}],issues:[]};
 });
 registerProbe(false);
 t.after(async()=>{try{await host.app.close();}finally{rmSync(root,{recursive:true,force:true});}});
 const sql=<T>(work:(db:DatabaseSync)=>T)=>{
  const db=new DatabaseSync(join(directory,'mote.sqlite'));
  try{return work(db);}finally{db.close();}
 };
 const request=(token:string|undefined,url:string,method:any='GET',payload?:unknown)=>host.app.inject({
  url,method,headers:{...protocol,...(token?{authorization:'Bearer '+token}:{})},
  ...(payload===undefined?{}:{payload}),
 });
 const ok=async(...args:Parameters<typeof request>)=>{
  const response=await request(...args);assert.equal(response.statusCode,200,response.body);return response.json();
 };
 const login=(username:string)=>ok(undefined,'/api/auth/login','POST',{username,password,mode:'client'});
 const until=async(check:()=>boolean|Promise<boolean>,detail:()=>unknown)=>{
  const deadline=Date.now()+10000;
  while(!await check()){assert.ok(Date.now()<deadline,JSON.stringify(detail()));await delay(10);}
 };
 await host.accounts!.initialize('generated-admin',password);
 const admin=await login('generated-admin');
 await ok(admin.token,'/api/admin/accounts','POST',{username:'generated-a',password});
 await ok(admin.token,'/api/admin/accounts','POST',{username:'generated-b',password});
 const a=await login('generated-a'),b=await login('generated-b');
 const preview=await ok(admin.token,'/api/plugins/resolve','POST',{repository:release.repository,tag:release.tag});
 const installed=await ok(admin.token,'/api/plugins/install','POST',{
  previewId:preview.id,expectedRevision:host.plugins!.catalog.revision(),operationId:randomUUID(),
 });
 const packageId=installed.packages.find((value:any)=>value.version==='1').id;
 await until(()=>host.plugins!.catalog.view().packages.some(value=>value.id===packageId&&value.state==='installed'),()=>host.plugins!.catalog.view());
 let view=await ok(a.token,'/api/plugins');
 await ok(a.token,'/api/plugin-instances','POST',{expectedRevision:view.revision,instance:{
  id:'generated-restore',packageId,name:'Generated atomic restore',configuration:{label:'generated-a'},
  desired:false,grants:{capabilities:['model'],sourceIds:[],history:false},
 }});
 const first=await ok(a.token,'/api/plugin-instances/generated-restore/check','POST',{});
 await until(async()=>(await ok(a.token,'/api/tasks/'+first.taskId)).state==='succeeded',()=>first);
 view=await ok(a.token,'/api/plugins');assert.equal(view.instances[0].checked,true);
 await ok(a.token,'/api/plugin-instances/generated-restore/enable','POST',{expectedRevision:view.revision});
 const old=sql(db=>({
  tasks:db.prepare('SELECT id,attempts FROM execution_steps').all(),
  grants:db.prepare('SELECT grant_id FROM task_authorizations').all(),
 }));
 await host.app.close();await backupScopedInstance({source,out:backup});await restoreScopedInstance({from:backup,target});
 directory=target;host=await buildApp({dataDir:target},{pluginReleaseTransport:release.transport});registerProbe(true);
 const before=sql(db=>({
  checks:db.prepare('SELECT * FROM plugin_user_checks WHERE user_id=? ORDER BY instance_id').all(a.userId),
  restoration:db.prepare('SELECT restoration_id,epoch,payload FROM lifecycle_future WHERE user_id=?').get(a.userId)!,
 }));
 // Abort AFTER the exact receipt write. A separately committed child admission
 // would survive this real SQL failure and fail the no-orphan assertions below.
 sql(db=>db.exec(`CREATE TRIGGER generated_fail_restore_receipt AFTER UPDATE OF probe_task_id ON lifecycle_future_scopes
  WHEN NEW.probe_task_id IS NOT NULL
  BEGIN SELECT RAISE(ABORT,'generated_restore_receipt_fault'); END`));
 const fresh=await login('generated-a');
 const future=()=>sql(db=>db.prepare('SELECT * FROM lifecycle_future WHERE user_id=?').get(a.userId)!);
 await until(()=>{
  const row=future();return Boolean(row.task_id)&&sql(db=>db.prepare('SELECT state FROM execution_steps WHERE id=?').get(row.task_id)?.state==='blocked');
 },future);
 assert.equal(targetProbeCalls,0,'an uncommitted child must never reach the actual generated probe');
 const failed=sql(db=>({
  checks:db.prepare('SELECT * FROM plugin_user_checks WHERE user_id=? ORDER BY instance_id').all(a.userId),
  scopes:db.prepare('SELECT scope_key,state,probe_task_id FROM lifecycle_future_scopes WHERE user_id=?').all(a.userId),
  children:db.prepare("SELECT e.id FROM execution_steps e WHERE e.user_id=? AND e.kind='plugin.check' AND e.authorization_epoch=?").all(a.userId,before.restoration.epoch),
  orphanGrants:db.prepare("SELECT g.grant_id FROM task_authorizations g LEFT JOIN execution_steps e ON e.id=g.task_id WHERE g.user_id=? AND g.authorization_epoch=? AND (e.kind='plugin.check' OR e.id IS NULL)").all(a.userId,before.restoration.epoch),
 }));
 assert.deepEqual(failed.checks,before.checks,'failed atomic admission cannot replace the previous exact check receipt');
 assert.deepEqual(failed.children,[]);assert.deepEqual(failed.orphanGrants,[]);
 const failedScope=failed.scopes.find(row=>row.scope_key==='plugin:generated-restore');
 assert.ok(failedScope);assert.equal(failedScope.state,'failed');assert.equal(failedScope.probe_task_id,null);
 const blocked=await ok(fresh.token,'/api/tasks/'+future().task_id);
 assert.equal(blocked.error,'restore_future_requires_attention');
 assert.equal(blocked.progress.failedScope,'plugin:generated-restore');
 assert.equal((await ok(fresh.token,'/api/plugins')).instances[0].desired,false);
 assert.equal(sql(db=>db.prepare('SELECT task_id FROM lifecycle_future WHERE user_id=?').get(b.userId)!.task_id),null);
 sql(db=>db.exec('DROP TRIGGER generated_fail_restore_receipt'));
 await host.app.close();host=await buildApp({dataDir:target},{pluginReleaseTransport:release.transport});registerProbe(true);
 const resumed=await login('generated-a');
 await until(()=>future().state==='completed',future);
 const proof=sql(db=>({
  future:db.prepare('SELECT * FROM lifecycle_future WHERE user_id=?').get(a.userId)!,
  scope:db.prepare("SELECT * FROM lifecycle_future_scopes WHERE user_id=? AND scope_key='plugin:generated-restore'").get(a.userId)!,
  check:db.prepare("SELECT * FROM plugin_user_checks WHERE user_id=? AND instance_id='generated-restore'").get(a.userId)!,
  instance:db.prepare("SELECT * FROM plugin_user_instances WHERE user_id=? AND id='generated-restore'").get(a.userId)!,
  children:db.prepare("SELECT * FROM execution_steps WHERE user_id=? AND kind='plugin.check' AND authorization_epoch=?").all(a.userId,before.restoration.epoch),
 }));
 assert.equal(proof.children.length,1);assert.equal(targetProbeCalls,1);
 const child=proof.children[0],definition=JSON.parse(String(proof.instance.json));
 assert.equal(proof.future.restoration_id,before.restoration.restoration_id);
 assert.equal(proof.future.task_id,blocked.id,'restart retries the same fresh coordinator');
 assert.equal(proof.scope.restoration_id,proof.future.restoration_id);
 assert.equal(proof.scope.probe_task_id,child.id);assert.equal(proof.check.task_id,child.id);
 assert.equal(JSON.parse(String(child.input)).id,proof.check.id);
 assert.equal(child.user_id,a.userId);assert.equal(child.authorization_epoch,proof.future.epoch);
 assert.equal(proof.check.generation,proof.instance.generation);
 assert.equal(proof.check.signature,hash([definition.packageId,definition.configuration,definition.grants]));
 assert.equal(definition.revocation,proof.future.restoration_id);
 const childGrant=sql(db=>db.prepare('SELECT * FROM task_authorizations WHERE task_id=?').get(child.id)!);
 assert.equal(childGrant.grant_id,child.grant_id);assert.equal(childGrant.user_id,a.userId);
 assert.equal(childGrant.authorization_epoch,proof.future.epoch);assert.equal(childGrant.revoked,0);
 const saved=JSON.parse(String(proof.future.payload)).plugins[0];
 assert.equal(saved.configurationHash,hash([definition.packageId,definition.configuration]));
 assert.deepEqual(saved.scopeIntent,definition.grants);
 view=await ok(resumed.token,'/api/plugins');assert.equal(view.instances[0].checked,true);assert.equal(view.instances[0].desired,true);
 for(const task of old.tasks)assert.equal(sql(db=>db.prepare('SELECT attempts FROM execution_steps WHERE id=?').get(task.id)!.attempts),task.attempts);
 for(const grant of old.grants)assert.equal(sql(db=>db.prepare('SELECT revoked FROM task_authorizations WHERE grant_id=?').get(grant.grant_id)!.revoked),1);
 // Completed recovery survives another real app restart without a new child,
 // receipt, provider entry or authority for B or an old completed source task.
 await host.app.close();host=await buildApp({dataDir:target},{pluginReleaseTransport:release.transport});registerProbe(true);
 await login('generated-a');
 assert.equal(future().task_id,proof.future.task_id);
 assert.equal(sql(db=>db.prepare("SELECT probe_task_id FROM lifecycle_future_scopes WHERE user_id=? AND scope_key='plugin:generated-restore'").get(a.userId)!.probe_task_id),child.id);
 assert.equal(sql(db=>db.prepare("SELECT count(*) n FROM execution_steps WHERE user_id=? AND kind='plugin.check' AND authorization_epoch=?").get(a.userId,proof.future.epoch)!.n),1);
 assert.equal(targetProbeCalls,1);assert.equal(sql(db=>db.prepare('SELECT task_id FROM lifecycle_future WHERE user_id=?').get(b.userId)!.task_id),null);
 assert.equal((await request(b.token,'/api/auth/self')).statusCode,401);
});
