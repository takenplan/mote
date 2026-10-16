import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,rmSync,realpathSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {spawn,execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {serializeConfigDocument} from '@mote/shared/config-file';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StreamableHTTPClientTransport} from '@modelcontextprotocol/sdk/client/streamableHttp.js';
const entry=process.env.MOTE_MCP_PROCESS_ENTRY??fileURLToPath(new URL('../src/index.ts',import.meta.url)),password='Generated-M11-process-password-01';

test('actual production listener and SDK keep A/B MCP ownership across abrupt process death, reconnect and persisted revocation',async t=>{
 const root=mkdtempSync(join(realpathSync(tmpdir()),'mote-m11-process-')),file=join(root,'generated.yaml'),directory=join(root,'vault'),clients:Client[]=[];
 writeFileSync(file,serializeConfigDocument({version:1,revision:0,storage:{dataDir:directory},server:{host:'127.0.0.1',port:0}}));const env={...process.env,MOTE_CONFIG_FILE:file};
 execFileSync(process.execPath,['--import','tsx',fileURLToPath(new URL('../src/scope/initialize-admin.ts',import.meta.url))],{env,input:JSON.stringify({username:'generated-admin',password}),stdio:['pipe','pipe','pipe'],timeout:15000});
 let active:Awaited<ReturnType<typeof start>>|undefined;
 async function start(){const child=spawn(process.execPath,entry.endsWith('.ts')?['--import','tsx',entry]:[entry],{env,stdio:['ignore','pipe','pipe']}),closed=new Promise<{code:number|null;signal:NodeJS.Signals|null}>(resolve=>child.once('close',(code,signal)=>resolve({code,signal})));const url=await new Promise<string>((resolve,reject)=>{const timer=setTimeout(()=>{child.kill('SIGKILL');reject(Error('Generated MCP startup timeout'));},15000);let output='',errors='';child.stderr.on('data',part=>errors+=String(part).slice(0,8192));child.once('exit',code=>{clearTimeout(timer);reject(Error('Generated MCP startup exit '+code+' '+errors));});child.stdout.on('data',part=>{output+=part;for(const line of output.split('\n'))try{const event=JSON.parse(line);if(event.event==='server.listening'){clearTimeout(timer);resolve('http://127.0.0.1:'+event.port);}}catch{}});});return {child,closed,url};}
 t.after(async()=>{await Promise.allSettled(clients.map(client=>client.close()));if(active){active.child.kill('SIGTERM');await active.closed;}rmSync(root,{recursive:true,force:true});});active=await start();
 const request=async(token:string|undefined,path:string,method='GET',body?:unknown)=>{const response=await fetch(active!.url+path,{method,headers:{'x-mote-protocol-version':'2','x-mote-ingress-version':'3',...(body===undefined?{}:{'content-type':'application/json'}),...(token?{authorization:'Bearer '+token}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});assert.equal(response.status,200,path+' '+await response.clone().text());return response.json() as Promise<any>;};
 const admin=await request(undefined,'/api/auth/login','POST',{username:'generated-admin',password,mode:'client'}),users=[];
 for(const owner of ['a','b']){await request(admin.token,'/api/admin/accounts','POST',{username:'generated-'+owner,password});const user=await request(undefined,'/api/auth/login','POST',{username:'generated-'+owner,password,mode:'client'});await request(user.token,'/api/ingress/sources','POST',{id:'same-source',name:'Generated',kind:'mcp',deviceId:'same-device',platform:'import'});const read=await request(user.token,'/api/connections/mcp','POST',{access:'read',sourceIds:['same-source'],label:'Generated read'}),write=await request(user.token,'/api/connections/mcp','POST',{access:'write',sourceIds:['same-source'],label:'Generated write'});users.push({owner,...user,read,write});}
 const connect=async(token:string)=>{const client=new Client({name:'generated-process-client',version:'1'}),transport=new StreamableHTTPClientTransport(new URL('/mcp',active!.url),{requestInit:{headers:{authorization:'Bearer '+token}}});clients.push(client);await client.connect(transport);return {client,transport};};
 const sessions=[];for(const user of users){const writer=await connect(user.write.token);const result=await writer.client.callTool({name:'mote_put_item',arguments:{sourceId:'same-source',item:{externalId:'same-item',revision:'same-revision',observedAt:'2026-10-16T00:00:00Z',kind:'message',layer:'snapshot',title:'Generated',text:'PROCESS_PRIVATE_'+user.owner}}});assert.equal(result.isError,undefined);sessions.push(await connect(user.read.token));}
 const oldSession=sessions[0].transport.sessionId!;active.child.kill('SIGKILL');assert.equal((await active.closed).signal,'SIGKILL');active=undefined;await Promise.allSettled(clients.map(client=>client.close()));active=await start();
 const stale=await fetch(active.url+'/mcp',{method:'POST',headers:{authorization:'Bearer '+users[0].read.token,'mcp-session-id':oldSession,'content-type':'application/json',accept:'application/json, text/event-stream'},body:JSON.stringify({jsonrpc:'2.0',id:7,method:'tools/list'})});assert.equal(stale.status,404);
 for(const user of users){const resumed=await connect(user.read.token),result=await resumed.client.callTool({name:'mote_items',arguments:{sourceId:'same-source'}});assert.match(JSON.stringify(result),new RegExp('PROCESS_PRIVATE_'+user.owner));assert.doesNotMatch(JSON.stringify(result),new RegExp('PROCESS_PRIVATE_'+(user.owner==='a'?'b':'a')));if(user.owner==='a'){await request(user.token,'/api/connections/'+user.read.credentialId,'DELETE',{});await assert.rejects(resumed.client.listTools());}}
 active.child.kill('SIGTERM');assert.equal((await active.closed).code,0);active=undefined;
});
