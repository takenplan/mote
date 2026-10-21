import test from 'node:test';
import assert from 'node:assert/strict';
import {writeFileSync,readFileSync,mkdirSync,realpathSync,existsSync} from 'node:fs';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {defaultModelSettings} from '../src/model-settings.js';
import {scopedMemoryFixture} from './fixtures/scoped-memory-host.js';
import {scopedFilesFixture} from './fixtures/scoped-files.js';
import {waitForScopedState} from './fixtures/scoped-process.js';

const stages=['memory','summary','review','import','turns'] as const;
function generatedCodex(directory:string,failSecondSummary=false){
 const home=join(directory,'generated-consumers-codex-home'),executable=join(directory,'generated-consumers-codex.cjs'),log=join(directory,'generated-consumers-codex.jsonl');
 const release=join(directory,'generated-summary-failure-release');
 mkdirSync(home,{mode:0o700});writeFileSync(join(home,'auth.json'),JSON.stringify({OPENAI_API_KEY:'GENERATED_CONSUMERS_UNUSED_LOGIN'}),{mode:0o600});
 // The model IDs below script explicit fixture outputs. All configuration,
 // source intake, domain admission, independent review, publication and meters
 // remain the actual production implementation.
 writeFileSync(executable,'#!'+process.execPath+'\n'+String.raw`
const fs=require('node:fs'),readline=require('node:readline');
const log=${JSON.stringify(log)},send=value=>process.stdout.write(JSON.stringify(value)+'\n'),threadId='generated-thread-'+process.pid;
let model,serviceTier;
const record=value=>fs.appendFileSync(log,JSON.stringify({executable:process.argv[1],home:process.env.CODEX_HOME,auth:fs.realpathSync(process.env.CODEX_HOME+'/auth.json'),...value})+'\n');
readline.createInterface({input:process.stdin}).on('line',line=>{
 const m=JSON.parse(line);record({method:m.method,model});
 if(m.method==='initialize')send({id:m.id,result:{}});
 else if(m.method==='account/read')send({id:m.id,result:{account:{type:'apiKey'}}});
 else if(m.method==='thread/start'){
  model=m.params.model;serviceTier=m.params.serviceTier;send({id:m.id,result:{thread:{id:threadId,model},model,serviceTier:m.params.serviceTier,approvalPolicy:'never',sandbox:{type:'readOnly'}}});
 }else if(m.method==='turn/start'){
  const envelope=JSON.parse(m.params.input[0].text),evidence=envelope.untrustedEvidence??[],id=evidence[0]?.id;
  record({method:'generated.consumer.prompt',model,serviceTier,envelope});
  if(${JSON.stringify(failSecondSummary)}&&model==='generated-native-summary'&&fs.readFileSync(log,'utf8').trim().split('\n').map(line=>JSON.parse(line)).filter(call=>call.method==='generated.consumer.prompt').length===2){const timer=setInterval(()=>{if(fs.existsSync(${JSON.stringify(release)})){clearInterval(timer);send({id:m.id,error:{code:-32000,data:{codexErrorInfo:{responseStreamDisconnected:{}}}}});}},10);return;}
  let answer,citationIds=id?[id]:[];
  if(model==='generated-native-memory'){
   const memories=id?[{title:'Generated native Memory',statement:'Nora prefers generated tea. ['+id+']',uncertainty:'Generated explicitly attributed statement only',admission:{layer:'memory',reason:'Generated explicitly expressed preference',scope:'Nora in generated fixture',attribution:'third_party'},evidenceIds:[id],evidence:[{id,quote:evidence[0].ocrText}]}]:[];
   const members=envelope.untrustedTaskContext?.memoryWork?.members??[];
   answer=JSON.stringify({memories,...(members.length?{coverage:members.map((member,index)=>({key:member.key,state:index===0&&memories.length?'checked':'no_candidates',candidateIndexes:index===0&&memories.length?[0]:[]}))}:{})});
  }else if(model==='generated-native-summary')answer='Generated native file summary ['+id+']';
  else if(model==='generated-native-turns')answer=JSON.stringify({groups:evidence.map((_,index)=>[index])});
  else if(model==='generated-native-review')answer=JSON.stringify({suggestions:[{chunkId:id,original:'GENERATED_FILE_ORIGINAL',replacement:'GENERATED_FILE_REVIEWED',reason:'Generated fixture correction only'}]});
  else if(model==='generated-native-import'){
   const request=JSON.parse(envelope.request);answer=JSON.stringify({summary:'Generated native import preview',warnings:[],reviewDecision:{confidence:'high',ambiguous:false,reason:'Generated exact decoded originals retained.'},preserveAll:true,dispositions:request.originals.map(file=>({fileId:file.id,status:'parsed',reason:'Generated exact decoded original retained.'}))});citationIds=[];
  }else throw Error('Unexpected generated fixture model '+model);
  send({id:m.id,result:{turn:{id:'generated-turn'}}});
  send({method:'thread/tokenUsage/updated',params:{threadId,turnId:'generated-turn',tokenUsage:{total:{inputTokens:100,outputTokens:10,totalTokens:110,cachedInputTokens:0,cacheWriteInputTokens:0,reasoningOutputTokens:0}}}});
  send({method:'item/completed',params:{threadId,item:{id:'generated-answer',type:'agentMessage',text:JSON.stringify({answer,citationIds})}}});
  send({method:'turn/completed',params:{threadId,turn:{status:'completed'}}});
 }
});
`,{mode:0o700});
 return {home,executable,log,release,calls:()=>readFileSync(log,'utf8').trim().split('\n').map(line=>JSON.parse(line))};
}
const nativeSettings=(stage:typeof stages[number])=>({...defaultModelSettings(),provider:'codex',protocol:'codex-app-server' as const,baseUrl:'',model:'generated-native-'+stage,apiKey:'',headers:{},extraBody:{},serviceTier:'default' as const,modelRequestTimeoutMs:null,agentTimeoutMs:null});
type Request=(token:string|undefined,url:string,method?:any,payload?:unknown)=>Promise<{statusCode:number;body:string;json:()=>any}>;
async function nativeConfiguration(request:Request,admin:string,native:ReturnType<typeof generatedCodex>){
 const response=await request(admin,'/api/admin/configuration/models'),view=response.json(),models=view.domains.find((domain:any)=>domain.id==='models').saved;
 models.codex={executable:native.executable,home:native.home};for(const stage of stages)models.profiles.push({id:'generated-native-'+stage,name:'Generated native '+stage,settings:nativeSettings(stage)});
 const saved=await request(admin,'/api/admin/configuration/models','PUT',{revision:view.revision,value:models,preserveRedactedSecrets:true});assert.equal(saved.statusCode,200,saved.body);
}
async function select(request:Request,token:string,feature:string,stage:typeof stages[number]){
 const response=await request(token,'/api/configuration'),view=response.json(),models=view.domains.find((domain:any)=>domain.id==='models').saved;
 models.selections[feature]={kind:'shared',id:'generated-native-'+stage};const saved=await request(token,'/api/configuration/models','PUT',{revision:view.revision,value:models,preserveRedactedSecrets:true});assert.equal(saved.statusCode,200,saved.body);
}
function assertRuntime(native:ReturnType<typeof generatedCodex>){
 const calls=native.calls();assert.ok(calls.some(call=>call.method==='thread/start'));
 assert.ok(calls.every(call=>call.executable===native.executable),'every consumer launches the configured mock executable');
 assert.ok(calls.every(call=>call.auth===realpathSync(join(native.home,'auth.json'))),'every consumer uses an isolated login derived from the configured generated home');
 return calls.filter(call=>call.method==='generated.consumer.prompt');
}

