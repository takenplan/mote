import test from 'node:test';
import assert from 'node:assert/strict';
import {materialId} from '../src/materials.js';
import {fixture,item} from './fixtures/ask-reader-host.js';
import {defaultProcessingSettings} from '../src/scope/processing-schema.js';

/** Generated content enters the actual owned ingress host. Context observations
 * exercise the registered production HTTP routes and durable cursor lifecycle. */
async function archive(t:import('node:test').TestContext,count=12){
 const f=await fixture(t),ids=new Set<string>();
 for(const [user,owner]of [[f.a,'A'],[f.b,'B']] as const){
  const configuration=await f.ok(user.token,'/api/configuration');await f.ok(user.token,'/api/configuration/processing','PUT',{revision:configuration.revision,value:{...defaultProcessingSettings(),automatic:false,understandingEnabled:false}});
  const context=await f.node.authority.authenticate(user.token),ingress=f.node.ingress.bindSource(context,['same-source','other-source'],()=>{});
  for(let index=0;index<count;index++){
   const externalId='generated-page-'+index,sourceId=index%2?'same-source':'other-source',text='GENERATED_CONTEXT_'+owner+' '+index+' '+('生成资料 '+index+' ').repeat(240),receipt=ingress.receiveSourceItems(sourceId,'batch:'+externalId,[{...item(text,externalId),kind:'file',layer:'original'}]);
   const material=ingress.publishMaterial({id:materialId(sourceId,externalId),kind:'document',schemaVersion:1,title:'Generated document '+owner+' '+index,origin:{sourceId,externalId,deviceId:'same-device',firstAt:'2026-10-16T00:00:00Z',lastAt:'2026-10-16T00:00:00Z'},blocks:[{id:'body',kind:'text',format:'plain',text,memberIds:['original']}],members:[{id:'original',kind:'capture',ref:'capture:'+receipt.captures[0].id}],coverage:{state:'complete'},fidelity:{state:'lossless'},retention:{original:'retained',policy:'keep'}});
   if(owner==='A')ids.add(material.id);
  }
 }
 return {...f,get node(){return f.node;},ids};
}
const parameters=(values:Record<string,string|number>)=>new URLSearchParams(Object.entries(values).map(([key,value])=>[key,String(value)])).toString();

test('public Context search honors explicit response size without skipping same-time owned entities across restart',async t=>{
 const f=await archive(t),first=await f.ok(f.a.token,'/api/context/search?'+parameters({query:'GENERATED_CONTEXT_A',limit:30,maxCharacters:1000}));
 assert.ok(first.items.length>0);assert.ok(first.items.length<12);assert.equal(first.truncated,true);assert.equal(first.coverage.truncated,true);assert.ok(first.nextCursor);assert.ok(JSON.stringify(first).length<=1000);
 for(const changed of [{query:'GENERATED_CONTEXT_B'},{limit:20},{maxCharacters:3000}]){
  const params={query:'GENERATED_CONTEXT_A',limit:30,maxCharacters:1000,...changed,cursor:first.nextCursor};assert.equal((await f.request(f.a.token,'/api/context/search?'+parameters(params))).statusCode,400);
 }
 assert.equal((await f.request(f.b.token,'/api/context/search?'+parameters({query:'GENERATED_CONTEXT_A',limit:30,maxCharacters:1000,cursor:first.nextCursor}))).statusCode,400);
 assert.equal((await f.request(f.a.token,'/api/context/browse?'+parameters({query:'GENERATED_CONTEXT_A',limit:30,maxCharacters:1000,cursor:first.nextCursor}))).statusCode,400);
 await f.restart();const seen=first.items.map((card:any)=>card.id);let cursor=first.nextCursor;
 while(cursor){const page=await f.ok(f.a.token,'/api/context/search?'+parameters({query:'GENERATED_CONTEXT_A',limit:30,maxCharacters:1000,cursor}));assert.ok(JSON.stringify(page).length<=1000);assert.equal(page.coverage.recordsReturned,page.items.length);assert.equal(page.truncated,Boolean(page.nextCursor));assert.equal(page.coverage.truncated,page.truncated);assert.doesNotMatch(JSON.stringify(page),/GENERATED_CONTEXT_B|Generated document B/);seen.push(...page.items.map((card:any)=>card.id));assert.notEqual(page.nextCursor,cursor);cursor=page.nextCursor;assert.ok(seen.length<=12);}
 assert.equal(seen.length,12);assert.deepEqual(new Set(seen),f.ids);
 const context=await f.node.authority.authenticate(f.a.token),reader=f.node.ask!.bind(context,{sourceIds:['same-source','other-source'],assertCurrent:()=>{}}).reader(),internal=await reader.agent.timeline({limit:100});assert.equal(internal.items.length,12);assert.ok(JSON.stringify(internal).length>16000,'the external response cap must not constrain internal Ask original reads');
});

