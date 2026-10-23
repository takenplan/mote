import test,{type TestContext} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID,createHash} from 'node:crypto';
import type {ServerResponse} from 'node:http';
import {modelFixture as baseModelFixture,event} from './fixtures/scoped-actions.js';
import {SEMANTIC_EXTRACTION_PROMPT} from '../src/semantic-products.js';
import {deferred,item,source,waitForState} from './fixtures/scoped-query-accounts.js';
import {writeMessagesResponse} from '../../../scripts/fixtures/messages-provider.js';

type Fixture=Awaited<ReturnType<typeof baseModelFixture>>;
async function modelFixture(t:TestContext){const f=await baseModelFixture(t);t.after(()=>{for(const request of f.requests)assert.ok(!request.raw.includes(request.owner==='A'?'GENERATED_B_PRIVATE':'GENERATED_A_PRIVATE'),'Every provider request preserves its actual owner');});return f;}
const target={deviceId:'same-device',calendarId:'same-calendar'};
const at='2026-10-16T08:01:00Z';
const cueText=(owner:string,index:number)=>index===0?'GENERATED_'+owner+'_PRIVATE_PARTICIPANT_AND_DATE':'GENERATED_'+owner+'_PRIVATE_TIME_AND_LOCATION';
const envelope=(body:any)=>JSON.parse(typeof body.messages[0].content==='string'?body.messages[0].content:body.messages[0].content[0].text);
const send=(res:ServerResponse,value:unknown,ids:string[])=>writeMessagesResponse(res,{stage:1,text:JSON.stringify({answer:JSON.stringify(value),citationIds:ids})});

type ActionPhase='semantic'|'calendar';
function requestPhase(body:any):ActionPhase|undefined{const data=envelope(body);if(data.responseMode==='calendar-extraction'&&data.requiredSkill==='calendar-extraction')return 'calendar';if(data.responseMode==='answer'&&!data.untrustedTaskContext?.memoryWork&&typeof data.request==='string'&&data.request.endsWith(SEMANTIC_EXTRACTION_PROMPT))return 'semantic';}
const actionRequests=(f:Fixture,owner?:string,phase?:ActionPhase)=>f.requests.filter(request=>(owner===undefined||request.owner===owner)&&requestPhase(request.body)!==undefined&&(phase===undefined||requestPhase(request.body)===phase));
function actionUsage(f:Fixture,userId:string){return f.read(db=>db.prepare("SELECT m.id,m.json,e.id task_id,e.kind,e.state task_state,e.operation_id,p.id semantic_id,j.id job_id FROM user_model_usage m JOIN execution_steps e ON e.user_id=m.user_id AND e.operation_id=json_extract(m.json,'$.attribution.operationId') LEFT JOIN ac_semantic_products p ON p.user_id=e.user_id AND p.task_id=e.id LEFT JOIN ac_jobs j ON j.user_id=e.user_id AND j.task_id=e.id WHERE m.user_id=? AND e.kind IN ('actions.understand','actions.extract') ORDER BY m.id").all(userId)).map(row=>({id:String(row.id),task_id:String(row.task_id),kind:String(row.kind),task_state:String(row.task_state),operation_id:String(row.operation_id),semantic_id:row.semantic_id===null?null:String(row.semantic_id),job_id:row.job_id===null?null:String(row.job_id),receipt:JSON.parse(String(row.json))}));}
function boundUsage(f:Fixture,userId:string){const rows=actionUsage(f,userId);for(const row of rows){const semantic=row.kind==='actions.understand',receipt=row.receipt;assert.equal(receipt.attribution.operationId,row.operation_id);assert.equal(receipt.attribution.jobId,semantic?row.semantic_id:row.job_id);assert.equal(receipt.attribution.agentId,semantic?'segment-understanding':'action-discovery');assert.equal(receipt.attribution.moduleId,semantic?'memories':'actions');assert.equal(receipt.attribution.skillId,semantic?null:'calendar-extraction');assert.ok(receipt.issuance.issuedAt);assert.ok(f.read(db=>Boolean(db.prepare('SELECT 1 FROM task_physical_calls WHERE user_id=? AND task_id=? AND snapshot_id=?').get(userId,row.task_id,receipt.issuance.leaseId))),'An observed query belongs to the exact genuine task model call');}return rows;}
function assertBoundCalls(f:Fixture,user:Fixture['a'],owner:string,retiredReceiptIds:readonly unknown[]=[]){const rows=boundUsage(f,user.userId);for(const phase of ['semantic','calendar'] as const){const matching=rows.filter(row=>row.kind===(phase==='semantic'?'actions.understand':'actions.extract'));assert.ok(matching.every(row=>row.receipt.status==='completed'||retiredReceiptIds.includes(row.id)&&row.receipt.status==='failed'));assert.equal(matching.reduce((total,row)=>total+Number(row.receipt.tokens.requests),0),actionRequests(f,owner,phase).length,'Actual '+phase+' provider calls match owner/task/job model receipts');}return rows;}
function activeActionCall(f:Fixture,userId:string,phase:ActionPhase){const kind=phase==='semantic'?'actions.understand':'actions.extract',rows=boundUsage(f,userId).filter(row=>row.kind===kind&&row.task_state==='running'&&f.read(db=>Boolean(db.prepare("SELECT 1 FROM task_physical_calls WHERE user_id=? AND task_id=? AND snapshot_id=? AND state='active'").get(userId,row.task_id,row.receipt.issuance.leaseId))));assert.equal(rows.length,1,'The held '+phase+' response belongs to one actual running Actions model task');return rows[0];}
const nativeCalls=(f:Fixture,userId:string,operationId?:string)=>f.read(db=>db.prepare("SELECT c.*,o.id operation_id FROM task_external_calls c JOIN ac_operations o ON o.user_id=c.user_id AND o.task_id=c.task_id JOIN execution_steps e ON e.user_id=c.user_id AND e.id=c.task_id WHERE o.user_id=? AND e.kind='actions.delivery' AND (? IS NULL OR o.id=?) ORDER BY c.issuance_id").all(userId,operationId??null,operationId??null));

