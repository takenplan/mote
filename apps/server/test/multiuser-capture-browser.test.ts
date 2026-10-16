import test from 'node:test';
import assert from 'node:assert/strict';
import {captureSessions} from '@mote/shared';
import sharp from 'sharp';
import {createServer} from 'node:http';
import {setTimeout as delay} from 'node:timers/promises';
import {defaultProcessingSettings} from '../src/scope/processing-schema.js';
import {defaultModelSettings} from '../src/model-settings.js';
import {captureBrowserRecord as record,scopedCaptureFixture as fixture} from './fixtures/scoped-capture-host.js';


test('original raw record filters run before LIMIT and signed pages stay bound to their owner and full query',async t=>{
 const f=await fixture(t),first=record(1000),second=record(2000),other=Array.from({length:70},(_,n)=>record(3000+n,'other'));
 await f.receive(f.a,[first,second,...other,record(5000,'target',{ocr:undefined}),record(6000,'target',{source:'activity',ocr:undefined,ocrText:'',windowTitle:'',privacy:{excluded:false,collection:'activity'}})]);
 await f.receive(f.b,[{...first,ocrText:'GENERATED_B_ARCHIVE'}]);
 const path='/api/capture-browser?source=screen&appId=target&collection=content&ocrStatus=completed&limit=1';
 const r=await f.request(f.a.token,path);assert.equal(r.statusCode,200,r.body);const page=r.json();
 assert.equal(page.totalCount,2);assert.equal(page.items.length,1);assert.equal(page.items[0].id,second.id);assert.equal(page.items[0].textPreview,'GENERATED_A_ARCHIVE');assert.ok(page.nextCursor);assert.equal(page.items[0].ocr.status,'completed');
 const cursor='&cursor='+encodeURIComponent(page.nextCursor),next=await f.request(f.a.token,path+cursor);assert.equal(next.statusCode,200,next.body);assert.deepEqual(next.json().items.map((r:any)=>r.id),[first.id]);assert.equal(next.json().nextCursor,null);
 assert.equal((await f.request(f.b.token,path+cursor)).statusCode,400);assert.equal((await f.request(f.a.token,path.replace('appId=target','appId=other')+cursor)).statusCode,400);
 const b=await f.request(f.b.token,path);assert.equal(b.json().totalCount,1);assert.match(b.body,/GENERATED_B_ARCHIVE/);assert.doesNotMatch(b.body,/GENERATED_A_ARCHIVE/);
 assert.equal((await f.request(undefined,path)).statusCode,401);
 for(const bad of ['limit=61','after=bad','cursor=bad','ocrStatus=guess','userId='+f.b.userId])assert.ok([400,401].includes((await f.request(f.a.token,'/api/capture-browser?'+bad)).statusCode));
});

test('original album and Session grouping preserve app returns, five-minute gaps, range and owner before paging',async t=>{
 const f=await fixture(t),rows=[['a',899000],['a',900000],['a',1200000],['a',1500001],['b',1500002],['a',1500003]].map(([app,ms])=>record(Number(ms),String(app)));
 await f.receive(f.a,rows);await f.receive(f.b,[{...rows[0],appName:'GENERATED_B_ARCHIVE'}]);
 const range='deviceId=same-device&after=2026-09-13T00:00:00Z&before=2026-09-14T00:00:00Z';
 const url='/api/capture-browser/sessions?'+range,r=await f.request(f.a.token,url);assert.equal(r.statusCode,200,r.body);const page=r.json(),expected=captureSessions(rows.map(r=>({...r,hasImage:false})));
 assert.equal(page.totalCount,6);assert.equal(page.sessionCount,4);assert.deepEqual(page.items,expected);
 const first=(await f.request(f.a.token,url+'&limit=2')).json(),next=await f.request(f.a.token,url+'&limit=2&cursor='+encodeURIComponent(first.nextCursor));assert.equal(next.statusCode,200,next.body);assert.deepEqual([...first.items,...next.json().items],expected);
 const members=await f.request(f.a.token,url+'&sessionId='+expected[3].id);assert.equal(members.statusCode,200,members.body);assert.deepEqual(members.json().items.map((r:any)=>r.id),rows.slice(0,3).reverse().map(r=>r.id));assert.doesNotMatch(members.body,/ocrText|textPreview|GENERATED_A_ARCHIVE/);
 assert.equal((await f.request(f.b.token,url+'&limit=2&cursor='+encodeURIComponent(first.nextCursor))).statusCode,400);
 const albums=await f.request(f.a.token,'/api/capture-browser/albums?'+range+'&limit=1');assert.equal(albums.statusCode,200,albums.body);assert.equal(albums.json().totalCount,6);assert.equal(albums.json().albumCount,3);
 const album=albums.json().items[0],images=await f.request(f.a.token,'/api/capture-browser/album-images?'+new URLSearchParams({deviceId:album.deviceId,appId:album.appId,after:album.after,before:album.before}));assert.equal(images.statusCode,200,images.body);assert.equal(images.json().totalCount,album.count);assert.doesNotMatch(images.body,/ocrText|textPreview/);
 assert.equal((await f.request(f.a.token,'/api/capture-browser/album-images?'+range)).statusCode,400);
});

