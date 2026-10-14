import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {parse,stringify} from 'yaml';
import {buildApp} from '../src/app.js';
import type {Config} from '../src/config.js';

const token='synthetic-runtime-config-owner-token';
const headers={authorization:`Bearer ${token}`};
const inactive={configured:false,query:async()=>{throw Error('No model access in this fixture');},close:async()=>{}};
const config=(dataDir:string):Config=>({dataDir,token,tokenPath:'fixture-only',host:'127.0.0.1',port:0,maxStorageBytes:10_000_000,maxExportBytes:1_000_000,retentionDays:0,insightIntervalHours:0,allowedOrigins:[],model:'',modelBaseUrl:'https://fixture.invalid/v1',apiKey:'',allowUnauthenticatedLocal:false,embeddingModel:'',embeddingBaseUrl:'',embeddingApiKey:''});
const turn=()=>new Promise<void>(resolve=>setImmediate(resolve));

test('execution API and external YAML edits share admission limits, global conflicts and diagnostics application',async t=>{
 const directory=await mkdtemp(join(tmpdir(),'mote-runtime-config-')),node=await buildApp(config(directory),{agent:inactive,backgroundWorker:false});
 t.after(async()=>{await node.app.close();await rm(directory,{recursive:true,force:true});});
 const modelRevision=node.modelSettings.view().revision;
 const initial=(await node.app.inject({url:'/api/execution-settings',headers})).json();
 let releaseFirst!:()=>void,releaseSecond!:()=>void;const first=node.featureServices.agentGate.run(()=>new Promise<void>(resolve=>{releaseFirst=resolve;}));const second=node.featureServices.agentGate.run(()=>new Promise<void>(resolve=>{releaseSecond=resolve;}));
 await turn();
 const saved=await node.app.inject({method:'PUT',url:'/api/execution-settings',headers,payload:{revision:initial.revision,interactiveConcurrency:1,agentConcurrency:1,llmConcurrency:2,memoryConcurrency:1}});
 assert.equal(saved.statusCode,200,saved.body);assert.equal(saved.json().revision,modelRevision+1);
 assert.deepEqual(node.featureServices.agentGate.snapshot(),{active:2,waiting:0,limit:1},'lowering the limit leaves admitted tasks alive');
 let thirdStarted=false;const third=node.featureServices.agentGate.run(async()=>{thirdStarted=true;});await turn();assert.equal(thirdStarted,false);
 releaseFirst();await first;await turn();assert.equal(thirdStarted,false,'one remaining active task fills the lowered limit');releaseSecond();await second;await third;assert.equal(thirdStarted,true);
 const stale=await node.app.inject({method:'PUT',url:'/api/model-settings',headers,payload:{revision:modelRevision,settings:node.modelSettings.current()}});assert.equal(stale.statusCode,409);assert.equal(stale.json().error,'model_settings_conflict');
 const missing=await node.app.inject({method:'PUT',url:'/api/execution-settings',headers,payload:{interactiveConcurrency:1,agentConcurrency:1,llmConcurrency:1,memoryConcurrency:1}});assert.equal(missing.statusCode,400);
 const path=join(directory,'mote.yaml'),doc=parse(await readFile(path,'utf8'));doc.execution.agentConcurrency=3;doc.execution.memoryConcurrency=2;doc.diagnostics.enabled=true;doc.diagnostics.debug=true;doc.diagnostics.traceEnabled=true;doc.diagnostics.level='debug';
 await writeFile(path,stringify(doc));await node.configService.reload();
 const reloaded=(await node.app.inject({url:'/api/execution-settings',headers})).json();assert.equal(reloaded.agentConcurrency,3);assert.equal(reloaded.queues.agents.limit,3);assert.equal(reloaded.memoryConcurrency,2);assert.equal(reloaded.revision,saved.json().revision+1);
 assert.equal((await node.app.inject({url:'/api/diagnostics-settings',headers})).json().traceEnabled,true);assert.equal(node.diagnostics.snapshot().agentTrace.enabled,true);
 doc.revision=reloaded.revision;doc.execution.agentConcurrency=0;await writeFile(path,stringify(doc));await assert.rejects(node.configService.reload(),{code:'config_invalid'});assert.equal(node.featureServices.agentGate.snapshot().limit,3);assert.equal(node.configService.revision,reloaded.revision);
});

test('legacy SQLite execution and diagnostics rows never override YAML and remain preserved',async t=>{
 const directory=await mkdtemp(join(tmpdir(),'mote-runtime-legacy-'));let node=await buildApp(config(directory),{agent:inactive,backgroundWorker:false});
 t.after(async()=>{await node.app.close();await rm(directory,{recursive:true,force:true});});
 const rows={execution:JSON.stringify({interactiveConcurrency:8,agentConcurrency:63,llmConcurrency:62,memoryConcurrency:15}),diagnostics:JSON.stringify({enabled:false,debug:true,traceEnabled:true,level:'silent'})};
 node.store.db.prepare('INSERT INTO settings(key,value) VALUES(?,?)').run('execution-settings',rows.execution);node.store.db.prepare('INSERT INTO settings(key,value) VALUES(?,?)').run('diagnostics-settings',rows.diagnostics);
 await node.app.close();node=await buildApp(config(directory),{agent:inactive,backgroundWorker:false});
 const execution=(await node.app.inject({url:'/api/execution-settings',headers})).json(),diagnostics=(await node.app.inject({url:'/api/diagnostics-settings',headers})).json();assert.equal(execution.agentConcurrency,8);assert.equal(execution.interactiveConcurrency,2);assert.equal(diagnostics.enabled,true);assert.equal(diagnostics.debug,false);
 assert.equal(node.store.db.prepare("SELECT value FROM settings WHERE key='execution-settings'").get()?.value,rows.execution);assert.equal(node.store.db.prepare("SELECT value FROM settings WHERE key='diagnostics-settings'").get()?.value,rows.diagnostics);
 const saved=await node.app.inject({method:'PUT',url:'/api/diagnostics-settings',headers,payload:{revision:diagnostics.revision,enabled:false,debug:false,traceEnabled:false,level:'info'}});assert.equal(saved.statusCode,200,saved.body);
 assert.equal(node.store.db.prepare("SELECT value FROM settings WHERE key='diagnostics-settings'").get()?.value,rows.diagnostics);assert.equal(parse(await readFile(join(directory,'mote.yaml'),'utf8')).diagnostics.enabled,false);
});

