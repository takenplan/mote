import {expectedIndexProof,proofDigest} from './fixtures/ask-index-proof.js';
import {waitForPluginCheck} from './fixtures/plugin-check.js';
import test,{type TestContext} from 'node:test';
import assert from 'node:assert/strict';
import {createServer,type IncomingMessage,type ServerResponse} from 'node:http';
import {mkdtempSync,rmSync,readdirSync,existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {setTimeout as delay} from 'node:timers/promises';
import {buildApp} from '../src/app.js';
import {bytesHash} from '../src/scope/originals.js';
import {defaultModelSettings} from '../src/model-settings.js';
import {defaultProcessingSettings} from '../src/scope/processing-schema.js';
import {defaultPerceptionConfiguration} from '../src/perception-configuration.js';
import {generatedScopedPluginRelease,generatedScopedPluginSource} from './fixtures/scoped-plugin-release.js';
import {LifecycleAuthority} from '../src/scope/lifecycle.js';
import {openScopeStorage} from '../src/scope/storage.js';
import {z} from 'zod';
import {EXECUTION_POLICIES} from '../src/execution-policy.js';
import type {TaskRun} from '../src/scope/task-execution.js';
import type {PrivateData} from '../src/scope/private-data.js';
import sharp from 'sharp';
import {gunzipSync} from 'node:zlib';
import {writeMessagesResponse} from '../../../scripts/fixtures/messages-provider.js';
import {zipSync} from 'fflate';
import {password,protocol,deferred,until,fixture,publishedIntakeTasks,forgetFile,media,respond} from './fixtures/multiuser-processing-suite.js';

test('generation-zero admission retains the historical task identity and lost-ACK lookup across restart',async t=>{
 const f=await fixture(t),ref=(await f.upload(f.alice.token,Buffer.from('Generated old-format journal identity'))).captures[0].original.ref,operationId='historical-zero-generation',task=await f.submit(f.alice.token,ref,operationId);
 const input=f.read(db=>JSON.parse(String(db.prepare('SELECT input FROM user_tasks WHERE task_id=? AND user_id=?').get(task.id,f.a.userId)!.input)));delete input.fileGeneration;
 const canonical=(value:any):any=>Array.isArray(value)?value.map(canonical):value&&typeof value==='object'?Object.fromEntries(Object.entries(value).sort(([a],[b])=>a.localeCompare(b)).map(([key,item])=>[key,canonical(item)])):value;
 // This is the pre-file-control M05 identity formula, evaluated independently
 // against the real admitted input rather than a second production admission.
 assert.equal(task.id,bytesHash(Buffer.from(JSON.stringify([f.a.userId,operationId,'processing.pipeline',canonical(input)]))));
 await f.wait(f.alice.token,task.id);const before=f.read(db=>Number(db.prepare('SELECT count(*) n FROM user_tasks WHERE user_id=?').get(f.a.userId)!.n));await f.restart();const retry=await f.submit(f.alice.token,ref,operationId);assert.equal(retry.id,task.id);assert.equal(retry.state,'succeeded');assert.equal(f.read(db=>Number(db.prepare('SELECT count(*) n FROM user_tasks WHERE user_id=?').get(f.a.userId)!.n)),before);
 assert.equal(f.read(db=>Number(db.prepare("SELECT count(*) n FROM user_tasks WHERE user_id=? AND json_type(input,'$.fileGeneration') IS NOT NULL").get(f.a.userId)!.n)),0);
});

for(const mode of ['cancel','failed','source-disable','configuration','parent-grant','checkpoint','input','account-epoch'] as const)test('confirmed extraction retry preserves blocked facts after '+mode,async t=>{
 let calls=0;const url=await media(t,(_req,res)=>{calls++;res.writeHead(503);res.end('GENERATED_UNKNOWN_OUTCOME');}),f=await fixture(t);await f.models(f.alice.token,url,'GENERATED_RETRY_KEY');
 const ref=(await f.upload(f.alice.token,Buffer.from('generated retry image'),'image/png')).captures[0].original.ref,job=await f.intake(f.alice.token,ref);
 await f.wait(f.alice.token,job.id,'blocked');const child=f.read(db=>String(db.prepare("SELECT id FROM execution_steps WHERE user_id=? AND kind='processing.ocr'").get(f.a.userId)!.id)),raw=f.read(db=>JSON.parse(String(db.prepare('SELECT input FROM user_tasks WHERE task_id=?').get(child)!.input)));
 assert.equal((await f.task(f.alice.token,child)).state,'blocked');assert.equal(calls,1);
 assert.equal((await f.request(f.bob.token,'/api/tasks/'+child+'/retry','POST',{confirmUnknown:true})).statusCode,404);
 assert.equal((await f.request(f.alice.token,'/api/tasks','POST',{kind:'processing.ocr',operationId:'unrelated-child',input:raw})).statusCode,401,'a blocked parent still cannot authorize a new child');
 if(mode==='cancel')await f.checked(f.alice.token,'/api/tasks/'+job.id+'/cancel','POST',{});
 if(mode==='failed')f.node.execution!.engine.fail(job.id,'generated_parent_failed');
 if(mode==='source-disable')await f.checked(f.alice.token,'/api/sources/same-source','PATCH',{enabled:false});
 if(mode==='configuration')await f.configure(f.alice.token,'processing',{...defaultProcessingSettings(),automatic:false,understandingEnabled:false,summarize:false});
 if(mode==='parent-grant')f.read(db=>db.prepare('UPDATE task_authorizations SET revoked=1 WHERE task_id=?').run(job.id));
 if(mode==='checkpoint')f.read(db=>db.prepare('UPDATE user_tasks SET checkpoints=? WHERE task_id=?').run(JSON.stringify({extraction:{taskId:'0'.repeat(64)}}),job.id));
 if(mode==='input')f.read(db=>{const input=JSON.parse(String(db.prepare('SELECT input FROM user_tasks WHERE task_id=?').get(job.id)!.input));input.settings.summarize=!input.settings.summarize;db.prepare('UPDATE user_tasks SET input=? WHERE task_id=?').run(JSON.stringify(input),job.id);});
 let token=f.alice.token;if(mode==='account-epoch'){await f.checked(f.admin.token,'/api/admin/accounts/'+f.a.userId+'/password','POST',{password});token=(await f.checked(undefined,'/api/auth/login','POST',{username:'generated-a',password,mode:'client'})).token;}
 const before=f.read(db=>({parent:db.prepare('SELECT state FROM execution_steps WHERE id=?').get(job.id)!.state,child:db.prepare('SELECT state FROM execution_steps WHERE id=?').get(child)!.state,external:db.prepare('SELECT external_state FROM user_tasks WHERE task_id=?').get(child)!.external_state}));
 const response=await f.request(token,'/api/tasks/'+child+'/retry','POST',{confirmUnknown:true});assert.ok([401,409].includes(response.statusCode),response.body);
 assert.deepEqual(f.read(db=>({parent:db.prepare('SELECT state FROM execution_steps WHERE id=?').get(job.id)!.state,child:db.prepare('SELECT state FROM execution_steps WHERE id=?').get(child)!.state,external:db.prepare('SELECT external_state FROM user_tasks WHERE task_id=?').get(child)!.external_state})),before,'rejected recovery rolls back both tasks and the unknown pointer');
 assert.equal(f.read(db=>db.prepare('SELECT count(*) n FROM task_external_retry_confirmations WHERE user_id=?').get(f.a.userId)!.n),0);assert.equal(f.read(db=>db.prepare("SELECT count(*) n FROM task_external_calls WHERE user_id=? AND state IN ('issued','unknown')").get(f.a.userId)!.n),1);assert.equal(calls,1);if(mode==='source-disable')assert.equal((await f.request(token,'/api/processing/originals/'+ref.slice(9))).statusCode,409);else assert.equal((await f.status(token,ref)).indexed,false);
 const bRef=(await f.upload(f.bob.token,Buffer.from('B_GENERATED_RETRY_CONTROL'))).captures[0].original.ref,bJob=await f.submit(f.bob.token,bRef);await f.wait(f.bob.token,bJob.id);assert.equal((await f.status(f.bob.token,bRef)).indexed,true);
});

test('processing lifecycle validates owned artifact hashes and canonical publication parents before idempotent restore',async t=>{
 const f=await fixture(t),aRef=(await f.upload(f.alice.token,Buffer.from('A_GENERATED_LIFECYCLE'))).captures[0].original.ref,bRef=(await f.upload(f.bob.token,Buffer.from('B_GENERATED_LIFECYCLE'))).captures[0].original.ref;
 const a=await f.submit(f.alice.token,aRef),b=await f.submit(f.bob.token,bRef);await Promise.all([f.wait(f.alice.token,a.id),f.wait(f.bob.token,b.id)]);const context=await f.node.authority.authenticate(f.alice.token),scope=f.node.services.forUser(context),archive=await scope.exportUser('processing');assert.equal(JSON.stringify(archive).includes('B_GENERATED'),false);assert.equal(JSON.stringify(archive).includes(f.b.userId),false);assert.equal((await scope.deleteUser('processing','delete-generated-a')).status,'complete');assert.equal((await scope.deleteUser('processing','delete-generated-a')).status,'complete');
 const corrupt=structuredClone(archive);(corrupt.payload as any).artifacts[0].json=JSON.stringify({durationMs:0,segments:[{startMs:0,endMs:0,text:'FORGED_BODY'}]});await assert.rejects(scope.restoreUser('processing',corrupt,'bad-hash'));assert.equal(f.read(db=>db.prepare('SELECT count(*) n FROM mp_artifacts WHERE user_id=?').get(f.a.userId)!.n),0);
 const foreign=structuredClone(archive);(foreign.payload as any).artifacts[0].original_id=bRef.slice(9);await assert.rejects(scope.restoreUser('processing',foreign,'foreign-original'));
 const stitched=structuredClone(archive);(stitched.payload as any).publications[0].material_id='mat_'+'0'.repeat(64);await assert.rejects(scope.restoreUser('processing',stitched,'wrong-publication'));
 await scope.restoreUser('processing',archive,'restore-generated-a');await scope.restoreUser('processing',archive,'restore-generated-a');await f.restart();assert.equal((await f.status(f.alice.token,aRef)).indexed,true);assert.equal((await f.status(f.bob.token,bRef)).indexed,true);const state=await f.status(f.bob.token,bRef);assert.equal((await f.checked(f.bob.token,'/api/materials/'+state.materialId+'/read')).text,'B_GENERATED_LIFECYCLE');
});

test('original file forgetting removes all owned revisions, blocks resync until explicit allow-again and preserves B',async t=>{
 const f=await fixture(t),bytes=Buffer.from('GENERATED_FORGETTABLE_EXACT_BYTES'),aRef=(await f.upload(f.alice.token,bytes)).captures[0].original.ref,bRef=(await f.upload(f.bob.token,bytes)).captures[0].original.ref;for(const [token,ref] of [[f.alice.token,aRef],[f.bob.token,bRef]]){const job=await f.submit(token,ref);await f.wait(token,job.id);}const a=await f.status(f.alice.token,aRef),b=await f.status(f.bob.token,bRef),path='/api/files/'+a.original.captureId;assert.equal(a.original.captureId,b.original.captureId);const ticket=await f.checked(f.alice.token,'/api/ingress/originals/'+aRef.slice(9)+'/tickets','POST',{mode:'download'});const exportId=randomUUID();const oldArchive=await f.checked(f.alice.token,'/api/export');const result=await forgetFile(f,f.alice.token,path);assert.ok(result.deleted>=1);assert.equal((await f.request(f.alice.token,path)).statusCode,404);assert.equal((await f.request(f.alice.token,'/api/ingress/originals/'+aRef.slice(9)+'/content?ticket='+encodeURIComponent(ticket.ticket))).statusCode,404);assert.equal((await f.checked(f.bob.token,'/api/files/'+b.original.captureId)).sha256,bytesHash(bytes));assert.equal((await f.request(f.alice.token,'/api/processing/artifacts/'+a.artifactId)).statusCode,404);const blockedImport=randomUUID();await f.checked(f.alice.token,'/api/portable/imports','POST',{operationId:blockedImport,archive:oldArchive});for(let attempt=0;;attempt++){const state=await f.checked(f.alice.token,'/api/portable/imports/'+blockedImport);if(state.state!=='working'){assert.equal(state.state,'failed',JSON.stringify(state));assert.equal(state.error,'archive_conflict');break;}assert.ok(attempt<1000);await delay(5);}assert.equal((await f.request(f.alice.token,path)).statusCode,404,'older personal import must not resurrect a forgotten file');await f.restart();assert.equal((await f.request(f.alice.token,path)).statusCode,404);const scope=f.node.services.forUser(await f.node.authority.authenticate(f.alice.token)),tombstones=await scope.exportUser('ingress');assert.equal((tombstones.payload as any).forgottenFiles.length,1);assert.equal((tombstones.payload as any).forgottenFiles[0].blocked,1);await scope.deleteUser('ingress','generated-forget-retention-delete');await scope.restoreUser('ingress',tombstones,'generated-forget-retention-restore');assert.equal((await f.request(f.alice.token,path+'/allow-again','POST',result.decision)).statusCode,409,'data-only restore cannot revive a previously issued allow decision');assert.notEqual((await f.checked(f.alice.token,path+'/forgotten')).decision.decisionId,result.decision.decisionId);
 const manifest={sourceId:'same-source',item:{externalId:'same-file',revision:'same-revision',observedAt:'2026-10-15T00:00:00Z',title:'Generated file',text:'',kind:'file',layer:'original',mimeType:'text/plain'},sizeBytes:bytes.length,sha256:bytesHash(bytes),relativePath:'generated.bin'};assert.equal((await f.request(f.alice.token,'/api/ingress/sources/same-source/uploads','POST',{batchId:'same-file:same-revision',revision:manifest})).statusCode,410);assert.equal((await f.request(f.bob.token,path+'/allow-again','POST',{sourceId:'same-source',externalId:'same-file'})).statusCode,404);await f.checked(f.alice.token,path+'/allow-again','POST',(await f.checked(f.alice.token,path+'/forgotten')).decision);assert.equal((await f.request(f.alice.token,path)).statusCode,404,'allow-again does not recreate content');const newRef=(await f.upload(f.alice.token,bytes)).captures[0].original.ref,newTask=await f.submit(f.alice.token,newRef,'generated-explicit-allow-again');await f.wait(f.alice.token,newTask.id);assert.equal((await f.request(f.alice.token,'/api/ingress/originals/'+aRef.slice(9)+'/content?ticket='+encodeURIComponent(ticket.ticket))).statusCode,404,'an old signed download ticket must not revive after explicit re-import');assert.equal((await f.checked(f.alice.token,'/api/files/'+(await f.status(f.alice.token,newRef)).original.captureId)).sha256,bytesHash(bytes));assert.equal((await f.checked(f.bob.token,'/api/files/'+b.original.captureId)).sha256,bytesHash(bytes));
});

test('a real held processor result rechecks shared capacity after B fills it, without storing the rejected artifact or losing physical settlement',async t=>{
 const entered=deferred(),held=deferred();t.after(()=>held.resolve());let calls=0;const text='GENERATED_CAPACITY_ARTIFACT_'+ '界'.repeat(5000),url=await media(t,async(_req,res)=>{calls++;entered.resolve();await held.promise;respond(res,text);}),f=await fixture(t,false,generatedScopedPluginRelease(),undefined,{maxStorageBytes:1024*1024,runtimeLifecycle:true});
 await f.models(f.alice.token,url,'GENERATED_CAPACITY_PROCESSOR');const captured=(await f.upload(f.alice.token,Buffer.from('generated original pixels'),'image/png')).captures[0],job=await f.intake(f.alice.token,captured.original.ref);await entered.promise;
 const used=f.read(db=>Number(db.prepare("SELECT COALESCE(SUM(bytes),0) n FROM storage_ledger WHERE name NOT IN('blobs','file_blobs','file_objects')").get()!.n)),bytes=Buffer.alloc(1024*1024-used-8192,43),upload=await f.checked(f.bob.token,'/api/import-uploads','POST',{name:'generated-other-owner.bin',sizeBytes:bytes.length,mimeType:'application/octet-stream'});const part=await f.node.app.inject({url:'/api/import-uploads/'+upload.id+'/parts/0',method:'PUT',headers:{...protocol,authorization:'Bearer '+f.bob.token,'content-type':'application/octet-stream'},payload:bytes});assert.equal(part.statusCode,200,part.body);
 held.resolve();await until(()=>f.read(db=>!db.prepare("SELECT 1 FROM execution_steps WHERE user_id=? AND kind='processing.ocr' AND state IN('waiting','running')").get(f.a.userId)),'processor result did not settle');
 assert.equal(f.read(db=>db.prepare('SELECT COUNT(*) n FROM mp_artifacts WHERE user_id=? AND original_id=?').get(f.a.userId,captured.original.ref.slice(9))!.n),0,'a completed external await must not persist content over the current shared ceiling');const refused=f.read(db=>db.prepare("SELECT state,error FROM execution_steps WHERE user_id=? AND kind='processing.ocr'").get(f.a.userId)!);assert.equal(refused.state,'blocked');assert.equal(refused.error,'storage_limit');assert.equal(f.read(db=>db.prepare('SELECT COUNT(*) n FROM mp_activity WHERE user_id=?').get(f.a.userId)!.n),0,'known physical settlement remains recordable even at capacity');assert.equal(calls,1);
 const deletion=await f.checked(f.admin.token,'/api/admin/accounts/'+f.b.userId,'DELETE',{operationId:randomUUID()});await until(()=>f.read(db=>db.prepare('SELECT state FROM lifecycle_operations WHERE id=?').get(deletion.id)?.state==='completed'),'B erasure did not free capacity');const retry=await f.checked(f.alice.token,'/api/files/'+captured.id+'/retry','POST',{operationId:'generated-capacity-retry',stage:'transcribe'});await f.wait(f.alice.token,retry.taskId);assert.equal(calls,2);assert.ok(f.read(db=>db.prepare('SELECT COUNT(*) n FROM mp_artifacts WHERE user_id=? AND original_id=?').get(f.a.userId,captured.original.ref.slice(9))!.n)>0);
});
