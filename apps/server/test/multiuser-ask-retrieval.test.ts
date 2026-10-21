import test,{type TestContext} from 'node:test';
import assert from 'node:assert/strict';
import {createServer,type ServerResponse} from 'node:http';
import {DatabaseSync} from 'node:sqlite';
import {join} from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {fixture,item,deferred} from './fixtures/ask-reader-host.js';
import {waitForState} from './fixtures/scoped-query-accounts.js';
import {defaultModelSettings} from '../src/model-settings.js';
import {defaultProcessingSettings} from '../src/scope/processing-schema.js';
import {writeMessagesResponse} from '../../../scripts/fixtures/messages-provider.js';
import {materialId} from '../src/materials.js';
import {noteCapture} from '@mote/shared';

const question='Generated synonym probe: business travel expenses';
const travel=(owner:string)=>'Generated '+owner+' private original: rail journey and hotel reimbursement.';
const cooking=(owner:string)=>'Generated '+owner+' private original: potatoes and carrots recipe.';
async function archive(t:TestContext){
 const requests:{owner:string;input:string;url:string}[]=[],bodies:string[]=[],scripts=new Map<string,(input:string,res:ServerResponse)=>Promise<void>|void>();
 const provider=createServer((req,res)=>{void(async()=>{let raw='';for await(const part of req)raw+=part;const body=JSON.parse(raw),owner=String(req.headers.authorization??req.headers['x-api-key']).includes('_A_')?'A':'B';
  if(req.url?.endsWith('/embeddings')){const input=String(body.input);requests.push({owner,input,url:req.url});const script=scripts.get(owner);if(script){await script(input,res);return;}const vector=input===question?[1,0]:input.includes('rail journey')?[1,0]:[0,1];res.setHeader('content-type','application/json');res.end(JSON.stringify({data:[{embedding:vector}],usage:{prompt_tokens:7,total_tokens:7}}));return;}
  bodies.push(raw);const uses=body.messages.flatMap((message:any)=>Array.isArray(message.content)?message.content.filter((part:any)=>part.type==='tool_use'):[]),stage=uses.length+1;
  if(!uses.some((use:any)=>use.name==='search_context'))return writeMessagesResponse(res,{stage,tool:{name:'search_context',args:{query:question,limit:2}}});
  const results=body.messages.flatMap((message:any)=>Array.isArray(message.content)?message.content.filter((part:any)=>part.type==='tool_result'):[]),text=results.flatMap((part:any)=>typeof part.content==='string'?[part.content]:Array.isArray(part.content)?part.content.map((block:any)=>block.text??''):[]).join('\n'),id=text.match(/"id"\s*:\s*"([a-f0-9-]{36})"/)?.[1]??text.match(/capture:([a-f0-9-]{36})/)?.[1];writeMessagesResponse(res,{stage,text:JSON.stringify({answer:'Generated retrieved travel evidence'+(id?' ['+id+']':''),citationIds:id?[id]:[]})});
 })().catch(()=>res.destroy());});
 await new Promise<void>(resolve=>provider.listen(0,'127.0.0.1',resolve));t.after(async()=>{provider.closeAllConnections();await new Promise<void>(resolve=>provider.close(()=>resolve()));});
 const f=await fixture(t),url='http://127.0.0.1:'+(provider.address() as {port:number}).port+'/v1';
 const replace=async(token:string,domain:string,value:unknown)=>{const current=await f.ok(token,'/api/configuration');return f.ok(token,'/api/configuration/'+domain,'PUT',{revision:current.revision,value});};
 const configure=async(user:any,owner:string,embedding=true)=>{await replace(user.token,'models',{profiles:[{id:'same-model',name:'Generated provider',settings:{...defaultModelSettings(),provider:'custom',protocol:'anthropic-messages',baseUrl:url,model:'generated-chat',apiKey:'GENERATED_'+owner+'_KEY'}},{id:'same-embedding',name:'Generated embedding',settings:{...defaultModelSettings(),provider:'custom',protocol:'openai-completions',baseUrl:url,model:'generated-embedding',apiKey:'GENERATED_'+owner+'_EMBEDDING'}}],selections:{chat:{kind:'personal',id:'same-model'},...(embedding?{embedding:{kind:'personal',id:'same-embedding'}}:{})}});await replace(user.token,'processing',{...defaultProcessingSettings(),automatic:false,understandingEnabled:false});};
 for(const [user,owner]of [[f.a,'A'],[f.b,'B']]as const)await configure(user,owner);
 const read=<T>(work:(db:DatabaseSync)=>T)=>{const db=new DatabaseSync(join(f.root,'mote.sqlite'));try{return work(db);}finally{db.close();}};
 const indexed=async(user:any,minimum:number)=>waitForState(async()=>read(db=>Number(db.prepare('SELECT count(*) n FROM ma_embeddings v JOIN mm_evidence e ON e.user_id=v.user_id AND e.id=v.evidence_id JOIN pd_materials h ON h.user_id=e.user_id AND h.id=e.material_id AND h.revision=e.material_revision WHERE v.user_id=?').get(user.userId)!.n)),value=>value>=minimum,'generated embeddings produced');
 const publish=async(user:any,owner:string,externalId:string,text:string,at:string,sourceId='same-source')=>{
  const receipt=await f.ok(user.token,'/api/ingress/sources/'+sourceId+'/items','POST',{batchId:'batch-'+externalId,items:[{...item(text,externalId),kind:'file',layer:'original',observedAt:at}]}),context=await f.node.authority.authenticate(user.token);
  return f.node.ingress.bindSource(context,[sourceId],()=>{}).publishMaterial({id:materialId(sourceId,externalId),kind:'document',schemaVersion:1,title:'Generated '+owner+' '+externalId,origin:{sourceId,externalId,deviceId:'same-device',firstAt:at,lastAt:at},blocks:[{id:'body',kind:'text',format:'plain',text,memberIds:['original']}],members:[{id:'original',kind:'capture',ref:'capture:'+receipt.captures[0].id}],coverage:{state:'complete'},fidelity:{state:'lossless'},retention:{original:'retained',policy:'keep'}});
 };
 return {...f,get node(){return f.node;},requests,bodies,scripts,read,indexed,publish,configure};
}

