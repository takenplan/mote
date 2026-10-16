import type {DatabaseSync} from 'node:sqlite';
import {z} from 'zod';
import {registerUserRoute,type ScopedRuntime} from './http.js';
import type {Configurations} from './configuration.js';
import type {TaskExecution} from './task-execution.js';
import type {IngressHost} from './ingress.js';
import type {ScopedPluginHost} from './plugins.js';
import {ProcessingHost,PROCESSING_DOMAIN} from './processing.js';

export function registerProcessing(runtime:ScopedRuntime,db:DatabaseSync,configuration:Configurations,execution:TaskExecution,ingress:IngressHost,plugins:ScopedPluginHost){
 const host=new ProcessingHost(runtime,db,configuration,execution,ingress,plugins);
 const service=(services:ReturnType<ScopedRuntime['services']['forUser']>)=>services.get<ReturnType<ProcessingHost['forUser']>>(PROCESSING_DOMAIN);
 registerUserRoute(runtime,{scope:'user',method:'GET',url:'/api/processing',service:PROCESSING_DOMAIN,handle:({services})=>service(services).view()});
 registerUserRoute(runtime,{scope:'user',method:'POST',url:'/api/processing/derivations',service:PROCESSING_DOMAIN,handle:({services,request})=>service(services).derive(request.body)});
 registerUserRoute(runtime,{scope:'user',method:'POST',url:'/api/processing',service:PROCESSING_DOMAIN,handle:({services,request})=>service(services).submit(request.body)});
 registerUserRoute(runtime,{scope:'user',method:'GET',url:'/api/processing/originals/:id',service:PROCESSING_DOMAIN,handle:({services,request})=>service(services).status('original:'+z.object({id:z.string().regex(/^[a-f0-9]{64}$/)}).parse(request.params).id)});
 registerUserRoute(runtime,{scope:'user',method:'GET',url:'/api/processing/artifacts/:id',service:PROCESSING_DOMAIN,handle:({services,request})=>service(services).artifact(z.object({id:z.string().regex(/^[a-f0-9]{64}$/)}).parse(request.params).id)});
 return host;
}
