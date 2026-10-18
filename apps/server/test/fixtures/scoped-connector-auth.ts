import type {TestContext} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {setTimeout as delay} from 'node:timers/promises';
import {scopedCaptureFixture} from './scoped-capture-host.js';
import {ConnectorError} from '../../src/connectors/types.js';

type Authorization={user:string;kind:'setup'|'login';url:string;finish:()=>void;expire:()=>void};
/** Generated device-flow transport only. Real routes, M05 tasks, instance vaults,
 * source mapping and account lifecycle are unchanged. Never contacts providers. */
export async function connectorAuthorizationFixture(t:TestContext,provider:'feishu-recordings'|'dingtalk-recordings'){
 const sessions=new Map<string,{configured:boolean;authenticated:boolean;account:string}>(),calls:{user:string;instance:string;kind:string;secret?:string}[]=[],authorizations:Authorization[]=[];
 const session=(user:string,id:string)=>{const key=user+':'+id;let value=sessions.get(key);if(!value)sessions.set(key,value={configured:provider==='dingtalk-recordings',authenticated:false,account:'generated-account'});return value;};
 function authorize(user:string,kind:Authorization['kind'],signal:AbortSignal|undefined,publish:(url:string)=>void,finish:()=>void){return new Promise<void>((resolve,reject)=>{
  const url=(provider==='feishu-recordings'?'https://accounts.feishu.cn/authorize?':'https://login.dingtalk.com/oauth2/auth?')+'user_code=GENERATED%2B'+authorizations.length+'&state=opaque%2F'+user;
  const abort=()=>{signal?.removeEventListener('abort',abort);reject(new ConnectorError('generated_authorization_cancelled'));};
  authorizations.push({user,kind,url,finish:()=>{signal?.removeEventListener('abort',abort);finish();resolve();},expire:()=>{signal?.removeEventListener('abort',abort);reject(new ConnectorError(provider==='feishu-recordings'?'lark_authorization_expired':'dingtalk_authorization_expired'));}});
  publish(url);signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted)abort();
 });}
 let pendingLarkUrl='';
 const f=await scopedCaptureFixture(t,{connectorTransports:{lark:scope=>async(command,options)=>{
  const state=session(scope.userId,scope.instanceId);calls.push({user:scope.userId,instance:scope.instanceId,kind:command.kind,...(command.kind==='configure'?{secret:command.secret}:{})});
  switch(command.kind){
   case 'version':return 'lark-cli 1.0.98';
   case 'status':return JSON.stringify({...(state.configured?{appId:'cli_generated'}:{}),identities:{user:{available:state.authenticated,openId:state.account,userName:'Generated '+scope.userId,scope:'minutes:minutes.basic:read minutes:minutes.artifacts:read minutes:minutes.media:export minutes:minutes.search:read'}}});
   case 'configure':state.configured=true;state.authenticated=false;return '{}';
   case 'setup':await authorize(scope.userId,'setup',options?.signal,url=>{options?.onOutput?.(url.slice(0,25));options?.onOutput?.(url.slice(25)+'\n');},()=>{state.configured=true;});return '{}';
   case 'login':if(!state.configured)throw new ConnectorError('lark_not_configured');pendingLarkUrl='https://accounts.feishu.cn/authorize?user_code=GENERATED%2B'+authorizations.length+'&state=opaque%2F'+scope.userId;return JSON.stringify({verification_url:pendingLarkUrl,device_code:'GENERATED_PRIVATE_DEVICE_CODE',expires_in:600});
   case 'complete':await authorize(scope.userId,'login',options?.signal,()=>{},()=>{state.authenticated=true;});return '{}';
   case 'minutes-search':return JSON.stringify({data:{items:[],has_more:false}});
   default:throw Error('Unexpected generated Lark command '+command.kind);
  }
 },dingtalk:scope=>async(command,_profile,signal,onOutput)=>{
  const state=session(scope.userId,scope.instanceId);calls.push({user:scope.userId,instance:scope.instanceId,kind:command.kind});
  switch(command.kind){
   case 'version':return {version:'v1.0.64'};
   case 'status':return {authenticated:state.authenticated,corp_id:'same-corp',user_id:state.account,user_name:'Generated '+scope.userId};
   case 'login':await authorize(scope.userId,'login',signal,url=>{onOutput?.('Generated device flow\n'+url.slice(0,27));onOutput?.(url.slice(27)+'\r');onOutput?.('\nManual code URL\nhttps://login.dingtalk.com/oauth2/auth\n');},()=>{state.authenticated=true;});return {completed:true};
   case 'search':return {data:{minutes:[],complete:true}};
   default:throw Error('Unexpected generated DWS command '+command.kind);
  }
 }}});
 const installed=await f.request(f.admin.token,'/api/admin/connectors/'+provider+'/install','POST',{expectedRevision:f.host.plugins!.catalog.revision(),operationId:randomUUID()});assert.equal(installed.statusCode,200,installed.body);
 for(const account of [f.a,f.b]){const inventory=(await f.request(account.token,'/api/connectors')).json();assert.equal((await f.request(account.token,'/api/connectors/same-recorder','PUT',{expectedRevision:inventory.revision,connection:{provider,autoSync:false}})).statusCode,200);const plugins=(await f.request(account.token,'/api/plugins')).json();assert.equal((await f.request(account.token,'/api/connectors/same-recorder/enable','POST',{expectedRevision:plugins.revision})).statusCode,200);}
 async function operation(token:string,operation:string,payload:Record<string,unknown>={}){const result=await f.request(token,'/api/connectors/same-recorder/operations','POST',{operation,payload,operationId:randomUUID()});assert.equal(result.statusCode,200,result.body);return result.json();}
 async function task(token:string,id:string,terminal=true){for(let i=0;i<1000;i++){const response=await f.request(token,'/api/tasks/'+id);assert.equal(response.statusCode,200,response.body);const value=response.json();if(!terminal||!['waiting','running'].includes(value.state))return value;await delay(10);}throw Error('Generated authorization task did not settle');}
 async function entered(user:string,kind:Authorization['kind'],after=0){for(let i=0;i<1000;i++){const value=authorizations.slice(after).find(value=>value.user===user&&value.kind===kind);if(value)return value;await delay(10);}throw Error('Generated authorization not entered');}
 return {f,calls,authorizations,sessions,session,operation,task,entered};
}
