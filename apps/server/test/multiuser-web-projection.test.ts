import test,{type TestContext} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {randomUUID} from 'node:crypto';
import {noteCapture} from '@mote/shared';
import {skillCatalog} from '@mote/agent';
import {buildApp} from '../src/app.js';
import {defaultModelSettings} from '../src/model-settings.js';

async function fixture(t:TestContext){
 const directory=mkdtempSync(join(tmpdir(),'m13-public-web-')),host=await buildApp({dataDir:directory}),password='Generated-projection-only-01';
 t.after(async()=>{await host.app.close();rmSync(directory,{recursive:true,force:true});});
 const request=(token:string|undefined,url:string,method:any='GET',payload?:unknown)=>host.app.inject({url,method,headers:{'x-mote-protocol-version':'2','x-mote-ingress-version':'3',...(token?{authorization:'Bearer '+token}:{})},...(payload===undefined?{}:{payload})});
 const checked=async(token:string|undefined,url:string,method:any='GET',payload?:unknown)=>{const response=await request(token,url,method,payload);assert.equal(response.statusCode,200,response.body);return response.json();};
 await host.accounts!.initialize('generated-admin',password);const admin=await checked(undefined,'/api/auth/login','POST',{username:'generated-admin',password,mode:'client'}),users:any[]=[];
 for(const label of ['a','b']){await checked(admin.token,'/api/admin/accounts','POST',{username:'generated-'+label,password});users.push(await checked(undefined,'/api/auth/login','POST',{username:'generated-'+label,password,mode:'client'}));}
 return {host,request,checked,admin,a:users[0],b:users[1]};
}

test('public Web projection uses actual route topology, agent skills and owned canonical material/source pages',async t=>{
 const f=await fixture(t),id=randomUUID();
 for(const [owner,label]of [[f.a,'A'],[f.b,'B']]as const){
  await f.checked(owner.token,'/api/ingress/devices','POST',{id:'same-device',name:'Generated device',platform:'import'});
  await f.checked(owner.token,'/api/ingress/sources','POST',{id:'same-source',name:'Generated '+label,deviceId:'same-device',platform:'import',kind:'custom',retention:'archive'});
  await f.checked(owner.token,'/api/ingress/sources/same-source/captures','POST',{batchId:'same-batch',items:[noteCapture({id,deviceId:'same-device',deviceName:'Generated device',platform:'import',client:'web',capturedAt:'2026-01-01T00:00:00Z',text:'GENERATED_PROJECTION_'+label})]});
 }
 assert.deepEqual(await f.checked(f.a.token,'/api/skills'),{items:skillCatalog()});
 const inventory=await f.checked(f.a.token,'/api/features');assert.ok(inventory.capabilities.some((item:any)=>item.id==='http:GET:/api/library/catalog'));assert.ok(!inventory.capabilities.some((item:any)=>item.id.includes(':/api/admin/')));
 const until=Date.now()+10000;let page:any;
 do{page=await f.checked(f.a.token,'/api/library/catalog?limit=1');if(page.items.length)break;await new Promise(done=>setTimeout(done,20));}while(Date.now()<until);
 assert.equal(page.items.length,1);assert.equal(page.sources.find((source:any)=>source.id==='same-source').count,1);
 const item=page.items[0];assert.match(JSON.stringify(await f.checked(f.a.token,'/api/materials/'+item.id+'/read?revision='+item.revision)),/GENERATED_PROJECTION_A/);
 assert.doesNotMatch(JSON.stringify(await f.checked(f.b.token,'/api/library/catalog')),/GENERATED_PROJECTION_A/);
 assert.equal((await f.request(f.admin.token,'/api/materials/'+item.id)).statusCode,404);
});

test('public insight progress and conversation metadata retain the persisted owner scope',async t=>{
 const f=await fixture(t),scope={after:'2026-01-01T00:00:00Z',before:'2026-01-02T00:00:00Z',timeZone:'UTC'},id=randomUUID();
 // Only model I/O is replaced. Configuration, admission, persistence and reads are real.
 t.mock.method(globalThis,'fetch',async()=>{throw Error('Generated metadata fixture does not invoke an external model');});
 const view=await f.checked(f.a.token,'/api/configuration');await f.checked(f.a.token,'/api/configuration/models','PUT',{revision:view.revision,value:{profiles:[{id:'generated',name:'Generated',settings:{...defaultModelSettings(),provider:'custom',protocol:'openai-completions',model:'generated',baseUrl:'https://synthetic.invalid/v1',apiKey:'GENERATED_METADATA_KEY'}}],selections:{insight:{kind:'personal',id:'generated'}}}});
 const run=await f.checked(f.a.token,'/api/insight-runs','POST',{requestId:id,...scope,prompt:'Generated scope'});assert.deepEqual(run.scope,scope);assert.deepEqual(run.snapshot.scope,scope);await f.checked(f.a.token,'/api/insight-runs/'+id+'/cancel','POST',{});
 assert.deepEqual((await f.checked(f.a.token,'/api/insight-runs')).items[0].scope,scope);assert.deepEqual((await f.checked(f.a.token,'/api/insight-runs/'+id)).scope,scope);assert.equal((await f.request(f.b.token,'/api/insight-runs/'+id)).statusCode,404);
 const conversationId=randomUUID();for(const [owner,label]of [[f.a,'A'],[f.b,'B']]as const){await f.checked(owner.token,'/api/conversations','POST',{id:conversationId,title:'Generated '+label});const list=await f.checked(owner.token,'/api/conversations');const item=list.items.find((value:any)=>value.id===conversationId);assert.equal(item.turnCount,0);assert.equal(item.title,'Generated '+label);}
});
