import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StreamableHTTPClientTransport} from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import {z} from 'zod';
import {remoteUrl,restrictedFetch} from '../connectors/network.js';
import {ConnectorError} from '../connectors/types.js';
import type {SourceItem} from '@mote/shared';
import type {PrivateData} from './private-data.js';
import type {IngressHost} from './ingress.js';
import type {PrivateSql} from './private-data-sql.js';
import type {UserContext} from './context.js';
import {identityHash} from './originals.js';

export const outboundConnection=z.object({id:z.string().regex(/^[a-zA-Z0-9_.:-]{1,128}$/),enabled:z.boolean().default(true),url:z.string().min(1).max(2000),token:z.string().max(4096).refine(value=>!/[\r\n\0]/.test(value)).default(''),sourceIds:z.array(z.string().regex(/^[a-zA-Z0-9_.:-]{1,128}$/)).min(1).max(500)}).strict();
export const outboundSettings=z.object({connections:z.array(outboundConnection).max(500).default([])}).strict().superRefine((value,ctx)=>{if(new Set(value.connections.map(c=>c.id)).size!==value.connections.length)ctx.addIssue({code:'custom',message:'Duplicate MCP connection'});for(const c of value.connections)try{remoteUrl(c.url,true);}catch{ctx.addIssue({code:'custom',message:'Invalid MCP endpoint'});}});
export type OutboundConnection=z.infer<typeof outboundConnection>;
const selection=z.object({sourceId:z.string().min(1).max(128),resourceUris:z.array(z.string().min(1).max(4000)).max(30).refine(values=>new Set(values).size===values.length).optional(),tool:z.object({name:z.string().min(1).max(200),arguments:z.record(z.unknown()).default({}),confirmedReadOnly:z.literal(true)}).strict().optional()}).strict().refine(value=>Boolean(value.resourceUris?.length)!==Boolean(value.tool));
type Binding={context:UserContext;connection:OutboundConnection;sql:PrivateSql;data:PrivateData;ingress:IngressHost;allowLocal:boolean;assert:()=>void;pinSource:(id:string)=>number};

/** SDK clients, headers, sessions and cancellation belong to one invocation of
 * one user connection. No global client/credential/session cache is shared. */
