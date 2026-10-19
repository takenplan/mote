import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {join} from 'node:path';
import {createServer} from 'node:http';
import {defaultModelSettings} from '../src/model-settings.js';
import {scopedFilesFixture} from './fixtures/scoped-files.js';
import {waitForScopedState} from './fixtures/scoped-process.js';
import {defaultProcessingSettings} from '../src/scope/processing-schema.js';

type Fixture=Awaited<ReturnType<typeof scopedFilesFixture>>;
const password='Generated-m07-incarnation-reset-01';
const digest=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const read=<T>(f:Fixture,work:(db:DatabaseSync)=>T)=>{const db=new DatabaseSync(join(f.directory,'mote.sqlite'),{readOnly:true});try{return work(db);}finally{db.close();}};
const tasks=(f:Fixture,userId:string)=>read(f,db=>db.prepare("SELECT e.id,e.operation_id,e.state,e.attempts,u.input,a.grant_id,a.authorization_epoch,a.revoked FROM execution_steps e JOIN user_tasks u ON u.task_id=e.id AND u.user_id=e.user_id JOIN task_authorizations a ON a.task_id=e.id AND a.user_id=e.user_id WHERE e.user_id=? AND e.kind='memory.materials' ORDER BY e.id").all(userId));
const operation=(input:any,event:string)=>'memory-materials:'+digest([input.captureId,input.sourceId,input.hash,event,input.authorizationEpoch,input.incarnation]);
const ownedOperation=(userId:string,input:any,event:string)=>'memory-materials:'+digest([userId,operation(input,event)]);
async function settled(f:Fixture,userId:string){await waitForScopedState(()=>{const rows=tasks(f,userId);return rows.length>0&&rows.every(row=>row.state==='succeeded');},()=>JSON.stringify(tasks(f,userId)),10000);}
async function configure(f:Fixture,token:string){const view=await f.checked(token,'/api/configuration');await f.checked(token,'/api/configuration/processing','PUT',{revision:view.revision,value:{...defaultProcessingSettings(),automatic:true,understandingEnabled:false,summarize:false,semanticTurns:false}});}
async function reset(f:Fixture){await f.checked(f.admin.token,'/api/admin/accounts/'+f.a.userId+'/password','POST',{password});const fresh=await f.checked(undefined,'/api/auth/login','POST',{username:'generated-a',password,mode:'client'});assert.equal(fresh.userId,f.a.userId);assert.equal((await f.request(f.a.token,'/api/auth/self')).statusCode,401);return fresh;}
async function published(f:Fixture,token:string,id:string){await waitForScopedState(async()=>(await f.checked(token,'/api/files/'+id)).processing.indexed,()=>'generated text publication missing',10000);await settled(f,f.a.userId);}
// Physical execution facts also include local M06 file extraction. Retain their
// exact baseline rather than treating every fact as a model or paid request.
const activity=(f:Fixture,userId:string)=>read(f,db=>({
 calls:db.prepare('SELECT c.*,e.kind,u.model_receipt FROM task_external_calls c JOIN execution_steps e ON e.id=c.task_id AND e.user_id=c.user_id JOIN user_tasks u ON u.task_id=e.id AND u.user_id=e.user_id WHERE c.user_id=? ORDER BY c.issuance_id').all(userId),
 models:db.prepare('SELECT task_id,model_receipt FROM user_tasks WHERE user_id=? AND model_receipt IS NOT NULL ORDER BY task_id').all(userId),
 usage:db.prepare('SELECT id,json FROM user_model_usage WHERE user_id=? ORDER BY id').all(userId),
}));
// Redeliver the same canonical revision in a NEW transport attempt. The shared
// fixture's fixed batch reopens an already committed upload, whose part PUT is
// correctly rejected; that does not exercise current-original deduplication.
async function redeliver(f:Fixture,token:string,externalId:string,bytes:Buffer,mimeType:string){
 const checksum=createHash('sha256').update(bytes).digest('hex'),opened=await f.checked(token,'/api/ingress/sources/same-source/uploads','POST',{batchId:'m07-redelivery:'+randomUUID(),revision:{sourceId:'same-source',previousRevision:null,sizeBytes:bytes.length,sha256:checksum,relativePath:externalId+(mimeType.startsWith('audio/')?'.wav':'.txt'),item:{externalId,revision:'same-r1',observedAt:'2026-10-16T00:00:00Z',title:externalId,text:'',kind:'file',layer:'original',mimeType}}});
 assert.equal(opened.receipt,undefined,'a fresh transport batch must not reopen a committed upload');await f.checked(token,'/api/ingress/uploads/'+opened.id+'/parts/0','PUT',{bytes:bytes.toString('base64'),checksum});const receipt=await f.checked(token,'/api/ingress/uploads/'+opened.id+'/commit','POST',{});assert.equal(receipt.state,'received');assert.equal(receipt.captures.length,1);assert.equal(receipt.captures[0].duplicate,true,'same source/external ID/revision/bytes must remain a canonical duplicate');return receipt.captures[0];
}

