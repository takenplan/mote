import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture,media} from './fixtures/scoped-processing.js';
import {waitForScopedState} from './fixtures/scoped-process.js';
import {defaultModelSettings} from '../src/model-settings.js';
import {writeMessagesResponse} from '../../../scripts/fixtures/messages-provider.js';

for(const busyCalls of [[1],[2],[2,3]]){const busyAt=busyCalls[0],repeated=busyCalls.length===2;
test(repeated?'actual summary page 2 repeated capacity waits preserve each enclosing call across two restarts':`actual summary page ${busyAt} capacity wait preserves exactly the executed logical attempt across restart`,{timeout:45000},async t=>{
 const f=await fixture(t),prompts:any[]=[];
 const language=(await media(t,(_req,res,bytes)=>{
  const body=JSON.parse(bytes.toString()),envelope=JSON.parse(typeof body.messages[0].content==='string'?body.messages[0].content:body.messages[0].content[0].text);prompts.push(envelope);
  if(busyCalls.includes(prompts.length)){res.writeHead(429,{'Content-Type':'application/json','Retry-After':'60'}).end(JSON.stringify({error:{type:'rate_limit_error',message:'Generated capacity wait only'}}));return;}
  const id=envelope.untrustedEvidence[0].id;writeMessagesResponse(res,{stage:prompts.length,text:JSON.stringify({answer:'Generated accepted chunk ['+id+']',citationIds:[id]})});
 })).replace('/transcribe','/v1');
 const ref=(await f.upload(f.alice.token,Buffer.from('GENERATED_MIXED_PAGE '.repeat(4500)))).captures[0].original.ref;await f.wait(f.alice.token,(await f.submit(f.alice.token,ref)).id);
 assert.ok((await f.checked(f.alice.token,'/api/files/'+(await f.status(f.alice.token,ref)).original.captureId+'/chunks')).items.length>20);
 await f.configure(f.alice.token,'models',{profiles:[{id:'generated-pages',name:'Generated pages',settings:{...defaultModelSettings(),provider:'custom',protocol:'anthropic-messages',baseUrl:language,model:'generated-pages',apiKey:'GENERATED_PAGES'}}],selections:{file:{kind:'personal',id:'generated-pages'}}});
 const derived=await f.checked(f.alice.token,'/api/processing/derivations','POST',{originalRef:ref,operationId:'generated-mixed-summary',modes:['summary']});let task:any;
 await waitForScopedState(async()=>{const row=f.read(db=>db.prepare("SELECT e.id FROM execution_steps e JOIN user_tasks u ON u.task_id=e.id WHERE u.user_id=? AND e.kind='processing.analysis'").get(f.a.userId));if(!row)return false;task=await f.task(f.alice.token,String(row.id));return task.state==='waiting'&&task.error==='rate_limited';},()=>JSON.stringify(task),20000);
 assert.equal(prompts.length,busyAt);assert.equal(task.attempts,busyAt===1?0:1);assert.equal(task.retryExhausted,false);const session=f.read(db=>db.prepare('SELECT id,executed FROM execution_attempt_sessions WHERE step_id=? AND open=1').get(task.id)!);assert.equal(session.executed,busyAt===1?0:1);
 const calls=f.read(db=>db.prepare('SELECT state FROM task_external_calls WHERE task_id=?').all(task.id));assert.equal(calls.length,1);assert.equal(calls[0].state,busyAt===1?'not_executed':'succeeded','an earlier accepted query cannot turn into a never-executed enclosing operation');
 const cached=f.read(db=>db.prepare("SELECT id,json FROM mp_artifacts WHERE user_id=? AND original_id=? AND json LIKE '%Generated accepted chunk%' ORDER BY id").all(f.a.userId,ref.slice(9)));assert.equal(cached.length,busyAt===1?0:1);
 await f.restart();f.read(db=>db.prepare("UPDATE execution_steps SET available_at=0 WHERE id=? AND state='waiting'").run(task.id));
 if(repeated){
  await waitForScopedState(async()=>{task=await f.task(f.alice.token,task.id);return task.state==='waiting'&&task.error==='rate_limited'&&prompts.length===3;},()=>JSON.stringify(task),20000);
  assert.equal(task.attempts,1);assert.equal(f.read(db=>db.prepare('SELECT id FROM execution_attempt_sessions WHERE step_id=? AND open=1').get(task.id)!.id),session.id);
  const spans=f.read(db=>db.prepare('SELECT state FROM task_external_calls WHERE task_id=? ORDER BY issued_at').all(task.id));assert.deepEqual(spans.map(x=>x.state),['succeeded','not_executed'],'the new remaining-page span did not execute, despite prior execution in the same logical session');
  await f.restart();f.read(db=>db.prepare("UPDATE execution_steps SET available_at=0 WHERE id=? AND state='waiting'").run(task.id));
 }
 await f.wait(f.alice.token,derived.id);
 task=await f.task(f.alice.token,task.id);assert.equal(task.state,'succeeded');assert.equal(task.attempts,1);assert.equal(prompts.length,repeated?4:3);assert.equal(f.read(db=>db.prepare('SELECT count(*) n FROM execution_attempt_sessions WHERE step_id=?').get(task.id)!.n),1);assert.equal(f.read(db=>db.prepare('SELECT id FROM execution_attempt_sessions WHERE step_id=?').get(task.id)!.id),session.id);
 if(busyAt===2){assert.deepEqual(f.read(db=>db.prepare('SELECT id,json FROM mp_artifacts WHERE id=?').get(cached[0].id)),cached[0]);for(const prompt of prompts.slice(2)){assert.equal(prompt.untrustedEvidence[0].id,prompts[1].untrustedEvidence[0].id);assert.notEqual(prompt.untrustedEvidence[0].id,prompts[0].untrustedEvidence[0].id);}}
 assert.equal((await f.checked(f.bob.token,'/api/usage')).items.length,0);
});}
