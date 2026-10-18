import type {TestContext} from 'node:test';
import {createServer} from 'node:http';
import {writeMessagesResponse} from '../../../../scripts/fixtures/messages-provider.js';
import {scopedFilesFixture} from './scoped-files.js';
import {defaultModelSettings} from '../../src/model-settings.js';

// The browser enters the actual scoped app, login and configuration services.
// Provider replies and numeric observations are generated; no live model or
// personal archive is consulted.
const cleanup:Array<()=>unknown>=[],requests:Array<{owner:string;method:string;model?:string;path:string}>=[];
const f=await scopedFilesFixture({after:(work:()=>unknown)=>cleanup.push(work)} as unknown as TestContext);
const model=createServer((request,response)=>{void(async()=>{
 let raw='';for await(const part of request)raw+=String(part);const body=raw?JSON.parse(raw):{},owner=String(request.headers['x-api-key']??request.headers.authorization).includes('GENERATED_B')?'b':'a';requests.push({owner,method:request.method!,path:request.url!,...(typeof body.model==='string'?{model:body.model}:{})});
 if(request.method==='GET'){response.setHeader('content-type','application/json');response.end(JSON.stringify({data:[{id:'generated-'+owner+'-one'},{id:'generated-'+owner+'-two'}]}));return;}
 const uses=body.messages.flatMap((message:any)=>Array.isArray(message.content)?message.content.filter((part:any)=>part.type==='tool_use'):[]),stage=uses.length+1,id='7a8f56d1-45de-47b7-90bb-5e84d411c3d6';
 if(!uses.some((use:any)=>use.name==='search_context'))return writeMessagesResponse(response,{stage,tool:{name:'search_context',args:{query:'generated configuration probe'}}});
 if(!uses.some((use:any)=>use.name==='evidence'))return writeMessagesResponse(response,{stage,tool:{name:'evidence',args:{ids:[id]}}});
 writeMessagesResponse(response,{stage,text:JSON.stringify({answer:'GENERATED_CONFIGURATION_PROBE ['+id+']',citationIds:[id]})});
 })().catch(()=>response.destroy());});
await new Promise<void>(resolve=>model.listen(0,'127.0.0.1',resolve));const modelAddress=model.address();if(!modelAddress||typeof modelAddress==='string')throw Error('Missing generated model');
for(const[actor,label]of [[f.a,'A'],[f.b,'B']] as const){
 let view=await f.checked(actor.token,'/api/configuration');const memory=view.domains.find((domain:any)=>domain.id==='memory').effective;
 await f.checked(actor.token,'/api/configuration/memory','PUT',{revision:view.revision,value:{...memory,automatic:false,integration:false,lifecycle:{...memory.lifecycle,insights:{...memory.lifecycle.insights,enabled:false},working:{...memory.lifecycle.working,enabled:false},consolidation:{...memory.lifecycle.consolidation,enabled:false}}}});
 view=await f.checked(actor.token,'/api/configuration');await f.checked(actor.token,'/api/configuration/models','PUT',{revision:view.revision,value:{profiles:[{id:'generated-import',name:'Generated import mapper',settings:{...defaultModelSettings(),provider:'custom',protocol:'anthropic-messages',model:'generated-native-import',baseUrl:'http://127.0.0.1:'+modelAddress.port+'/v1',apiKey:'GENERATED_'+label,headers:{'x-generated-native':'GENERATED_'+label+'_HEADER'},extraBody:{temperature:0.37}}}],selections:{chat:{kind:'personal',id:'generated-import'},import:{kind:'personal',id:'generated-import'}}}});
 const context=await f.host.authority.authenticate(actor.token),service=f.host.configuration.forUser(context),lease=await service.lease('chat','generated-browser-usage');
 for(let index=0;index<(label==='A'?25:1);index++){const meter=f.host.configuration.startUsage(lease,{attribution:{agentId:label==='A'?'file-analysis':'document-import',moduleId:label==='A'?'files':'imports',skillId:label==='A'?null:'document-import'}});meter.issued();if(index!==0)meter.update({requests:1,reportedRequests:1,inputTokens:100,outputTokens:10,totalTokens:110,cacheReadTokens:0,cacheWriteTokens:0});meter.finish(index%2?'failed':'completed');}
}
const control=createServer((request,response)=>{if(request.method==='POST'&&request.url==='/generated/model-state'){response.setHeader('content-type','application/json');response.end(JSON.stringify({requests}));}else{response.statusCode=404;response.end();}});
await new Promise<void>(resolve=>control.listen(0,'127.0.0.1',resolve));const controlAddress=control.address();if(!controlAddress||typeof controlAddress==='string')throw Error('Missing generated control');
const address=await f.host.app.listen({host:'127.0.0.1',port:0});process.stdout.write(JSON.stringify({address,controlAddress:'http://127.0.0.1:'+controlAddress.port,a:f.a,b:f.b,admin:f.admin,password:'Generated-joint-files-password',pid:process.pid})+'\n');
let closing=false;async function close(){if(closing)return;closing=true;control.closeAllConnections();for(const work of cleanup.reverse())await work();model.closeAllConnections();await Promise.all([new Promise<void>(resolve=>control.close(()=>resolve())),new Promise<void>(resolve=>model.close(()=>resolve()))]);process.exit(0);}
process.on('SIGTERM',()=>void close());process.on('SIGINT',()=>void close());