test('production intake generates owned vectors; Context and actual Ask recall nonliteral originals in relevance order across restart',async t=>{
 const f=await archive(t);
 const a=await f.publish(f.a,'A','older-travel',travel('A'),'2026-10-10T00:00:00Z');await f.publish(f.a,'A','newer-cooking',cooking('A'),'2026-10-16T00:00:00Z');
 const b=await f.publish(f.b,'B','older-travel',travel('B'),'2026-10-10T00:00:00Z');await f.publish(f.b,'B','newer-cooking',cooking('B'),'2026-10-16T00:00:00Z');assert.equal(a.id,b.id);
 await Promise.all([f.indexed(f.a,2),f.indexed(f.b,2)]);
 assert.ok(f.requests.some(request=>request.owner==='A'&&request.input.includes(travel('A'))));assert.ok(f.requests.some(request=>request.owner==='B'&&request.input.includes(travel('B'))));
 assert.ok(f.requests.every(request=>!request.input.includes(travel(request.owner==='A'?'B':'A'))));
 const retrieve=async(user:any)=>f.ok(user.token,'/api/context/retrieve?'+new URLSearchParams({query:question,limit:'2',maxCharacters:'16000'}));
 const literal=await f.ok(f.a.token,'/api/context/search?'+new URLSearchParams({query:question}));assert.deepEqual(literal.items,[]);
 for(const [user,owner]of [[f.a,'A'],[f.b,'B']]as const){const page=await retrieve(user);assert.equal(page.retrieval.mode,'hybrid');assert.equal(page.retrieval.degraded,false);assert.match(page.items[0].snippet,/rail journey/);assert.match(page.items[1].snippet,/potatoes/);assert.ok(page.items[0].origin.capturedAt<page.items[1].origin.capturedAt);assert.doesNotMatch(JSON.stringify(page),new RegExp('Generated '+(owner==='A'?'B':'A')+' private'));}
 assert.ok(f.requests.some(request=>request.owner==='A'&&request.input===question));assert.ok(f.requests.some(request=>request.owner==='B'&&request.input===question));const queryCount=f.requests.filter(request=>request.input===question).length;await retrieve(f.a);assert.equal(f.requests.filter(request=>request.input===question).length,queryCount,'same owned model/query keeps the established short query-vector cache');
 const before=f.requests.filter(request=>request.input!==question).length;await f.restart();const page=await retrieve(f.a);assert.equal(page.retrieval.mode,'hybrid');assert.match(page.items[0].snippet,/rail journey/);assert.equal(f.requests.filter(request=>request.input!==question).length,before,'restart must not backfill paid vectors');
 const id=randomUUID();await f.ok(f.a.token,'/api/query-runs','POST',{id,input:{question:'Generated travel question'}});const result=await waitForState(()=>f.ok(f.a.token,'/api/query-runs/'+id),value=>value.status!=='running','real Ask completion');assert.equal(result.status,'completed',JSON.stringify(result));assert.ok(f.bodies.some(body=>body.includes('hybrid')&&body.includes('rail journey')));assert.ok(f.bodies.every(body=>!body.includes(travel('B'))));
});

