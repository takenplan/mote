/** Independent M11 P1 scenario retained verbatim apart from its fixture import. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {noteCapture} from '@mote/shared';
import {memoryFixture} from './fixtures/ask-reader-memory.js';

test('M08 reader preserves the first observed original through a later actual provider await and same-ID recreation',async t=>{
 const f=await memoryFixture(t,true),material=await f.publish(f.a,'A');await f.extract(f.a,material.id);const directories=await f.externalize([f.a]),memory=(await f.ok(f.a.token,'/api/memories')).items[0],gate=f.hold(directories.get(f.a.userId)!,memory.id),id=randomUUID();
 const send=(text:string,batchId:string)=>f.ok(f.a.token,'/api/ingress/sources/same-source/captures','POST',{batchId,items:[noteCapture({id,deviceId:'same-device',deviceName:'Generated',platform:'import',capturedAt:'2026-10-16T12:00:00Z',text})]});
 await send('GENERATED_ORIGINAL_BEFORE_DELETE','first');
 const context=await f.node.authority.authenticate(f.a.token),reader=f.node.ask!.bind(context,{sourceIds:['same-source'],assertCurrent:()=>f.node.authority.assert(context)}).reader(),pending=reader.read(['capture:'+id,'memory:'+memory.id,'capture:'+id]).then(result=>({result}),error=>({error:String(error)}));
 await gate.entered();await f.ok(f.a.token,'/api/captures/'+id,'DELETE');assert.equal((await f.request(f.a.token,'/api/captures/'+id)).statusCode,404);await send('GENERATED_REPLACEMENT_AFTER_DELETE','replacement');gate.release();const outcome=await pending,leaked=JSON.stringify(outcome).includes('GENERATED_ORIGINAL_BEFORE_DELETE');console.log(JSON.stringify({leaked,outcome}));assert.equal(leaked,false,'the earlier deleted original cannot be published after a same-ID replacement was observed');
});
