import type {Config} from './contracts';
import {DESKTOP_PROTOCOL_HEADERS,accountKey} from './account';
import {assertAccountConnection,ingressKey} from './ingress-client';
import {requireConnectionToken} from './login-session';
import {validateServerUrl} from './config';
import {readResponseText} from './response-body';

export async function accountResponse(config:Config,path:string,body?:unknown):Promise<Response>{
 await assertAccountConnection(config);
 const response=await fetch(validateServerUrl(config.serverUrl)+path,{method:body===undefined?'GET':'POST',headers:{...DESKTOP_PROTOCOL_HEADERS,'X-Mote-Ingress-Version':'3',Authorization:'Bearer '+requireConnectionToken(config),'Content-Type':'application/json'},credentials:'omit',redirect:'error',signal:AbortSignal.timeout(30000),...(body===undefined?{}:{body:JSON.stringify(body)})});
 if(!response.ok){await response.body?.cancel();const error=Error('Private account read failed') as Error&{statusCode:number};error.statusCode=response.status;if([401,403].includes(response.status))error.name='ArchiveAuthorizationError';throw error;}
 return response;
}
export async function accountJson(config:Config,path:string,body?:unknown):Promise<any>{return JSON.parse(await readResponseText(await accountResponse(config,path,body),4*1024*1024));}
/** Walk the real signed server cursor; never apply a local filter after LIMIT. */
export async function accountCaptures(config:Config,filters:Record<string,string>={}):Promise<any[]>{
 const items:any[]=[],seen=new Set<string>();let cursor:string|undefined;
 do{const page=await accountJson(config,'/api/captures?'+new URLSearchParams({deviceId:config.deviceId,...filters,projection:'preview',limit:'200',...(cursor?{cursor}:{})}));if(!Array.isArray(page.items)||page.items.some((v:any)=>v.deviceId!==config.deviceId))throw Error('Private capture page mismatch');items.push(...page.items);cursor=page.nextCursor??undefined;if(cursor){if(seen.has(cursor))throw Error('Repeated private capture cursor');seen.add(cursor);}}while(cursor);
 return items;
}
export function accountPagePosition(config:Config,cursor:string|undefined,query:unknown):number{
 if(!cursor)return 0;let value:any;try{value=JSON.parse(Buffer.from(cursor,'base64url').toString());}catch{throw Error('Invalid account page cursor');}
 if(value.account!==accountKey(config)||value.query!==ingressKey(query)||!Number.isSafeInteger(value.offset)||value.offset<0)throw Error('Invalid account page cursor');return value.offset;
}
export function accountPageCursor(config:Config,query:unknown,offset:number):string{return Buffer.from(JSON.stringify({account:accountKey(config),query:ingressKey(query),offset})).toString('base64url');}
export async function accountOriginal(config:Config,record:any):Promise<{descriptor:any;response:Response}|undefined>{
 const sourceId=record.provenance?.sourceId??'desktop-'+ingressKey([record.deviceId,record.platform]).slice(0,40);let after:string|undefined;const seen=new Set<string>();
 do{const page=await accountJson(config,`/api/ingress/sources/${encodeURIComponent(sourceId)}/originals?`+new URLSearchParams({limit:'100',...(after?{after}:{})}));
  if(!Array.isArray(page.items))throw Error('Invalid original page');const descriptor=page.items.find((item:any)=>item.captureId===record.id);
  if(descriptor){if(descriptor.sourceId!==sourceId||!/^original:[a-f0-9]{64}$/.test(descriptor.ref))throw Error('Original binding mismatch');const id=descriptor.ref.slice(9),ticket=await accountJson(config,`/api/ingress/originals/${id}/tickets`,{mode:'download'});return {descriptor,response:await accountResponse(config,`/api/ingress/originals/${id}/content?ticket=${encodeURIComponent(ticket.ticket)}`)};}
  after=page.nextCursor??undefined;if(after){if(seen.has(after))throw Error('Repeated original cursor');seen.add(after);}
 }while(after);return;
}
