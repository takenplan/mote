import type {TestContext} from 'node:test';
import {randomUUID} from 'node:crypto';
import {createServer} from 'node:http';
import {scopedCaptureFixture} from '../../server/test/fixtures/scoped-capture-host.js';

// Actual M01/M04/M09/M10/M05/M03; only the external Lark CLI returns generated
// data. Installing the bundled connector does not install or invoke a CLI.
const cleanup:Array<()=>unknown>=[];
const logged=new Set<string>();
let complete!:()=>void;
const heldLogin=new Promise<void>(resolve=>complete=resolve);
const f=await scopedCaptureFixture({after:(work:()=>unknown)=>cleanup.push(work)} as unknown as TestContext,{
 connectorTransports:{lark:scope=>async(command,options)=>{
  switch(command.kind){
   case 'version':return 'lark-cli 1.0.85';
   case 'status':return JSON.stringify({appId:'cli_generated',identities:{user:{available:logged.has(scope.userId),openId:'same-open-id',userName:'GENERATED_LARK_'+scope.userId,scope:'docx:document:readonly wiki:wiki:readonly search:docs:read space:document:retrieve calendar:calendar:readonly'}}});
   case 'login':return JSON.stringify({verification_url:'https://accounts.feishu.cn/generated/'+scope.userId,device_code:'GENERATED_'+scope.userId,expires_in:600});
   case 'complete':await heldLogin;if(options?.signal?.aborted)throw Error('Generated authorization retired');logged.add(scope.userId);return '{}';
   case 'document':return JSON.stringify({data:{document:{document_id:'DocumentFixture123',revision_id:1,title:'GENERATED_DOC_'+scope.userId,content:'GENERATED_LARK_BODY_'+scope.userId}}});
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
const control=createServer((request,response)=>{if(request.method==='POST'&&request.url==='/generated/release-lark-login'){complete();response.setHeader('content-type','application/json');response.end('{"released":true}');}else {response.statusCode=404;response.end();}});
await new Promise<void>(resolve=>control.listen(0,'127.0.0.1',resolve));
const controlPort=control.address();if(!controlPort||typeof controlPort==='string')throw Error('Missing generated control listener');
const address=await f.host.app.listen({host:'127.0.0.1',port:0});
process.stdout.write(JSON.stringify({address,controlAddress:'http://127.0.0.1:'+controlPort.port,a:f.a,b:f.b,admin:f.admin,password:'Generated-M13-archive-only-01',pid:process.pid})+'\n');
let closing=false;async function close(){if(closing)return;closing=true;complete();control.closeAllConnections();await new Promise<void>(resolve=>control.close(()=>resolve()));for(const work of cleanup.reverse())await work();process.exit(0);}
process.on('SIGTERM',()=>void close());process.on('SIGINT',()=>void close());
