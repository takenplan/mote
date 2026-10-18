import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {setTimeout as delay} from 'node:timers/promises';
import {scopedMemoryFixture} from './fixtures/scoped-memory-host.js';
import {writeMessagesResponse} from '../../../scripts/fixtures/messages-provider.js';

// Every source message and provider response is generated locally. These cases
// enter the real HTTP ingest, clean-dialogue organizer and Memory lifecycle.
type Fixture=Awaited<ReturnType<typeof scopedMemoryFixture>>;
const ownerText=(owner:string)=>'GENERATED_CODING_OWNER_'+owner+': Please keep a reviewable preview; deployment is deferred.';
const reportText=(owner:string)=>'GENERATED_CODING_REPORT_'+owner+': The generated preview is ready; physical-device checks remain unknown.';
const understood=(raw:string)=>raw.includes('FINAL UNIFIED RESPONSE CONTRACT:')&&raw.includes('Interpret every supplied part');
async function configure(f:Fixture,user:{token:string}){
 const view=(await f.request(user.token,'/api/memory')).json();await f.replace(user.token,'memory',{...view.settings,automatic:false,integration:false});
}
async function receive(f:Fixture,user:{token:string},owner:string){
 const source=await f.request(user.token,'/api/ingress/sources','POST',{id:'same-coding',name:'Generated Coding',kind:'coding-agent',deviceId:'same-device',platform:'macos',retention:'archive'});assert.equal(source.statusCode,200,source.body);
 const event=(id:string,role:string,text:string)=>({externalId:id,revision:'1',observedAt:'2001-01-01T10:00:00Z',kind:'message',layer:'original',text,
  document:{recordedAt:'2001-01-01T10:00:00Z',timeBasis:'recorded',contentRole:'transcript',coding:{version:1,provider:'codex',sessionId:'same-session',projectKey:'same-project',eventId:id,part:0,parts:1,role,...(role==='user'?{attribution:'human'}:role==='assistant'?{attribution:'agent',channel:'final'}:{})}}});
 const items=[event('owner','user',ownerText(owner)),event('tool','tool_result','GENERATED_PRIVATE_TOOL_'+owner),event('assistant','assistant',reportText(owner))],receipt=await f.request(user.token,'/api/ingress/sources/same-coding/items','POST',{batchId:'same-coding-batch',items});assert.equal(receipt.statusCode,200,receipt.body);
 const deadline=Date.now()+15000;for(;;){const page=await f.request(user.token,'/api/materials?kind=mote.coding-session'),material=page.json().items.find((item:any)=>item.memberCount===items.length);if(material){const read=await f.request(user.token,'/api/materials/'+material.id+'/read');assert.ok(read.json().text.includes(ownerText(owner)));assert.ok(!read.json().text.includes('GENERATED_PRIVATE_TOOL'));return material;}
  assert.ok(Date.now()<deadline,'Clean Coding Material did not publish');await delay(10);
 }
}
function script(f:Fixture,owner:string,allowDeleted=false){
 f.responses.set(owner,(res,raw,keys,ids)=>{
  assert.ok(!raw.includes('GENERATED_PRIVATE_TOOL_'),'private tool bodies never enter understanding, extraction or review');
  const evidence=f.read(db=>db.prepare('SELECT id,json FROM mm_evidence').all()).filter(row=>ids.includes(String(row.id))).map(row=>({id:String(row.id),record:JSON.parse(String(row.json))})),original=evidence.find(item=>item.record.ocrText.includes(ownerText(owner)))??(allowDeleted?{id:ids[0]}:undefined);assert.ok(original,'Only this owner\'s exact original is supplied');
  const proof=[{id:original.id,quote:ownerText(owner)}],claim={statement:'Generated '+owner+' requests a reviewable preview and defers deployment',actor:'user',status:'decision',basis:'direct_expression',sourceTime:null,uncertainty:'This generated conversation only',evidence:proof},coverage=keys.map(key=>({key,state:'no_candidates',candidateIndexes:[]}));
  if(understood(raw)){const candidate={title:'GENERATED_PRIVATE_CANDIDATE_'+owner,statement:'The generated speaker requires a reviewable preview before deployment. ['+original.id+']',uncertainty:'Only this generated conversation',admission:{layer:'memory',reason:'Generated explicitly scoped work constraint',scope:'Generated preview task',attribution:'user'},evidenceIds:[original.id],evidence:proof},envelope=JSON.parse(raw).messages.flatMap((message:any)=>typeof message.content==='string'?[message.content]:message.content.filter((part:any)=>part.type==='text').map((part:any)=>part.text)).map((text:string)=>{try{return JSON.parse(text);}catch{return undefined;}}).find((value:any)=>value?.untrustedTaskContext?.memoryWork),ownerKey=envelope?.untrustedTaskContext.memoryWork.members.find((member:any)=>member.id===original.id)?.key??(allowDeleted?keys[0]:undefined);assert.ok(ownerKey,'Generated response uses the exact owner target key');writeMessagesResponse(res,{stage:f.requests.length,model:'generated-memory',text:JSON.stringify({answer:JSON.stringify({summary:'Generated '+owner+' preview request; deployment deferred',evidence:proof,workRecords:[{title:'Generated '+owner+' preview',requirements:[claim],constraints:[],decisions:[],results:[],validation:[],openItems:[],artifactRefs:[]}],events:[claim],memoryCandidates:[candidate],actionCues:[],coverage:coverage.map(row=>row.key===ownerKey?{...row,state:'checked',candidateIndexes:[0]}:row)}),citationIds:[original.id]})});return;}
  assert.ok(raw.includes('coding-conversation-understanding'),'Extraction and independent review retain the prepared interpretation');
  writeMessagesResponse(res,{stage:f.requests.length,model:'generated-memory',text:JSON.stringify({answer:JSON.stringify({memories:[],coverage}),citationIds:[]})});
 });
}
async function summaries(f:Fixture,user:{token:string}){const page=await f.request(user.token,'/api/materials?kind=summary');assert.equal(page.statusCode,200,page.body);return page.json().items;}

