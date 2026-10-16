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

test('minimum context budget pages real Memory and Material channels without losing references',async t=>{
 const f=await memoryFixture(t),one=await f.publish(f.a,'A','same-source','one'),two=await f.publish(f.a,'A','same-source','two');await f.extract(f.a,one.id);await f.extract(f.a,two.id);const context=await f.node.authority.authenticate(f.a.token),reader=f.node.ask!.bind(context,{sourceIds:['same-source'],assertCurrent:()=>{}}).reader(),seen=new Set<string>();let cursor:string|undefined;
 do{const page=await reader.context({limit:1,maxCharacters:1000,includeRecentSessions:false,...(cursor?{cursor}:{})});assert.ok(JSON.stringify(page).length<=1000);for(const card of [...page.stableMemories,...page.recentRecords]){assert.ok(!seen.has(card.ref));seen.add(card.ref);}cursor=page.nextCursor??undefined;assert.ok(seen.size<=4);}while(cursor);assert.equal(seen.size,4);
});


test('identical original text cannot revive a receipt after deletion and recreation during a real provider await',async t=>{
 const f=await memoryFixture(t,true),material=await f.publish(f.a,'A');await f.extract(f.a,material.id);const directories=await f.externalize([f.a]),memory=(await f.ok(f.a.token,'/api/memories')).items[0],gate=f.hold(directories.get(f.a.userId)!,memory.id),id=randomUUID(),text='GENERATED_SAME_TEXT_NEW_ORIGINAL',send=(batchId:string,client?:'web')=>f.ok(f.a.token,'/api/ingress/sources/same-source/captures','POST',{batchId,items:[noteCapture({id,client,deviceId:'same-device',deviceName:'Generated device',platform:'import',capturedAt:'2026-10-16T12:00:00Z',text})]});await send('first');const context=await f.node.authority.authenticate(f.a.token),reader=f.node.ask!.bind(context,{sourceIds:['same-source'],assertCurrent:()=>{}}).reader(),pending=reader.read(['capture:'+id,'memory:'+memory.id]).then(result=>({result}),error=>({error:String(error)}));await gate.entered();await f.ok(f.a.token,'/api/captures/'+id,'DELETE');assert.equal((await f.request(f.a.token,'/api/captures/'+id)).statusCode,404);await send('replacement','web');assert.equal((await f.ok(f.a.token,'/api/captures/'+id)).appId,'dev.mote.web.notes');gate.release();const result=await pending;assert.ok('error' in result);assert.ok(!JSON.stringify(result).includes(text));assert.equal((await f.node.ask!.bind(context,{sourceIds:['same-source'],assertCurrent:()=>{}}).reader().read(['capture:'+id])).items.length,1);
});


test('Ask Memory reader carries exact filters and pagination to real M07 before provider keys',async t=>{
 const f=await memoryFixture(t,true),one=await f.publish(f.a,'A','same-source','one'),two=await f.publish(f.a,'A','other-source','two');await f.extract(f.a,one.id);await f.extract(f.a,two.id);await f.externalize([f.a]);const context=await f.node.authority.authenticate(f.a.token),reader=f.node.ask!.bind(context,{sourceIds:['same-source','other-source'],assertCurrent:()=>{}}).reader(),page=await reader.agent.memories!({limit:1,sourceId:'same-source',source:'file',deviceId:'same-device'} as any);assert.equal(page.items.length,1);const memory=page.items[0] as any;assert.equal((await reader.agent.memories!({id:memory.id,sourceId:'other-source'} as any)).items.length,0);await assert.rejects(reader.read(['memory:'+memory.id],{scope:{sourceId:'other-source'}}));const all=await reader.agent.memories!({limit:1});assert.ok(all.nextCursor);assert.equal((await reader.agent.memories!({limit:1,cursor:all.nextCursor!})).items.length,1);await assert.rejects(reader.agent.memories!({limit:1,sourceId:'same-source',cursor:all.nextCursor!} as any));const narrow=await reader.context({sourceId:'same-source',includeRecentSessions:false});assert.equal(narrow.stableMemories.length,1);assert.equal((await f.request(f.a.token,'/api/agent-view/memories?sourceId=other-source&kind=semantic')).statusCode,200);
});
