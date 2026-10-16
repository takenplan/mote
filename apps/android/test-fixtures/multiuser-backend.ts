import {mkdtempSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createServer} from 'node:http';
import {buildApp} from '../../server/src/app.js';
const directory=mkdtempSync(join(tmpdir(),'m15-kotlin-backend-'));
const node=await buildApp({dataDir:directory});
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
let holdNext=false,entered=false,release:(()=>void)|undefined;
node.app.addHook('onSend',async(request,reply,payload)=>{
 if(holdNext&&reply.statusCode===200&&/^\/api\/ingress\/sources\/[^/]+\/captures$/.test(request.url)){holdNext=false;entered=true;await new Promise<void>(resolve=>{release=resolve;});}
 return payload;
});
const address=await node.app.listen({host:'127.0.0.1',port:0});
const port=Number(new URL(address).port);
const control=createServer((request,response)=>{void(async()=>{
 if(request.url==='/hold-next'){entered=false;holdNext=true;}
 else if(request.url==='/release'){release?.();release=undefined;}
 else if(request.url==='/network/off'){node.app.server.closeAllConnections();await new Promise<void>((resolve,reject)=>node.app.server.close(error=>error?reject(error):resolve()));}
 else if(request.url==='/network/on'){await new Promise<void>((resolve,reject)=>{node.app.server.once('error',reject);node.app.server.listen(port,'127.0.0.1',()=>{node.app.server.removeListener('error',reject);resolve();});});}
 else if(request.url!=='/state'){response.writeHead(404);response.end();return;}
 response.setHeader('Content-Type','application/json');response.end(JSON.stringify({entered,held:!!release}));
 })().catch(error=>{response.writeHead(500);response.end(JSON.stringify({error:String(error)}));});});
await new Promise<void>(resolve=>control.listen(0,'127.0.0.1',resolve));
const controlAddress='http://127.0.0.1:'+(control.address() as {port:number}).port;
process.stdout.write(JSON.stringify({address,controlAddress,admin,a,b,password,pid:process.pid})+'\n');
let closing=false;async function close(){if(closing)return;closing=true;release?.();control.closeAllConnections();await new Promise<void>(resolve=>control.close(()=>resolve()));await node.app.close();rmSync(directory,{recursive:true,force:true});process.exit(0);}
process.on('SIGTERM',()=>void close());process.on('SIGINT',()=>void close());