test('actual built-in Memory extraction and independent review use the effective Codex executable/home for both accounts and record native usage',async t=>{
 const f=await scopedMemoryFixture(t),native=generatedCodex(f.directory);await nativeConfiguration(f.request,f.admin.token,native);await f.restart();
 for(const user of [f.a,f.b])await select(f.request,user.token,'memory','memory');
 for(const [user,label]of [[f.a,'A'],[f.b,'B']]as const){const material=await f.publish(user,label),job=await f.submit(user,[material.id]);await f.wait(user,job.id);const memories=await f.request(user.token,'/api/memories');assert.equal(memories.statusCode,200,memories.body);assert.equal(memories.json().items.length,1);assert.equal(memories.json().items[0].title,'Generated native Memory');
  const usage=(await f.request(user.token,'/api/usage')).json();assert.equal(usage.items.length,2);assert.deepEqual(new Set(usage.items.map((item:any)=>item.attribution.agentId)),new Set(['memory.extract','memory.review']));assert.ok(usage.items.every((item:any)=>item.provider==='codex'&&item.model==='generated-native-memory'&&item.status==='completed'&&item.tokens.inputTokens===100));
 }
 const calls=assertRuntime(native);assert.equal(calls.length,4);assert.equal(calls.filter(call=>call.envelope.untrustedTaskContext?.untrustedMemoryDraft).length,2,'review is an independent native request with the retained draft');
 for(const label of ['A','B']){const own=calls.filter(call=>JSON.stringify(call.envelope).includes('GENERATED_MEMORY_'+label));assert.equal(own.length,2);assert.ok(own.every(call=>!JSON.stringify(call.envelope).includes('GENERATED_MEMORY_'+(label==='A'?'B':'A'))));}
 assert.equal(f.requests.length,0,'business work never falls back to the fixture HTTP model');
});

