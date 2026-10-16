import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture,item,call,value} from './fixtures/mcp.js';
import {waitForState} from './fixtures/scoped-query-accounts.js';
test('actual SDK items kind selector matches its own completed formal item kind',async t=>{
 const f=await fixture(t);await f.ok(f.a.token,'/api/ingress/sources/same-source/items','POST',{batchId:'generated-kind',items:[{...item('GENERATED_KIND_FILE','kind-file'),kind:'file'}]});await waitForState(async()=>({page:await f.ok(f.a.token,'/api/materials'),tasks:await f.ok(f.a.token,'/api/tasks?limit=100')}),state=>state.page.items.some((m:any)=>m.origin.sourceId==='same-source')&&!state.tasks.items.some((task:any)=>['processing.pipeline','processing.extract','memory.materials'].includes(task.kind)&&['running','waiting'].includes(task.state)),'actual completed formal item');const a=await f.connect(await f.mint(f.a.token)),all=value(await call(a.client,'mote_items',{sourceId:'same-source'}));assert.ok(all.items.length);const kind=all.items[0].kind;assert.ok(kind);const filtered=await call(a.client,'mote_items',{sourceId:'same-source',kind});assert.equal(filtered.isError,undefined,JSON.stringify(filtered));assert.equal(value(filtered).items.length,all.items.filter((item:any)=>item.kind===kind).length,'selector must preserve matching returned kinds after formal replacement');
});
