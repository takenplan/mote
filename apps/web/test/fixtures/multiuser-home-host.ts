import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {noteCapture} from '@mote/shared';
import {buildApp} from '../../../server/src/app.js';
import {defaultModelSettings} from '../../../server/src/model-settings.js';
import {generatedWebProvider} from './multiuser-provider.js';

// Generated data enters through the same authenticated production routes used
// by collectors. IPC only changes fixture input or delays transport responses.
const directory=mkdtempSync(join(tmpdir(),'mote-parity-home-host-'));
const password='Generated-home-account-password-01';
const host=await buildApp({dataDir:directory});
const provider=await generatedWebProvider();
const users:Record<string,any>={};
const requests:{method:string;url:string;credentialId?:string;at:number}[]=[];
const gates=new Map<string,{entered:boolean;release:()=>void;promise:Promise<void>}>();
host.app.addHook('onRequest',async request=>{
 if(request.url.startsWith('/api/'))requests.push({method:request.method,url:request.url,credentialId:request.headers['x-mote-session-id'] as string,at:Date.now()});
});
host.app.addHook('onSend',async(request,_reply,payload)=>{
 const key=[...gates.keys()].find(prefix=>(request.method+':'+request.url).startsWith(prefix));
 if(key){const gate=gates.get(key)!;if(!gate.entered){gate.entered=true;process.send?.({event:'entered',key});await gate.promise;gates.delete(key);}}
 return payload;
});
const call=async(token:string|undefined,url:string,method:any='GET',payload?:unknown)=>{
 const response=await host.app.inject({url,method,headers:{'x-mote-protocol-version':'2','x-mote-ingress-version':'3',...(token?{authorization:'Bearer '+token}:{})},...(payload===undefined?{}:{payload})});
 assert.equal(response.statusCode,200,response.body);return response.json();
};
const heartbeat=async(owner:string,pending:number,error:string|null)=>call(users[owner].token,'/api/ingress/devices/heartbeat','POST',{
 deviceId:'same-phone',deviceName:'GENERATED_HOME_'+owner.toUpperCase()+'_PHONE',platform:'android',status:error?'error':'capturing',queueDepth:pending,lastCaptureAt:new Date().toISOString(),error,
 sync:{mode:'realtime',state:error?'error':'idle',intervalMinutes:15,batchSize:20,pendingRecords:pending},
});
await host.accounts!.initialize('generated-admin',password);
const admin=await call(undefined,'/api/auth/login','POST',{username:'generated-admin',password,mode:'client'});
for(const owner of ['a','b','empty']){
 await call(admin.token,'/api/admin/accounts','POST',{username:'generated-'+owner,password});
 users[owner]=await call(undefined,'/api/auth/login','POST',{username:'generated-'+owner,password,mode:'client'});
 if(owner==='empty')continue;
 const token=users[owner].token;
 await call(token,'/api/ingress/devices','POST',{id:'same-phone',name:'GENERATED_HOME_'+owner.toUpperCase()+'_PHONE',platform:'android'});
 await heartbeat(owner,owner==='a'?7:13,'GENERATED_HOME_'+owner.toUpperCase()+'_DEVICE_ERROR');
 await call(token,'/api/ingress/sources','POST',{id:'same-source',name:'GENERATED_HOME_'+owner.toUpperCase()+'_SOURCE',kind:'custom',deviceId:'same-phone',platform:'android',retention:'archive'});
 await call(token,'/api/ingress/sources/same-source/captures','POST',{batchId:'same-batch',items:Array.from({length:6},(_,index)=>noteCapture({
  id:'6d477b3e-fb43-5657-a18d-c143ad76430'+index,deviceId:'same-phone',deviceName:'GENERATED_HOME_'+owner.toUpperCase()+'_PHONE',platform:'android',capturedAt:new Date(Date.now()-(6-index)*1000).toISOString(),
  text:'GENERATED_HOME_'+owner.toUpperCase()+'_RECORD_'+index+' GENERATED_PRIVATE_'+owner.toUpperCase(),
 }))});
 const view=await call(token,'/api/configuration');
 await call(token,'/api/configuration/models','PUT',{revision:view.revision,value:{profiles:[{id:'generated',name:'Generated home model',settings:{...defaultModelSettings(),provider:'custom',protocol:'anthropic-messages',model:'generated-home',baseUrl:provider.url,apiKey:'GENERATED_'+owner.toUpperCase()+'_KEY',headers:{},extraBody:{}}}],selections:{chat:{kind:'personal',id:'generated'},insight:{kind:'personal',id:'generated'}}}});
 const end=Date.now()+20000;
 while(!(await call(token,'/api/library/catalog?limit=1')).items.length){assert.ok(Date.now()<end,'Generated note Material publication');await new Promise(resolve=>setTimeout(resolve,20));}
 const insight=await call(token,'/api/insights','POST',{prompt:'GENERATED_IAB_INSIGHT_REQUEST'});
 assert.match(insight.answer,new RegExp('GENERATED_IAB_ANSWER_'+owner.toUpperCase()));
 assert.ok(insight.citations.length,'generated report retains actual owned evidence');
 const redacted=noteCapture({id:'6d477b3e-fb43-5657-a18d-c143ad764306',deviceId:'same-phone',deviceName:'GENERATED_HOME_'+owner.toUpperCase()+'_PHONE',platform:'android',capturedAt:new Date().toISOString(),text:'GENERATED_HOME_'+owner.toUpperCase()+'_RECORD_6 GENERATED_PRIVATE_'+owner.toUpperCase()});
 await call(token,'/api/ingress/sources/same-source/captures','POST',{batchId:'generated-redacted-card',items:[{...redacted,privacy:{...redacted.privacy,redacted:true,reason:'Generated redaction fixture'}}]});
}
await host.app.listen({host:'127.0.0.1',port:0});
const port=(host.app.server.address() as {port:number}).port;
process.send?.({event:'ready',url:'http://localhost:'+port,password,users:Object.fromEntries(Object.entries(users).map(([owner,value])=>[owner,{userId:value.userId,username:'generated-'+owner}]))});
process.on('message',async(message:any)=>{
 try{
  let result:unknown;
  if(message.command==='hold'){
   let release!:()=>void;const promise=new Promise<void>(resolve=>{release=resolve;});gates.set(message.key,{entered:false,release,promise});result=true;
  }else if(message.command==='release'){gates.get(message.key)?.release();result=true;}
  else if(message.command==='heartbeat')result=await heartbeat(message.owner,message.pending,message.error??null);
  else if(message.command==='requests')result=requests.filter(request=>!message.prefix||request.url.startsWith(message.prefix));
  else if(message.command==='read')result=await call(users[message.owner].token,message.path);
  else if(message.command==='close'){
   for(const gate of gates.values())gate.release();await host.app.close();await provider.close();rmSync(directory,{recursive:true,force:true});process.send?.({id:message.id,result:true});process.disconnect();return;
  }else throw Error('Unknown generated home command');
  process.send?.({id:message.id,result});
 }catch(error){process.send?.({id:message.id,error:String(error)});}
});