test('actual file summary, terms review and mapped import use the configured Codex runtime through their production API lifecycles',async t=>{
 const f=await scopedFilesFixture(t),native=generatedCodex(f.directory);await nativeConfiguration(f.request,f.admin.token,native);await f.restart();
 const waitTask=async(id:string)=>{let task:any;await waitForScopedState(async()=>{task=await f.checked(f.a.token,'/api/tasks/'+id);if(['failed','blocked','stale','cancelled'].includes(task.state))assert.fail(JSON.stringify(task));return task.state==='succeeded';},()=>JSON.stringify(task),20000);return task;};
 const file=await f.upload(f.a.token,'generated-native-original','GENERATED_FILE_ORIGINAL'),ref=file.original.ref,raw=await f.checked(f.a.token,'/api/processing','POST',{originalRef:ref,operationId:'generated-native-text-extract'});await waitTask(raw.id);
 await select(f.request,f.a.token,'file','summary');const derived=await f.checked(f.a.token,'/api/processing/derivations','POST',{originalRef:ref,operationId:'generated-native-summary',modes:['summary']});await waitTask(derived.id);
 const status=await f.checked(f.a.token,'/api/processing/originals/'+ref.slice(9));assert.equal(status.derivations.length,1);const material=await f.checked(f.a.token,'/api/materials/'+status.derivations[0].materialId+'/read');assert.match(material.text,/Generated native file summary/);
 await select(f.request,f.a.token,'file','review');const review=await f.checked(f.a.token,'/api/files/'+file.id+'/reviews','POST',{operationId:'generated-native-terms',kind:'terms',offset:0});await waitTask(review.taskId);
 const proposal=(await f.checked(f.a.token,'/api/files/'+file.id+'/reviews')).items.find((item:any)=>item.id===review.reviewId);assert.equal(proposal.status,'proposed');assert.equal(proposal.suggestions.length,1);await f.checked(f.a.token,'/api/files/'+file.id+'/reviews/'+review.reviewId,'POST',{action:'accept',selected:[proposal.suggestions[0].id]});assert.equal((await f.checked(f.a.token,'/api/files/'+file.id+'/chunks')).items[0].ocrText,'GENERATED_FILE_REVIEWED');
 await select(f.request,f.a.token,'import','import');const bytes=Buffer.from('GENERATED_NATIVE_IMPORT_ORIGINAL'),upload=randomUUID();await f.checked(f.a.token,'/api/import-uploads','POST',{id:upload,name:'generated-native-import.txt',sizeBytes:bytes.length,mimeType:'text/plain'});assert.equal((await f.request(f.a.token,'/api/import-uploads/'+upload+'/parts/0','PUT',bytes,{'content-type':'application/octet-stream'})).statusCode,200);const archived=await f.checked(f.a.token,'/api/import-uploads/'+upload+'/commit','POST',{});
 const created=await f.request(f.a.token,'/api/imports','POST',{requestId:randomUUID(),archivedFileIds:[archived.id],processing:'preview',instruction:'Retain the generated exact original.'});assert.equal(created.statusCode,202,created.body);const id=created.json().id;let job:any;
 await waitForScopedState(async()=>{job=await f.checked(f.a.token,'/api/imports/'+id);if(['failed','needs_configuration'].includes(job.status))assert.fail(JSON.stringify(job));return job.status==='awaiting_confirmation';},()=>JSON.stringify(job),20000);assert.equal(job.preview.count,1);assert.equal(job.preview.samples[0].text,bytes.toString());assert.equal(job.progress.imported,0);assert.equal((await f.request(f.b.token,'/api/imports/'+id)).statusCode,404);
 assert.equal((await f.request(f.a.token,'/api/imports/'+id+'/confirm','POST',{})).statusCode,202);await waitForScopedState(async()=>{job=await f.checked(f.a.token,'/api/imports/'+id);return job.status==='completed';},()=>JSON.stringify(job),20000);assert.equal(job.progress.imported,1);
 const calls=assertRuntime(native);assert.deepEqual(calls.map(call=>call.model),['generated-native-summary','generated-native-review','generated-native-import']);assert.ok(JSON.stringify(calls[0].envelope).includes('GENERATED_FILE_ORIGINAL'));assert.ok(JSON.stringify(calls[1].envelope).includes('GENERATED_FILE_ORIGINAL'));assert.ok(JSON.stringify(calls[2].envelope).includes(bytes.toString()));
 const usage=await f.checked(f.a.token,'/api/usage');assert.equal(usage.items.length,3);assert.deepEqual(new Set(usage.items.map((item:any)=>item.model)),new Set(calls.map(call=>call.model)));assert.ok(usage.items.every((item:any)=>item.provider==='codex'&&item.status==='completed'&&item.tokens.inputTokens===100));assert.equal((await f.checked(f.b.token,'/api/usage')).items.length,0);
});


