import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {setTimeout} from 'node:timers/promises';
import {buildApp} from '../src/app.js';
import type {Config} from '../src/config.js';
import {authorizeFixtureModels} from './fixtures/model-authorization.js';

test('out-of-scope source Memory waits durably without repeatedly invoking a model',async t=>{
 const directory=mkdtempSync(join(tmpdir(),'mote-memory-authorization-wait-'));
 const config:Config={dataDir:directory,token:'generated-memory-wait-owner',tokenPath:'fixture',host:'127.0.0.1',port:0,maxStorageBytes:30_000_000,maxExportBytes:1_000_000,retentionDays:0,insightIntervalHours:0,allowedOrigins:[],model:'fixture',modelBaseUrl:'',apiKey:'',allowUnauthenticatedLocal:false,embeddingModel:'',embeddingBaseUrl:'',embeddingApiKey:'',diagnosticsEnabled:false};
 let calls=0;const node=await buildApp(config,{backgroundWorker:false,agent:{configured:true,close:async()=>{},query:async()=>{calls++;throw Error('Out-of-scope source must not reach the model');}}});
 await node.app.ready();t.after(async()=>{await node.app.close();rmSync(directory,{recursive:true,force:true});});
 await authorizeFixtureModels(node,{sourceIds:['generated-approved'],dataKinds:['text']});
 node.sources.register({id:'generated-other',name:'Generated other source',kind:'custom',deviceId:'generated',platform:'import'});
 await node.sources.upsert('generated-other',{externalId:'generated-one',revision:'1',observedAt:'2026-01-01T00:00:00Z',kind:'message',layer:'original',text:'Generated private original'});
 await node.materialOrganizer.tick();await node.sourcePipelines.tick();node.store.db.prepare('UPDATE material_memory_requests SET ready_at=0').run();
 assert.equal(await node.sourcePipelines.drainMemory(node.memoryPipeline,true,10),1);
 const job=node.memoryPipeline.list()[0];assert.ok(job);void node.memoryPipeline.run(job.id).catch(()=>{});
 let step:Record<string,unknown>|undefined;const deadline=Date.now()+10000;
 while(Date.now()<deadline){step=node.store.db.prepare("SELECT state,error,attempts,available_at,updated_at FROM execution_steps WHERE kind='memory.batch' AND operation_id=?").get('memory:'+job.id);if(step?.state==='waiting'&&step.error==='background_model_authorization_required')break;await setTimeout(20);}
 assert.equal(step?.state,'waiting');assert.equal(step?.error,'background_model_authorization_required');
 assert.ok(Number(step?.available_at)-Number(step?.updated_at)>=59000,'the parent inherits the child authorization wait');
 assert.equal(step?.attempts,0);assert.equal(calls,0);assert.equal(node.memories.list().length,0);
});