test('automatic capture organizers publish real Material originals and semantic indexes through startup/intake hooks',async t=>{
 const f=await archive(t),captureId=randomUUID(),entered=deferred(),release=deferred();t.after(()=>release.resolve());
 // Hold B's distinct canonical metadata embedding, after its text vector can
 // already satisfy the old first-vector readiness check.
 f.scripts.set('B',async(input,res)=>{if(input.includes('"captureId"')){entered.resolve();await release.promise;}res.setHeader('content-type','application/json');res.end(JSON.stringify({data:[{embedding:input===question||input.includes('rail journey')?[1,0]:[0,1]}],usage:{prompt_tokens:7,total_tokens:7}}));});
 const producers=()=>f.read(db=>({
  tasks:db.prepare("SELECT e.id,e.user_id,e.kind,e.state,e.attempts,u.input,u.model_receipt,u.grant_id,a.authorization_epoch,a.revoked FROM execution_steps e JOIN user_tasks u ON u.task_id=e.id JOIN task_authorizations a ON a.task_id=e.id WHERE e.kind IN ('memory.materials','ask.index-admit','ask.embedding') ORDER BY e.id").all(),
  evidence:db.prepare('SELECT e.user_id,e.id,e.hash FROM mm_evidence e JOIN pd_materials h ON h.user_id=e.user_id AND h.id=e.material_id AND h.revision=e.material_revision ORDER BY e.user_id,e.id').all(),
  vectors:db.prepare('SELECT * FROM ma_embeddings ORDER BY user_id,evidence_id,model_key').all(),
  events:db.prepare('SELECT * FROM ma_embedding_events ORDER BY user_id,id').all(),
 }));
 for(const [user,owner]of [[f.a,'A'],[f.b,'B']]as const){
  const current=await f.ok(user.token,'/api/configuration');await f.ok(user.token,'/api/configuration/processing','PUT',{revision:current.revision,value:{...defaultProcessingSettings(),automatic:true,understandingEnabled:false}});
  await f.ok(user.token,'/api/ingress/sources/same-source/captures','POST',{batchId:'generated-real-capture',items:[noteCapture({id:captureId,deviceId:'same-device',deviceName:'Generated device',platform:'import',capturedAt:'2026-10-16T12:00:00Z',text:travel(owner)})]});
  await waitForState(async()=>f.read(db=>Number(db.prepare('SELECT count(*) n FROM ma_embeddings v JOIN mm_evidence e ON e.user_id=v.user_id AND e.id=v.evidence_id JOIN pd_materials h ON h.user_id=e.user_id AND h.id=e.material_id AND h.revision=e.material_revision WHERE v.user_id=?').get(user.userId)!.n)),count=>count>0,'real capture organizer publication produced a current canonical semantic vector');
 }
 await entered.promise;const partial=producers(),inflight=partial.tasks.find(task=>task.user_id===f.b.userId&&task.kind==='ask.embedding'&&task.state==='running');assert.ok(inflight,'the first current vector does not establish completion of every admitted embedding');
 const pendingInput=JSON.parse(String(inflight.input));assert.ok(!partial.vectors.some(vector=>vector.user_id===f.b.userId&&vector.evidence_id===pendingInput.id));
 const oldRequests=f.requests.map(request=>({...request}));await f.restart();release.resolve();await f.ok(f.a.token,'/api/auth/self');
 await waitForState(async()=>producers(),state=>state.tasks.every(task=>task.state==='succeeded')&&state.vectors.length===state.evidence.length,'all actual organizer, admission and embedding tasks completed');
 const completed=producers();assert.deepEqual(completed.tasks.map(task=>task.id),partial.tasks.map(task=>task.id),'restart resumes existing producer tasks without admitting historical work');assert.deepEqual(completed.events,partial.events);
 const resumed=completed.tasks.find(task=>task.id===inflight.id)!;for(const key of ['user_id','input','grant_id','authorization_epoch','revoked'])assert.equal(resumed[key],inflight[key],'unfinished producer retains '+key);
 const oldModel=JSON.parse(String(inflight.model_receipt)),currentModel=JSON.parse(String(resumed.model_receipt));assert.notEqual(currentModel.attemptId,oldModel.attemptId);assert.deepEqual({...currentModel,attemptId:oldModel.attemptId},oldModel,'only the interrupted logical-attempt lineage changes');
 f.read(db=>{const old=db.prepare('SELECT receipt FROM task_model_attempts WHERE task_id=? AND attempt_id=?').get(inflight.id,oldModel.attemptId),current=db.prepare('SELECT receipt,parent_snapshot_id FROM task_model_attempts WHERE task_id=? AND attempt_id=?').get(inflight.id,currentModel.attemptId);assert.ok(old&&current);assert.deepEqual(JSON.parse(String(old.receipt)),oldModel);assert.deepEqual(JSON.parse(String(current.receipt)),currentModel);assert.equal(current.parent_snapshot_id,oldModel.snapshotId);});
 for(const task of partial.tasks.filter(task=>task.state==='succeeded'))assert.deepEqual(completed.tasks.find(current=>current.id===task.id),task,'a completed producer is never reexecuted');
 const repeated=oldRequests.find(request=>request.owner==='B'&&request.input.includes('"captureId"'))!;assert.ok(repeated);assert.deepEqual(f.requests.slice(oldRequests.length),[repeated],'only the interrupted exact metadata input is reissued on the original model');
 for(const task of completed.tasks.filter(task=>task.kind==='ask.embedding')){const input=JSON.parse(String(task.input)),vector=completed.vectors.find(value=>value.user_id===task.user_id&&value.evidence_id===input.id),evidence=completed.evidence.find(value=>value.user_id===task.user_id&&value.id===input.id),model=JSON.parse(String(task.model_receipt));assert.ok(vector&&evidence);assert.deepEqual([vector.fingerprint,vector.receipt,vector.anchor_hash],[input.fingerprint,input.receipt,evidence.hash]);assert.equal(model.userId,task.user_id);assert.equal(model.model,'generated-embedding');}
 t.diagnostic(JSON.stringify({phase:'producer-recovery',interruptedTask:inflight.id,input:pendingInput,modelReceipt:JSON.parse(String(inflight.model_receipt)),completedTasks:completed.tasks.map(task=>({id:task.id,kind:task.kind,state:task.state,attempts:task.attempts})),vectorReceipts:completed.vectors.map(vector=>({userId:vector.user_id,id:vector.evidence_id,receipt:vector.receipt}))}));
 const queriesBefore=f.requests.filter(request=>request.input!==question).length;await f.restart();
 for(const [user,owner]of [[f.a,'A'],[f.b,'B']]as const){const page=await f.ok(user.token,'/api/context/retrieve?'+new URLSearchParams({query:question,maxCharacters:'16000'}));assert.equal(page.retrieval.mode,'hybrid');assert.match(page.items[0].ref,/^material:/);assert.ok(page.items[0].snippet.includes(travel(owner)),JSON.stringify(page));assert.ok(!JSON.stringify(page).includes(travel(owner==='A'?'B':'A')));}
 assert.equal(f.requests.filter(request=>request.input!==question).length,queriesBefore,'startup must reuse completed producer output');assert.deepEqual(producers(),completed,'completed task identities, fixed model receipts, grants and vectors survive startup unchanged');
 const id=randomUUID();await f.ok(f.a.token,'/api/query-runs','POST',{id,input:{question:'Generated real intake travel question'}});const result=await waitForState(()=>f.ok(f.a.token,'/api/query-runs/'+id),value=>value.status!=='running','real Ask uses processed semantic evidence');assert.equal(result.status,'completed',JSON.stringify(result));assert.ok(result.result.citations.some((citation:any)=>citation.excerpt.includes('rail journey')),JSON.stringify(result));assert.ok(f.bodies.some(body=>body.includes('hybrid')&&body.includes(travel('A'))));
});

