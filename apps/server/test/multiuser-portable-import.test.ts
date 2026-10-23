import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readdirSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {DatabaseSync} from 'node:sqlite';
import {buildApp} from '../src/app.js';
import {backupScopedInstance,restoreScopedInstance} from '../../../scripts/scoped-backup.mjs';
import {join} from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';
import {scopedMemoryFixture} from './fixtures/scoped-memory-host.js';
import {defaultModelSettings} from '../src/model-settings.js';
import {writeMessagesResponse} from '../../../scripts/fixtures/messages-provider.js';

test('personal import retains validated historical Memory evidence after a Material update without making it current execution input',async t=>{
 const f=await scopedMemoryFixture(t),material=await f.publish(f.a,'A');await f.wait(f.a,(await f.submit(f.a,[material.id])).id);
 const saved=await archive(f),context=await f.node.authority.authenticate(f.a.token),bound=f.node.ingress.bindSource(context,['same-source'],()=>{});
 const draft=JSON.parse(String(f.read(db=>db.prepare('SELECT json FROM pd_material_versions WHERE user_id=? AND material_id=? AND revision=?').get(f.a.userId,material.id,material.revision)!.json)));
 const current=bound.publishMaterial({...draft,title:'Generated newer material title'});assert.notEqual(current.revision,material.revision);
 const before=f.read(db=>db.prepare('SELECT * FROM task_authorizations ORDER BY task_id').all()),calls=f.requests.length;
 const receipt=await imported(f,saved);assert.equal(receipt.state,'completed',JSON.stringify(receipt));
 assert.deepEqual(f.read(db=>db.prepare('SELECT * FROM task_authorizations ORDER BY task_id').all()),before);assert.equal(f.requests.length,calls);
 const old=await f.request(f.a.token,'/api/memory/jobs','POST',{materialIds:[material.id],materialRevisions:{[material.id]:material.revision},operationId:randomUUID()});assert.equal(old.statusCode,409,old.body);assert.equal(f.requests.length,calls);
 const selected=await f.request(f.a.token,'/api/memory/materials/'+material.id+'?revision='+current.revision);assert.equal(selected.statusCode,200,selected.body);assert.equal(selected.json().status,'ready');
 await f.wait(f.a,(await f.submit(f.a,[material.id])).id);assert.ok(f.requests.length>calls,'a legitimate fresh owner request still executes against the current revision');
});

async function archive(f:Awaited<ReturnType<typeof scopedMemoryFixture>>){
 for(let attempt=0;attempt<1000;attempt++){if(!f.read(db=>db.prepare("SELECT id FROM execution_steps WHERE state='running' OR(state='waiting' AND coalesce(error,'')<>'memory_window_pending') LIMIT 1").get()))break;await delay(5);}
 const content=await f.request(f.a.token,'/api/export');assert.equal(content.statusCode,200,content.body);return content.json();}
