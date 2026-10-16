import {createHash} from 'node:crypto';
import type {Config,CaptureEvent} from './contracts';
import {DESKTOP_PROTOCOL_HEADERS,accountKey} from './account';
import {requireConnectionToken} from './login-session';
import {validateServerUrl} from './config';
import {readResponseText} from './response-body';
import {meteredBody} from './upload-meter';
import {TransportFailure,httpFailure} from './support';
import {testConnection} from './connection';
import {sameAccount} from './account';

export const ACCOUNT_INGRESS_HEADERS={...DESKTOP_PROTOCOL_HEADERS,'X-Mote-Ingress-Version':'3'} as const;
export const ingressKey=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
export async function assertAccountConnection(config:Config):Promise<void>{
 const identity=await testConnection(config);
 if(!sameAccount(config,{...config,account:identity.account}))throw Error('Central account or deployment changed; personal bytes were not sent');
}
export async function ingressRequest(config:Config,path:string,body:unknown,method='POST',signal?:AbortSignal,onBytes?:(bytes:number)=>void):Promise<any>{
 if(!accountKey(config))throw Error('Account confirmation required');
 const response=await fetch(validateServerUrl(config.serverUrl)+path,{method,headers:{...ACCOUNT_INGRESS_HEADERS,Authorization:'Bearer '+requireConnectionToken(config),'Content-Type':'application/json'},credentials:'omit',redirect:'error',signal:signal?AbortSignal.any([signal,AbortSignal.timeout(30000)]):AbortSignal.timeout(30000),...(method==='GET'?{}:{body:meteredBody(JSON.stringify(body),onBytes),duplex:'half'} as object)});
 if(!response.ok){await response.body?.cancel();throw new TransportFailure('Account ingress request failed',httpFailure(response.status),response.status);}
 return JSON.parse(await readResponseText(response,2*1024*1024));
}
export function requireAccountReceipt(value:any,config:Pick<Config,'account'>,sourceId:string,batchId:string,expected:readonly {id?:string;externalId?:string;revision?:string}[]):any[]{
 if(!value||value.version!==3||value.state!=='received'||value.deploymentId!==config.account?.deploymentId||value.userId!==config.account?.userId||value.sourceId!==sourceId||value.batchId!==batchId||typeof value.id!=='string'||!Array.isArray(value.captures)||value.captures.length!==expected.length)throw Error('Account ingress receipt mismatch');
 for(const [i,item] of value.captures.entries()){const target=expected[i];if(!item||typeof item.id!=='string'||!/^[0-9a-f-]{36}$/i.test(item.id)||typeof item.duplicate!=='boolean'||target.id!==undefined&&item.id!==target.id||target.externalId!==undefined&&(item.externalId!==target.externalId||item.revision!==target.revision))throw Error('Account ingress item receipt mismatch');}
 return value.captures;
}
export async function uploadAccountCaptures(config:Config,entries:readonly {event:CaptureEvent;image?:Buffer}[],signal?:AbortSignal,onBytes?:(bytes:number)=>void):Promise<Map<string,number>>{
 await assertAccountConnection(config);signal?.throwIfAborted();
 const groups=new Map<string,typeof entries[number][]>();
 for(const entry of entries){const key=entry.event.deviceId+':'+entry.event.platform;groups.set(key,[...(groups.get(key)??[]),entry]);}
 const result=new Map<string,number>();
 for(const group of groups.values()){
  const first=group[0].event,sourceId='desktop-'+ingressKey([first.deviceId,first.platform]).slice(0,40);
  await ingressRequest(config,'/api/ingress/devices',{id:first.deviceId,name:first.deviceName,platform:first.platform},'POST',signal);
  await ingressRequest(config,'/api/ingress/sources',{id:sourceId,name:first.deviceName,kind:'mote.desktop',deviceId:first.deviceId,platform:first.platform,retention:'archive'},'POST',signal);
  // One immutable event per receipt: partial failures and state-series extensions
  // never reuse a batch key for different bytes. Existing fair queue slices remain.
  for(const entry of group){
   signal?.throwIfAborted();const item={...entry.event,...(entry.image?{imageBase64:entry.image.toString('base64')}:{})},batchId='capture-'+ingressKey(item);
   const receipt=await ingressRequest(config,`/api/ingress/sources/${sourceId}/captures`,{batchId,items:[item]},'POST',signal,onBytes);
   requireAccountReceipt(receipt,config,sourceId,batchId,[{id:entry.event.id}]);result.set(entry.event.id,200);
  }
 }
 return result;
}