test('automatic M06 processing publishes and indexes HTTP file originals without manually assembled Materials',async t=>{
 const f=await archive(t),current=await f.ok(f.a.token,'/api/configuration');await f.ok(f.a.token,'/api/configuration/processing','PUT',{revision:current.revision,value:{...defaultProcessingSettings(),automatic:true,understandingEnabled:false}});
 const bytes=Buffer.from(travel('A')),checksum=createHash('sha256').update(bytes).digest('hex'),upload=await f.ok(f.a.token,'/api/ingress/sources/same-source/uploads','POST',{batchId:'generated-automatic-file',revision:{sourceId:'same-source',previousRevision:null,item:{...item('','automatic-file'),kind:'file',layer:'original',mimeType:'text/plain'},sizeBytes:bytes.length,sha256:checksum,relativePath:'generated.txt'}});await f.ok(f.a.token,'/api/ingress/uploads/'+upload.id+'/parts/0','PUT',{bytes:bytes.toString('base64'),checksum});await f.ok(f.a.token,'/api/ingress/uploads/'+upload.id+'/commit','POST',{});
 await waitForState(async()=>f.read(db=>({vectors:Number(db.prepare('SELECT count(*) n FROM ma_embeddings v JOIN mm_evidence e ON e.user_id=v.user_id AND e.id=v.evidence_id JOIN mp_publications p ON p.user_id=e.user_id AND p.material_id=e.material_id AND p.revision=e.material_revision WHERE v.user_id=?').get(f.a.userId)!.n),tasks:db.prepare('SELECT kind,state,error FROM execution_steps WHERE user_id=?').all(f.a.userId)})),value=>value.vectors>0,'real processing publication produced a current canonical semantic vector');
 const page=await f.ok(f.a.token,'/api/context/retrieve?'+new URLSearchParams({query:question,maxCharacters:'16000'}));assert.equal(page.retrieval.mode,'hybrid');assert.ok(page.items[0].snippet.includes(travel('A')));assert.match(page.items[0].ref,/^material:/);
 const id=randomUUID();await f.ok(f.a.token,'/api/query-runs','POST',{id,input:{question:'Generated M06 travel question'}});const result=await waitForState(()=>f.ok(f.a.token,'/api/query-runs/'+id),value=>value.status!=='running','real Ask uses M06 semantic evidence');assert.equal(result.status,'completed',JSON.stringify(result));assert.ok(result.result.citations.some((citation:any)=>citation.excerpt.includes('rail journey')),JSON.stringify(result));
});

