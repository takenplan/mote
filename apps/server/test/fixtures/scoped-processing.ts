import type {TestContext} from 'node:test';
import assert from 'node:assert/strict';
import {createServer,type IncomingMessage,type ServerResponse} from 'node:http';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {setTimeout as delay} from 'node:timers/promises';
import {buildApp} from '../../src/app.js';
import {bytesHash} from '../../src/scope/originals.js';
import {defaultModelSettings} from '../../src/model-settings.js';
import {defaultProcessingSettings} from '../../src/scope/processing-schema.js';
import {generatedScopedPluginRelease} from './scoped-plugin-release.js';
import {LifecycleAuthority} from '../../src/scope/lifecycle.js';
import {openScopeStorage} from '../../src/scope/storage.js';
const password='Generated-processing-01',protocol={'x-mote-protocol-version':'2','x-mote-ingress-version':'3'};
export const deferred=()=>{let resolve!:()=>void;const promise=new Promise<void>(r=>resolve=r);return {promise,resolve};};
export async function until(check:()=>boolean,message:string|(()=>string)){const end=Date.now()+12000;while(!check()){if(Date.now()>end)assert.fail(typeof message==='function'?message():message);await delay(5);}}
export async function fixture(t:TestContext,automatic=false,release=generatedScopedPluginRelease(),beforeReady?:(host:Awaited<ReturnType<typeof buildApp>>)=>void){
 const directory=mkdtempSync(join(tmpdir(),'mote-m06-')),preflight=openScopeStorage(directory),deploymentId=preflight.deploymentId;preflight.close();const grants=new Map<string,any>(),lifecycleAuthority=new LifecycleAuthority(deploymentId,{verify:async grant=>grants.get(grant),isCurrent:context=>grants.has(context.operationId)});let node=await buildApp({dataDir:directory},{pluginReleaseTransport:release.transport,lifecycleAuthority});const nodes=[node];beforeReady?.(node);
 t.after(async()=>{for(const current of nodes.reverse())await current.app.close();rmSync(directory,{recursive:true,force:true});});
 const request=(token:string|undefined,url:string,method:any='GET',payload?:unknown)=>node.app.inject({url,method,headers:{...protocol,...(token?{authorization:'Bearer '+token}:{})},...(payload===undefined?{}:{payload})});
 const checked=async(token:string|undefined,url:string,method:any='GET',payload?:unknown)=>{const response=await request(token,url,method,payload);assert.equal(response.statusCode,200,response.body);return response.json();};
 await node.accounts!.initialize('generated-admin',password);const login=(username:string)=>checked(undefined,'/api/auth/login','POST',{username,password,mode:'client'}),admin=await login('generated-admin'),a=await checked(admin.token,'/api/admin/accounts','POST',{username:'generated-a',password}),b=await checked(admin.token,'/api/admin/accounts','POST',{username:'generated-b',password}),alice=await login('generated-a'),bob=await login('generated-b');
 const configure=async(token:string,domain:string,value:unknown)=>checked(token,'/api/configuration/'+domain,'PUT',{revision:(await checked(token,'/api/configuration')).revision,value});
 for(const token of [alice.token,bob.token]){await configure(token,'processing',{...defaultProcessingSettings(),automatic,understandingEnabled:false,audioProcessor:'audio.http'});await checked(token,'/api/ingress/sources','POST',{id:'same-source',name:'Generated source',kind:'local-files',deviceId:'same-device',platform:'import',retention:'archive'});}
 const upload=async(token:string,bytes:Buffer,mimeType='text/plain',externalId='same-file',revision='same-revision',previousRevision:string|null=null)=>{
  const value={previousRevision,sourceId:'same-source',item:{externalId,revision,observedAt:'2026-10-15T00:00:00Z',title:'Generated file',text:'',kind:'file',layer:'original',mimeType},sizeBytes:bytes.length,sha256:bytesHash(bytes),relativePath:'generated.bin'},upload=await checked(token,'/api/ingress/sources/same-source/uploads','POST',{batchId:externalId+':'+revision,revision:value});
  await checked(token,'/api/ingress/uploads/'+upload.id+'/parts/0','PUT',{bytes:bytes.toString('base64'),checksum:bytesHash(bytes)});return checked(token,'/api/ingress/uploads/'+upload.id+'/commit','POST',{});
 };
 const submit=(token:string,ref:string,id='same-operation')=>checked(token,'/api/processing','POST',{originalRef:ref,operationId:id});
 const task=(token:string,id:string)=>checked(token,'/api/tasks/'+id);
 const wait=async(token:string,id:string,state='succeeded')=>{const end=Date.now()+12000;for(;;){const value=await task(token,id);if(value.state===state)return value;if(['failed','blocked','cancelled','stale'].includes(value.state)&&value.state!==state)assert.fail(JSON.stringify(value));if(Date.now()>end)assert.fail(JSON.stringify(value));await delay(10);}};
 const status=(token:string,ref:string)=>checked(token,'/api/processing/originals/'+ref.slice(9));
 const models=async(token:string,url:string,key:string,model='same-model')=>configure(token,'models',{profiles:[{id:'same-profile',name:'Generated media',settings:{...defaultModelSettings(),provider:'custom',protocol:'mote-media',baseUrl:url,model,apiKey:key,reasoningEffort:'auto'}}],selections:{ocr:{kind:'personal',id:'same-profile'},asr:{kind:'personal',id:'same-profile'}}});
 const read=<T>(work:(db:DatabaseSync)=>T)=>{const db=new DatabaseSync(join(directory,'mote.sqlite'));try{return work(db);}finally{db.close();}};
 const restart=async()=>{await node.app.close();node=await buildApp({dataDir:directory},{pluginReleaseTransport:release.transport,lifecycleAuthority});nodes.push(node);beforeReady?.(node);};
 return {directory,release,deploymentId,grants,lifecycleAuthority,get node(){return node;},request,checked,admin,a,b,alice,bob,configure,upload,submit,task,wait,status,models,read,restart};
}
export async function media(t:TestContext,handle:(request:IncomingMessage,response:ServerResponse,bytes:Buffer)=>unknown|Promise<unknown>){const server=createServer((req,res)=>{void (async()=>{const parts:Buffer[]=[];for await(const part of req)parts.push(part);await handle(req,res,Buffer.concat(parts));})().catch(()=>res.destroy());});await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(()=>new Promise<void>(resolve=>server.close(()=>resolve())));const address=server.address();assert.ok(address&&typeof address!=='string');return 'http://127.0.0.1:'+address.port+'/transcribe';}
export const respond=(res:ServerResponse,text:string,durationMs=0)=>{res.setHeader('Content-Type','application/json');res.setHeader('X-Mote-Execution','local');res.end(JSON.stringify({durationMs,segments:[{startMs:0,endMs:durationMs,text}],coverage:'full',engine:'generated-http-fixture'}));};
