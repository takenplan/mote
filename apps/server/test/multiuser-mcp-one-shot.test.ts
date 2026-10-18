import test,{type TestContext} from 'node:test';
import assert from 'node:assert/strict';
import {join} from 'node:path';
import {existsSync,readFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import Fastify from 'fastify';
import {Server} from '@modelcontextprotocol/sdk/server/index.js';
import {StreamableHTTPServerTransport} from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import {CallToolRequestSchema,ListResourcesRequestSchema,ListToolsRequestSchema,ReadResourceRequestSchema} from '@modelcontextprotocol/sdk/types.js';
import {identityHash} from '../src/scope/originals.js';
import {fixture,password,protocol,source,deferred} from './fixtures/mcp.js';
import {waitForState} from './fixtures/scoped-query-accounts.js';

const secrets={A:'GENERATED_ONE_SHOT_SECRET_A',B:'GENERATED_ONE_SHOT_SECRET_B'};
const uri='fixture://same',externalId=(url:string,index=0,resource=uri)=>identityHash([url,resource,index]);
async function remote(t:TestContext){
 const app=Fastify({logger:false}),servers=new Set<Server>(),calls:{owner:string;method:string;cursor?:string}[]=[],gate={operation:undefined as 'metadata'|'read'|undefined,owner:'A',entered:deferred(),released:deferred(),closed:deferred(),finished:deferred(),parts:2};
 const owner=(key:string)=>key==='Bearer '+secrets.A?'A':key==='Bearer '+secrets.B?'B':'PUBLIC';
 t.after(async()=>{gate.released.resolve();await Promise.allSettled([...servers].map(server=>server.close()));await app.close();});
 app.all('/mcp',async(req,reply)=>{
  if(req.method!=='POST')return reply.code(405).send();
  const key=owner(String(req.headers.authorization??'')),method=(req.body as {method?:string}|undefined)?.method??'';
  calls.push({owner:key,method});
  const server=new Server({name:'generated-one-shot-resource-server',version:'1'},{capabilities:{resources:{},tools:{}}});servers.add(server);
  const hold=async(operation:'metadata'|'read')=>{if(gate.operation!==operation||gate.owner!==key)return;reply.raw.once('close',()=>gate.closed.resolve());gate.entered.resolve();await gate.released.promise;gate.finished.resolve();};
  server.setRequestHandler(ListResourcesRequestSchema,async request=>{
   if(!request.params?.cursor)return {resources:[{uri:'fixture://decoy',name:'Generated directory '+key}],nextCursor:'page-two'};
   calls.push({owner:key,method:'metadata-page-two',cursor:request.params.cursor});await hold('metadata');
   return {resources:[{uri,name:'Generated Project '+key,mimeType:'text/markdown'}]};
  });
  server.setRequestHandler(ReadResourceRequestSchema,async request=>{await hold('read');return {contents:Array.from({length:gate.parts},(_,index)=>({uri:request.params.uri,mimeType:'text/markdown',text:'GENERATED_PRIVATE_'+key+'_'+index}))};});
  server.setRequestHandler(ListToolsRequestSchema,async()=>({tools:[{name:'same-tool',inputSchema:{type:'object'},annotations:{readOnlyHint:true}}]}));
  server.setRequestHandler(CallToolRequestSchema,async()=>({content:[{type:'text',text:'GENERATED_PRIVATE_TOOL_'+key}]}));
  const transport=new StreamableHTTPServerTransport({sessionIdGenerator:undefined,enableJsonResponse:true});await server.connect(transport);
  reply.raw.once('close',()=>{servers.delete(server);void server.close();});reply.hijack();await transport.handleRequest(req.raw,reply.raw,req.body);
 });
 await app.listen({host:'127.0.0.1',port:0});return {url:app.listeningOrigin+'/mcp',calls,gate};
}
const body=(url:string,owner:'A'|'B',extra:Record<string,unknown>={})=>({url,token:secrets[owner],...extra});
const configurationFile=(root:string,user:string)=>{const path=join(root,'configuration','users',user,'mote.yaml');return existsSync(path)?readFileSync(path,'utf8'):null;};
function credentials(root:string,user:string){const db=new DatabaseSync(join(root,'mote.sqlite'),{readOnly:true});try{return db.prepare('SELECT * FROM auth_credentials WHERE user_id=? ORDER BY id').all(user);}finally{db.close();}}
async function until(promise:Promise<void>,label:string){let timer:ReturnType<typeof setTimeout>|undefined;try{await Promise.race([promise,new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(Error(label)),5000);})]);}finally{clearTimeout(timer);}}
function counts(root:string,user:string){const db=new DatabaseSync(join(root,'mote.sqlite'),{readOnly:true});try{return {captures:Number(db.prepare('SELECT count(*) n FROM pd_captures WHERE user_id=?').get(user)!.n),manifests:Number(db.prepare('SELECT count(*) n FROM mc_manifests WHERE user_id=?').get(user)!.n)};}finally{db.close();}}

