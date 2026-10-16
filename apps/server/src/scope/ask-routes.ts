import {randomUUID} from 'node:crypto';
import type {DatabaseSync} from 'node:sqlite';
import {z} from 'zod';
import {registerUserRoute,type ScopedRuntime} from './http.js';
import {AskHost} from './ask.js';
import {ASK_DOMAIN,askInputSchema} from './ask-schema.js';
import type {Configurations} from './configuration.js';
import type {TaskExecution} from './task-execution.js';
import type {IngressHost} from './ingress.js';
import type {MemoryHost} from './memory.js';

export function registerAsk(runtime:ScopedRuntime,db:DatabaseSync,configuration:Configurations,execution:TaskExecution,ingress:IngressHost,memory:MemoryHost){
 const host=new AskHost(runtime,db,configuration,execution,ingress,memory),service=(context:Parameters<AskHost['bind']>[0])=>host.bind(context,{assertCurrent:()=>runtime.authority.assert(context)}),id=(request:{params:unknown})=>z.object({id:z.string().uuid()}).parse(request.params).id;
 registerUserRoute(runtime,{scope:'user',service:ASK_DOMAIN,method:'POST',url:'/api/query',handle:({context,request})=>service(context).query(askInputSchema.parse(request.body))});
 registerUserRoute(runtime,{scope:'user',service:ASK_DOMAIN,method:'POST',url:'/api/query-runs',handle:({context,request})=>{const body=z.object({id:z.string().uuid(),input:askInputSchema}).strict().parse(request.body);return service(context).start(body.id,body.input);}});
 registerUserRoute(runtime,{scope:'user',service:ASK_DOMAIN,method:'GET',url:'/api/query-runs',handle:({context,request})=>service(context).list(request.query)});
 registerUserRoute(runtime,{scope:'user',service:ASK_DOMAIN,method:'GET',url:'/api/query-runs/:id',handle:({context,request})=>service(context).get(id(request))});
 for(const action of ['cancel','pause','resume'] as const)registerUserRoute(runtime,{scope:'user',service:ASK_DOMAIN,method:'POST',url:'/api/query-runs/:id/'+action,handle:({context,request})=>service(context)[action](id(request))});
 registerUserRoute(runtime,{scope:'user',service:ASK_DOMAIN,method:'GET',url:'/api/query-runs/:id/traces',handle:({context,request})=>service(context).traces(id(request))});
 registerUserRoute(runtime,{scope:'user',service:ASK_DOMAIN,method:'POST',url:'/api/conversations',handle:({context,request})=>service(context).createConversation(request.body??{})});
 registerUserRoute(runtime,{scope:'user',service:ASK_DOMAIN,method:'GET',url:'/api/conversations',handle:({context})=>service(context).conversations()});
 registerUserRoute(runtime,{scope:'user',service:ASK_DOMAIN,method:'GET',url:'/api/conversations/:id',handle:({context,request})=>service(context).conversation(id(request))});
 registerUserRoute(runtime,{scope:'user',service:ASK_DOMAIN,method:'DELETE',url:'/api/conversations/:id',handle:({context,request})=>service(context).deleteConversation(id(request))});
 registerUserRoute(runtime,{scope:'user',service:ASK_DOMAIN,method:'POST',url:'/api/conversations/:id/compact',handle:({context,request})=>service(context).compact(id(request))});
 registerUserRoute(runtime,{scope:'user',service:ASK_DOMAIN,method:'POST',url:'/api/insights',handle:({context,request})=>service(context).insight(askInputSchema.parse(request.body))});
 registerUserRoute(runtime,{scope:'user',service:ASK_DOMAIN,method:'POST',url:'/api/insight-runs',handle:({context,request})=>{const body=z.object({requestId:z.string().uuid(),...askInputSchema.innerType().shape}).strict().parse(request.body),{requestId,...input}=body;return service(context).start(requestId,input,'insight');}});
 registerUserRoute(runtime,{scope:'user',service:ASK_DOMAIN,method:'GET',url:'/api/insight-runs',handle:({context,request})=>service(context).list(request.query)});
 registerUserRoute(runtime,{scope:'user',service:ASK_DOMAIN,method:'GET',url:'/api/insight-runs/:id',handle:({context,request})=>service(context).get(id(request))});
 registerUserRoute(runtime,{scope:'user',service:ASK_DOMAIN,method:'POST',url:'/api/insight-runs/:id/cancel',handle:({context,request})=>service(context).cancel(id(request))});
 registerUserRoute(runtime,{scope:'user',service:ASK_DOMAIN,method:'GET',url:'/api/ask-artifacts/:id',handle:({context,request})=>service(context).artifact(z.object({id:z.string().regex(/^[a-f0-9]{64}$/)}).parse(request.params).id)});
 return host;
}
