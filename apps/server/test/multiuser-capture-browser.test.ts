import test, {type TestContext} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdtempSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {captureSessions} from '@mote/shared';
import sharp from 'sharp';
import {buildApp} from '../src/app.js';

const password='Generated-M13-archive-only-01';
const protocol={'x-mote-protocol-version':'2','x-mote-ingress-version':'3'};
const record=(at:number, appId='target', extra:Record<string,unknown>={})=>({id:randomUUID(),deviceId:'same-device',deviceName:'Generated device',platform:'import',source:'screen',capturedAt:new Date(Date.UTC(2026,8,13)+at).toISOString(),durationMs:0,appId,appName:appId,windowTitle:'Generated archive',ocrText:'GENERATED_A_ARCHIVE',ocr:{status:'completed'},privacy:{excluded:false,collection:'content'},...extra});
async function fixture(t:TestContext){
 const directory=mkdtempSync(join(tmpdir(),'mote-m13-browser-')),host=await buildApp({dataDir:directory});
 t.after(async()=>{await host.app.close();rmSync(directory,{recursive:true,force:true});});
 await host.accounts!.initialize('generated-admin',password);
 const request=(token:string|undefined,url:string,method:any='GET',payload?:unknown)=>host.app.inject({method,url,headers:{...protocol,...(token?{authorization:'Bearer '+token}:{})},...(payload===undefined?{}:{payload})});
 const login=async(username:string)=>{const r=await request(undefined,'/api/auth/login','POST',{username,password,mode:'client'});assert.equal(r.statusCode,200,r.body);return r.json();};
 const admin=await login('generated-admin');
 for(const username of ['generated-a','generated-b']){const r=await request(admin.token,'/api/admin/accounts','POST',{username,password});assert.equal(r.statusCode,200,r.body);}
 const a=await login('generated-a'),b=await login('generated-b');
 for(const account of [a,b]){const r=await request(account.token,'/api/ingress/sources','POST',{id:'same-source',name:'Generated archive',kind:'local-files',deviceId:'same-device',platform:'import',retention:'snapshot'});assert.equal(r.statusCode,200,r.body);}
 const receive=async(account:typeof a,items:unknown[])=>{const r=await request(account.token,'/api/ingress/sources/same-source/captures','POST',{batchId:randomUUID(),items});assert.equal(r.statusCode,200,r.body);return r.json();};
 return {host,a,b,admin,request,receive};
}

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
 const pending=f.request(f.a.token,path+'?thumbnail=1');await arrived;const disabled=await f.request(f.admin.token,'/api/admin/accounts/'+f.a.userId,'PATCH',{enabled:false});assert.equal(disabled.statusCode,200,disabled.body);release();const retired=await pending;assert.equal(retired.statusCode,401,retired.body);assert.match(retired.headers['content-type']??'',/application\/json/);assert.doesNotMatch(retired.body,/GENERATED_A_ARCHIVE/);
 assert.equal((await f.request(f.a.token,path)).statusCode,401);assert.deepEqual((await f.request(f.b.token,path)).rawPayload,bimage);
});
