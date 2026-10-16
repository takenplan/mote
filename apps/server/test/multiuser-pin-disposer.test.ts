import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {join} from 'node:path';
import {scopedFilesFixture} from './fixtures/scoped-files.js';

test('an acquired pin disposer remains exact and idempotent after account disable without restoring reads',async t=>{
 const f=await scopedFilesFixture(t),text='GENERATED_EXACT_PIN_BYTES',a=await f.upload(f.a.token,'same-pin-file',text),b=await f.upload(f.b.token,'same-pin-file',text);
 const as=f.host.ingress!.forUser(await f.host.authority.authenticate(f.a.token)),bs=f.host.ingress!.forUser(await f.host.authority.authenticate(f.b.token)),releaseA=as.holdOriginal(a.original.ref),releaseOtherA=as.holdOriginal(a.original.ref),releaseB=bs.holdOriginal(b.original.ref),db=new DatabaseSync(join(f.directory,'mote.sqlite'),{readOnly:true});t.after(()=>db.close());
 const pins=(userId:string)=>Number(db.prepare('SELECT count(*) n FROM ig_pins WHERE user_id=?').get(userId)!.n);
 assert.equal(pins(f.a.userId),2);assert.equal(pins(f.b.userId),1);
 await f.checked(f.admin.token,'/api/admin/accounts/'+f.a.userId,'PATCH',{disabled:true});
 const retired=(error:unknown)=>!!error&&typeof error==='object'&&'code' in error&&error.code==='invalid_identity';
 assert.throws(()=>as.readOriginal(a.original.ref),retired);assert.throws(()=>as.holdOriginal(a.original.ref),retired);
 assert.equal(releaseA(),undefined);assert.equal(releaseA(),undefined);assert.equal(pins(f.a.userId),1,'only its allocated UUID is disposed');assert.equal(pins(f.b.userId),1);
 assert.throws(()=>as.readOriginal(a.original.ref),retired);assert.throws(()=>as.holdOriginal(a.original.ref),retired);
 releaseOtherA();assert.equal(pins(f.a.userId),0);assert.equal(pins(f.b.userId),1);
 assert.equal(bs.readOriginal(b.original.ref).bytes.toString(),text);releaseB();assert.equal(pins(f.b.userId),0);
});