test('M07 host admission gives an unchanged exact publication fresh epoch authority without renewing old history (supplementary seam)',async t=>{
 const f=await scopedFilesFixture(t);await configure(f,f.a.token);const capture=await f.upload(f.a.token,'m07-exact','GENERATED_M07_EXACT');await published(f,f.a.token,capture.id);
 const publication=read(f,db=>db.prepare('SELECT material_id,revision FROM mp_publications WHERE user_id=?').get(f.a.userId)!),old=tasks(f,f.a.userId),prior=old.find(row=>row.operation_id===ownedOperation(f.a.userId,JSON.parse(String(row.input)),String(publication.revision)))!;assert.ok(prior);
 const baseline=activity(f,f.a.userId);assert.ok(baseline.calls.length>0,'initial public local-file processing retains its physical execution fact');for(const call of baseline.calls){assert.equal(call.kind,'processing.extract');assert.equal(call.model_receipt,null);assert.equal(call.state,'succeeded');}assert.deepEqual(baseline.models,[]);assert.deepEqual(baseline.usage,[]);t.diagnostic(JSON.stringify({baselinePhysicalKinds:baseline.calls.map(call=>call.kind),baselineModelReceipts:baseline.models.length,baselineModelUsage:baseline.usage.length}));
 const fresh=await reset(f),context=await f.host.authority.authenticate(fresh.token),input={...JSON.parse(String(prior.input)),authorizationEpoch:context.authorizationEpoch};
 await assert.rejects(f.host.authority.restoreTask(String(prior.grant_id)),(error:any)=>error.statusCode===401);
 assert.throws(()=>f.host.execution!.forUser(context).submitSync({kind:'memory.materials',operationId:operation(JSON.parse(String(prior.input)),String(publication.revision)),input:JSON.parse(String(prior.input))}),(error:any)=>error.statusCode===409);
 const submit=()=>f.host.execution!.forUser(context).submitSync({kind:'memory.materials',operationId:operation(input,String(publication.revision)),input}),first=submit();assert.equal(submit().id,first.id);await settled(f,f.a.userId);
 const rows=tasks(f,f.a.userId),current=rows.find(row=>row.id===first.id)!;assert.equal(rows.length,old.length+1);assert.equal(current.authorization_epoch,1);assert.notEqual(current.grant_id,prior.grant_id);assert.equal(current.revoked,0);assert.deepEqual(rows.filter(row=>old.some(previous=>previous.id===row.id)),old);
 assert.equal(activity(f,f.a.userId).calls.filter(call=>String(call.kind).startsWith('memory.')).length,0,'the M07 deterministic seam issues no physical call');assert.deepEqual(activity(f,f.a.userId),baseline,'fresh admission and its duplicate retain all prior physical facts and introduce no model receipt or usage');
 await f.restart();assert.deepEqual(tasks(f,f.a.userId),rows,'successful tasks and their grants persist without startup replay');assert.deepEqual(activity(f,f.a.userId),baseline,'restart cannot replay any historical physical call or introduce model work');
});

