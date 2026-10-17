import type {DatabaseSync} from 'node:sqlite';
import {ownerQuestionStateSchema,type OwnerQuestionReply} from '@mote/shared';
import {z} from 'zod';
import {registerUserRoute,type ScopedRuntime} from './http.js';
import {ScopedOwnerQuestions,OWNER_QUESTIONS_DOMAIN} from './owner-questions.js';
const querySchema=z.object({state:z.string().transform(value=>value.split(',')).pipe(z.array(ownerQuestionStateSchema).min(1).max(5)).optional(),operationId:z.string().max(512).optional(),operationIds:z.string().transform((value,ctx)=>{try{return JSON.parse(value);}catch{ctx.addIssue({code:z.ZodIssueCode.custom,message:'Invalid operation IDs'});return z.NEVER;}}).pipe(z.array(z.string().min(1).max(512)).min(1).max(100)).optional(),workId:z.string().max(512).optional(),materialId:z.string().max(256).optional(),limit:z.coerce.number().int().min(1).max(100).optional(),cursor:z.string().max(8192).optional()}).strict();
export function registerOwnerQuestions(runtime:ScopedRuntime,db:DatabaseSync){const host=new ScopedOwnerQuestions(runtime,db);
 registerUserRoute(runtime,{scope:'user',service:OWNER_QUESTIONS_DOMAIN,method:'GET',url:'/api/owner-questions',handle:({context,request})=>host.forUser(context).page(querySchema.parse(request.query))});
 registerUserRoute(runtime,{scope:'user',service:OWNER_QUESTIONS_DOMAIN,method:'GET',url:'/api/owner-questions/:id',handle:({context,request})=>host.forUser(context).get((request.params as {id:string}).id)});
 registerUserRoute(runtime,{scope:'user',service:OWNER_QUESTIONS_DOMAIN,method:'POST',url:'/api/owner-questions/:id/reply',handle:({context,request})=>host.forUser(context).reply((request.params as {id:string}).id,request.body as OwnerQuestionReply)});
 return host;}