function screens(owner:string,ids=[randomUUID(),randomUUID()]){
 return ids.map((id,index)=>({id,deviceId:'same-device',deviceName:'Generated device',platform:'import',capturedAt:index?'2026-10-16T08:02:00Z':at,durationMs:0,source:'screen',appId:'generated.appointments',appName:'Generated appointment fixture',windowTitle:'Generated shared screen group',ocrText:'Generated unrelated prefix.\n'+cueText(owner,index)+'\nGenerated unrelated suffix.',privacy:{excluded:false,redacted:false,mode:'none',collection:'content'}}));
}
async function captureBatch(f:Fixture,user:Fixture['a'],values:unknown[],sourceId='same-source'){
 return f.ok(user.token,'/api/ingress/sources/'+sourceId+'/captures','POST',{batchId:randomUUID(),items:values});
}
function semanticResult(body:any,owner:string,cues=true){
 const records=envelope(body).untrustedEvidence??[],evidence=records.map((record:any,index:number)=>({id:record.id,quote:cueText(owner,index),offset:record.ocrText.indexOf(cueText(owner,index))}));
 return {summary:'Generated complete appointment interpretation',evidence,events:[],memoryCandidates:[],actionCues:cues?[{kind:'calendar.create',event,uncertainty:'Generated cross-original cue',evidence}]:[]};
}
function calendarResult(body:any){
 const data=envelope(body),start=data.request.indexOf('{"sharedActionCues":'),shared=JSON.parse(data.request.slice(start)),cue=shared.sharedActionCues[0];
 return {data,shared,actions:cue?[{kind:'calendar.create',event:cue.event,uncertainty:'Generated shared cue proposal',sameAs:null,evidence:cue.evidence.map(({id,quote}:any)=>({id,quote}))}]:[]};
}
function caches(f:Fixture,userId:string){return f.read(db=>db.prepare('SELECT p.id,p.revision,p.input,p.json,p.consumed,p.task_id,e.state,e.attempts,u.model_receipt FROM ac_semantic_products p JOIN execution_steps e ON e.id=p.task_id JOIN user_tasks u ON u.task_id=e.id AND u.user_id=p.user_id WHERE p.user_id=? ORDER BY p.id,p.revision').all(userId));}
function jobs(f:Fixture,userId:string){return f.read(db=>db.prepare('SELECT j.id,j.input,j.state,j.task_id,e.kind,e.state task_state,e.attempts,u.model_receipt FROM ac_jobs j JOIN execution_steps e ON e.id=j.task_id JOIN user_tasks u ON u.task_id=e.id AND u.user_id=j.user_id WHERE j.user_id=? ORDER BY j.id').all(userId));}
async function settled(f:Fixture,user:Fixture['a']){return waitForState(async()=>jobs(f,user.userId),rows=>rows.length>0&&rows.every(row=>row.state==='completed'&&row.task_state==='succeeded'),'all Actions input units completed');}

