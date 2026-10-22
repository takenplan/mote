import test from 'node:test';
import assert from 'node:assert/strict';
import {modelFixture,event} from './fixtures/scoped-actions.js';
import {deferred,waitForState} from './fixtures/scoped-query-accounts.js';
import {writeMessagesResponse} from '../../../scripts/fixtures/messages-provider.js';

const envelope=(body:any)=>JSON.parse(typeof body.messages[0].content==='string'?body.messages[0].content:body.messages[0].content[0].text);
const calendar=(body:any)=>{const value=envelope(body);return value.responseMode==='calendar-extraction'&&value.requiredSkill==='calendar-extraction';};
const empty=(res:Parameters<typeof writeMessagesResponse>[0])=>writeMessagesResponse(res,{stage:1,text:JSON.stringify({answer:JSON.stringify({actions:[]}),citationIds:[]})});
function activeCalendar(f:Awaited<ReturnType<typeof modelFixture>>){const rows=f.read(db=>db.prepare("SELECT j.id job_id,j.task_id,e.operation_id,m.id usage_id,m.json FROM ac_jobs j JOIN execution_steps e ON e.id=j.task_id AND e.user_id=j.user_id JOIN user_model_usage m ON m.user_id=e.user_id AND json_extract(m.json,'$.attribution.operationId')=e.operation_id WHERE j.user_id=? AND e.kind='actions.extract' AND e.state='running' AND json_extract(j.proof,'$.sources[0].id')='other-source' AND EXISTS(SELECT 1 FROM task_physical_calls p WHERE p.user_id=e.user_id AND p.task_id=e.id AND p.snapshot_id=json_extract(m.json,'$.issuance.leaseId') AND p.state='active')").all(f.a.userId));assert.equal(rows.length,1,'The held request belongs to one genuine independent Actions input');const row=rows[0],receipt=JSON.parse(String(row.json));assert.equal(receipt.attribution.operationId,row.operation_id);assert.equal(receipt.attribution.jobId,row.job_id);assert.equal(receipt.attribution.agentId,'action-discovery');assert.equal(receipt.attribution.moduleId,'actions');assert.equal(receipt.attribution.skillId,'calendar-extraction');assert.ok(receipt.issuance.issuedAt);return {jobId:String(row.job_id),taskId:String(row.task_id),usageId:String(row.usage_id)};}

test('a later model request cannot redisclose an initial catalog proposal after its independent source is revoked',async t=>{
 const f=await modelFixture(t),sentinel='GENERATED_RETIRED_CATALOG_TITLE';t.after(()=>{for(const request of f.requests)assert.ok(!request.raw.includes(request.owner==='A'?'GENERATED_B_PRIVATE':'GENERATED_A_PRIVATE'),'Every provider request preserves its actual owner');});
 f.scripts.set('A',(body,_raw,res)=>{
  if(!calendar(body))return empty(res);
  const record=envelope(body).untrustedEvidence[0];
  writeMessagesResponse(res,{stage:1,text:JSON.stringify({answer:JSON.stringify({actions:[{kind:'calendar.create',event:{...event,title:sentinel},uncertainty:'Generated old catalog',sameAs:null,evidence:[{id:record.id,quote:'GENERATED_A_PRIVATE_APPOINTMENT'}]}]}),citationIds:[record.id]})});
 });
 await f.ingest(f.a,'A');await f.enable(f.a);await f.proposal(f.a);
 const beforeB=await f.ok(f.b.token,'/api/actions'),entered=deferred(),release=deferred(),laterRequests:string[]=[];
 let retired=false,retiredAt=0,initialRaw='';let initialBinding:ReturnType<typeof activeCalendar>|undefined;
 t.after(()=>release.resolve());
 f.scripts.set('A',async(body,raw,res)=>{
  if(retired)laterRequests.push(raw);
  if(!calendar(body))return empty(res);
  const used=body.messages.some((message:any)=>message.role==='assistant'&&Array.isArray(message.content)&&message.content.some((part:any)=>part.type==='tool_use'&&part.name==='evidence'));
  if(!used){if(!initialBinding){initialBinding=activeCalendar(f);initialRaw=raw;}entered.resolve();await release.promise;writeMessagesResponse(res,{stage:1,tool:{name:'evidence',args:{ids:[envelope(body).untrustedEvidence[0].id]}}});return;}
  writeMessagesResponse(res,{stage:2,text:JSON.stringify({answer:JSON.stringify({actions:[]}),citationIds:[]})});
 });
 await f.ingest(f.a,'A','generated-independent-input','other-source');await f.ok(f.a.token,'/api/actions/retry','POST',{});await entered.promise;
 assert.ok(initialBinding,'The held calendar request has real owner/task/job/usage/physical authority');assert.ok(initialRaw.includes(sentinel),'the initial authorized model request really contains the existing catalog');
 await f.ok(f.a.token,'/api/sources/same-source','DELETE');retired=true;retiredAt=f.requests.length;release.resolve();
 await waitForState(async()=>f.read(db=>db.prepare("SELECT e.state FROM ac_jobs j JOIN execution_steps e ON e.id=j.task_id WHERE j.user_id=? AND json_extract(j.proof,'$.sources[0].id')='other-source'").all(f.a.userId)),rows=>rows.length>0&&rows.every(row=>!['running','waiting'].includes(String(row.state))),'independent input finishes after catalog-source revocation',30000);
 assert.equal(laterRequests.filter(raw=>raw.includes(sentinel)).length,0,'the retired catalog body must not be sent again after the provider await');assert.equal(f.requests.slice(retiredAt).filter(request=>request.raw.includes(sentinel)).length,0,'No later provider body may redisclose the retired catalog');
 assert.deepEqual(await f.ok(f.b.token,'/api/actions'),beforeB);
});
