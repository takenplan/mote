/** Shared real host fixture for cross-await query regressions; no MCP server substitute. */
import type {TestContext} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {buildApp} from '../../src/app.js';
import type {PluginReleaseTransport} from '../../src/plugin-release.js';

export const password='Generated-M11-account-password-01',protocol={'x-mote-protocol-version':'2','x-mote-ingress-version':'3'},source=(id='same-source')=>({id,name:'Generated '+id,kind:'mcp',deviceId:'same-device',platform:'import',retention:'snapshot'}),item=(text:string,externalId='same-item',revision='same-revision')=>({externalId,revision,observedAt:'2026-10-16T00:00:00Z',kind:'message',layer:'snapshot',title:'Generated',text});
export const deferred=()=>{let resolve!:()=>void;return {promise:new Promise<void>(r=>resolve=r),resolve};};
export async function fixture(t:TestContext,allowLocal=true,options:{pluginReleaseTransport?:PluginReleaseTransport}={}){
 const root=mkdtempSync(join(tmpdir(),'mote-m11-')),cleanup:Array<()=>void>=[];let node=await buildApp({dataDir:root},options);
 t.after(async()=>{for(const callback of cleanup)callback();await node.app.close();rmSync(root,{recursive:true,force:true});});
 const request=(token:string|undefined,url:string,method:any='GET',payload?:unknown,extra:Record<string,string>={})=>node.app.inject({url,method,headers:{...protocol,...(token?{authorization:'Bearer '+token}:{}),...extra},...(payload===undefined?{}:{payload})});
 const ok=async(token:string|undefined,url:string,method:any='GET',payload?:unknown)=>{const response=await request(token,url,method,payload);assert.equal(response.statusCode,200,response.body);return response.json();};
 await node.accounts.initialize('generated-admin',password);const admin=await ok(undefined,'/api/auth/login','POST',{username:'generated-admin',password,mode:'client'}),users=[];
 for(const label of ['a','b']){const user=await ok(admin.token,'/api/admin/accounts','POST',{username:'generated-'+label,password});const login=await ok(undefined,'/api/auth/login','POST',{username:user.username,password,mode:'client'});users.push({...user,...login});await ok(login.token,'/api/ingress/sources','POST',source());await ok(login.token,'/api/ingress/sources','POST',source('other-source'));}
 const [a,b]=users;
 const put=async(token:string,text:string,id='same-item',sourceId='same-source')=>ok(token,'/api/ingress/sources/'+sourceId+'/items','POST',{batchId:'batch-'+id,items:[item(text,id)]});
 const restart=async()=>{await node.app.close();node=await buildApp({dataDir:root},options);};
 return {get node(){return node;},beforeClose:(callback:()=>void)=>cleanup.push(callback),root,a,b,admin,request,ok,put,restart};
}
