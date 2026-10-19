import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';

// The ordinary suite exercises the source production composition. The acceptance
// command supplies the freshly emitted app.js to verify its real worker bundle.
const entry=process.env.MOTE_PLUGINS_PROCESS_ENTRY??fileURLToPath(new URL('../src/app.ts',import.meta.url));
test('production plugin and real Ingress composition persist fixed snapshots and scoped original bytes across distinct Node processes',async t=>{
 const directory=mkdtempSync(join(tmpdir(),'mote-m09-process-')),script=join(directory,'generated-process.mjs'),receipt=join(directory,'receipt.json');
 t.after(()=>rmSync(directory,{recursive:true,force:true}));
 const fixture=fileURLToPath(new URL('./fixtures/scoped-plugin-release.ts',import.meta.url));
 writeFileSync(script,`
import {buildApp} from ${JSON.stringify('file://'+entry)};
import {generatedScopedPluginRelease} from ${JSON.stringify('file://'+fixture)};
import {readFileSync,writeFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
const release=generatedScopedPluginRelease(),node=await buildApp({dataDir:${JSON.stringify(join(directory,'vault'))}},{pluginReleaseTransport:release.transport});
node.plugins.registerAdapter('ui',{validateResult:value=>value});
const protocol={'x-mote-protocol-version':'2','x-mote-ingress-version':'3'},request=async(token,url,method='GET',payload)=>{const response=await node.app.inject({url,method,headers:{...protocol,...(token?{authorization:'Bearer '+token}:{})},...(payload===undefined?{}:{payload})});if(response.statusCode!==200)throw Error(url+' '+response.statusCode+' '+response.body);return response.json();};
const wait=async(token,id,state='succeeded')=>{for(;;){const task=await request(token,'/api/tasks/'+id);if(task.state===state)return task;if(['blocked','failed','stale'].includes(task.state))throw Error(JSON.stringify(task));await new Promise(resolve=>setTimeout(resolve,5));}};
const source=async(token,snapshot,method,args,state='succeeded')=>wait(token,(await request(token,'/api/plugin-snapshots/'+snapshot.id+'/invoke','POST',{componentId:'generated.source',payload:{method,args},operationId:randomUUID()})).id,state);
try{
 let saved;
 if(process.env.GENERATED_PHASE==='first'){
  await node.accounts.initialize('generated-admin','Generated-process-password-01');
  const admin=await request(undefined,'/api/auth/login','POST',{username:'generated-admin',password:'Generated-process-password-01',mode:'client'});
  for(const username of ['generated-a','generated-b'])await request(admin.token,'/api/admin/accounts','POST',{username,password:'Generated-process-password-01'});
  const a=await request(undefined,'/api/auth/login','POST',{username:'generated-a',password:'Generated-process-password-01',mode:'client'}),b=await request(undefined,'/api/auth/login','POST',{username:'generated-b',password:'Generated-process-password-01',mode:'client'});
  const preview=await request(admin.token,'/api/plugins/resolve','POST',{repository:release.repository,tag:release.tag}),catalog=await request(admin.token,'/api/admin/plugins');
  const installed=await request(admin.token,'/api/plugins/install','POST',{previewId:preview.id,expectedRevision:catalog.revision,operationId:randomUUID()}),packageId=installed.packages[0].id;
  while(node.plugins.catalog.view().packages[0].state==='installing')await new Promise(resolve=>setTimeout(resolve,5));
  for(const [token,label] of [[a.token,'fixed-process-A'],[b.token,'fixed-process-B']]){
   for(const id of ['same-source','other-source'])await request(token,'/api/ingress/sources','POST',{id,name:'Generated source',kind:'custom',deviceId:'same-device',platform:'import',retention:'snapshot'});
   const current=await request(token,'/api/plugins');
   await request(token,'/api/plugin-instances','POST',{expectedRevision:current.revision,instance:{id:'same-instance',packageId,name:'Generated process instance',configuration:{label},desired:false,grants:{capabilities:['processor','source','ui'],sourceIds:['same-source'],history:false}}});
   await wait(token,(await request(token,'/api/plugin-instances/same-instance/check','POST',{})).taskId);
   const checked=await request(token,'/api/plugins');await request(token,'/api/plugin-instances/same-instance/enable','POST',{expectedRevision:checked.revision});
  }
  const snapshot=await request(a.token,'/api/plugin-instances/same-instance/snapshots','POST',{}),bSnapshot=await request(b.token,'/api/plugin-instances/same-instance/snapshots','POST',{});saved={a,b,snapshot,bSnapshot};
  const id=randomUUID(),capture=text=>({id,deviceId:'same-device',deviceName:'Generated process',platform:'import',capturedAt:'2026-10-15T00:00:00Z',durationMs:0,source:'screen',ocrText:'',imageBase64:Buffer.from(text).toString('base64'),imageMime:'image/png',ocr:{status:'pending'}});
  saved.original=(await source(a.token,snapshot,'receiveCaptures',['same-source','same-process-batch',[capture('PROCESS_A_ORIGINAL')]])).result.captures[0].original.ref;
  saved.bOriginal=(await source(b.token,bSnapshot,'receiveCaptures',['same-source','same-process-batch',[capture('PROCESS_B_PRIVATE_ORIGINAL')]])).result.captures[0].original.ref;
  writeFileSync(${JSON.stringify(receipt)},JSON.stringify(saved));
 }else saved=JSON.parse(readFileSync(${JSON.stringify(receipt)},'utf8'));
 const result=await request(saved.a.token,'/api/plugin-snapshots/'+saved.snapshot.id+'/invoke','POST',{componentId:'generated.card',payload:{emit:true},operationId:'generated-'+process.env.GENERATED_PHASE});
 const task=await wait(saved.a.token,result.id);
 if(task.result.label!=='fixed-process-A')throw Error('snapshot changed');
 const foreign=await node.app.inject({url:'/api/plugin-snapshots/'+saved.snapshot.id+'/invoke',method:'POST',headers:{...protocol,authorization:'Bearer '+saved.b.token},payload:{componentId:'generated.card',payload:{},operationId:'foreign'}});if(foreign.statusCode!==404)throw Error('foreign snapshot admitted');
 const original=(await source(saved.a.token,saved.snapshot,'readOriginal',[saved.original])).result,bOriginal=(await source(saved.b.token,saved.bSnapshot,'readOriginal',[saved.bOriginal])).result;
 if(Buffer.from(original.bytes.data).toString()!=='PROCESS_A_ORIGINAL'||Buffer.from(bOriginal.bytes.data).toString()!=='PROCESS_B_PRIVATE_ORIGINAL')throw Error('original scope changed');
 const foreignOriginal=(await source(saved.b.token,saved.bSnapshot,'readOriginal',[saved.original],'blocked')).state,fixedSource=(await source(saved.a.token,saved.snapshot,'pageOriginals',['other-source'],'blocked')).state;
 console.log(JSON.stringify({phase:process.env.GENERATED_PHASE,label:task.result.label,foreign:foreign.statusCode,events:(await request(saved.a.token,'/api/plugin-events')).items.length,original:Buffer.from(original.bytes.data).toString(),foreignOriginal,fixedSource}));
}finally{await node.app.close();}
 `);
 const run=(phase:string)=>new Promise<any>((resolve,reject)=>{const child=spawn(process.execPath,['--import','tsx',script],{env:{...process.env,GENERATED_PHASE:phase},stdio:['ignore','pipe','pipe']});let out='',err='';const timer=setTimeout(()=>{child.kill('SIGKILL');reject(Error('Generated plugin process timed out'));},20000);child.stdout.on('data',part=>out+=part);child.stderr.on('data',part=>err+=part);child.once('error',reject);child.once('close',code=>{clearTimeout(timer);if(code!==0)reject(Error(out+'\n'+err));else resolve(JSON.parse(out.trim().split('\n').at(-1)!));});});
 assert.deepEqual(await run('first'),{phase:'first',label:'fixed-process-A',foreign:404,events:1,original:'PROCESS_A_ORIGINAL',foreignOriginal:'blocked',fixedSource:'blocked'});
 assert.deepEqual(await run('second'),{phase:'second',label:'fixed-process-A',foreign:404,events:2,original:'PROCESS_A_ORIGINAL',foreignOriginal:'blocked',fixedSource:'blocked'});
});
