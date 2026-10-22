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
import {requireSourceRegistration,isUploadExpired} from './ingress-outcome';

export const ACCOUNT_INGRESS_HEADERS={...DESKTOP_PROTOCOL_HEADERS,'X-Mote-Ingress-Version':'3'} as const;
export const ingressKey=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
export async function assertAccountConnection(config:Config):Promise<void>{
 const identity=await testConnection(config);
 if(!sameAccount(config,{...config,account:identity.account}))throw Error('Central account or deployment changed; personal bytes were not sent');
}
export async function ingressRequest(config:Config,path:string,body:unknown,method='POST',signal?:AbortSignal,onBytes?:(bytes:number)=>void):Promise<any>{
 if(!accountKey(config))throw Error('Account confirmation required');
 signal?.throwIfAborted();await assertAccountConnection(config);signal?.throwIfAborted();
 const response=await fetch(validateServerUrl(config.serverUrl)+path,{method,headers:{...ACCOUNT_INGRESS_HEADERS,Authorization:'Bearer '+requireConnectionToken(config),'Content-Type':'application/json'},credentials:'omit',redirect:'error',signal:signal?AbortSignal.any([signal,AbortSignal.timeout(30000)]):AbortSignal.timeout(30000),...(method==='GET'?{}:{body:meteredBody(JSON.stringify(body),onBytes),duplex:'half'} as object)});
 if(!response.ok){
  const failure=new TransportFailure('Account ingress request failed',httpFailure(response.status),response.status);
  try{const rejected=JSON.parse(await readResponseText(response,4096));if(response.status===409&&rejected?.error==='upload_expired')Object.assign(failure,{uploadExpired:true});}catch{}
  throw failure;
 }
 return JSON.parse(await readResponseText(response,2*1024*1024));
}
export function requireAccountReceipt(value:any,config:Pick<Config,'account'>,sourceId:string,batchId:string,expected:readonly {id?:string;externalId?:string;revision?:string}[]):any[]{
 if(!value||value.version!==3||value.state!=='received'||value.deploymentId!==config.account?.deploymentId||value.userId!==config.account?.userId||value.sourceId!==sourceId||value.batchId!==batchId||value.id!==ingressKey([config.account?.deploymentId,config.account?.userId,sourceId,batchId])||!Array.isArray(value.captures)||value.captures.length!==expected.length)throw Error('Account ingress receipt mismatch');
 for(const [i,item] of value.captures.entries()){
  const target=expected[i],digest=target.externalId===undefined?undefined:ingressKey([sourceId,target.externalId,target.revision]),id=target.id??(digest?`${digest.slice(0,8)}-${digest.slice(8,12)}-5${digest.slice(13,16)}-a${digest.slice(17,20)}-${digest.slice(20,32)}`:undefined);
  if(!item||typeof item.id!=='string'||!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(item.id)||typeof item.duplicate!=='boolean'||id!==undefined&&item.id!==id||target.externalId!==undefined&&(item.externalId!==target.externalId||item.revision!==target.revision))throw Error('Account ingress item receipt mismatch');
  const original=item.original;if(original&&(original.sourceId!==sourceId||original.captureId!==item.id||!Number.isSafeInteger(original.bytes)||original.bytes<0||typeof original.hash!=='string'||!/^[a-f0-9]{64}$/.test(original.hash)||typeof original.mime!=='string'||!['snapshot','archive'].includes(original.retention)||original.ref!=='original:'+ingressKey([config.account?.userId,sourceId,item.id,original.hash,original.mime,original.retention])))throw Error('Account original receipt mismatch');
 }
 return value.captures;
}
export async function uploadAccountCaptures(config:Config,entries:readonly {event:CaptureEvent;image?:Buffer}[],signal?:AbortSignal,onBytes?:(bytes:number)=>void,onReceipt?:(id:string,status:number)=>void|Promise<void>):Promise<Map<string,number>>{
 signal?.throwIfAborted();
 const groups=new Map<string,typeof entries[number][]>();
 for(const entry of entries){const key=entry.event.deviceId+':'+entry.event.platform;groups.set(key,[...(groups.get(key)??[]),entry]);}
 const result=new Map<string,number>();
 for(const group of groups.values()){
  const first=group[0].event,sourceId='desktop-'+ingressKey([first.deviceId,first.platform]).slice(0,40);
  await ingressRequest(config,'/api/ingress/devices',{id:first.deviceId,name:first.deviceName,platform:first.platform},'POST',signal);
  const source={id:sourceId,name:first.deviceName,kind:'mote.desktop',deviceId:first.deviceId,platform:first.platform,retention:'archive'};
  const register=async()=>requireSourceRegistration(await ingressRequest(config,'/api/ingress/sources',source,'POST',signal),source,true);
  await register();
  // Batch identity includes the complete immutable payload. Prefix extensions
  // and split retries therefore cannot reuse a key for different bytes.
  const send=async(batch:typeof group):Promise<void>=>{
   signal?.throwIfAborted();const items=batch.map(entry=>({...entry.event,...(entry.image?{imageBase64:entry.image.toString('base64')}:{})})),batchId='capture-'+ingressKey(items);
   let receipt:unknown,rejectedStatus:number|undefined;
   try{
    receipt=await ingressRequest(config,`/api/ingress/sources/${sourceId}/captures`,{batchId,items},'POST',signal,onBytes);
   }catch(error){
    if(!(error instanceof TransportFailure)||isUploadExpired(error)||![409,410,413].includes(error.httpStatus??0))throw error;
    // Authenticated read-or-create preserves pause; failed confirmation never
    // supplies enough evidence to quarantine a queued record.
    if(error.httpStatus===409)await register();
    if(batch.length>1){const middle=Math.ceil(batch.length/2);await send(batch.slice(0,middle));await send(batch.slice(middle));return;}
    if(error.httpStatus===413)throw error;
    rejectedStatus=error.httpStatus;
   }
   if(rejectedStatus!==undefined){signal?.throwIfAborted();await onReceipt?.(batch[0].event.id,rejectedStatus);result.set(batch[0].event.id,rejectedStatus);return;}
   const captures=requireAccountReceipt(receipt,config,sourceId,batchId,batch.map(entry=>({id:entry.event.id})));
   // Validate the entire response, including originals, before any local effect.
   for(const [i,entry] of batch.entries())if(entry.image&&(captures[i].original?.hash!==createHash('sha256').update(entry.image).digest('hex')||captures[i].original?.bytes!==entry.image.length||captures[i].original?.mime!==entry.event.imageMime))throw Error('Account capture original receipt mismatch');
   // Local persistence failures must never enter the HTTP splitting catch.
   for(const entry of batch){signal?.throwIfAborted();await onReceipt?.(entry.event.id,200);result.set(entry.event.id,200);}
  };
  if(config.packedUpload)await send(group);else for(const entry of group)await send([entry]);
 }
 return result;
}
