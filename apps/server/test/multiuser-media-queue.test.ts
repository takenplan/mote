import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {setTimeout as delay} from 'node:timers/promises';
import {fixture,media,respond,deferred,until} from './fixtures/scoped-processing.js';
import {defaultModelSettings} from '../src/model-settings.js';

test('HTTP ingress queues different users and originals on one physical worker while another listener progresses',async t=>{
 const hold=deferred(),entered=deferred();t.after(()=>hold.resolve());let active=0,maximum=0,calls=0,other=0;
 const shared=await media(t,async(_req,res)=>{calls++;active++;maximum=Math.max(maximum,active);entered.resolve();await hold.promise;active--;respond(res,'GENERATED_SERIAL_OCR');});
 const independent=await media(t,(_req,res)=>{other++;respond(res,'GENERATED_INDEPENDENT_ASR',1000);}),f=await fixture(t);
 await f.configure(f.alice.token,'models',{profiles:[{id:'ocr',name:'Generated OCR',settings:{...defaultModelSettings(),provider:'custom',protocol:'mote-media',model:'generated',baseUrl:shared,apiKey:'GENERATED_A'}},{id:'asr',name:'Generated ASR',settings:{...defaultModelSettings(),provider:'custom',protocol:'mote-media',model:'generated',baseUrl:independent,apiKey:'GENERATED_A'}}],selections:{ocr:{kind:'personal',id:'ocr'},asr:{kind:'personal',id:'asr'}}});
 await f.models(f.bob.token,shared,'GENERATED_B');
 const inputs=[];for(const [token,key,mime] of [[f.alice.token,'a1','image/png'],[f.alice.token,'a2','image/png'],[f.bob.token,'b1','image/png'],[f.alice.token,'audio','audio/wav']]){const ref=(await f.upload(token,Buffer.from('GENERATED_'+key),mime,key)).captures[0].original.ref;inputs.push({token,ref,id:(await f.submit(token,ref,key)).id});}
 await entered.promise;await f.wait(inputs[3].token,inputs[3].id);assert.equal(other,1);assert.equal(calls,1);
 const waiting=f.read(db=>db.prepare("SELECT e.id,e.attempts,u.external_state FROM execution_steps e JOIN user_tasks u ON u.task_id=e.id WHERE e.kind='processing.ocr' AND e.state='waiting'").all());assert.equal(waiting.length,2);assert.ok(waiting.every(row=>row.attempts===0&&row.external_state==='none'));
 hold.resolve();for(const input of inputs)await f.wait(input.token,input.id);assert.equal(maximum,1);assert.equal(calls,3);
});

test('structured busy shares a durable cooldown, survives restart and does not issue queued work or spend attempts',async t=>{
 let ready=false,calls=0;const endpoint=await media(t,(_req,res)=>{calls++;if(!ready){res.writeHead(429,{'Retry-After':'60','X-Mote-Execution':'local','X-Mote-Execution-Started':'false'}).end('{}');return;}respond(res,'GENERATED_AFTER_BUSY');}),f=await fixture(t);
 await f.models(f.alice.token,endpoint,'GENERATED_A');await f.models(f.bob.token,endpoint,'GENERATED_B');
 const refs=[];for(const [token,key] of [[f.alice.token,'a'],[f.bob.token,'b']]){const ref=(await f.upload(token,Buffer.from('GENERATED_'+key),'image/png',key)).captures[0].original.ref;refs.push({token,ref,id:(await f.submit(token,ref,key)).id});}
 await until(()=>f.read(db=>Number(db.prepare('SELECT count(*) n FROM processor_cooldowns').get()!.n))===1,'busy cooldown was not saved');await delay(200);assert.equal(calls,1);
 const facts=()=>f.read(db=>db.prepare("SELECT e.id,e.attempts,u.external_state FROM execution_steps e JOIN user_tasks u ON u.task_id=e.id WHERE e.kind='processing.ocr'").all());assert.ok(facts().every(row=>row.attempts===0&&!['issued','unknown'].includes(String(row.external_state))));
 await f.restart();await delay(200);assert.equal(calls,1);assert.ok(facts().every(row=>row.attempts===0));
 ready=true;f.read(db=>{db.prepare('UPDATE processor_cooldowns SET until=0').run();db.prepare("UPDATE execution_steps SET available_at=0 WHERE kind='processing.ocr' AND state='waiting'").run();});
 for(const input of refs)await f.wait(input.token,input.id);assert.equal(calls,3);
 const usage=f.read(db=>db.prepare("SELECT json FROM user_model_usage").all().map(row=>JSON.parse(String(row.json))));assert.equal(usage.filter(value=>value.issuance.executionStarted===false).length,1);assert.equal(usage.filter(value=>value.issuance.issuedAt&&value.issuance.executionStarted!==false).length,2);
});

