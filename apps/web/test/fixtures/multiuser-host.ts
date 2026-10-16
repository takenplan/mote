import {createHash} from 'node:crypto';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {buildApp} from '../../../server/src/app.js';
import {noteCapture} from '@mote/shared';
import assert from 'node:assert/strict';
import {generatedWebProvider} from './multiuser-provider.js';
import {defaultModelSettings} from '../../../server/src/model-settings.js';

const root=mkdtempSync(join(tmpdir(),'mote-m13-renderer-host-')),password='Generated-M13-account-password-01';
const host=await buildApp({dataDir:root});
let provider:Awaited<ReturnType<typeof generatedWebProvider>>|undefined;
const gates=new Map<string,{entered:boolean;release:()=>void;promise:Promise<void>}>();
const requests:{method:string;url:string;credentialId?:string;body?:unknown}[]=[];
host.app.addHook('onSend',async(req,_reply,payload)=>{
 const key=[...gates.keys()].find(prefix=>(req.method+':'+req.url).startsWith(prefix));
 if(key){const gate=gates.get(key)!;if(!gate.entered){gate.entered=true;process.send?.({event:'entered',key});await gate.promise;gates.delete(key);}}
 return payload;
});
host.app.addHook('onResponse',async(req)=>{if(req.url.startsWith('/api/')&&!req.url.startsWith('/api/auth/'))requests.push({method:req.method,url:req.url,credentialId:req.headers['x-mote-session-id'] as string,body:req.body});});
await host.accounts!.initialize('generated-admin',password);
const call=async(token:string|undefined,url:string,method:any='GET',payload?:unknown)=>{
 const response=await host.app.inject({url,method,headers:{'x-mote-protocol-version':'2','x-mote-ingress-version':'3',...(token?{authorization:'Bearer '+token}:{})},...(payload===undefined?{}:{payload})});
 assert.equal(response.statusCode,200,response.body);return response.json();
};
const admin=await call(undefined,'/api/auth/login','POST',{username:'generated-admin',password,mode:'client'});
const users:Record<string,any>={admin};
for(const owner of ['a','b']){
 await call(admin.token,'/api/admin/accounts','POST',{username:'generated-'+owner,password});
 users[owner]=await call(undefined,'/api/auth/login','POST',{username:'generated-'+owner,password,mode:'client'});
 const token=users[owner].token;
 await call(token,'/api/ingress/devices','POST',{id:'same-device',name:'Generated device',platform:'import'});
 await call(token,'/api/ingress/sources','POST',{id:'same-source',name:'Generated '+owner+' source',kind:'custom',deviceId:'same-device',platform:'import',retention:'archive'});
 await call(token,'/api/ingress/sources/same-source/captures','POST',{batchId:'same-batch',items:[noteCapture({id:'6d477b3e-fb43-4657-818d-c143ad76430f',deviceId:'same-device',deviceName:'Generated device',platform:'import',client:'web',capturedAt:'2026-10-15T12:00:00Z',text:'GENERATED_PRIVATE_'+owner.toUpperCase()})]});
}
await host.app.listen({host:'127.0.0.1',port:0});const port=(host.app.server.address() as {port:number}).port;
process.send?.({event:'ready',url:'http://localhost:'+port,users:Object.fromEntries(Object.entries(users).map(([id,value])=>[id,{userId:value.userId,username:id==='admin'?'generated-admin':'generated-'+id}])),password});
process.on('message',async(message:any)=>{
 try{
  let result:unknown;
  if(message.command==='hold'){
   let release!:()=>void;const promise=new Promise<void>(done=>{release=done;});gates.set(message.key,{entered:false,release,promise});result=true;
  }else if(message.command==='release'){gates.get(message.key)?.release();result=true;
  }else if(message.command==='requests')result=requests.filter(request=>!message.prefix||request.url.startsWith(message.prefix)).slice(-(message.limit??requests.length));
  else if(message.command==='models'){
   provider??=await generatedWebProvider();
   for(const owner of ['a','b']){
    const token=users[owner].token,view=await call(token,'/api/configuration');
    await call(token,'/api/configuration/models','PUT',{revision:view.revision,value:{profiles:[{id:'generated',name:'Generated Web model',settings:{...defaultModelSettings(),provider:'custom',protocol:'anthropic-messages',model:'generated-web',baseUrl:provider.url,apiKey:'GENERATED_'+owner.toUpperCase()+'_KEY',headers:{},extraBody:{}}}],selections:{chat:{kind:'personal',id:'generated'},insight:{kind:'personal',id:'generated'}}}});
   }result=true;
  }else if(message.command==='hold-provider'){if(!provider)throw Error('Configure generated models first');provider.hold(message.owner.toUpperCase());result=true;}
  else if(message.command==='release-provider'){provider?.release();result=true;}
  else if(message.command==='provider-requests')result=provider?.requests;
  else if(message.command==='model-selection')result=await call(users[message.owner].token,'/api/models/selection/'+(message.feature??'chat'));
  else if(message.command==='handoff')result=await call(undefined,'/api/login/requests','POST',{serverUrl:'http://localhost:'+port,deviceId:'same-approval-device',deviceName:'Generated approval device',platform:'other',challenge:createHash('sha256').update('x'.repeat(43)).digest('hex')});
  else if(message.command==='poll')result=await call(undefined,'/api/login/poll','POST',{id:message.requestId,verifier:'x'.repeat(43)});
  else if(message.command==='data')result=await call(users[message.owner].token,'/api/captures?limit=200');
  else if(message.command==='disable')result=await call(admin.token,'/api/admin/accounts/'+users[message.owner].userId,'PATCH',{disabled:message.disabled});
  else if(message.command==='revoke')result=await call(users[message.owner].token,'/api/connections/'+message.credentialId,'DELETE');
  else if(message.command==='close'){
   for(const gate of gates.values())gate.release();provider?.release();await host.app.close();await provider?.close();rmSync(root,{recursive:true,force:true});process.send?.({id:message.id,result:true});process.disconnect();return;
  }else throw Error('Unknown fixture command');
  process.send?.({id:message.id,result});
 }catch(error){process.send?.({id:message.id,error:String(error)});}
});