async function imported(f:Awaited<ReturnType<typeof scopedMemoryFixture>>,value:unknown,id=randomUUID()){
 const started=await f.request(f.a.token,'/api/portable/imports','POST',{operationId:id,archive:value});assert.equal(started.statusCode,200,started.body);
 let receipt=started.json();for(let attempt=0;receipt.state==='working'&&attempt<300;attempt++){await delay(10);const response=await f.request(f.a.token,'/api/portable/imports/'+id);assert.equal(response.statusCode,200,response.body);receipt=response.json();}return receipt;
}
test('same-vault portable import preserves capture delete intent, other records and B across retry and restart',async t=>{
 const f=await scopedMemoryFixture(t),a=await f.upload(f.a,'A','archive-original'),b=await f.upload(f.b,'B','archive-original'),saved=await archive(f),captureId=a.captures[0].id;
 assert.equal(saved.userId,f.a.userId);const operationId=randomUUID();
 assert.equal((await f.request(f.a.token,'/api/captures/'+captureId,'DELETE')).statusCode,200);
 const current=await f.upload(f.a,'A','keep-current',Buffer.from('Generated current A record'));
 const beforeB=f.read(db=>({captures:db.prepare('SELECT * FROM pd_captures WHERE user_id=? ORDER BY id').all(f.b.userId),credentials:db.prepare('SELECT * FROM auth_credentials WHERE user_id=? ORDER BY id').all(f.b.userId)})),calls=f.requests.length,grants=f.read(db=>db.prepare('SELECT * FROM task_authorizations ORDER BY task_id').all());
 const receipt=await imported(f,saved,operationId);assert.equal(receipt.state,'failed',JSON.stringify(receipt));assert.equal(receipt.error,'archive_conflict');assert.equal(receipt.kind,'import');assert.equal(receipt.userId,f.a.userId);assert.equal(receipt.deploymentId,f.node.deploymentId);assert.equal(receipt.progress.mode,'semantic');assert.equal(receipt.coverage.credentials,false);assert.equal(receipt.coverage.activeAuthorization,false);
 const own=await f.request(f.a.token,'/api/captures/'+captureId);assert.equal(own.statusCode,404,own.body);assert.equal((await f.request(f.a.token,'/api/captures/'+current.captures[0].id)).statusCode,200);
 assert.equal(f.read(db=>db.prepare('SELECT count(*) n FROM pd_capture_deletions WHERE user_id=? AND id=?').get(f.a.userId,captureId)!.n),1);
 assert.equal((await f.request(f.b.token,'/api/portable/imports/'+operationId)).statusCode,404);assert.equal((await f.request(f.admin.token,'/api/portable/imports/'+operationId)).statusCode,404);
 assert.equal((await f.request(f.b.token,'/api/captures/'+b.captures[0].id)).statusCode,200);assert.deepEqual(f.read(db=>({captures:db.prepare('SELECT * FROM pd_captures WHERE user_id=? ORDER BY id').all(f.b.userId),credentials:db.prepare('SELECT * FROM auth_credentials WHERE user_id=? ORDER BY id').all(f.b.userId)})),beforeB);
 assert.deepEqual(f.read(db=>db.prepare('SELECT * FROM task_authorizations ORDER BY task_id').all()),grants);assert.equal(f.requests.length,calls);
 const retried=await imported(f,saved,operationId);assert.equal(retried.state,'failed');assert.equal(retried.error,'archive_conflict');await f.restart();assert.equal((await f.request(f.a.token,'/api/portable/imports/'+operationId)).json().state,'failed');assert.equal((await imported(f,saved,operationId)).error,'archive_conflict');
 const duplicate=await imported(f,saved);assert.equal(duplicate.state,'failed',JSON.stringify(duplicate));assert.equal(duplicate.error,'archive_conflict');assert.equal(f.read(db=>db.prepare('SELECT count(*) n FROM pd_captures WHERE user_id=? AND id=?').get(f.a.userId,captureId)!.n),0);
});
test('actual Memory and a completed conversation deduplicate without changing current bodies, policies, grants or successful model work',async t=>{
 const f=await scopedMemoryFixture(t),material=await f.publish(f.a,'A');await f.wait(f.a,(await f.submit(f.a,[material.id])).id);
 await f.replace(f.a.token,'models',{profiles:[{id:'same-model',name:'Generated shared model',settings:{...defaultModelSettings(),provider:'custom',protocol:'anthropic-messages',model:'generated-memory',baseUrl:f.modelUrl,apiKey:'GENERATED_A_KEY',headers:{},extraBody:{}}}],selections:{memory:{kind:'personal',id:'same-model'},chat:{kind:'personal',id:'same-model'}}});
 f.responses.set('A',res=>writeMessagesResponse(res,{stage:1,text:JSON.stringify({answer:'Generated portable saved answer',citationIds:[]})}));
 const id=randomUUID(),start=await f.request(f.a.token,'/api/query-runs','POST',{id,input:{question:'Generated saved answer'}});assert.equal(start.statusCode,200,start.body);
 for(let attempt=0;attempt<1000;attempt++){const response=await f.request(f.a.token,'/api/query-runs/'+id);assert.equal(response.statusCode,200,response.body);if(response.json().status==='completed')break;assert.ok(!['failed','blocked'].includes(response.json().status),response.body);await delay(10);}
 const saved=await archive(f),before=f.read(db=>({memories:db.prepare('SELECT * FROM mm_records WHERE user_id=? ORDER BY id').all(f.a.userId),bindings:db.prepare('SELECT * FROM mm_version_bindings WHERE user_id=? ORDER BY id,version').all(f.a.userId),grants:db.prepare('SELECT * FROM task_authorizations ORDER BY task_id').all(),events:db.prepare('SELECT * FROM ma_auto_events WHERE user_id=? ORDER BY seq').all(f.a.userId),settings:db.prepare('SELECT * FROM ma_automations WHERE user_id=? ORDER BY id').all(f.a.userId)})),calls=f.requests.length;
 const receipt=await imported(f,saved);assert.equal(receipt.state,'completed',JSON.stringify(receipt));
 assert.deepEqual(f.read(db=>({memories:db.prepare('SELECT * FROM mm_records WHERE user_id=? ORDER BY id').all(f.a.userId),bindings:db.prepare('SELECT * FROM mm_version_bindings WHERE user_id=? ORDER BY id,version').all(f.a.userId),grants:db.prepare('SELECT * FROM task_authorizations ORDER BY task_id').all(),events:db.prepare('SELECT * FROM ma_auto_events WHERE user_id=? ORDER BY seq').all(f.a.userId),settings:db.prepare('SELECT * FROM ma_automations WHERE user_id=? ORDER BY id').all(f.a.userId)})),before);
 const ask=saved.domains.find((domain:any)=>domain.domain==='ask').payload,conversation=await f.request(f.a.token,'/api/conversations/'+ask.conversations[0].id);assert.equal(conversation.statusCode,200,conversation.body);assert.match(conversation.body,/Generated portable saved answer/);await delay(50);assert.equal(f.requests.length,calls);
 const conversationId=ask.conversations[0].id;assert.equal((await f.request(f.a.token,'/api/conversations/'+conversationId,'DELETE')).statusCode,200);assert.equal((await f.request(f.a.token,'/api/conversations/'+conversationId)).statusCode,404);
 const memoryId=saved.domains.find((domain:any)=>domain.domain==='memory').payload.records[0].id,removed=await f.request(f.a.token,'/api/memories/'+memoryId,'DELETE');assert.equal(removed.statusCode,200,removed.body);await f.terminal(removed.json().cleanupTaskId);
 const currentGrants=f.read(db=>db.prepare('SELECT * FROM task_authorizations ORDER BY task_id').all()),currentCalls=f.requests.length,restored=await imported(f,saved);assert.equal(restored.state,'completed',JSON.stringify(restored));assert.match((await f.request(f.a.token,'/api/conversations/'+conversationId)).body,/Generated portable saved answer/);assert.equal(f.read(db=>JSON.parse(String(db.prepare('SELECT json FROM mm_records WHERE user_id=? AND id=?').get(f.a.userId,memoryId)!.json)).staleReason),'restored_archive');assert.deepEqual(f.read(db=>db.prepare('SELECT * FROM task_authorizations ORDER BY task_id').all()),currentGrants);await delay(50);assert.equal(f.requests.length,currentCalls);
});
for(const mode of ['cancel','disable','logout','restart'] as const)test('a real import preflight held after its actual domain read respects '+mode,async t=>{
 const f=await scopedMemoryFixture(t),captured=await f.upload(f.a,'A'),saved=await archive(f),captureId=captured.captures[0].id,id=randomUUID();assert.equal((await f.request(f.a.token,'/api/sources/same-source','DELETE')).statusCode,200);
 let entered!:()=>void,release!:()=>void;const ready=new Promise<void>(resolve=>entered=resolve),gate=new Promise<void>(resolve=>release=resolve),entry=(f.node.services as any).users.get('memory'),read=entry.lifecycle.exportUser;
 entry.lifecycle.exportUser=async(subject:any)=>{const result=await read(subject);entered();await gate;return result;};f.beforeClose(()=>release());
 const started=await f.request(f.a.token,'/api/portable/imports','POST',{operationId:id,archive:saved});assert.equal(started.statusCode,200,started.body);await ready;
 if(mode==='cancel'){const cancelled=await f.request(f.a.token,'/api/portable/imports/'+id+'/cancel','POST',{});assert.equal(cancelled.statusCode,200,cancelled.body);assert.equal(cancelled.json().state,'cancelled');}
 if(mode==='disable')assert.equal((await f.request(f.admin.token,'/api/admin/accounts/'+f.a.userId,'PATCH',{disabled:true})).statusCode,200);
 if(mode==='logout')assert.equal((await f.request(f.a.token,'/api/auth/logout','POST',{})).statusCode,200);
 if(mode==='restart'){const restarting=f.restart();for(let attempt=0;!(f.node.lifecycle as any).closed&&attempt<100;attempt++)await delay(1);assert.equal((f.node.lifecycle as any).closed,true);release();await restarting;}else release();
 for(let attempt=0;attempt<300;attempt++){if(f.read(db=>db.prepare('SELECT state FROM lifecycle_operations WHERE id=?').get(id)!.state)!=='working')break;await delay(5);}
 const state=f.read(db=>db.prepare('SELECT state FROM lifecycle_operations WHERE id=?').get(id)!.state),restored=f.read(db=>db.prepare('SELECT count(*) n FROM pd_captures WHERE user_id=? AND id=?').get(f.a.userId,captureId)!.n);
 if(mode==='logout'){assert.equal(state,'completed');assert.equal(restored,1);}else{assert.notEqual(state,'completed');assert.equal(restored,0);}
 if(mode==='disable'||mode==='logout')assert.equal((await f.request(f.a.token,'/api/portable/imports/'+id)).statusCode,401);
 if(mode==='restart'){const receipt=await f.request(f.a.token,'/api/portable/imports/'+id);assert.equal(receipt.statusCode,200,receipt.body);assert.equal(receipt.json().error,'interrupted');assert.equal((await imported(f,saved,id)).state,'completed');}
});
test('portable import rejects a foreign account, deployment, old version and incomplete coverage before admitting data',async t=>{
 const f=await scopedMemoryFixture(t);await f.upload(f.a,'A');const saved=await archive(f),before=f.read(db=>db.prepare('SELECT * FROM pd_captures ORDER BY user_id,id').all());
 for(const value of [{...saved,userId:f.b.userId},{...saved,deploymentId:randomUUID()},{...saved,version:2},{...saved,domains:saved.domains.slice(1)}]){const response=await f.request(f.a.token,'/api/portable/imports','POST',{operationId:randomUUID(),archive:value});assert.ok([400,403,409].includes(response.statusCode),response.body);assert.deepEqual(f.read(db=>db.prepare('SELECT * FROM pd_captures ORDER BY user_id,id').all()),before);}
});
test('an imported missing source stays disabled while its canonical original is restored',async t=>{
 const f=await scopedMemoryFixture(t),captured=await f.upload(f.a,'A'),saved=await archive(f);
 assert.equal((await f.request(f.a.token,'/api/sources/same-source','DELETE')).statusCode,200);
 const receipt=await imported(f,saved);assert.equal(receipt.state,'completed',JSON.stringify(receipt));
 const source=await f.request(f.a.token,'/api/sources/same-source');assert.equal(source.statusCode,200,source.body);assert.equal(source.json().enabled,false);
 assert.equal((await f.request(f.a.token,'/api/captures/'+captured.captures[0].id)).statusCode,200);
});
test('a later invalid canonical domain rolls back new IDs and original files in an earlier recovered instance',async t=>{
 const f=await scopedMemoryFixture(t),directory=mkdtempSync(join(tmpdir(),'mote-m16-import-rollback-')),snapshot=join(directory,'snapshot'),target=join(directory,'restored');let restored:Awaited<ReturnType<typeof buildApp>>|undefined;
 try{
  await f.node.app.close();await backupScopedInstance({source:f.directory,out:snapshot});await f.restart();
  const captured=await f.upload(f.a,'A'),saved=await archive(f),captureId=captured.captures[0].id;await f.node.app.close();
  await restoreScopedInstance({from:snapshot,target});restored=await buildApp({dataDir:target});
  const request=(token:string|undefined,url:string,method:any='GET',payload?:unknown)=>restored!.app.inject({url,method,headers:{'x-mote-protocol-version':'2','x-mote-ingress-version':'3',...(token?{authorization:'Bearer '+token}:{})},...(payload===undefined?{}:{payload})});
  const logged=await request(undefined,'/api/auth/login','POST',{username:'generated-a',password:'Generated-memory-password-only-01',mode:'client'});assert.equal(logged.statusCode,200,logged.body);const token=logged.json().token;
  const read=<T>(work:(db:DatabaseSync)=>T)=>{const db=new DatabaseSync(join(target,'mote.sqlite'));try{return work(db);}finally{db.close();}};
  const files=()=>{try{return readdirSync(join(target,'originals'),{recursive:true}).filter(name=>String(name).endsWith('.plain')).sort();}catch{return [];}};
  const beforeFiles=files(),grants=read(db=>db.prepare('SELECT * FROM task_authorizations ORDER BY task_id').all());
  const broken=structuredClone(saved);broken.domains.find((domain:any)=>domain.domain==='processing').payload.artifacts.push({id:'0'.repeat(64),original_id:'1'.repeat(64),fingerprint:'2'.repeat(64),json:'{}',complete:1});
  const id=randomUUID(),started=await request(token,'/api/portable/imports','POST',{operationId:id,archive:broken});assert.equal(started.statusCode,200,started.body);let receipt=started.json();for(let attempt=0;receipt.state==='working'&&attempt<300;attempt++){await delay(10);receipt=(await request(token,'/api/portable/imports/'+id)).json();}
  assert.equal(receipt.state,'failed',JSON.stringify(receipt));assert.equal(receipt.error,'archive_invalid');assert.equal((await request(token,'/api/captures/'+captureId)).statusCode,404);
  assert.deepEqual(files(),beforeFiles);assert.deepEqual(read(db=>db.prepare('SELECT * FROM task_authorizations ORDER BY task_id').all()),grants);
 }finally{if(restored)await restored.app.close();rmSync(directory,{recursive:true,force:true});}
});
test('importing an older source revision preserves the actual newer head and its retired Material visibility',async t=>{
 const f=await scopedMemoryFixture(t),material=await f.publish(f.a,'A'),saved=await archive(f);
 const advanced=await f.request(f.a.token,'/api/ingress/sources/same-source/items','POST',{batchId:'generated-newer',items:[{externalId:'same-external',revision:'next-revision',observedAt:'2026-02-01T00:00:00Z',title:'Generated newer head',text:'Generated newer canonical content',kind:'file',layer:'original'}]});assert.equal(advanced.statusCode,200,advanced.body);
 const before=await f.request(f.a.token,'/api/ingress/sources/same-source/head?externalId=same-external'),receipt=await imported(f,saved);assert.equal(receipt.state,'completed',JSON.stringify(receipt));assert.deepEqual((await f.request(f.a.token,'/api/ingress/sources/same-source/head?externalId=same-external')).json(),before.json());
 assert.equal((await f.request(f.a.token,'/api/materials/'+material.id)).statusCode,404);assert.equal(f.requests.length,0);
});
test('source identity conflicts and original corruption reject without changing canonical rows or accepting changed operation input',async t=>{
 const f=await scopedMemoryFixture(t);await f.upload(f.a,'A');const saved=await archive(f),rows=()=>f.read(db=>({captures:db.prepare('SELECT * FROM pd_captures ORDER BY user_id,id').all(),sources:db.prepare('SELECT * FROM pd_sources ORDER BY user_id,id').all(),grants:db.prepare('SELECT * FROM task_authorizations ORDER BY task_id').all()})),before=rows();
 const source=structuredClone(saved),entry=source.domains.find((domain:any)=>domain.domain==='private-data').payload.sources[0];entry.json=JSON.stringify({...JSON.parse(entry.json),kind:'custom'});const conflict=await imported(f,source);assert.equal(conflict.state,'failed',JSON.stringify(conflict));assert.equal(conflict.error,'archive_conflict');assert.deepEqual(rows(),before);
 const broken=structuredClone(saved);broken.domains.find((domain:any)=>domain.domain==='ingress').payload.objects[0].bytes=Buffer.from('Generated corrupt archive bytes').toString('base64');const id=randomUUID(),invalid=await imported(f,broken,id);assert.equal(invalid.state,'failed');assert.deepEqual(rows(),before);assert.equal((await f.request(f.a.token,'/api/portable/imports','POST',{operationId:id,archive:saved})).statusCode,409);assert.equal((await imported(f,broken,id)).state,'failed');assert.deepEqual(rows(),before);
});
test('empty-owner import receipts paginate with owner, kind, epoch and page-size bound cursors',async t=>{
 const f=await scopedMemoryFixture(t),saved=await archive(f);assert.deepEqual((await f.request(f.a.token,'/api/portable/imports')).json(),{items:[],nextCursor:null});
 const ids=new Set<string>();for(let index=0;index<4;index++){const receipt=await imported(f,saved);assert.equal(receipt.state,'completed',JSON.stringify(receipt));ids.add(receipt.id);assert.equal((await f.request(f.a.token,'/api/portable/imports/'+receipt.id+'/cancel','POST',{})).statusCode,409);}
 const page=(await f.request(f.a.token,'/api/portable/imports?limit=2')).json();assert.equal(page.items.length,2);assert.ok(page.nextCursor);for(const item of page.items)assert.ok(ids.delete(item.id));const rest=(await f.request(f.a.token,'/api/portable/imports?limit=2&cursor='+encodeURIComponent(page.nextCursor))).json();assert.equal(rest.nextCursor,null);for(const item of rest.items)assert.ok(ids.delete(item.id));assert.equal(ids.size,0);
 for(const [token,path] of [[f.b.token,'imports?limit=2'],[f.a.token,'imports?limit=3']])assert.equal((await f.request(token,'/api/portable/'+path+'&cursor='+encodeURIComponent(page.nextCursor))).statusCode,400);
 assert.deepEqual((await f.request(f.b.token,'/api/portable/imports')).json(),{items:[],nextCursor:null});
});

