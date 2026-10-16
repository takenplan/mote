import type {DatabaseSync} from 'node:sqlite';
import {z} from 'zod';
import {registerUserRoute,type ScopedRuntime} from './http.js';
import type {Configurations} from './configuration.js';
import type {TaskExecution} from './task-execution.js';
import type {ScopedOwnerQuestions} from './owner-questions.js';
import {ScopedActions} from './actions.js';
import {ACTIONS_DOMAIN} from './actions-schema.js';
import type {AskHost} from './ask.js';
import type {IngressHost} from './ingress.js';
import {ActionSettingsSaveError} from '../action-contract.js';
export function registerScopedActions(runtime:ScopedRuntime,db:DatabaseSync,configuration:Configurations,execution:TaskExecution,questions:ScopedOwnerQuestions,ask:AskHost,ingress:IngressHost){
 const host=new ScopedActions(runtime,db,configuration,execution,questions,ask,ingress),id=(params:unknown)=>z.object({id:z.string().uuid()}).parse(params).id;
 registerUserRoute(runtime,{scope:'user',service:ACTIONS_DOMAIN,method:'GET',url:'/api/actions',handle:({context,request})=>host.forUser(context).view(request.query)});
 registerUserRoute(runtime,{scope:'user',service:ACTIONS_DOMAIN,method:'PUT',url:'/api/actions/settings',handle:async({context,request,reply})=>{try{return await host.forUser(context).saveSettings(request.body);}catch(error){runtime.authority.assert(context);if(!(error instanceof ActionSettingsSaveError))throw error;reply.code(error.statusCode);return {error:error.code,authorizationRevoked:true,revokedDeviceIds:error.revokedDeviceIds,authorizationRevision:error.authorizationRevision};}}});
 registerUserRoute(runtime,{scope:'user',service:ACTIONS_DOMAIN,method:'GET',url:'/api/actions/:id/reviews/:questionId',handle:({context,request})=>{const args=z.object({id:z.string().uuid(),questionId:z.string().uuid()}).strict().parse(request.params);return host.reviewDetails(context,args.id,args.questionId);}});
 registerUserRoute(runtime,{scope:'user',service:ACTIONS_DOMAIN,method:'POST',url:'/api/actions/targets',handle:({context,request})=>host.forUser(context).registerTarget(request.body)});
 registerUserRoute(runtime,{scope:'user',service:ACTIONS_DOMAIN,method:'POST',url:'/api/actions/retry',handle:({context})=>host.forUser(context).retry()});
 registerUserRoute(runtime,{scope:'user',service:ACTIONS_DOMAIN,method:'GET',url:'/api/actions/deliveries',handle:({context,request})=>host.delivery.deliveries(context,z.object({deviceId:z.string().min(1).max(200)}).strict().parse(request.query).deviceId)});
 registerUserRoute(runtime,{scope:'user',service:ACTIONS_DOMAIN,method:'POST',url:'/api/actions/:id/claim',handle:({context,request})=>host.delivery.claim(context,id(request.params),z.object({deviceId:z.string().min(1).max(200)}).strict().parse(request.body).deviceId)});
 registerUserRoute(runtime,{scope:'user',service:ACTIONS_DOMAIN,method:'POST',url:'/api/actions/:id/receipt',handle:({context,request})=>{const {deviceId,...receipt}=z.object({deviceId:z.string().min(1).max(200),operationId:z.string().uuid(),status:z.enum(['succeeded','uncertain']),externalId:z.string().min(1).max(2000).optional()}).strict().parse(request.body);return host.delivery.receipt(context,id(request.params),deviceId,receipt);}});
 registerUserRoute(runtime,{scope:'user',service:ACTIONS_DOMAIN,method:'POST',url:'/api/actions/:id/cancel',handle:({context,request})=>host.delivery.cancel(context,id(request.params),z.object({version:z.number().int().positive()}).strict().parse(request.body).version)});
 for(const method of ['review','confirm'] as const)registerUserRoute(runtime,{scope:'user',service:ACTIONS_DOMAIN,method:'POST',url:'/api/actions/:id/'+method,handle:({context,request})=>host.forUser(context)[method](id(request.params),request.body)});
 registerUserRoute(runtime,{scope:'user',service:ACTIONS_DOMAIN,method:'POST',url:'/api/actions/:id/dismiss',handle:({context,request})=>host.forUser(context).dismiss(id(request.params),z.object({version:z.number().int().positive()}).strict().parse(request.body).version)});
 return host;
}
