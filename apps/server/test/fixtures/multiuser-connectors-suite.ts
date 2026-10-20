import {createServer} from 'node:http';
import {defaultProcessingSettings} from '../../src/scope/processing-schema.js';
import {defaultModelSettings} from '../../src/model-settings.js';
import {LifecycleAuthority} from '../../src/scope/lifecycle.js';
import {ExecutionFailure} from '../../src/execution-engine.js';
import {DatabaseSync} from 'node:sqlite';
import test,{type TestContext} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdtempSync,rmSync,mkdirSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';
import {buildApp} from '../../src/app.js';
import type {LarkRunner} from '../../src/connectors/lark-cli.js';
import type {DwsRunner} from '../../src/connectors/dingtalk-recordings.js';
import {gmailScope} from '../../src/connectors/gmail-adapter.js';
import type {ConnectorTransports} from '../../src/scope/connector-contract.js';
import type {ConnectorSourceStatusReader} from '../../src/scope/connectors.js';
import {ConnectorVault} from '../../src/scope/connector-vault.js';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StreamableHTTPClientTransport} from '@modelcontextprotocol/sdk/client/streamableHttp.js';

const password='Generated-connector-pass-01',protocol={'x-mote-protocol-version':'2','x-mote-ingress-version':'3'};

const scopes=[gmailScope,'https://www.googleapis.com/auth/calendar.calendarlist.readonly','https://www.googleapis.com/auth/calendar.events.readonly'].join(' ');

const deferred=()=>{let resolve!:()=>void;const promise=new Promise<void>(r=>resolve=r);return {promise,resolve};};