test('production screen ingress reuses one complete cross-original semantic product, exact cue ranges and account-owned calendar review/delivery',async t=>{
 const f=await modelFixture(t),ids=[randomUUID(),randomUUID()],seen=new Map<string,{semantic:any[];calendar:any[]}>();
 for(const [user,owner] of [[f.a,'A'],[f.b,'B']] as const){
  seen.set(owner,{semantic:[],calendar:[]});
  f.semanticScripts.set(owner,(body,_raw,res)=>{const data=envelope(body),result=semanticResult(body,owner);seen.get(owner)!.semantic.push(data);send(res,result,result.evidence.map((proof:any)=>proof.id));});
  f.scripts.set(owner,(body,_raw,res)=>{if(requestPhase(body)!=='calendar'){send(res,{actions:[]},[]);return;}const result=calendarResult(body);seen.get(owner)!.calendar.push(result);send(res,{actions:result.actions},result.actions.flatMap((action:any)=>action.evidence.map((proof:any)=>proof.id)));});
  await captureBatch(f,user,screens(owner,ids));await f.enable(user);
  await f.ok(user.token,'/api/actions/targets','POST',{deviceId:'same-device',deviceName:'Generated '+owner,calendars:[{id:'same-calendar',title:'Generated '+owner}]});
 }
 const ap=(await f.proposal(f.a)).items[0],bp=(await f.proposal(f.b)).items[0];
 for(const [user,owner,proposal] of [[f.a,'A',ap],[f.b,'B',bp]] as const){
  await settled(f,user);const producer=caches(f,user.userId);assert.equal(producer.length,1);assert.match(String(producer[0].id),/^[a-f0-9]{64}$/);assert.match(String(producer[0].revision),/^[a-f0-9]{64}$/);assert.equal(producer[0].state,'succeeded');assert.equal(producer[0].consumed,1);assert.equal(JSON.parse(String(producer[0].json)).productsVersion,1);assert.equal(JSON.parse(String(producer[0].json)).kind,'semantic');assert.equal(JSON.parse(String(producer[0].model_receipt)).feature,'memory');
  assert.equal(jobs(f,user.userId).length,1);assert.equal(JSON.parse(String(jobs(f,user.userId)[0].model_receipt)).feature,'chat');
  const observation=seen.get(owner)!;assert.equal(observation.semantic.length,1);assert.equal(observation.calendar.length,1);assertBoundCalls(f,user,owner);
  assert.deepEqual(observation.semantic[0].untrustedEvidence.map((record:any)=>record.id),ids);
  assert.deepEqual(observation.calendar[0].data.untrustedEvidence.map((record:any)=>({id:record.id,text:record.ocrText})),ids.map((id,index)=>({id,text:cueText(owner,index)})),'calendar receives only the semantic cue supporting spans');
  assert.deepEqual(observation.calendar[0].shared.sharedActionCues,JSON.parse(String(producer[0].json)).actionCues);
  assert.deepEqual(proposal.evidence.map((proof:any)=>({id:proof.id,quote:proof.quote})),ids.map((id,index)=>({id,quote:cueText(owner,index)})));
 }
 assert.equal(caches(f,f.a.userId)[0].id,caches(f,f.b.userId)[0].id,'same observation IDs may share a semantic ID across owners');assert.notEqual(caches(f,f.a.userId)[0].task_id,caches(f,f.b.userId)[0].task_id);
 const beforeB=await f.ok(f.b.token,'/api/actions'),review=await f.ok(f.a.token,'/api/actions/'+ap.id+'/review','POST',{version:ap.version,event:ap.event,target});
 assert.equal((await f.request(f.b.token,'/api/owner-questions/'+review.id+'/reply','POST',{requestId:randomUUID(),expectedRevision:review.revision,action:'answer',choiceId:'approve'})).statusCode,404);
 await f.ok(f.a.token,'/api/owner-questions/'+review.id+'/reply','POST',{requestId:randomUUID(),expectedRevision:review.revision,action:'answer',choiceId:'approve'});
 const claim=await f.ok(f.a.token,'/api/actions/'+ap.id+'/claim','POST',{deviceId:'same-device'});assert.equal(claim.mutationAllowed,true);
 const nativeBefore=nativeCalls(f,f.a.userId,claim.operationId);assert.equal(nativeBefore.length,1);assert.equal(nativeBefore[0].request_key,'calendar-operation:'+claim.operationId);
 const receipt={deviceId:'same-device',operationId:claim.operationId,status:'succeeded',externalId:'generated-cross-original-native'};assert.deepEqual(await f.ok(f.a.token,'/api/actions/'+ap.id+'/receipt','POST',receipt),{acknowledged:true,published:true});
 const before={a:caches(f,f.a.userId),b:caches(f,f.b.userId),aj:jobs(f,f.a.userId),bj:jobs(f,f.b.userId),requests:actionRequests(f).length,usageA:actionUsage(f,f.a.userId),usageB:actionUsage(f,f.b.userId)};
 await f.restart();await f.ok(f.a.token,'/api/actions/retry','POST',{});await f.ok(f.b.token,'/api/actions/retry','POST',{});await settled(f,f.a);await settled(f,f.b);
 assert.deepEqual(caches(f,f.a.userId),before.a);assert.deepEqual(caches(f,f.b.userId),before.b);assert.deepEqual(jobs(f,f.a.userId),before.aj);assert.deepEqual(jobs(f,f.b.userId),before.bj);assert.equal(actionRequests(f).length,before.requests);assert.deepEqual(actionUsage(f,f.a.userId),before.usageA);assert.deepEqual(actionUsage(f,f.b.userId),before.usageB);assert.deepEqual(await f.ok(f.b.token,'/api/actions'),beforeB);
 assert.deepEqual(await f.ok(f.a.token,'/api/actions/'+ap.id+'/receipt','POST',receipt),{acknowledged:true,published:true});const nativeAfter=nativeCalls(f,f.a.userId,claim.operationId);assert.equal(nativeAfter.length,1);assert.deepEqual(nativeAfter.map(({state,settled_at,...facts})=>facts),nativeBefore.map(({state,settled_at,...facts})=>facts));assert.equal(nativeAfter[0].state,'succeeded');
 for(const request of f.requests)assert.ok(!request.raw.includes(request.owner==='A'?'GENERATED_B_PRIVATE':'GENERATED_A_PRIVATE'));
});

