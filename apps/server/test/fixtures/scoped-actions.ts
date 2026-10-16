import {type TestContext} from 'node:test';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createServer,type ServerResponse} from 'node:http';
import {DatabaseSync} from 'node:sqlite';
import {buildApp} from '../../src/app.js';
import {defaultModelSettings} from '../../src/model-settings.js';
import {defaultProcessingSettings} from '../../src/scope/processing-schema.js';
import {writeMessagesResponse} from '../../../../scripts/fixtures/messages-provider.js';
import {queryAccounts,queryHttp,waitForState,item} from './scoped-query-accounts.js';

export async function fixture(t:TestContext){
 const directory=mkdtempSync(join(tmpdir(),'mote-m12-'));let node=await buildApp({dataDir:directory});
 t.after(async()=>{await node.app.close();rmSync(directory,{recursive:true,force:true});});
 const {request,ok}=queryHttp(()=>node),users=await queryAccounts(node,ok);
 return {get node(){return node;},directory,request,ok,...users,read:<T>(work:(db:DatabaseSync)=>T)=>{const db=new DatabaseSync(join(directory,'mote.sqlite'),{readOnly:true});try{return work(db);}finally{db.close();}},restart:async()=>{await node.app.close();node=await buildApp({dataDir:directory});}};
}


export const event={title:'Generated appointment',start:'2099-02-01T09:00:00Z',end:'2099-02-01T10:00:00Z',timeZone:'UTC',allDay:false,location:'',description:''};
export async function modelFixture(t:TestContext){
 const requests:{owner:string;raw:string;body:any}[]=[],scripts=new Map<string,(body:any,raw:string,res:ServerResponse)=>void|Promise<void>>();
 const provider=createServer((req,res)=>{void(async()=>{let raw='';for await(const chunk of req)raw+=chunk;const body=JSON.parse(raw),owner=String(req.headers['x-api-key']).includes('_A_')?'A':'B';requests.push({owner,raw,body});if(scripts.has(owner)){await scripts.get(owner)!(body,raw,res);return;}respond(body,raw,res,owner);})().catch(()=>res.destroy());});
 await new Promise<void>(resolve=>provider.listen(0,'127.0.0.1',resolve));t.after(async()=>{provider.closeAllConnections();await new Promise<void>(resolve=>provider.close(()=>resolve()));});
 const f=await fixture(t),replace=async(user:any,domain:string,value:unknown)=>{const view=await f.ok(user.token,'/api/configuration');return f.ok(user.token,'/api/configuration/'+domain,'PUT',{revision:view.revision,value});};
 for(const [user,label] of [[f.a,'A'],[f.b,'B']] as const){await replace(user,'processing',{...defaultProcessingSettings(),automatic:false,understandingEnabled:false});await replace(user,'models',{profiles:[{id:'same-model',name:'Generated action model',settings:{...defaultModelSettings(),provider:'custom',protocol:'anthropic-messages',model:'generated-actions',baseUrl:'http://127.0.0.1:'+(provider.address() as any).port+'/v1',apiKey:'GENERATED_'+label+'_KEY',headers:{},extraBody:{}}}],selections:{chat:{kind:'personal',id:'same-model'}}});}
 const enable=async(user:any)=>{const view=await f.ok(user.token,'/api/actions');return f.ok(user.token,'/api/actions/settings','PUT',{revision:view.revision,authorizationRevision:view.authorizationRevision,settings:{enabled:true,timeZone:'UTC',reviewDeviceIds:['same-device']}});};
 const ingest=async(user:any,label:string,externalId='same-item',sourceId='same-source')=>{const receipt=await f.ok(user.token,'/api/ingress/sources/'+sourceId+'/items','POST',{batchId:'batch:'+externalId,items:[item('GENERATED_'+label+'_PRIVATE_APPOINTMENT',externalId)]});await waitForState(async()=>f.read(db=>Boolean(db.prepare('SELECT 1 FROM pd_materials h JOIN pd_material_captures c ON c.user_id=h.user_id AND c.material_id=h.id AND c.revision=h.revision WHERE h.user_id=? AND c.capture_id=? AND h.sequence>=h.min_visible_sequence').get(user.userId,receipt.captures[0].id))),value=>value,'exact original formal Material publication');return receipt;};
 const proposal=(user:any)=>waitForState(()=>f.ok(user.token,'/api/actions'),value=>value.items.length>0,'actual Actions proposal');
 return {...f,get node(){return f.node;},requests,scripts,replace,enable,ingest,proposal};
}
export function respond(body:any,raw:string,res:ServerResponse,owner:string){
 const envelope=JSON.parse(typeof body.messages[0].content==='string'?body.messages[0].content:body.messages[0].content[0].text);
 const uses=body.messages.flatMap((message:any)=>Array.isArray(message.content)?message.content.filter((part:any)=>part.type==='tool_use'):[]),ids=[...new Set(raw.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g)??[])];
 if(!uses.some((use:any)=>use.name==='evidence'))return writeMessagesResponse(res,{stage:uses.length+1,tool:{name:'evidence',args:{ids:[envelope.untrustedEvidence[0].id]}}});
 const id=envelope.untrustedEvidence[0].id;
 writeMessagesResponse(res,{stage:uses.length+1,text:JSON.stringify({answer:JSON.stringify({actions:envelope.untrustedEvidence[0].ocrText.includes('GENERATED_'+owner+'_PRIVATE_APPOINTMENT')?[{kind:'calendar.create',event:{...event,title:'Generated '+owner},uncertainty:'Generated proposal',sameAs:null,evidence:[{id,quote:'GENERATED_'+owner+'_PRIVATE_APPOINTMENT'}]}]:[]}),citationIds:[id]})});
}

