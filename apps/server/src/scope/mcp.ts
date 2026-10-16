import type {SourceConnection} from '@mote/shared';
import type {DatabaseSync} from 'node:sqlite';
import type {FastifyRequest,FastifyReply} from 'fastify';
import {z} from 'zod';
import type {ScopedRuntime} from './http.js';
import {registerUserRoute} from './http.js';
import type {Configurations} from './configuration.js';
import type {UserContext} from './context.js';
import type {DomainLifecycle,UserDataSubject} from './lifecycle.js';
import type {IngressHost} from './ingress.js';
import type {PrivateData} from './private-data.js';
import {PrivateSql,missing,PrivateDataError} from './private-data-sql.js';
import {ScopeError} from './baseline.js';
import {identityHash} from './originals.js';
import {installMcp} from './mcp-schema.js';
import {McpInbound} from './mcp-inbound.js';
import {mcpSources} from './mcp-sources.js';
import {McpMemory} from './mcp-memory.js';
import {McpQuery} from './mcp-query.js';
import type {AskHost} from './ask.js';
import type {MemoryHost} from './memory.js';
import type {ConnectorSourceStatusReader} from './connectors.js';
import {McpOutbound,outboundSettings,type OutboundConnection} from './mcp-outbound.js';

export const MCP_DOMAIN='mcp';
const sourceStatus=z.object({state:z.enum(['idle','syncing','error','permission_required']),code:z.string().max(200).optional(),lastSyncAt:z.string().datetime({offset:true}).optional()}).strict();
type State={deleted:number;generation:number;fingerprint:string};
export class ScopedMcp{
 readonly inbound:McpInbound;
 private readonly outbound=new McpOutbound();
 private readonly configurations=new Map<string,z.infer<typeof outboundSettings>>();
 private memory?:MemoryHost;
 private ask?:AskHost;
 private closed=false;
 constructor(private readonly runtime:ScopedRuntime,private readonly db:DatabaseSync,private readonly configuration:Configurations,private readonly ingress:IngressHost){
  installMcp(db);
  configuration.registerDomain('mcpConnections',subject=>({id:'mcpConnections',schema:outboundSettings,defaultValue:{connections:[]},resolve:raw=>raw,fields:[{path:'connections.*.token',effect:'next-request',sensitive:true}],prepare:next=>{
   const settings=outboundSettings.parse(next),assert=()=>{if('credentialId' in subject)runtime.accounts!.assertAccountEnabled(subject.userId,subject.authorizationEpoch);else runtime.services.assertSubject(subject,'configuration',subject.purpose);},sql=new PrivateSql(db,subject.userId,assert),before=sql.get('SELECT * FROM mc_state WHERE user_id=$user') as State|undefined,previous=this.configurations.get(subject.userId),fingerprint=identityHash(settings);let published=false;
   return {apply:()=>{},publish:()=>sql.transaction(()=>{const state=this.state(sql);if(state.deleted)throw new ScopeError('invalid_identity',401);if(state.fingerprint!==fingerprint){sql.run('UPDATE mc_state SET fingerprint=? WHERE user_id=$user',fingerprint);published=true;}this.configurations.set(subject.userId,structuredClone(settings));}),rollback:()=>{if(published){if(before)sql.run('UPDATE mc_state SET deleted=?,generation=?,fingerprint=? WHERE user_id=$user',before.deleted,before.generation,before.fingerprint);else sql.run('DELETE FROM mc_state WHERE user_id=$user');}if(previous)this.configurations.set(subject.userId,previous);else this.configurations.delete(subject.userId);},complete:()=>{if(published){for(const row of sql.all('SELECT source_id,connection_id,fingerprint FROM mc_source_status WHERE user_id=$user'))if(!settings.connections.some(connection=>connection.enabled&&connection.id===row.connection_id&&connection.sourceIds.includes(String(row.source_id))&&identityHash(connection)===row.fingerprint))sql.run('DELETE FROM mc_source_status WHERE user_id=$user AND source_id=?',row.source_id);void this.outbound.retireChanged(subject.userId,settings.connections);}}};
  }}));
  runtime.services.registerUser(MCP_DOMAIN,{scope:'user',create:context=>this.forUser(context),lifecycle:this.lifecycle()});
  this.inbound=new McpInbound(runtime,(context,authorization)=>{
   const sql=this.sql(context),generation=this.state(sql).generation;
   const assert=()=>{runtime.authority.assert(context);authorization.assertCurrent();const state=this.state(sql);if(this.closed||state.deleted||state.generation!==generation)throw new ScopeError('invalid_identity',401);for(const id of authorization.sourceIds)if(authorization.sourcePins[id]!==this.pinSources(context,[id])[id])throw new ScopeError('invalid_identity',401);};
   const data=this.data(context),sources=mcpSources(data,ingress,context,authorization.sourceIds,authorization.write,assert,ids=>runtime.services.forUser(context).get<ConnectorSourceStatusReader>('connectors').sourceStatuses(ids));sources.check();return {sources,assert,...(this.memory?{memory:new McpMemory(this.memory,context,authorization.sourceIds,assert,ids=>this.memorySourceFence(context,ids))}:{}),...(this.ask?{query:new McpQuery(this.ask,data,context,authorization.sourceIds,assert,ids=>this.memorySourceFence(context,ids))}:{})};
  },()=>configuration.instance.current<{allowedOrigins:string[]}>('server').allowedOrigins);
 }
 bindMemory(memory:MemoryHost){if(this.memory&&this.memory!==memory)throw new Error('MCP Memory host already bound');this.memory=memory;}
 bindAsk(ask:AskHost){if(this.ask&&this.ask!==ask)throw new Error('MCP Ask host already bound');this.ask=ask;}
 private memorySourceFence(context:UserContext,sourceIds?:readonly string[]){
  const sql=this.sql(context),enabled=()=>this.data(context).sources().filter(source=>source.enabled).map(source=>source.id).sort(),ids=Object.freeze([...(sourceIds??enabled())].sort()),scopeHash=identityHash(ids);
  const snapshot=()=>sql.all("SELECT e.source_id,e.epoch,e.revision FROM mc_source_epochs e JOIN pd_sources p ON p.user_id=e.user_id AND p.id=e.source_id WHERE e.user_id=$user AND p.user_id=$user AND e.source_id IN (SELECT value FROM json_each(?)) AND json_extract(p.json,'$.enabled')=1 ORDER BY e.source_id",JSON.stringify(ids));
  const before=snapshot();if(before.length!==ids.length)throw missing();const fingerprint=identityHash(before);
  return ()=>{if(sourceIds===undefined&&identityHash(enabled())!==scopeHash||identityHash(snapshot())!==fingerprint)throw new PrivateDataError('conflict',409);};
 }
 private sql(subject:UserDataSubject,purpose?:'export'|'delete'|'restore'){return new PrivateSql(this.db,subject.userId,()=>{if(this.closed)throw new ScopeError('invalid_identity',401);if('credentialId' in subject)this.runtime.authority.assert(subject);else this.runtime.services.assertSubject(subject,MCP_DOMAIN,purpose!);});}
 private state(sql:PrivateSql):State{let row=sql.get('SELECT * FROM mc_state WHERE user_id=$user') as State|undefined;if(!row){sql.run('INSERT INTO mc_state(user_id) VALUES($user)');row=sql.get('SELECT * FROM mc_state WHERE user_id=$user') as State;}return row;}
 private data(context:UserContext){return this.runtime.services.forUser(context).get<PrivateData>('private-data');}
 private async bind(context:UserContext,id:string){
  const sql=this.sql(context);if(this.state(sql).deleted)throw new ScopeError('invalid_identity',401);
  await this.configuration.forUser(context).view();this.runtime.authority.assert(context);
  const connection=this.configurations.get(context.userId)?.connections.find(value=>value.id===id&&value.enabled);if(!connection)throw missing();
  const state=this.state(sql),generation=state.generation,snapshot=structuredClone(connection),fingerprint=identityHash(snapshot),allowLocal=this.configuration.instance.current<{allowLocalMcp:boolean}>('connectors').allowLocalMcp;
  const assert=()=>{const current=this.state(sql),live=this.configurations.get(context.userId)?.connections.find(value=>value.id===id&&value.enabled);if(current.deleted||current.generation!==generation||identityHash(live??null)!==fingerprint)throw new ScopeError('invalid_identity',401);if(this.configuration.instance.current<{allowLocalMcp:boolean}>('connectors').allowLocalMcp!==allowLocal)throw new ScopeError('invalid_identity',401);};
  assert();return {context,connection:snapshot as OutboundConnection,sql,data:this.data(context),ingress:this.ingress,allowLocal,assert,reportStatus:(sourceId:string,revision:number,status:NonNullable<SourceConnection['status']>)=>{assert();const sourceEpoch=sql.get('SELECT epoch FROM mc_source_epochs WHERE user_id=$user AND source_id=? AND revision=?',sourceId,revision);if(!sourceEpoch)throw new PrivateDataError('conflict',409);sql.run('INSERT INTO mc_source_status VALUES($user,?,?,?,?,?) ON CONFLICT(user_id,source_id) DO UPDATE SET source_epoch=excluded.source_epoch,connection_id=excluded.connection_id,fingerprint=excluded.fingerprint,json=excluded.json',sourceId,sourceEpoch.epoch,snapshot.id,fingerprint,JSON.stringify(sourceStatus.parse(status)));},pinSource:(id:string)=>{this.data(context).source(id);return Number(sql.get('SELECT revision FROM mc_source_epochs WHERE user_id=$user AND source_id=?',id)?.revision);}};
 }
 private sourceStatuses(context:UserContext,ids:readonly string[]){const sql=this.sql(context),result=new Map<string,NonNullable<SourceConnection['status']>>();if(this.state(sql).deleted)return result;for(const row of sql.all('SELECT s.* FROM mc_source_status s JOIN mc_source_epochs e ON e.user_id=s.user_id AND e.source_id=s.source_id JOIN pd_sources p ON p.user_id=s.user_id AND p.id=s.source_id WHERE s.user_id=$user AND e.user_id=$user AND p.user_id=$user AND s.source_epoch=e.epoch AND s.source_id IN(SELECT value FROM json_each(?))',JSON.stringify(ids))){const live=this.configurations.get(context.userId);if(live&&!live.connections.some(connection=>connection.enabled&&connection.id===row.connection_id&&connection.sourceIds.includes(String(row.source_id))&&identityHash(connection)===row.fingerprint))continue;const status=sourceStatus.parse(JSON.parse(String(row.json)));result.set(String(row.source_id),status.state==='syncing'&&!this.outbound.importing(context.userId,String(row.connection_id),String(row.source_id))?{state:'error',code:'mcp_import_interrupted'}:status);}return result;}
 private pinSources(context:UserContext,ids:readonly string[]){const sql=this.sql(context);if(this.state(sql).deleted)throw new ScopeError('invalid_identity',401);return Object.fromEntries(ids.map(id=>{const source=this.data(context).source(id);if(!source.enabled)throw missing();const epoch=Number(sql.get('SELECT epoch FROM mc_source_epochs WHERE user_id=$user AND source_id=?',id)?.epoch);if(!Number.isSafeInteger(epoch)||epoch<1)throw missing();return [id,epoch];}));}
 forUser(context:UserContext){this.runtime.authority.assert(context);return Object.freeze({
  discover:async(id:string,signal?:AbortSignal)=>this.outbound.discover(await this.bind(context,id),signal),
  import:async(id:string,raw:unknown,signal?:AbortSignal)=>this.outbound.import(await this.bind(context,id),raw,signal),
  sourceStatuses:(ids:readonly string[])=>this.sourceStatuses(context,ids),
  pinSources:(ids:readonly string[])=>this.pinSources(context,ids),
 });}
 private lifecycle():DomainLifecycle{return {
  exportUser:async subject=>{const sql=this.sql(subject,'export');return {domain:MCP_DOMAIN,version:1,deploymentId:subject.deploymentId,userId:subject.userId,payload:{format:'mote-mcp-v1',manifests:sql.all('SELECT connection_id,source_id,identity,members FROM mc_manifests WHERE user_id=$user ORDER BY connection_id,source_id,identity'),excluded:['credentials','connections','sessions','handles','source-status']}};},
  deleteUser:async(subject,operationId)=>{const sql=this.sql(subject,'delete');sql.transaction(()=>{const state=this.state(sql);sql.run('UPDATE mc_state SET deleted=1,generation=? WHERE user_id=$user',state.generation+1);sql.run('DELETE FROM mc_manifests WHERE user_id=$user');sql.run('DELETE FROM mc_source_status WHERE user_id=$user');this.runtime.accounts!.revokeMcpCredentials(subject.userId);});this.configurations.delete(subject.userId);await Promise.all([this.inbound.closeUser(subject.userId),this.outbound.closeUser(subject.userId)]);return {status:'complete',operationId};},
  restoreUser:async(subject,archive,_operationId)=>{if(archive.domain!==MCP_DOMAIN||archive.version!==1||archive.userId!==subject.userId||archive.deploymentId!==subject.deploymentId)throw new PrivateDataError('invalid_data');const payload=z.object({format:z.literal('mote-mcp-v1'),manifests:z.array(z.object({connection_id:z.string().regex(/^[a-zA-Z0-9_.:-]{1,128}$/),source_id:z.string().regex(/^[a-zA-Z0-9_.:-]{1,128}$/),identity:z.string().regex(/^[a-f0-9]{64}$/),members:z.string().refine(value=>{try{return z.array(z.string().regex(/^[a-f0-9]{64}$/)).max(100).safeParse(JSON.parse(value)).success;}catch{return false;}})}).strict()),excluded:z.tuple([z.literal('credentials'),z.literal('connections'),z.literal('sessions'),z.literal('handles')]).rest(z.literal('source-status'))}).strict().parse(archive.payload),sql=this.sql(subject,'restore');sql.transaction(()=>{const existing=sql.all('SELECT connection_id,source_id,identity,members FROM mc_manifests WHERE user_id=$user ORDER BY connection_id,source_id,identity');if(existing.length){if(identityHash(existing)!==identityHash(payload.manifests))throw new PrivateDataError('conflict',409);return;}if(new Set(payload.manifests.map(row=>identityHash([row.connection_id,row.source_id,row.identity]))).size!==payload.manifests.length)throw new PrivateDataError('invalid_data');for(const row of payload.manifests)sql.run('INSERT INTO mc_manifests VALUES($user,?,?,?,?)',row.connection_id,row.source_id,row.identity,row.members);const state=this.state(sql);sql.run("UPDATE mc_state SET deleted=0,generation=?,fingerprint='' WHERE user_id=$user",state.generation+1);});},
 };}
 async close(){this.closed=true;await Promise.all([this.inbound.close(),this.outbound.close()]);this.configurations.clear();}
}