test('later personal data imported into an earlier stopped instance does not become new automatic input after restart',async t=>{
 const f=await scopedMemoryFixture(t),directory=mkdtempSync(join(tmpdir(),'mote-m16-import-history-')),snapshot=join(directory,'snapshot'),target=join(directory,'restored');let restored:Awaited<ReturnType<typeof buildApp>>|undefined;
 try{
  await f.node.app.close();await backupScopedInstance({source:f.directory,out:snapshot});await f.restart();const material=await f.publish(f.a,'A'),saved=await archive(f);await f.node.app.close();
  await restoreScopedInstance({from:snapshot,target});restored=await buildApp({dataDir:target});
  const request=(token:string|undefined,url:string,method:any='GET',payload?:unknown)=>restored!.app.inject({url,method,headers:{'x-mote-protocol-version':'2','x-mote-ingress-version':'3',...(token?{authorization:'Bearer '+token}:{})},...(payload===undefined?{}:{payload})});
  assert.equal((await request(f.a.token,'/api/auth/self')).statusCode,401);const logged=await request(undefined,'/api/auth/login','POST',{username:'generated-a',password:'Generated-memory-password-only-01',mode:'client'});assert.equal(logged.statusCode,200,logged.body);const token=logged.json().token;assert.equal(logged.json().userId,f.a.userId);
  const id=randomUUID(),started=await request(token,'/api/portable/imports','POST',{operationId:id,archive:saved});assert.equal(started.statusCode,200,started.body);let receipt=started.json();for(let attempt=0;receipt.state==='working'&&attempt<300;attempt++){await delay(10);receipt=(await request(token,'/api/portable/imports/'+id)).json();}assert.equal(receipt.state,'completed',JSON.stringify(receipt));
  const events=()=>{const db=new DatabaseSync(join(target,'mote.sqlite'),{readOnly:true});try{return db.prepare("SELECT entity FROM ma_auto_events WHERE user_id=? AND kind='insights'").all(f.a.userId);}finally{db.close();}};assert.deepEqual(events(),[]);assert.equal((await request(token,'/api/materials/'+material.id)).statusCode,200);assert.equal((await request(token,'/api/sources/same-source')).json().enabled,false,'a source absent from the recovered instance is restored disabled');
  await restored.app.close();restored=await buildApp({dataDir:target});assert.deepEqual(events(),[],'restart must not turn imported canonical data into a newly authorized automation notification');
 }finally{if(restored)await restored.app.close();rmSync(directory,{recursive:true,force:true});}
});

test('first automation-journal schema installation backfills existing canonical data once and normal publication still notifies',async t=>{
 const f=await scopedMemoryFixture(t),material=await f.publish(f.a,'A');await f.node.app.close();
 f.read(db=>db.exec('DROP TRIGGER ma_auto_material_insert;DROP TRIGGER ma_auto_material_update;DROP TRIGGER ma_auto_turn;DROP TABLE ma_auto_events;'));await f.restart();
 const events=()=>f.read(db=>db.prepare("SELECT entity FROM ma_auto_events WHERE user_id=? AND kind='insights' ORDER BY seq").all(f.a.userId).map(row=>row.entity));assert.deepEqual(events(),[material.id]);await f.restart();assert.deepEqual(events(),[material.id]);
 const next=await f.publish(f.a,'A','same-source','generated-next');assert.deepEqual(events(),[material.id,next.id]);
});