async function fixture(t:TestContext,options:{holdToken?:ReturnType<typeof deferred>;holdMessage?:ReturnType<typeof deferred>;abortableMessage?:boolean;identicalBytes?:boolean;extra?:Partial<ConnectorTransports>;definitions?:import('../../src/scope/connector-contract.js').ConnectorDefinition[]}={}){
 let heldOnce=false,lifecycleAuthority:LifecycleAuthority|undefined;const tokenEntered=deferred(),messageEntered=deferred(),directory=mkdtempSync(join(tmpdir(),'mote-m10-')),calls:{user:string;path:string;query:string;token?:string}[]=[],exchanges:string[]=[];
 const transports:ConnectorTransports={google:({userId})=>({oauthFactory:()=>{const oauth:any={credentials:{},generateCodeVerifierAsync:async()=>({codeVerifier:'synthetic-verifier',codeChallenge:'synthetic-challenge'}),generateAuthUrl:(params:any)=>'https://generated.invalid/oauth?'+new URLSearchParams({state:params.state}).toString(),getToken:async({code}:any)=>{exchanges.push(code);tokenEntered.resolve();if(options.holdToken)await options.holdToken.promise;return {tokens:{refresh_token:'synthetic-refresh-'+userId,access_token:'synthetic-access-'+userId,scope:scopes}};},setCredentials:(value:any)=>{oauth.credentials=value;},getAccessToken:async()=>({token:oauth.credentials.access_token})};return oauth;},fetch:(async(url:any,init:any)=>{
  const u=new URL(String(url));calls.push({user:userId,path:u.pathname,query:u.search,token:init.headers.Authorization});let response:unknown;
  if(u.pathname.endsWith('/profile'))response={emailAddress:'same-account@synthetic.invalid',historyId:'42'};
  else if(u.pathname.endsWith('/calendarList'))response={items:[{id:'same-calendar',summary:'Generated',timeZone:'UTC'}]};
  else if(u.pathname.endsWith('/events'))response={items:[{id:'same-event',summary:'PRIVATE-'+userId,updated:'2026-10-15T00:00:00Z',start:{dateTime:'2026-10-15T01:00:00Z'},end:{dateTime:'2026-10-15T02:00:00Z'}}],nextSyncToken:'cursor-'+userId};
  else if(u.pathname.endsWith('/messages'))response={messages:[{id:'same-message'}]};
  else if(u.pathname.endsWith('/messages/same-message')){messageEntered.resolve();if(options.holdMessage&&(!options.abortableMessage||!heldOnce)){heldOnce=true;if(options.abortableMessage)await new Promise<void>((resolve,reject)=>{const abort=()=>reject(new Error('synthetic transport aborted'));init.signal.addEventListener('abort',abort,{once:true});options.holdMessage!.promise.then(()=>{init.signal.removeEventListener('abort',abort);resolve();});if(init.signal.aborted)abort();});else await options.holdMessage.promise;}response={id:'same-message',payload:{mimeType:'text/plain',headers:[{name:'subject',value:'Generated'}],body:{data:Buffer.from(options.identicalBytes?'IDENTICAL_SYNTHETIC_MESSAGE':'PRIVATE-'+userId).toString('base64url')}}};}
  else if(u.pathname.endsWith('/history'))response={history:[],historyId:'43'};
  else throw Error('Network forbidden: '+u);
  return new Response(JSON.stringify(response),{headers:{'content-type':'application/json'}});
 }) as typeof fetch}),...options.extra};
 let node=await buildApp({dataDir:directory},{connectorTransports:transports,connectorDefinitions:options.definitions,lifecycleAuthority});const nodes=[node];t.after(async()=>{options.holdToken?.resolve();options.holdMessage?.resolve();for(const n of nodes.reverse())await n.app.close();rmSync(directory,{recursive:true,force:true});});
 const request=(token:string|undefined,url:string,method:any='GET',payload?:unknown)=>node.app.inject({url,method,headers:{...protocol,...(token?{authorization:'Bearer '+token}:{})},...(payload===undefined?{}:{payload})});
 await node.accounts!.initialize('generated-admin',password);
 const login=async(username:string)=>{const r=await request(undefined,'/api/auth/login','POST',{username,password,mode:'client',durationMs:86400000});assert.equal(r.statusCode,200,r.body);return r.json();};
 const admin=await login('generated-admin');const create=async(username:string)=>{const r=await request(admin.token,'/api/admin/accounts','POST',{username,password,administrator:false});assert.equal(r.statusCode,200,r.body);return r.json();};
 const a=await create('generated-a'),b=await create('generated-b'),alice=await login('generated-a'),bob=await login('generated-b');
 for(const token of [alice.token,bob.token]){const current=(await request(token,'/api/configuration')).json();const response=await request(token,'/api/configuration/processing','PUT',{revision:current.revision,value:{...defaultProcessingSettings(),automatic:false,understandingEnabled:false,summarize:false,semanticTurns:false,audioProcessor:'audio.http'}});assert.equal(response.statusCode,200,response.body);}
 const view=async(token:string)=>{const r=await request(token,'/api/connectors');assert.equal(r.statusCode,200,r.body);return r.json();};
 const install=async(provider='gmail')=>{const r=await request(admin.token,'/api/admin/connectors/'+provider+'/install','POST',{expectedRevision:node.plugins!.catalog.revision(),operationId:randomUUID()});assert.equal(r.statusCode,200,r.body);};
 const configure=async(token:string,provider='gmail',id='same-connection',autoSync=false)=>{const r=await request(token,'/api/connectors/'+id,'PUT',{expectedRevision:(await view(token)).revision,connection:{provider,autoSync,googleClientId:'synthetic-client',googleClientSecret:'synthetic-client-secret',googleRedirectUri:'https://generated.invalid/callback'}});assert.equal(r.statusCode,200,r.body);};
 const action=async(token:string,action:string,id='same-connection')=>{const r=await request(token,'/api/connectors/'+id+'/'+action,'POST',{expectedRevision:(await view(token)).revision});assert.equal(r.statusCode,200,r.body);return r.json();};
 const start=async(token:string,id='same-connection')=>{const r=await request(token,'/api/connectors/'+id+'/start','POST',{});assert.equal(r.statusCode,200,r.body);return {...r.json(),state:new URL(r.json().authorizationUrl).searchParams.get('state')};};
 const callback=(state:string,code:string)=>request(undefined,'/oauth/google/callback?'+new URLSearchParams({state,code}));
 const wait=async(token:string,id:string,state='succeeded')=>{const deadline=performance.now()+15000;for(;;){await node.execution!.tick();const r=await request(token,'/api/tasks/'+id),task=r.json();assert.equal(r.statusCode,200,r.body);if(task.state===state)return task;if(['blocked','failed','stale','cancelled'].includes(task.state)&&task.state!==state)assert.fail(JSON.stringify(task));if(performance.now()>deadline)assert.fail(JSON.stringify(task));if(task.failure?.code==='recording_stages_pending')try{t.mock.timers.tick(Math.max(1,task.availableAt-Date.now()));}catch(error){if((error as any).code!=='ERR_INVALID_STATE')throw error;}await delay(5);}};
 const operation=async(token:string,operation:string,payload:Record<string,unknown>={},id='same-connection')=>{const r=await request(token,'/api/connectors/'+id+'/operations','POST',{operation,payload,operationId:randomUUID()});assert.equal(r.statusCode,200,r.body);return wait(token,r.json().id);};
 const sync=async(token:string,id='same-connection')=>{const r=await request(token,'/api/connectors/'+id+'/sync','POST',{operationId:randomUUID()});assert.equal(r.statusCode,200,r.body);return wait(token,r.json().id);};
 const connect=async(token:string)=>{await configure(token);await action(token,'enable');const auth=await start(token);assert.equal((await callback(auth.state,'code-'+token.slice(0,8))).statusCode,200);await wait(token,auth.taskId);return auth;};
 return {directory,transports,tokenEntered,messageEntered,get node(){return node;},admin,a,b,alice,bob,calls,exchanges,view,request,install,configure,action,start,callback,wait,operation,sync,connect,async restart(authority?:LifecycleAuthority){if(authority)lifecycleAuthority=authority;await node.app.close();node=await buildApp({dataDir:directory},{connectorTransports:transports,connectorDefinitions:options.definitions,lifecycleAuthority});nodes.push(node);}};
}