test('real account-scoped Coding ingest publishes work/events before extraction and independent review and retains them across restart',{timeout:45000},async t=>{
 const f=await scopedMemoryFixture(t),operationId=randomUUID(),cases=[];
 for(const [user,owner]of [[f.a,'A'],[f.b,'B']] as const){await configure(f,user);script(f,owner);const material=await receive(f,user,owner),job=await f.submit(user,[material.id],operationId);await f.wait(user,job.id);cases.push({user,owner,material,job});}
 assert.equal(f.requests.length,6,'Each owner gets understanding, extraction and a distinct review');
 for(const {user,owner,material,job}of cases){const requests=f.requests.filter(item=>item.key.includes('_'+owner+'_'));assert.equal(requests.length,3);assert.ok(understood(requests[0].raw));assert.ok(!understood(requests[1].raw));assert.ok(requests[2].raw.includes('untrustedMemoryDraft'));
  const published=await summaries(f,user);assert.equal(published.length,1);assert.ok(published[0].artifacts.some((artifact:any)=>artifact.key==='work-records'));assert.ok(published[0].artifacts.some((artifact:any)=>artifact.key==='events'));
  const read=await f.request(user.token,'/api/materials/'+published[0].id+'/read');assert.ok(read.json().text.includes('Generated '+owner+' preview'));assert.ok(read.json().text.includes('workRecords'));assert.ok(read.json().text.includes('"events"'));assert.ok(!read.json().text.includes('memoryCandidates'));assert.ok(!read.json().text.includes('GENERATED_PRIVATE_CANDIDATE_'));
  const members=(await f.request(user.token,'/api/materials/'+published[0].id+'/members')).json().items;assert.equal(members[0].ref,material.id+'@'+material.revision);
  const other=owner==='A'?f.b:f.a,foreign=await f.request(other.token,'/api/materials/'+published[0].id);assert.equal(foreign.statusCode,404);
  assert.equal((await f.request(user.token,'/api/memories')).json().items.length,0,'Work/events exist even when no durable Memory is selected');
  const artifacts=f.read(db=>db.prepare("SELECT json FROM mm_batch_artifacts WHERE user_id=? AND job_id=? AND kind LIKE 'coding-understanding:%'").all(user.userId,job.id));assert.ok(artifacts.length);assert.ok(JSON.stringify(artifacts).includes('workRecords'));for(const artifact of artifacts){const products=JSON.parse(String(artifact.json)).products;assert.deepEqual(products.actionCues,[]);assert.equal(products.memoryCandidates.length,1);}
 }
 const before=f.requests.length;await f.restart();for(const {user,job}of cases){await f.wait(user,job.id);assert.equal((await summaries(f,user)).length,1);}assert.equal(f.requests.length,before,'A successful persisted preparation never calls the model again after restart');
});

