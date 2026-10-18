import {z} from 'zod';
import type {ScopedRuntime} from './http.js';
import {registerAuthenticatedRoute,registerUserRoute} from './http.js';
import {ScopedPluginHost,type PluginHostOptions,type UserPluginService} from './plugins.js';
import {PLUGINS_DOMAIN} from './plugin-contract.js';

/** Only the administrator catalog routes accept release locations. User routes
 * select installed package IDs and operate on host-owned instance receipts. */
export function registerScopedPlugins(runtime:ScopedRuntime,options:Omit<PluginHostOptions,'authority'|'services'>){
 const plugins=new ScopedPluginHost({...options,authority:runtime.authority,services:runtime.services});
 const id=(params:unknown)=>z.object({id:z.string().min(1)}).parse(params).id;
 registerAuthenticatedRoute(runtime,{method:'GET',url:'/api/admin/plugins',administrator:true,handle:context=>plugins.forAdministrator(context).view()});
 registerAuthenticatedRoute(runtime,{method:'POST',url:'/api/plugins/resolve',administrator:true,handle:(context,request)=>plugins.forAdministrator(context).resolve(request.body)});
 registerAuthenticatedRoute(runtime,{method:'POST',url:'/api/plugins/install',administrator:true,handle:(context,request)=>plugins.forAdministrator(context).install(request.body)});
 registerAuthenticatedRoute(runtime,{method:'POST',url:'/api/plugins/:id/uninstall',administrator:true,handle:(context,request)=>plugins.forAdministrator(context).uninstall(id(request.params),request.body)});
 registerUserRoute(runtime,{scope:'user',method:'GET',url:'/api/plugins',service:PLUGINS_DOMAIN,handle:({services})=>services.get<UserPluginService>(PLUGINS_DOMAIN).view()});
 registerUserRoute(runtime,{scope:'user',method:'POST',url:'/api/plugin-instances',service:PLUGINS_DOMAIN,handle:({services,request})=>{const body=z.object({instance:z.unknown(),expectedRevision:z.number().int().nonnegative(),preserveRedactedSecrets:z.boolean().optional()}).strict().parse(request.body);return services.get<UserPluginService>(PLUGINS_DOMAIN).configure(body.instance,body.expectedRevision,body.preserveRedactedSecrets);}});
 registerUserRoute(runtime,{scope:'user',method:'POST',url:'/api/plugin-instances/:id/check',service:PLUGINS_DOMAIN,handle:({services,request})=>services.get<UserPluginService>(PLUGINS_DOMAIN).startCheck(id(request.params))});
 for(const action of ['pause','disable','resume','enable','stop'] as const)registerUserRoute(runtime,{scope:'user',method:'POST',url:'/api/plugin-instances/:id/'+action,service:PLUGINS_DOMAIN,handle:({services,request})=>{const body=z.object({expectedRevision:z.number().int().nonnegative()}).strict().parse(request.body);return services.get<UserPluginService>(PLUGINS_DOMAIN).action(id(request.params),action,body.expectedRevision);}});
 registerUserRoute(runtime,{scope:'user',method:'POST',url:'/api/plugin-instances/:id/snapshots',service:PLUGINS_DOMAIN,handle:({services,request})=>{const body=z.object({mode:z.enum(['task','history']).default('task'),bindingRevision:z.number().int().positive().default(1)}).strict().parse(request.body);return services.get<UserPluginService>(PLUGINS_DOMAIN).admit(id(request.params),body.mode,body.bindingRevision);}});
 registerUserRoute(runtime,{scope:'user',method:'POST',url:'/api/plugin-snapshots/:id/invoke',service:PLUGINS_DOMAIN,handle:({services,request})=>{const body=z.object({componentId:z.string().min(1),payload:z.record(z.unknown()),operationId:z.string().min(1)}).strict().parse(request.body);return services.get<UserPluginService>(PLUGINS_DOMAIN).invoke(id(request.params),body.componentId,body.payload,body.operationId);}});
 registerUserRoute(runtime,{scope:'user',method:'POST',url:'/api/plugin-snapshots/:id/read',service:PLUGINS_DOMAIN,handle:({services,request})=>{const body=z.object({method:z.enum(['read','search','export']),params:z.record(z.unknown())}).strict().parse(request.body);return services.get<UserPluginService>(PLUGINS_DOMAIN).history(id(request.params),body.method,body.params);}});
 registerUserRoute(runtime,{scope:'user',method:'DELETE',url:'/api/plugin-snapshots/:id',service:PLUGINS_DOMAIN,handle:async({services,request})=>{await services.get<UserPluginService>(PLUGINS_DOMAIN).release(id(request.params));return {released:true};}});
 registerUserRoute(runtime,{scope:'user',method:'GET',url:'/api/plugin-events',service:PLUGINS_DOMAIN,handle:({services,request})=>{const query=z.object({since:z.coerce.number().int().nonnegative().default(0)}).strict().parse(request.query);return {items:services.get<UserPluginService>(PLUGINS_DOMAIN).events(query.since)};}});
 return plugins;
}
