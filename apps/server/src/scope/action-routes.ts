import type {DatabaseSync} from 'node:sqlite';
import {z} from 'zod';
import {registerUserRoute,type ScopedRuntime} from './http.js';
import type {Configurations} from './configuration.js';
import type {TaskExecution} from './task-execution.js';
import type {ScopedOwnerQuestions} from './owner-questions.js';
import {ScopedActions} from './actions.js';
import {ACTIONS_DOMAIN} from './actions-schema.js';
export function registerScopedActions(runtime:ScopedRuntime,db:DatabaseSync,configuration:Configurations,execution:TaskExecution,questions:ScopedOwnerQuestions){
 const host=new ScopedActions(runtime,db,configuration,execution,questions),id=(params:unknown)=>z.object({id:z.string().uuid()}).parse(params).id;
 registerUserRoute(runtime,{scope:'user',service:ACTIONS_DOMAIN,method:'GET',url:'/api/actions',handle:({context,request})=>host.forUser(context).view(request.query)});
 registerUserRoute(runtime,{scope:'user',service:ACTIONS_DOMAIN,method:'PUT',url:'/api/actions/settings',handle:({context,request})=>host.forUser(context).saveSettings(request.body)});
 registerUserRoute(runtime,{scope:'user',service:ACTIONS_DOMAIN,method:'POST',url:'/api/actions/targets',handle:({context,request})=>host.forUser(context).registerTarget(request.body)});
 for(const method of ['review','confirm'] as const)registerUserRoute(runtime,{scope:'user',service:ACTIONS_DOMAIN,method:'POST',url:'/api/actions/:id/'+method,handle:({context,request})=>host.forUser(context)[method](id(request.params),request.body)});
 registerUserRoute(runtime,{scope:'user',service:ACTIONS_DOMAIN,method:'POST',url:'/api/actions/:id/dismiss',handle:({context,request})=>host.forUser(context).dismiss(id(request.params),z.object({version:z.number().int().positive()}).strict().parse(request.body).version)});
 return host;
}
