import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {historyAskFixture,deferred} from './fixtures/history-ask-fixture.js';
import {writeMessagesResponse} from '../../../scripts/fixtures/messages-provider.js';

test('real source and context directories discover description-only matches with exact declarations and owner receipts',async t=>{
 const f=await historyAskFixture(t);
 for(const [user,owner]of [[f.a,'A'],[f.b,'B']] as const){await f.publish(user,owner);await f.checked(user.token,'/api/sources/same-source/context','PATCH',{expectedVersion:0,description:'Generated '+owner+' quantum accounting source description'});}
 const context=await f.node.authority.authenticate(f.a.token),reader=f.node.ask!.bind(context,{assertCurrent:()=>f.node.authority.assert(context)}).reader();
 const sources=await reader.agent.sources!({query:'quantum accounting'}) as any;assert.equal(sources.items.length,1);assert.equal(sources.items[0].name,'Generated source');assert.match(sources.items[0].descriptionPreview,/Generated A quantum accounting/);assert.equal(sources.items[0].descriptionCharacters,'Generated A quantum accounting source description'.length);assert.equal(sources.items[0].citationAuthority,false);assert.equal(sources.sourceContextDependencies.length,2);assert.equal(sources.sourceContextDependencies[0].kind,'metadata');
 const exact=await reader.agent.sourceContext!({sourceContextRef:sources.items[0].sourceContextRef});assert.equal(exact.attributionContext.sourceContextStatements![0].description,'Generated A quantum accounting source description');
 const catalog=await reader.agent.catalog!({path:'/context/sources',query:'quantum accounting'}) as any;assert.equal(catalog.entries.length,1);assert.equal(catalog.entries[0].sourceContextRef,sources.items[0].sourceContextRef);assert.doesNotMatch(JSON.stringify(catalog),/Generated B quantum/);
 const devices=await reader.agent.devices() as any[];assert.ok(devices.some(value=>value.deviceId==='same-device'));
 await f.checked(f.b.token,'/api/sources/same-source','PATCH',{name:'Other owner renamed'});reader.assertCurrent();
 await f.checked(f.a.token,'/api/sources/same-source','PATCH',{name:'Owner renamed'});assert.throws(()=>reader.assertCurrent());
});

for(const directory of ['sources','devices','context_index'] as const)for(const change of ['rename','disable','delete','description','heartbeat'] as const)test('real Ask '+directory+' only receipt fences '+change+' before late publication',async t=>{
 const f=await historyAskFixture(t);await f.publish(f.a,'A');await f.publish(f.b,'B');await f.checked(f.a.token,'/api/sources/same-source/context','PATCH',{expectedVersion:0,description:'Generated old quantum directory'});
 const entered=deferred(),gate=deferred();t.after(()=>gate.resolve());
 f.scripts.set('A',async(body,raw,res)=>{const uses=body.messages.flatMap((message:any)=>Array.isArray(message.content)?message.content.filter((part:any)=>part.type==='tool_use'):[]),stage=uses.length+1;
  if(!uses.some((use:any)=>use.name==='capability_discover'))return writeMessagesResponse(res,{stage,tool:{name:'capability_discover',args:{name:directory}}});
  if(!uses.some((use:any)=>use.name==='capability_execute'))return writeMessagesResponse(res,{stage,tool:{name:'capability_execute',args:{name:directory,version:'1',argumentsJson:JSON.stringify(directory==='devices'?{}:directory==='context_index'?{path:'/context/sources',query:'quantum'}:{query:'quantum',limit:1})}}});
  entered.resolve();await gate.promise;writeMessagesResponse(res,{stage,text:JSON.stringify({answer:'Generated directory-only answer A',citationIds:[]})});
 });
 const id=randomUUID();await f.checked(f.a.token,'/api/query-runs','POST',{id,input:{question:'Inspect generated directory only'}});await entered.promise;
 const pins=f.read(db=>JSON.parse(String(db.prepare('SELECT materials FROM ma_runs WHERE user_id=? AND id=?').get(f.a.userId,id)!.materials)));assert.ok(pins.some((pin:any)=>pin.sourceContext?.kind==='metadata'&&pin.sourceContext.sourceId==='same-source'));
 if(change==='rename')await f.checked(f.a.token,'/api/sources/same-source','PATCH',{name:'Generated replacement source'});
 else if(change==='disable')await f.checked(f.a.token,'/api/sources/same-source','PATCH',{enabled:false});
 else if(change==='delete')await f.checked(f.a.token,'/api/sources/same-source','DELETE');
 else if(change==='description')await f.checked(f.a.token,'/api/sources/same-source/context','PATCH',{expectedVersion:1,description:'Generated replacement quantum directory'});
 else f.read(db=>db.prepare("UPDATE pd_sources SET json=json_set(json,'$.status',json(?)) WHERE user_id=? AND id=?").run(JSON.stringify({state:'syncing',lastSyncAt:'2026-10-18T01:02:03Z'}),f.a.userId,'same-source'));
 gate.resolve();const run=await f.wait(f.a,id),expected=change==='heartbeat'||directory==='devices'&&change==='description'?'completed':'failed';assert.equal(run.status,expected,JSON.stringify(run));assert.equal(f.read(db=>Number(db.prepare('SELECT count(*) n FROM ma_turns WHERE user_id=?').get(f.a.userId)!.n)),expected==='completed'?1:0);
 // Equal source IDs and metadata retirement never revoke the other account.
 const other=randomUUID();await f.checked(f.b.token,'/api/query-runs','POST',{id:other,input:{question:'Generated unaffected B'}});assert.equal((await f.wait(f.b,other)).status,'completed');
});
