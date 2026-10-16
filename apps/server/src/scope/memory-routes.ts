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
 registerUserRoute(runtime,{scope:'user',service:MEMORY_DOMAIN,method:'GET',url:'/api/memories',handle:({context,request})=>service(context).page(z.object({query:z.string().optional(),cursor:z.string().optional(),limit:z.coerce.number().optional(),includeHistory:z.enum(['true','false']).transform(value=>value==='true').optional()}).strict().parse(request.query))});
 registerUserRoute(runtime,{scope:'user',service:MEMORY_DOMAIN,method:'GET',url:'/api/memories/:id',handle:({context,request})=>service(context).read((request.params as {id:string}).id)});
 registerUserRoute(runtime,{scope:'user',service:MEMORY_DOMAIN,method:'DELETE',url:'/api/memories/:id',handle:({context,request})=>service(context).delete((request.params as {id:string}).id)});
 registerUserRoute(runtime,{scope:'user',service:MEMORY_DOMAIN,method:'POST',url:'/api/memory/bindings',handle:({context,request})=>host.bindings.prepare(context,request.body)});
 registerUserRoute(runtime,{scope:'user',service:MEMORY_DOMAIN,method:'GET',url:'/api/memory/bindings/:id',handle:({context,request})=>host.bindings.view(context,(request.params as {id:string}).id)});
 registerUserRoute(runtime,{scope:'user',service:MEMORY_DOMAIN,method:'POST',url:'/api/memory/bindings/:id/activate',handle:({context,request})=>host.bindings.activate(context,(request.params as {id:string}).id,request.body)});
 registerUserRoute(runtime,{scope:'user',service:MEMORY_DOMAIN,method:'POST',url:'/api/memory/bindings/:id/cancel',handle:({context,request})=>host.bindings.cancel(context,(request.params as {id:string}).id)});
 return host;
}
