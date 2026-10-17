import {z} from 'zod';
import {registerAuthenticatedRoute,type ScopedRuntime} from './http.js';
import type {LifecycleOperations} from './lifecycle-operations.js';
const id=(value:unknown)=>z.object({id:z.string().uuid()}).parse(value).id;
const empty=z.object({}).strict();
export function registerLifecycleRoutes(runtime:ScopedRuntime,operations:LifecycleOperations){
 registerAuthenticatedRoute(runtime,{method:'GET',url:'/api/portable/imports',handle:(context,request)=>operations.listImports(context,request.query)});
 registerAuthenticatedRoute(runtime,{method:'POST',url:'/api/portable/imports',bodyLimit:operations.maxExportBytes+4096,handle:(context,request)=>{const body=z.object({operationId:z.string().uuid(),archive:z.unknown()}).strict().parse(request.body);return operations.importArchive(context,body.operationId,body.archive);}});
 registerAuthenticatedRoute(runtime,{method:'GET',url:'/api/portable/imports/:id',handle:(context,request)=>operations.importReceipt(context,id(request.params))});
 registerAuthenticatedRoute(runtime,{method:'POST',url:'/api/portable/imports/:id/cancel',handle:(context,request)=>{empty.parse(request.body??{});return operations.cancelImport(context,id(request.params));}});
 registerAuthenticatedRoute(runtime,{method:'GET',url:'/api/portable/exports',handle:(context,request)=>operations.listExports(context,request.query)});
 registerAuthenticatedRoute(runtime,{method:'POST',url:'/api/portable/exports',handle:(context,request)=>operations.export(context,z.object({operationId:z.string().uuid()}).strict().parse(request.body).operationId)});
 registerAuthenticatedRoute(runtime,{method:'GET',url:'/api/portable/exports/:id',handle:(context,request)=>operations.exportReceipt(context,id(request.params))});
 registerAuthenticatedRoute(runtime,{method:'POST',url:'/api/portable/exports/:id/retry',handle:(context,request)=>{empty.parse(request.body??{});return operations.retryExport(context,id(request.params));}});
 registerAuthenticatedRoute(runtime,{method:'POST',url:'/api/portable/exports/:id/cancel',handle:(context,request)=>{empty.parse(request.body??{});return operations.cancelExport(context,id(request.params));}});
 registerAuthenticatedRoute(runtime,{method:'GET',url:'/api/portable/exports/:id/content',handle:(context,request,reply)=>{
  const {bytes,sha256,filename}=operations.content(context,id(request.params)),etag='"'+sha256+'"',range=request.headers.range;
  reply.header('Content-Type','application/json; charset=utf-8').header('Content-Disposition',`attachment; filename="${filename}"`).header('ETag',etag).header('Accept-Ranges','bytes');
  let start=0,end=bytes.length-1;
  if(range&&(!request.headers['if-range']||request.headers['if-range']===etag)){
   const match=/^bytes=(\d*)-(\d*)$/.exec(range),a=match?.[1]?Number(match[1]):undefined,b=match?.[2]?Number(match[2]):undefined;
   if(!match||a===undefined&&b===undefined||a!==undefined&&!Number.isSafeInteger(a)||b!==undefined&&!Number.isSafeInteger(b)||a===undefined&&b===0){reply.header('Content-Range',`bytes */${bytes.length}`);return reply.code(416).send({error:'invalid_range'});}
   start=a??Math.max(0,bytes.length-b!);end=a===undefined?bytes.length-1:Math.min(b??end,end);
   if(start>=bytes.length||end<start){reply.header('Content-Range',`bytes */${bytes.length}`);return reply.code(416).send({error:'invalid_range'});}
   reply.code(206).header('Content-Range',`bytes ${start}-${end}/${bytes.length}`);
  }
  runtime.authority.assert(context);return reply.header('Content-Length',String(end-start+1)).send(bytes.subarray(start,end+1));
 }});
 registerAuthenticatedRoute(runtime,{method:'DELETE',url:'/api/admin/accounts/:id',administrator:true,revokesSelf:(context,request)=>context.userId===id(request.params),handle:(context,request)=>operations.deleteAccount(context,id(request.params),z.object({operationId:z.string().uuid()}).strict().parse(request.body).operationId)});
 registerAuthenticatedRoute(runtime,{method:'GET',url:'/api/admin/account-deletions/:id',administrator:true,handle:(context,request)=>operations.deletionReceipt(context,id(request.params))});
 registerAuthenticatedRoute(runtime,{method:'POST',url:'/api/admin/account-deletions/:id/retry',administrator:true,handle:(context,request)=>{empty.parse(request.body??{});return operations.retryDeletion(context,id(request.params));}});
}