function assertNoOperationSecret(f:Awaited<ReturnType<typeof fixture>>,secrets:string[]){
 const db=new DatabaseSync(join(f.directory,'mote.sqlite'));try{for(const table of db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all()){const rows=db.prepare('SELECT * FROM "'+String(table.name).replaceAll('"','""')+'"').all();for(const secret of secrets)assert.equal(JSON.stringify(rows).includes(secret),false,'plaintext operation secret in '+table.name);}}finally{db.close();}
}

function larkConfigurationTransport(configure:(command:any,signal?:AbortSignal)=>Promise<void>):LarkRunner{return async(command,options)=>{if(command.kind==='configure')await configure(command,options?.signal);return command.kind==='version'?'lark-cli 1.0.98':command.kind==='status'?JSON.stringify({appId:'cli_fixture',identities:{user:{available:true,openId:'generated',scope:'docx:document:readonly wiki:wiki:readonly search:docs:read'}}}):'{}';};}

const secretPayload=(secret:string)=>({appId:'cli_fixture',secret,brand:'feishu'});

async function prepareLark(f:Awaited<ReturnType<typeof fixture>>,both=false){await f.install('lark');for(const token of both?[f.alice.token,f.bob.token]:[f.alice.token]){await f.configure(token,'lark');await f.action(token,'enable');}}

function jointLarkTransports(){
 const calls:{user:string;command:string;directory:string}[]=[],state={body:'generated body',fail:false};
 const lark:NonNullable<ConnectorTransports['lark']>=scope=>async(command,options)=>{calls.push({user:scope.userId,command:command.kind,directory:scope.directory});if(options?.signal?.aborted)throw Error('aborted');switch(command.kind){case 'version':return 'lark-cli 1.0.98';case 'status':return JSON.stringify({appId:'cli_same',identities:{user:{available:true,openId:'same-open-id',scope:'docx:document:readonly wiki:wiki:readonly search:docs:read calendar:calendar:readonly space:document:retrieve'}}});case 'login':return JSON.stringify({verification_url:'https://accounts.feishu.cn/generated',device_code:'synthetic-device-'+scope.userId,expires_in:600});case 'complete':return '{}';case 'calendars':return JSON.stringify({data:{calendar_list:[{calendar_id:'same-calendar',summary:'Generated',role:'owner'}],has_more:false}});case 'events':return JSON.stringify({data:{items:[{event_id:'same-event',summary:'PRIVATE-'+scope.userId,description:'X'.repeat(18000)+' CALENDAR_TAIL_'+scope.userId,start_time:{timestamp:'1792026000'},end_time:{timestamp:'1792029600'}}]}});case 'document':if(state.fail)throw Error('PRIVATE-PROVIDER-SECRET-'+scope.userId);return JSON.stringify({data:{document:{document_id:'same-document',revision_id:1,title:'Generated',content:state.body+' PRIVATE-'+scope.userId}}});default:throw Error('Unexpected fake I/O '+command.kind);}};
 return {lark,calls,state};
}

