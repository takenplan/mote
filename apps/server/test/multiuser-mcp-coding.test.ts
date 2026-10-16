import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture,source,item,call,value} from './fixtures/mcp.js';
import {waitForState} from './fixtures/scoped-query-accounts.js';

test('actual SDK Coding reads use complete genuine dialogue projections and never expose retained tool or host bodies',async t=>{
 const f=await fixture(t),cases=[];
 for(const [user,owner]of [[f.a,'A'],[f.b,'B']] as const){
  await f.ok(user.token,'/api/ingress/sources','POST',{...source('same-coding'),kind:'coding-agent',retention:'archive'});const view=await f.ok(user.token,'/api/configuration'),processing=await f.ok(user.token,'/api/processing');await f.ok(user.token,'/api/configuration/processing','PUT',{revision:view.revision,value:{...processing.settings,automatic:true,understandingEnabled:false,summarize:false,semanticTurns:false}});
  const event=(id:string,text:string,coding:Record<string,unknown>)=>({...item(text,id),document:{coding:{version:1,provider:'codex',sessionId:'same-session',projectKey:'same-project',eventId:id,part:0,parts:1,...coding}}}),human='<environment_context>GENERATED_HOST_ENV_'+owner+'</environment_context>\nGENERATED_HUMAN_'+owner,split=human.indexOf('</environment_context>')+7,items=[event('tool','GENERATED_TOOL_'+owner,{role:'tool_result'}),event('analysis','GENERATED_ANALYSIS_'+owner,{role:'assistant',attribution:'agent',channel:'analysis'}),event('unknown','GENERATED_UNATTRIBUTED_'+owner,{role:'user'}),event('part-0',human.slice(0,split),{eventId:'human',role:'user',attribution:'human',part:0,parts:2}),event('part-1',human.slice(split),{eventId:'human',role:'user',attribution:'human',part:1,parts:2}),event('final','GENERATED_FINAL_'+owner,{role:'assistant',attribution:'agent',channel:'final'})];
  const receipt=await f.ok(user.token,'/api/ingress/sources/same-coding/items','POST',{batchId:'same-coding-batch',items});cases.push({user,owner,items,receipt});
 }
 for(const {user,owner,items,receipt}of cases){
  await waitForState(async()=>({page:await f.ok(user.token,'/api/materials?kind=mote.coding-session'),tasks:await f.ok(user.token,'/api/tasks?limit=100')}),state=>state.page.items.some((material:any)=>material.memberCount===items.length)&&!state.tasks.items.some((task:any)=>['processing.pipeline','processing.extract','memory.materials'].includes(task.kind)&&['running','waiting'].includes(task.state)),'complete actual Coding projection '+owner,20000);
  const session=await f.connect(await f.mint(user.token,'read',['same-coding'])),catalog=await call(session.client,'mote_materials',{sourceId:'same-coding'});assert.equal(catalog.isError,undefined,JSON.stringify(catalog));assert.ok(value(catalog).items.length);
  let disclosed='';for(const material of value(catalog).items){const read=await call(session.client,'mote_material_read',{ref:material.ref});assert.equal(read.isError,undefined,JSON.stringify(read));disclosed+=value(read).text;for(const forbidden of ['GENERATED_TOOL_','GENERATED_HOST_ENV_','GENERATED_ANALYSIS_','GENERATED_UNATTRIBUTED_','GENERATED_HUMAN_'+(owner==='A'?'B':'A'),'GENERATED_FINAL_'+(owner==='A'?'B':'A')])assert.ok(!JSON.stringify(read).includes(forbidden),forbidden);}
  assert.ok(disclosed.includes('GENERATED_HUMAN_'+owner));assert.ok(disclosed.includes('GENERATED_FINAL_'+owner));for(const query of ['GENERATED_TOOL_'+owner,'GENERATED_HOST_ENV_'+owner])assert.deepEqual(value(await call(session.client,'mote_search',{query})).items,[]);assert.ok(value(await call(session.client,'mote_search',{query:'GENERATED_HUMAN_'+owner})).items.length);
  const rejected=await call(session.client,'mote_read',{refs:['capture:'+receipt.captures[0].id]});assert.equal(rejected.isError,true);assert.doesNotMatch(JSON.stringify(rejected),/GENERATED_TOOL_|GENERATED_HOST_ENV_/);
  const context=await f.node.authority.authenticate(user.token),bound=f.node.ingress.bindSource(context,['same-coding'],()=>{});for(let index=0;index<items.length;index++)assert.equal(JSON.parse(bound.readOriginal(receipt.captures[index].original.ref).bytes.toString()).text,items[index].text,'retained M03 original bytes are preserved independently of query projection');
 }
});