test('a successful complete segment with empty action cues is consumed without a calendar request and remains checkpointed after restart',async t=>{
 const f=await modelFixture(t);let calendar=0;
 f.semanticScripts.set('A',(body,_raw,res)=>{const result=semanticResult(body,'A',false);send(res,result,result.evidence.map((proof:any)=>proof.id));});
 f.scripts.set('A',(body,_raw,res)=>{if(requestPhase(body)==='calendar')calendar++;send(res,{actions:[]},[]);});
 await captureBatch(f,f.a,screens('A'));await f.enable(f.a);await settled(f,f.a);
 const producer=caches(f,f.a.userId);assert.equal(producer.length,1);assert.equal(producer[0].consumed,1);assert.equal(producer[0].state,'succeeded');assert.deepEqual(JSON.parse(String(producer[0].json)).actionCues,[]);assert.equal(jobs(f,f.a.userId)[0].kind,'actions.prepare');assert.equal(calendar,0);assert.equal((await f.ok(f.a.token,'/api/actions')).items.length,0);
 const calls=actionRequests(f,'A').length,usage=assertBoundCalls(f,f.a,'A');assert.equal(actionRequests(f,'A','calendar').length,0);await f.restart();await f.ok(f.a.token,'/api/actions/retry','POST',{});await settled(f,f.a);assert.deepEqual(caches(f,f.a.userId),producer);assert.equal(actionRequests(f,'A').length,calls);assert.deepEqual(actionUsage(f,f.a.userId),usage);assert.equal(calendar,0);
});