for(const retirement of ['cancel','source-withdraw'] as const)test(`queued ${retirement} work never reaches the worker or creates an issued journal`,async t=>{
 const hold=deferred(),entered=deferred();t.after(()=>hold.resolve());let calls=0;const endpoint=await media(t,async(_req,res)=>{calls++;entered.resolve();await hold.promise;respond(res,'GENERATED_HELD');}),f=await fixture(t);await f.models(f.alice.token,endpoint,'GENERATED_A');await f.models(f.bob.token,endpoint,'GENERATED_B');
 const a=(await f.upload(f.alice.token,Buffer.from('GENERATED_A'),'image/png','a')).captures[0].original.ref,b=(await f.upload(f.bob.token,Buffer.from('GENERATED_B'),'image/png','b')).captures[0].original.ref;
 const first=await f.submit(f.alice.token,a,'a');await entered.promise;const second=await f.submit(f.bob.token,b,'b');await until(()=>f.read(db=>!!db.prepare("SELECT 1 FROM execution_steps WHERE user_id=? AND kind='processing.ocr' AND state='waiting'").get(f.b.userId)),'second OCR did not queue');
 if(retirement==='cancel')await f.checked(f.bob.token,'/api/tasks/'+second.id+'/cancel','POST',{});else await f.checked(f.bob.token,'/api/sources/same-source','PATCH',{enabled:false});
 hold.resolve();await f.wait(f.alice.token,first.id);await delay(200);assert.equal(calls,1);assert.equal(f.read(db=>Number(db.prepare('SELECT count(*) n FROM task_external_calls WHERE user_id=?').get(f.b.userId)!.n)),0);
});

test('an issued disconnected OCR reconciles exact authenticated facts, keeps running work queued and exposes a lost completed result',async t=>{
 let requestId='',scope='',status='running',posts=0,gets=0;const incarnation=randomUUID();
 const endpoint=await media(t,(req,res)=>{if(req.method==='GET'){gets++;assert.equal(req.headers.authorization,'Bearer GENERATED_RECEIPT_KEY');assert.equal(req.headers['x-mote-request-scope'],scope);assert.equal(req.url,'/executions/'+requestId);res.setHeader('X-Mote-Execution','local');res.end(JSON.stringify({version:1,requestId,incarnation,stage:'ocr',state:status,acceptedAt:1,startedAt:2,...(status==='succeeded'?{finishedAt:3,outcome:'completed'}:{})}));return;}posts++;requestId=String(req.headers['x-mote-request-id']);scope=String(req.headers['x-mote-request-scope']);assert.match(requestId,/^[a-f0-9-]{36}$/);res.destroy();}),f=await fixture(t);await f.models(f.alice.token,endpoint,'GENERATED_RECEIPT_KEY');
 const ref=(await f.upload(f.alice.token,Buffer.from('GENERATED_DISCONNECTED_OCR'),'image/png')).captures[0].original.ref,parent=await f.submit(f.alice.token,ref);
 await until(()=>f.read(db=>!!db.prepare("SELECT 1 FROM mp_media_calls WHERE user_id=?").get(f.a.userId)),'real transport did not save an issued identity');
 await until(()=>f.read(db=>!!db.prepare("SELECT 1 FROM execution_steps WHERE user_id=? AND kind='processing.ocr' AND state='waiting' AND error='provider_network'").get(f.a.userId)),'disconnect did not preserve unknown issuance');
 const child=f.read(db=>String(db.prepare("SELECT id FROM execution_steps WHERE user_id=? AND kind='processing.ocr'").get(f.a.userId)!.id));
 f.read(db=>db.prepare('UPDATE execution_steps SET available_at=0 WHERE id=?').run(child));await until(()=>gets>0,'receipt was not queried');await until(()=>f.read(db=>db.prepare('SELECT error FROM execution_steps WHERE id=?').get(child)?.error==='processor_still_running'),'running receipt was not queued');assert.equal(posts,1);
 await f.restart();status='succeeded';f.read(db=>db.prepare('UPDATE execution_steps SET available_at=0 WHERE id=?').run(child));const result=await f.wait(f.alice.token,child,'blocked');assert.equal(result.failure.code,'processor_result_unavailable');assert.equal(result.externalState,'succeeded');assert.equal(posts,1);assert.equal((await f.status(f.alice.token,ref)).processed,false);await f.wait(f.alice.token,parent.id,'blocked');
 const facts=f.read(db=>db.prepare('SELECT fact FROM mp_media_calls WHERE user_id=?').get(f.a.userId)!.fact);assert.ok(!String(facts).includes('GENERATED_DISCONNECTED_OCR'));assert.ok(!String(facts).includes('GENERATED_RECEIPT_KEY'));
});