test('one-shot HTTP discovery works before creating any source and leaves configuration, credentials and sources untouched',async t=>{
 const external=await remote(t),f=await fixture(t),created=await f.ok(f.admin.token,'/api/admin/accounts','POST',{username:'generated-no-sources',password}),login=await f.ok(undefined,'/api/auth/login','POST',{username:created.username,password,mode:'client'});
 const before=await f.ok(login.token,'/api/configuration'),beforeFile=configurationFile(f.root,created.userId),beforeCredentials=credentials(f.root,created.userId);assert.deepEqual((await f.ok(login.token,'/api/sources')).items,[]);
 for(const target of [{url:external.url},body(external.url,'A')]){
  const discovery=await f.ok(login.token,'/api/connectors/mcp/discover','POST',target);
  assert.equal(discovery.resources.length,2);assert.equal(discovery.resources[1].mimeType,'text/markdown');assert.equal(discovery.tools[0].readOnly,true);
 }
 assert.deepEqual(await f.ok(login.token,'/api/configuration'),before);assert.equal(configurationFile(f.root,created.userId),beforeFile);assert.deepEqual(credentials(f.root,created.userId),beforeCredentials);assert.deepEqual((await f.ok(login.token,'/api/sources')).items,[]);assert.deepEqual(counts(f.root,created.userId),{captures:0,manifests:0});
 assert.equal(external.calls.some(call=>call.method==='resources/read'||call.method==='tools/call'),false);
});

