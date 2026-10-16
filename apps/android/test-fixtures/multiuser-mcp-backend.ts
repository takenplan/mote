import type {TestContext} from 'node:test';
import {randomUUID} from 'node:crypto';
import Fastify from 'fastify';
import {McpServer} from '@modelcontextprotocol/sdk/server/mcp.js';
import {StreamableHTTPServerTransport} from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import {z} from 'zod';
import {fixture,password} from '../../server/test/fixtures/mcp.js';

// Actual SDK and M01/M03/M04/M11 hosts. The only remote is this generated
// loopback service; no third-party MCP, model, calendar or real account is used.
const cleanups:Array<()=>unknown>=[];
const t={after:(callback:()=>unknown)=>cleanups.push(callback)} as unknown as TestContext;
const f=await fixture(t);
const remote=Fastify({logger:false});
const sessions=new Map<string,{server:McpServer;transport:StreamableHTTPServerTransport;owner:string}>();
remote.all('/mcp',async(request,reply)=>{
 const owner=String(request.headers.authorization).includes('GENERATED_A')?'A':'B';
 const id=request.headers['mcp-session-id'];let session=typeof id==='string'?sessions.get(id):undefined;
 if(!session){
  const server=new McpServer({name:'generated-android-MCP',version:'1'});
  const transport=new StreamableHTTPServerTransport({sessionIdGenerator:randomUUID,enableJsonResponse:true});
  session={server,transport,owner};
  server.registerResource('GENERATED_'+owner+'_RESOURCE','fixture://same',{mimeType:'text/plain'},async uri=>({contents:[{uri:uri.href,mimeType:'text/plain',text:'GENERATED_'+owner+'_PRIVATE_MCP_CONTENT'}]}));
  server.registerTool('generated-read',{inputSchema:{label:z.string().optional()},annotations:{readOnlyHint:true}},async()=>({content:[{type:'text',text:'GENERATED_'+owner+'_READ_ONLY_TOOL_CONTENT'}]}));
  await server.connect(transport);
 }
 if(session.owner!==owner)return reply.code(401).send({error:'wrong_generated_owner'});
 const current=session;session.transport.onclose=()=>{if(current.transport.sessionId)sessions.delete(current.transport.sessionId);};
 reply.hijack();await session.transport.handleRequest(request.raw,reply.raw,request.body);
 if(session.transport.sessionId&&request.method!=='DELETE')sessions.set(session.transport.sessionId,session);
});
await remote.listen({host:'127.0.0.1',port:0});
const mcpUrl=remote.listeningOrigin+'/mcp';
for(const [actor,label] of [[f.a,'A'],[f.b,'B']] as const)await f.configure(actor.token,mcpUrl,'GENERATED_'+label);
const address=await f.node.app.listen({host:'127.0.0.1',port:0});
process.stdout.write(JSON.stringify({address,controlAddress:address,mcpUrl,a:f.a,b:f.b,admin:f.admin,password,pid:process.pid})+'\n');
let closing=false;
async function close(){if(closing)return;closing=true;await Promise.allSettled([...sessions.values()].map(value=>value.server.close()));await remote.close();for(const cleanup of cleanups.reverse())await cleanup();process.exit(0);}
process.on('SIGTERM',()=>void close());process.on('SIGINT',()=>void close());
