/** Independent baseline probes. Generated releases are disclosed test transport;
 * production app, HTTP, storage, authorization, installation and workers run normally. */
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,existsSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawn,execFileSync} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {setTimeout as delay} from 'node:timers/promises';
import {fileURLToPath} from 'node:url';
import {buildScopedApp} from '../../src/scope/app.js';
import {configFromFile} from '../../src/config.js';
import {serializeConfigDocument} from '../../../../packages/shared/dist/config-file.js';
import {generatedScopedPluginRelease} from './scoped-plugin-release.js';

const repo=fileURLToPath(new URL('../../../../',import.meta.url));
const results:any[]=[];
const password='Generated-evaluator-only-password-2026';
const protocol={'x-mote-protocol-version':'2','x-mote-ingress-version':'3'};
function client(base:string){
  const request=async(token:string|undefined,path:string,method='GET',body?:unknown)=>{
    const response=await fetch(base+path,{method,headers:{...protocol,...(token?{authorization:'Bearer '+token}:{}),...(body===undefined?{}:{'content-type':'application/json'})},...(body===undefined?{}:{body:JSON.stringify(body)})});
    return {status:response.status,body:await response.json() as any};
  };
  const checked=async(...args:Parameters<typeof request>)=>{const r=await request(...args);assert.equal(r.status,200,args[1]+': '+JSON.stringify(r.body));return r.body;};
  return {request,checked};
}
async function until(check:()=>boolean|Promise<boolean>,timeout=15000){const end=Date.now()+timeout;while(!await check()){assert.ok(Date.now()<end,'probe deadline');await delay(10);}}

async function entrypointModuleProbe(){
  const root=mkdtempSync(join(tmpdir(),'mote-eval-entry-')),configFile=join(root,'mote.yaml'),marker=join(root,'loaded.json'),moduleFile=join(root,'plugin.mjs');
  writeFileSync(moduleFile,"import {writeFileSync} from 'node:fs'; writeFileSync("+JSON.stringify(marker)+",JSON.stringify({loaded:true})); export function apply() {}\n");
  writeFileSync(configFile,serializeConfigDocument({version:1,revision:0,storage:{dataDir:join(root,'vault')},server:{host:'127.0.0.1',port:0},plugins:{backendModules:[moduleFile],fileProcessorModules:[moduleFile]}}));
  const config=configFromFile(configFile,{initializeCredentials:false});
  assert.deepEqual(config.backendPluginModules,[moduleFile]);assert.deepEqual(config.fileProcessorModules,[moduleFile]);
  const env={...process.env,MOTE_CONFIG_FILE:configFile};
  execFileSync(process.execPath,['--import','tsx',join(repo,'apps/server/src/scope/initialize-admin.ts')],{cwd:repo,env,input:JSON.stringify({username:'eval-admin',password}),stdio:['pipe','pipe','pipe'],timeout:15000});
  const child=spawn(process.execPath,['--import','tsx',join(repo,'apps/server/src/index.ts')],{cwd:repo,env,stdio:['ignore','pipe','pipe']});
  const closed=new Promise<{code:number|null,signal:string|null}>(resolve=>child.once('close',(code,signal)=>resolve({code,signal})));let output='',errors='';child.stderr.on('data',part=>errors+=String(part));
  try{
    const base=await new Promise<string>((resolve,reject)=>{
      const timer=setTimeout(()=>reject(Error('entrypoint startup timeout '+errors)),15000);
      child.once('exit',code=>{clearTimeout(timer);reject(Error('entrypoint startup exit '+code+' '+errors));});
      child.stdout.on('data',part=>{output+=String(part);for(const line of output.split('\n'))try{const value=JSON.parse(line);if(value.event==='server.listening'){clearTimeout(timer);resolve('http://127.0.0.1:'+value.port);}}catch{}});
    });
    const {checked}=client(base),health=await checked(undefined,'/api/health');
    const admin=await checked(undefined,'/api/auth/login','POST',{username:'eval-admin',password,mode:'client'});
    const catalog=await checked(admin.token,'/api/plugins');
    assert.equal(health.mode,'multiuser-auth');assert.equal(existsSync(marker),false);
    child.kill('SIGTERM');const exit=await closed;assert.equal(exit.code,0);
    results.push({probe:'actual-index-ignores-declared-module-config',status:'FAIL',severity:'S1',environment:'real index.ts subprocess and HTTP; generated module, no model',health:health.mode,configAccepted:{backendModules:config.backendPluginModules.length,fileProcessorModules:config.fileProcessorModules.length},moduleLoaded:existsSync(marker),installedPackages:catalog.packages.length,cleanExit:exit.code,meaning:'The supported configuration parser accepts module lists but the production entrypoint does not load them.'});
  }finally{if(child.exitCode===null&&child.signalCode===null){child.kill('SIGKILL');await closed;}rmSync(root,{recursive:true,force:true});}
}

