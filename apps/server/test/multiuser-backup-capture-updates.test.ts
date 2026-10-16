import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {mkdtempSync,rmSync,cpSync,readFileSync,writeFileSync,existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {setTimeout as delay} from 'node:timers/promises';
import sharp from 'sharp';
import {buildApp} from '../src/app.js';
import {defaultProcessingSettings} from '../src/scope/processing-schema.js';
import {defaultModelSettings} from '../src/model-settings.js';
import {scopedCaptureFixture,captureBrowserRecord} from './fixtures/scoped-capture-host.js';
import {backupScopedInstance,restoreScopedInstance} from '../../../scripts/scoped-backup.mjs';

test('offline instance recovery preserves actual device OCR cursor history and rejects incomplete or rewound journals before publication',async t=>{
 const directory=mkdtempSync(join(tmpdir(),'mote-m16-ocr-backup-')),snapshot=join(directory,'snapshot'),target=join(directory,'target');
 const worker=createServer(async(req,res)=>{for await(const _part of req){}res.setHeader('Content-Type','application/json');res.setHeader('X-Mote-Execution','local');res.end(JSON.stringify({durationMs:0,segments:[{startMs:0,endMs:0,text:'Generated offline OCR cursor'}],coverage:'full',engine:'generated-http-fixture'}));});
 await new Promise<void>(resolve=>worker.listen(0,'127.0.0.1',resolve));t.after(async()=>{worker.closeAllConnections();await new Promise<void>(resolve=>worker.close(()=>resolve()));rmSync(directory,{recursive:true,force:true});});
 const f=await scopedCaptureFixture(t),configure=async(domain:string,value:unknown)=>{const revision=(await f.request(f.a.token,'/api/configuration')).json().revision,response=await f.request(f.a.token,'/api/configuration/'+domain,'PUT',{revision,value});assert.equal(response.statusCode,200,response.body);};
 await configure('processing',{...defaultProcessingSettings(),automatic:false,understandingEnabled:false,summarize:false});await configure('models',{profiles:[{id:'generated-ocr',name:'Generated backup OCR',settings:{...defaultModelSettings(),provider:'custom',protocol:'mote-media',baseUrl:'http://127.0.0.1:'+(worker.address() as any).port+'/transcribe',model:'generated-ocr',apiKey:'GENERATED_OFFLINE_OCR'}}],selections:{ocr:{kind:'personal',id:'generated-ocr'}}});
 const png=await sharp({create:{width:16,height:16,channels:3,background:'#123456'}}).png().toBuffer(),captures=[];
 for(let index=0;index<2;index++){const input=captureBrowserRecord(1000+index,'generated-backup',{ocrText:'',ocr:{status:'disabled'},imageBase64:png.toString('base64'),imageMime:'image/png'});captures.push(input.id);const received=await f.receive(f.a,[input]),started=await f.request(f.a.token,'/api/processing','POST',{originalRef:received.captures[0].original.ref,operationId:'generated-offline-ocr-'+index});assert.equal(started.statusCode,200,started.body);let task:any;for(let attempt=0;attempt<1000;attempt++){task=(await f.request(f.a.token,'/api/tasks/'+started.json().id)).json();if(task.state==='succeeded')break;assert.ok(!['failed','stale','cancelled','blocked'].includes(task.state),JSON.stringify(task));await delay(10);}assert.equal(task.state,'succeeded',JSON.stringify(task));}
 assert.equal((await f.request(f.a.token,'/api/captures/'+captures[1],'DELETE')).statusCode,200);
 const before=f.read(db=>({sequences:db.prepare('SELECT * FROM ig_capture_update_sequences ORDER BY user_id,device_id').all(),updates:db.prepare('SELECT * FROM ig_capture_updates ORDER BY user_id,device_id,sequence').all()}));assert.equal(before.sequences.length,1);assert.equal(before.sequences[0].next,2);assert.equal(before.updates.length,1);assert.equal(before.updates[0].sequence,1);
 await f.host.app.close();await backupScopedInstance({source:f.directory,out:snapshot});await restoreScopedInstance({from:snapshot,target});
 const restored=await buildApp({dataDir:target});try{const login=await restored.accounts!.login('generated-a','Generated-M13-archive-only-01','generated','client',0),response=await restored.app.inject({url:'/api/ingress/devices/same-device/updates?cursor=2&limit=1',headers:{authorization:'Bearer '+login.token,'x-mote-protocol-version':'2','x-mote-ingress-version':'3'}});assert.equal(response.statusCode,200,response.body);assert.deepEqual(response.json(),{items:[],nextCursor:2});const db=new DatabaseSync(join(target,'mote.sqlite'));try{assert.deepEqual({sequences:db.prepare('SELECT * FROM ig_capture_update_sequences ORDER BY user_id,device_id').all(),updates:db.prepare('SELECT * FROM ig_capture_updates ORDER BY user_id,device_id,sequence').all()},before);}finally{db.close();}}finally{await restored.app.close();}
 for(const [name,sql]of Object.entries({missingCounters:'DROP TABLE ig_capture_update_sequences',missingUpdates:'DROP TABLE ig_capture_updates',missingArtifactColumn:'ALTER TABLE ig_capture_updates RENAME COLUMN artifact_id TO generated_wrong_column',missingCounterRow:'DELETE FROM ig_capture_update_sequences',rewoundCounter:'UPDATE ig_capture_update_sequences SET next=0',negativeCounter:'UPDATE ig_capture_update_sequences SET next=-1'}))await t.test(name,async()=>{
  const archive=join(directory,name),rejected=join(directory,name+'-target');cpSync(snapshot,archive,{recursive:true});const db=new DatabaseSync(join(archive,'mote.sqlite'));db.exec(sql);db.close();const manifest=JSON.parse(readFileSync(join(archive,'backup-manifest.json'),'utf8'));manifest.checksums['mote.sqlite']=createHash('sha256').update(readFileSync(join(archive,'mote.sqlite'))).digest('hex');writeFileSync(join(archive,'backup-manifest.json'),JSON.stringify(manifest));await assert.rejects(restoreScopedInstance({from:archive,target:rejected}),undefined,name);assert.equal(existsSync(rejected),false,name);
 });
});