test('original image and thumbnail read M03 bytes for the captured account and recheck authority after image work',async t=>{
 const f=await fixture(t),image=await sharp({create:{width:800,height:600,channels:3,background:'#234567'}}).png().toBuffer(),bimage=await sharp({create:{width:800,height:600,channels:3,background:'#ab2310'}}).png().toBuffer(),input=record(1000,'same-app',{imageBase64:image.toString('base64'),imageMime:'image/png'});
 await f.receive(f.a,[input]);await f.receive(f.b,[{...input,ocrText:'GENERATED_B_ARCHIVE',imageBase64:bimage.toString('base64')}]);
 const detail=await f.request(f.a.token,'/api/capture-browser/'+input.id);assert.equal(detail.statusCode,200,detail.body);assert.equal(detail.json().ocrText,'GENERATED_A_ARCHIVE');
 const path='/api/capture-browser/'+input.id+'/image',full=await f.request(f.a.token,path);assert.equal(full.statusCode,200,full.body);assert.deepEqual(full.rawPayload,image);assert.equal(full.headers['content-type'],'image/png');assert.equal(full.headers['cache-control'],'no-store');assert.deepEqual((await f.request(f.b.token,path)).rawPayload,bimage);assert.equal((await f.request(f.admin.token,path)).statusCode,404);
 const thumbnail=await f.request(f.a.token,path+'?thumbnail=1');assert.equal(thumbnail.statusCode,200,thumbnail.body);const meta=await sharp(thumbnail.rawPayload).metadata();assert.equal(meta.format,'jpeg');assert.ok(meta.width!<=480&&meta.height!<=480);
 assert.equal((await f.request(f.a.token,path+'?deviceId=another-device')).statusCode,404);assert.equal((await f.request(f.a.token,path+'?source=note')).statusCode,404);
 let entered!:()=>void,release!:()=>void;const arrived=new Promise<void>(r=>entered=r),gate=new Promise<void>(r=>release=r),original=sharp.prototype.toBuffer;
 t.mock.method(sharp.prototype,'toBuffer',async function(this:sharp.Sharp,...args:any[]){const bytes=await original.apply(this,args as any);entered();await gate;return bytes;});t.after(()=>release());
 const pending=f.request(f.a.token,path+'?thumbnail=1');await arrived;const disabled=await f.request(f.admin.token,'/api/admin/accounts/'+f.a.userId,'PATCH',{disabled:true});assert.equal(disabled.statusCode,200,disabled.body);release();const retired=await pending;assert.equal(retired.statusCode,401,retired.body);assert.match(retired.headers['content-type']??'',/application\/json/);assert.doesNotMatch(retired.body,/GENERATED_A_ARCHIVE/);
 assert.equal((await f.request(f.a.token,path)).statusCode,401);assert.deepEqual((await f.request(f.b.token,path)).rawPayload,bimage);
});

