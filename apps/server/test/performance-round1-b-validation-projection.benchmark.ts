import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {DatabaseSync,StatementSync} from 'node:sqlite';
import {setTimeout as delay} from 'node:timers/promises';
import {buildApp} from '../src/app.js';
import {EXECUTION_POLICIES} from '../src/execution-policy.js';
import type {TaskExecution,TaskRun} from '../src/scope/task-execution.js';

const password='Generated-projection-password-01';
const protocol={'x-mote-protocol-version':'2'};
const deferred=()=>{let resolve!:()=>void;const promise=new Promise<void>(done=>resolve=done);return {promise,resolve};};
export async function projectionHarness(sizes=[1024],validate?:()=>boolean){
 const directory=mkdtempSync(join(tmpdir(),'mote-b-live-projection-'));
 const release=deferred();let cleanup=async()=>{rmSync(directory,{recursive:true,force:true});};
 try{
 const node=await buildApp({dataDir:directory}) as Awaited<ReturnType<typeof buildApp>>&{execution:TaskExecution};
 cleanup=async()=>{release.resolve();try{await node.app.close();}finally{rmSync(directory,{recursive:true,force:true});}};
 const db=new DatabaseSync(join(directory,'mote.sqlite'));
 cleanup=async()=>{release.resolve();try{await node.app.close();}finally{try{db.close();}finally{rmSync(directory,{recursive:true,force:true});}}};
 db.exec('PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000');
 const runs=new Map<string,TaskRun>();let commits=0;
 node.execution.register({kind:'generated.projection',pool:'generated-projection',concurrency:()=>sizes.length*2,policy:EXECUTION_POLICIES.deterministic,
  parseInput:input=>{assert.ok(input&&typeof input==='object');const value=input as Record<string,unknown>;assert.equal(typeof value.payload,'string');return value;},
  validate:()=>validate?.()??true,
  execute:async run=>{runs.set(String(run.task.input.label),run);await release.promise;return {done:true};},commit:()=>{commits++;}});
 await node.accounts!.initialize('generated-admin',password);
 const request=(token:string|undefined,url:string,method:any='GET',payload?:unknown)=>node.app.inject({method,url,headers:{...protocol,...(token?{authorization:'Bearer '+token}:{})},...(payload===undefined?{}:{payload})});
 const login=async(username:string,mode='client')=>{const response=await request(undefined,'/api/auth/login','POST',{username,password,mode,durationMs:86400000});assert.equal(response.statusCode,200,response.body);return response.json();};
 const admin=await login('generated-admin'),owners:{userId:string;token:string;username:string}[]=[];
 for(const username of ['generated-a','generated-b']){const created=await request(admin.token,'/api/admin/accounts','POST',{username,password,administrator:false});assert.equal(created.statusCode,200,created.body);owners.push({...created.json(),...await login(username)});}
 await node.app.ready();
 for(const [ownerIndex,owner] of owners.entries())for(const size of sizes){const label=ownerIndex+':'+size;const response=await request(owner.token,'/api/tasks','POST',{kind:'generated.projection',operationId:'generated:'+label,input:{label,payload:'x'.repeat(size)}});assert.equal(response.statusCode,200,response.body);}
 const deadline=Date.now()+8000;while(runs.size<sizes.length*2){if(Date.now()>deadline)assert.fail('real admitted projection tasks did not enter their held handlers');await delay(5);}
 for(const run of runs.values()){assert.equal(run.task.state,'running');assert.ok(node.execution.engine.isCurrentInputGrant(run.task.id,run.context.credentialId.split(':')[1]));node.authority.assert(run.context);}
 return {node,db,directory,runs,owners,admin,request,login,release,commits:()=>commits,
  close:cleanup};
 }catch(error){try{await cleanup();}catch{console.error('generated_projection_setup_cleanup_failed');}throw error;}
}

type Query={count:number;returnedBytes:number;columns:string[][]};
export function observeGets(){
 const descriptor=Object.getOwnPropertyDescriptor(StatementSync.prototype,'get')!,get=descriptor.value,queries=new Map<string,Query>();
 Object.defineProperty(StatementSync.prototype,'get',{...descriptor,value:function(this:StatementSync,...args:unknown[]){
  const value=get.apply(this,args),sql=this.sourceSQL.replace(/\s+/g,' ').trim();
  const entry=queries.get(sql)??{count:0,returnedBytes:0,columns:[]};entry.count++;
  if(value!==undefined){entry.returnedBytes+=Buffer.byteLength(JSON.stringify(value));const keys=Object.keys(value).sort();if(!entry.columns.some(prior=>JSON.stringify(prior)===JSON.stringify(keys)))entry.columns.push(keys);}
  queries.set(sql,entry);return value;
 }});
 return {queries,restore:()=>Object.defineProperty(StatementSync.prototype,'get',descriptor)};
}

async function benchmark(){
 const phase=process.argv[process.argv.indexOf('--phase')+1];assert.ok(['baseline','candidate'].includes(phase));
 const f=await projectionHarness([1024,32768,262144]),measurements:unknown[]=[];
 try{
  for(let round=0;round<3;round++)for(const [label,run] of f.runs){
   const validate=()=>f.node.authority.assert(run.context);
   for(let i=0;i<20;i++)validate();
   for(const instrumented of [false,true]){
    const observer=instrumented?observeGets():undefined,cpu=process.cpuUsage(),rss=process.memoryUsage().rss,start=performance.now();
    try{for(let i=0;i<200;i++)validate();}finally{observer?.restore();}
    const elapsedMs=performance.now()-start,cpuUsed=process.cpuUsage(cpu);
    measurements.push({round,label,inputBytes:Buffer.byteLength(String(run.task.input.payload)),iterations:200,instrumented,allowed:200,elapsedMs,cpuMicroseconds:cpuUsed,rssBefore:rss,rssAfter:process.memoryUsage().rss,
     ...(observer?{queries:[...observer.queries].map(([sql,counts])=>({sql,...counts}))}:{})});
   }
  }
  const [a,b]=[f.runs.get('0:1024')!,f.runs.get('1:1024')!];
  f.db.prepare('UPDATE task_authorizations SET revoked=1 WHERE task_id=?').run(a.task.id);
  assert.throws(()=>f.node.authority.assert(a.context),{code:'invalid_identity'});f.node.authority.assert(b.context);
  console.log(JSON.stringify({schemaVersion:1,phase,fixture:'production buildApp, public HTTP account/task admission, held real handlers, UserContextAuthority.assert to live engine validators',owners:2,inputBytes:[1024,32768,262144],warmup:20,iterationsPerOwnerAndSize:200,rounds:3,outcomes:{allowed:7200,revokedOwnerDenied:true,otherOwnerAllowed:true},measurements}));
 }finally{await f.close();}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)await benchmark();