test('incomplete Coding preparation keeps the same Memory task retryable without publishing semantic products',{timeout:30000},async t=>{
 const f=await scopedMemoryFixture(t);await configure(f,f.a);const material=await receive(f,f.a,'A');
 f.responses.set('A',(res,raw,keys,ids)=>{
  assert.ok(understood(raw),'An incomplete preparation must not reach extraction');
  const evidence=f.read(db=>db.prepare('SELECT id,json FROM mm_evidence').all()).filter(row=>ids.includes(String(row.id))).find(row=>JSON.parse(String(row.json)).ocrText.includes(ownerText('A')));assert.ok(evidence);
  writeMessagesResponse(res,{stage:f.requests.length,text:JSON.stringify({answer:JSON.stringify({summary:'Generated unassessed conversation',evidence:[{id:evidence.id,quote:ownerText('A')}],workRecords:[],events:[],memoryCandidates:[],actionCues:[],coverage:keys.map(key=>({key,state:'incomplete',candidateIndexes:[],reason:'Generated fixture intentionally leaves the supplied target unassessed'}))}),citationIds:[evidence.id]})});
 });
 const created=await f.submit(f.a,[material.id]),extract=Object.values(created.tasks).find((task:any)=>task.kind==='memory.extract') as any;assert.ok(extract);assert.equal(await f.terminal(extract.id),'failed');
 assert.equal((await summaries(f,f.a)).length,0);assert.equal(f.read(db=>db.prepare("SELECT count(*) n FROM mm_batch_artifacts WHERE user_id=? AND job_id=? AND kind LIKE 'coding-understanding:%'").get(f.a.userId,created.id))!.n,0);
 const attempts=f.requests.length;script(f,'A');const retry=await f.request(f.a.token,'/api/memory/jobs/'+created.id+'/retry','POST',{});assert.equal(retry.statusCode,200,retry.body);const completed=await f.wait(f.a,created.id);assert.equal(completed.id,created.id);assert.equal(completed.tasks.extract.id,extract.id);assert.equal(f.requests.length,attempts+3,'Only the unfinished preparation plus original extraction/review run after explicit retry');assert.equal((await summaries(f,f.a)).length,1);
});

for(const change of ['cancel','delete','disable'] as const)test('a late Coding understanding cannot publish after '+change,{timeout:30000},async t=>{
 const f=await scopedMemoryFixture(t);await configure(f,f.a);script(f,'A',true);const material=await receive(f,f.a,'A');
 let enter!:()=>void,release!:()=>void;const entered=new Promise<void>(resolve=>enter=resolve),released=new Promise<void>(resolve=>release=resolve);f.gates.set('A',{entered:{promise:entered,resolve:enter},release:{promise:released,resolve:release}});t.after(()=>release());
 const job=await f.submit(f.a,[material.id]);await entered;
 const changed=change==='disable'?await f.request(f.admin.token,'/api/admin/accounts/'+f.a.userId,'PATCH',{disabled:true}):change==='cancel'?await f.request(f.a.token,'/api/memory/jobs/'+job.id+'/cancel','POST',{}):await f.request(f.a.token,'/api/materials/'+material.id,'DELETE');assert.equal(changed.statusCode,200,changed.body);release();
 const task=Object.values(job.tasks).find((task:any)=>task.kind==='memory.extract') as any;assert.ok(task);await f.terminal(task.id);
 if(change==='disable'){assert.equal((await f.request(f.a.token,'/api/memories')).statusCode,401);assert.equal(f.read(db=>db.prepare("SELECT count(*) n FROM pd_materials m JOIN pd_material_versions v ON v.user_id=m.user_id AND v.material_id=m.id AND v.revision=m.revision WHERE m.user_id=? AND json_extract(v.json,'$.kind')='summary'").get(f.a.userId))!.n,0);assert.equal(f.read(db=>db.prepare('SELECT count(*) n FROM mm_records WHERE user_id=?').get(f.a.userId))!.n,0);}else{assert.equal((await summaries(f,f.a)).length,0);assert.equal((await f.request(f.a.token,'/api/memories')).json().items.length,0);}assert.equal(f.requests.length,1,'Invalidated understanding cannot start extraction or independent review');
});