test('an awaited old thumbnail cannot survive delete and same-ID recreation with a different original',async t=>{
 const f=await fixture(t),image=await sharp({create:{width:24,height:24,channels:3,background:'#234567'}}).png().toBuffer(),replacement=await sharp({create:{width:24,height:24,channels:3,background:'#abcdef'}}).png().toBuffer(),input=record(1000,'same-app',{imageBase64:image.toString('base64'),imageMime:'image/png'});
 await f.receive(f.a,[input]);await f.receive(f.b,[input]);let entered!:()=>void,release!:()=>void;const arrived=new Promise<void>(r=>entered=r),gate=new Promise<void>(r=>release=r),original=sharp.prototype.toBuffer;
 t.mock.method(sharp.prototype,'toBuffer',async function(this:sharp.Sharp,...args:any[]){const bytes=await original.apply(this,args as any);entered();await gate;return bytes;});t.after(()=>release());
 const path='/api/capture-browser/'+input.id+'/image',pending=f.request(f.a.token,path+'?thumbnail=1');await arrived;
 const deleted=await f.request(f.a.token,'/api/captures/'+input.id,'DELETE');assert.equal(deleted.statusCode,200,deleted.body);await f.receive(f.a,[{...input,imageBase64:replacement.toString('base64')}]);release();const retired=await pending;assert.equal(retired.statusCode,409,retired.body);assert.match(retired.headers['content-type']??'',/application\/json/);
 assert.deepEqual((await f.request(f.a.token,path)).rawPayload,replacement);assert.deepEqual((await f.request(f.b.token,path)).rawPayload,image);
});

test('an awaited thumbnail loses its snapshot bytes grant when M03 releases that original',async t=>{
 const f=await fixture(t),image=await sharp({create:{width:24,height:24,channels:3,background:'#234567'}}).png().toBuffer(),input=record(1000,'same-app',{imageBase64:image.toString('base64'),imageMime:'image/png'}),receipt=await f.receive(f.a,[input]);
 let entered!:()=>void,release!:()=>void;const arrived=new Promise<void>(r=>entered=r),gate=new Promise<void>(r=>release=r),original=sharp.prototype.toBuffer;
 t.mock.method(sharp.prototype,'toBuffer',async function(this:sharp.Sharp,...args:any[]){const bytes=await original.apply(this,args as any);entered();await gate;return bytes;});t.after(()=>release());
 const path='/api/capture-browser/'+input.id+'/image',pending=f.request(f.a.token,path+'?thumbnail=1');await arrived;f.host.ingress.forUser(await f.host.authority.authenticate(f.a.token)).releaseSnapshot(receipt.captures[0].original.ref);release();const retired=await pending;assert.equal(retired.statusCode,410,retired.body);assert.match(retired.headers['content-type']??'',/application\/json/);assert.equal((await f.request(f.a.token,path)).statusCode,410);
});