test('public Context browse retains source navigation, bounded output and readable expansion',async t=>{
 const f=await archive(t,6),sources=new Set<string>();let cursor:string|undefined;
 do{
  const page=await f.ok(f.a.token,'/api/context/browse?'+parameters({limit:30,maxCharacters:3000,...(cursor?{cursor}:{})}));assert.ok(JSON.stringify(page).length<=3000);assert.equal(page.truncated,Boolean(page.nextCursor));
  for(const card of page.items){assert.equal(card.kind,'source-collection');assert.equal(card.expansion.kind,'search');assert.ok(card.expansion.scope.sourceId);sources.add(card.expansion.scope.sourceId);const read=await f.ok(f.a.token,'/api/context/read','POST',{refs:[card.ref]});assert.equal(read.items[0].kind,'collection');assert.equal(read.items[0].text,'');const records=await f.ok(f.a.token,'/api/context/search?'+parameters({...card.expansion.scope,limit:30,maxCharacters:3000}));assert.ok(records.items.length>0);assert.ok(records.items.every((item:any)=>item.origin.sourceId===card.expansion.scope.sourceId));}
  cursor=page.nextCursor??undefined;
 }while(cursor);
 assert.deepEqual(sources,new Set(['same-source','other-source']));
});

test('public ranked Context retrieval retains metadata and reports omitted suffix cards without cursors',async t=>{
 const f=await archive(t),page=await f.ok(f.a.token,'/api/context/retrieve?'+parameters({query:'GENERATED_CONTEXT_A',limit:30,maxCharacters:3000}));
 assert.ok(JSON.stringify(page).length<=3000);assert.ok(page.items.length>0);assert.ok(page.items.length<12);assert.equal(page.truncated,true);assert.equal(page.nextCursor,null);assert.ok(page.retrieval);assert.doesNotMatch(JSON.stringify(page),/GENERATED_CONTEXT_B|Generated document B/);
 const minimum=await f.request(f.a.token,'/api/context/retrieve?'+parameters({query:'GENERATED_CONTEXT_A',limit:30,maxCharacters:1000}));if(minimum.statusCode===200)assert.ok(minimum.body.length<=1000);else assert.equal(minimum.statusCode,413,minimum.body);
 assert.equal((await f.request(f.a.token,'/api/context/retrieve?'+parameters({query:'GENERATED_CONTEXT_A',limit:30,maxCharacters:3000,cursor:'generated-invalid-ranked-cursor'}))).statusCode,400);
 const maximum=await f.ok(f.a.token,'/api/context/search?'+parameters({query:'GENERATED_CONTEXT_A',limit:100,maxCharacters:24000}));assert.ok(JSON.stringify(maximum).length<=16000);assert.equal((await f.ok(f.a.token,'/api/context/status')).limits.maxCharacters,16000);
});

test('public browse keeps its 200-candidate scan window and later source collections remain reachable',async t=>{
 const f=await fixture(t),configuration=await f.ok(f.a.token,'/api/configuration');await f.ok(f.a.token,'/api/configuration/processing','PUT',{revision:configuration.revision,value:{...defaultProcessingSettings(),automatic:false,understandingEnabled:false}});
 const context=await f.node.authority.authenticate(f.a.token),ingress=f.node.ingress.bindSource(context,['same-source','other-source'],()=>{});
 for(let index=0;index<202;index++){
  const sourceId=index===201?'other-source':'same-source',externalId='generated-scan-'+index,at=index===201?'2026-10-15T00:00:00Z':'2026-10-16T00:00:00Z',text='GENERATED_BROWSE_SCAN '+index,receipt=ingress.receiveSourceItems(sourceId,'batch:'+externalId,[{...item(text,externalId),observedAt:at,kind:'file',layer:'original'}]);
  ingress.publishMaterial({id:materialId(sourceId,externalId),kind:'document',schemaVersion:1,title:'Generated scan '+index,origin:{sourceId,externalId,firstAt:at,lastAt:at},blocks:[{id:'body',kind:'text',format:'plain',text,memberIds:['original']}],members:[{id:'original',kind:'capture',ref:'capture:'+receipt.captures[0].id}],coverage:{state:'complete'},fidelity:{state:'lossless'},retention:{original:'retained',policy:'keep'}});
 }
 const first=await f.ok(f.a.token,'/api/context/browse?limit=1&maxCharacters=3000');assert.equal(first.items.length,1);assert.equal(first.items[0].expansion.scope.sourceId,'same-source');assert.equal(first.coverage.recordsScanned,200);assert.ok(first.nextCursor);assert.equal(first.truncated,true);
 const second=await f.ok(f.a.token,'/api/context/browse?'+parameters({limit:1,maxCharacters:3000,cursor:first.nextCursor}));assert.equal(second.items.length,1);assert.equal(second.items[0].expansion.scope.sourceId,'same-source');assert.ok(second.nextCursor);assert.notEqual(second.nextCursor,first.nextCursor);
 const third=await f.ok(f.a.token,'/api/context/browse?'+parameters({limit:1,maxCharacters:3000,cursor:second.nextCursor}));assert.equal(third.items.length,1);assert.equal(third.items[0].expansion.scope.sourceId,'other-source');assert.equal(third.nextCursor,null);assert.equal(third.truncated,false);assert.ok([first,second,third].every(page=>JSON.stringify(page).length<=3000));
});
