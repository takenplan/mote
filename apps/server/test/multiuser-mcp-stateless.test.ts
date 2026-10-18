import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture,item,source,call,value,password} from './fixtures/mcp.js';
import {memoryFixture} from './fixtures/mcp-memory.js';

type Fixture=Awaited<ReturnType<typeof fixture>>;
const headers={accept:'application/json, text/event-stream','content-type':'application/json'};
async function endpoint(f:Fixture){
 if(!f.node.app.server.listening)await f.node.app.listen({host:'127.0.0.1',port:0});
 return f.node.app.listeningOrigin+'/mcp';
}
async function post(f:Fixture,token:string,method:string,params?:unknown,extra:Record<string,string>={}){
 return fetch(await endpoint(f),{method:'POST',headers:{...headers,authorization:'Bearer '+token,...extra},body:JSON.stringify({jsonrpc:'2.0',id:1,method,...(params===undefined?{}:{params})})});
}
async function result(f:Fixture,token:string,method:string,params?:unknown,extra:Record<string,string>={}){
 const response=await post(f,token,method,params,extra);assert.equal(response.status,200,await response.clone().text());assert.equal(response.headers.get('mcp-session-id'),null);return (await response.json() as any).result;
}
const tool=(name:string,args:Record<string,unknown>={})=>({name,arguments:args});

test('original uninitialized stateless HTTP POSTs keep real source writes, tools and same-URI resources bound to A/B',async t=>{
 const f=await fixture(t),grants=[];
 for(const [user,owner]of [[f.a,'A'],[f.b,'B']] as const){
  await f.ok(user.token,'/api/sources/same-source','PATCH',{name:'Generated private source '+owner});
  const read=await f.mint(user.token),write=await f.mint(user.token,'write');grants.push({read,write});
  // These are the client's first MCP requests: no initialize or session header.
  const tools=await result(f,read.token,'tools/list');assert.ok(tools.tools.some((entry:any)=>entry.name==='mote_items'));
  assert.deepEqual((await result(f,write.token,'tools/list')).tools.map((entry:any)=>entry.name),['mote_put_item']);
  assert.equal((await result(f,write.token,'tools/call',tool('mote_put_item',{sourceId:'same-source',item:item('GENERATED_STATELESS_PRIVATE_'+owner)}))).isError,undefined);
 }
 const pages=await Promise.all(grants.map(({read})=>result(f,read.token,'tools/call',tool('mote_items',{sourceId:'same-source'}))));
 for(const [index,owner,other]of [[0,'A','B'],[1,'B','A']] as const){
  assert.match(JSON.stringify(pages[index]),new RegExp('GENERATED_STATELESS_PRIVATE_'+owner));assert.doesNotMatch(JSON.stringify(pages[index]),new RegExp('GENERATED_STATELESS_PRIVATE_'+other));
  const {read,write}=grants[index],catalog=await result(f,read.token,'resources/read',{uri:'mote://sources'});
  assert.match(JSON.stringify(catalog),new RegExp('Generated private source '+owner));assert.doesNotMatch(JSON.stringify(catalog),new RegExp('Generated private source '+other));
  assert.deepEqual((await result(f,read.token,'resources/list')).resources.map((entry:any)=>entry.uri).sort(),['mote://memories','mote://sources']);
  assert.equal((await result(f,read.token,'tools/call',tool('mote_items',{sourceId:'other-source'}))).isError,true);
  assert.equal((await result(f,write.token,'tools/call',tool('mote_put_item',{sourceId:'other-source',item:item('DENIED')}))).isError,true);
 }
 assert.equal((await post(f,grants[0].read.token,'tools/call',tool('mote_sources',{userId:f.b.userId}))).status,400);
 assert.equal((await post(f,f.a.token,'tools/list')).status,401);
 assert.equal((await post(f,grants[0].read.token,'tools/list',undefined,{origin:'https://foreign.invalid'})).status,403);
 const web=await f.request(undefined,'/api/auth/login','POST',{username:'generated-b',password,mode:'web'}),cookie=String(web.headers['set-cookie']).split(';')[0];
 assert.match(JSON.stringify(await result(f,grants[0].read.token,'resources/read',{uri:'mote://sources'},{cookie})),/Generated private source A/);
});

