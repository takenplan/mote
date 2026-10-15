import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {buildApp} from '../src/app.js';
import type {Config} from '../src/config.js';

const deferred=()=>{let resolve!:()=>void;const promise=new Promise<void>(done=>resolve=done);return {promise,resolve};};
const turn=()=>new Promise<void>(resolve=>setImmediate(resolve));

for(const entry of ['ask','insight'] as const)test(`the real Central ${entry} entry waits beyond its model budget for a model slot`,async t=>{
 const directory=mkdtempSync(join(tmpdir(),'mote-central-model-wait-')),token='generated-queue-budget-token';let calls=0;
 const config:Config={dataDir:directory,token,tokenPath:'fixture',host:'127.0.0.1',port:0,maxStorageBytes:30_000_000,maxExportBytes:1_000_000,retentionDays:0,insightIntervalHours:0,allowedOrigins:[],model:'generated-fixture',modelProvider:'custom',modelProtocol:'openai-completions',modelBaseUrl:'http://127.0.0.1:1/v1',apiKey:'generated',allowUnauthenticatedLocal:false,embeddingModel:'',embeddingBaseUrl:'',embeddingApiKey:'',diagnosticsEnabled:false,agentTimeoutMs:5000,llmConcurrency:1,interactiveConcurrency:1};
 // Use the actual host model callback and its lane gate. Only the final model
 // answer is synthetic: no private input, network service or provider is used.
 const node=await buildApp(config,{backgroundWorker:false,createModelAgent:async(_settings,_reader,host)=>({configured:true,close:async()=>{},query:input=>host!.runModel!(async()=>{calls++;return {answer:input.skill==='personal-insight'?JSON.stringify({title:'Generated review',markdown:'Generated review',html:'<p>Generated review</p>'}):'Generated answer',citations:[],trace:[],runId:randomUUID()};},input.signal)})});
 await node.app.ready();const held=deferred(),entered=deferred(),gate=entry==='ask'?node.featureServices.interactiveModelGate:node.featureServices.llmGate;
 const blocker=gate.run(async()=>{entered.resolve();await held.promise;});await entered.promise;
 t.after(async()=>{held.resolve();await blocker;await node.app.close();rmSync(directory,{recursive:true,force:true});});
 t.mock.timers.enable({apis:['setTimeout']});
 const response=node.app.inject({method:'POST',url:entry==='ask'?'/api/query':'/api/insights',headers:{authorization:'Bearer '+token},payload:entry==='ask'?{question:'Generated queued question'}:{prompt:'Generated queued review'}});
 const result=Promise.resolve(response);
 for(let index=0;index<100&&gate.snapshot().waiting===0;index++)await turn();
 assert.equal(gate.snapshot().waiting,1);assert.equal(calls,0);
 t.mock.timers.tick(5001);await turn();assert.equal(gate.snapshot().waiting,1,'model capacity waiting is not task processing');assert.equal(calls,0);
 held.resolve();await blocker;const completed=await result;
 assert.equal(completed.statusCode,200,completed.body);assert.equal(calls,1);
 assert.equal(entry==='ask'?node.featureServices.queryRuns.list()[0].status:node.insightRuns.list()[0].status,'completed');
});
