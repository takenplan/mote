import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {setTimeout as delay} from 'node:timers/promises';
import {historyAskFixture} from './fixtures/history-ask-fixture.js';
import {defaultMemorySettings} from '../src/scope/memory-schema.js';

test('real Work HTTP retains only the saved conversation link across revision and restart while current execution reads remain fenced',async t=>{
 const f=await historyAskFixture(t),conversationId=randomUUID(),id=randomUUID(),turnId=randomUUID();
 let origin=await f.node.app.listen({host:'127.0.0.1',port:0}),a=f.a;
 const request=async(token:string,url:string,method='GET',body?:unknown)=>{
  const response=await fetch(origin+url,{method,headers:{'x-mote-protocol-version':'2','x-mote-ingress-version':'3',...(token?{authorization:'Bearer '+token}:{}),...(body===undefined?{}:{'content-type':'application/json'})},...(body===undefined?{}:{body:JSON.stringify(body)})});
  return {status:response.status,value:await response.json() as any};
 };
 const checked=async(token:string,url:string,method='GET',body?:unknown)=>{const response=await request(token,url,method,body);assert.equal(response.status,200,JSON.stringify(response.value));return response.value;};
 const restart=async()=>{await f.restart();origin=await f.node.app.listen({host:'127.0.0.1',port:0});};
 const ask=async(user:any)=>{
  await checked(user.token,'/api/conversations','POST',{id:conversationId,title:'Generated saved Work history'});
  await checked(user.token,'/api/query-runs','POST',{id,input:{question:'Generated Work history question',conversationId,turnId}});
  const deadline=Date.now()+20000;for(;;){const run=await checked(user.token,'/api/query-runs/'+id);if(run.status!=='running'){assert.equal(run.status,'completed',JSON.stringify(run));return run;}assert.ok(Date.now()<deadline,'real generated Ask did not finish');await delay(10);}
 };
 for(const user of [a,f.b])await f.replace(user.token,'memory',{...defaultMemorySettings(),automatic:false,integration:false});
 const material=await f.publish(a,'A');await f.publish(f.b,'B');
 const original=await ask(a),b=await ask(f.b),workId='query:'+id,workUrl='/api/work-activity/'+encodeURIComponent(workId);
 const assertLinked=async(user:any)=>{
  const work=await checked(user.token,workUrl);assert.equal(work.state,'completed');assert.equal(work.artifacts.length,1,'a saved historical answer must remain reachable from Work');
  assert.equal(work.artifacts[0].id,id);assert.equal(work.artifacts[0].href,'#/ask?conversation='+encodeURIComponent(conversationId));
  assert.ok((await checked(user.token,'/api/work-activity?limit=50')).items.some((item:any)=>item.id===workId&&item.artifacts.length===1));
  return work;
 };
 await assertLinked(a);await assertLinked(f.b);
 const artifact=f.read(db=>String(db.prepare('SELECT id FROM ma_artifacts WHERE user_id=? AND run_id=? LIMIT 1').get(a.userId,id)!.id));
 assert.equal((await request(a.token,'/api/ask-artifacts/'+artifact)).status,200);
 const context=await f.node.authority.authenticate(a.token),draft=f.read(db=>JSON.parse(String(db.prepare('SELECT json FROM pd_material_versions WHERE user_id=? AND material_id=? AND revision=?').get(a.userId,material.id,material.revision)!.json)));
 draft.blocks[0].text='GENERATED_ORDINARY_WORK_CORRECTION';f.node.ingress.bindSource(context,['same-source'],()=>{}).publishMaterial(draft,material.revision);
 const assertStale=async()=>{
  const history=await checked(a.token,'/api/conversations/'+conversationId);assert.equal(history.turns[0].evidenceStale,true);assert.deepEqual(history.turns[0].result,original.result);
  const current=await checked(a.token,'/api/query-runs/'+id);assert.equal(current.status,'failed');assert.equal(current.result,undefined,'historical navigation cannot authorize a current execution result');
  assert.notEqual((await request(a.token,'/api/ask-artifacts/'+artifact)).status,200,'operational artifacts retain strict current evidence checks');
  const scoped=f.node.ask!.bind(await f.node.authority.authenticate(a.token),{assertCurrent:()=>{}});
  await assert.rejects(scoped.reader().read(['artifact:'+artifact]),'model artifact reads retain strict current evidence checks');
  const work=await assertLinked(a);assert.deepEqual(work.evidence.refs,[],'old citation locators are not promoted into current Work evidence');
  assert.equal(work.evidence.count,0);assert.ok(!JSON.stringify(work).includes(original.result.answer));
 };
 await assertStale();await restart();await assertStale();
 const calls=f.requests.length;
 await checked(a.token,'/api/sources/same-source','PATCH',{enabled:false});assert.deepEqual((await checked(a.token,workUrl)).artifacts,[],'current source exposure still fences historical navigation');await assertLinked(f.b);
 await checked(a.token,'/api/sources/same-source','PATCH',{enabled:true});await assertStale();
 const old=a.token;await checked(f.admin.token,'/api/admin/accounts/'+a.userId,'PATCH',{disabled:true});assert.equal((await request(old,workUrl)).status,401);await assertLinked(f.b);
 await checked(f.admin.token,'/api/admin/accounts/'+a.userId,'PATCH',{disabled:false});assert.equal((await request(old,workUrl)).status,401);
 a=await checked('', '/api/auth/login','POST',{username:'generated-a',password:'Generated-Ask-Only-01',mode:'client'});await assertStale();
 const capture=f.read(db=>String(db.prepare('SELECT capture_id FROM pd_material_captures WHERE user_id=? AND material_id=? LIMIT 1').get(a.userId,material.id)!.capture_id));
 await checked(a.token,'/api/captures/'+capture,'DELETE');assert.deepEqual((await checked(a.token,workUrl)).artifacts,[]);assert.equal((await checked(a.token,'/api/conversations/'+conversationId)).turns[0].evidenceDeleted,true);
 await restart();assert.deepEqual((await checked(a.token,workUrl)).artifacts,[]);await assertLinked(f.b);assert.deepEqual((await checked(f.b.token,'/api/conversations/'+conversationId)).turns[0].result,b.result);
 assert.equal(f.requests.length,calls,'navigation, restore and permission changes must not issue model replay');
});
