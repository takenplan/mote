import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {buildApp} from '../src/app.js';
import type {Config} from '../src/config.js';

test('preparation HTTP requires owner authority and cannot turn installation into automatic processing consent',async t=>{
 const directory=await mkdtemp(join(tmpdir(),'mote-prepare-http-'));
 const config:Config={dataDir:directory,token:'generated-media-owner',tokenPath:'fixture',host:'127.0.0.1',port:0,maxStorageBytes:20_000_000,maxExportBytes:1_000_000,retentionDays:0,insightIntervalHours:0,allowedOrigins:[],model:'generated-model',modelBaseUrl:'https://fixture.invalid',apiKey:'',allowUnauthenticatedLocal:false,embeddingModel:'',embeddingBaseUrl:'',embeddingApiKey:'',logLevel:'silent'};
 const node=await buildApp(config,{backgroundWorker:false,createModelAgent:async()=>({configured:false,close:async()=>{},query:async()=>{throw Error('No model call expected');}})});
 t.after(async()=>{await node.app.close();await rm(directory,{recursive:true,force:true});});
 const headers={authorization:'Bearer '+config.token},before=node.modelAuthorization.view(),initialPerception=node.perception.settings();
 assert.equal((await node.app.inject({url:'/api/media-preparation'})).statusCode,401);
 const invitation=node.connections.invite({serverUrl:'https://fixture.invalid',label:'Generated collector'},'collector');
 const collector=await node.connections.redeem({code:invitation.invitation.code,deviceId:'generated-collector',deviceName:'Generated collector',platform:'android'}),collectorHeaders={authorization:'Bearer '+collector.token};
 for(const [method,url] of [['GET','/api/media-preparation'],['POST','/api/media-preparation/ocr'],['POST','/api/media-preparation/ocr/cancel']] as const)assert.equal((await node.app.inject({method,url,headers:collectorHeaders,...(method==='POST'?{payload:{}}:{})})).statusCode,403);
 const status=await node.app.inject({url:'/api/media-preparation',headers});assert.equal(status.statusCode,200);assert.equal(status.json().ocr.error,'runtime_unknown');
 assert.equal((await node.app.inject({method:'POST',url:'/api/media-preparation/ocr',headers,payload:{}})).statusCode,409);
 assert.equal((await node.app.inject({method:'POST',url:'/api/media-preparation/unlisted',headers,payload:{}})).statusCode,400);
 assert.equal((await node.app.inject({method:'POST',url:'/api/media-preparation/ocr',headers,payload:{source:'https://untrusted.invalid'}})).statusCode,400);
 assert.deepEqual(node.modelAuthorization.view(),before);assert.deepEqual(node.perception.settings(),initialPerception);
});
