import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {mkdtemp,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {setTimeout as delay} from 'node:timers/promises';
import {buildApp} from '../../server/src/app.js';
import {defaultModelSettings} from '../../server/src/model-settings.js';
import {defaultMemorySettings} from '../../server/src/scope/memory-schema.js';
import {defaultProcessingSettings} from '../../server/src/scope/processing-schema.js';
import {writeMessagesResponse} from '../../../scripts/fixtures/messages-provider.js';

// Generated wire-2 host for the real Android ASK and Activity readers. The
// production Harness chooses its generated provider's material_catalog/read
// calls; accounts, HTTP, receipts, archive revisions and erasure are production.
// A loopback transport gate can hold an original reader before its HTTP request
// reaches the host. It never constructs answers or bypasses authorization.
const output=resolve(process.argv[2]??join(tmpdir(),'mote-main-history-fixture.json'));
const directory=await mkdtemp(join(tmpdir(),'mote-main-history-'));
const password='Generated-history-Only-01',protocol={'x-mote-protocol-version':'2','x-mote-ingress-version':'3'};
let generation=0,modelCalls=0,conversationId='',workId='',closing=false,baseline:Record<string,unknown>={};
let armRead=false,readHeld=false,heldReadCompleted=0,releaseRead:(()=>void)|undefined;
const provider=createServer((req,res)=>{void(async()=>{
 let raw='';for await(const part of req)raw+=part;const body=JSON.parse(raw);modelCalls++;
 assert.ok(['GENERATED_A_HISTORY_KEY','GENERATED_B_HISTORY_KEY'].includes(String(req.headers['x-api-key'])));
 const owner=req.headers['x-api-key']==='GENERATED_A_HISTORY_KEY'?'A':'B';
 const first=body.messages[0].content,envelope=JSON.parse(typeof first==='string'?first:first[0].text);assert.equal(typeof envelope.request,'string');
 const uses=body.messages.flatMap((message:any)=>Array.isArray(message.content)?message.content.filter((part:any)=>part.type==='tool_use'):[]),stage=uses.length+1;
 if(!uses.some((use:any)=>use.name==='material_catalog'))return writeMessagesResponse(res,{stage,tool:{name:'material_catalog',args:{limit:30}}});
 const ref=raw.match(/material:mat_[a-f0-9]{64}@[a-f0-9]{64}/)?.[0];assert.ok(ref,'Generated provider must receive a real material catalog result');
 if(!uses.some((use:any)=>use.name==='material_read'))return writeMessagesResponse(res,{stage,tool:{name:'material_read',args:{ref,length:12000}}});
 const original=raw.match(/capture:([0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-a[0-9a-f]{3}-[0-9a-f]{12})/)?.[1];assert.ok(original,'Generated answer must have actual original disclosure');
 assert.ok(raw.includes('GENERATED_HISTORY_'+owner+'_CITATION_'+generation));assert.ok(!raw.includes('GENERATED_HISTORY_'+(owner==='A'?'B':'A')+'_CITATION_'));
 writeMessagesResponse(res,{stage,text:JSON.stringify({answer:`GENERATED_HISTORY_${owner}_ANSWER ${envelope.request} [${original}]`,citationIds:[original]})});
})().catch(error=>{process.stderr.write(String(error)+'\n');res.destroy();});});
await new Promise<void>(done=>provider.listen(0,'127.0.0.1',done));
const providerBound=provider.address();assert.ok(providerBound&&typeof providerBound!=='string');
const node=await buildApp({dataDir:directory});await node.accounts.initialize('generated-admin',password);
const upstream=await node.app.listen({host:'127.0.0.1',port:0});
async function request(token:string|undefined,path:string,method='GET',body?:unknown){
 const response=await fetch(upstream+path,{method,headers:{...protocol,'content-type':'application/json',...(token?{authorization:'Bearer '+token}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});
 const value=await response.json() as any;assert.equal(response.status,200,JSON.stringify({path,status:response.status,error:value.error}));return value;
}
const admin=await request(undefined,'/api/auth/login','POST',{username:'generated-admin',password,mode:'client'});
for(const label of ['a','b'])await request(admin.token,'/api/admin/accounts','POST',{username:'generated-'+label,password});
const a=await request(undefined,'/api/auth/login','POST',{username:'generated-a',password,mode:'client'}),b=await request(undefined,'/api/auth/login','POST',{username:'generated-b',password,mode:'client'});
for(const [user,label] of [[a,'A'],[b,'B']] as const){
 async function configure(domain:string,value:unknown){const current=await request(user.token,'/api/configuration');await request(user.token,'/api/configuration/'+domain,'PUT',{revision:current.revision,value});}
 await configure('models',{profiles:[{id:'generated-history',name:'Generated history provider',settings:{...defaultModelSettings(),provider:'custom',protocol:'anthropic-messages',model:'generated-history',baseUrl:'http://127.0.0.1:'+providerBound.port+'/v1',apiKey:'GENERATED_'+label+'_HISTORY_KEY',headers:{},extraBody:{}}}],selections:{chat:{kind:'personal',id:'generated-history'},memory:{kind:'personal',id:'generated-history'}}});
 await configure('memory',{...defaultMemorySettings(),automatic:false});await configure('processing',{...defaultProcessingSettings(),automatic:false,understandingEnabled:false});
}
const history=()=>request(a.token,'/api/conversations/'+conversationId+'?limit=20');
let material:any,materialDraft:any,sourceId='';
let publisher:ReturnType<typeof node.ingress.bindSource>;
async function metadata(){
 const current=await history(),work=await request(a.token,'/api/work-activity/'+encodeURIComponent(workId));
 return {...baseline,address,webAddress:upstream,controlAddress,a,b,password,conversationId,workId,evidenceStale:current.turns.at(-1)?.evidenceStale===true,evidenceDeleted:current.turns.at(-1)?.evidenceDeleted===true,turnCount:current.turnCount,workArtifacts:work.artifacts.length,modelCalls,readHeld,heldReadCompleted};
}
async function reset(){
 releaseRead?.();releaseRead=undefined;armRead=false;readHeld=false;heldReadCompleted=0;
 // Retire the previous generated originals through their respective owners,
 // so the scripted provider's real catalog contains only this generation.
 if(sourceId)for(const user of [a,b]){const response=await fetch(upstream+'/api/sources/'+sourceId,{method:'DELETE',headers:{...protocol,authorization:'Bearer '+user.token}});await response.arrayBuffer();assert.ok([200,404].includes(response.status));}
 generation++;modelCalls=0;conversationId=randomUUID();sourceId='generated-history-'+generation;
 for(const [user,label] of [[a,'A'],[b,'B']] as const){
  const externalId='same-original';await request(user.token,'/api/ingress/sources','POST',{id:sourceId,name:'Generated Android history source',kind:'custom',deviceId:'generated-history',platform:'import',retention:'snapshot'});
  const source=node.ingress.bindSource(await node.authority.authenticate(user.token),[sourceId],()=>{}),receipt=source.receiveSourceItems(sourceId,'generated-history-batch',[{externalId,revision:'original-1',observedAt:'2026-01-01T00:00:00Z',title:'Generated '+label+' history original',text:`GENERATED_HISTORY_${label}_CITATION_${generation}`,kind:'file',layer:'original'}]);
  const draft={id:'mat_'+createHash('sha256').update(JSON.stringify([sourceId,externalId])).digest('hex'),kind:'document',schemaVersion:1,title:'Generated '+label+' history material',origin:{sourceId,externalId},members:[{id:'original',kind:'capture',ref:'capture:'+receipt.captures[0].id}],blocks:[{id:'body',kind:'text',format:'plain',text:`GENERATED_HISTORY_${label}_CITATION_${generation}`,memberIds:['original']}],coverage:{state:'complete'},fidelity:{state:'lossless'},retention:{original:'retained',policy:'keep'}};
  const published=source.publishMaterial(draft);if(label==='A'){material=published;materialDraft=draft;publisher=source;}
  await request(user.token,'/api/conversations','POST',{id:conversationId,title:'Generated '+label+' history '+generation});
  for(let index=1;index<=(label==='A'?21:1);index++){
   const id=randomUUID();await request(user.token,'/api/query-runs','POST',{id,input:{question:'Generated '+label+' history '+generation+' turn '+String(index).padStart(2,'0'),conversationId,turnId:randomUUID()}});
   const deadline=Date.now()+30_000;for(;;){const run=await request(user.token,'/api/query-runs/'+id);if(run.status!=='running'){assert.equal(run.status,'completed',JSON.stringify({status:run.status,error:run.error}));break;}assert.ok(Date.now()<deadline,'Generated history run timed out');await delay(20);}
   if(label==='A'&&index===21)workId='query:'+id;
  }
 }
 const current=await history(),older=await request(a.token,'/api/conversations/'+conversationId+'?limit=20&cursor='+encodeURIComponent(current.nextCursor)),latest=current.turns.at(-1),first=older.turns[0],bPage=await request(b.token,'/api/conversations/'+conversationId);
 baseline={title:current.title,workTitle:(await request(a.token,'/api/work-activity/'+encodeURIComponent(workId))).goal,answer:latest.result.answer,excerpt:latest.result.citations[0].excerpt,olderQuestion:first.question,olderAnswer:first.result.answer,olderExcerpt:first.result.citations[0].excerpt,bTitle:bPage.title,bAnswer:bPage.turns[0].result.answer};
 const value=await metadata();assert.equal(value.turnCount,21);assert.ok(value.workArtifacts>0);await writeFile(output,JSON.stringify(value,null,2),{mode:0o600});return value;
}
const proxy=createServer((req,res)=>{void(async()=>{
 const url=new URL(req.url??'/',upstream);let held=false;
 if(armRead&&req.method==='GET'&&url.pathname==='/api/conversations/'+conversationId&&!url.searchParams.has('cursor')&&req.headers.authorization?.startsWith('Bearer ')&&(await node.authority.authenticate(req.headers.authorization.slice(7))).userId===a.userId){armRead=false;readHeld=true;held=true;await new Promise<void>(done=>{releaseRead=done;});readHeld=false;}
 const chunks:Buffer[]=[];for await(const part of req)chunks.push(Buffer.from(part));
 const headers=Object.fromEntries(Object.entries(req.headers).filter(([name])=>!['host','connection','content-length'].includes(name))) as Record<string,string>;
 const response=await fetch(url,{method:req.method,headers,...(chunks.length?{body:Buffer.concat(chunks)}:{})});res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));if(held)heldReadCompleted++;
})().catch(error=>{process.stderr.write(String(error)+'\n');res.writeHead(500).end();});});
await new Promise<void>(done=>proxy.listen(0,'127.0.0.1',done));const proxyBound=proxy.address();assert.ok(proxyBound&&typeof proxyBound!=='string');const address='http://127.0.0.1:'+proxyBound.port;
const control=createServer((req,res)=>{void(async()=>{
 for await(const _ of req){}
 if(req.method!=='POST'){res.writeHead(405).end();return;}
 if(req.url==='/reset'){res.setHeader('content-type','application/json');res.end(JSON.stringify(await reset()));return;}
 if(req.url==='/stale'){material=publisher.publishMaterial({...materialDraft,blocks:[{...materialDraft.blocks[0],text:'GENERATED_HISTORY_REVISED_'+generation}]},material.revision);const value=await history();assert.ok(value.turns.every((turn:any)=>turn.evidenceStale&&!turn.evidenceDeleted&&turn.result),'Ordinary revision must retain historical prose with a notice');}
 else if(req.url==='/deleted'){await request(a.token,'/api/sources/'+sourceId,'DELETE');const value=await history();assert.ok(value.turns.every((turn:any)=>turn.evidenceDeleted&&!turn.evidenceStale&&!turn.result));assert.doesNotMatch(JSON.stringify(value),/GENERATED_HISTORY_A_(?:ANSWER|CITATION)/);assert.ok((await request(b.token,'/api/conversations/'+conversationId)).turns[0].result.answer);}
 else if(req.url==='/arm-history-read'){assert.ok(!armRead&&!readHeld);armRead=true;}
 else if(req.url==='/release-history-read'){assert.ok(readHeld&&releaseRead);releaseRead();releaseRead=undefined;}
 else if(req.url!=='/state'){res.writeHead(404).end();return;}
 res.setHeader('content-type','application/json');res.end(JSON.stringify(await metadata()));
})().catch(error=>{process.stderr.write(String(error.stack??error)+'\n');res.writeHead(500,{'content-type':'application/json'}).end('{"error":"generated_history_fixture_failed"}');});});
await new Promise<void>(done=>control.listen(0,'127.0.0.1',done));const bound=control.address();assert.ok(bound&&typeof bound!=='string');const controlAddress='http://127.0.0.1:'+bound.port;
const initial=await reset();
process.stdout.write(JSON.stringify({address,webAddress:upstream,controlAddress,fixtureFile:output,pid:process.pid,conversationId,workId,turnCount:initial.turnCount,generatedOnly:true,wireVersion:2})+'\n');
async function close(){if(closing)return;closing=true;releaseRead?.();for(const server of [control,proxy,provider]){server.closeAllConnections();await new Promise<void>(done=>server.close(()=>done()));}await node.app.close();await rm(directory,{recursive:true,force:true});process.stdout.write('{"generatedOnly":true,"closed":true}\n');process.exit(0);}
process.on('SIGTERM',()=>void close());process.on('SIGINT',()=>void close());