test('central OCR publication reaches the original raw detail, before-LIMIT status filter and device update reader without changing intake bytes',async t=>{
 const server=createServer(async(req,res)=>{for await(const _part of req){}res.setHeader('Content-Type','application/json');res.setHeader('X-Mote-Execution','local');res.end(JSON.stringify({durationMs:0,segments:[{startMs:0,endMs:0,text:'GENERATED_A_CENTRAL_OCR'}],coverage:'full',engine:'generated-http-fixture'}));});await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(()=>new Promise<void>(resolve=>server.close(()=>resolve())));const address=server.address();assert.ok(address&&typeof address!=='string');
 const f=await fixture(t),configure=async(domain:string,value:unknown)=>{const revision=(await f.request(f.a.token,'/api/configuration')).json().revision,r=await f.request(f.a.token,'/api/configuration/'+domain,'PUT',{revision,value});assert.equal(r.statusCode,200,r.body);};
 await configure('processing',{...defaultProcessingSettings(),automatic:false,understandingEnabled:false,summarize:false});await configure('models',{profiles:[{id:'generated-ocr',name:'Generated OCR',settings:{...defaultModelSettings(),provider:'custom',protocol:'mote-media',baseUrl:'http://127.0.0.1:'+address.port+'/transcribe',model:'generated-ocr',apiKey:'GENERATED_A_KEY'}}],selections:{ocr:{kind:'personal',id:'generated-ocr'}}});
 const image=await sharp({create:{width:24,height:24,channels:3,background:'#234567'}}).png().toBuffer(),input=record(1000,'same-app',{ocrText:'',ocr:{status:'disabled'},imageBase64:image.toString('base64'),imageMime:'image/png'}),receipt=await f.receive(f.a,[input]);await f.receive(f.b,[input]);
 const admission=await f.request(f.a.token,'/api/processing','POST',{originalRef:receipt.captures[0].original.ref,operationId:'generated-central-ocr'});assert.equal(admission.statusCode,200,admission.body);
 let task:any;for(let n=0;n<1200;n++){task=(await f.request(f.a.token,'/api/tasks/'+admission.json().id)).json();if(task.state==='succeeded')break;assert.ok(!['failed','stale','cancelled','blocked'].includes(task.state),JSON.stringify(task));await delay(10);}assert.equal(task.state,'succeeded',JSON.stringify(task));
 const filtered=await f.request(f.a.token,'/api/capture-browser?ocrStatus=completed&limit=1');assert.equal(filtered.statusCode,200,filtered.body);assert.equal(filtered.json().totalCount,1,'actual M06 extraction status is filtered before pagination');assert.equal(filtered.json().items[0].ocr.status,'completed');assert.match(filtered.json().items[0].textPreview,/GENERATED_A_CENTRAL_OCR/);
 const detail=await f.request(f.a.token,'/api/capture-browser/'+input.id);assert.equal(detail.statusCode,200,detail.body);assert.match(detail.json().ocrText,/GENERATED_A_CENTRAL_OCR/);assert.equal((await f.request(f.a.token,'/api/captures/'+input.id)).json().ocrText,'','the canonical intake is unchanged');
 const path='/api/capture-browser/updates?deviceId=same-device&cursor=0&limit=1',updates=await f.request(f.a.token,path);assert.equal(updates.statusCode,200,updates.body);assert.equal(updates.json().items.length,1);assert.match(updates.body,/GENERATED_A_CENTRAL_OCR/);assert.ok(updates.json().nextCursor>0);const next=await f.request(f.a.token,path.replace('cursor=0','cursor='+updates.json().nextCursor));assert.equal(next.json().items.length,0);assert.equal(next.json().nextCursor,updates.json().nextCursor);
 assert.doesNotMatch((await f.request(f.b.token,path)).body,/GENERATED_A_CENTRAL_OCR/);assert.equal((await f.request(f.b.token,'/api/capture-browser?ocrStatus=completed')).json().totalCount,0);
 const device=await f.request(f.a.token,'/api/login/session','POST',{serverUrl:'https://fixture.invalid',deviceId:'same-device',deviceName:'Generated native',platform:'other'});assert.equal(device.statusCode,200,device.body);const native=device.json();
 assert.equal((await f.request(native.token,path)).statusCode,403,'device credentials remain barred from private archive routes');const nativePath='/api/ingress/devices/same-device/updates?cursor=0&limit=1',own=await f.request(native.token,nativePath);assert.equal(own.statusCode,200,own.body);assert.match(own.body,/GENERATED_A_CENTRAL_OCR/);assert.equal((await f.request(native.token,nativePath.replace('same-device','other-device'))).statusCode,403);
 await f.restart();const restored=await f.request(f.a.token,path.replace('cursor=0','cursor='+updates.json().nextCursor));assert.equal(restored.statusCode,200,restored.body);assert.deepEqual(restored.json(),next.json(),'numeric per-device cursor survives a real host restart');
 assert.equal((await f.request(f.a.token,path.replace('cursor=0','cursor=9007199254740991'))).statusCode,409,'a future cursor must request resync instead of silently suppressing future records');assert.deepEqual((await f.request(f.a.token,path.replace('same-device','other-device'))).json(),{items:[],nextCursor:0});
 f.read(db=>db.prepare('DELETE FROM ig_capture_updates WHERE user_id=?').run(f.a.userId));const rebuilt=await f.request(f.a.token,path.replace('cursor=0','cursor='+updates.json().nextCursor));assert.equal(rebuilt.statusCode,200,rebuilt.body);assert.match(rebuilt.body,/GENERATED_A_CENTRAL_OCR/,'a derived projection gap is rebuilt from current canonical M06 extraction without re-admission');assert.ok(rebuilt.json().nextCursor>updates.json().nextCursor);
 assert.equal((await f.request(f.a.token,'/api/connections/'+native.credentialId,'DELETE')).statusCode,200);assert.equal((await f.request(native.token,nativePath)).statusCode,401);
});
