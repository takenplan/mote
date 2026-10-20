import {startBridge} from '../../../../packages/agent/src/bridge.js';
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

async function sourceMemory(f:Awaited<ReturnType<typeof fixture>>,user:any,label:string,count=1,historical=false,quoteOffset=0,quoteLength?:number){
 const settings=defaultMemorySettings();settings.automatic=false;settings.integration=false;await f.replace(user.token,'memory',settings);
 const contents=Array.from({length:count},(_,i)=>'GENERATED_'+label+'_SOURCE_'+i+': Nora recorded a generated preference until 2026-06-01. '+('generated-context-'+i+' ').repeat(110)),materials=[];
 for(const [i,content]of contents.entries())materials.push(await f.publish(user,label,'same-source','bounded-'+i,content));
 const context=await f.node.authority.authenticate(user.token),memory=f.node.memory!.bindRead(context,{assertCurrent:()=>{}}),records=materials.flatMap(material=>memory.projectMaterial({id:material.id,revision:material.revision}).evidence);
 f.scripts.set(label,(_body,raw,res)=>{const keys=[...new Set([...raw.matchAll(/\\?"key\\?"\s*:\s*\\?"(member_[0-9]+)/g)].map(value=>value[1]))];writeMessagesResponse(res,{stage:1,text:JSON.stringify({answer:JSON.stringify({memories:[{title:'GENERATED_BOUNDED_MEMORY_'+label,statement:records.map((record,index)=>'Nora recorded generated preference '+index+'. ['+record.id+']').join(' '),uncertainty:'Generated source statements only',admission:{layer:'memory',reason:'Generated explicit source preferences',scope:'Generated Nora and the stated period',attribution:'third_party'},...(historical?{validUntil:'2026-06-01T00:00:00Z'}:{}),evidenceIds:records.map(record=>record.id),evidence:records.map(record=>({id:record.id,quote:record.ocrText.slice(quoteOffset,quoteLength===undefined?undefined:quoteOffset+quoteLength)}))}],coverage:keys.map(key=>({key,state:'checked',candidateIndexes:[0]}))}),citationIds:records.map(record=>record.id)})});});
 const operationId=randomUUID();await f.checked(user.token,'/api/memory/jobs','POST',{operationId,materialIds:materials.map(material=>material.id)});const end=Date.now()+20000;for(;;){const job=await f.checked(user.token,'/api/memory/jobs/'+operationId);if(job.state==='committed')break;assert.ok(!Object.values(job.tasks).some((task:any)=>['failed','blocked','stale'].includes(task.state)),JSON.stringify(job));assert.ok(Date.now()<end);await delay(10);}f.scripts.delete(label);
 const page=await f.checked(user.token,'/api/memories?includeHistory=true');return {card:page.items[0],records,materials,context,contents};
}

async function memoryBridge(f:Awaited<ReturnType<typeof fixture>>,user:any){const context=await f.node.authority.authenticate(user.token),bound=f.node.ask!.bind(context,{assertCurrent:()=>{}}).reader(),bridge=await startBridge(bound.agent,{question:'Generated exact Memory source evidence'});return {bridge,async read(id:string){const response=await fetch(bridge.url+'/memories',{method:'POST',headers:{authorization:'Bearer '+bridge.token,'content-type':'application/json'},body:JSON.stringify({id,includeEvidence:true})});return {status:response.status,body:await response.json() as any};}};}

async function delegated(t:TestContext,options:{holdSecond?:boolean;skipRead?:boolean;failSecond?:boolean;cancelSecond?:boolean;insight?:boolean;scope?:{after?:string;before?:string;deviceId?:string}}={}){
 const f=await fixture(t),material=await f.publish(f.a,'A'),context=await f.node.authority.authenticate(f.a.token),canonical=(await f.node.ask!.bind(context,{assertCurrent:()=>{}}).reader().agent.materialRead!({ref:material.ref})).originalRefs[0].slice(8),gate=deferred(),entered=deferred(),childStarts={one:0,two:0};let yielded=false,held=false,retried=false,retainedCheckpoint:any;const units=['one','two'].map((id,index)=>({id,capabilityId:'context.research',title:'Generated child '+id,goal:'Independent generated work '+id,input:{question:'Generated child '+id+' original'},...(options.scope?{scope:options.scope}:{}),...(index&&!options.failSecond?{dependencies:['one']}:{})}));t.after(()=>gate.resolve());
 // Retry isolates two independent branches; ordered dependencies and duplicate
 // admission remain in the ordered-subtask case. The real worker tools, branch
 // start counts and original 20-second completion budget stay unchanged.
 f.scripts.set('A',(body,raw,res,owner)=>{const uses=body.messages.flatMap((message:any)=>Array.isArray(message.content)?message.content.filter((part:any)=>part.type==='tool_use'):[]),request=JSON.parse(typeof body.messages[0].content==='string'?body.messages[0].content:body.messages[0].content[0].text).request,child=request==='Generated child one original'?'one':request==='Generated child two original'?'two':undefined;
  if(child){if(!uses.length)childStarts[child]++;if(child==='two'&&options.failSecond&&!uses.length&&childStarts.two===1){res.writeHead(400,{'Content-Type':'application/json'});res.end(JSON.stringify({error:{type:'invalid_request_error',message:'Generated branch failure'}}));return;}if(child==='two'&&options.holdSecond&&!held){held=true;entered.resolve();return gate.promise.then(()=>respond(body,raw,res,owner));}respond(body,raw,res,owner);return;}
  const tool=(name:string,args:any)=>writeMessagesResponse(res,{stage:uses.length+1,tool:{name,args}});
  if(!yielded){if(!uses.some((use:any)=>use.name==='delegation_capabilities'))return tool('delegation_capabilities',{});if(uses.filter((use:any)=>use.name==='delegation_submit').length<(options.failSecond?1:2))return tool('delegation_submit',{units});yielded=true;return tool('delegation_yield',{unitIds:['one','two'],mode:options.cancelSecond?'any':'all'});}
  if(options.cancelSecond&&!uses.some((use:any)=>use.name==='delegation_cancel'))return entered.promise.then(()=>tool('delegation_cancel',{unitId:'two'}));
  if(options.failSecond&&!retried){if(!uses.some((use:any)=>use.name==='delegation_results'))return tool('delegation_results',{});retainedCheckpoint=f.read(db=>db.prepare("SELECT e.id,e.state,e.attempts,t.result,t.checkpoints FROM ma_units u JOIN execution_steps e ON e.user_id=u.user_id AND e.id=u.task_id JOIN user_tasks t ON t.user_id=e.user_id AND t.task_id=e.id WHERE u.user_id=? AND u.id='one'").get(f.a.userId));assert.ok(retainedCheckpoint);assert.equal(retainedCheckpoint.state,'succeeded');retried=true;return tool('delegation_retry',{unitId:'two'});}
  if(options.failSecond&&uses.some((use:any)=>use.name==='delegation_retry'))return tool('delegation_yield',{unitIds:['two'],mode:'all'});
  if(options.skipRead){writeMessagesResponse(res,{stage:uses.length+1,text:JSON.stringify({answer:'Undisclosed child result ['+canonical+']',citationIds:[canonical]})});return;}
  if(!uses.some((use:any)=>use.name==='delegation_results'))return tool('delegation_results',{});const artifacts=[...new Set([...raw.matchAll(/\\?"artifactId\\?"\s*:\s*\\?"([a-f0-9]{64})/g)].map(match=>match[1]))],reads=uses.filter((use:any)=>use.name==='delegation_read').length;if(reads<(options.cancelSecond?1:2)){assert.ok(artifacts[reads],raw.slice(-6000));return tool('delegation_read',{artifactId:artifacts[reads],evidenceIds:[canonical]});}const answer='Generated combined child answer ['+canonical+']';writeMessagesResponse(res,{stage:uses.length+1,text:JSON.stringify({answer:options.insight?JSON.stringify({title:'Generated delegated review',markdown:answer,html:'<main>'+answer+'</main>'}):answer,citationIds:[canonical]})});
 });return {...f,canonical,childStarts,gate,entered,retainedCheckpoint:()=>retainedCheckpoint};
}

export {protocol,password,deferred,Script,fixture,respond,sourceMemory,memoryBridge,delegated};