async function noHostAdapterProbe(){
  const root=mkdtempSync(join(tmpdir(),'mote-eval-worker-'));
  const compatible=generatedScopedPluginRelease('801');
  const native=generatedScopedPluginRelease('802','export function apply(ctx) { ctx.effect(() => () => {}); }\n');
  const transport=async(url:string)=>{for(const release of [compatible,native])try{return await release.transport(url);}catch(error){if(!String(error).includes('Network forbidden'))throw error;}throw Error('Generated release URL not provided');};
  const host=await buildScopedApp({dataDir:root},{pluginReleaseTransport:transport});
  try{
    await host.accounts!.initialize('eval-admin',password);await host.app.listen({host:'127.0.0.1',port:0});
    const address=host.app.server.address();assert.ok(address&&typeof address!=='string');const {request,checked}=client('http://127.0.0.1:'+address.port);
    const admin=await checked(undefined,'/api/auth/login','POST',{username:'eval-admin',password,mode:'client'});
    const install=async(release:typeof compatible)=>{const preview=await checked(admin.token,'/api/plugins/resolve','POST',{repository:release.repository,tag:release.tag}),catalog=await checked(admin.token,'/api/admin/plugins');const installed=await checked(admin.token,'/api/plugins/install','POST',{previewId:preview.id,expectedRevision:catalog.revision,operationId:randomUUID()});const pkg=installed.packages.find((p:any)=>p.version===release.manifest.version);await until(async()=>{const current=await checked(admin.token,'/api/admin/plugins');return current.packages.find((p:any)=>p.id===pkg.id)?.state==='installed';});return pkg.id as string;};
    const configure=async(id:string,packageId:string)=>{const view=await checked(admin.token,'/api/plugins');return checked(admin.token,'/api/plugin-instances','POST',{expectedRevision:view.revision,instance:{id,packageId,name:'Generated independent probe',configuration:{label:id},desired:false,grants:{capabilities:['source','processor','repository','retrieval','model','ui'],sourceIds:[],history:true}}});};
    const packageId=await install(compatible);await configure('probe-compatible',packageId);
    const check=await checked(admin.token,'/api/plugin-instances/probe-compatible/check','POST',{});
    const before=await checked(admin.token,'/api/plugins');await checked(admin.token,'/api/plugin-instances/probe-compatible/enable','POST',{expectedRevision:before.revision});
    const snapshot=await checked(admin.token,'/api/plugin-instances/probe-compatible/snapshots','POST',{}),view=await checked(admin.token,'/api/plugins');
    const invocations=[];
    for(const componentId of ['generated.model','generated.card','generated.memory']){const result=await request(admin.token,'/api/plugin-snapshots/'+snapshot.id+'/invoke','POST',{componentId,payload:{emit:true},operationId:randomUUID()});assert.equal(result.status,503);invocations.push({componentId,...result});}
    const instance=view.instances.find((i:any)=>i.id==='probe-compatible');assert.equal(instance.checked,true);
    results.push({probe:'unmodified-app-generic-domain-components',status:'FAIL',severity:'S1',environment:'real scoped app listener, HTTP, install, worker; only GitHub release transport supplied generated bytes',checked:check.checked,capabilities:instance.capabilities,invocations,meaning:'Actual factory and component identity verification do not provide missing host domain adapters. Generic model/UI/repository invocation is unavailable.'});
    const nativePackageId=await install(native);await configure('probe-native-dsh',nativePackageId);
    const nativeCheck=await request(admin.token,'/api/plugin-instances/probe-native-dsh/check','POST',{});assert.equal(nativeCheck.status,502);
    const nativeView=await checked(admin.token,'/api/plugins');assert.equal(nativeView.instances.find((i:any)=>i.id==='probe-native-dsh').checked,false);
    results.push({probe:'native-dsh-apply-abi',status:'FAIL',severity:'S1',environment:'actual installed ZIP and real worker initialization; generated native apply(ctx) module; generated GitHub transport',packageInstalled:true,check:nativeCheck,checked:false,meaning:'Native DSH apply(ctx) cannot initialize under Mote worker factory ABI, even when given Mote manifest packaging.'});
  }finally{await host.app.close();rmSync(root,{recursive:true,force:true});}
}

await entrypointModuleProbe();
await noHostAdapterProbe();
if(process.env.MOTE_BASELINE_REPORT)writeFileSync(process.env.MOTE_BASELINE_REPORT,JSON.stringify({originalBaseline:'2c78ca8d52a7d17fae20962cf68d09a717ffc73a',testedCandidate:process.env.MOTE_BENCHMARK_CANDIDATE??'unrecorded',results},null,2)+'\n');
console.log(JSON.stringify({probes:results.length,results},null,2));
