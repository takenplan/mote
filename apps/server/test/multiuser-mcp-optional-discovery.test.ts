import test,{type TestContext} from 'node:test';
import assert from 'node:assert/strict';
import Fastify from 'fastify';
import {Server} from '@modelcontextprotocol/sdk/server/index.js';
import {StreamableHTTPServerTransport} from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import {CallToolRequestSchema,ErrorCode,ListResourcesRequestSchema,ListResourceTemplatesRequestSchema,ListToolsRequestSchema,McpError,ReadResourceRequestSchema} from '@modelcontextprotocol/sdk/types.js';
import {fixture} from './fixtures/mcp.js';

/** Use the official advanced SDK API rather than a client stub. A resource-only
 * server can register static list/read handlers without a templates handler;
 * the SDK itself produces the MethodNotFound JSON-RPC response. */
async function staticResourceServer(t:TestContext,templates:'absent'|'failed'){
 const app=Fastify({logger:false}),servers=new Set<Server>(),calls:{key:string;method:string}[]=[];
 t.after(async()=>{await Promise.allSettled([...servers].map(server=>server.close()));await app.close();});
 app.all('/mcp',async(req,reply)=>{
  if(req.method!=='POST')return reply.code(405).send();
  const key=String(req.headers.authorization??''),method=(req.body as {method?:string}|undefined)?.method??'';
  calls.push({key,method});
  const server=new Server({name:'generated-static-resource-server',version:'1'},{capabilities:{resources:{},tools:{}}});
  servers.add(server);
  server.setRequestHandler(ListResourcesRequestSchema,async()=>({resources:[{uri:'fixture://same',name:'Generated '+key,mimeType:'text/markdown'}]}));
  server.setRequestHandler(ReadResourceRequestSchema,async()=>({contents:[{uri:'fixture://same',mimeType:'text/markdown',text:'GENERATED_BODY_'+key}]}));
  server.setRequestHandler(ListToolsRequestSchema,async()=>({tools:[{name:'same-tool',description:'Generated '+key,inputSchema:{type:'object'},annotations:{readOnlyHint:true}}]}));
  server.setRequestHandler(CallToolRequestSchema,async()=>({content:[{type:'text',text:'GENERATED_TOOL_'+key}]}));
  if(templates==='failed')server.setRequestHandler(ListResourceTemplatesRequestSchema,async()=>{throw new McpError(ErrorCode.InternalError,'GENERATED_TEMPLATE_FAILURE_'+key);});
  const transport=new StreamableHTTPServerTransport({sessionIdGenerator:undefined,enableJsonResponse:true});
  await server.connect(transport);
  reply.raw.once('close',()=>{servers.delete(server);void server.close();});
  reply.hijack();await transport.handleRequest(req.raw,reply.raw,req.body);
 });
 await app.listen({host:'127.0.0.1',port:0});
 return {url:app.listeningOrigin+'/mcp',calls};
}

test('actual SDK static-resource discovery tolerates an absent templates method and preserves A/B resource and tool catalogs',async t=>{
 const external=await staticResourceServer(t,'absent'),f=await fixture(t);
 await f.configure(f.a.token,external.url,'GENERATED_A');await f.configure(f.b.token,external.url,'GENERATED_B');
 for(const [token,owner,other] of [[f.a.token,'GENERATED_A','GENERATED_B'],[f.b.token,'GENERATED_B','GENERATED_A']]){
  const discovery=await f.ok(token,'/api/connectors/mcp/discover','POST',{connectionId:'same-connection'});
  assert.deepEqual(discovery.resources,[{uri:'fixture://same',name:'Generated Bearer '+owner,mimeType:'text/markdown'}]);
  assert.deepEqual(discovery.tools,[{name:'same-tool',description:'Generated Bearer '+owner,readOnly:true}]);
  assert.deepEqual(discovery.templates,[]);assert.deepEqual(discovery.prompts,[]);
  assert.doesNotMatch(JSON.stringify(discovery),new RegExp(other));
  assert.ok(external.calls.some(call=>call.key==='Bearer '+owner&&call.method==='resources/templates/list'));
  assert.ok(external.calls.some(call=>call.key==='Bearer '+owner&&call.method==='tools/list'));
 }
 assert.equal(external.calls.filter(call=>['resources/read','tools/call'].includes(call.method)).length,0,'discovery reads directory metadata only');
});

test('actual SDK discovery still reports a genuine templates failure instead of presenting an empty successful catalog',async t=>{
 const external=await staticResourceServer(t,'failed'),f=await fixture(t);
 await f.configure(f.a.token,external.url,'GENERATED_A');
 const response=await f.request(f.a.token,'/api/connectors/mcp/discover','POST',{connectionId:'same-connection'});
 assert.equal(response.statusCode,502,response.body);
 assert.match(response.body,/mcp_operation_failed/);assert.doesNotMatch(response.body,/GENERATED_TEMPLATE_FAILURE|GENERATED_A/);
 assert.ok(external.calls.some(call=>call.method==='resources/list'));
 assert.ok(external.calls.some(call=>call.method==='resources/templates/list'));
});