test('a later domain application failure restores the old model generation and keeps its in-flight lease',async t=>{
 const directory=await mkdtemp(join(tmpdir(),'mote-model-rollback-')),closed:string[]=[];
 let release!:()=>void,started!:()=>void;const held=new Promise<void>(resolve=>{release=resolve;}),began=new Promise<void>(resolve=>{started=resolve;});
 const node=await buildApp({...config(directory),model:'original-model'},{backgroundWorker:false,createModelAgent:async settings=>({configured:true,query:async input=>{if(input.question==='hold rollback'){started();await held;}return {answer:settings.model,citations:[],trace:[],runId:'synthetic-rollback-run'};},close:async()=>{closed.push(settings.model);}})});
 t.after(async()=>{release();await node.app.close();await rm(directory,{recursive:true,force:true});});
 const pending=node.app.inject({method:'POST',url:'/api/query',headers,payload:{question:'hold rollback'}});await began;
 node.configService.setHandler('connectors',()=>({applyOrder:2000,apply:()=>{},publish:()=>{throw Error('Synthetic publication failure');},rollback:()=>{}}));
 const models=node.configService.saved<{deployment:Record<string,unknown>}>('models'),connectors=node.configService.saved<{syncIntervalMs:number}>('connectors');
 await assert.rejects(node.configService.updateMany({models:{...models,deployment:{...models.deployment,model:'candidate-model'}},connectors:{...connectors,syncIntervalMs:connectors.syncIntervalMs+60000}},node.configService.revision),{code:'config_apply_failed'});
 assert.equal(node.modelSettings.current().model,'original-model');assert.equal(node.configService.view().lastError?.code,'config_apply_failed');assert.equal(closed.includes('original-model'),false);
 assert.equal((await node.app.inject({method:'POST',url:'/api/query',headers,payload:{question:'new after rollback'}})).json().answer,'original-model');
 release();assert.equal((await pending).json().answer,'original-model');await turn();assert.equal(closed.includes('candidate-model'),true);assert.equal(closed.includes('original-model'),false);
});

test('an asynchronous plugin failure exposes no candidate model, admission limit or diagnostic trace policy',async t=>{
 const {z}=await import('zod'),{stat}=await import('node:fs/promises');
 const directory=await mkdtemp(join(tmpdir(),'mote-runtime-publication-')),closed:string[]=[];
 const node=await buildApp({...config(directory),model:'committed-model',diagnosticsEnabled:false},{backgroundWorker:false,createModelAgent:async settings=>({configured:true,query:async()=>({answer:settings.model,citations:[],trace:[],runId:'synthetic-publication-run'}),close:async()=>{closed.push(settings.model);}})});
 t.after(async()=>{await node.app.close();await rm(directory,{recursive:true,force:true});});
 let enter!:()=>void,finish!:()=>void;const entered=new Promise<void>(resolve=>{enter=resolve;}),held=new Promise<void>(resolve=>{finish=resolve;});
 await node.configService.registerPlugin({id:'publication-fixture',schema:z.object({reject:z.boolean()}),defaultValue:{reject:false},prepare:next=>({apply:async()=>{if(next.reject){enter();await held;throw Error('Synthetic asynchronous failure');}},rollback:()=>{}})});
 const previous=node.configService.current<Record<string,unknown>>('execution'),models=node.configService.saved<{deployment:Record<string,unknown>}>('models');
 const pending=node.configService.updateMany({models:{...models,deployment:{...models.deployment,model:'unpublished-model'}},execution:{agentConcurrency:1},diagnostics:{enabled:true,debug:true,traceEnabled:true,level:'debug'},'plugin.publication-fixture':{reject:true}},node.configService.revision);
 const failed=assert.rejects(pending,{code:'config_apply_failed'});await entered;
 try{
  assert.equal(node.modelSettings.current().model,'committed-model');assert.equal(node.featureServices.agentGate.snapshot().limit,previous.agentConcurrency);assert.equal(node.diagnostics.snapshot().enabled,false);assert.equal(node.diagnostics.snapshot().agentTrace.enabled,false);
  node.diagnostics.agentTrace({type:'fixture.unpublished',payload:{prompt:'synthetic-speculative-trace'}},{});
  assert.equal((await node.app.inject({method:'POST',url:'/api/query',headers,payload:{question:'during candidate application'}})).json().answer,'committed-model');
 }finally{finish();}
 await failed;
 assert.equal(node.modelSettings.current().model,'committed-model');assert.equal(node.featureServices.agentGate.snapshot().limit,previous.agentConcurrency);assert.equal(node.diagnostics.recent().some(event=>event.event==='agent.trace'),false);
 assert.equal(closed.includes('unpublished-model'),true,'a prepared, unpublished model candidate is disposed after failure');assert.equal(closed.includes('committed-model'),false);
 await assert.rejects(stat(join(directory,'logs','central.lock')),{code:'ENOENT'});
});
