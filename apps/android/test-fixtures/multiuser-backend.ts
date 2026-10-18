import {mkdtempSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createServer} from 'node:http';
import {DatabaseSync} from 'node:sqlite';
import {randomUUID} from 'node:crypto';
import {buildApp} from '../../server/src/app.js';
import {defaultModelSettings} from '../../server/src/model-settings.js';
import {defaultProcessingSettings} from '../../server/src/scope/processing-schema.js';
import {generatedScopedPluginRelease} from '../../server/test/fixtures/scoped-plugin-release.js';
const directory=mkdtempSync(join(tmpdir(),'m15-kotlin-backend-'));
const releaseFixture=process.argv.includes("--plugins")?generatedScopedPluginRelease():undefined;
const node=await buildApp({dataDir:directory},releaseFixture?{pluginReleaseTransport:releaseFixture.transport}:undefined);
const archiveReads:{owner:string;path:string;status:number}[]=[];
const fixtureOwners=new Map<string,string>();
// Test-only transport controls. Product routes, ownership checks and durable
// receipt writes still run before a response is held or its connection drops.
const ingressRequests:{owner:string;method:string;path:string;status:number}[]=[];
let holdUpload:'begin'|'part'|'commit'|undefined,heldUploadId:string|undefined,dropNextCommit=false,droppedCommitId:string|undefined;
let holdNext=false,entered=false,release:(()=>void)|undefined;
node.app.addHook('onSend',async(request,reply,payload)=>{
 const owner=fixtureOwners.get(String(request.headers.authorization))??'other';
 if(request.url.startsWith('/api/ingress/')||request.url==='/api/sources')ingressRequests.push({owner,method:request.method,path:request.url,status:reply.statusCode});
 if(request.method==='GET'&&request.url.startsWith('/api/capture-browser'))archiveReads.push({owner,path:request.url,status:reply.statusCode});
 if(reply.statusCode>=400)process.stderr.write(JSON.stringify({method:request.method,path:request.url,status:reply.statusCode,response:payload})+'\n');
 if(holdNext&&reply.statusCode===200&&/^\/api\/ingress\/sources\/[^/]+\/captures$/.test(request.url)){holdNext=false;entered=true;await new Promise<void>(resolve=>{release=resolve;});}
 if(reply.statusCode===200&&request.method==='POST'&&/^\/api\/ingress\/sources\/[^/]+\/uploads$/.test(request.url)&&holdUpload==='begin'){const begun=JSON.parse(String(payload));if(!/^[a-f0-9-]{36}$/.test(begun.id))throw Error('Generated upload begin response missing ID');holdUpload=undefined;heldUploadId=begun.id;entered=true;await new Promise<void>(resolve=>{release=resolve;});}
 const upload=/^\/api\/ingress\/uploads\/([a-f0-9-]{36})\/(parts\/0|commit)$/.exec(request.url);
 if(reply.statusCode===200&&upload&&holdUpload===(upload[2]==='commit'?'commit':'part')){holdUpload=undefined;heldUploadId=upload[1];entered=true;await new Promise<void>(resolve=>{release=resolve;});}
 if(reply.statusCode===200&&upload?.[2]==='commit'&&dropNextCommit){dropNextCommit=false;droppedCommitId=upload[1];reply.raw.destroy();}
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
fixtureOwners.set('Bearer '+a.token,'a');fixtureOwners.set('Bearer '+b.token,'b');
let retiredTokenStatus:number|undefined;
if(process.argv.includes('--relogin')){
 const old=a.token,auth={...headers,authorization:'Bearer '+old};
 const opened=await node.app.inject({url:'/api/configuration',headers:auth});if(opened.statusCode!==200)throw Error('Generated relogin first configuration failed');
 const logout=await node.app.inject({url:'/api/auth/logout',method:'POST',headers:auth,payload:{}});if(logout.statusCode!==200)throw Error('Generated actual logout failed '+logout.statusCode);
 retiredTokenStatus=(await node.app.inject({url:'/api/connections/self',headers:auth})).statusCode;if(retiredTokenStatus!==401)throw Error('Generated old credential was not retired');
 Object.assign(a,await login('generated-a'));
 fixtureOwners.set('Bearer '+a.token,'a');
}

const ocr=process.argv.includes('--ocr')?createServer(async(request,response)=>{
 for await(const _chunk of request){}const owner=String(request.headers.authorization).includes('GENERATED_B_KEY')?'B':'A';
 response.setHeader('Content-Type','application/json');response.setHeader('X-Mote-Execution','local');response.end(JSON.stringify({durationMs:0,segments:[{startMs:0,endMs:0,text:'GENERATED_'+owner+'_NATIVE_CENTRAL_OCR'}],coverage:'full',engine:'generated-native-http-fixture'}));
}):undefined;
if(ocr){await new Promise<void>(resolve=>ocr.listen(0,'127.0.0.1',resolve));const url='http://127.0.0.1:'+(ocr.address() as {port:number}).port+'/transcribe';
 for(const [account,label] of [[a,'A'],[b,'B']] as const){for(const [domain,value] of [['processing',{...defaultProcessingSettings(),automatic:false,understandingEnabled:false,summarize:false}],['models',{profiles:[{id:'generated-ocr',name:'Generated OCR',settings:{...defaultModelSettings(),provider:'custom',protocol:'mote-media',baseUrl:url,model:'generated-ocr',apiKey:'GENERATED_'+label+'_KEY'}}],selections:{ocr:{kind:'personal',id:'generated-ocr'}}}]] as const){const auth={...headers,authorization:'Bearer '+account.token},revision=(await node.app.inject({url:'/api/configuration',headers:auth})).json().revision;const result=await node.app.inject({url:'/api/configuration/'+domain,method:'PUT',headers:auth,payload:{revision,value}});if(result.statusCode!==200)throw new Error(result.body);}}
}

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
 if(request.url==='/archive-reads/reset'){archiveReads.length=0;}
 else if(request.url==='/archive-reads'){}
 else if(request.url==='/hold-next'){entered=false;holdNext=true;}
 else if(request.url==='/ingress/reset'){ingressRequests.length=0;}
 else if(request.url==='/uploads/hold-begin'){entered=false;heldUploadId=undefined;holdUpload='begin';}
 else if(request.url==='/uploads/hold-part'){entered=false;heldUploadId=undefined;holdUpload='part';}
 else if(request.url==='/uploads/hold-commit'){entered=false;heldUploadId=undefined;holdUpload='commit';}
 else if(request.url==='/uploads/drop-commit'){droppedCommitId=undefined;dropNextCommit=true;}
 else if(request.url?.startsWith('/uploads/expire/')){const id=request.url.slice('/uploads/expire/'.length);if(!/^[a-f0-9-]{36}$/.test(id))throw Error('Invalid generated upload ID');const db=new DatabaseSync(join(directory,'mote.sqlite'));try{const changed=db.prepare('UPDATE ig_uploads SET expires=? WHERE id=?').run(Date.now()-86400001,id);if(Number(changed.changes)!==1)throw Error('Generated upload session not found');}finally{db.close();}}
 else if(request.url==='/uploads/state'){}
 else if(request.url==='/release'){release?.();release=undefined;}
 else if(request.url==='/network/off'){node.app.server.closeAllConnections();await new Promise<void>((resolve,reject)=>node.app.server.close(error=>error?reject(error):resolve()));}
 else if(request.url==='/network/on'){await new Promise<void>((resolve,reject)=>{node.app.server.once('error',reject);node.app.server.listen(port,'127.0.0.1',()=>{node.app.server.removeListener('error',reject);resolve();});});}
 else if(request.url?.startsWith('/ocr/')&&ocr){
  const match=/^\/ocr\/(a|b)\/([a-f0-9-]{36})$/.exec(request.url);if(!match)throw Error('Invalid generated OCR request');const actor=match[1]==='a'?a:b,context=await node.authority.authenticate(actor.token),original=node.ingress.forUser(context).originalForCapture(match[2]);
  const auth={...headers,authorization:'Bearer '+actor.token},started=await node.app.inject({url:'/api/processing',method:'POST',headers:auth,payload:{originalRef:original.ref,operationId:'generated-native-ocr:'+match[2]}});if(started.statusCode!==200)throw Error(started.body);
  let task:any;const deadline=Date.now()+15000;do{task=(await node.app.inject({url:'/api/tasks/'+started.json().id,headers:auth})).json();if(task.state==='succeeded')break;if(['failed','blocked','stale','cancelled'].includes(task.state))throw Error(JSON.stringify(task));await new Promise(resolve=>setTimeout(resolve,5));}while(Date.now()<deadline);if(task.state!=='succeeded')throw Error('Generated OCR timeout');
 }
 else if(request.url==='/snapshot/expire'){const db=new DatabaseSync(join(directory,'mote.sqlite'));try{db.prepare('UPDATE ig_snapshot_inputs SET expires=?').run(Date.now()-1);}finally{db.close();}}
 else if(request.url!=='/state'){response.writeHead(404);response.end();return;}
 let uploads:unknown[]|undefined;if(request.url==='/uploads/state'){const db=new DatabaseSync(join(directory,'mote.sqlite'));try{uploads=db.prepare('SELECT id,user_id AS userId,source_id AS sourceId,expires,receipt IS NOT NULL AS committed FROM ig_uploads ORDER BY id').all().map(row=>({...row,parts:db.prepare('SELECT part,bytes,checksum FROM ig_upload_parts WHERE upload_id=? ORDER BY part').all(String(row.id))}));}finally{db.close();}}
 response.setHeader('Content-Type','application/json');response.end(JSON.stringify({entered,held:!!release,archiveReads,ingressRequests,heldUploadId,droppedCommitId,uploads}));
 })().catch(error=>{response.writeHead(500);response.end(JSON.stringify({error:String(error)}));});});
await new Promise<void>(resolve=>control.listen(0,'127.0.0.1',resolve));
const controlAddress='http://127.0.0.1:'+(control.address() as {port:number}).port;
process.stdout.write(JSON.stringify({address,controlAddress,admin,a,b,password,pid:process.pid,pluginPackageId,retiredTokenStatus})+'\n');
let closing=false;async function close(){if(closing)return;closing=true;release?.();control.closeAllConnections();await new Promise<void>(resolve=>control.close(()=>resolve()));await node.app.close();if(ocr){ocr.closeAllConnections();await new Promise<void>(resolve=>ocr.close(()=>resolve()));}rmSync(directory,{recursive:true,force:true});process.exit(0);}
process.on('SIGTERM',()=>void close());process.on('SIGINT',()=>void close());
