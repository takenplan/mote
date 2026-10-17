import type {TestContext} from 'node:test';
import {createServer} from 'node:http';
import {writeMessagesResponse} from '../../../scripts/fixtures/messages-provider.js';
import {scopedFilesFixture} from '../../server/test/fixtures/scoped-files.js';
import {defaultModelSettings} from '../../server/src/model-settings.js';
import {waitForScopedState} from '../../server/test/fixtures/scoped-process.js';

// Actual M01/M03/M04/M05/M06 private preview and confirmation. Only model HTTP
// responses are generated. No live model, real documents or external account.
const cleanup:Array<()=>unknown>=[],commands:Array<{actor:string;path:string;requestId?:string;uploadId?:string;fileId?:string}> = [];
const agentReads:Array<{actor:string;cursor:string|null}>=[];
const modelOperations:Array<{actor:string;path:string;reference?:{kind:string;id:string};status:number;ok?:boolean}>=[];
let dropping=false;
let actors:{a:{token:string};b:{token:string}};
const f=await scopedFilesFixture({after:(work:()=>unknown)=>cleanup.push(work)} as unknown as TestContext,host=>{
 host.app.addHook('onRequest',async request=>{if(request.url.startsWith('/api/agent-view/events'))agentReads.push({actor:request.headers.authorization==='Bearer '+actors.a.token?'a':'b',cursor:new URL(request.url,'http://fixture').searchParams.get('cursor')});});
 host.app.addHook('onSend',async(request,reply,payload)=>{
  if(request.method==='POST'&&request.url.startsWith('/api/models/')){const input=request.body as {reference?:{kind:string;id:string}};modelOperations.push({actor:request.headers.authorization==='Bearer '+actors.a.token?'a':'b',path:request.url,reference:input.reference,status:reply.statusCode,...(request.url==='/api/models/probe'&&typeof payload==='string'?{ok:JSON.parse(payload).ok}:{})});}
  if(request.method==='POST'&&request.url==='/api/imports'&&reply.statusCode===202){
   const body=request.body as {requestId:string;archivedFileIds?:string[]};commands.push({actor:request.headers.authorization==='Bearer '+actors.a.token?'a':request.headers.authorization==='Bearer '+actors.b.token?'b':'other',path:request.url,requestId:body.requestId,...(body.archivedFileIds?{fileId:body.archivedFileIds[0]}:{})});
   if(dropping&&request.headers.authorization==='Bearer '+actors.a.token)reply.raw.destroy();
  }
  if(request.method==='PUT'&&/^\/api\/import-uploads\/[^/]+\/parts\/\d+$/.test(request.url)&&reply.statusCode===200)commands.push({actor:request.headers.authorization==='Bearer '+actors.a.token?'a':'b',path:request.url,uploadId:request.url.split('/')[3]});
  return payload;
 });
});actors=f;
const agent=process.argv.includes('--agent'),models=process.argv.includes('--models');
let holdModel=false,modelEntered=false,releaseModel=()=>{},modelGate=Promise.resolve();
const modelRequests:Array<{owner:string;method:string;hasPrivateArchive:boolean;hasPrivateHeader:boolean;temperature?:number}>=[];
let holdAgent=false,agentEntered=false,releaseAgent=()=>{},agentGate=Promise.resolve();
const calls=new Map<string,number>();
const model=createServer((request,response)=>{void(async()=>{
 let raw='';for await(const part of request)raw+=String(part);const actor=String(request.headers['x-api-key']??request.headers.authorization).includes('GENERATED_B')?'b':'a',stage=(calls.get(actor)??0)+1;calls.set(actor,stage);
 if(models){
  const body=raw?JSON.parse(raw):{};modelRequests.push({owner:actor,method:request.method!,hasPrivateArchive:raw.includes('GENERATED_AGENT_'),hasPrivateHeader:request.headers['x-generated-native']==='GENERATED_'+actor.toUpperCase()+'_HEADER',temperature:body.temperature});
  if(request.method==='GET'){if(holdModel&&actor==='a'){holdModel=false;modelEntered=true;await modelGate;}response.setHeader('content-type','application/json');response.end(JSON.stringify({data:[{id:'generated-'+actor+'-'+(request.url!.includes('after_id')?'two':'one')}],...(!request.url!.includes('after_id')?{has_more:true,last_id:'generated-page'}:{})}));return;}
  const uses=body.messages.flatMap((m:any)=>Array.isArray(m.content)?m.content.filter((p:any)=>p.type==='tool_use'):[]),id='7a8f56d1-45de-47b7-90bb-5e84d411c3d6';
  if(!uses.some((u:any)=>u.name==='search'))return writeMessagesResponse(response,{stage,tool:{name:'search',args:{query:'generated synthetic test'}}});
  if(!uses.some((u:any)=>u.name==='evidence'))return writeMessagesResponse(response,{stage,tool:{name:'evidence',args:{ids:[id]}}});
  writeMessagesResponse(response,{stage,text:JSON.stringify({answer:'GENERATED_NATIVE_PROBE ['+id+']',citationIds:[id]})});return;
 }
 if(agent&&raw.includes('Generated native trace')){if(holdAgent){holdAgent=false;agentEntered=true;await agentGate;}const body=JSON.parse(raw),uses=body.messages.flatMap((m:any)=>Array.isArray(m.content)?m.content.filter((p:any)=>p.type==='tool_use'):[]);if(!uses.some((u:any)=>u.name==='material_catalog'))return writeMessagesResponse(response,{stage,tool:{name:'material_catalog',args:{limit:12}}});const ref=raw.match(/material:mat_[a-f0-9]{64}@[a-f0-9]{64}/)?.[0];if(!ref)throw Error('Missing actual native Material reference');if(!uses.some((u:any)=>u.name==='material_read'))return writeMessagesResponse(response,{stage,tool:{name:'material_read',args:{ref,length:4000}}});writeMessagesResponse(response,{stage,text:JSON.stringify({answer:'Generated native traced answer',citationIds:[]})});return;}
 if(stage===1){writeMessagesResponse(response,{stage,tool:{name:'timeline',args:{limit:100}}});return;}
 writeMessagesResponse(response,{stage,text:JSON.stringify({answer:JSON.stringify({summary:'Generated native private import preview',warnings:[],reviewDecision:{confidence:'high',ambiguous:false,reason:'Generated deterministic fixture preserves supplied originals.'},preserveAll:true}),citationIds:[]})});
 })().catch(()=>response.destroy());});