function jointRecordingTransports(){
 const calls:{user:string;kind:string;directory:string}[]=[],media=Buffer.concat([Buffer.from('RIFF0000WAVE'),Buffer.alloc(64)]),state={audioFails:false,text:'generated transcript'};
 const lark:NonNullable<ConnectorTransports['lark']>=scope=>async command=>{calls.push({user:scope.userId,kind:command.kind,directory:scope.directory});const root=join(scope.directory,'lark-runtime');switch(command.kind){case 'login':return JSON.stringify({verification_url:'https://accounts.feishu.cn/generated-recording',device_code:'SYNTHETIC_DEVICE_SECRET',expires_in:600});case 'complete':return '{}';case 'status':return JSON.stringify({appId:'cli_same',identities:{user:{available:true,openId:'same-account'}}});case 'minutes-search':return JSON.stringify({data:{items:[{token:command.pageToken?'second-recording':'same-recording'}],has_more:!command.pageToken,...(!command.pageToken?{page_token:'same-page-token'}:{})}});case 'minutes-metadata':return JSON.stringify({data:{minute:{token:command.id,title:'Generated',create_time:'1790856000000',duration:'5000'}}});case 'minutes-transcript':{const dir=join(root,command.outputDir);mkdirSync(dir,{recursive:true});const path=join(dir,'transcript.txt');writeFileSync(path,'Generated export\n\nSpeaker 00:00:00.000\n'+state.text+' PRIVATE-'+scope.userId+'\n');return JSON.stringify({data:{minutes:[{minute_token:command.id,artifacts:{transcript_file:command.outputDir+'/transcript.txt'}}]}});}case 'minutes-media':if(state.audioFails)throw Error('synthetic media denied PRIVATE_SECRET');mkdirSync(join(root,command.output.split('/').slice(0,-1).join('/')),{recursive:true});writeFileSync(join(root,command.output),media);return '{}';default:throw Error('Unexpected fake Lark I/O '+command.kind);}};
 const dingtalk:NonNullable<ConnectorTransports['dingtalk']>=scope=>async(command,profile,_signal,onOutput)=>{calls.push({user:scope.userId,kind:command.kind,directory:scope.directory});assert.ok(!profile||profile==='same-corp:same-user');switch(command.kind){case 'login':onOutput?.('https://login.dingtalk.com/generated?user_code=synthetic\n');return {completed:true};case 'status':return {authenticated:true,corp_id:'same-corp',user_id:'same-user'};case 'search':return {data:{minutes:[{taskUuid:command.cursor?'second-recording':'same-recording'}],complete:Boolean(command.cursor)},...(!command.cursor?{meta:{pagination:{next_token:'same-page-token'}}}:{})};case 'metadata':return {basic:{taskUuid:command.id,title:'Generated',startTime:1790856000000,duration:5000}};case 'transcript':return {taskUuid:command.id,complete:true,paragraphList:[{paragraph:state.text+' PRIVATE-'+scope.userId,nickName:'Speaker'}]};case 'media':if(state.audioFails)throw Error('synthetic media denied PRIVATE_SECRET');{const root=join(scope.directory,'dws-runtime');mkdirSync(join(root,command.output.split('/').slice(0,-1).join('/')),{recursive:true});writeFileSync(join(root,command.output),media);return {ok:true,succeeded:1,results:[{taskUuid:command.id}]};}default:throw Error('Unexpected fake DWS I/O');}};
 return {lark,dingtalk,calls,state,media};
}

async function jointConfiguration(f:Awaited<ReturnType<typeof fixture>>,token:string,domain:string,value:unknown){const revision=(await f.request(token,'/api/configuration')).json().revision,response=await f.request(token,'/api/configuration/'+domain,'PUT',{revision,value});assert.equal(response.statusCode,200,response.body);}

async function jointProcessing(f:Awaited<ReturnType<typeof fixture>>,token:string){await jointConfiguration(f,token,'processing',{...defaultProcessingSettings(),automatic:true,understandingEnabled:false,summarize:false,semanticTurns:false,audioProcessor:'audio.http'});}

