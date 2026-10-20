import {ExecutionFailure} from '../../src/execution-engine.js';
import {defaultPerceptionConfiguration} from '../../src/perception-configuration.js';
import {waitForPluginCheck} from './plugin-check.js';
import {scopedMemoryFixture as fixture} from './scoped-memory-host.js';
import {uiPageText} from '@mote/shared';
import sharp from 'sharp';
import test,{type TestContext} from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {mkdtempSync,rmSync,writeFileSync,unlinkSync,readFileSync,existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {AsyncLocalStorage} from 'node:async_hooks';
import {setTimeout as delay} from 'node:timers/promises';
import {LifecycleAuthority} from '../../src/scope/lifecycle.js';
import {openScopeStorage} from '../../src/scope/storage.js';
import {buildApp} from '../../src/app.js';
import {defaultMemorySettings} from '../../src/scope/memory-schema.js';
import {defaultProcessingSettings} from '../../src/scope/processing-schema.js';
import {defaultModelSettings} from '../../src/model-settings.js';
import {materialId} from '../../src/materials.js';
import {writeMessagesResponse} from '../../../../scripts/fixtures/messages-provider.js';
import {generatedMemoryRelease,generatedMem0Release,generatedHindsightRelease} from './scoped-memory-release.js';
import {hindsightHttpFixture} from './hindsight-http.js';
import type {HindsightRuntimeFactory} from '../../src/scope/memory-providers.js';
import {PrivateSql,PrivateCursor} from '../../src/scope/private-data-sql.js';
import {ScopedMemoryData} from '../../src/scope/memory-data.js';
import type {PrivateData} from '../../src/scope/private-data.js';

const password='Generated-memory-password-only-01';

const protocol={'x-mote-protocol-version':'2','x-mote-ingress-version':'3'};

const text=(owner:string)=>'GENERATED_MEMORY_'+owner+': Nora prefers generated tea.';

const deferred=()=>{let resolve!:()=>void;const promise=new Promise<void>(r=>resolve=r);return {promise,resolve};};

const awaitableIdentity={deploymentId:'generated',userId:'generated',credentialId:'generated',authorizationEpoch:1};

async function imageMaterial(t:TestContext,f:Awaited<ReturnType<typeof fixture>>,user:any,label:string,bytes:Buffer,holdAutomatic=false){
 const release=deferred();let entered=false,calls=0;f.beforeClose(()=>release.resolve());
 const media=createServer(async(req,res)=>{if(req.method==='POST'){calls++;if(holdAutomatic){entered=true;await release.promise;}}res.setHeader('content-type','application/json');res.setHeader('X-Mote-Execution','local');res.end(JSON.stringify({durationMs:0,segments:[{startMs:0,endMs:0,text:'GENERATED_OCR_NAVIGATION_ONLY'}],engine:'generated-ocr'}));});await new Promise<void>(resolve=>media.listen(0,'127.0.0.1',resolve));t.after(async()=>{media.closeAllConnections();await new Promise<void>(resolve=>media.close(()=>resolve()));});
 await f.replace(user.token,'models',{profiles:[{id:'same-model',name:'Generated language model',settings:{...defaultModelSettings(),provider:'custom',protocol:'anthropic-messages',model:'generated-memory',baseUrl:f.modelUrl,apiKey:'GENERATED_'+label+'_KEY'}},{id:'same-ocr',name:'Generated OCR',settings:{...defaultModelSettings(),provider:'custom',protocol:'mote-media',model:'generated-ocr',baseUrl:'http://127.0.0.1:'+(media.address() as any).port,apiKey:'GENERATED_OCR_'+label+'_KEY'}}],selections:{memory:{kind:'personal',id:'same-model'},ocr:{kind:'personal',id:'same-ocr'}}});
 const received=await f.upload(user,label,'same-image',bytes,'image/png'),original=received.captures[0].original.ref,end=Date.now()+12000;
 // Image intake already admitted the real M06 coordinator. Consume its result
 // instead of racing that live transport with a second manual processing intent.
 if(holdAutomatic)try{
  while(!entered){assert.ok(Date.now()<end,'automatic M06 did not reach the generated OCR transport');await delay(10);}
  const state=await f.request(user.token,'/api/images/'+received.captures[0].id);assert.equal(state.statusCode,200,state.body);assert.equal(state.json().wait,'running','the original OCR transport is live, not an unknown result');
  const admissions=()=>f.read(db=>db.prepare('SELECT request_key,task_id FROM mp_admissions WHERE user_id=? AND original_id=? ORDER BY request_key').all(user.userId,original.slice(9))),before=admissions();assert.ok(before.some(row=>String(row.request_key).startsWith('intake:')));
  const duplicate=await f.request(user.token,'/api/processing','POST',{originalRef:original,operationId:'same-image-processing'});assert.equal(duplicate.statusCode,409,duplicate.body);assert.equal(duplicate.json().error,'external_result_unknown');assert.deepEqual(admissions(),before,'a guarded second intent does not create another coordinator');
 }finally{release.resolve();}
 let materialId:string|undefined;while(!materialId){const state=await f.request(user.token,'/api/processing/originals/'+original.slice(9));assert.equal(state.statusCode,200,state.body);materialId=state.json().materialId;assert.ok(Date.now()<end,state.body);await delay(10);}assert.equal(calls,1,'the admitted automatic M06 request produces the image Material once');return materialId;
}

export {password,protocol,text,deferred,awaitableIdentity,imageMaterial};
