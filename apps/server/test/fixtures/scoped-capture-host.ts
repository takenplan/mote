import assert from 'node:assert/strict';
import type {TestContext} from 'node:test';
import {randomUUID} from 'node:crypto';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {buildApp} from '../../src/app.js';

const password='Generated-M13-archive-only-01';
const protocol={'x-mote-protocol-version':'2','x-mote-ingress-version':'3'};
export const captureBrowserRecord=(at:number, appId='target', extra:Record<string,unknown>={})=>({id:randomUUID(),deviceId:'same-device',deviceName:'Generated device',platform:'import',source:'screen',capturedAt:new Date(Date.UTC(2026,8,13)+at).toISOString(),durationMs:0,appId,appName:appId,windowTitle:'Generated archive',ocrText:'GENERATED_A_ARCHIVE',ocr:{status:'completed'},privacy:{excluded:false,collection:'content'},...extra});
export async function scopedCaptureFixture(t:TestContext,options?:Parameters<typeof buildApp>[1]){
 const directory=mkdtempSync(join(tmpdir(),'mote-m13-browser-'));let host=await buildApp({dataDir:directory},options);
 t.after(async()=>{await host.app.close();rmSync(directory,{recursive:true,force:true});});
 await host.accounts!.initialize('generated-admin',password);
 const request=(token:string|undefined,url:string,method:any='GET',payload?:unknown)=>host.app.inject({method,url,headers:{...protocol,...(token?{authorization:'Bearer '+token}:{})},...(payload===undefined?{}:{payload})});
 const login=async(username:string)=>{const r=await request(undefined,'/api/auth/login','POST',{username,password,mode:'client'});assert.equal(r.statusCode,200,r.body);return r.json();};
 const admin=await login('generated-admin');
 for(const username of ['generated-a','generated-b']){const r=await request(admin.token,'/api/admin/accounts','POST',{username,password});assert.equal(r.statusCode,200,r.body);}
 const a=await login('generated-a'),b=await login('generated-b');
 for(const account of [a,b]){const r=await request(account.token,'/api/ingress/sources','POST',{id:'same-source',name:'Generated archive',kind:'local-files',deviceId:'same-device',platform:'import',retention:'snapshot'});assert.equal(r.statusCode,200,r.body);}
 const receive=async(account:typeof a,items:unknown[])=>{const r=await request(account.token,'/api/ingress/sources/same-source/captures','POST',{batchId:randomUUID(),items});assert.equal(r.statusCode,200,r.body);return r.json();};
 const restart=async()=>{await host.app.close();host=await buildApp({dataDir:directory},options);};
 const read=<T>(work:(db:DatabaseSync)=>T)=>{const db=new DatabaseSync(join(directory,'mote.sqlite'));try{return work(db);}finally{db.close();}};
 return {get host(){return host;},directory,a,b,admin,request,receive,restart,read};
}