test('reference one-shot import preserves page-two resource name and MIME, falls back for unlisted metadata and never reads bodies',async t=>{
 const external=await remote(t),f=await fixture(t);
 for(const [token,owner,other] of [[f.a.token,'A','B'],[f.b.token,'B','A']] as const){
  await f.ok(token,'/api/sources/same-source','PATCH',{retention:'reference'});
  assert.deepEqual(await f.ok(token,'/api/connectors/mcp/import','POST',body(external.url,owner,{sourceId:'same-source',resourceUris:[uri,'fixture://unlisted']})),{imported:2,duplicates:0});
  const record=(await f.ok(token,'/api/sources/same-source/item?externalId='+externalId(external.url))).item;
  assert.equal(record.title,'Generated Project '+owner);assert.equal(record.mimeType,'text/markdown');assert.equal(record.text,'');assert.equal(record.layer,'reference');assert.match(record.uri,/^mcp:\/\//);assert.doesNotMatch(JSON.stringify(record),new RegExp('Generated Project '+other));
  const fallback=(await f.ok(token,'/api/sources/same-source/item?externalId='+externalId(external.url,0,'fixture://unlisted'))).item;
  assert.equal(fallback.title,'MCP reference');assert.equal(fallback.mimeType,'text/plain');assert.equal(fallback.text,'');
  assert.ok(external.calls.some(call=>call.owner===owner&&call.method==='metadata-page-two'&&call.cursor==='page-two'));
 }
 assert.equal(external.calls.some(call=>call.method==='resources/read'),false,'reference imports only request directory metadata');
});

test('one-shot A/B resource and confirmed read-only tool imports use existing owned sources, retain no credentials and deduplicate across restart',async t=>{
 const external=await remote(t),f=await fixture(t),beforeA=await f.ok(f.a.token,'/api/configuration'),beforeB=await f.ok(f.b.token,'/api/configuration'),beforeFiles=[configurationFile(f.root,f.a.userId),configurationFile(f.root,f.b.userId)];
 for(const [token,owner,other] of [[f.a.token,'A','B'],[f.b.token,'B','A']] as const){
  assert.deepEqual(await f.ok(token,'/api/connectors/mcp/import','POST',body(external.url,owner,{sourceId:'same-source',resourceUris:[uri]})),{imported:2,duplicates:0});
  const items=await f.ok(token,'/api/source-items?sourceId=same-source');assert.match(JSON.stringify(items),new RegExp('GENERATED_PRIVATE_'+owner));assert.doesNotMatch(JSON.stringify(items),new RegExp('GENERATED_PRIVATE_'+other));
  assert.deepEqual(await f.ok(token,'/api/connectors/mcp/import','POST',body(external.url,owner,{sourceId:'other-source',tool:{name:'same-tool',arguments:{},confirmedReadOnly:true}})),{imported:1,duplicates:0});
  assert.match(JSON.stringify(await f.ok(token,'/api/source-items?sourceId=other-source')),new RegExp('GENERATED_PRIVATE_TOOL_'+owner));
  const context=await f.node.authority.authenticate(token),services=f.node.services.forUser(context),exports=JSON.stringify([await services.exportUser('configuration'),await services.exportUser('mcp')]);assert.doesNotMatch(exports,/GENERATED_ONE_SHOT_SECRET|Bearer/);
 }
 assert.deepEqual(await f.ok(f.a.token,'/api/configuration'),beforeA);assert.deepEqual(await f.ok(f.b.token,'/api/configuration'),beforeB);assert.deepEqual([configurationFile(f.root,f.a.userId),configurationFile(f.root,f.b.userId)],beforeFiles);
 const db=new DatabaseSync(join(f.root,'mote.sqlite'),{readOnly:true});try{const manifests=db.prepare('SELECT * FROM mc_manifests').all();assert.equal(manifests.length,4);assert.ok(manifests.every(row=>row.connection_id===''));assert.doesNotMatch(JSON.stringify(manifests),/GENERATED_ONE_SHOT_SECRET|Bearer/);}finally{db.close();}
 const calls=external.calls.length;assert.equal((await f.request(f.a.token,'/api/connectors/mcp/import','POST',body(external.url,'A',{sourceId:'absent',resourceUris:[uri]}))).statusCode,404);assert.equal(external.calls.length,calls,'missing sources are rejected before external I/O');
 await f.restart();assert.deepEqual(await f.ok(f.a.token,'/api/connectors/mcp/import','POST',body(external.url,'A',{sourceId:'same-source',resourceUris:[uri]})),{imported:0,duplicates:2});
 external.gate.parts=1;assert.deepEqual(await f.ok(f.a.token,'/api/connectors/mcp/import','POST',body(external.url,'A',{sourceId:'same-source',resourceUris:[uri]})),{imported:1,duplicates:1});
 assert.equal((await f.ok(f.a.token,'/api/source-items?sourceId=same-source')).items.length,1);assert.equal((await f.ok(f.b.token,'/api/source-items?sourceId=same-source')).items.length,2);assert.equal((await f.ok(f.a.token,'/api/source-items?sourceId=other-source')).items.length,1);
});

for(const action of ['account-revoke','source-delete','source-recreate'] as const)test('held reference directory metadata cannot publish after '+action+' while B remains usable',async t=>{
 const external=await remote(t),f=await fixture(t);f.beforeClose(()=>external.gate.released.resolve());
 for(const token of [f.a.token,f.b.token])await f.ok(token,'/api/sources/same-source','PATCH',{retention:'reference'});
 external.gate.operation='metadata';const pending=f.request(f.a.token,'/api/connectors/mcp/import','POST',body(external.url,'A',{sourceId:'same-source',resourceUris:[uri]}));
 await until(external.gate.entered.promise,'reference metadata was never requested');
 if(action==='account-revoke')await f.ok(f.a.token,'/api/auth/logout','POST',{});
 else{await f.ok(f.a.token,'/api/sources/same-source','DELETE',{});if(action==='source-recreate')await f.ok(f.a.token,'/api/ingress/sources','POST',{...source(),retention:'reference'});}
 external.gate.released.resolve();const response=await pending;assert.ok([401,404,409].includes(response.statusCode),response.body);assert.deepEqual(counts(f.root,f.a.userId),{captures:0,manifests:0});
 assert.deepEqual(await f.ok(f.b.token,'/api/connectors/mcp/import','POST',body(external.url,'B',{sourceId:'same-source',resourceUris:[uri]})),{imported:1,duplicates:0});assert.equal(external.calls.some(call=>call.method==='resources/read'),false);
});

for(const action of ['account-revoke','source-delete','disconnect'] as const)test('actual one-shot HTTP held import rejects late results after '+action+' while B remains usable',async t=>{
 const external=await remote(t),f=await fixture(t);f.beforeClose(()=>external.gate.released.resolve());await f.node.app.listen({host:'127.0.0.1',port:0});external.gate.operation='read';
 const abort=new AbortController(),pending=fetch(f.node.app.listeningOrigin+'/api/connectors/mcp/import',{method:'POST',headers:{...protocol,authorization:'Bearer '+f.a.token,'content-type':'application/json'},body:JSON.stringify(body(external.url,'A',{sourceId:'same-source',resourceUris:[uri]})),signal:abort.signal}).then(async response=>({status:response.status,body:await response.text()}),error=>({error}));
 await until(external.gate.entered.promise,'snapshot body was never requested');
 if(action==='account-revoke')await f.ok(f.a.token,'/api/auth/logout','POST',{});
 if(action==='source-delete')await f.ok(f.a.token,'/api/sources/same-source','DELETE',{});
 if(action==='disconnect'){abort.abort();assert.ok('error' in await pending);await until(external.gate.closed.promise,'client disconnect did not cancel the outgoing resource request');}
 external.gate.released.resolve();const result=await pending;if(action!=='disconnect'){assert.ok('status' in result);assert.ok([401,404,409].includes(result.status),result.body);}
 else{const context=await f.node.authority.authenticate(f.a.token);await waitForState(async()=>f.node.mcp!.forUser(context).sourceStatuses(['same-source']).get('same-source'),status=>status?.state==='error','one-shot cancellation did not settle');}
 assert.deepEqual(counts(f.root,f.a.userId),{captures:0,manifests:0});assert.deepEqual(await f.ok(f.b.token,'/api/connectors/mcp/import','POST',body(external.url,'B',{sourceId:'same-source',resourceUris:[uri]})),{imported:2,duplicates:0});
});
