import {noteCapture,type NoteInput} from '@mote/shared';
import {isWebConnection,type Api,type Capture} from './api';
export function notesPath(api:Api,cursor?:string):string{
 const base=api.connection&&isWebConnection(api.connection)?'/api/captures?kind=note&limit=30':'/api/notes?limit=30';
 return base+(cursor?'&cursor='+encodeURIComponent(cursor):'');
}
/** Keep the original NoteOutbox event/ACK identity through the real Ingress 3 path. */
export async function submitWebNote(api:Api,note:NoteInput):Promise<{id:string}>{
 if(!api.connection||!isWebConnection(api.connection))return api.request('/api/notes',{method:'POST',body:JSON.stringify(note),signal:AbortSignal.timeout(20000)});
 const sourceId='web-notes-'+note.deviceId.replace(/[^A-Za-z0-9_-]/g,'_');
 await api.request('/api/ingress/devices',{method:'POST',body:JSON.stringify({id:note.deviceId,name:note.deviceName,platform:note.platform})});
 await api.request('/api/ingress/sources',{method:'POST',body:JSON.stringify({id:sourceId,name:note.deviceName,kind:'custom',deviceId:note.deviceId,platform:note.platform,retention:'archive'})});
 const receipt=await api.request<{userId:string;deploymentId:string;captures:{id:string}[]}>('/api/ingress/sources/'+encodeURIComponent(sourceId)+'/captures',{method:'POST',body:JSON.stringify({batchId:note.id,items:[noteCapture(note)]})});
 if(receipt.userId!==api.connection.userId||receipt.deploymentId!==api.connection.deploymentId||receipt.captures.length!==1||receipt.captures[0].id!==note.id)throw Error('Invalid account-bound note receipt');
 return {id:note.id};
}
export async function readWebNotes(api:Api,cursor?:string){return api.request<{items:Capture[];nextCursor:string|null}>(notesPath(api,cursor));}
