import test,{type TestContext} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';
import {DatabaseSync} from 'node:sqlite';
import {buildApp} from '../src/app.js';
import {generatedScopedPluginRelease} from './fixtures/scoped-plugin-release.js';

async function fixture(t:TestContext){
 const directory=mkdtempSync(join(tmpdir(),'mote-m13-plugin-')),release=generatedScopedPluginRelease(),node=await buildApp({dataDir:directory},{pluginReleaseTransport:release.transport});
 t.after(async()=>{await node.app.close();rmSync(directory,{recursive:true,force:true});});
 const request=(token:string|undefined,url:string,method:any='GET',payload?:unknown)=>node.app.inject({url,method,headers:{'x-mote-protocol-version':'2','x-mote-ingress-version':'3',...(token?{authorization:'Bearer '+token}:{})},...(payload===undefined?{}:{payload})});
 const password='Generated-M13-plugin-password-01';await node.accounts!.initialize('generated-admin',password);
 const login=async(username:string)=>{const r=await request(undefined,'/api/auth/login','POST',{username,password,mode:'client',durationMs:86400000});assert.equal(r.statusCode,200,r.body);return r.json().token as string;};
 const admin=await login('generated-admin');
 for(const username of ['generated-a','generated-b'])assert.equal((await request(admin,'/api/admin/accounts','POST',{username,password,administrator:false})).statusCode,200);
 const a=await login('generated-a'),b=await login('generated-b'),preview=await request(admin,'/api/plugins/resolve','POST',{repository:release.repository,tag:release.tag});assert.equal(preview.statusCode,200,preview.body);
 const catalog=await request(admin,'/api/admin/plugins'),install=await request(admin,'/api/plugins/install','POST',{previewId:preview.json().id,expectedRevision:catalog.json().revision,operationId:randomUUID()});assert.equal(install.statusCode,200,install.body);
 const end=Date.now()+10000;while(node.plugins!.catalog.view().packages[0]?.state==='installing'){assert.ok(Date.now()<end);await delay(5);}
 const packageId=node.plugins!.catalog.view().packages[0].id;
 const view=async(token:string)=>{const r=await request(token,'/api/plugins');assert.equal(r.statusCode,200,r.body);return r.json();};
 const instance=(label:string)=>({id:'same-instance',packageId,name:label,configuration:{label,credential:'personal:'+label},desired:false,revocation:'initial',grants:{capabilities:['processor'],sourceIds:[],history:false}});
 for(const [token,label]of [[a,'A'],[b,'B']] as const){const v=await view(token);assert.equal((await request(token,'/api/plugin-instances','POST',{instance:instance(label),expectedRevision:v.revision})).statusCode,200);}
 const stored=(userId:string)=>{const db=new DatabaseSync(join(directory,'mote.sqlite'));try{return JSON.parse(String(db.prepare('SELECT json FROM plugin_user_instances WHERE user_id=? AND id=?').get(userId,'same-instance')!.json));}finally{db.close();}};
 return {node,request,view,admin,a,b,instance,stored};
}

test('actual M09 view supplies owned edit metadata and distinguishes declared from checked capabilities',async t=>{
 const f=await fixture(t),before=await f.view(f.a),a=before.instances[0];
 assert.deepEqual(a.secretStatus,{credential:true});assert.equal(a.configuration.credential,undefined);
 assert.ok(before.packages[0].declaredCapabilities.includes('processor'));
 assert.equal(a.capabilities.find((v:any)=>v.id==='generated.processor').state,'unknown');
 assert.equal((await f.request(f.a,'/api/plugin-instances/same-instance/check','POST',{})).statusCode,200);
 const checked=(await f.view(f.a)).instances[0];assert.equal(checked.checked,true);assert.equal(checked.capabilities.find((v:any)=>v.id==='generated.processor').state,'verified');
 assert.equal(checked.capabilities.find((v:any)=>v.id==='generated.model').state,'unsupported');
 assert.equal((await f.view(f.b)).instances[0].checked,false);assert.doesNotMatch(JSON.stringify(checked),/personal:A|personal:B/);
});

test('explicit masked reference preservation edits the existing owned instance under CAS without adopting another account reference',async t=>{
 const f=await fixture(t),view=await f.view(f.a),a=view.instances[0],{generation,checked,secretStatus,capabilities,...instance}=a;
 instance.name='A edited';instance.configuration.label='A edited';
 const changed=await f.request(f.a,'/api/plugin-instances','POST',{instance,expectedRevision:view.revision,preserveRedactedSecrets:true});assert.equal(changed.statusCode,200,changed.body);
 const context=await f.node.authority.authenticate(f.a);assert.equal(f.stored(context.userId).configuration.credential,'personal:A');
 assert.equal((await f.request(f.a,'/api/plugin-instances','POST',{instance,expectedRevision:view.revision,preserveRedactedSecrets:true})).statusCode,409);
 const bv=await f.view(f.b),b=bv.instances[0],{generation:bg,checked:bc,secretStatus:bs,capabilities:bp,...bi}=b;
 bi.name='B edited';assert.equal((await f.request(f.b,'/api/plugin-instances','POST',{instance:bi,expectedRevision:bv.revision,preserveRedactedSecrets:true})).statusCode,200);
 const cb=await f.node.authority.authenticate(f.b);assert.equal(f.stored(cb.userId).configuration.credential,'personal:B');
});

test('memory control reload discovers only its own durable preparation without readmission',async t=>{
 const f=await fixture(t),id=randomUUID(),prepared=await f.request(f.a,'/api/memory/bindings','POST',{operationId:id});assert.equal(prepared.statusCode,200,prepared.body);
 const view=await f.request(f.a,'/api/memory');assert.equal(view.json().bindingPreparation,id);assert.equal((await f.request(f.b,'/api/memory')).json().bindingPreparation,undefined);
 assert.equal((await f.request(f.b,'/api/memory/bindings/'+id)).statusCode,404);
 assert.equal((await f.request(f.a,'/api/memory/bindings/'+id+'/cancel','POST',{})).statusCode,200);
 assert.equal((await f.request(f.a,'/api/memory')).json().bindingPreparation,undefined);
});