test('query provider failures preserve lexical candidates and explicit degradation including empty results',async t=>{
 const f=await archive(t);await f.publish(f.a,'A','travel',travel('A'),'2026-10-10T00:00:00Z');await f.indexed(f.a,1);
 f.scripts.set('A',(_input,res)=>{res.writeHead(503,{'content-type':'application/json'});res.end('{}');});
 for(const query of ['reimbursement','NoLiteralGeneratedMatch']){const page=await f.ok(f.a.token,'/api/context/retrieve?'+new URLSearchParams({query,maxCharacters:'16000'}));assert.equal(page.retrieval.mode,'lexical');assert.equal(page.retrieval.degraded,true);assert.equal(page.retrieval.reason,'embedding_unavailable');assert.equal(page.items.length,query==='reimbursement'?1:0);}
});

test('selected source revocation while a query embedding awaits cannot disclose stale vectors; other owner remains readable',async t=>{
 const f=await archive(t);for(const [user,owner]of [[f.a,'A'],[f.b,'B']]as const){await f.publish(user,owner,'travel',travel(owner),'2026-10-10T00:00:00Z');await f.indexed(user,1);}
 const entered=deferred(),gate=deferred();t.after(()=>gate.resolve());f.scripts.set('A',async(input,res)=>{assert.equal(input,question);entered.resolve();await gate.promise;res.setHeader('content-type','application/json');res.end(JSON.stringify({data:[{embedding:[1,0]}]}));});
 const pending=f.request(f.a.token,'/api/context/retrieve?'+new URLSearchParams({query:question,maxCharacters:'16000'}));await entered.promise;await f.ok(f.a.token,'/api/sources/same-source','PATCH',{enabled:false});gate.resolve();const page=await pending;if(page.statusCode===200)assert.deepEqual(page.json().items,[]);else assert.ok([404,409].includes(page.statusCode),page.body);
 const b=await f.ok(f.b.token,'/api/context/retrieve?'+new URLSearchParams({query:question,maxCharacters:'16000'}));assert.equal(b.retrieval.mode,'hybrid');assert.match(b.items[0].snippet,/Generated B private/);
});