await new Promise<void>(resolve=>model.listen(0,'127.0.0.1',resolve));const modelAddress=model.address();if(!modelAddress||typeof modelAddress==='string')throw Error('Missing generated import model');
for(const[actor,label]of [[f.a,'A'],[f.b,'B']] as const){
 let view=await f.checked(actor.token,'/api/configuration');const memory=view.domains.find((domain:any)=>domain.id==='memory').effective;
 await f.checked(actor.token,'/api/configuration/memory','PUT',{revision:view.revision,value:{...memory,automatic:false,integration:false,lifecycle:{...memory.lifecycle,insights:{...memory.lifecycle.insights,enabled:false},working:{...memory.lifecycle.working,enabled:false},consolidation:{...memory.lifecycle.consolidation,enabled:false}}}});
 view=await f.checked(actor.token,'/api/configuration');await f.checked(actor.token,'/api/configuration/models','PUT',{revision:view.revision,value:{profiles:[{id:'generated-import',name:'Generated import mapper',settings:{...defaultModelSettings(),provider:'custom',protocol:'anthropic-messages',model:'generated-native-import',baseUrl:'http://127.0.0.1:'+modelAddress.port+'/v1',apiKey:'GENERATED_'+label,...(models?{headers:{'x-generated-native':'GENERATED_'+label+'_HEADER'},extraBody:{temperature:0.37}}:{})}}],selections:{import:{kind:'personal',id:'generated-import'},...(agent?{chat:{kind:'personal',id:'generated-import'}}:{})}}});
}
if(process.argv.includes('--agent'))for(const[actor,label]of [[f.a,'A'],[f.b,'B']] as const){
 const created=await f.request(actor.token,'/api/imports','POST',{requestId:'10000000-0000-4000-8000-000000000001',processing:'automatic',files:[{name:'generated-agent.txt',mimeType:'text/plain',dataBase64:Buffer.from('GENERATED_AGENT_'+label+'_VISIBLE_TEXT').toString('base64')}]});
 if(created.statusCode!==202)throw Error('Generated Agent original admission '+created.statusCode);
 await waitForScopedState(async()=>(await f.checked(actor.token,'/api/imports/'+created.json().id)).status==='completed',()=>'Generated Agent original did not complete');
 await waitForScopedState(async()=>(await f.checked(actor.token,'/api/agent-view/catalog?path=/context/episodes&limit=1')).entries.length>0,()=>'Generated Agent canonical Material missing');
}
const control=createServer((request,response)=>{
 if(request.method!=='POST'){response.statusCode=404;response.end();return;}
 if(request.url==='/generated/drop-import-ack')dropping=true;
 else if(request.url==='/generated/release-import-ack')dropping=false;
 else if(request.url==='/generated/model-state'){response.setHeader('content-type','application/json');response.end(JSON.stringify({requests:modelRequests,operations:modelOperations,modelEntered}));return;}
 else if(request.url==='/generated/hold-model-catalog'){holdModel=true;modelEntered=false;modelGate=new Promise<void>(resolve=>releaseModel=resolve);}
 else if(request.url==='/generated/release-model-catalog')releaseModel();
 else if(request.url==='/generated/hold-agent-response'){holdAgent=true;agentEntered=false;agentGate=new Promise<void>(resolve=>releaseAgent=resolve);}
 else if(request.url==='/generated/release-agent-response')releaseAgent();
 else if(request.url==='/generated/agent-state'){response.setHeader('content-type','application/json');response.end(JSON.stringify({calls:Object.fromEntries(calls),reads:agentReads,agentEntered}));return;}
 else if(request.url!=='/generated/import-commands'){response.statusCode=404;response.end();return;}
 response.setHeader('content-type','application/json');response.end(JSON.stringify({dropping,commands}));
});await new Promise<void>(resolve=>control.listen(0,'127.0.0.1',resolve));const controlAddress=control.address();if(!controlAddress||typeof controlAddress==='string')throw Error('Missing generated import control');
const address=await f.host.app.listen({host:'127.0.0.1',port:0});process.stdout.write(JSON.stringify({address,controlAddress:'http://127.0.0.1:'+controlAddress.port,a:f.a,b:f.b,admin:f.admin,password:'Generated-joint-files-password',pid:process.pid})+'\n');
let closing=false;async function close(){if(closing)return;closing=true;releaseAgent();releaseModel();control.closeAllConnections();for(const work of cleanup.reverse())await work();model.closeAllConnections();await Promise.all([new Promise<void>(resolve=>control.close(()=>resolve())),new Promise<void>(resolve=>model.close(()=>resolve()))]);process.exit(0);}
process.on('SIGTERM',()=>void close());process.on('SIGINT',()=>void close());
