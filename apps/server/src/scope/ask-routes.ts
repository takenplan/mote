import type {FastifyRequest,FastifyReply} from 'fastify';
import type {DatabaseSync} from 'node:sqlite';
import {z} from 'zod';
import {registerUserRoute,type ScopedRuntime} from './http.js';
import {AskHost} from './ask.js';
import {registerAskReadRoutes} from './ask-read-routes.js';
import {ASK_DOMAIN,askInputSchema,insightInputSchema} from './ask-schema.js';
import type {Configurations} from './configuration.js';
import type {TaskExecution} from './task-execution.js';
import type {IngressHost} from './ingress.js';
import type {MemoryHost} from './memory.js';

/** Client disconnect is an actual request cancellation, not a durable background
 * admission. Provider SSE and M05 late commits inherit this same signal. */
async function duringRequest<T>(request:FastifyRequest,reply:FastifyReply,work:(signal:AbortSignal)=>Promise<T>){const controller=new AbortController(),abort=()=>controller.abort(),closed=()=>{if(!reply.raw.writableEnded)abort();};request.raw.once('aborted',abort);reply.raw.once('close',closed);try{return await work(controller.signal);}finally{request.raw.removeListener('aborted',abort);reply.raw.removeListener('close',closed);}}

export function registerAsk(runtime:ScopedRuntime,db:DatabaseSync,configuration:Configurations,execution:TaskExecution,ingress:IngressHost,memory:MemoryHost){
 const host=new AskHost(runtime,db,configuration,execution,ingress,memory),service=(context:Parameters<AskHost['bind']>[0])=>host.bind(context,{assertCurrent:()=>runtime.authority.assert(context)}),id=(request:{params:unknown})=>z.object({id:z.string().uuid()}).parse(request.params).id;
 registerUserRoute(runtime,{scope:'user',service:ASK_DOMAIN,method:'POST',url:'/api/query',handle:({context,request,reply})=>duringRequest(request,reply,signal=>service(context).query(askInputSchema.parse(request.body),{signal}))});
 registerUserRoute(runtime,{scope:'user',service:ASK_DOMAIN,method:'POST',url:'/api/query-runs',handle:({context,request})=>{const body=z.object({id:z.string().uuid(),input:askInputSchema}).strict().parse(request.body);return service(context).start(body.id,body.input);}});
 registerUserRoute(runtime,{scope:'user',service:ASK_DOMAIN,method:'GET',url:'/api/query-runs',handle:({context,request})=>service(context).list(request.query,'chat')});
 registerUserRoute(runtime,{scope:'user',service:ASK_DOMAIN,method:'GET',url:'/api/query-runs/:id',handle:({context,request})=>service(context).get(id(request))});
 for(const action of ['cancel','pause','resume'] as const)registerUserRoute(runtime,{scope:'user',service:ASK_DOMAIN,method:'POST',url:'/api/query-runs/:id/'+action,handle:({context,request})=>service(context)[action](id(request))});
 registerUserRoute(runtime,{scope:'user',service:ASK_DOMAIN,method:'GET',url:'/api/query-runs/:id/traces',handle:({context,request})=>service(context).traces(id(request))});
 registerUserRoute(runtime,{scope:'user',service:ASK_DOMAIN,method:'POST',url:'/api/conversations',handle:({context,request})=>service(context).createConversation(request.body??{})});
 registerUserRoute(runtime,{scope:'user',service:ASK_DOMAIN,method:'GET',url:'/api/conversations',handle:({context,request})=>service(context).conversations(request.query)});
 registerUserRoute(runtime,{scope:'user',service:ASK_DOMAIN,method:'GET',url:'/api/conversations/:id',handle:({context,request})=>service(context).conversation(id(request),request.query)});
 registerUserRoute(runtime,{scope:'user',service:ASK_DOMAIN,method:'DELETE',url:'/api/conversations/:id',handle:({context,request})=>service(context).deleteConversation(id(request))});
 registerUserRoute(runtime,{scope:'user',service:ASK_DOMAIN,method:'POST',url:'/api/conversations/:id/compact',handle:({context,request,reply})=>duringRequest(request,reply,signal=>service(context).compact(id(request),{signal}))});
 registerUserRoute(runtime,{scope:'user',service:ASK_DOMAIN,method:'POST',url:'/api/insights',handle:({context,request,reply})=>duringRequest(request,reply,signal=>service(context).insight(insightInputSchema.parse(request.body??{}),{signal}))});
 registerUserRoute(runtime,{scope:'user',service:ASK_DOMAIN,method:'POST',url:'/api/insight-runs',handle:({context,request})=>{const body=z.object({requestId:z.string().uuid()}).passthrough().parse(request.body),{requestId,...raw}=body,input=insightInputSchema.parse(raw);return service(context).start(requestId,input,'insight');}});
 registerUserRoute(runtime,{scope:'user',service:ASK_DOMAIN,method:'GET',url:'/api/insight-runs',handle:({context,request})=>service(context).list(request.query,'insight')});
 registerUserRoute(runtime,{scope:'user',service:ASK_DOMAIN,method:'GET',url:'/api/insight-runs/:id',handle:({context,request})=>service(context).get(id(request))});
 registerUserRoute(runtime,{scope:'user',service:ASK_DOMAIN,method:'POST',url:'/api/insight-runs/:id/cancel',handle:({context,request})=>service(context).cancel(id(request))});
 registerUserRoute(runtime,{scope:'user',service:ASK_DOMAIN,method:'GET',url:'/api/insights',handle:({context,request})=>{const page=service(context).list(request.query,'insight',true);return {...page,items:page.items.map(item=>({id:item.id,...item.result as object}))};}});
 registerUserRoute(runtime,{scope:'user',service:ASK_DOMAIN,method:'GET',url:'/api/ask-artifacts/:id',handle:({context,request})=>service(context).artifact(z.object({id:z.string().regex(/^[a-f0-9]{64}$/)}).parse(request.params).id)});
 registerUserRoute(runtime,{scope:'user',service:ASK_DOMAIN,method:'POST',url:'/api/ask-automations',handle:({context,request})=>host.automations.forUser(context).admit(request.body)});
 registerUserRoute(runtime,{scope:'user',service:ASK_DOMAIN,method:'GET',url:'/api/ask-automations',handle:({context})=>host.automations.forUser(context).list()});
 registerUserRoute(runtime,{scope:'user',service:ASK_DOMAIN,method:'GET',url:'/api/ask-automations/:id',handle:({context,request})=>host.automations.forUser(context).get(id(request))});
 for(const action of ['pause','resume','stop','retry'] as const)registerUserRoute(runtime,{scope:'user',service:ASK_DOMAIN,method:'POST',url:'/api/ask-automations/:id/'+action,handle:({context,request})=>host.automations.forUser(context)[action](id(request),z.object({expectedGeneration:z.string().uuid().optional()}).strict().parse(request.body??{}).expectedGeneration)});
 registerAskReadRoutes(runtime,host);
 return host;
}
