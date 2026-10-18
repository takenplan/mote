import {z} from 'zod';
import {Readable} from 'node:stream';
import {setImmediate as yieldTurn} from 'node:timers/promises';
import {registerAuthenticatedRoute,type ScopedRuntime} from './http.js';
import type {LifecycleOperations} from './lifecycle-operations.js';
const id=(value:unknown)=>z.object({id:z.string().uuid()}).parse(value).id;
const empty=z.object({}).strict();
export function registerLifecycleRoutes(runtime:ScopedRuntime,operations:LifecycleOperations){
 registerAuthenticatedRoute(runtime,{method:'GET',url:'/api/export',handle:async(context,request,reply)=>{
  empty.parse(request.query);const controller=new AbortController();let finish:((completed:boolean)=>void)|undefined;
  const cleanup=()=>{request.raw.removeListener('aborted',abort);reply.raw.removeListener('close',closed);reply.raw.removeListener('finish',completed);},abort=()=>{controller.abort(new Error('archive_delivery_disconnected'));finish?.(false);cleanup();},closed=()=>{if(!reply.raw.writableFinished)abort();else cleanup();},completed=()=>{finish?.(true);cleanup();};
  request.raw.once('aborted',abort);reply.raw.once('close',closed);reply.raw.once('finish',completed);
  try{const value=await operations.download(context,controller.signal);finish=value.finish;value.assert();
   reply.header('X-Mote-Operation-Id',value.operationId).header('Content-Type','application/json; charset=utf-8').header('Content-Disposition',`attachment; filename="${value.filename}"`).header('ETag','"'+value.sha256+'"').header('Content-Length',String(value.bytes.length));
   return reply.send(Readable.from((async function*(){for(let offset=0;offset<value.bytes.length;offset+=16384){await yieldTurn();value.assert();yield value.bytes.subarray(offset,offset+16384);}})()));
  }catch(error){cleanup();throw error;}
 }});
 registerAuthenticatedRoute(runtime,{method:'GET',url:'/api/portable/imports',handle:(context,request)=>operations.listImports(context,request.query)});
 registerAuthenticatedRoute(runtime,{method:'POST',url:'/api/portable/imports',bodyLimit:operations.maxExportBytes+4096,handle:(context,request)=>{const body=z.object({operationId:z.string().uuid(),archive:z.unknown()}).strict().parse(request.body);return operations.importArchive(context,body.operationId,body.archive);}});
 registerAuthenticatedRoute(runtime,{method:'GET',url:'/api/portable/imports/:id',handle:(context,request)=>operations.importReceipt(context,id(request.params))});
 registerAuthenticatedRoute(runtime,{method:'POST',url:'/api/portable/imports/:id/cancel',handle:(context,request)=>{empty.parse(request.body??{});return operations.cancelImport(context,id(request.params));}});
 registerAuthenticatedRoute(runtime,{method:'DELETE',url:'/api/admin/accounts/:id',administrator:true,revokesSelf:(context,request)=>context.userId===id(request.params),handle:(context,request)=>operations.deleteAccount(context,id(request.params),z.object({operationId:z.string().uuid()}).strict().parse(request.body).operationId)});
 registerAuthenticatedRoute(runtime,{method:'GET',url:'/api/admin/account-deletions/:id',administrator:true,handle:(context,request)=>operations.deletionReceipt(context,id(request.params))});
 registerAuthenticatedRoute(runtime,{method:'POST',url:'/api/admin/account-deletions/:id/retry',administrator:true,handle:(context,request)=>{empty.parse(request.body??{});return operations.retryDeletion(context,id(request.params));}});
}
