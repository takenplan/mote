import {memoryPageSchema} from './memory-data.js';
import type {DatabaseSync} from 'node:sqlite';
import {z} from 'zod';
import {registerUserRoute,type ScopedRuntime} from './http.js';
import type {Configurations} from './configuration.js';
import type {TaskExecution} from './task-execution.js';
import type {ScopedPluginHost} from './plugins.js';
import type {MemoryProviderOptions} from './memory-providers.js';
import {MemoryHost} from './memory.js';
import {MEMORY_DOMAIN} from './memory-schema.js';

export function registerMemory(runtime:ScopedRuntime,db:DatabaseSync,configuration:Configurations,execution:TaskExecution,plugins:ScopedPluginHost,providerOptions:MemoryProviderOptions={}){
 const host=new MemoryHost(runtime,db,configuration,execution,plugins,providerOptions),service=(context:Parameters<MemoryHost['forUser']>[0])=>host.forUser(context);
 registerUserRoute(runtime,{scope:'user',service:MEMORY_DOMAIN,method:'GET',url:'/api/memory',handle:({context})=>service(context).view()});
 registerUserRoute(runtime,{scope:'user',service:MEMORY_DOMAIN,method:'POST',url:'/api/memory/jobs',handle:({context,request})=>service(context).submit(request.body)});
 registerUserRoute(runtime,{scope:'user',service:MEMORY_DOMAIN,method:'GET',url:'/api/memory/jobs/:id',handle:({context,request})=>service(context).job((request.params as {id:string}).id)});
 registerUserRoute(runtime,{scope:'user',service:MEMORY_DOMAIN,method:'POST',url:'/api/memory/jobs/:id/cancel',handle:({context,request})=>service(context).cancel((request.params as {id:string}).id)});
 for(const kind of ['pause','resume','stop'] as const)registerUserRoute(runtime,{scope:'user',service:MEMORY_DOMAIN,method:'POST',url:'/api/memory/'+kind,handle:({context,request})=>service(context).control(kind,request.body)});
 registerUserRoute(runtime,{scope:'user',service:MEMORY_DOMAIN,method:'GET',url:'/api/memories',handle:({context,request})=>service(context).page(memoryPageSchema.parse(Object.fromEntries(Object.entries(request.query as Record<string,unknown>).map(([key,value])=>[key,['includeHistory','includeStale'].includes(key)&&['true','false'].includes(String(value))?value==='true':value]))))});
 registerUserRoute(runtime,{scope:'user',service:MEMORY_DOMAIN,method:'POST',url:'/api/memory/reconcile',handle:({context})=>service(context).reconcile()});
 registerUserRoute(runtime,{scope:'user',service:MEMORY_DOMAIN,method:'GET',url:'/api/memories/:id/versions/:version',handle:({context,request})=>{const input=z.object({id:z.string().uuid(),version:z.coerce.number().int().positive()}).parse(request.params);return service(context).readVersion(input.id,input.version);}});
 registerUserRoute(runtime,{scope:'user',service:MEMORY_DOMAIN,method:'GET',url:'/api/memories/:id',handle:({context,request})=>service(context).read((request.params as {id:string}).id)});
 registerUserRoute(runtime,{scope:'user',service:MEMORY_DOMAIN,method:'POST',url:'/api/memories/:id/correct',handle:({context,request})=>service(context).correct((request.params as {id:string}).id,request.body)});
 registerUserRoute(runtime,{scope:'user',service:MEMORY_DOMAIN,method:'DELETE',url:'/api/memories/:id',handle:({context,request})=>service(context).delete((request.params as {id:string}).id)});
 registerUserRoute(runtime,{scope:'user',service:MEMORY_DOMAIN,method:'POST',url:'/api/memory/bindings',handle:({context,request})=>host.bindings.prepare(context,request.body)});
 registerUserRoute(runtime,{scope:'user',service:MEMORY_DOMAIN,method:'GET',url:'/api/memory/bindings/:id',handle:({context,request})=>host.bindings.view(context,(request.params as {id:string}).id)});
 registerUserRoute(runtime,{scope:'user',service:MEMORY_DOMAIN,method:'POST',url:'/api/memory/bindings/:id/activate',handle:({context,request})=>host.bindings.activate(context,(request.params as {id:string}).id,request.body)});
 registerUserRoute(runtime,{scope:'user',service:MEMORY_DOMAIN,method:'POST',url:'/api/memory/bindings/:id/cancel',handle:async({context,request})=>{const result=host.bindings.cancel(context,(request.params as {id:string}).id);await service(context).reconcile();return result;}});
 return host;
}