test('actual multi-page summary preserves the accepted Fast chunk and uses ordinary mode only for its bounded retry', {timeout:45000}, async t=>{
 const f=await scopedFilesFixture(t),native=generatedCodex(f.directory,true);t.after(()=>{if(existsSync(f.directory))writeFileSync(native.release,'release');});
 await nativeConfiguration(f.request,f.admin.token,native);await f.restart();
 const tier=async(value:'fast'|'default')=>{const view=await f.checked(f.admin.token,'/api/admin/configuration/models'),models=view.domains.find((d:any)=>d.id==='models').saved;models.profiles.find((p:any)=>p.id==='generated-native-summary').settings.serviceTier=value;await f.checked(f.admin.token,'/api/admin/configuration/models','PUT',{revision:view.revision,value:models,preserveRedactedSecrets:true});};
 await tier('fast');await select(f.request,f.a.token,'file','summary');
 const file=await f.upload(f.a.token,'generated-many-chunks','GENERATED_PARTIAL_CHUNK '.repeat(4200)),ref=file.original.ref;
 const extract=await f.checked(f.a.token,'/api/processing','POST',{originalRef:ref,operationId:'generated-partial-extract'});await waitForScopedState(async()=>(await f.checked(f.a.token,'/api/tasks/'+extract.id)).state==='succeeded',()=> 'generated raw extraction did not settle',20000);
 const chunks=(await f.checked(f.a.token,'/api/files/'+file.id+'/chunks')).items;assert.ok(chunks.length>20,'real extraction must produce multiple summary pages');assert.ok(chunks.length<=40,'fixture intentionally selects exactly two summary pages');
 const read=<T>(work:(db:DatabaseSync)=>T)=>{const db=new DatabaseSync(join(f.directory,'mote.sqlite'));try{return work(db);}finally{db.close();}};
 const derived=await f.checked(f.a.token,'/api/processing/derivations','POST',{originalRef:ref,operationId:'generated-partial-summary',modes:['summary']});
 await waitForScopedState(()=>Promise.resolve(existsSync(native.log)&&native.calls().filter(c=>c.method==='generated.consumer.prompt').length===2),()=> 'second generated summary page was not held',20000);
 const taskId=String(read(db=>db.prepare("SELECT e.id FROM execution_steps e JOIN user_tasks u ON u.task_id=e.id WHERE u.user_id=? AND e.kind='processing.analysis'").get(f.a.userId)!.id));
 const before=read(db=>db.prepare('SELECT id,json FROM mp_artifacts WHERE user_id=? AND original_id=? ORDER BY id').all(f.a.userId,ref.slice(9)));
 const first=before.find(row=>String(row.json).includes('Generated native file summary'));assert.ok(first,'first page must already be durably accepted');
 const old=read(db=>db.prepare('SELECT model_receipt FROM user_tasks WHERE task_id=?').get(taskId)!.model_receipt);assert.equal(read(db=>db.prepare("SELECT count(*) n FROM task_physical_calls WHERE task_id=? AND state='active'").get(taskId)!.n),1);
 await tier('default');writeFileSync(native.release,'release');
 await waitForScopedState(async()=>{const task=await f.checked(f.a.token,'/api/tasks/'+derived.id);if(['failed','blocked','stale','cancelled'].includes(task.state))assert.fail(JSON.stringify(task));return task.state==='succeeded';},()=>JSON.stringify(read(db=>db.prepare('SELECT id,kind,state,attempts,error FROM execution_steps').all())),20000);
 const prompts=assertRuntime(native);assert.equal(prompts.length,3,'first accepted page is not sent again');assert.deepEqual(prompts.map(p=>p.serviceTier),['fast','fast','default']);assert.equal(prompts[2].envelope.untrustedEvidence[0].id,prompts[1].envelope.untrustedEvidence[0].id);assert.notEqual(prompts[2].envelope.untrustedEvidence[0].id,prompts[0].envelope.untrustedEvidence[0].id);
 assert.deepEqual(read(db=>db.prepare('SELECT id,json FROM mp_artifacts WHERE id=? AND user_id=?').get(first.id,f.a.userId)),first);
 const task=await f.checked(f.a.token,'/api/tasks/'+taskId);assert.equal(task.attempts,2);assert.equal(task.externalUnresolved,1);assert.equal(task.externalState,'succeeded');assert.notEqual(read(db=>db.prepare('SELECT model_receipt FROM user_tasks WHERE task_id=?').get(taskId)!.model_receipt),old);
 assert.equal(read(db=>db.prepare('SELECT count(*) n FROM task_external_policy_replays WHERE user_id=?').get(f.a.userId)!.n),1);assert.equal(read(db=>db.prepare("SELECT count(*) n FROM task_physical_calls WHERE task_id=? AND state='active'").get(taskId)!.n),0);
 const status=await f.checked(f.a.token,'/api/processing/originals/'+ref.slice(9));assert.equal(status.derivations.length,1);
 await select(f.request,f.a.token,'file','turns');const sibling=await f.checked(f.a.token,'/api/processing/derivations','POST',{originalRef:ref,operationId:'generated-after-unknown-turns',modes:['turns']});await waitForScopedState(async()=>{const task=await f.checked(f.a.token,'/api/tasks/'+sibling.id);if(['failed','blocked','stale','cancelled'].includes(task.state))assert.fail(JSON.stringify(task));return task.state==='succeeded';},()=> 'a historical policy-authorized unknown must not block a later sibling',20000);assert.equal(assertRuntime(native).length,4);assert.equal(read(db=>db.prepare('SELECT count(*) n FROM task_external_retry_confirmations WHERE user_id=?').get(f.a.userId)!.n),0);
 const policyBefore=read(db=>db.prepare('SELECT * FROM task_external_policy_replays WHERE user_id=? ORDER BY id').all(f.a.userId));
 const explicit=await f.checked(f.a.token,'/api/files/'+file.id+'/retry','POST',{operationId:randomUUID(),stage:'summary',confirmUnknown:false});assert.ok(explicit.taskId);await waitForScopedState(async()=>{const task=await f.checked(f.a.token,'/api/tasks/'+explicit.taskId);if(['failed','blocked','stale','cancelled'].includes(task.state))assert.fail(JSON.stringify(task));return task.state==='succeeded';},()=> 'explicit file replacement did not reuse current accepted summary',20000);
 assert.deepEqual(read(db=>db.prepare('SELECT * FROM task_external_policy_replays WHERE user_id=? ORDER BY id').all(f.a.userId)),policyBefore);assert.equal(read(db=>db.prepare('SELECT count(*) n FROM task_external_retry_confirmations WHERE user_id=?').get(f.a.userId)!.n),0,'a false-confirm replacement must not manufacture owner acknowledgments for historical policy replay');assert.equal((await f.checked(f.b.token,'/api/usage')).items.length,0);
});
