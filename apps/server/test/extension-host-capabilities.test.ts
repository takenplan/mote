import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {buildScopedApp} from '../src/scope/app.js';

test('authors discover actual invocation support before installing code, without account or source data',async t=>{
 const directory=mkdtempSync(join(tmpdir(),'mote-extension-discovery-'));
 const node=await buildScopedApp({dataDir:directory});
 t.after(async()=>{await node.app.close();rmSync(directory,{recursive:true,force:true});});
 const protocol={'x-mote-protocol-version':'2'};
 const request=(token:string|undefined,url:string,method:any='GET',payload?:unknown)=>node.app.inject({url,method,headers:{...protocol,...(token?{authorization:'Bearer '+token}:{})},...(payload===undefined?{}:{payload})});
 const checked=async(token:string|undefined,url:string,method:any='GET',payload?:unknown)=>{const result=await request(token,url,method,payload);assert.equal(result.statusCode,200,result.body);return result.json();};
 const password='Generated-discovery-password-01';
 await node.accounts.initialize('generated-admin',password);
 const login=(username:string)=>checked(undefined,'/api/auth/login','POST',{username,password,mode:'client'});
 const admin=await login('generated-admin');
 const a=await checked(admin.token,'/api/admin/accounts','POST',{username:'generated-a',password});
 await checked(admin.token,'/api/admin/accounts','POST',{username:'generated-b',password});
 const alice=await login('generated-a'),bob=await login('generated-b');
 const url='/api/plugins/host-capabilities';
 assert.equal((await request(undefined,url)).statusCode,401);
 const capabilities=await checked(alice.token,url);
 assert.equal(capabilities.schemaVersion,1);
 assert.equal(capabilities.runtime,'worker');
 assert.deepEqual(capabilities.factoryExports,['createMotePlugin','createMemoryProvider']);
 assert.deepEqual(capabilities.invocationCapabilities.filter((value:any)=>value.registered).map((value:any)=>value.id),['source','processor']);
 assert.deepEqual(capabilities.invocationCapabilities.filter((value:any)=>!value.registered).map((value:any)=>[value.id,value.reason]),[
  ['repository','scoped_domain_unavailable'],['retrieval','scoped_domain_unavailable'],['engine','scoped_domain_unavailable'],['model','scoped_domain_unavailable'],['ui','scoped_domain_unavailable'],
 ]);
 assert.deepEqual(await checked(bob.token,url),capabilities);
 assert.equal(JSON.stringify(capabilities).includes(a.userId),false);
 const catalog=await checked(admin.token,'/api/admin/plugins');
 assert.equal(catalog.packages.length,0,'Discovery must not install or execute a plugin');
 assert.equal((await checked(alice.token,'/api/plugin-events')).items.length,0);
 const device=await checked(alice.token,'/api/login/session','POST',{serverUrl:'https://generated.invalid',deviceId:'generated-device',deviceName:'Generated collector',platform:'android'});
 assert.equal((await request(device.token,url)).statusCode,403);
 assert.equal((await request(alice.token,url+'?userId='+encodeURIComponent(a.userId))).statusCode,401);
 await checked(admin.token,'/api/admin/accounts/'+a.userId,'PATCH',{disabled:true});
 assert.equal((await request(alice.token,url)).statusCode,401);
 assert.deepEqual(await checked(bob.token,url),capabilities);
});
