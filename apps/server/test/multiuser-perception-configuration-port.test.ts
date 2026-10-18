import test from 'node:test';
import assert from 'node:assert/strict';
import {scopedFilesFixture} from './fixtures/scoped-files.js';

test('perception query-image permission is an independent account configuration and rechecks after restart and logout',async t=>{
 const f=await scopedFilesFixture(t),read=async(token:string)=>f.host.processing!.forUser(await f.host.authority.authenticate(token)).perceptionSettings();
 const initial=await read(f.a.token);assert.equal(initial.enabled,true);assert.equal(initial.allowQueryImages,false);assert.equal(initial.concurrency,1);
 const view=await f.checked(f.a.token,'/api/configuration');assert.deepEqual(view.domains.find((domain:any)=>domain.id==='perception').effective,initial);
 const result=await f.checked(f.a.token,'/api/configuration/perception','PUT',{revision:view.revision,value:{...initial,allowQueryImages:true}});assert.equal(result.revision,view.revision+1);
 assert.equal((await read(f.a.token)).allowQueryImages,true);assert.equal((await read(f.b.token)).allowQueryImages,false);
 assert.equal((await f.request(f.a.token,'/api/configuration/perception','PUT',{revision:view.revision,value:initial})).statusCode,409);
 assert.equal((await f.checked(f.a.token,'/api/processing')).settings.automatic,false,'image settings never rewrite the independent file switch');
 await f.restart();assert.equal((await read(f.a.token)).allowQueryImages,true);assert.equal((await read(f.b.token)).allowQueryImages,false);
 const context=await f.host.authority.authenticate(f.a.token),port=f.host.processing!.forUser(context);await f.checked(f.a.token,'/api/auth/logout','POST',{});await assert.rejects(port.perceptionSettings());
});
