import {waitForPluginCheck} from './fixtures/plugin-check.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdtempSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {setTimeout as delay} from 'node:timers/promises';
import {buildScopedApp} from '../src/scope/app.js';
import {generatedScopedPluginRelease,generatedScopedPluginSource} from './fixtures/scoped-plugin-release.js';

const protocol={'x-mote-protocol-version':'2','x-mote-ingress-version':'3'};
const specimens=[
 {name:'reordered',expression:'[...components].reverse()',status:200},
 {name:'duplicate',expression:'[components[0],components[0],...components.slice(2)]',status:409},
 {name:'missing',expression:'components.slice(1)',status:409},
 {name:'extra',expression:"[...components,{...components[1],id:'generated.undeclared'}]",status:409},
 {name:'version-changed',expression:"components.map((c,i)=>i===1?{...c,version:'changed'}:c)",status:409},
 {name:'surface-changed',expression:"components.map((c,i)=>i===1?{...c,surface:'processing'}:c)",status:409},
 {name:'capability-changed',expression:"components.map((c,i)=>i===1?{...c,capability:'processor'}:c)",status:409},
];

test('production registration composes independently ordered components and rejects descriptor drift',async t=>{
 const directory=mkdtempSync(join(tmpdir(),'mote-component-identity-'));
 const releases=specimens.map((specimen,index)=>({...specimen,release:generatedScopedPluginRelease(String(800+index),generatedScopedPluginSource.replace('components:components.map','components:'+specimen.expression+'.map'))}));
 const node=await buildScopedApp({dataDir:directory},{pluginReleaseTransport:async url=>{
  const chosen=releases.find(({release})=>url.includes('/'+release.tag+'/')||url.endsWith('/'+release.tag));
  if(!chosen)throw Error('Unexpected generated release URL');return chosen.release.transport(url);
 }});
 t.after(async()=>{await node.app.close();rmSync(directory,{recursive:true,force:true});});
 const request=(token:string|undefined,url:string,method:any='GET',payload?:unknown)=>node.app.inject({url,method,headers:{...protocol,...(token?{authorization:'Bearer '+token}:{})},...(payload===undefined?{}:{payload})});
 const ok=async(token:string|undefined,url:string,method:any='GET',payload?:unknown)=>{const response=await request(token,url,method,payload);assert.equal(response.statusCode,200,response.body);return response.json();};
 const password='Generated-component-identity-01';await node.accounts!.initialize('component-admin',password);
 const token=(await ok(undefined,'/api/auth/login','POST',{username:'component-admin',password,mode:'client'})).token;
 await ok(token,'/api/ingress/sources','POST',{id:'generated-source',name:'Generated source',kind:'custom',deviceId:'generated-device',platform:'import',retention:'archive'});
 for(const {name,status,release} of releases)await t.test(name,async()=>{
  const preview=await ok(token,'/api/plugins/resolve','POST',{repository:release.repository,tag:release.tag});
  await ok(token,'/api/plugins/install','POST',{previewId:preview.id,expectedRevision:(await ok(token,'/api/admin/plugins')).revision,operationId:randomUUID()});
  let pkg:any;const installDeadline=Date.now()+10000;
  while(!(pkg=(await ok(token,'/api/admin/plugins')).packages.find((value:any)=>value.version===release.manifest.version&&value.state==='installed'))){assert.ok(Date.now()<installDeadline,'Generated release installation timed out');await delay(5);}
  await ok(token,'/api/plugin-instances','POST',{expectedRevision:(await ok(token,'/api/plugins')).revision,instance:{id:name,packageId:pkg.id,name:'Generated '+name,configuration:{label:name},desired:false,grants:{capabilities:['source'],sourceIds:['generated-source'],history:false}}});
  const check=await request(token,'/api/plugin-instances/'+name+'/check','POST',{});
  assert.equal(check.statusCode,200,check.body);
  assert.equal(check.json().observed,'checking');assert.equal(check.json().checked,false);
  await waitForPluginCheck(check.json(),taskId=>ok(token,'/api/tasks/'+taskId),status===200?'succeeded':'blocked');
  const current=await ok(token,'/api/plugins');assert.equal(current.instances.find((value:any)=>value.id===name).checked,status===200);
  if(status!==200){assert.equal((await request(token,'/api/plugin-instances/'+name+'/enable','POST',{expectedRevision:current.revision})).statusCode,503);return;}
  await ok(token,'/api/plugin-instances/'+name+'/enable','POST',{expectedRevision:current.revision});
  const snapshot=await ok(token,'/api/plugin-instances/'+name+'/snapshots','POST',{});
  const task=await ok(token,'/api/plugin-snapshots/'+snapshot.id+'/invoke','POST',{componentId:'generated.source',operationId:randomUUID(),payload:{source:'generated-source',batchId:'generated-composition',items:[{externalId:'generated-note',revision:'1',observedAt:'2026-10-19T00:00:00Z',title:'Generated note',text:'Independent registration preserved the actual source callback.',kind:'message',layer:'original'}]}});
  let value:any;const taskDeadline=Date.now()+10000;
  while((value=await ok(token,'/api/tasks/'+task.id)).state!=='succeeded'){assert.ok(Date.now()<taskDeadline,JSON.stringify(value));await delay(5);}
  assert.equal(value.result.captures.length,1);assert.ok(value.result.captures[0].original.ref);
 });
});
