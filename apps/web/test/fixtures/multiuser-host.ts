import {createHash} from 'node:crypto';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {buildApp} from '../../../server/src/app.js';
import {noteCapture,parseEvidenceRef} from '@mote/shared';
import assert from 'node:assert/strict';
import {generatedWebProvider} from './multiuser-provider.js';
import {defaultModelSettings} from '../../../server/src/model-settings.js';
import {generatedScopedPluginRelease} from '../../../server/test/fixtures/scoped-plugin-release.js';

const fixtureHostname=process.env.MOTE_WEB_FIXTURE_HOSTNAME??'localhost';
assert.match(fixtureHostname,/^(?:localhost|[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.localhost)$/,'Generated browser fixture must stay loopback-only');
const root=mkdtempSync(join(tmpdir(),'mote-m13-renderer-host-')),password='Generated-M13-account-password-01';
const pluginRelease=generatedScopedPluginRelease();
const host=await buildApp({dataDir:root},{pluginReleaseTransport:pluginRelease.transport});
let provider:Awaited<ReturnType<typeof generatedWebProvider>>|undefined;
const gates=new Map<string,{entered:boolean;release:()=>void;promise:Promise<void>}>();
const requests:{method:string;url:string;credentialId?:string;body?:unknown}[]=[];
const readStatuses:{path:string;status:number}[]=[];
const statusPaths:Record<string,string>={'/api/login/exchange':'login_exchange','/api/auth/self':'auth_self','/api/auth/login':'manual_login','/api/context/read':'context_read','/api/agent-view/materials':'material_catalog','/api/agent-view/material-read':'material_read'};
host.app.addHook('onResponse',async(req,reply)=>{const path=statusPaths[req.url.split('?')[0]];if(path)readStatuses.push({path,status:reply.statusCode});});
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
process.send?.({event:'ready',url:'http://'+fixtureHostname+':'+port,users:Object.fromEntries(Object.entries(users).map(([id,value])=>[id,{userId:value.userId,username:id==='admin'?'generated-admin':'generated-'+id}])),password});
/** Fixture locator follows complete public pages and binds a canonical span to
 * the known generated raw member AND exact generated body, never a first ref. */
const locatorStages:{stage:string;[key:string]:string|number|boolean}[]=[];
function locatorStage(stage:string,facts:Record<string,number|boolean>={}){const record={stage,...facts};locatorStages.push(record);process.send?.({event:'locator-stage',...record});}
function locatorCheck(ok:unknown,stage:string,facts:Record<string,number|boolean>={}):asserts ok{locatorStage(stage,{...facts,passed:Boolean(ok)});if(!ok)throw Error('LOCATOR_CONTRACT_FAILED');}
async function evidenceTargets(){
 const sharedRaw='6d477b3e-fb43-4657-818d-c143ad76430f',deadline=Date.now()+25000,targets:Record<string,{reference:string;rawPublicId:string}>={};
 const read=async(owner:string,path:string,method='GET',payload?:unknown)=>{const response=await fetch('http://127.0.0.1:'+port+path,{method,headers:{'x-mote-protocol-version':'2','x-mote-ingress-version':'3',authorization:'Bearer '+users[owner].token,...(payload===undefined?{}:{'content-type':'application/json'})},...(payload===undefined?{}:{body:JSON.stringify(payload)})});locatorCheck(response.status===200,'public-http-response',{status:response.status});return response.json();};
 for(const [ownerIndex,owner] of ['a','b'].entries()){
  locatorStage('owner-start',{ownerIndex});const marker='GENERATED_PRIVATE_'+owner.toUpperCase(),raw=await read(owner,'/api/captures/'+sharedRaw);
  locatorCheck(raw.id===sharedRaw&&raw.ocrText===marker,'raw-current-owner',{ownerIndex,idMatches:raw.id===sharedRaw,markerMatches:raw.ocrText===marker});
  const materials:any[]=[];let cursor:string|undefined;const cursors=new Set<string>();
  do{let page:any;do{page=await read(owner,'/api/agent-view/materials?'+new URLSearchParams({sourceId:'same-source',limit:'30',...(cursor?{cursor}:{})}));locatorCheck(Array.isArray(page.items),'catalog-shape',{ownerIndex});if(!page.items.length&&!cursor){locatorCheck(Date.now()<deadline,'catalog-producer-deadline',{ownerIndex});await new Promise(resolve=>setTimeout(resolve,10));}}while(!page.items.length&&!cursor);
   materials.push(...page.items);cursor=page.nextCursor??undefined;if(cursor){locatorCheck(!cursors.has(cursor),'catalog-cursor-progress',{ownerIndex});cursors.add(cursor);}
  }while(cursor);
  locatorStage('catalog-complete',{ownerIndex,materials:materials.length});const matches=new Set<string>();
  for(const material of materials){let offset=0;do{
   const page=await read(owner,'/api/agent-view/material-read?'+new URLSearchParams({ref:material.ref,offset:String(offset),length:'12000'}));
   locatorCheck(Array.isArray(page.originalRefs)&&Array.isArray(page.spans)&&Array.isArray(page.sourceSpans)&&typeof page.text==='string','material-read-shape',{ownerIndex,refs:Array.isArray(page.originalRefs)?page.originalRefs.length:0,spans:Array.isArray(page.spans)?page.spans.length:0,sourceSpans:Array.isArray(page.sourceSpans)?page.sourceSpans.length:0});
   locatorCheck(page.material?.ref===material.ref&&page.originalRefsTruncated===false&&page.originalRefsTotal===page.originalRefs.length,'material-current-complete',{ownerIndex,current:page.material?.ref===material.ref,refsComplete:page.originalRefsTruncated===false&&page.originalRefsTotal===page.originalRefs.length});
   for(const span of page.spans){if(!span.memberIds?.includes(sharedRaw)||page.text.slice(span.pageRange.start,span.pageRange.end)!==marker)continue;
    for(const sourceSpan of page.sourceSpans){const record=sourceSpan.record;if(record?.provenance?.uri!==material.ref+'#'+span.blockId||record.ocrText!==marker||record.capturedAt!==raw.capturedAt)continue;
     const citation=page.originalRefs.find((ref:string)=>{const parsed=parseEvidenceRef(ref);return parsed?.kind==='capture'&&parsed.id===record.id;});
     locatorCheck(Boolean(citation)&&record.id!==sharedRaw,'canonical-member-binding',{ownerIndex,knownRawMember:true,markerMatches:true,sourceSpanMatches:true,typedCitationMatches:Boolean(citation),canonicalDiffersFromRaw:record.id!==sharedRaw});matches.add(citation);
    }
   }
   const nextOffset=page.textRange?.nextOffset;locatorCheck(nextOffset===null||(Number.isInteger(nextOffset)&&nextOffset>offset),'material-window-progress',{ownerIndex,complete:nextOffset===null});if(nextOffset===null)break;offset=nextOffset;
  }while(true);}
  locatorCheck(matches.size===1,'unique-generated-target',{ownerIndex,matches:matches.size});const citation=[...matches][0],readback=await read(owner,'/api/context/read','POST',{refs:[citation],offset:0,length:4000});
  locatorCheck(readback.items?.length===1&&readback.items[0]?.ref===citation&&readback.items[0]?.text===marker,'context-owner-readback',{ownerIndex,items:readback.items?.length??0,typedRefMatches:readback.items?.[0]?.ref===citation,markerMatches:readback.items?.[0]?.text===marker});targets[owner]={reference:'context:'+citation,rawPublicId:raw.id};
 }
 locatorCheck(targets.a.rawPublicId===targets.b.rawPublicId&&targets.a.reference!==targets.b.reference,'owner-identity-contract',{sameRawPublicId:targets.a.rawPublicId===targets.b.rawPublicId,distinctCanonical:targets.a.reference!==targets.b.reference});
 const foreign=await fetch('http://127.0.0.1:'+port+'/api/context/read',{method:'POST',headers:{'x-mote-protocol-version':'2',authorization:'Bearer '+users.b.token,'content-type':'application/json'},body:JSON.stringify({refs:[targets.a.reference.slice('context:'.length)],offset:0,length:4000})});await foreign.arrayBuffer();locatorCheck(foreign.status===404,'exact-cross-owner-denied',{status:foreign.status});
 return {a:targets.a,b:targets.b,sameRawPublicId:true,crossOwnerCanonicalStatus:foreign.status};
}
process.on('message',async(message:any)=>{
 try{
  let result:unknown;
  if(message.command==='evidence-targets'){result=await evidenceTargets();
  }else if(message.command==='locator-diagnostics'){result=locatorStages.map(record=>({...record}));
  }else if(message.command==='read-statuses'){result=readStatuses.map(row=>({...row}));
  }else if(message.command==='hold'){
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
  else if(message.command==='ticket')result=await call(users[message.owner].token,'/api/login/ticket','POST',{});
  else if(message.command==='handoff')result=await call(undefined,'/api/login/requests','POST',{serverUrl:'http://127.0.0.1:'+port,deviceId:'same-approval-device',deviceName:'Generated approval device',platform:'other',challenge:createHash('sha256').update('x'.repeat(43)).digest('hex')});
  else if(message.command==='poll')result=await call(undefined,'/api/login/poll','POST',{id:message.requestId,verifier:'x'.repeat(43)});
  else if(message.command==='data')result=await call(users[message.owner].token,'/api/captures?limit=200');
  else if(message.command==='file-policy')result=await call(users[message.owner].token,'/api/file-processing');
  else if(message.command==='disable')result=await call(admin.token,'/api/admin/accounts/'+users[message.owner].userId,'PATCH',{disabled:message.disabled});
  else if(message.command==='revoke')result=await call(users[message.owner].token,'/api/connections/'+message.credentialId,'DELETE');
  else if(message.command==='close'){
   for(const gate of gates.values())gate.release();provider?.release();await host.app.close();await provider?.close();rmSync(root,{recursive:true,force:true});process.send?.({id:message.id,result:true});process.disconnect();return;
  }else throw Error('Unknown fixture command');
  process.send?.({id:message.id,result});
 }catch(error){process.send?.({id:message.id,error:message.command==='evidence-targets'?'LOCATOR_CONTRACT_FAILED':String(error)});}
});
