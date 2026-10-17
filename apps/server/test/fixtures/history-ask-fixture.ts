import test,{type TestContext} from 'node:test';
import assert from 'node:assert/strict';
import {createServer,type ServerResponse} from 'node:http';
import {mkdtempSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {setTimeout as delay} from 'node:timers/promises';
import {buildApp} from '../../src/app.js';
import {defaultModelSettings} from '../../src/model-settings.js';
import {defaultProcessingSettings} from '../../src/scope/processing-schema.js';
import {defaultMemorySettings} from '../../src/scope/memory-schema.js';
import {writeMessagesResponse} from '../../../../scripts/fixtures/messages-provider.js';
import type {AskInput} from '../../src/scope/ask-schema.js';

const protocol={'x-mote-protocol-version':'2','x-mote-ingress-version':'3'},password='Generated-Ask-Only-01';
const deferred=()=>{let resolve!:()=>void;const promise=new Promise<void>(r=>resolve=r);return {promise,resolve};};
type Script=(body:any,raw:string,res:ServerResponse,owner:string)=>void|Promise<void>;
async function fixture(t:TestContext){
 const directory=mkdtempSync(join(tmpdir(),'mote-m08-')),requests:{owner:string;raw:string;body:any}[]=[],scripts=new Map<string,Script>();
 const provider=createServer((req,res)=>{void(async()=>{let raw='';for await(const part of req)raw+=part;const body=JSON.parse(raw),owner=String(req.headers['x-api-key']).includes('_A_')?'A':'B';requests.push({owner,raw,body});const script=scripts.get(owner);if(script){await script(body,raw,res,owner);return;}respond(body,raw,res,owner);})().catch(()=>res.destroy());});
 await new Promise<void>(resolve=>provider.listen(0,'127.0.0.1',resolve));let node=await buildApp({dataDir:directory});const nodes=[node];
 t.after(async()=>{for(const current of nodes.reverse())await current.app.close();provider.closeAllConnections();await new Promise<void>(resolve=>provider.close(()=>resolve()));rmSync(directory,{recursive:true,force:true});});
 await node.accounts!.initialize('generated-admin',password);
 const request=(token:string|undefined,url:string,method:any='GET',payload?:unknown)=>node.app.inject({method,url,headers:{...protocol,...(token?{authorization:'Bearer '+token}:{})},...(payload===undefined?{}:{payload})});
 const checked=async(token:string|undefined,url:string,method:any='GET',payload?:unknown)=>{const response=await request(token,url,method,payload);assert.equal(response.statusCode,200,response.body);return response.json();};
 const login=(username:string)=>checked(undefined,'/api/auth/login','POST',{username,password,mode:'client'}),admin=await login('generated-admin'),users:any[]=[];
 for(const label of ['a','b']){const account=await checked(admin.token,'/api/admin/accounts','POST',{username:'generated-'+label,password});users.push({...account,...await login('generated-'+label)});}const [a,b]=users;
 const replace=async(token:string,domain:string,value:unknown)=>{const current=await checked(token,'/api/configuration');return checked(token,'/api/configuration/'+domain,'PUT',{revision:current.revision,value});};
 for(const [user,label] of [[a,'A'],[b,'B']] as const){await replace(user.token,'models',{profiles:[{id:'same-model',name:'Generated Ask model',settings:{...defaultModelSettings(),provider:'custom',protocol:'anthropic-messages',model:'generated-ask',baseUrl:'http://127.0.0.1:'+(provider.address() as any).port+'/v1',apiKey:'GENERATED_'+label+'_KEY',headers:{},extraBody:{}}}],selections:{chat:{kind:'personal',id:'same-model'},insight:{kind:'personal',id:'same-model'},memory:{kind:'personal',id:'same-model'}}});await replace(user.token,'processing',{...defaultProcessingSettings(),automatic:false,understandingEnabled:false});}
 const publish=async(user:any,label:string,sourceId='same-source',externalId='same-external',content='GENERATED_'+label+'_PRIVATE_ORIGINAL')=>{const context=await node.authority.authenticate(user.token);await checked(user.token,'/api/ingress/sources','POST',{id:sourceId,name:'Generated source',kind:'custom',deviceId:'same-device',platform:'import',retention:'snapshot'});const source=node.ingress.bindSource(context,[sourceId],()=>{}),receipt=source.receiveSourceItems(sourceId,'batch:'+externalId,[{externalId,revision:'same-revision',observedAt:'2026-01-01T00:00:00Z',title:'Generated original '+label,text:content,kind:'file',layer:'original'}]),digest=createHash('sha256').update(JSON.stringify([sourceId,externalId])).digest('hex');return source.publishMaterial({id:'mat_'+digest,kind:'document',schemaVersion:1,title:'Generated Material '+label,origin:{sourceId,externalId,deviceId:'same-device',firstAt:'2026-01-01T00:00:00Z',lastAt:'2026-01-01T00:00:00Z'},blocks:[{id:'same-block',kind:'text',format:'plain',text:content,memberIds:['original']}],members:[{id:'original',kind:'capture',ref:'capture:'+receipt.captures[0].id}],coverage:{state:'complete'},fidelity:{state:'lossless'},retention:{original:'retained',policy:'keep'}});};
 const wait=async(user:any,id:string,timeoutMs=20000)=>{const deadline=Date.now()+timeoutMs;for(;;){const value=await checked(user.token,'/api/query-runs/'+id);if(value.status!=='running')return value;if(Date.now()>deadline)assert.fail('Ask timeout '+JSON.stringify(value));await delay(10);}};
 const read=<T>(work:(db:DatabaseSync)=>T)=>{const db=new DatabaseSync(join(directory,'mote.sqlite'));try{return work(db);}finally{db.close();}};
 return {get node(){return node;},a,b,admin,request,checked,replace,publish,wait,read,scripts,requests,directory,modelUrl:'http://127.0.0.1:'+(provider.address() as any).port+'/v1',login,restart:async()=>{await node.app.close();node=await buildApp({dataDir:directory});nodes.push(node);}};
}
function respond(body:any,raw:string,res:ServerResponse,owner:string){
 const uses=body.messages.flatMap((message:any)=>Array.isArray(message.content)?message.content.filter((part:any)=>part.type==='tool_use'):[]),stage=uses.length+1;
 if(raw.includes('Compact this conversation, preserving')){writeMessagesResponse(res,{stage,text:JSON.stringify({answer:'Generated compacted private dialogue '+owner,citationIds:[]})});return;}
 if(!uses.some((use:any)=>use.name==='material_catalog')){writeMessagesResponse(res,{stage,tool:{name:'material_catalog',args:{limit:30}}});return;}
 const ref=raw.match(/material:mat_[a-f0-9]{64}@[a-f0-9]{64}/)?.[0];
 if(ref&&!uses.some((use:any)=>use.name==='material_read')){writeMessagesResponse(res,{stage,tool:{name:'material_read',args:{ref,length:12000}}});return;}
 const ids=[...new Set(raw.match(/[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-a[0-9a-f]{3}-[0-9a-f]{12}/g)??[])],id=raw.match(/capture:([0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-a[0-9a-f]{3}-[0-9a-f]{12})/)?.[1]??ids[0],answer='Generated answer '+owner+(id?' ['+id+']':'');
 writeMessagesResponse(res,{stage,text:JSON.stringify({answer,citationIds:id?[id]:[]})});
}


export {fixture as historyAskFixture,respond as historyRespond,deferred};
