import {mkdtempSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createServer} from 'node:http';
import {DatabaseSync} from 'node:sqlite';
import {randomUUID} from 'node:crypto';
import {buildApp} from '../../server/src/app.js';
import {generatedScopedPluginRelease} from '../../server/test/fixtures/scoped-plugin-release.js';
const directory=mkdtempSync(join(tmpdir(),'m15-kotlin-backend-'));
const releaseFixture=process.argv.includes("--plugins")?generatedScopedPluginRelease():undefined;
const node=await buildApp({dataDir:directory},releaseFixture?{pluginReleaseTransport:releaseFixture.transport}:undefined);
let holdNext=false,entered=false,release:(()=>void)|undefined;
node.app.addHook('onSend',async(request,reply,payload)=>{
 if(reply.statusCode>=400)process.stderr.write(JSON.stringify({method:request.method,path:request.url,status:reply.statusCode,response:payload})+'\n');
 if(holdNext&&reply.statusCode===200&&/^\/api\/ingress\/sources\/[^/]+\/captures$/.test(request.url)){holdNext=false;entered=true;await new Promise<void>(resolve=>{release=resolve;});}
 return payload;
});
const password='Generated-M15-fixture-only-01';
await node.accounts!.initialize('generated-admin',password);
const headers={'x-mote-protocol-version':'2','x-mote-ingress-version':'3'};
const login=async(username:string)=>(await node.app.inject({url:'/api/auth/login',method:'POST',headers,payload:{username,password,mode:'client'}})).json();
const admin=await login('generated-admin');
for(const username of ['generated-a','generated-b']){
 const response=await node.app.inject({url:'/api/admin/accounts',method:'POST',headers:{...headers,authorization:'Bearer '+admin.token},payload:{username,password}});
 if(response.statusCode!==200)throw new Error(response.body);
}
const a=await login('generated-a'),b=await login('generated-b');
let pluginPackageId:string|undefined;
if(releaseFixture){
 const call=async(url:string,payload?:unknown)=>{const response=await node.app.inject({url,method:payload===undefined?'GET':'POST',headers:{...headers,authorization:'Bearer '+admin.token},...(payload===undefined?{}:{payload})});if(response.statusCode!==200)throw new Error(response.body);return response.json();};
 const preview=await call('/api/plugins/resolve',{repository:releaseFixture.repository,tag:releaseFixture.tag}),catalog=await call('/api/admin/plugins');
 await call('/api/plugins/install',{previewId:preview.id,expectedRevision:catalog.revision,operationId:randomUUID()});
 const end=Date.now()+10000;while(node.plugins!.catalog.view().packages[0]?.state==='installing'){if(Date.now()>end)throw new Error('Generated native plugin install timeout');await new Promise(resolve=>setTimeout(resolve,5));}
 pluginPackageId=node.plugins!.catalog.view().packages[0].id;
}
const selectedPort=Number(process.argv.find(value=>value.startsWith('--port='))?.slice(7)??0);
if(!Number.isInteger(selectedPort)||selectedPort<0||selectedPort>65535)throw new Error('Invalid generated fixture port');
const address=await node.app.listen({host:'127.0.0.1',port:selectedPort});
const port=Number(new URL(address).port);
const control=createServer((request,response)=>{void(async()=>{
 if(request.url==='/hold-next'){entered=false;holdNext=true;}
 else if(request.url==='/release'){release?.();release=undefined;}
 else if(request.url==='/network/off'){node.app.server.closeAllConnections();await new Promise<void>((resolve,reject)=>node.app.server.close(error=>error?reject(error):resolve()));}
 else if(request.url==='/network/on'){await new Promise<void>((resolve,reject)=>{node.app.server.once('error',reject);node.app.server.listen(port,'127.0.0.1',()=>{node.app.server.removeListener('error',reject);resolve();});});}
 else if(request.url==='/snapshot/expire'){const db=new DatabaseSync(join(directory,'mote.sqlite'));try{db.prepare('UPDATE ig_snapshot_inputs SET expires=?').run(Date.now()-1);}finally{db.close();}}
 else if(request.url!=='/state'){response.writeHead(404);response.end();return;}
 response.setHeader('Content-Type','application/json');response.end(JSON.stringify({entered,held:!!release}));
 })().catch(error=>{response.writeHead(500);response.end(JSON.stringify({error:String(error)}));});});
await new Promise<void>(resolve=>control.listen(0,'127.0.0.1',resolve));
const controlAddress='http://127.0.0.1:'+(control.address() as {port:number}).port;
process.stdout.write(JSON.stringify({address,controlAddress,admin,a,b,password,pid:process.pid,pluginPackageId})+'\n');
let closing=false;async function close(){if(closing)return;closing=true;release?.();control.closeAllConnections();await new Promise<void>(resolve=>control.close(()=>resolve()));await node.app.close();rmSync(directory,{recursive:true,force:true});process.exit(0);}
process.on('SIGTERM',()=>void close());process.on('SIGINT',()=>void close());