test('enabling optional embeddings does not silently index retained historical originals',async t=>{
 const f=await archive(t);await f.configure(f.a,'A',false);await f.publish(f.a,'A','historical',travel('A'),'2026-10-10T00:00:00Z');
 await waitForState(async()=>f.node.execution!.forUser(await f.node.authority.authenticate(f.a.token)).list({limit:100}).items.filter(task=>task.kind==='ask.index-admit').map(task=>task.state),states=>states.length>0&&states.every(state=>state==='succeeded'),'unconfigured index admission');
 assert.equal(f.read(db=>Number(db.prepare('SELECT count(*) n FROM ma_embeddings WHERE user_id=?').get(f.a.userId)!.n)),0);await f.configure(f.a,'A');const before=f.requests.length;const page=await f.ok(f.a.token,'/api/context/retrieve?'+new URLSearchParams({query:question,maxCharacters:'16000'}));assert.deepEqual(page.items,[]);assert.equal(page.retrieval.mode,'hybrid');assert.equal(f.requests.slice(before).filter(request=>request.input!==question).length,0);
});

test('cancelling actual Ask during semantic recall rejects the late query vector and answer',async t=>{
 const f=await archive(t);for(const [user,owner]of [[f.a,'A'],[f.b,'B']]as const){await f.publish(user,owner,'travel',travel(owner),'2026-10-10T00:00:00Z');await f.indexed(user,1);}
 const entered=deferred(),gate=deferred();t.after(()=>gate.resolve());f.scripts.set('A',async(input,res)=>{assert.equal(input,question);entered.resolve();await gate.promise;res.setHeader('content-type','application/json');res.end(JSON.stringify({data:[{embedding:[1,0]}]}));});
 const id=randomUUID();await f.ok(f.a.token,'/api/query-runs','POST',{id,input:{question:'Generated cancelled travel question'}});await entered.promise;await f.ok(f.a.token,'/api/query-runs/'+id+'/cancel','POST',{});gate.resolve();
 await waitForState(async()=>f.node.execution!.forUser(await f.node.authority.authenticate(f.a.token)).list({limit:100}).items.filter(task=>task.kind==='ask.embedding-query').map(task=>task.state),states=>states.length>0&&states.every(state=>!['waiting','running'].includes(state)),'cancelled query retired');
 assert.equal(f.read(db=>Number(db.prepare('SELECT count(*) n FROM ma_turns WHERE user_id=?').get(f.a.userId)!.n)),0);assert.ok(f.bodies.every(body=>!body.includes(travel('A'))),'late recall must not enter another model request');
 const control=await f.ok(f.b.token,'/api/context/retrieve?'+new URLSearchParams({query:question,maxCharacters:'16000'}));assert.equal(control.retrieval.mode,'hybrid');assert.match(control.items[0].snippet,/Generated B private/);
});

test('source revocation while production indexing awaits prevents a late vector from being stored',async t=>{
 const f=await archive(t),entered=deferred(),gate=deferred();t.after(()=>gate.resolve());f.scripts.set('A',async(_input,res)=>{entered.resolve();await gate.promise;res.setHeader('content-type','application/json');res.end(JSON.stringify({data:[{embedding:[1,0]}]}));});
 await f.publish(f.a,'A','travel',travel('A'),'2026-10-10T00:00:00Z');await entered.promise;await f.ok(f.a.token,'/api/sources/same-source','PATCH',{enabled:false});gate.resolve();
 await waitForState(async()=>f.node.execution!.forUser(await f.node.authority.authenticate(f.a.token)).list({limit:100}).items.filter(task=>task.kind==='ask.embedding'||task.kind==='ask.index-admit').map(task=>task.state),states=>states.length>0&&states.every(state=>!['waiting','running'].includes(state)),'withdrawn index work retired');
 assert.equal(f.read(db=>Number(db.prepare('SELECT count(*) n FROM ma_embeddings WHERE user_id=?').get(f.a.userId)!.n)),0);
});

test('a narrow source capability excludes stronger foreign-scope vectors before Top-K',async t=>{
 const f=await archive(t);await f.publish(f.a,'A','visible-cooking',cooking('A'),'2026-10-16T00:00:00Z');await f.publish(f.a,'A','hidden-travel',travel('A'),'2026-10-10T00:00:00Z','other-source');await f.indexed(f.a,2);
 const context=await f.node.authority.authenticate(f.a.token),reader=f.node.ask!.bind(context,{sourceIds:['same-source'],assertCurrent:()=>f.node.authority.assert(context)}).reader(),page=await reader.retrieve({query:question,limit:1,maxCharacters:16000});assert.equal(page.retrieval.mode,'hybrid');assert.equal((page.retrieval.vectorCoverage as {captures:{scanned:number}}).captures.scanned,1);assert.match(page.items[0].snippet,/potatoes/);assert.ok(!JSON.stringify(page).includes('rail journey'));
});