test('empty semantic cues checkpoint without a configured chat model',async t=>{
 const f=await modelFixture(t),configured=await f.ok(f.a.token,'/api/configuration');
 await f.ok(f.a.token,'/api/configuration/models','PUT',{revision:configured.revision,value:{...configured.domains.find((domain:any)=>domain.id==='models').effective,selections:{memory:{kind:'personal',id:'same-model'}}},preserveRedactedSecrets:true});
 f.semanticScripts.set('A',(body,_raw,res)=>{const result=semanticResult(body,'A',false);send(res,result,result.evidence.map((proof:any)=>proof.id));});
 await captureBatch(f,f.a,screens('A'));await f.enable(f.a);await settled(f,f.a);
 assert.equal(caches(f,f.a.userId)[0].consumed,1);assert.equal(actionRequests(f,'A').length,1);assert.equal(actionRequests(f,'A','calendar').length,0);assertBoundCalls(f,f.a,'A');assert.equal(jobs(f,f.a.userId)[0].kind,'actions.prepare');
});

test('trusted Coding sources and derived Materials stay outside automatic Actions discovery while the other owner keeps ordinary input',async t=>{
 const f=await modelFixture(t),sourceId='generated-coding-boundary';
 await f.ok(f.a.token,'/api/ingress/sources','POST',{...source(sourceId),kind:'coding-agent'});
 await f.ok(f.b.token,'/api/ingress/sources','POST',source(sourceId));
 const coding={version:1,provider:'codex',sessionId:'same-session',projectKey:'same-project',eventId:'same-event',role:'assistant',attribution:'agent',channel:'final',part:0,parts:1};
 const accepted=await f.ok(f.a.token,'/api/ingress/sources/'+sourceId+'/items','POST',{batchId:'generated-coding-boundary',items:[{...item('GENERATED_A_PRIVATE_CODING_APPOINTMENT','same-event'),layer:'original',document:{coding}}]});
 const parent=await waitForState(()=>f.ok(f.a.token,'/api/materials?kind=mote.coding-session'),page=>page.items.length>0,'production Coding session Material'),context=await f.node.authority.authenticate(f.a.token),manifest=await f.ok(f.a.token,'/api/materials/'+parent.items[0].id);
 f.node.ingress.bindSource(context,[sourceId],()=>{}).publishMaterial({id:'mat_'+createHash('sha256').update(JSON.stringify([sourceId,'generated-derived'])).digest('hex'),kind:'generated.coding-derived',schemaVersion:1,title:'Generated derived product',origin:{sourceId,externalId:'generated-derived'},blocks:[{id:'derived',kind:'text',format:'plain',text:'GENERATED_A_PRIVATE_CODING_APPOINTMENT',memberIds:['parent']}],members:[{id:'parent',kind:'material',ref:manifest.ref,revision:manifest.revision}],coverage:{state:'complete'},fidelity:{state:'derived'},retention:{original:'retained',policy:'keep'}});
 await f.ingest(f.b,'B','same-event',sourceId);await f.enable(f.a);await f.enable(f.b);await f.proposal(f.b);
 await waitForState(()=>f.ok(f.a.token,'/api/tasks'),page=>page.items.some((task:any)=>task.kind==='actions.watch'&&task.state==='waiting'),'Coding-only watch scanned and checkpointed');
 assert.equal(actionRequests(f,'A').length,0);assert.equal(boundUsage(f,f.a.userId).length,0);assert.equal(jobs(f,f.a.userId).length,0);assert.equal(caches(f,f.a.userId).length,0);assert.equal((await f.ok(f.a.token,'/api/actions')).items.length,0);
 const todo=await f.request(f.a.token,'/api/todos','POST',{title:'Generated explicit coding follow-up',evidenceIds:[accepted.captures[0].id]});assert.equal(todo.statusCode,201,todo.body);
 await settled(f,f.b);assert.ok(actionRequests(f,'B').length>0);assert.ok(assertBoundCalls(f,f.b,'B').length>0);assert.equal((await f.ok(f.b.token,'/api/actions')).items.length,1);
});

