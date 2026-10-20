import test from 'node:test';
import assert from 'node:assert/strict';
import {writeFileSync,existsSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {setTimeout as delay} from 'node:timers/promises';
import {scopedMemoryFixture} from './fixtures/scoped-memory-host.js';
import {generatedMemoryRelease} from './fixtures/scoped-memory-release.js';

for(const outcome of ['held-save','held-cancel','readback-failure'] as const)test('external provider '+outcome+' cannot expose an Owner question before its saved evaluation',{timeout:45000},async t=>{
 const f=await scopedMemoryFixture(t,generatedMemoryRelease()),material=await f.publish(f.a,'A'),pkg=await f.install();await f.plugin(f.a,pkg);const binding=await f.bind(f.a,'same-instance'),context=await f.node.authority.authenticate(f.a.token),descriptor=await f.node.plugins!.domainProvider(context,binding.target.snapshotId,['repository']);
 const flag=outcome==='readback-failure'?'fail-read':'hold-before-put';writeFileSync(join(descriptor.directory,flag),'generated fixture only');f.beforeClose(()=>{rmSync(join(descriptor.directory,flag),{force:true});writeFileSync(join(descriptor.directory,'release-put'),'generated fixture release');});
 f.answers.set('A',(_raw,keys,ids)=>({memories:[{domain:'personal',title:'Generated separately supported claim',statement:'Nora prefers generated tea. ['+ids[0]+']',uncertainty:'Generated original; owner identity unknown',admission:{layer:'memory',reason:'Explicit generated third-party context',scope:'Nora in generated fixture',attribution:'third_party'},evidenceIds:[ids[0]],evidence:[{id:ids[0],quote:'GENERATED_MEMORY_A: Nora prefers generated tea.'}]}],coverage:keys.map((key,index)=>index===0?{key,state:'needs_owner_input',candidateIndexes:[0],question:{prompt:'Who is the generated speaker in this original?',choices:[],evidence:[{id:ids[0],quote:'GENERATED_MEMORY_A: Nora prefers generated tea.'}]}}:{key,state:'no_candidates',candidateIndexes:[]})}));
 const job=await f.submit(f.a,[material.id]),task=job.tasks.batch,questions=async()=>(await f.request(f.a.token,'/api/owner-questions')).json().items;
 if(outcome==='readback-failure'){
  assert.equal(await f.terminal(task.id),'blocked');assert.ok(f.read(db=>db.prepare("SELECT 1 FROM mm_provider_journal WHERE user_id=? AND state='submitted'").get(f.a.userId)),'an issued write with failed readback remains unknown');
 }else{
  const end=Date.now()+15000;while(!existsSync(join(descriptor.directory,'put-started'))){assert.ok(Date.now()<end);await delay(10);}
  assert.equal((await f.request(f.a.token,'/api/memory/jobs/'+job.id)).json().tasks.batch.state,'running');
 }
 assert.deepEqual(await questions(),[]);assert.equal(f.read(db=>db.prepare('SELECT count(*) n FROM mm_records WHERE user_id=?').get(f.a.userId))!.n,0);
 assert.equal((await f.request(f.a.token,'/api/owner-questions/'+randomUUID()+'/reply','POST',{requestId:randomUUID(),expectedRevision:1,action:'unknown'})).statusCode,404,'the actual reply endpoint has no pre-save continuation');
 if(outcome==='held-cancel')assert.equal((await f.request(f.a.token,'/api/memory/jobs/'+job.id+'/cancel','POST',{})).statusCode,200);
 writeFileSync(join(descriptor.directory,'release-put'),'generated fixture release');
 if(outcome==='held-save'){
  await f.wait(f.a,job.id);const question=(await questions())[0];assert.ok(question);assert.equal((await f.request(f.a.token,'/api/memories')).json().items.length,1);assert.equal((await f.request(f.b.token,'/api/owner-questions/'+question.id)).statusCode,404);
  const closed=await f.request(f.a.token,'/api/owner-questions/'+question.id+'/reply','POST',{requestId:randomUUID(),expectedRevision:question.revision,action:'unknown'});assert.equal(closed.statusCode,200,closed.body);assert.equal(closed.json().state,'closed');
 }else{await f.terminal(task.id);assert.deepEqual(await questions(),[]);}
});