test('stateless requests survive a real host restart without reinitializing while optional SDK sessions remain credential-bound',async t=>{
 const f=await fixture(t);await f.put(f.a.token,'GENERATED_RESTART_PRIVATE_A');await f.put(f.b.token,'GENERATED_RESTART_PRIVATE_B');const ga=await f.mint(f.a.token),gb=await f.mint(f.b.token),session=await f.connect(ga),oldId=session.transport.sessionId!;
 assert.ok(oldId);assert.equal(value(await call(session.client,'mote_sources')).items[0].id,'same-source');
 assert.equal((await post(f,gb.token,'tools/list',undefined,{'mcp-session-id':oldId})).status,404);
 const terminated=await f.connect(ga),terminatedId=terminated.transport.sessionId!;await terminated.transport.terminateSession();
 assert.equal((await post(f,ga.token,'tools/list',undefined,{'mcp-session-id':terminatedId})).status,404);
 await f.restart();
 assert.equal((await post(f,ga.token,'tools/list',undefined,{'mcp-session-id':oldId})).status,404);
 assert.match(JSON.stringify(await result(f,ga.token,'tools/call',tool('mote_items',{sourceId:'same-source'}))),/GENERATED_RESTART_PRIVATE_A/);
 const resumed=await f.connect(ga);assert.ok(resumed.transport.sessionId);assert.notEqual(resumed.transport.sessionId,oldId);assert.equal(value(await call(resumed.client,'mote_sources')).items.length,1);
 await f.ok(f.a.token,'/api/connections/'+ga.credentialId,'DELETE');assert.equal((await post(f,ga.token,'tools/list')).status,401);await assert.rejects(call(resumed.client,'mote_sources'));
 assert.match(JSON.stringify(await result(f,gb.token,'tools/call',tool('mote_items',{sourceId:'same-source'}))),/GENERATED_RESTART_PRIVATE_B/);
});

test('new stateless requests enforce persisted source incarnations and account epochs without changing B',async t=>{
 const f=await fixture(t),ga=await f.mint(f.a.token),gb=await f.mint(f.b.token);
 assert.equal(value(await result(f,ga.token,'tools/call',tool('mote_sources'))).items.length,1);
 await f.ok(f.a.token,'/api/sources/same-source','DELETE');await f.ok(f.a.token,'/api/ingress/sources','POST',source());await f.restart();
 assert.equal((await post(f,ga.token,'tools/list')).status,401);
 const next=await f.mint(f.a.token);assert.equal(value(await result(f,next.token,'tools/call',tool('mote_sources'))).items.length,1);
 await f.ok(f.admin.token,'/api/admin/accounts/'+f.a.userId,'PATCH',{disabled:true});await f.ok(f.admin.token,'/api/admin/accounts/'+f.a.userId,'PATCH',{disabled:false});
 assert.equal((await post(f,next.token,'tools/list')).status,401);assert.equal(value(await result(f,gb.token,'tools/call',tool('mote_sources'))).items.length,1);
});

for(const action of ['credential-revocation','source-recreation','http-disconnect'] as const)test('stateless real provider result is fenced after '+action+' while B keeps the same resource URI',async t=>{
 const f=await memoryFixture(t,true);
 for(const [user,owner]of [[f.a,'A'],[f.b,'B']] as const){const material=await f.publish(user,owner);await f.extract(user,material.id);}
 const directories=await f.externalize([f.a]),memory=(await f.ok(f.a.token,'/api/memories')).items[0],gate=f.hold(directories.get(f.a.userId)!,memory.id),ga=await f.mint(f.a.token),gb=await f.mint(f.b.token),abort=new AbortController(),url=await endpoint(f);
 const pending=fetch(url,{method:'POST',headers:{...headers,authorization:'Bearer '+ga.token},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'resources/read',params:{uri:'mote://memories'}}),signal:abort.signal}).then(async response=>({status:response.status,body:await response.text()}),error=>({error:String(error)}));
 await gate.entered();assert.match(JSON.stringify(await result(f,gb.token,'resources/read',{uri:'mote://memories'})),/Generated B/);
 if(action==='credential-revocation')await f.ok(f.a.token,'/api/connections/'+ga.credentialId,'DELETE');
 if(action==='source-recreation'){await f.ok(f.a.token,'/api/sources/same-source','DELETE');await f.ok(f.a.token,'/api/ingress/sources','POST',source());}
 if(action==='http-disconnect'){abort.abort();assert.ok('error' in await pending);}
 gate.release();const outcome=await pending;
 if(action!=='http-disconnect'){assert.ok('body' in outcome);assert.ok(JSON.parse(outcome.body).error,JSON.stringify(outcome));}
 assert.doesNotMatch(JSON.stringify(outcome),/Nora prefers|Generated A|GENERATED_A_KEY|GENERATED_MCP_MEMORY_A/);
 assert.match(JSON.stringify(await result(f,gb.token,'resources/read',{uri:'mote://memories'})),/Generated B/);
});