test('long originals and structured V2 pages keep the direct calendar branch instead of requiring segment understanding',async t=>{
 const f=await modelFixture(t),long='GENERATED_LONG_ORIGINAL\n'+'x'.repeat(12100),direct:any[]=[];let semantic=0;
 f.semanticScripts.set('A',(_body,_raw,res)=>{semantic++;send(res,{summary:'Unexpected',evidence:[],events:[],memoryCandidates:[],actionCues:[]},[]);});
 f.scripts.set('A',(body,_raw,res)=>{if(requestPhase(body)==='calendar')direct.push(envelope(body));send(res,{actions:[]},[]);});
 const accepted=await f.ok(f.a.token,'/api/ingress/sources/same-source/items','POST',{batchId:'generated-long-original',items:[item(long,'generated-long-original')]}),longId=accepted.captures[0].id;
 await f.ok(f.a.token,'/api/ingress/sources','POST',{...source('generated-v2'),kind:'custom',platform:'macos'});
 const page={version:2,scope:'visible_window',adapterId:'generated.adapter',adapterVersion:'1',appVersion:'1',activity:'Generated',status:'ok',truncated:false,observations:{firstAt:at,lastAt:at,count:1},objects:[{kind:'article',title:'Generated V2 article',body:[{text:'GENERATED_V2_VISIBLE_BODY'}]}]},pageId=randomUUID();
 await captureBatch(f,f.a,[{id:pageId,deviceId:'same-device',deviceName:'Generated device',platform:'macos',capturedAt:at,durationMs:0,source:'ui_page',appId:'generated.pages',appName:'Generated pages',windowTitle:'',ocrText:'Generated V2 article\nGENERATED_V2_VISIBLE_BODY',metadata:{version:1,observedAt:at,collector:{method:'accessibility'},uiPage:page},privacy:{excluded:false,redacted:false,mode:'none',collection:'content'}}],'generated-v2');
 await f.enable(f.a);await settled(f,f.a);assert.equal(semantic,0);assert.equal(caches(f,f.a.userId).length,0);assert.equal(direct.length,3);assert.equal(actionRequests(f,'A','semantic').length,0);assert.equal(actionRequests(f,'A','calendar').length,3);assert.equal(assertBoundCalls(f,f.a,'A').length,3);assert.ok(direct.every(data=>JSON.parse(data.request.slice(data.request.indexOf('{"sharedActionCues":'))).sharedActionCues.length===0));
 const plans=jobs(f,f.a.userId).map(row=>JSON.parse(String(row.input)));assert.ok(plans.every(plan=>plan.semantic===undefined));assert.deepEqual(plans.flatMap(plan=>plan.ranges).filter(range=>range.id===longId).sort((a,b)=>a.offset-b.offset),[{id:longId,offset:0,length:12000},{id:longId,offset:10000,length:long.length-10000}]);assert.equal(plans.flatMap(plan=>plan.ranges).filter(range=>range.id===pageId).length,1);
});

