import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {setTimeout as delay} from 'node:timers/promises';
import {scopedMemoryFixture} from './fixtures/scoped-memory-host.js';
import {defaultMemorySettings} from '../src/scope/memory-schema.js';
const secret='GENERATED_REDACTED_CONTENT_NOT_DISCLOSED';
const at='2026-10-18T00:00:05Z';
async function until<T>(read:()=>Promise<T>,ready:(value:T)=>boolean){const end=performance.now()+15000;for(;;){const value=await read();if(ready(value))return value;assert.ok(performance.now()<end,JSON.stringify(value));await delay(10);}}

test('actual ingress and grouped organizer keep redacted screen OCR out of every Memory model request',async t=>{
 const f=await scopedMemoryFixture(t),settings=defaultMemorySettings();settings.integration=false;await f.replace(f.a.token,'memory',settings);for(const owner of ['A','B'])f.answers.set(owner,(_raw,keys)=>({memories:[],coverage:keys.map(key=>({key,state:'no_candidates',candidateIndexes:[]}))}));
 const source='generated-private-screen';assert.equal((await f.request(f.a.token,'/api/ingress/sources','POST',{id:source,name:'Generated screen',kind:'custom',deviceId:'same-device',platform:'import',retention:'snapshot'})).statusCode,200);
 const send=async(redacted:boolean)=>{const id=randomUUID(),response=await f.request(f.a.token,'/api/ingress/sources/'+source+'/captures','POST',{batchId:randomUUID(),items:[{id,deviceId:'same-device',deviceName:'Generated screen',platform:'import',capturedAt:at,durationMs:2000,source:'screen',appId:'generated.app',appName:'Generated app',windowTitle:'',ocrText:redacted?secret:'GENERATED_VISIBLE_SCREEN',privacy:{excluded:false,redacted,mode:'local',collection:'content'}}]});assert.equal(response.statusCode,200,response.body);return id;};
 const bad=await send(true),safe=await send(false);await until(async()=>f.read(db=>db.prepare("SELECT state,error FROM execution_steps WHERE user_id=? AND kind='memory.materials' AND json_extract(input,'$.captureId')=? ORDER BY user_position DESC LIMIT 1").get(f.a.userId,safe)),row=>row?.state==='succeeded');
 const intake=await until(async()=>f.read(db=>db.prepare("SELECT i.* FROM mm_intakes i JOIN pd_material_captures c ON c.user_id=i.user_id AND c.material_id=i.material_id AND c.revision=i.revision WHERE i.user_id=? AND c.capture_id=? ORDER BY i.created_at,i.id LIMIT 1").get(f.a.userId,safe)),row=>row?.state==='complete');await f.wait(f.a,String(intake!.job_id));
 assert.ok(f.requests.length>=2,'real extraction and independent review must consume the eligible original');assert.ok(f.requests.some(request=>request.raw.includes('GENERATED_VISIBLE_SCREEN')));assert.ok(f.requests.every(request=>!request.raw.includes(secret)),'all provider phases, including automatic background work, remain private');
 assert.equal(f.read(db=>Number(db.prepare('SELECT count(*) n FROM pd_material_captures WHERE user_id=? AND capture_id=?').get(f.a.userId,bad)!.n)),0);assert.equal(f.read(db=>Number(db.prepare('SELECT count(*) n FROM mm_intakes WHERE user_id=?').get(f.b.userId)!.n)),0);
 const context=await f.node.authority.authenticate(f.a.token),data=await f.data(f.a);await assert.rejects(f.node.ask!.bind(context,{assertCurrent:()=>{}}).reader().agent.evidence({ids:[bad]}));assert.equal(data.privateData.capture(bad).privacy.redacted,true);
});
