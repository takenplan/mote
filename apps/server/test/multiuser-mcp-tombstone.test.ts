import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture,item,call,value} from './fixtures/mcp.js';
test('actual SDK source tombstones preserve owner metadata while model-visible reads remain withdrawn',async t=>{
 const f=await fixture(t),sessions=[];
 for(const user of [f.a,f.b]){await f.ok(user.token,'/api/ingress/sources/same-source/items','POST',{batchId:'tombstone-before',items:[item('GENERATED_ACTIVE_PRIVATE_BODY','same-item','v1')]});await f.ok(user.token,'/api/ingress/sources/same-source/items','POST',{batchId:'tombstone-after',items:[{...item('','same-item','v2'),deleted:true}]});const head=await f.ok(user.token,'/api/sources/same-source/item?externalId=same-item');assert.equal(head.item.deleted,true);sessions.push(await f.connect(await f.mint(user.token)));}
 for(const session of sessions){const normal=await call(session.client,'mote_items',{sourceId:'same-source'});assert.equal(normal.isError,undefined,JSON.stringify(normal));assert.deepEqual(value(normal).items,[]);const included=await call(session.client,'mote_items',{sourceId:'same-source',includeDeleted:true});assert.equal(included.isError,undefined,JSON.stringify(included));assert.deepEqual(value(included).items,[],'existing model read credentials do not expand tombstoned source items, even with includeDeleted');assert.doesNotMatch(JSON.stringify(included),/GENERATED_ACTIVE_PRIVATE_BODY/);}
});
