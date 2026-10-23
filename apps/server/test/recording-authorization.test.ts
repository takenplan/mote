import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {randomUUID} from 'node:crypto';
import {setImmediate} from 'node:timers/promises';
import {buildApp} from '../src/app.js';
import type {Config} from '../src/config.js';
import {generatedRecordingCli} from './fixtures/recording-authorization-cli.js';

for(const provider of ['feishu','dingtalk'] as const)test(provider+' owner HTTP authorizes via generated real CLI and archives recording without host login',async t=>{
 const directory=await mkdtemp(join(tmpdir(),'mote-recording-authorization-')),cli=await generatedRecordingCli(directory,provider),token='generated-recording-auth-owner';
 const config:Config={dataDir:directory,token,tokenPath:'generated-only',host:'127.0.0.1',port:0,maxStorageBytes:50000000,maxExportBytes:10000000,retentionDays:0,insightIntervalHours:0,allowedOrigins:[],model:'',modelBaseUrl:'',apiKey:'',allowUnauthenticatedLocal:false,embeddingModel:'',embeddingBaseUrl:'',embeddingApiKey:'',logLevel:'silent'};
 const node=await buildApp(config,{backgroundWorker:false,connectorTesting:{recordings:[cli.provider]},agent:{configured:false,close:async()=>{},query:async()=>{throw Error('No model belongs in generated authorization transport');}}});await node.app.ready();
 t.after(async()=>{await node.app.close();await rm(directory,{recursive:true,force:true});});
 const path='/api/connectors/'+provider+'-recordings',request=async(method:'GET'|'POST'|'PUT'|'DELETE',suffix='',payload?:unknown,status=200)=>{const response=await node.app.inject({method,url:path+suffix,headers:{authorization:'Bearer '+token},...(payload?{payload}:{})});assert.equal(response.statusCode,status,response.body);return response.json();};
 const until=async(predicate:(status:any)=>boolean)=>{for(let i=0;i<1000;i++){const value=await request('GET');if(predicate(value))return value;await new Promise(resolve=>setTimeout(resolve,3));}const last=await request('GET');assert.fail('Generated authorization state never reached: '+JSON.stringify({connected:last.connected,task:last.authorization.task}));};
 assert.equal((await node.app.inject({method:'POST',url:path+'/login',payload:{}})).statusCode,401);
 const initial=await request('GET'),operationId=randomUUID(),command={operationId,expectedRevision:initial.authorization.revision};
 await request('POST','/login',command);const waiting=await until(value=>Boolean(value.authorization.task?.authorizationUrl));assert.equal(waiting.authorization.task.authorizationUrl,cli.url);
 await request('POST','/login',command);await request('POST','/check');const reloaded=await request('GET');assert.equal(reloaded.authorization.task.id,operationId);assert.equal(reloaded.authorization.task.authorizationUrl,cli.url);
 assert.equal((await cli.commands()).filter(args=>args.includes('login')&&(provider==='dingtalk'||args.includes('--no-wait'))).length,1);
 await request('POST','/authorization/cancel',undefined,400);assert.equal((await request('GET')).authorization.task.id,operationId);
 await request('POST','/authorization/cancel',{expectedRevision:waiting.authorization.revision,taskId:operationId});const cancelled=await request('GET');assert.equal(cancelled.authorization.task.state,'cancelled');assert.equal(cancelled.authorization.task.authorizationUrl,undefined);
 const secondId=randomUUID();await request('POST','/login',{operationId:secondId,expectedRevision:cancelled.authorization.revision});await until(value=>Boolean(value.authorization.task?.authorizationUrl));await cli.complete();const connected=await until(value=>value.connected&&value.authorization.task.state==='completed');
 await request('POST','/login',command,409);await request('POST','/configure',{operationId:secondId,expectedRevision:connected.authorization.revision,payload:{appId:'cli_generated',secret:'GENERATED_APP_SECRET',brand:'feishu'}},409);
 await request('PUT','/selection',{enabled:true,start:'2026-09-01T00:00:00Z',end:'2026-10-01T00:00:00Z',autoSync:false,backupAudio:true});for(let i=0;i<30;i++){const steps=node.store.db.prepare("SELECT id FROM execution_steps WHERE kind LIKE ? AND state IN ('waiting','running') AND available_at<=?").all('recording.'+provider+'.%',Date.now());if(!steps.length)break;await node.executor.drain(steps.map(step=>String(step.id)));}
 const archived=await request('GET');assert.equal(archived.counts.transcripts,1,JSON.stringify(archived.steps));assert.equal(archived.counts.audio,1);const items=await request('GET','/items');assert.equal(items.items.length,1);assert.ok(items.items[0].audio);
 if(provider==='feishu'){const login=(await cli.commands()).find(args=>args.includes('--no-wait'))!;assert.equal(login[login.indexOf('--scope')+1],'minutes:minutes.basic:read minutes:minutes.artifacts:read minutes:minutes.media:export minutes:minutes.search:read');}
 assert.ok(!(await readFile(join(directory,'connectors',provider+'-recordings.json'),'utf8')).includes('GENERATED_DEVICE_CODE'));
});
