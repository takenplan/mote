import test,{type TestContext} from 'node:test';
import assert from 'node:assert/strict';
import {writeFileSync,readFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {join} from 'node:path';
import {defaultMemorySettings} from '../src/scope/memory-schema.js';
import {writeMessagesResponse} from '../../../scripts/fixtures/messages-provider.js';
import {memoryFixture,memoryText} from './fixtures/mcp-memory.js';
import {call,value,item} from './fixtures/mcp.js';
import {waitForState} from './fixtures/scoped-query-accounts.js';

/** Representative B uses the real automatic M03/M06/M07 chain, installed provider,
 * Ask Harness and HTTP SDK on the same host. Only external model/package I/O is synthetic. */
async function chain(t:TestContext){
 const f=await memoryFixture(t,true),primary=new Map<string,{memory:any;material:any;captureId:string}>();
 for(const [user,owner]of [[f.a,'A'],[f.b,'B']] as const){
  await f.ok(user.token,'/api/sources/same-source','PATCH',{retention:'archive'});
  const processing=await f.ok(user.token,'/api/processing');await f.replace(user,'processing',{...processing.settings,automatic:true,understandingEnabled:false,summarize:false,semanticTurns:false});
  const memory=defaultMemorySettings();memory.lifecycle.extraction.minChanges=1;await f.replace(user,'memory',{...memory,automatic:true,integration:false});
  const writer=await f.connect(await f.mint(user.token,'write')),accepted=await call(writer.client,'mote_put_item',{sourceId:'same-source',item:item(memoryText(owner))});assert.equal(accepted.isError,undefined,JSON.stringify(accepted));
  const page=await waitForState(()=>f.ok(user.token,'/api/memories'),page=>page.items.length===1,'real automatic reviewed Memory '+owner,30000),material=(await f.ok(user.token,'/api/materials')).items.find((row:any)=>row.origin.sourceId==='same-source');assert.ok(material);
  primary.set(owner,{memory:page.items[0],material,captureId:value(accepted).captures[0].id});
 }
 for(const request of f.requests)assert.ok(!request.raw.includes(memoryText(request.owner==='A'?'B':'A')),'actual extraction/review model owner');assert.ok(f.requests.length>=4);
 const directories=await f.externalize();
 const answer=async(user:typeof f.a,owner:string,id:string)=>{
  const selected=primary.get(owner)!;await f.enableAsk(user,owner);
  f.modelReplies.set(owner,(raw,res)=>{const body=JSON.parse(raw),uses=body.messages.flatMap((message:any)=>Array.isArray(message.content)?message.content.filter((part:any)=>part.type==='tool_use'):[]),stage=uses.length+1;assert.ok(!raw.includes(memoryText(owner==='A'?'B':'A')));
   if(!uses.some((use:any)=>use.name==='material_catalog'))return writeMessagesResponse(res,{stage,tool:{name:'material_catalog',args:{limit:30}}});
   if(!uses.some((use:any)=>use.name==='memories'))return writeMessagesResponse(res,{stage,tool:{name:'memories',args:{id:selected.memory.id,includeEvidence:true}}});
   if(!uses.some((use:any)=>use.name==='material_read'))return writeMessagesResponse(res,{stage,tool:{name:'material_read',args:{ref:selected.material.ref}}});
   assert.ok(raw.includes(memoryText(owner)),'actual original reached Harness through read tools');writeMessagesResponse(res,{stage,text:JSON.stringify({answer:'GENERATED_CHAIN_B_ANSWER_'+owner+' ['+selected.memory.evidenceIds[0]+']',citationIds:[selected.memory.evidenceIds[0]]})});
  });
  await f.ok(user.token,'/api/conversations','POST',{id});await f.ok(user.token,'/api/query-runs','POST',{id,input:{question:'Generated representative B actual Memory and original',conversationId:id,turnId:id}});
  const run=await waitForState(()=>f.ok(user.token,'/api/query-runs/'+id),run=>run.status!=='running','actual Ask publication '+owner,30000);assert.equal(run.status,'completed',JSON.stringify(run));assert.ok(run.result.citations.length);assert.equal(run.result.citations[0].id,selected.memory.evidenceIds[0]);
  const db=new DatabaseSync(join(f.root,'mote.sqlite'),{readOnly:true});let artifact:string;try{artifact='artifact:'+String(db.prepare('SELECT id FROM ma_artifacts WHERE user_id=? AND run_id=?').get(user.userId,id)!.id);}finally{db.close();}return {run,artifact};
 };
 return {...f,get node(){return f.node;},primary,directories,answer};
}

test('representative B preserves real automatic Memory to Harness to SDK results for equal A/B IDs across restart',async t=>{
 const f=await chain(t),id=randomUUID(),answers=[];
 for(const [user,owner]of [[f.a,'A'],[f.b,'B']] as const){const answer=await f.answer(user,owner,id);answers.push(answer);assert.match(answer.run.result.answer,new RegExp('ANSWER_'+owner));}
 const grants=await Promise.all([f.mint(f.a.token,'read',[]),f.mint(f.b.token,'read',[])]),sessions=await Promise.all(grants.map(grant=>f.connect(grant))),before=[];
 for(const [index,owner,other]of [[0,'A','B'],[1,'B','A']] as const){const selected=f.primary.get(owner)!,result=await call(sessions[index].client,'mote_read',{refs:[answers[index].artifact,'memory:'+selected.memory.id,selected.material.ref]});assert.equal(result.isError,undefined,JSON.stringify(result));assert.match(JSON.stringify(result),new RegExp('ANSWER_'+owner));assert.match(JSON.stringify(result),new RegExp(memoryText(owner)));assert.doesNotMatch(JSON.stringify(result),new RegExp('ANSWER_'+other+'|'+memoryText(other)));before.push(value(result));assert.equal((await call(sessions[index].client,'mote_read',{refs:[answers[1-index].artifact]})).isError,true);assert.equal((await f.request(grants[index].token,'/api/query-runs/'+id)).statusCode,401);}
 const calls=f.requests.length;await f.restart();for(let index=0;index<2;index++){const owner=index===0?'A':'B',session=await f.connect(grants[index]),read=await call(session.client,'mote_read',{refs:[answers[index].artifact,'memory:'+f.primary.get(owner)!.memory.id,f.primary.get(owner)!.material.ref]});assert.equal(read.isError,undefined,JSON.stringify(read));assert.deepEqual(value(read),before[index]);}assert.equal(f.requests.length,calls,'restart/SDK reads never replay successful model work');
});

test('representative B narrows genuine provider keys and SDK originals before LIMIT without changing B',async t=>{
 const f=await chain(t),writer=await f.connect(await f.mint(f.a.token,'write',['other-source'])),hidden=await call(writer.client,'mote_put_item',{sourceId:'other-source',item:item(memoryText('A')+' GENERATED_SAME_USER_HIDDEN')});assert.equal(hidden.isError,undefined);
 const page=await waitForState(()=>f.ok(f.a.token,'/api/memories'),page=>page.items.length===2,'actual second source Memory',30000),hiddenMemory=page.items.find((memory:any)=>memory.id!==f.primary.get('A')!.memory.id);assert.ok(hiddenMemory);
 const a=await f.connect(await f.mint(f.a.token)),wide=await f.connect(await f.mint(f.a.token,'read',[])),b=await f.connect(await f.mint(f.b.token)),beforeB=await b.client.readResource({uri:'mote://memories'});
 const directory=f.directories.get(f.a.userId)!,audit=join(directory,'read-events.jsonl');writeFileSync(join(directory,'audit-reads'),'generated');writeFileSync(audit,'');const narrow=await call(a.client,'mote_memories',{query:'tea',limit:1});assert.equal(narrow.isError,undefined,JSON.stringify(narrow));assert.deepEqual(value(narrow).items.map((memory:any)=>memory.id),[f.primary.get('A')!.memory.id]);assert.equal(value(narrow).nextCursor,null);assert.deepEqual(JSON.parse(readFileSync(join(directory,'search-observation.json'),'utf8')).keys.map((key:any)=>key.memoryId),[f.primary.get('A')!.memory.id]);assert.deepEqual(readFileSync(audit,'utf8').trim().split('\n').filter(Boolean).map(line=>JSON.parse(line).key.memoryId),[f.primary.get('A')!.memory.id]);assert.equal(value(await call(wide.client,'mote_memories')).items.length,2);
 for(const [name,args]of [['mote_memories',{id:'memory:'+hiddenMemory.id}],['mote_read',{refs:['memory:'+hiddenMemory.id]}],['mote_materials',{sourceId:'other-source'}]] as const){const result=await call(a.client,name,args);assert.equal(result.isError,true);assert.doesNotMatch(JSON.stringify(result),/GENERATED_SAME_USER_HIDDEN|Nora prefers/);}
 const context=await f.node.authority.authenticate(f.a.token),sourceIds=['same-source'],reader=f.node.ask!.bind(context,{sourceIds,assertCurrent:()=>f.node.authority.assert(context)}).reader();sourceIds.push('other-source');assert.deepEqual((await reader.agent.memories!({limit:1})).items.map((memory:any)=>memory.id),[f.primary.get('A')!.memory.id]);reader.assertCurrent();assert.deepEqual(await b.client.readResource({uri:'mote://memories'}),beforeB);
});

test('representative B keeps the first actual Ask artifact private when MCP is revoked during a later provider read',async t=>{
 const f=await chain(t),answer=await f.answer(f.a,'A',randomUUID()),grant=await f.mint(f.a.token,'read',[]),a=await f.connect(grant),b=await f.connect(await f.mint(f.b.token,'read',[])),beforeB=await b.client.readResource({uri:'mote://memories'}),memory=f.primary.get('A')!.memory,gate=f.hold(f.directories.get(f.a.userId)!,memory.id);
 const pending=call(a.client,'mote_read',{refs:[answer.artifact,'memory:'+memory.id]}).then(result=>({result}),error=>({error:String(error)}));await gate.entered();assert.deepEqual(await b.client.readResource({uri:'mote://memories'}),beforeB);await f.ok(f.a.token,'/api/connections/'+grant.credentialId,'DELETE');gate.release();const outcome=await pending;assert.ok('error' in outcome||outcome.result.isError,JSON.stringify(outcome));assert.doesNotMatch(JSON.stringify(outcome),/GENERATED_CHAIN_B_ANSWER_A|Nora prefers|GENERATED_A_KEY/);assert.deepEqual(await b.client.readResource({uri:'mote://memories'}),beforeB);assert.equal((await f.request(f.a.token,'/api/context/status')).statusCode,200);
});
