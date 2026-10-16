import type {TestContext} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StreamableHTTPClientTransport} from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import {buildApp} from '../../src/app.js';
import type {PluginReleaseTransport} from '../../src/plugin-release.js';

export const password='Generated-M11-account-password-01',protocol={'x-mote-protocol-version':'2','x-mote-ingress-version':'3'},source=(id='same-source')=>({id,name:'Generated '+id,kind:'mcp',deviceId:'same-device',platform:'import',retention:'snapshot'}),item=(text:string,externalId='same-item',revision='same-revision')=>({externalId,revision,observedAt:'2026-10-16T00:00:00Z',kind:'message',layer:'snapshot',title:'Generated',text});
export const deferred=()=>{let resolve!:()=>void;return {promise:new Promise<void>(r=>resolve=r),resolve};};
export async function fixture(t:TestContext,allowLocal=true,options:{pluginReleaseTransport?:PluginReleaseTransport}={}){
 const root=mkdtempSync(join(tmpdir(),'mote-m11-')),clients:Client[]=[],cleanup:Array<()=>void>=[];let node=await buildApp({dataDir:root,configuration:{document:{version:1,revision:0,connectors:{allowLocalMcp:allowLocal}}}},options);
 t.after(async()=>{for(const callback of cleanup)callback();await Promise.allSettled(clients.map(client=>client.close()));await node.app.close();rmSync(root,{recursive:true,force:true});});
 const request=(token:string|undefined,url:string,method:any='GET',payload?:unknown,extra:Record<string,string>={})=>node.app.inject({url,method,headers:{...protocol,...(token?{authorization:'Bearer '+token}:{}),...extra},...(payload===undefined?{}:{payload})});
 const ok=async(token:string|undefined,url:string,method:any='GET',payload?:unknown)=>{const response=await request(token,url,method,payload);assert.equal(response.statusCode,200,response.body);return response.json();};
 await node.accounts.initialize('generated-admin',password);const admin=await ok(undefined,'/api/auth/login','POST',{username:'generated-admin',password,mode:'client'}),users=[];
 for(const label of ['a','b']){const user=await ok(admin.token,'/api/admin/accounts','POST',{username:'generated-'+label,password});const login=await ok(undefined,'/api/auth/login','POST',{username:user.username,password,mode:'client'});users.push({...user,...login});await ok(login.token,'/api/ingress/sources','POST',source());await ok(login.token,'/api/ingress/sources','POST',source('other-source'));}
 const [a,b]=users;
 const mint=(token:string,access:'read'|'write'='read',sourceIds=['same-source'])=>ok(token,'/api/connections/mcp','POST',{access,sourceIds,label:'Generated MCP'});
 const listen=async()=>{if(!node.app.server.listening)await node.app.listen({host:'127.0.0.1',port:0});return new URL('/mcp',node.app.listeningOrigin);};
 const connect=async(grant:any,extra:Record<string,string>={})=>{const endpoint=await listen(),client=new Client({name:'generated-m11-client',version:'1'}),transport=new StreamableHTTPClientTransport(endpoint,{requestInit:{headers:{authorization:'Bearer '+grant.token,...extra}}});clients.push(client);await client.connect(transport);return {client,transport,endpoint};};
 const put=async(token:string,text:string,id='same-item',sourceId='same-source')=>ok(token,'/api/ingress/sources/'+sourceId+'/items','POST',{batchId:'batch-'+id,items:[item(text,id)]});
 const configure=async(token:string,url:string,key:string,ids=['same-source'])=>{const revision=(await ok(token,'/api/configuration')).revision;return ok(token,'/api/configuration/mcpConnections','PUT',{revision,value:{connections:[{id:'same-connection',url,token:key,sourceIds:ids}]}});};
 const restart=async()=>{await Promise.allSettled(clients.map(client=>client.close()));await node.app.close();node=await buildApp({dataDir:root},options);};
 return {get node(){return node;},beforeClose:(callback:()=>void)=>cleanup.push(callback),root,a,b,admin,request,ok,mint,connect,put,configure,restart};
}
export const value=(result:any)=>JSON.parse(result.content[0].text);
export async function call(client:Client,name:string,args:Record<string,unknown>={}){return client.callTool({name,arguments:args});}

