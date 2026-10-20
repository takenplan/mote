import test from 'node:test';
import {createServer} from 'node:http';
import {writeMessagesResponse} from '../../../scripts/fixtures/messages-provider.js';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import {DatabaseSync} from 'node:sqlite';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {setTimeout as delay} from 'node:timers/promises';
import {scopedFilesFixture} from './fixtures/scoped-files.js';
import {waitForScopedState} from './fixtures/scoped-process.js';
import {bytesHash} from '../src/scope/originals.js';
import {defaultModelSettings} from '../src/model-settings.js';
import {Fixture,png,settings,policy,generated,upload,read,done} from './fixtures/multiuser-perception-history-suite.js';

test('confirmed historical scheduling persists the 200-item cursor and never resubmits a completed page after restart',async t=>{
 const runs:string[]=[],f=await scopedFilesFixture(t,node=>generated(node as any,runs));for(const actor of [f.a,f.b])await policy(f,actor.token,true);const image=(await png()).toString('base64'),entries=Array.from({length:201},(_,index)=>({id:randomUUID(),deviceId:'same-device',deviceName:'Generated page fixture',platform:'import',appId:'generated.page.'+index,appName:'Generated page fixture',windowTitle:'Generated page '+index,capturedAt:new Date(Date.UTC(2026,0,1,index)).toISOString(),durationMs:0,source:'screen',ocrText:'',imageBase64:image,imageMime:'image/png',ocr:{status:'pending'}}));
 const first=await f.checked(f.a.token,'/api/ingress/sources/same-source/captures','POST',{batchId:'generated-page-first',items:entries.slice(0,100)});await f.checked(f.b.token,'/api/ingress/sources/same-source/captures','POST',{batchId:'generated-other-between',items:[{...entries[0],id:randomUUID()}]});const second=await f.checked(f.a.token,'/api/ingress/sources/same-source/captures','POST',{batchId:'generated-page-second',items:entries.slice(100)});assert.equal(first.captures.length+second.captures.length,201);await policy(f,f.a.token);await settings(f,f.a.token,{enabled:false});
 const preview=await f.checked(f.a.token,'/api/perception/ocr/historical-preview','POST',{mode:'recompute'});assert.equal(preview.count,201);assert.equal(runs.length,0);await f.checked(f.b.token,'/api/ingress/sources/same-source/captures','POST',{batchId:'generated-other-after-preview',items:[{...entries[1],id:randomUUID()}]});const queued=await f.checked(f.a.token,'/api/perception/ocr/historical-process','POST',{token:preview.token});
 const inspect=()=>{const db=new DatabaseSync(join(f.directory,'mote.sqlite'),{readOnly:true});try{return {task:db.prepare("SELECT e.id,e.state,e.error FROM execution_steps e JOIN user_tasks u ON u.user_id=e.user_id AND u.task_id=e.id WHERE e.kind='processing.image-backfill' AND e.user_id=? AND json_extract(u.input,'$.id')=?").get(f.a.userId,queued.jobId),job:JSON.parse(String(db.prepare('SELECT json FROM mp_image_backfills WHERE user_id=? AND id=?').get(f.a.userId,queued.jobId)!.json)),admissions:db.prepare('SELECT count(*) n FROM mp_admissions WHERE user_id=?').get(f.a.userId)!.n};}finally{db.close();}};
 await waitForScopedState(()=>{const state=inspect();assert.ok(!['stale','failed','blocked','cancelled'].includes(String(state.task?.state)),JSON.stringify(state));return state.job.state==='succeeded';},()=>JSON.stringify(inspect()),60000);const completed=inspect();assert.equal(completed.job.queued,201);assert.equal(completed.job.cursor,completed.job.watermark);assert.equal(completed.admissions,201);const status=(await f.checked(f.a.token,'/api/perception')).backfills[0];assert.equal(status.queued,201);assert.ok(!('cursor' in status)&&!('watermark' in status));const task=await f.checked(f.a.token,'/api/tasks/'+completed.task!.id);assert.deepEqual(task.progress,{queued:201});assert.equal((await f.request(f.b.token,'/api/tasks/'+completed.task!.id)).statusCode,404);assert.equal((await f.checked(f.b.token,'/api/perception')).backfills.length,0);
 await f.restart();await delay(150);assert.equal(inspect().admissions,201,'completed durable cursors never admit duplicate historical work after restart');assert.equal(inspect().job.state,'succeeded');
});
