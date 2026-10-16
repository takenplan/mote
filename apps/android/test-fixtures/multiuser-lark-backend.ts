import type {TestContext} from 'node:test';
import {randomUUID} from 'node:crypto';
import {createServer,request as forward} from 'node:http';
import {scopedCaptureFixture} from '../../server/test/fixtures/scoped-capture-host.js';

// Actual M01/M04/M09/M10/M05/M03; only the external Lark CLI returns generated
// data. Installing the bundled connector does not install or invoke a CLI.
const cleanup:Array<()=>unknown>=[];
const logged=new Set<string>();
let complete!:()=>void;
const heldLogin=new Promise<void>(resolve=>complete=resolve);
let failDocument=false,holdDocument=false,documentEntered=false,releaseDocument:(()=>void)|undefined;
let dropDisconnect=false;
const disconnectCommands:Array<{operationId:string;taskId:string}>=[];
const f=await scopedCaptureFixture({after:(work:()=>unknown)=>cleanup.push(work)} as unknown as TestContext,{
 connectorTransports:{lark:scope=>async(command,options)=>{
  switch(command.kind){
   case 'version':return 'lark-cli 1.0.85';
   case 'status':return JSON.stringify({appId:'cli_generated',identities:{user:{available:logged.has(scope.userId),openId:'same-open-id',userName:'GENERATED_LARK_'+scope.userId,scope:'docx:document:readonly wiki:wiki:readonly search:docs:read space:document:retrieve calendar:calendar:readonly'}}});
   case 'login':return JSON.stringify({verification_url:'https://accounts.feishu.cn/generated/'+scope.userId,device_code:'GENERATED_'+scope.userId,expires_in:600});
   case 'complete':await heldLogin;if(options?.signal?.aborted)throw Error('Generated authorization retired');logged.add(scope.userId);return '{}';
   case 'document':
    documentEntered=true;
    if(holdDocument)await new Promise<void>((resolve,reject)=>{
     const aborted=()=>{options?.signal?.removeEventListener('abort',aborted);reject(Error('Generated document cancelled'));};
     releaseDocument=()=>{options?.signal?.removeEventListener('abort',aborted);resolve();};
     if(options?.signal?.aborted)aborted();else options?.signal?.addEventListener('abort',aborted,{once:true});
    });
    if(options?.signal?.aborted)throw Error('Generated document cancelled');
    if(failDocument)throw Error('GENERATED_PROVIDER_PRIVATE_FAILURE');
    return JSON.stringify({data:{document:{document_id:'DocumentFixture123',revision_id:1,title:'GENERATED_DOC_'+scope.userId,content:'GENERATED_LARK_BODY_'+scope.userId}}});
   case 'calendars':return JSON.stringify({data:{calendar_list:[{calendar_id:'same-calendar',summary:'GENERATED_CALENDAR_'+scope.userId,role:'owner'}],has_more:false}});
   case 'events':return JSON.stringify({data:{items:[]}});
   default:throw Error('Unexpected generated Lark I/O '+command.kind);
  }
 }}
});
async function checked(token:string,path:string,method='GET',payload?:unknown){const result=await f.request(token,path,method,payload);if(result.statusCode!==200)throw Error(path+': '+result.statusCode+' '+result.body);return result.json();}
await checked(f.admin.token,'/api/admin/connectors/lark/install','POST',{expectedRevision:f.host.plugins!.catalog.revision(),operationId:randomUUID()});
for(const account of [f.a,f.b]){
 const view=await checked(account.token,'/api/connectors');
 await checked(account.token,'/api/connectors/same-lark','PUT',{expectedRevision:view.revision,connection:{provider:'lark',autoSync:false}});
 const plugins=await checked(account.token,'/api/plugins');
 await checked(account.token,'/api/connectors/same-lark/enable','POST',{expectedRevision:plugins.revision});
}
const control=createServer((request,response)=>{
 if(request.method!=='POST'){response.statusCode=404;response.end();return;}
 if(request.url==='/generated/release-lark-login')complete();
 else if(request.url==='/generated/fail-document')failDocument=true;
 else if(request.url==='/generated/retry-document')failDocument=false;
 else if(request.url==='/generated/hold-document'){holdDocument=true;documentEntered=false;}
 else if(request.url==='/generated/release-document'){holdDocument=false;releaseDocument?.();}
 else if(request.url==='/generated/drop-disconnect-ack')dropDisconnect=true;
 else if(request.url==='/generated/release-disconnect-ack')dropDisconnect=false;
 else if(request.url!=='/generated/document-state'){response.statusCode=404;response.end();return;}
 response.setHeader('content-type','application/json');response.end(JSON.stringify({released:true,documentEntered,failDocument,holdDocument,disconnectCommands}));
});
await new Promise<void>(resolve=>control.listen(0,'127.0.0.1',resolve));
const controlPort=control.address();if(!controlPort||typeof controlPort==='string')throw Error('Missing generated control listener');
const backend=await f.host.app.listen({host:'127.0.0.1',port:0});
// Network-only fault injection after the real M10 admission. Never replace a
// route, response body, executor or receipt with a hand-authored success.
const proxy=createServer((request,response)=>{
 const chunks:Buffer[]=[];const disconnect=request.method==='POST'&&request.url==='/api/connectors/same-lark/disconnect';
 if(disconnect)request.on('data',chunk=>chunks.push(Buffer.from(chunk)));
 const upstream=forward(new URL(request.url!,backend),{method:request.method,headers:{...request.headers,host:new URL(backend).host}},reply=>{
  if(disconnect&&reply.statusCode===200){const result:Buffer[]=[];reply.on('data',chunk=>result.push(Buffer.from(chunk)));reply.on('end',()=>{
   disconnectCommands.push({operationId:JSON.parse(Buffer.concat(chunks).toString()).operationId,taskId:JSON.parse(Buffer.concat(result).toString()).id});
   if(dropDisconnect)response.destroy();else {response.writeHead(reply.statusCode!,reply.headers);response.end(Buffer.concat(result));}
  });}else {response.writeHead(reply.statusCode!,reply.headers);reply.pipe(response);}
 });upstream.on('error',()=>response.destroy());request.pipe(upstream);
});await new Promise<void>(resolve=>proxy.listen(0,'127.0.0.1',resolve));const proxyAddress=proxy.address();if(!proxyAddress||typeof proxyAddress==='string')throw Error('Missing generated Lark fault listener');
process.stdout.write(JSON.stringify({address:'http://127.0.0.1:'+proxyAddress.port,controlAddress:'http://127.0.0.1:'+controlPort.port,a:f.a,b:f.b,admin:f.admin,password:'Generated-M13-archive-only-01',pid:process.pid})+'\n');
let closing=false;async function close(){if(closing)return;closing=true;complete();releaseDocument?.();control.closeAllConnections();proxy.closeAllConnections();await Promise.all([new Promise<void>(resolve=>control.close(()=>resolve())),new Promise<void>(resolve=>proxy.close(()=>resolve()))]);for(const work of cleanup.reverse())await work();process.exit(0);}
process.on('SIGTERM',()=>void close());process.on('SIGINT',()=>void close());
