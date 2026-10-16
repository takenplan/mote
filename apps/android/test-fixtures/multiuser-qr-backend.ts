import type {TestContext} from 'node:test';
import {createServer} from 'node:http';
import {buildApp} from '../../server/src/app.js';
import {scopedFilesFixture} from '../../server/test/fixtures/scoped-files.js';

// Actual M01 pairing and M03 upload. Faults only remove real HTTP replies or
// corrupt a declared self field; no token/receipt/authority is manufactured.
const cleanup:Array<()=>unknown>=[],claims:Array<{id:string;challenge:string;deviceId:string;userId:string}>=[],acks:string[]=[],invitations:Array<{userId:string;deviceId?:string}>=[];
const ackStatuses:number[]=[];let verifiedDeviceReads=0,latestCredentialId='';
let dropRedeem=false,dropAck=false,badSelf='';
const revokeAfterRestart=process.argv.includes('--revoke-after-restart'),restartAfterAck=revokeAfterRestart||process.argv.includes('--restart-after-ack');let restarted=false,revokedAfterRestart=false;
function observe(host:Awaited<ReturnType<typeof buildApp>>){
 host.app.addHook('onSend',async(request,reply,payload)=>{
  if(request.method==='POST'&&request.url==='/api/login/ack')ackStatuses.push(reply.statusCode);
  if(request.method==='GET'&&request.url==='/api/connections/self'&&reply.statusCode===200&&JSON.parse(String(payload)).credential.deviceId)verifiedDeviceReads++;
  if(request.method==='POST'&&request.url==='/api/login/poll'&&reply.statusCode===200){const value=JSON.parse(String(payload));if(value.ready===true)latestCredentialId=value.credentialId;}
  if(request.method==='POST'&&request.url==='/api/connections/invitations'&&reply.statusCode===200){const value=JSON.parse(String(payload)).invitation;invitations.push({userId:value.userId,...value.deviceId?{deviceId:value.deviceId}:{}});}
  if(request.method==='POST'&&request.url==='/api/connections/redeem'&&reply.statusCode===200){
   const input=request.body as {challenge:string;deviceId:string;expected:{userId:string}},value=JSON.parse(String(payload));claims.push({id:value.id,challenge:input.challenge,deviceId:input.deviceId,userId:input.expected.userId});if(dropRedeem)reply.raw.destroy();
  }
  if(request.method==='POST'&&request.url==='/api/login/ack'&&reply.statusCode===200){acks.push((request.body as {id:string}).id);if(dropAck)reply.raw.destroy();}
  if(request.method==='GET'&&request.url==='/api/connections/self'&&reply.statusCode===200&&badSelf){
   const value=JSON.parse(String(payload));if(value.credential.deviceId){
    if(badSelf==='owner')value.account.userId='generated-wrong-owner';else if(badSelf==='credential')value.account.credentialId='generated-wrong-credential';else if(badSelf==='deployment')value.account.deploymentId='generated-replacement';else if(badSelf==='kind')value.credential.kind='device';else value.credential.deviceId='generated-wrong-device';
    return JSON.stringify(value);
   }
  }
  return payload;
 });
}
const f=await scopedFilesFixture({after:(work:()=>unknown)=>cleanup.push(work)} as unknown as TestContext,observe);
let currentHost=f.host;
for(const actor of [f.a,f.b]){
 const config=await f.checked(actor.token,'/api/configuration'),memory=config.domains.find((domain:any)=>domain.id==='memory').effective;
 await f.checked(actor.token,'/api/configuration/memory','PUT',{revision:config.revision,value:{...memory,automatic:false,integration:false,lifecycle:{...memory.lifecycle,insights:{...memory.lifecycle.insights,enabled:false},working:{...memory.lifecycle.working,enabled:false},consolidation:{...memory.lifecycle.consolidation,enabled:false}}}});
}
const control=createServer((request,response)=>{void(async()=>{
 if(request.method!=='POST'){response.statusCode=404;response.end();return;}
 if(request.url==='/generated/drop-redeem')dropRedeem=true;
 else if(request.url==='/generated/drop-ack'){dropRedeem=false;dropAck=true;}
 else if(request.url==='/generated/release-pairing'){
  dropRedeem=false;dropAck=false;badSelf='';
  if(restartAfterAck&&acks.length&&!restarted){
   const oldAddress=currentHost.app.server.address();if(!oldAddress||typeof oldAddress==='string')throw Error('No generated source host port');
   await currentHost.app.close();currentHost=await buildApp({dataDir:f.directory});observe(currentHost);cleanup.push(()=>currentHost.app.close());
   await currentHost.app.listen({host:'127.0.0.1',port:oldAddress.port});restarted=true;
   if(revokeAfterRestart){const result=await currentHost.app.inject({method:'DELETE',url:'/api/connections/'+latestCredentialId,headers:{'x-mote-protocol-version':'2',authorization:'Bearer '+f.a.token}});if(result.statusCode!==200)throw Error('Generated credential revoke failed');revokedAfterRestart=true;}
  }
 }
 else if(request.url?.startsWith('/generated/bad-self/'))badSelf=request.url.split('/').at(-1)!;
 else if(request.url!=='/generated/pairing-state'){response.statusCode=404;response.end();return;}
 response.setHeader('content-type','application/json');response.end(JSON.stringify({claims,acks,invitations,dropRedeem,dropAck,restarted,revokedAfterRestart,ackStatuses,verifiedDeviceReads}));
 })().catch(error=>{response.statusCode=500;response.end(JSON.stringify({error:'generated_restart_failed',name:error?.name??'Error'}));});
});await new Promise<void>(resolve=>control.listen(0,'127.0.0.1',resolve));const controlAddress=control.address();if(!controlAddress||typeof controlAddress==='string')throw Error('No generated pairing control');
const address=await f.host.app.listen({host:'127.0.0.1',port:0});process.stdout.write(JSON.stringify({address,controlAddress:'http://127.0.0.1:'+controlAddress.port,a:f.a,b:f.b,admin:f.admin,password:'Generated-joint-files-password',pid:process.pid})+'\n');
let closing=false;async function close(){if(closing)return;closing=true;control.closeAllConnections();for(const work of cleanup.reverse())await work();await new Promise<void>(resolve=>control.close(()=>resolve()));process.exit(0);}
process.on('SIGTERM',()=>void close());process.on('SIGINT',()=>void close());