test('stopping the discovery parent fences an in-flight semantic producer and one explicit retry resumes its existing task',async t=>{
 const f=await modelFixture(t),release=deferred();let entered=false;
 f.semanticScripts.set('A',async(body,_raw,res)=>{assert.equal(requestPhase(body),'semantic');activeActionCall(f,f.a.userId,'semantic');entered=true;await release.promise;const result=semanticResult(body,'A');send(res,result,result.evidence.map((proof:any)=>proof.id));});
 try{
  await captureBatch(f,f.a,screens('A'));await f.enable(f.a);await waitForState(async()=>entered,Boolean,'semantic provider entered');
  const state=f.read(db=>db.prepare('SELECT policy_task FROM ac_state WHERE user_id=?').get(f.a.userId))!,producer=caches(f,f.a.userId)[0];
  const usageBefore=boundUsage(f,f.a.userId).map(row=>row.id);await f.ok(f.a.token,'/api/tasks/'+state.policy_task+'/cancel','POST',{});const calls=actionRequests(f,'A').length;release.resolve();
  await waitForState(()=>f.ok(f.a.token,'/api/tasks/'+producer.task_id),task=>task.state!=='running','retired semantic producer stopped');
  assert.equal(caches(f,f.a.userId)[0].json,null);assert.equal((await f.ok(f.a.token,'/api/actions')).items.length,0);assert.equal(actionRequests(f,'A').length,calls);assert.deepEqual(boundUsage(f,f.a.userId).map(row=>row.id),usageBefore);
  f.semanticScripts.delete('A');f.scripts.set('A',(body,_raw,res)=>{if(requestPhase(body)!=='calendar'){send(res,{actions:[]},[]);return;}const result=calendarResult(body);send(res,{actions:result.actions},result.actions.flatMap((action:any)=>action.evidence.map((proof:any)=>proof.id)));});await f.ok(f.a.token,'/api/actions/retry','POST',{});await f.proposal(f.a);await settled(f,f.a);
  assert.equal(caches(f,f.a.userId)[0].task_id,producer.task_id);assert.equal(caches(f,f.a.userId)[0].consumed,1);assertBoundCalls(f,f.a,'A',usageBefore);
 }finally{release.resolve();}
});

for(const phase of ['semantic','calendar'] as const)test('a held '+phase+' result cannot publish after production source deletion',async t=>{
 const f=await modelFixture(t),release=deferred();let entered=false;
 f.semanticScripts.set('A',async(body,_raw,res)=>{if(phase==='semantic'){assert.equal(requestPhase(body),'semantic');activeActionCall(f,f.a.userId,'semantic');entered=true;await release.promise;}const result=semanticResult(body,'A');send(res,result,result.evidence.map((proof:any)=>proof.id));});
 f.scripts.set('A',async(body,_raw,res)=>{if(phase==='calendar'&&requestPhase(body)==='calendar'){activeActionCall(f,f.a.userId,'calendar');entered=true;await release.promise;}if(requestPhase(body)!=='calendar'){send(res,{actions:[]},[]);return;}const result=calendarResult(body);send(res,{actions:result.actions},result.actions.flatMap((action:any)=>action.evidence.map((proof:any)=>proof.id)));});
 try{
  await captureBatch(f,f.a,screens('A'));await f.enable(f.a);await waitForState(async()=>entered,value=>value,'held production '+phase+' transport');
  assert.equal(caches(f,f.a.userId).length,1);await f.ok(f.a.token,'/api/sources/same-source','DELETE');assert.equal(caches(f,f.a.userId).length,0,'deletion synchronously erases cached original spans and products');release.resolve();
  await waitForState(()=>f.ok(f.a.token,'/api/tasks'),value=>!value.items.some((task:any)=>['actions.understand','actions.extract'].includes(task.kind)&&task.state==='running'),'held Actions task terminates after deletion');
  assert.equal((await f.ok(f.a.token,'/api/actions')).items.length,0);assert.equal(caches(f,f.a.userId).length,0);assert.equal(f.read(db=>Number(db.prepare('SELECT count(*) n FROM ac_proposals WHERE user_id=?').get(f.a.userId)!.n)),0);assert.equal(nativeCalls(f,f.a.userId).length,0);assert.equal((await f.ok(f.b.token,'/api/sources/same-source')).enabled,true);
 }finally{release.resolve();}
});