test('M07 source retirement replaces the capture/source proof and rejects an awaited old input under current authority',async t=>{
 let release!:()=>void;const gate=new Promise<void>(resolve=>release=resolve);let late:Promise<void>|undefined;t.after(async()=>{release();await late?.catch(()=>{});});
 const f=await scopedFilesFixture(t),capture=await f.upload(f.a.token,'m07-source','GENERATED_M07_SOURCE'),other=await f.upload(f.b.token,'m07-source','GENERATED_M07_SOURCE');assert.equal(capture.id,other.id);await settled(f,f.a.userId);await settled(f,f.b.userId);
 const old=tasks(f,f.a.userId),b=tasks(f,f.b.userId),oldInput=JSON.parse(String(old[0].input)),context=await f.host.authority.authenticate(f.a.token);
 late=gate.then(()=>{const current=JSON.parse(String(tasks(f,f.a.userId).find(row=>!old.some(prior=>prior.id===row.id))!.input));assert.throws(()=>f.host.execution!.forUser(context).submitSync({kind:'memory.materials',operationId:'memory-materials:'+digest('generated-late-input'),input:{...current,incarnation:oldInput.incarnation}}),(error:any)=>error.statusCode===409,'old source/capture proof must fail even with the replacement hash and current epoch');});
 await f.checked(f.a.token,'/api/sources/same-source','DELETE');assert.equal(read(f,db=>db.prepare('SELECT count(*) n FROM mm_organizer_origins WHERE user_id=?').get(f.a.userId)!.n),0);
 await f.checked(f.a.token,'/api/ingress/sources','POST',{id:'same-source',name:'Generated replacement',kind:'local-files',deviceId:'same-device',platform:'import',retention:'archive'});const replacement=await f.upload(f.a.token,'m07-source','GENERATED_M07_SOURCE');assert.equal(replacement.id,capture.id);await settled(f,f.a.userId);release();await late;
 const rows=tasks(f,f.a.userId),current=rows.filter(row=>!old.some(prior=>prior.id===row.id));assert.ok(current.length>0);for(const row of current){const input=JSON.parse(String(row.input));assert.notEqual(input.incarnation,oldInput.incarnation);assert.equal(input.authorizationEpoch,0);assert.ok(old.every(prior=>prior.grant_id!==row.grant_id));}
 const duplicate=await redeliver(f,f.a.token,'m07-source',Buffer.from('GENERATED_M07_SOURCE'),'text/plain');assert.equal(duplicate.id,replacement.id);assert.equal(duplicate.original.ref,replacement.original.ref);assert.deepEqual(tasks(f,f.a.userId),rows,'same-current duplicate receipt cannot admit another organizer');assert.deepEqual(tasks(f,f.b.userId),b);
});

// Complete public journey: keep M07 and Ask subscribers installed. On isolated
// 9c03 the independently owned Ask epoch collision is still outstanding; this
// case must also run on the composed Ask+M07 candidate, without weakening it.
test('public exact Material revision republication after reset completes all consumers with fresh M07 authority',async t=>{
 const f=await scopedFilesFixture(t);await configure(f,f.a.token);const capture=await f.upload(f.a.token,'m07-public-exact','GENERATED_M07_PUBLIC_EXACT');await published(f,f.a.token,capture.id);
 const publication=()=>read(f,db=>db.prepare('SELECT material_id,revision FROM mp_publications WHERE user_id=?').get(f.a.userId)!);const original=publication(),prior=tasks(f,f.a.userId),fresh=await reset(f);
 const republish=async()=>{const task=await f.checked(fresh.token,'/api/processing','POST',{originalRef:capture.original.ref,operationId:randomUUID()});await waitForScopedState(async()=>{const value=await f.checked(fresh.token,'/api/tasks/'+task.id);assert.ok(!['failed','blocked','stale'].includes(value.state),JSON.stringify(value));return value.state==='succeeded';},()=>'fresh exact publication did not complete through all subscribers',10000);await settled(f,f.a.userId);};
 await republish();assert.deepEqual(publication(),original,'exact canonical revision is a required precondition');const rows=tasks(f,f.a.userId),current=rows.filter(row=>!prior.some(old=>old.id===row.id)),material=current.filter(row=>row.operation_id===ownedOperation(f.a.userId,JSON.parse(String(row.input)),String(original.revision)));assert.equal(material.length,1);assert.equal(material[0].authorization_epoch,1);assert.ok(prior.every(old=>old.grant_id!==material[0].grant_id));assert.deepEqual(rows.filter(row=>prior.some(old=>old.id===row.id)),prior);
 await republish();assert.deepEqual(publication(),original);assert.deepEqual(tasks(f,f.a.userId).filter(row=>row.operation_id===material[0].operation_id),material,'same-current exact publication reuses its organizer');
});