async function jointMaterials(f:Awaited<ReturnType<typeof fixture>>,token:string,count:number){const deadline=performance.now()+16000;for(;;){await f.node.execution!.tick();const response=await f.request(token,'/api/materials');assert.equal(response.statusCode,200,response.body);if(response.json().items.length===count)return Promise.all(response.json().items.map(async(item:any)=>{let offset:number|null=0,text='',first:any;do{const read=await f.request(token,'/api/materials/'+item.id+'/read?offset='+offset);assert.equal(read.statusCode,200,read.body);first??=read.json();text+=read.json().text;offset=read.json().textRange.nextOffset;}while(offset!==null);return {...item,...first,text};}));if(performance.now()>deadline){const tasks=(await f.request(token,'/api/tasks')).json();assert.fail(JSON.stringify({materials:response.json(),tasks}));}await delay(10);}}

async function jointMedia(t:TestContext,handle:(key:string,scope:string,bytes:Buffer)=>Promise<string>){const calls:{key:string;scope:string;bytes:Buffer}[]=[],server=createServer((req,res)=>{void(async()=>{const chunks:Buffer[]=[];for await(const chunk of req)chunks.push(chunk);const key=String(req.headers.authorization??''),scope=String(req.headers['x-mote-request-scope']??''),bytes=Buffer.concat(chunks);calls.push({key,scope,bytes});const text=await handle(key,scope,bytes);res.setHeader('X-Mote-Execution','local');res.setHeader('Content-Type','application/json');res.end(JSON.stringify({durationMs:1000,segments:[{startMs:0,endMs:1000,text,speaker:key.endsWith('A')?'SPEAKER_A':'SPEAKER_B'}],coverage:'full',engine:'generated-joint-asr'}));})().catch(()=>res.destroy());});await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(()=>new Promise<void>(resolve=>server.close(()=>resolve())));const address=server.address();assert.ok(address&&typeof address!=='string');return {url:'http://127.0.0.1:'+address.port+'/transcribe',calls};}

async function jointModels(f:Awaited<ReturnType<typeof fixture>>,token:string,url:string,key:string){await jointConfiguration(f,token,'models',{profiles:[{id:'joint-media',name:'Generated joint media',settings:{...defaultModelSettings(),provider:'custom',protocol:'mote-media',baseUrl:url,model:'generated-joint-asr',apiKey:key}}],selections:{asr:{kind:'personal',id:'joint-media'}}});}

async function jointRecordingConnect(f:Awaited<ReturnType<typeof fixture>>,token:string,provider:string){await jointProcessing(f,token);await f.configure(token,provider);await f.action(token,'enable');await f.operation(token,'login');await f.operation(token,'select',{enabled:true,start:'2026-10-01T00:00:00Z',end:'2026-10-02T00:00:00Z',autoSync:false,backupAudio:true});}

async function socketConnectorSync(f:Awaited<ReturnType<typeof fixture>>,token:string){
 if(!f.node.app.server.listening)await f.node.app.listen({host:'127.0.0.1',port:0});
 const response=await fetch(new URL('/api/connectors/same-connection/sync',f.node.app.listeningOrigin),{method:'POST',headers:{...protocol,authorization:'Bearer '+token,'content-type':'application/json'},body:JSON.stringify({operationId:randomUUID()})});
 assert.equal(response.status,200);return f.wait(token,(await response.json() as {id:string}).id);
}

async function connectorOriginalBytes(f:Awaited<ReturnType<typeof fixture>>,token:string,ref:string){
 if(!f.node.app.server.listening)await f.node.app.listen({host:'127.0.0.1',port:0});
 const ticket=await f.request(token,'/api/ingress/originals/'+ref.slice(9)+'/tickets','POST',{});assert.equal(ticket.statusCode,200,ticket.body);
 const response=await fetch(new URL('/api/ingress/originals/'+ref.slice(9)+'/content?ticket='+encodeURIComponent(ticket.json().ticket),f.node.app.listeningOrigin),{headers:{...protocol,authorization:'Bearer '+token}});assert.equal(response.status,200);return Buffer.from(await response.arrayBuffer());
}

export {password,protocol,scopes,deferred,fixture,assertNoOperationSecret,larkConfigurationTransport,secretPayload,prepareLark,jointLarkTransports,jointRecordingTransports,jointConfiguration,jointProcessing,jointMaterials,jointMedia,jointModels,jointRecordingConnect,socketConnectorSync,connectorOriginalBytes};
