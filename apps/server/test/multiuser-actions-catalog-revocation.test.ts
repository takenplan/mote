import test from 'node:test';
import assert from 'node:assert/strict';
import {modelFixture,event} from './fixtures/scoped-actions.js';
import {deferred,waitForState} from './fixtures/scoped-query-accounts.js';
import {writeMessagesResponse} from '../../../scripts/fixtures/messages-provider.js';

const envelope=(body:any)=>JSON.parse(typeof body.messages[0].content==='string'?body.messages[0].content:body.messages[0].content[0].text);

test('a later model request cannot redisclose an initial catalog proposal after its independent source is revoked',async t=>{
 const f=await modelFixture(t),sentinel='GENERATED_RETIRED_CATALOG_TITLE';
 f.scripts.set('A',(body,_raw,res)=>{
  const record=envelope(body).untrustedEvidence[0];
  writeMessagesResponse(res,{stage:1,text:JSON.stringify({answer:JSON.stringify({actions:[{kind:'calendar.create',event:{...event,title:sentinel},uncertainty:'Generated old catalog',sameAs:null,evidence:[{id:record.id,quote:'GENERATED_A_PRIVATE_APPOINTMENT'}]}]}),citationIds:[record.id]})});
 });
 await f.ingest(f.a,'A');await f.enable(f.a);await f.proposal(f.a);
 const beforeB=await f.ok(f.b.token,'/api/actions'),entered=deferred(),release=deferred(),laterRequests:string[]=[];
 let retired=false;
 t.after(()=>release.resolve());
 f.scripts.set('A',async(body,raw,res)=>{
  if(retired)laterRequests.push(raw);
  const used=body.messages.some((message:any)=>message.role==='assistant'&&Array.isArray(message.content)&&message.content.some((part:any)=>part.type==='tool_use'&&part.name==='evidence'));
  if(!used){entered.resolve();await release.promise;writeMessagesResponse(res,{stage:1,tool:{name:'evidence',args:{ids:[envelope(body).untrustedEvidence[0].id]}}});return;}
  writeMessagesResponse(res,{stage:2,text:JSON.stringify({answer:JSON.stringify({actions:[]}),citationIds:[]})});
 });
 await f.ingest(f.a,'A','generated-independent-input','other-source');await f.ok(f.a.token,'/api/actions/retry','POST',{});await entered.promise;
 assert.ok(f.requests.at(-1)!.raw.includes(sentinel),'the initial authorized model request really contains the existing catalog');
 await f.ok(f.a.token,'/api/sources/same-source','DELETE');retired=true;release.resolve();
 await waitForState(async()=>f.read(db=>db.prepare("SELECT e.state FROM ac_jobs j JOIN execution_steps e ON e.id=j.task_id WHERE j.user_id=? AND json_extract(j.proof,'$.sources[0].id')='other-source'").all(f.a.userId)),rows=>rows.length>0&&rows.every(row=>!['running','waiting'].includes(String(row.state))),'independent input finishes after catalog-source revocation',30000);
 assert.equal(laterRequests.filter(raw=>raw.includes(sentinel)).length,0,'the retired catalog body must not be sent again after the provider await');
 assert.deepEqual(await f.ok(f.b.token,'/api/actions'),beforeB);
});