for(const bumpEpoch of [false,true])test('public M07 source recreation '+(bumpEpoch?'after reset':'within the current epoch')+' fences a held retired ASR result and preserves B',async t=>{
 let release!:()=>void;const gate=new Promise<void>(resolve=>release=resolve),calls:string[]=[];t.after(()=>release());const f=await scopedFilesFixture(t);
 const endpoint=async(owner:string)=>{const server=createServer((req,res)=>{void(async()=>{for await(const _ of req){}calls.push(owner);const retired=owner==='A'&&calls.filter(value=>value==='A').length===1;if(retired)await gate;res.setHeader('X-Mote-Execution','local');res.end(JSON.stringify({durationMs:1,segments:[{startMs:0,endMs:1,text:retired?'GENERATED_RETIRED_M07_A':'GENERATED_CURRENT_M07_'+owner}],coverage:'full',engine:'generated-m07-incarnation'}));})().catch(()=>res.destroy());});await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(()=>{release();server.closeAllConnections();return new Promise<void>(resolve=>server.close(()=>resolve()));});return 'http://127.0.0.1:'+(server.address() as {port:number}).port;};
 for(const [owner,account]of [['A',f.a],['B',f.b]] as const){const view=await f.checked(account.token,'/api/configuration');await f.checked(account.token,'/api/configuration/models','PUT',{revision:view.revision,value:{profiles:[{id:'same-asr',name:'Generated ASR',settings:{...defaultModelSettings(),provider:'custom',protocol:'mote-media',model:'generated-asr',baseUrl:await endpoint(owner),apiKey:'GENERATED_'+owner}}],selections:{asr:{kind:'personal',id:'same-asr'}}}});const config=await f.checked(account.token,'/api/configuration');await f.checked(account.token,'/api/configuration/processing','PUT',{revision:config.revision,value:{...defaultProcessingSettings(),automatic:true,understandingEnabled:false,summarize:false,semanticTurns:false,audioProcessor:'audio.http'}});}
 const bytes=Buffer.from('GENERATED_M07_IDENTICAL_AUDIO'),oldCapture=await f.uploadBytes(f.a.token,'m07-audio',bytes,'audio/wav'),other=await f.uploadBytes(f.b.token,'m07-audio',bytes,'audio/wav');assert.equal(oldCapture.id,other.id);
 await waitForScopedState(()=>calls.includes('A'),()=>JSON.stringify(calls),10000);await waitForScopedState(async()=>(await f.checked(f.b.token,'/api/files/'+other.id)).processing.indexed,()=>'B did not finish',10000);await settled(f,f.a.userId);await settled(f,f.b.userId);const old=tasks(f,f.a.userId),b=tasks(f,f.b.userId);
 await f.checked(f.a.token,'/api/sources/same-source','DELETE');const actor=bumpEpoch?await reset(f):f.a;await f.checked(actor.token,'/api/ingress/sources','POST',{id:'same-source',name:'Generated replacement',kind:'local-files',deviceId:'same-device',platform:'import',retention:'archive'});
 const replacement=await f.uploadBytes(actor.token,'m07-audio',bytes,'audio/wav');assert.equal(replacement.id,oldCapture.id);assert.equal(replacement.original.ref,oldCapture.original.ref);await settled(f,f.a.userId);const current=tasks(f,f.a.userId),fresh=current.filter(row=>!old.some(previous=>previous.id===row.id));assert.ok(fresh.length>0);for(const row of fresh){assert.equal(row.authorization_epoch,bumpEpoch?1:0);assert.ok(old.every(previous=>previous.grant_id!==row.grant_id));assert.ok(old.every(previous=>JSON.parse(String(previous.input)).incarnation!==JSON.parse(String(row.input)).incarnation));}
 const duplicate=await redeliver(f,actor.token,'m07-audio',bytes,'audio/wav');assert.equal(duplicate.id,replacement.id);assert.equal(duplicate.original.ref,replacement.original.ref);assert.deepEqual(tasks(f,f.a.userId),current);assert.equal(calls.filter(owner=>owner==='A').length,1,'replacement cannot physically replay unresolved retired ASR');assert.deepEqual(tasks(f,f.b.userId),b);
 release();await waitForScopedState(async()=>(await f.checked(actor.token,'/api/files/'+replacement.id)).processing.indexed,()=>'replacement publication missing after old transport settled',10000);await settled(f,f.a.userId);const file=await f.checked(actor.token,'/api/files/'+replacement.id),material=await f.checked(actor.token,'/api/materials/'+file.processing.materialId+'/read');assert.match(material.text,/GENERATED_CURRENT_M07_A/);assert.doesNotMatch(material.text,/GENERATED_RETIRED_M07_A|GENERATED_CURRENT_M07_B/);assert.equal(calls.filter(owner=>owner==='A').length,2);assert.deepEqual(tasks(f,f.b.userId),b);
});
