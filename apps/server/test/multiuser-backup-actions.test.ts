import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID,createHash} from 'node:crypto';
import {mkdtempSync,rmSync,readFileSync,writeFileSync,cpSync,existsSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {DatabaseSync} from 'node:sqlite';
import {fileURLToPath} from 'node:url';
import {setTimeout as delay} from 'node:timers/promises';
import {parseConfigDocument,serializeConfigDocument} from '@mote/shared/config-file';
import {modelFixture} from './fixtures/scoped-actions.js';
import {password} from './fixtures/scoped-query-accounts.js';
import {launchScopedProcess,scopedHttpClient} from './fixtures/scoped-process.js';
import {backupScopedInstance,restoreScopedInstance} from '../../../scripts/scoped-backup.mjs';

const tables=['ac_meta','ac_state','ac_sources','ac_proposals','ac_dependencies','ac_targets','ac_jobs','ac_operations','ac_restore','td_meta','td_state','td_todos','td_restore'];

test('stopped recovery preserves actual Actions/todos and external facts, retires old action authority and rejects incomplete domain schemas',async t=>{
 const f=await modelFixture(t),root=mkdtempSync(join(tmpdir(),'mote-m16-actions-backup-')),snapshot=join(root,'snapshot'),target=join(root,'target'),config=join(root,'instance.yaml'),todoId=randomUUID(),actions:any[]=[];
 t.after(()=>rmSync(root,{recursive:true,force:true}));
 for(const [user,label] of [[f.a,'A'],[f.b,'B']] as const){
  const todo=await f.request(user.token,'/api/todos','POST',{id:todoId,title:'Generated retained todo '+label});assert.equal(todo.statusCode,201,todo.body);
  if(label==='A')await f.ok(user.token,'/api/todos/'+todoId,'PATCH',{version:1,status:'completed'});
  await f.ingest(user,label);await f.enable(user);
  await f.ok(user.token,'/api/actions/targets','POST',{deviceId:'same-device',deviceName:'Generated '+label,calendars:[{id:'same-calendar',title:'Generated calendar '+label}]});
  const proposal=(await f.proposal(user)).items[0],approved=await f.ok(user.token,'/api/actions/'+proposal.id+'/confirm','POST',{version:proposal.version,event:proposal.event,target:{deviceId:'same-device',calendarId:'same-calendar'}});
  assert.equal((await f.ok(user.token,'/api/actions/'+approved.id+'/claim','POST',{deviceId:'same-device'})).mutationAllowed,true);
  await f.ok(user.token,'/api/actions/'+approved.id+'/receipt','POST',{deviceId:'same-device',operationId:approved.operationId,status:label==='A'?'uncertain':'succeeded',...(label==='B'?{externalId:'generated-successful-native-event'}:{})});actions.push(approved);
 }
 const before=f.read(db=>({todos:db.prepare('SELECT * FROM td_todos ORDER BY user_id,id').all(),proposals:db.prepare('SELECT * FROM ac_proposals ORDER BY user_id,id').all(),operations:db.prepare('SELECT user_id,id,claimed,issuance_id,native_external_id,ack,task_id,published FROM ac_operations ORDER BY user_id,id').all(),completed:db.prepare("SELECT id,input,attempts FROM execution_steps WHERE state='succeeded' ORDER BY id").all(),states:db.prepare('SELECT user_id,generation,authorization_revision FROM ac_state ORDER BY user_id').all()}));
 assert.equal(before.operations.length,2);assert.ok(before.operations.every(row=>row.claimed===1&&row.issuance_id));
 await f.node.app.close();writeFileSync(config,serializeConfigDocument({version:1,revision:0,storage:{dataDir:f.directory},server:{host:'127.0.0.1',port:0},actions:{enabled:true,timeZone:'UTC'}}));
 await backupScopedInstance({source:f.directory,out:snapshot,configFile:config});
 await t.test('canonical facts survive but instance and user action admission are retired before publication',async()=>{
  await restoreScopedInstance({from:snapshot,target});
  const instance=parseConfigDocument(readFileSync(join(target,'instance.yaml'),'utf8'),{}).savedDocument;assert.equal(instance.actions?.enabled,false,'inherited instance action policy must be retired');
  const db=new DatabaseSync(join(target,'mote.sqlite'));try{
   assert.deepEqual(db.prepare('SELECT * FROM td_todos ORDER BY user_id,id').all(),before.todos);assert.deepEqual(db.prepare('SELECT * FROM ac_proposals ORDER BY user_id,id').all(),before.proposals);
   assert.deepEqual(db.prepare('SELECT user_id,id,claimed,issuance_id,native_external_id,ack,task_id,published FROM ac_operations ORDER BY user_id,id').all(),before.operations,'issued/successful/unknown facts retain their exact identity');
   assert.deepEqual(db.prepare("SELECT id,input,attempts FROM execution_steps WHERE state='succeeded' ORDER BY id").all(),before.completed);
   assert.equal(db.prepare('SELECT count(*) n FROM ac_targets').get()!.n,0);assert.equal(db.prepare('SELECT count(*) n FROM ac_operations WHERE revoked=0').get()!.n,0);
   for(const state of before.states){const current=db.prepare('SELECT * FROM ac_state WHERE user_id=?').get(state.user_id)!;assert.equal(JSON.parse(String(current.settings)).enabled,false);assert.equal(current.generation,Number(state.generation)+1);assert.equal(current.authorization_revision,Number(state.authorization_revision)+1);assert.equal(current.review_devices,'[]');assert.equal(current.policy_id,null);assert.equal(current.policy_task,null);}
  }finally{db.close();}
  for(const user of [f.a,f.b])assert.equal(parseConfigDocument(readFileSync(join(target,'configuration/users',user.userId,'mote.yaml'),'utf8'),{}).savedDocument.actions?.enabled,false);
  const entry=fileURLToPath(new URL(process.env.MOTE_M16_COMPILED_HOST==='1'?'../dist/index.js':'../src/index.ts',import.meta.url)),calls=f.requests.length;
  for(let cycle=0;cycle<2;cycle++){
   const process=launchScopedProcess(entry,{MOTE_CONFIG_FILE:join(target,'instance.yaml')},{loader:entry.endsWith('.ts')});
   try{const listening=await process.waitForPhase('listening'),http=scopedHttpClient('http://127.0.0.1:'+listening.port);
    assert.equal((await fetch('http://127.0.0.1:'+listening.port+'/api/auth/self',{headers:{'x-mote-protocol-version':'2',authorization:'Bearer '+f.a.token}})).status,401);
    for(const [index,user] of [f.a,f.b].entries()){
     const login=await http.request(undefined,'/api/auth/login','POST',{username:user.username,password,mode:'client'}),view=await http.request(login.token,'/api/actions');assert.equal(view.settings.enabled,false);assert.deepEqual(view.settings.reviewDeviceIds,[]);assert.deepEqual((await http.request(login.token,'/api/actions/deliveries?deviceId=same-device')).items,[]);
     const todos=await http.request(login.token,'/api/todos');assert.equal(todos.items[0].id,todoId);assert.equal(todos.items[0].status,index===0?'completed':'open');
    }
    await delay(100);assert.equal(f.requests.length,calls,'restarting restored canonical action history must not reissue old model work');
    process.child.kill('SIGTERM');assert.equal((await process.closed).code,0);
   }finally{if(process.child.exitCode===null&&process.child.signalCode===null){process.child.kill('SIGKILL');await process.closed;}}
  }
 });
 const corruptions=Object.fromEntries(tables.map(table=>['missing-'+table,'DROP TABLE '+table]));
 Object.assign(corruptions,{missingNativeIdentity:'ALTER TABLE ac_operations RENAME COLUMN native_external_id TO generated_missing_identity',missingTodoReceipt:'ALTER TABLE td_todos RENAME COLUMN request_hash TO generated_missing_receipt'});
 for(const [name,sql] of Object.entries(corruptions))await t.test(name,async()=>{
  const archive=join(root,name),rejected=join(root,name+'-target');cpSync(snapshot,archive,{recursive:true});const db=new DatabaseSync(join(archive,'mote.sqlite'));db.exec('PRAGMA foreign_keys=OFF;'+sql);db.close();const manifest=JSON.parse(readFileSync(join(archive,'backup-manifest.json'),'utf8'));manifest.checksums['mote.sqlite']=createHash('sha256').update(readFileSync(join(archive,'mote.sqlite'))).digest('hex');writeFileSync(join(archive,'backup-manifest.json'),JSON.stringify(manifest));await assert.rejects(restoreScopedInstance({from:archive,target:rejected}),undefined,name);assert.equal(existsSync(rejected),false,'schema rejection must precede target publication');
 });
});
