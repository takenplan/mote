import type {Config} from './contracts';
import {DESKTOP_PROTOCOL_HEADERS} from './account';
import {assertAccountConnection} from './ingress-client';
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
export async function accountOriginalDescriptor(config:Config,record:any):Promise<any|undefined>{
 // The intake reader deliberately hides its internal ingress source field.
 // Resolve only actual owned source inventory, then the exact capture binding;
 // an upload source name cannot be inferred from this device's identity.
 let sourceIds:string[];
 if(record.provenance?.sourceId)sourceIds=[record.provenance.sourceId];
 else{const page=await accountJson(config,'/api/sources');if(!Array.isArray(page.items))throw Error('Invalid source inventory');sourceIds=page.items.filter((source:any)=>source.deviceId===record.deviceId&&source.platform===record.platform&&source.enabled!==false).map((source:any)=>{if(typeof source.id!=='string')throw Error('Invalid source identity');return source.id;});}
 for(const sourceId of sourceIds){let after:string|undefined;const seen=new Set<string>();
  do{const page=await accountJson(config,`/api/ingress/sources/${encodeURIComponent(sourceId)}/originals?`+new URLSearchParams({limit:'100',...(after?{after}:{})}));
   if(!Array.isArray(page.items))throw Error('Invalid original page');const descriptor=page.items.find((item:any)=>item.captureId===record.id);
   if(descriptor){if(descriptor.sourceId!==sourceId||!/^original:[a-f0-9]{64}$/.test(descriptor.ref))throw Error('Original binding mismatch');return descriptor;}
   after=page.nextCursor??undefined;if(after){if(seen.has(after))throw Error('Repeated original cursor');seen.add(after);}
  }while(after);
 }return;
}
export async function accountOriginal(config:Config,record:any):Promise<{descriptor:any;response:Response}|undefined>{
 const descriptor=await accountOriginalDescriptor(config,record);if(!descriptor||descriptor.available===false)return;
 const id=descriptor.ref.slice(9),ticket=await accountJson(config,`/api/ingress/originals/${id}/tickets`,{mode:'download'});return {descriptor,response:await accountResponse(config,`/api/ingress/originals/${id}/content?ticket=${encodeURIComponent(ticket.ticket)}`)};
}
/** Received capture flags are immutable. Observe the admitted central stages
 * through the existing Activity receipt; successful text still requires the
 * exact declared extraction Material below. */
export async function accountCaptureProcessing(config:Config,record:any):Promise<'pending'|'failed'|undefined>{
 const original=await accountOriginalDescriptor(config,record);if(!original)return;
 try{const work=await accountJson(config,'/api/work-activity/'+encodeURIComponent('file:'+original.ref.slice(9)));
  if(['failed','stale','needs_input','cancelled'].includes(work.state))return 'failed';
  if(['waiting','running'].includes(work.state))return 'pending';
 }catch(error){if((error as Error&{statusCode?:number}).statusCode!==404)throw error;}
}
/** Canonical extraction is separate from the immutable received capture. M06
 * origins need not carry a device: exact capture membership is the binding. */
export async function accountCaptureMaterial(config:Config,record:any):Promise<any|undefined>{
 const sourceId=record.provenance?.sourceId??(await accountOriginalDescriptor(config,record))?.sourceId;if(!sourceId)return;
 let cursor:string|undefined;const seen=new Set<string>();
 do{const page=await accountJson(config,'/api/materials?'+new URLSearchParams({sourceId,limit:'200',...(cursor?{cursor}:{})}));if(!Array.isArray(page.items))throw Error('Invalid material page');
  for(const material of page.items){
   // Only the declared extraction is a replacement for the received body.
   // Organized source metadata, summaries and interpretations are other products.
   if(!material.artifacts?.some((artifact:any)=>artifact.key==='extraction'&&artifact.state==='ready'))continue;
   let offset=0,matched=false;
   while(true){const members=await accountJson(config,`/api/materials/${material.id}/members?revision=${material.revision}&offset=${offset}&limit=200`);if(!Array.isArray(members.items)||members.items.length>200)throw Error('Invalid material member page');
    if(members.items.some((member:any)=>member.kind==='capture'&&member.ref==='capture:'+record.id)){matched=true;break;}
    if(members.nextOffset===null||members.nextOffset===undefined)break;
    if(!Number.isSafeInteger(members.nextOffset)||members.nextOffset<=offset)throw Error('Invalid material member cursor');offset=members.nextOffset;
   }
   if(matched)return material;
  }
  cursor=page.nextCursor??undefined;if(cursor){if(seen.has(cursor))throw Error('Repeated material cursor');seen.add(cursor);}
 }while(cursor);return;
}