export class McpOutbound{
 private readonly active=new Set<{user:string;connection:string;fingerprint:string;client:Client;abort:AbortController;settled:Promise<unknown>}>();
 private readonly queues=new Map<string,Promise<unknown>>();
 private closed=false;
 private invoke<T>(binding:Binding,work:(client:Client,signal:AbortSignal)=>Promise<T>,signal?:AbortSignal):Promise<T>{
  let settle!:()=>void;const settled=new Promise<void>(resolve=>settle=resolve),client=new Client({name:'mote-source-importer',version:'1'},{capabilities:{}}),abort=new AbortController(),entry={user:binding.context.userId,connection:binding.connection.id,fingerprint:identityHash(binding.connection),client,abort,settled};
  const run=async()=>{
   const assert=()=>{if(this.closed)throw new ConnectorError('connector_closed',503);binding.assert();abort.signal.throwIfAborted();signal?.throwIfAborted();};
   assert();const endpoint=remoteUrl(binding.connection.url,binding.allowLocal),transport=new StreamableHTTPClientTransport(endpoint,{fetch:restrictedFetch(endpoint,binding.allowLocal,assert),requestInit:{headers:binding.connection.token?{Authorization:'Bearer '+binding.connection.token}:{},signal:AbortSignal.any([abort.signal,...(signal?[signal]:[])])}});
   this.active.add(entry);
   try{await client.connect(transport,{timeout:20000});assert();const result=await work(client,AbortSignal.any([abort.signal,...(signal?[signal]:[])]));assert();return result;}
   catch(error){if(error instanceof ConnectorError)throw error;try{assert();}catch{throw new ConnectorError('mcp_authorization_changed',401);}throw new ConnectorError('mcp_operation_failed',502);}
   finally{try{assert();await transport.terminateSession();}catch{/* Revoked handles only close locally; cleanup cannot renew authority. */}this.active.delete(entry);await client.close().catch(()=>{});}
  };
  return run().finally(settle);
 }
 discover(binding:Binding,signal?:AbortSignal){return this.invoke(binding,async(client,signal)=>{
  const resources:unknown[]=[],tools:unknown[]=[],prompts:unknown[]=[],templates:unknown[]=[];
  const pages=async(read:(cursor?:string)=>Promise<{nextCursor?:string}>,count:()=>number,max:number)=>{let cursor:string|undefined;const seen=new Set<string>();for(let page=0;page<10;page++){binding.assert();signal.throwIfAborted();const result=await read(cursor);binding.assert();cursor=result.nextCursor;if(!cursor||count()>=max)break;if(seen.has(cursor))throw new ConnectorError('mcp_cursor_invalid',502);seen.add(cursor);}};
  const capabilities=client.getServerCapabilities();
  if(capabilities?.resources){await pages(async cursor=>{const result=await client.listResources({cursor},{signal,timeout:20000});resources.push(...result.resources.slice(0,500-resources.length).map(r=>({uri:r.uri,name:r.name,mimeType:r.mimeType})));return result;},()=>resources.length,500);await pages(async cursor=>{const result=await client.listResourceTemplates({cursor},{signal,timeout:20000});templates.push(...result.resourceTemplates.slice(0,500-templates.length).map(r=>({uriTemplate:r.uriTemplate,name:r.name})));return result;},()=>templates.length,500);}
  if(capabilities?.tools)await pages(async cursor=>{const result=await client.listTools({cursor},{signal,timeout:20000});tools.push(...result.tools.slice(0,200-tools.length).map(t=>({name:t.name,title:t.title,description:t.description?.slice(0,2000),readOnly:t.annotations?.readOnlyHint===true})));return result;},()=>tools.length,200);
  if(capabilities?.prompts)await pages(async cursor=>{const result=await client.listPrompts({cursor},{signal,timeout:20000});prompts.push(...result.prompts.slice(0,200-prompts.length).map(p=>({name:p.name,description:p.description?.slice(0,2000)})));return result;},()=>prompts.length,200);
  return {resources,tools,prompts,templates};
 },signal);}
 import(binding:Binding,raw:unknown,signal?:AbortSignal){
  const input=selection.parse(raw),key=identityHash([binding.context.userId,binding.connection.id,input.sourceId]),prior=this.queues.get(key)??Promise.resolve();
  const work=prior.catch(()=>{}).then(()=>this.invoke(binding,async(client,signal)=>{
   const check=()=>{binding.assert();signal.throwIfAborted();if(!binding.connection.sourceIds.includes(input.sourceId))throw new ConnectorError('mcp_source_invalid',404);const source=binding.data.source(input.sourceId);if(source.kind!=='mcp'||!source.enabled)throw new ConnectorError('mcp_source_invalid',404);return source;};
   const source=check(),fingerprint=identityHash(source),epoch=binding.pinSource(source.id),assert=()=>{if(binding.pinSource(source.id)!==epoch||identityHash(check())!==fingerprint)throw new ConnectorError('mcp_source_changed',409);};
   const ingress=binding.ingress.bindSource(binding.context,[source.id],assert),chunks:{identity:string;externalId:string;title:string;text:string;mimeType:string;uri?:string}[]=[],manifests=new Map<string,string[]>();
   // Bind selected original heads before any remote resource/tool await. A
   // privacy deletion or revision change while I/O is held cannot be undone by
   // this old response, even when the source itself remains enabled.
   const candidates=new Set((input.resourceUris??[]).flatMap(uri=>Array.from({length:100},(_,index)=>identityHash([binding.connection.url,uri,index]))));
   if(input.tool)candidates.add(identityHash([binding.connection.url,'tool',input.tool.name,input.tool.arguments]));
   const heads=new Map([...candidates].map(id=>[id,identityHash(binding.data.sourceItem(source.id,id))]));
   const assertHeads=()=>{for(const [id,head] of heads)if(identityHash(binding.data.sourceItem(source.id,id))!==head)throw new ConnectorError('mcp_input_changed',409);};
   for(const uri of input.resourceUris??[]){
    const identity=identityHash([binding.connection.url,'resource',uri]);manifests.set(identity,[]);assert();
    if(source.retention==='reference'){const externalId=identityHash([binding.connection.url,uri,0]);chunks.push({identity,externalId,title:'MCP reference',text:'',mimeType:'text/plain',uri:'mcp://'+identityHash(binding.connection.url).slice(0,24)+'/'+identityHash(uri)});manifests.get(identity)!.push(externalId);continue;}
    const result=await client.readResource({uri},{signal,timeout:20000});assert();
    for(const [index,entry] of result.contents.entries()){if(!('text' in entry)||typeof entry.text!=='string')throw new ConnectorError('mcp_binary_resource_not_supported',415);if(entry.text.length>100000)throw new ConnectorError('mcp_resource_too_large',413);const externalId=identityHash([binding.connection.url,uri,index]);chunks.push({identity,externalId,title:uri.slice(0,2000),text:entry.text,mimeType:entry.mimeType??'text/plain'});manifests.get(identity)!.push(externalId);if(chunks.length>100)throw new ConnectorError('mcp_resource_limit',413);}
   }
   if(input.tool){
    if(source.retention==='reference')throw new ConnectorError('mcp_reference_tool_denied',403);
    let cursor:string|undefined,tool;const seen=new Set<string>();for(let page=0;page<10;page++){assert();const result=await client.listTools({cursor},{signal,timeout:20000});assert();tool=result.tools.find(t=>t.name===input.tool!.name);cursor=result.nextCursor;if(tool||!cursor)break;if(seen.has(cursor))throw new ConnectorError('mcp_cursor_invalid',502);seen.add(cursor);}
    if(tool?.annotations?.readOnlyHint!==true)throw new ConnectorError('mcp_tool_not_readonly',403);
    const result=await client.callTool({name:input.tool.name,arguments:input.tool.arguments},undefined,{signal,timeout:20000});assert();if(result.isError)throw new ConnectorError('mcp_tool_failed',502);
    const content=Array.isArray(result.content)?result.content:[];if(content.some((c:any)=>c?.type!=='text'||typeof c.text!=='string'))throw new ConnectorError('mcp_nontext_tool_result',415);
    const text=content.map((c:any)=>c.text).join('\n');if(text.length>100000)throw new ConnectorError('mcp_resource_too_large',413);const identity=identityHash([binding.connection.url,'tool',input.tool.name,input.tool.arguments]);chunks.push({identity,externalId:identity,title:input.tool.name,text,mimeType:'text/plain'});manifests.set(identity,[identity]);
   }
   return binding.sql.transaction(()=>{
    assert();assertHeads();let imported=0,duplicates=0;
    for(const [identity,members] of manifests){
     const previous=binding.sql.get('SELECT members FROM mc_manifests WHERE user_id=$user AND connection_id=? AND source_id=? AND identity=?',binding.connection.id,source.id,identity),old=previous?z.array(z.string()).parse(JSON.parse(String(previous.members))):[],items:SourceItem[]=[];
     const prepare=(chunk:typeof chunks[number],deleted=false):SourceItem=>{const prior=binding.data.sourceItem(source.id,chunk.externalId),body={externalId:chunk.externalId,title:chunk.title,text:deleted?'':chunk.text,mimeType:chunk.mimeType,...(chunk.uri?{uri:chunk.uri}:{}),kind:'file' as const,layer:source.retention==='reference'?'reference' as const:'snapshot' as const,deleted},semantic=(value:any)=>({externalId:value.externalId,title:value.title,text:value.text,mimeType:value.mimeType,...(value.uri?{uri:value.uri}:{}),kind:value.kind,layer:value.layer,deleted:value.deleted??false}),hash=identityHash(semantic(body));return {...body,observedAt:new Date().toISOString(),revision:prior&&identityHash(semantic(prior))===hash?prior.revision:identityHash([hash,prior?.revision??''])};};
     for(const chunk of chunks.filter(c=>c.identity===identity))items.push(prepare(chunk));
     for(const externalId of old)if(!members.includes(externalId)){const prior=binding.data.sourceItem(source.id,externalId);if(prior&&!prior.deleted)items.push(prepare({identity,externalId,title:prior.title,text:'',mimeType:prior.mimeType??'text/plain'},true));}
     if(items.length){const receipt=ingress.receiveSourceItems(source.id,'mcp:'+identityHash([binding.connection.id,identity,items]),items);for(const ack of receipt.captures)ack.duplicate?duplicates++:imported++;}
     binding.sql.run('INSERT INTO mc_manifests VALUES($user,?,?,?,?) ON CONFLICT(user_id,connection_id,source_id,identity) DO UPDATE SET members=excluded.members',binding.connection.id,source.id,identity,JSON.stringify(members));
    }
    assert();return {imported,duplicates};
   });
  },signal));
  this.queues.set(key,work);void work.finally(()=>{if(this.queues.get(key)===work)this.queues.delete(key);}).catch(()=>{});return work;
 }
 async closeUser(user:string){const entries=[...this.active].filter(entry=>entry.user===user);for(const entry of entries)entry.abort.abort();await Promise.allSettled(entries.map(async entry=>{await entry.client.close();await entry.settled;}));}
 async retireChanged(user:string,connections:readonly OutboundConnection[]){const entries=[...this.active].filter(entry=>entry.user===user&&entry.fingerprint!==identityHash(connections.find(connection=>connection.id===entry.connection)??null));for(const entry of entries)entry.abort.abort();await Promise.allSettled(entries.map(async entry=>{await entry.client.close();await entry.settled;}));}
 async close(){this.closed=true;for(const entry of this.active)entry.abort.abort();await Promise.allSettled([...this.active].map(async entry=>{await entry.client.close();await entry.settled;}));await Promise.allSettled([...this.queues.values()]);}
}
