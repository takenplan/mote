import {createServer,type ServerResponse} from 'node:http';
import {mkdtempSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {buildApp} from '../../server/src/app.js';
import {defaultModelSettings} from '../../server/src/model-settings.js';
import {defaultProcessingSettings} from '../../server/src/scope/processing-schema.js';
import {defaultMemorySettings} from '../../server/src/scope/memory-schema.js';
import {writeMessagesResponse} from '../../../scripts/fixtures/messages-provider.js';

// Real scoped production HTTP/M05/Ask composition. Only the external model
// endpoint is generated; no user archive, screen, supplier or credential is read.
const directory=mkdtempSync(join(tmpdir(),'mote-android-ask-')),password='Generated-Android-Ask-Only-01',protocol={'x-mote-protocol-version':'2','x-mote-ingress-version':'3'};
type Owner='a'|'b';
const controls:Record<Owner,{holdNext:boolean;failNext:number|null;requests:number;responses:number;failures:number;entered:boolean}>={
 a:{holdNext:false,failNext:null,requests:0,responses:0,failures:0,entered:false},
 b:{holdNext:false,failNext:null,requests:0,responses:0,failures:0,entered:false},
},held=new Set<{owner:Owner;release:()=>void}>();
const provider=createServer((request,response)=>{void(async()=>{
 for await(const _chunk of request){} // Count requests without retaining prompts.
 const owner:Owner=String(request.headers['x-api-key']).includes('_B_')?'b':'a',state=controls[owner];state.requests++;
 const failure=state.failNext;state.failNext=null;
 if(state.holdNext){state.holdNext=false;state.entered=true;await new Promise<void>(resolve=>{const handle={owner,release:()=>{held.delete(handle);resolve();}};held.add(handle);});}
 if(response.destroyed)return;
 if(failure!==null){state.failures++;response.writeHead(failure,{'content-type':'application/json'}).end(JSON.stringify({error:{message:'GENERATED_PRIVATE_ASK_PROVIDER_ERROR'}}));return;}
 state.responses++;writeMessagesResponse(response,{stage:1,text:JSON.stringify({answer:'GENERATED_ASK_ANSWER_'+owner.toUpperCase(),citationIds:[]})});
 })().catch(()=>response.destroy());});
await new Promise<void>(resolve=>provider.listen(0,'127.0.0.1',resolve));
const providerAddress=provider.address();if(!providerAddress||typeof providerAddress==='string')throw Error('Generated Ask provider did not bind');
const node=await buildApp({dataDir:directory});await node.accounts!.initialize('generated-admin',password);
const call=async(token:string|undefined,url:string,method:any='GET',payload?:unknown)=>{
 const response=await node.app.inject({url,method,headers:{...protocol,...(token?{authorization:'Bearer '+token}:{})},...(payload===undefined?{}:{payload})});
 if(response.statusCode!==200)throw Error('Generated Ask fixture setup '+url+' '+response.statusCode);return response.json();
};
const login=(username:string)=>call(undefined,'/api/auth/login','POST',{username,password,mode:'client'}),admin=await login('generated-admin');
for(const username of ['generated-a','generated-b'])await call(admin.token,'/api/admin/accounts','POST',{username,password});
const a=await login('generated-a'),b=await login('generated-b');
for(const [actor,label] of [[a,'A'],[b,'B']] as const){
 const replace=async(domain:string,value:unknown)=>{const view=await call(actor.token,'/api/configuration');await call(actor.token,'/api/configuration/'+domain,'PUT',{revision:view.revision,value});};
 await replace('models',{profiles:[{id:'generated-ask',name:'Generated Ask model',settings:{...defaultModelSettings(),provider:'custom',protocol:'anthropic-messages',model:'generated-ask',baseUrl:'http://127.0.0.1:'+providerAddress.port+'/v1',apiKey:'GENERATED_'+label+'_KEY',headers:{},extraBody:{}}}],selections:{chat:{kind:'personal',id:'generated-ask'},insight:{kind:'personal',id:'generated-ask'},memory:{kind:'personal',id:'generated-ask'}}});
 await replace('processing',{...defaultProcessingSettings(),automatic:false,understandingEnabled:false});
 await replace('memory',{...defaultMemorySettings(),automatic:false,integration:false});
}
const address=await node.app.listen({host:'127.0.0.1',port:0});
const json=(response:ServerResponse,status:number,value:unknown)=>response.writeHead(status,{'content-type':'application/json'}).end(JSON.stringify(value));
const state=()=>({entered:controls.a.entered||controls.b.entered,held:held.size>0,calls:controls.a.requests+controls.b.requests,failures:controls.a.failures+controls.b.failures});
const control=createServer((request,response)=>{void(async()=>{
 if(request.method!=='POST'){json(response,405,{error:'generated_control_method'});return;}
 let raw='';for await(const chunk of request)raw+=chunk;
 const body=raw?JSON.parse(raw):{},owner:Owner=body.owner??'a';
 if(owner!=='a'&&owner!=='b'){json(response,400,{error:'generated_control_owner'});return;}
 if(request.url==='/hold-next'){controls[owner].holdNext=true;controls[owner].entered=false;}
 else if(request.url==='/release'){for(const handle of [...held])if(!body.owner||handle.owner===owner)handle.release();}
 else if(request.url==='/fail-next'){const status=body.status??401;if(![400,401,403,404,413,415].includes(status)){json(response,400,{error:'generated_control_failure_status'});return;}controls[owner].failNext=status;}
 else if(request.url!=='/state'){json(response,404,{error:'generated_control_not_found'});return;}
 json(response,200,state());
 })().catch(()=>json(response,400,{error:'generated_control_invalid'}));});
await new Promise<void>(resolve=>control.listen(0,'127.0.0.1',resolve));const controlAddress=control.address();if(!controlAddress||typeof controlAddress==='string')throw Error('Generated Ask control did not bind');
process.stdout.write(JSON.stringify({address,controlAddress:'http://127.0.0.1:'+controlAddress.port,admin:{token:admin.token,userId:admin.userId},a:{token:a.token,userId:a.userId},b:{token:b.token,userId:b.userId},password,pid:process.pid})+'\n');
let closing=false;async function close(){if(closing)return;closing=true;for(const handle of [...held])handle.release();control.closeAllConnections();await new Promise<void>(resolve=>control.close(()=>resolve()));await node.app.close();provider.closeAllConnections();await new Promise<void>(resolve=>provider.close(()=>resolve()));rmSync(directory,{recursive:true,force:true});process.exit(0);}
process.on('SIGTERM',()=>void close());process.on('SIGINT',()=>void close());
