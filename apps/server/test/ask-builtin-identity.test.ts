import test,{type TestContext} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {buildApp} from '../src/app.js';
import {source} from './fixtures/scoped-query-accounts.js';

const ids={working:'00000000-0000-4000-8000-000000000001',insights:'00000000-0000-4000-8000-000000000002'} as const;
async function fixture(t:TestContext){
 const directory=mkdtempSync(join(tmpdir(),'mote-ask-builtin-identity-')),host=await buildApp({dataDir:directory}),engine=host.execution!.engine,db=engine.store.db;
 t.after(async()=>{await host.app.close();rmSync(directory,{recursive:true,force:true});});
 engine.configurePool('ask.automation',{lane:()=> 'background',concurrency:{background:()=>4,interactive:()=>4},...(engine as any).admissions.get('ask.automation'),available:()=>false});
 const password='Generated-builtin-identity-password';await host.accounts!.initialize('generated-owner',password);
 const request=(token:string|undefined,url:string,method:any='GET',payload?:unknown)=>host.app.inject({method,url,headers:{'x-mote-protocol-version':'2','x-mote-ingress-version':'3',...(token?{authorization:'Bearer '+token}:{})},...(payload===undefined?{}:{payload})});
 const ok=async(token:string|undefined,url:string,method:any='GET',payload?:unknown)=>{const result=await request(token,url,method,payload);assert.equal(result.statusCode,200,url+' '+result.body);return result.json();};
 const owner=await ok(undefined,'/api/auth/login','POST',{username:'generated-owner',password,mode:'client'}),view=()=>ok(owner.token,'/api/configuration'),memory=async()=>(await view()).domains.find((domain:any)=>domain.id==='memory');
 await memory();await ok(owner.token,'/api/ingress/sources','POST',source('generated-builtin-scope'));
 const save=async(value:unknown,intent?:string)=>request(owner.token,'/api/configuration/memory','PUT',{revision:(await view()).revision,value,...(intent?{automationIntent:['memory:lifecycle.'+intent+'.enabled']}:{})});
 const snapshot=()=>Object.fromEntries(['ma_automations','ma_auto_windows','ma_auto_runs','task_authorizations','user_tasks','execution_steps','operation_progress','task_external_calls','mm_state'].map(table=>[table,db.prepare('SELECT * FROM '+table+' ORDER BY rowid').all()]));
 return {host,engine,db,owner,request,ok,memory,save,snapshot};
}

test('public policy admission cannot claim reserved built-in IDs and custom scopes keep their own timezone',async t=>{
 const f=await fixture(t),before=f.snapshot();
 for(const id of Object.values(ids))for(const kind of ['working','insights']){
  const result=await f.request(f.owner.token,'/api/ask-automations','POST',{id,kind,sourceIds:['generated-builtin-scope'],includeExisting:true,timeZone:'America/New_York'});
  assert.equal(result.statusCode,409,result.body);assert.equal(result.json().error,'ask_automation_identity_conflict');assert.deepEqual(f.snapshot(),before,'Rejected locators cannot create a policy, grant or task');
 }
 const custom=await f.ok(f.owner.token,'/api/ask-automations','POST',{id:randomUUID(),kind:'working',sourceIds:['generated-builtin-scope'],includeExisting:true,timeZone:'America/New_York',language:'en'}),input=custom.input;
 const tuned=await f.save({...((await f.memory()).saved),timeZone:'Asia/Shanghai'});assert.equal(tuned.statusCode,200,tuned.body);
 const current=await f.ok(f.owner.token,'/api/ask-automations/'+custom.id);assert.deepEqual(current.input,input);assert.equal(current.generation,custom.generation);assert.equal(current.task_id,custom.task_id);
});

for(const kind of ['working','insights'] as const)test('reserved '+kind+' rows need the host definition before configuration can adopt or retire them',async t=>{
 const f=await fixture(t),enabled=await f.save((await f.memory()).saved,kind);assert.equal(enabled.statusCode,200,enabled.body);
 const original=f.db.prepare('SELECT * FROM ma_automations WHERE user_id=? AND id=?').get(f.owner.userId,ids[kind])!,base=JSON.parse(String(original.input));
 // Historical/corrupted durable definitions are evidence, not a new host grant.
 const variants=[{...base,kind:kind==='working'?'insights':'working'},{...base,sourceIds:['generated-builtin-scope']},{...base,includeExisting:true},...(kind==='working'?[{...base,conversationId:randomUUID()}]:[{...base,after:'2026-01-01T00:00:00Z'},{...base,before:'2026-10-23T00:00:00Z'},{...base,deviceId:'generated-device'}])];
 let aborts=0;const abort=f.engine.abortLocal.bind(f.engine);f.engine.abortLocal=id=>{aborts++;abort(id);};t.after(()=>{f.engine.abortLocal=abort;});
 for(const [index,input] of variants.entries()){
  f.db.prepare('UPDATE ma_automations SET input=? WHERE user_id=? AND id=?').run(JSON.stringify(input),f.owner.userId,ids[kind]);
  if(index===1)f.db.prepare('UPDATE task_authorizations SET revoked=1 WHERE task_id=?').run(original.task_id);
  const tuned=await f.save({...((await f.memory()).saved),timeZone:'Asia/Shanghai'});assert.equal(tuned.statusCode,200,tuned.body);
  assert.deepEqual(JSON.parse(String(f.db.prepare('SELECT input FROM ma_automations WHERE user_id=? AND id=?').get(f.owner.userId,ids[kind])!.input)),input,'Unrelated settings cannot rewrite a custom policy as a builtin');
  const before=f.snapshot(),effective=(await f.memory()).effective,failed=await f.save({...effective,timeZone:'Asia/Tokyo'},kind);
  assert.equal(failed.statusCode,503,failed.body);assert.equal(failed.json().error,'config_apply_failed');assert.deepEqual(f.snapshot(),before,'Identity conflict must roll back settings, grants and task retirement');assert.deepEqual((await f.memory()).effective,effective);assert.equal(aborts,0);
 }
 // Owner inspection and stop remain available for resolving a historical custom policy.
 assert.equal((await f.ok(f.owner.token,'/api/ask-automations/'+ids[kind])).generation,original.generation);
 await f.ok(f.owner.token,'/api/ask-automations/'+ids[kind]+'/stop','POST',{});
 assert.equal((await f.ok(f.owner.token,'/api/ask-automations/'+ids[kind])).state,'stopped');
});
