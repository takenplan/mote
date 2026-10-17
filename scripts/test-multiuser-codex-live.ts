/** Explicit generated-data acceptance through the current Wire 2 HTTP host.
 * Uses the existing local Codex login; no personal archive or provider substitute.
 * Run separately from deterministic fixtures and broad parallel test suites. */
import assert from 'node:assert/strict';
import {createHash,randomBytes,randomUUID} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {mkdtemp,mkdir,readFile,readdir,rm,stat,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {dirname,join,relative,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createConnection} from 'node:net';
import {setTimeout as delay} from 'node:timers/promises';
import {buildApp} from '../apps/server/src/app.js';
import {defaultModelDomain,defaultModelSettings} from '../apps/server/src/model-settings.js';
import {defaultProcessingSettings} from '../apps/server/src/scope/processing-schema.js';
import {defaultMemorySettings} from '../apps/server/src/scope/memory-schema.js';
import {DEPLOYMENT_MODEL_PROFILE_ID} from '@mote/shared/models';

assert.equal(process.env.MOTE_MULTIUSER_CODEX_LIVE,'1','Explicit opt-in: MOTE_MULTIUSER_CODEX_LIVE=1');
const repository=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const model=process.env.MOTE_TEST_CODEX_MODEL??'gpt-6.1-sol';
assert.equal(model,'gpt-6.1-sol','This acceptance uses the requested local Codex model without fallback');
const executable=process.env.MOTE_CODEX_BIN??'/opt/homebrew/bin/codex';
const command='MOTE_MULTIUSER_CODEX_LIVE=1 MOTE_CODEX_BIN='+executable+' MOTE_TEST_CODEX_MODEL=gpt-6.1-sol node --import tsx scripts/test-multiuser-codex-live.ts';
const startedAt=new Date().toISOString(),started=Date.now();
const reportPath=resolve(process.env.MOTE_MULTIUSER_CODEX_REPORT??join(tmpdir(),'mote-multiuser-codex-live-'+Date.now()+'.json'));
const outside=relative(repository,reportPath);
assert.ok(outside==='..'||outside.startsWith('../')||outside.startsWith('..\\'),'Live report must stay outside the repository');
const directory=await mkdtemp(join(tmpdir(),'mote-multiuser-codex-vault-'));
const protocol={'x-mote-protocol-version':'2','x-mote-ingress-version':'3'};
const password='Generated-'+randomBytes(18).toString('hex');
const abort=new AbortController(),deadline=setTimeout(()=>abort.abort(Error('bounded_live_deadline')),15*60*1000);
type Host=Awaited<ReturnType<typeof buildApp>>;
type Actor={token:string;userId:string;username:string;label:'A'|'B';phrase:string;time:string};
type Observation={status:number;value:any};
let host:Host|undefined,origin='',stage='preflight',hostsOpened=0,hostsClosed=0;
let lastHttp:{method:string;path:string;status:number;code:string|null}|undefined;
const addresses:string[]=[];
const digest=(value:string|Uint8Array)=>createHash('sha256').update(value).digest('hex');
async function sourceReceipt(){
 const tracked=execFileSync('git',['ls-files','-z','apps/server/src','packages/agent/src','packages/shared/src'],{cwd:repository,encoding:'utf8'}).split('\0').filter(Boolean);
 const compiled:string[]=[];
 for(const folder of ['packages/agent/dist','packages/shared/dist'])for(const name of await readdir(join(repository,folder),{recursive:true})){const path=join(folder,name);if((await stat(join(repository,path))).isFile())compiled.push(path);}
 const files=[...new Set([...tracked,...compiled])].sort();
 const hashes=await Promise.all(files.map(async path=>[path,digest(await readFile(join(repository,path)))]));
 return {files:hashes.length,sha256:digest(JSON.stringify(hashes))};
}
const report:any={status:'running',startedAt,command,head:execFileSync('git',['rev-parse','HEAD'],{cwd:repository,encoding:'utf8'}).trim(),scriptSha256:digest(await readFile(fileURLToPath(import.meta.url))),source:await sourceReceipt(),wireProtocol:2,storageEpoch:5,provider:'codex',protocol:'codex-app-server',requestedModel:model,reasoningEffort:'low',serviceTier:'default',personalDataUsed:false,physicalDevicesTested:false,providerInternalRequestCount:'unobservable',cases:[],models:[],findings:[]};
async function save(){await mkdir(dirname(reportPath),{recursive:true,mode:0o700});await writeFile(reportPath,JSON.stringify(report,null,2)+'\n',{mode:0o600});}
async function passed(name:string,details:Record<string,unknown>={}){report.cases.push({name,status:'passed',...details});console.log(JSON.stringify({stage:name,status:'passed',...details}));await save();}
async function request(token:string|undefined,path:string,method='GET',body?:unknown):Promise<Observation>{
 abort.signal.throwIfAborted();
 const response=await fetch(origin+path,{method,headers:{...protocol,...(token?{authorization:'Bearer '+token}:{}),...(body===undefined?{}:{'content-type':'application/json'})},...(body===undefined?{}:{body:JSON.stringify(body)}),signal:AbortSignal.any([abort.signal,AbortSignal.timeout(15000)])});
 const value=await response.json();lastHttp={method,path,status:response.status,code:typeof value?.error==='string'?value.error:null};return {status:response.status,value};
}
async function checked(token:string|undefined,path:string,method='GET',body?:unknown){const result=await request(token,path,method,body);assert.equal(result.status,200,method+' '+path+' HTTP '+result.status+' '+String(result.value?.error??''));return result.value;}
async function until<T>(read:()=>Promise<T>,done:(value:T)=>boolean,label:string,timeoutMs:number){
 const until=Date.now()+timeoutMs;let nextLog=0;
 for(;;){abort.signal.throwIfAborted();const value=await read();if(done(value))return value;assert.ok(Date.now()<until,label+' timed out');if(Date.now()>=nextLog){console.log(JSON.stringify({stage:'waiting',for:label}));nextLog=Date.now()+30000;}await delay(100,undefined,{signal:abort.signal});}
}
async function start(){host=await buildApp({dataDir:directory});origin=await host.app.listen({host:'127.0.0.1',port:0});hostsOpened++;addresses.push(origin);}
async function close(){const current=host;host=undefined;if(current){await current.app.close();hostsClosed++;}}
async function restart(){await close();await start();}
async function replace(actor:Actor,domain:string,value:unknown){const view=await checked(actor.token,'/api/configuration');return checked(actor.token,'/api/configuration/'+domain,'PUT',{revision:view.revision,value});}
async function upload(actor:Actor,revision:string,text:string){
 const bytes=Buffer.from(text),sha256=digest(bytes);
 const upload=await checked(actor.token,'/api/ingress/sources/same-source/uploads','POST',{batchId:'same-batch-'+revision,revision:{sourceId:'same-source',previousRevision:null,item:{externalId:'same-observatory-note',revision,observedAt:new Date().toISOString(),title:'Generated observatory note',text:'',kind:'file',layer:'original',mimeType:'text/plain'},sizeBytes:bytes.length,sha256,relativePath:'generated-observatory.txt'}});
 await checked(actor.token,'/api/ingress/uploads/'+upload.id+'/parts/0','PUT',{bytes:bytes.toString('base64'),checksum:sha256});
 const receipt=await checked(actor.token,'/api/ingress/uploads/'+upload.id+'/commit','POST',{});
 const original=String(receipt.captures[0].original.ref);
 const processed=await until(()=>checked(actor.token,'/api/processing/originals/'+original.slice(9)),value=>value.indexed===true&&typeof value.materialId==='string','generated text indexing '+actor.label,30000);
 const read=await checked(actor.token,'/api/materials/'+processed.materialId+'/read');
 assert.equal(read.text,text,'The real file pipeline must retain exact generated original text');
 return {original,captureId:String(receipt.captures[0].id),materialId:String(processed.materialId),revision:String(processed.revision)};
}
async function usage(actor:Actor){const value=await checked(actor.token,'/api/usage');return value.items as any[];}
async function safeUsage(actor:Actor){return (await usage(actor)).map(item=>({provider:item.provider,model:item.model,operation:item.operation,status:item.status,durationMs:item.durationMs,tokens:item.tokens??null}));}
async function assertUnreadable(token:string,id:string){const result=await request(token,'/api/agent-view/evidence?'+new URLSearchParams({id}));assert.ok(result.status===404||result.status===200&&result.value.items.length===0,'Foreign original evidence must be unreadable');}
async function listening(address:string){const url=new URL(address);return new Promise<boolean>(resolve=>{const connection=createConnection({host:url.hostname,port:Number(url.port)});let settled=false;const done=(open:boolean)=>{if(settled)return;settled=true;connection.destroy();resolve(open);};connection.once('connect',()=>done(true));connection.once('error',()=>done(false));connection.setTimeout(1000,()=>done(false));});}
const onSignal=()=>abort.abort(Error('live_acceptance_interrupted'));
process.once('SIGINT',onSignal);process.once('SIGTERM',onSignal);
let failure:unknown;
async function finding(error:unknown){failure??=error;const location=(error instanceof Error?error.stack:'')?.match(/test-multiuser-codex-live\.ts:(\d+):(\d+)/)?.slice(1).map(Number);const value={stage,name:error instanceof Error?error.name:'UnknownError',code:abort.signal.aborted?'interrupted_or_deadline':'acceptance_assertion_or_transport',location,lastHttp};report.findings.push(value);console.error(JSON.stringify({...value,status:'failed'}));await save();}
async function scenario(work:()=>Promise<void>){try{await work();}catch(error){await finding(error);if(abort.signal.aborted)throw error;}}
try{
 await start();
 const health=await checked(undefined,'/api/health');
 assert.equal(health.mode,'multiuser-auth');assert.deepEqual(health.protocol,{min:2,max:2});assert.equal(health.storageEpoch,5);
 const accounts=host?.accounts;assert.ok(accounts,'Production host must expose account initialization');await accounts.initialize('generated-admin',password);
 const admin=await checked(undefined,'/api/auth/login','POST',{username:'generated-admin',password,mode:'client'});
 const instance=await checked(admin.token,'/api/admin/configuration/models');
 await checked(admin.token,'/api/admin/configuration/models','PUT',{revision:instance.revision,value:{...defaultModelDomain(),codex:{executable,...(process.env.MOTE_CODEX_HOME?{home:process.env.MOTE_CODEX_HOME}:{})},deployment:{...defaultModelSettings(),provider:'codex',protocol:'codex-app-server',baseUrl:'',model,apiKey:'',reasoningEffort:'low',serviceTier:'default',modelRequestTimeoutMs:null,agentTimeoutMs:300000}}});
 // Operator executable/home changes take effect through the normal restart.
 await restart();
 const actors:Actor[]=[];
 for(const [label,time]of [['A','14:37'],['B','09:23']] as const){
  const username='generated-'+label.toLowerCase();
  await checked(admin.token,'/api/admin/accounts','POST',{username,password});
  const login=await checked(undefined,'/api/auth/login','POST',{username,password,mode:'client'});
  const actor:Actor={...login,username,label,phrase:'GENERATED_'+label+'_'+randomBytes(12).toString('hex'),time};actors.push(actor);
  await replace(actor,'memory',{...defaultMemorySettings(),automatic:false,integration:false,lifecycle:{...defaultMemorySettings().lifecycle,insights:{...defaultMemorySettings().lifecycle.insights,enabled:false},working:{...defaultMemorySettings().lifecycle.working,enabled:false},consolidation:{...defaultMemorySettings().lifecycle.consolidation,enabled:false}}});
  await replace(actor,'processing',{...defaultProcessingSettings(),automatic:true,summarize:false,semanticTurns:false,understandingEnabled:false});
  await replace(actor,'models',{profiles:[],selections:{chat:{kind:'shared',id:DEPLOYMENT_MODEL_PROFILE_ID}}});
  const trace=(await checked(actor.token,'/api/configuration')).domains.find((domain:any)=>domain.id==='agentTrace').effective;
  await replace(actor,'agentTrace',{...trace,traceEnabled:true});
  await checked(actor.token,'/api/ingress/sources','POST',{id:'same-source',name:'Generated observatory source',kind:'local-files',deviceId:'same-device',platform:'import',retention:'archive'});
 }
 const [a,b]=actors as [Actor,Actor];
 const settings=await checked(a.token,'/api/configuration');
 const catalog=await checked(a.token,'/api/models/catalog','POST',{revision:settings.revision,reference:{kind:'shared',id:DEPLOYMENT_MODEL_PROFILE_ID}});
 const selected=catalog.items.find((item:any)=>item.id===model);assert.ok(selected,'Requested model absent from real local Codex directory');assert.ok(selected.reasoningEfforts.includes('low'));
 await passed('current_host_and_local_model_catalog',{availableModels:catalog.items.length,requestedModelAvailable:true});
 stage='indexing';
 const text=(actor:Actor)=>'This is generated acceptance data, not a personal record. The generated observatory opens at '+actor.time+'. Its exact verification phrase is '+actor.phrase+'.';
 const materialA=await upload(a,'v1',text(a)),materialB=await upload(b,'v1',text(b));
 assert.equal((await usage(a)).length,0);assert.equal((await usage(b)).length,0,'Text-only indexing must not call a model');
 await passed('real_http_file_upload_and_background_index',{sameSourceAndExternalId:true,modelCallsDuringIndexing:0});
 const conversationId=randomUUID(),runId=randomUUID(),turnId=randomUUID(),completed=new Map<string,any>();
 for(const [actor,other]of [[a,b],[b,a]] as const){
  stage='model_'+actor.label;
  await scenario(async()=>{
  if(actor===a)assert.equal((await request(b.token,'/api/query-runs/'+runId)).status,404);
  await checked(actor.token,'/api/conversations','POST',{id:conversationId,title:'Generated live observatory question'});
  const begun=Date.now();
  await checked(actor.token,'/api/query-runs','POST',{id:runId,input:{question:'Find my generated observatory note in the archive. Use the available read-only tools to read its original text. State its exact verification phrase and opening time, and cite the original record. Do not infer either value or delegate this short lookup.',conversationId,turnId,language:'en',timeZone:'UTC'}});
  const run=await until(()=>checked(actor.token,'/api/query-runs/'+runId),value=>value.status!=='running','real local Codex answer '+actor.label,330000);
  assert.equal(run.status,'completed','Actual local Codex query did not complete; error '+String(run.error?.code??run.status));
  assert.ok(run.result.answer.includes(actor.phrase),'Answer must contain the unpredictable generated fact retrieved from this owner');
  assert.ok(run.result.answer.includes(actor.time),'Answer must contain this owner opening time');
  assert.ok(!run.result.answer.includes(other.phrase));assert.ok(run.result.citations.length>0);
  const traces=(await checked(actor.token,'/api/query-runs/'+runId+'/traces')).items;
  const selections=traces.filter((item:any)=>item.type==='codex.model.selected');
  assert.ok(selections.length>0&&selections.every((item:any)=>item.payload?.model===model),'Actual App Server thread must select the requested model');
  assert.ok(traces.some((item:any)=>item.type==='codex.turn/completed'&&item.payload?.status==='completed'),'Actual App Server turn must complete');
  const reads=traces.filter((item:any)=>item.type==='tool.completed'&&item.status==='succeeded'&&(JSON.stringify(item.payload?.result)??'').includes(actor.phrase));
  assert.ok(reads.length>0,'A successful real tool result must deliver the unpredictable original fact to the model');
  assert.ok(!JSON.stringify(traces).includes(other.phrase),'Model input, tools and trace remain owner-scoped');
  for(const citation of run.result.citations){const evidence=await checked(actor.token,'/api/agent-view/evidence?'+new URLSearchParams({id:citation.id}));assert.ok(evidence.items.some((item:any)=>item.ocrText.includes(actor.phrase)),'Citation must resolve to the actual owner original');await assertUnreadable(other.token,citation.id);}
  assert.equal((await request(admin.token,'/api/query-runs/'+runId)).status,404,'Administrator has no private Ask grant');
  assert.equal((await request(admin.token,'/api/agent-view/events?runId='+runId)).status,404);
  const meters=await safeUsage(actor);assert.equal(meters.length,1);assert.equal(meters[0].provider,'codex');assert.equal(meters[0].model,model);assert.equal(meters[0].status,'completed');
  completed.set(actor.label,run.result);
  const receipt={owner:actor.label,completed:true,elapsedMs:Date.now()-begun,selectedModel:model,modelTurns:traces.filter((item:any)=>item.type==='model.completed').length,tools:[...new Set(run.result.trace.map((item:any)=>item.tool))],canonicalReadTools:[...new Set(reads.map((item:any)=>item.tool))],citations:run.result.citations.length,answerSha256:digest(run.result.answer),usage:meters[0]};
  report.models.push(receipt);await passed('real_model_original_read_and_isolation_'+actor.label,receipt);
  });
 }
 assert.equal(completed.size,2,'Both actual owner model runs must pass before history comparisons');
 stage='history';
 const before=[await usage(a),await usage(b)];
 const history=async(actor:Actor)=>checked(actor.token,'/api/conversations/'+conversationId);
 const assertOriginal=async(actor:Actor)=>{const value=await history(actor);assert.equal(value.turns.length,1);assert.equal(value.turns[0].evidenceStale,undefined);assert.equal(value.turns[0].evidenceDeleted,undefined);assert.deepEqual(value.turns[0].result,completed.get(actor.label));};
 await scenario(async()=>{await restart();await assertOriginal(a);await assertOriginal(b);await passed('restart_retains_both_owner_histories',{sameConversationRunAndTurnIds:true});});
 stage='revision';
 await scenario(async()=>{
 const chunks=await checked(a.token,'/api/files/'+materialA.captureId+'/chunks');assert.equal(chunks.items.length,1);const chunk=chunks.items[0];assert.equal(chunk.ocrText,text(a));
 const correctedText='This is generated acceptance data. The observatory now has a corrected verification phrase '+randomBytes(12).toString('hex')+' and a corrected opening time 16:42.';
 const correction=await checked(a.token,'/api/files/'+materialA.captureId+'/corrections','POST',{artifactId:chunk.fileEvidence.artifactId,chunkId:chunk.id,originalText:chunk.ocrText,correctedText});assert.equal(correction.status,'accepted');
 const changed=await until(()=>checked(a.token,'/api/processing/originals/'+materialA.original.slice(9)),value=>value.artifactId===correction.artifactId&&value.revision!==materialA.revision,'owner correction publication',15000);
 assert.equal(changed.materialId,materialA.materialId);assert.notEqual(changed.revision,materialA.revision);assert.equal((await checked(a.token,'/api/materials/'+materialA.materialId+'/read')).text,correctedText);
 assert.equal((await checked(a.token,'/api/processing/artifacts/'+chunk.fileEvidence.artifactId)).payload.segments[0].text,text(a),'Owner correction preserves the raw extracted evidence');
 const stale=await history(a);assert.equal(stale.turns[0].evidenceStale,true);assert.deepEqual(stale.turns[0].result,completed.get('A'));await assertOriginal(b);
 const strict=await checked(a.token,'/api/query-runs/'+runId);assert.equal(strict.status,'failed');assert.equal(strict.result,undefined,'Saved history does not authorize the old current execution result');
 const work=await checked(a.token,'/api/work-activity/'+encodeURIComponent('query:'+runId));assert.equal(work.artifacts[0]?.href,'#/ask?conversation='+encodeURIComponent(conversationId));assert.equal(work.evidence.count,0);
 await restart();const staleAgain=await history(a);assert.equal(staleAgain.turns[0].evidenceStale,true);assert.deepEqual(staleAgain.turns[0].result,completed.get('A'));await assertOriginal(b);
 await passed('ordinary_revision_retains_stale_answer_and_saved_work_link',{strictCurrentResultWithdrawn:true,staleSurvivesRestart:true,bUnaffected:true});
 });
 stage='deletion';
 await scenario(async()=>{
 await checked(a.token,'/api/materials/'+materialA.materialId,'DELETE');
 const assertDeleted=async()=>{const erased=await history(a);assert.equal(erased.turns[0].evidenceDeleted,true);assert.equal(erased.turns[0].result?.answer??'','');assert.deepEqual(erased.turns[0].result?.citations??[],[]);assert.ok(!JSON.stringify(erased).includes(a.phrase));assert.deepEqual((await checked(a.token,'/api/work-activity/'+encodeURIComponent('query:'+runId))).artifacts,[]);await assertOriginal(b);};
 await assertDeleted();await restart();await assertDeleted();
 assert.equal((await checked(b.token,'/api/materials/'+materialB.materialId+'/read')).text,text(b));
 assert.deepEqual(await usage(a),before[0]);assert.deepEqual(await usage(b),before[1]);
 for(const actor of [a,b])assert.equal((await checked(actor.token,'/api/query-runs')).items.length,1);
 await passed('deletion_erases_saved_answer_with_b_positive_control',{erasureSurvivesRestart:true,historyModelReplays:0,totalRealAskRuns:2});
 });
 const finalSource=await sourceReceipt();assert.deepEqual(finalSource,report.source,'Production source must remain frozen throughout live acceptance');
 report.status=failure?'failed':'passed';
}catch(error){await finding(error);report.status='failed';
}finally{
 clearTimeout(deadline);process.removeListener('SIGINT',onSignal);process.removeListener('SIGTERM',onSignal);
 try{await close();await rm(directory,{recursive:true,force:true});const open=await Promise.all(addresses.map(listening));report.cleanup={hostsOpened,hostsClosed,allListenersClosed:open.every(value=>!value),generatedVaultRemoved:true};assert.equal(hostsOpened,hostsClosed);assert.ok(report.cleanup.allListenersClosed);}catch(error){failure??=error;report.status='failed';report.cleanup={...report.cleanup,status:'failed'};}
 report.finishedAt=new Date().toISOString();report.durationMs=Date.now()-started;await save();
 console.log(JSON.stringify({status:report.status,report:reportPath,cases:report.cases.length,completedRealAskRuns:report.models.length,personalDataUsed:false,cleanup:report.cleanup}));
}
if(failure)process.exitCode=1;