export function registerScopedMcp(runtime:ScopedRuntime,db:DatabaseSync,configuration:Configurations,ingress:IngressHost){
 const host=new ScopedMcp(runtime,db,configuration,ingress);
 const connected=async<T>(request:FastifyRequest,reply:FastifyReply,work:(signal:AbortSignal)=>Promise<T>)=>{const abort=new AbortController(),disconnected=()=>{if(!reply.raw.writableEnded)abort.abort();};reply.raw.once('close',disconnected);if(request.raw.aborted)abort.abort();try{return await work(abort.signal);}finally{reply.raw.off('close',disconnected);}};
 registerUserRoute(runtime,{scope:'user',method:'POST',url:'/api/connectors/mcp/discover',service:MCP_DOMAIN,handle:({context,request,reply})=>{const input=z.object({connectionId:z.string().min(1).max(128)}).strict().parse(request.body);return connected(request,reply,signal=>host.forUser(context).discover(input.connectionId,signal));}});
 registerUserRoute(runtime,{scope:'user',method:'POST',url:'/api/connectors/mcp/import',service:MCP_DOMAIN,handle:({context,request,reply})=>{const {connectionId,...input}=z.object({connectionId:z.string().min(1).max(128),sourceId:z.string(),resourceUris:z.array(z.string()).optional(),tool:z.object({name:z.string(),arguments:z.record(z.unknown()).default({}),confirmedReadOnly:z.literal(true)}).strict().optional()}).strict().parse(request.body);return connected(request,reply,signal=>host.forUser(context).import(connectionId,input,signal));}});
 return host;
}