test('M16 erases only the retired account worker facts after task deletion, retries pending erasure and never restores inference authority',async t=>{
 const facts=new Map<string,{scope:string;key:string}>();let posts=0,allowErase=false;
 const endpoint=await media(t,(req,res)=>{const requestId=req.method==='DELETE'?String(req.url).slice('/executions/'.length):String(req.headers['x-mote-request-id']),scope=String(req.headers['x-mote-request-scope']),key=String(req.headers.authorization);
  if(req.method==='DELETE'){const fact=facts.get(requestId);assert.ok(fact);assert.equal(fact.scope,scope);assert.equal(fact.key,key);if(!allowErase){res.writeHead(409).end('{}');return;}facts.delete(requestId);res.end(JSON.stringify({version:1,requestId,deleted:true}));return;}
  posts++;facts.set(requestId,{scope,key});res.setHeader('X-Mote-Receipt-Id',requestId);respond(res,'GENERATED_ACCOUNT_RECEIPT');}),f=await fixture(t);await f.models(f.alice.token,endpoint,'GENERATED_A');await f.models(f.bob.token,endpoint,'GENERATED_B');
 for(const [token,key] of [[f.alice.token,'a'],[f.bob.token,'b']]){const ref=(await f.upload(token,Buffer.from('GENERATED_'+key),'image/png')).captures[0].original.ref;await f.wait(token,(await f.submit(token,ref)).id);}assert.equal(facts.size,2);
 const cleanup=f.read(db=>db.prepare('SELECT * FROM mp_worker_cleanup WHERE user_id=?').get(f.a.userId)!);assert.equal(cleanup.supported,1);
 const ordinary=await f.node.authority.authenticate(f.alice.token);await assert.rejects(f.node.configuration!.eraseWorkerReceipt(ordinary as any,{snapshotId:String(cleanup.snapshot_id),requestId:String(cleanup.request_id),scope:String(cleanup.scope)}));
 await f.checked(f.admin.token,'/api/admin/accounts/'+f.a.userId,'PATCH',{disabled:true});
 const control=async(domain:string)=>{const operationId='generated-delete-'+domain;f.grants.set(operationId,{deploymentId:f.deploymentId,userId:f.a.userId,domain,operationId,purpose:'delete'});return f.lifecycleAuthority.authorize(operationId);};
 const execution=await control('execution');assert.equal((await f.node.services.forLifecycle(execution).run() as any).status,'complete');assert.equal(f.read(db=>Number(db.prepare('SELECT count(*) n FROM user_tasks WHERE user_id=?').get(f.a.userId)!.n)),0);assert.equal(f.read(db=>Number(db.prepare('SELECT count(*) n FROM mp_worker_cleanup WHERE user_id=?').get(f.a.userId)!.n)),1);
 const processing=await control('processing'),service=f.node.services.forLifecycle(processing);assert.equal((await service.run() as any).status,'pending');assert.equal(facts.size,2);allowErase=true;assert.equal((await service.run() as any).status,'complete');assert.equal(facts.size,1);assert.ok([...facts.values()].every(fact=>fact.key==='Bearer GENERATED_B'));assert.equal(posts,2);assert.equal(f.read(db=>Number(db.prepare('SELECT count(*) n FROM mp_worker_cleanup WHERE user_id=?').get(f.a.userId)!.n)),0);
});

test('lease interruption cannot publish a late media body or silently repeat a completed request without a durable result',async t=>{
 const hold=deferred(),entered=deferred();t.after(()=>hold.resolve());let posts=0,requestId='',scope='';const incarnation=randomUUID();
 const endpoint=await media(t,async(req,res)=>{if(req.method==='GET'){res.end(JSON.stringify({version:1,requestId,incarnation,stage:'ocr',state:'running',acceptedAt:1,startedAt:2}));return;}posts++;requestId=String(req.headers['x-mote-request-id']);scope=String(req.headers['x-mote-request-scope']);res.setHeader('X-Mote-Receipt-Id',requestId);entered.resolve();await hold.promise;respond(res,'GENERATED_LATE_UNPUBLISHED');}),f=await fixture(t);await f.models(f.alice.token,endpoint,'GENERATED_LEASE_KEY');const ref=(await f.upload(f.alice.token,Buffer.from('GENERATED_LEASE_IMAGE'),'image/png')).captures[0].original.ref,parent=await f.submit(f.alice.token,ref);await entered.promise;
 const child=f.read(db=>String(db.prepare("SELECT id FROM execution_steps WHERE user_id=? AND kind='processing.ocr'").get(f.a.userId)!.id));f.read(db=>db.prepare('UPDATE execution_steps SET lease_until=0 WHERE id=?').run(child));void f.node.execution!.tick();
 await until(()=>f.read(db=>db.prepare('SELECT error FROM execution_steps WHERE id=?').get(child)?.error==='processor_still_running'),'expired ownership did not reconcile the still-running physical call');assert.equal(posts,1);assert.equal((await f.status(f.alice.token,ref)).processed,false);
 hold.resolve();await until(()=>f.read(db=>db.prepare('SELECT external_state FROM user_tasks WHERE task_id=?').get(child)?.external_state==='succeeded'),'late response did not settle only its issuance');f.read(db=>db.prepare('UPDATE execution_steps SET available_at=0 WHERE id=?').run(child));const result=await f.wait(f.alice.token,child,'blocked');assert.equal(result.failure.code,'processor_result_unavailable');await f.wait(f.alice.token,parent.id,'blocked');assert.equal(posts,1);assert.equal(f.read(db=>Number(db.prepare('SELECT count(*) n FROM mp_artifacts WHERE user_id=?').get(f.a.userId)!.n)),0);assert.equal(f.read(db=>db.prepare('SELECT scope FROM mp_media_calls WHERE user_id=?').get(f.a.userId)!.scope),scope);
});
