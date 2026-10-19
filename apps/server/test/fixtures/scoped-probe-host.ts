import type {TestContext} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {setTimeout as delay} from 'node:timers/promises';
import {buildApp} from '../../src/app.js';
import type {PluginCapabilityProbe} from '../../src/scope/plugin-contract.js';
import {generatedScopedPluginRelease} from './scoped-plugin-release.js';
import {backupScopedInstance,restoreScopedInstance} from '../../../../scripts/scoped-backup.mjs';

export const probeDeferred=()=>{let resolve!:()=>void;const promise=new Promise<void>(r=>resolve=r);return {promise,resolve};};
export async function probeUntil(check:()=>boolean|Promise<boolean>,detail:()=>unknown){const end=Date.now()+10000;while(!await check()){assert.ok(Date.now()<end,JSON.stringify(detail()));await delay(5);}}
/** Real composition: catalog installer, scoped Memory, Extensions and restore
 * coordinator all register normally. Only generated capability IO is held. */
export async function scopedProbeHost(t:TestContext,probe:PluginCapabilityProbe){
 const root=mkdtempSync(join(tmpdir(),'mote-probe-consumer-')),source=join(root,'source');let directory=source;
 const releases=[generatedScopedPluginRelease('31'),generatedScopedPluginRelease('32')],cleanup:Array<()=>void>=[];
 const transport:typeof releases[0]['transport']=async url=>{for(const release of releases)try{return await release.transport(url);}catch(error){if(!String(error).includes('Network forbidden'))throw error;}throw Error('Only generated fixture release bytes are allowed');};
 const open=async()=>{const host=await buildApp({dataDir:directory},{pluginReleaseTransport:transport});host.plugins!.registerCapabilityProbe(['model'],probe);return host;};
 let host=await open();t.after(async()=>{for(const release of cleanup)release();await host.app.close();rmSync(root,{recursive:true,force:true});});
 const headers={'x-mote-protocol-version':'2','x-mote-ingress-version':'3'},password='Generated-probe-consumer-01';
 const request=(token:string|undefined,url:string,method:any='GET',payload?:unknown)=>host.app.inject({url,method,headers:{...headers,...(token?{authorization:'Bearer '+token}:{})},...(payload===undefined?{}:{payload})});
 const ok=async(...args:Parameters<typeof request>)=>{const response=await request(...args);assert.equal(response.statusCode,200,response.body);return response.json();};
 const login=(username:string)=>ok(undefined,'/api/auth/login','POST',{username,password,mode:'client'});
 await host.accounts!.initialize('generated-admin',password);let admin=await login('generated-admin');const owners:any[]=[];
 for(const label of ['a','b']){await ok(admin.token,'/api/admin/accounts','POST',{username:'generated-'+label,password});owners.push(await login('generated-'+label));}
 const [a,b]=owners;
 const read=<T>(work:(db:DatabaseSync)=>T)=>{const db=new DatabaseSync(join(directory,'mote.sqlite'));try{return work(db);}finally{db.close();}};
 const view=(user:any)=>ok(user.token,'/api/plugins');
 const configure=async(user:any,packageId:string,id:string,label=id)=>{const current=await view(user);await ok(user.token,'/api/plugin-instances','POST',{expectedRevision:current.revision,instance:{id,packageId,name:'Generated probe '+id,configuration:{label},desired:false,grants:{capabilities:['model'],sourceIds:[],history:false}}});};
 const check=(user:any,id:string)=>ok(user.token,'/api/plugin-instances/'+id+'/check','POST',{});
 const task=(user:any,id:string)=>ok(user.token,'/api/tasks/'+id);
 const succeeded=async(user:any,id:string)=>{await probeUntil(async()=>{const value=await task(user,id);assert.ok(!['failed','blocked','stale','cancelled'].includes(value.state),JSON.stringify(value));return value.state==='succeeded';},()=>read(db=>db.prepare('SELECT id,kind,state,error FROM execution_steps WHERE id=?').get(id)));return task(user,id);};
 const enable=async(user:any,id:string)=>{const current=await view(user);return ok(user.token,'/api/plugin-instances/'+id+'/enable','POST',{expectedRevision:current.revision});};
 const startInstall=async(index=0)=>{const release=releases[index],preview=await ok(admin.token,'/api/plugins/resolve','POST',{repository:release.repository,tag:release.tag}),current=await ok(admin.token,'/api/admin/plugins'),operationId=randomUUID(),value=await ok(admin.token,'/api/plugins/install','POST',{previewId:preview.id,expectedRevision:current.revision,operationId}),pkg=value.packages.find((p:any)=>p.version===release.manifest.version);assert.ok(pkg);return {id:pkg.id as string,taskId:'plugin-install:'+operationId};};
 const installed=async(index=0)=>{const value=await startInstall(index);await probeUntil(()=>host.plugins!.catalog.view().packages.some(p=>p.id===value.id&&p.state==='installed'),()=>host.plugins!.catalog.view());return value.id;};
 const capacity=async(agentConcurrency:number)=>{const {revision,interactiveConcurrency,llmConcurrency,memoryConcurrency}=await ok(admin.token,'/api/admin/execution-settings');return ok(admin.token,'/api/admin/execution-settings','PUT',{revision,agentConcurrency,interactiveConcurrency,llmConcurrency,memoryConcurrency});};
 const quietTurn=async()=>{for(let i=0;i<3;i++){void host.execution!.tick().catch(()=>{});await delay(0);}};
 return {a,b,get admin(){return admin;},get host(){return host;},get directory(){return directory;},read,ok,request,login,view,configure,check,task,succeeded,enable,startInstall,installed,capacity,quietTurn,beforeClose:(close:()=>void)=>cleanup.push(close),hold(){const gate=probeDeferred();cleanup.push(gate.resolve);return gate;},async restore(){await host.app.close();const backup=join(root,'backup');await backupScopedInstance({source,out:backup});directory=join(root,'target');await restoreScopedInstance({from:backup,target:directory});host=await open();admin=await login('generated-admin');},async restart(){await host.app.close();host=await open();admin=await login('generated-admin');}};
}
