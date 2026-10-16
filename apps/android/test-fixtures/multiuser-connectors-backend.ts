import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {buildApp} from '../../server/src/app.js';
import {queryHttp,queryAccounts,password,waitForState} from '../../server/test/fixtures/scoped-query-accounts.js';
import {defaultProcessingSettings} from '../../server/src/scope/processing-schema.js';
import {gmailScope} from '../../server/src/connectors/gmail-adapter.js';

// Original M10 Google adapters and M09/M05/M03 lifecycle, only provider I/O is
// generated. No browser, real Google, credential store or native CLI is used.
const directory=mkdtempSync(join(tmpdir(),'m15-native-connectors-'));
const scopes=[gmailScope,'https://www.googleapis.com/auth/calendar.calendarlist.readonly','https://www.googleapis.com/auth/calendar.events.readonly'].join(' ');
const node=await buildApp({dataDir:directory},{connectorTransports:{google:({userId})=>({
 oauthFactory:()=>{
  const oauth:any={credentials:{},generateCodeVerifierAsync:async()=>({codeVerifier:'generated-verifier',codeChallenge:'generated-challenge'}),generateAuthUrl:(params:any)=>'https://accounts.google.com/o/oauth2/v2/auth?'+new URLSearchParams({state:params.state}).toString(),getToken:async()=>({tokens:{access_token:'generated-access-'+userId,refresh_token:'generated-refresh-'+userId,scope:scopes}}),setCredentials:(value:any)=>{oauth.credentials=value;},getAccessToken:async()=>({token:oauth.credentials.access_token})};return oauth;
 },
 fetch:(async(raw:any)=>{
  const url=new URL(String(raw));let response:unknown;
  if(url.pathname.endsWith('/profile'))response={emailAddress:'generated@fixture.invalid',historyId:'42'};
  else if(url.pathname.endsWith('/calendarList'))response={items:[{id:'same-calendar',summary:'Generated calendar '+userId,timeZone:'UTC'}]};
  else if(url.pathname.endsWith('/events'))response={items:[{id:'same-event',summary:'GENERATED_PRIVATE_'+userId,updated:'2026-10-15T00:00:00Z',start:{dateTime:'2026-10-15T01:00:00Z'},end:{dateTime:'2026-10-15T02:00:00Z'}}],nextSyncToken:'generated-cursor'};
  else if(url.pathname.endsWith('/messages'))response={messages:[{id:'same-message'}]};
  else if(url.pathname.endsWith('/messages/same-message'))response={id:'same-message',payload:{mimeType:'text/plain',headers:[{name:'subject',value:'Generated'}],body:{data:Buffer.from('GENERATED_PRIVATE_'+userId).toString('base64url')}}};
  else if(url.pathname.endsWith('/history'))response={history:[],historyId:'43'};
  else throw Error('Unexpected generated provider path '+url.pathname);
  return new Response(JSON.stringify(response),{headers:{'content-type':'application/json'}});
 }) as typeof fetch,
})}});
const {ok}=queryHttp(()=>node),{admin,a,b}=await queryAccounts(node,ok);
for(const actor of [a,b]){const view=await ok(actor.token,'/api/configuration');await ok(actor.token,'/api/configuration/processing','PUT',{revision:view.revision,value:{...defaultProcessingSettings(),automatic:false,understandingEnabled:false}});}
for(const provider of ['gmail','google-calendar']){
 await ok(admin.token,'/api/admin/connectors/'+provider+'/install','POST',{expectedRevision:node.plugins!.catalog.revision(),operationId:randomUUID()});
 await waitForState(async()=>node.plugins!.catalog.view(),view=>view.packages.some(value=>value.id.startsWith('mote.connector.'+provider+'@')&&value.state==='installed'),'generated bundled connector install');
}
const bView=await ok(b.token,'/api/connectors');
await ok(b.token,'/api/connectors/same-mail','PUT',{expectedRevision:bView.revision,connection:{provider:'gmail',autoSync:false,googleClientId:'GENERATED_B_CLIENT',googleClientSecret:'GENERATED_B_SECRET',googleRedirectUri:'https://fixture.invalid/b-callback'}});
const address=await node.app.listen({host:'127.0.0.1',port:0});
process.stdout.write(JSON.stringify({address,controlAddress:address,a,b,admin,password,pid:process.pid})+'\n');
let closing=false;
async function close(){if(closing)return;closing=true;await node.app.close();rmSync(directory,{recursive:true,force:true});process.exit(0);}
process.on('SIGTERM',()=>void close());process.on('SIGINT',()=>void close());
