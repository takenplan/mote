import {randomUUID} from 'node:crypto';
import type {DatabaseSync} from 'node:sqlite';
import {installTodos,todosDeleted} from './todo-schema.js';
import {z} from 'zod';
import {todoInput,todoFields,archivedTodoSchema,type Todo} from '../todo-contract.js';
import {askHash} from './ask-schema.js';
import {PrivateSql,PrivateCursor,PrivateDataError,missing} from './private-data-sql.js';
import {AskEvidence} from './ask-evidence.js';
import type {PrivateData} from './private-data.js';
import {registerUserRoute,type ScopedRuntime} from './http.js';
import type {UserContext} from './context.js';
import type {DomainLifecycle,UserDataSubject} from './lifecycle.js';

export const TODOS_DOMAIN='todos';
const updateSchema=z.object({version:z.number().int().positive(),title:todoFields.title.optional(),description:todoFields.description.optional(),dueAt:todoFields.dueAt.optional(),evidenceIds:todoFields.evidenceIds.optional(),status:z.enum(['open','completed','cancelled']).optional()}).strict();
/** Manual local tasks reuse the existing field/CAS contract. They never acquire
 * calendar approval or invoke external writes. */
export class ScopedTodos{
 private readonly cursorKey:string;
 constructor(private readonly runtime:ScopedRuntime,private readonly db:DatabaseSync){
  this.cursorKey=installTodos(db);
  runtime.services.registerUser(TODOS_DOMAIN,{scope:'user',create:context=>this.forUser(context),lifecycle:this.lifecycle()});
 }
 private sql(context:UserContext){return new PrivateSql(this.db,context.userId,()=>{this.runtime.authority.assert(context);if(todosDeleted(this.db,context.userId))throw new PrivateDataError('scope_unavailable',503);});}
 forUser(context:UserContext){const sql=this.sql(context),codec=new PrivateCursor(this.cursorKey,context.deploymentId,context.userId),get=(id:string):Todo=>{const row=sql.get('SELECT json FROM td_todos WHERE user_id=$user AND id=?',id);if(!row)throw missing();return JSON.parse(String(row.json));},evidence=(ids:string[])=>{if(new Set(ids).size!==ids.length)throw new PrivateDataError('invalid_data');const reader=new AskEvidence(sql,this.runtime.services.forUser(context).get<PrivateData>('private-data'),codec,{assertCurrent:()=>this.runtime.authority.assert(context)});reader.evidence(ids);};
  return Object.freeze({get,create:(raw:unknown)=>sql.transaction(()=>{const input=todoInput.parse(raw),id=input.id??randomUUID(),hash=askHash(input),old=sql.get('SELECT request_hash FROM td_todos WHERE user_id=$user AND id=?',id);if(old){if(old.request_hash!==hash)throw new PrivateDataError('conflict',409);return get(id);}evidence(input.evidenceIds);const at=new Date().toISOString(),task:Todo={...input,id,status:'open',version:1,createdAt:at,updatedAt:at};sql.run('INSERT INTO td_todos VALUES($user,?,?,?,?,?,?)',id,at,task.status,1,hash,JSON.stringify(task));return task;}),
   update:(id:string,raw:unknown)=>sql.transaction(()=>{const input=updateSchema.parse(raw),prior=get(id);if(prior.version!==input.version)throw new PrivateDataError('conflict',409);if(input.evidenceIds)evidence(input.evidenceIds);const task={...prior,...input,version:prior.version+1,updatedAt:new Date().toISOString()};if(!sql.run('UPDATE td_todos SET json=?,version=?,status=? WHERE user_id=$user AND id=? AND version=?',JSON.stringify(task),task.version,task.status,id,input.version).changes)throw new PrivateDataError('conflict',409);return task;}),
   page:(raw:unknown={})=>{const {cursor,...query}=z.object({status:z.enum(['open','completed','cancelled']).optional(),cursor:z.string().max(8192).optional(),limit:z.coerce.number().int().min(1).max(100).default(30)}).strict().parse(raw),identity={collection:'todos',...query},position=cursor?codec.decode(cursor,identity):undefined,rows=sql.all('SELECT json FROM td_todos WHERE user_id=$user AND (? IS NULL OR status=?) AND (created_at<? OR(created_at=? AND id<?)) ORDER BY created_at DESC,id DESC LIMIT ?',query.status??null,query.status??null,position?.at??'9999',position?.at??'9999',position?.id??'',query.limit+1),items=rows.slice(0,query.limit).map(row=>JSON.parse(String(row.json)) as Todo),last=items.at(-1);return {items,nextCursor:rows.length>query.limit&&last?codec.encode(identity,{at:last.createdAt,id:last.id}):null};},
  });
 }
 private lifecycle():DomainLifecycle{const data=(subject:UserDataSubject,purpose:'export'|'delete'|'restore')=>new PrivateSql(this.db,subject.userId,()=>this.runtime.services.assertSubject(subject,TODOS_DOMAIN,purpose));const restore=(subject:UserDataSubject,archive:import('./lifecycle.js').UserExport,operationId:string)=>{if(archive.domain!==TODOS_DOMAIN||archive.version!==1||archive.userId!==subject.userId||archive.deploymentId!==subject.deploymentId)throw new PrivateDataError('invalid_data');const input=z.object({todos:z.array(archivedTodoSchema)}).strict().parse(archive.payload),sql=data(subject,'restore'),hash=askHash(input);if(new Set(input.todos.map(task=>task.id)).size!==input.todos.length)throw new PrivateDataError('invalid_data');sql.transaction(()=>{const old=sql.get('SELECT hash FROM td_restore WHERE user_id=$user AND id=?',operationId);if(old){if(old.hash!==hash)throw new PrivateDataError('conflict',409);return;}for(const {requestHash,...task} of input.todos){const prior=sql.get('SELECT json,request_hash FROM td_todos WHERE user_id=$user AND id=?',task.id);if(prior){const current=archivedTodoSchema.parse({...JSON.parse(String(prior.json)),requestHash:prior.request_hash});if(askHash(current)!==askHash({...task,requestHash}))throw new PrivateDataError('conflict',409);continue;}sql.run('INSERT INTO td_todos VALUES($user,?,?,?,?,?,?)',task.id,task.createdAt,task.status,task.version,requestHash,JSON.stringify(task));}sql.run('INSERT INTO td_state VALUES($user,0) ON CONFLICT(user_id) DO UPDATE SET deleted=0');sql.run('INSERT INTO td_restore VALUES($user,?,?)',operationId,hash);});};return {
  importUser:restore,
  exportUser:async subject=>({domain:TODOS_DOMAIN,version:1,userId:subject.userId,deploymentId:subject.deploymentId,payload:{todos:data(subject,'export').all('SELECT * FROM td_todos WHERE user_id=$user ORDER BY id').map(row=>({...JSON.parse(String(row.json)),requestHash:row.request_hash}))}}),
  deleteUser:async(subject,operationId)=>{const sql=data(subject,'delete');return sql.transaction(()=>{sql.run('INSERT INTO td_state VALUES($user,1) ON CONFLICT(user_id) DO UPDATE SET deleted=1');sql.run('DELETE FROM td_todos WHERE user_id=$user');sql.run('DELETE FROM td_restore WHERE user_id=$user');return {status:'complete',operationId};});},
  restoreUser:async(subject,archive,operationId)=>{restore(subject,archive,operationId);},
 };}
}
export function registerScopedTodos(runtime:ScopedRuntime,db:DatabaseSync){const host=new ScopedTodos(runtime,db),id=(params:unknown)=>z.object({id:z.string().uuid()}).parse(params).id;
 registerUserRoute(runtime,{scope:'user',service:TODOS_DOMAIN,method:'GET',url:'/api/todos',handle:({context,request})=>host.forUser(context).page(request.query)});
 registerUserRoute(runtime,{scope:'user',service:TODOS_DOMAIN,method:'POST',url:'/api/todos',handle:({context,request,reply})=>reply.code(201).send(host.forUser(context).create(request.body))});
 registerUserRoute(runtime,{scope:'user',service:TODOS_DOMAIN,method:'PATCH',url:'/api/todos/:id',handle:({context,request})=>host.forUser(context).update(id(request.params),request.body)});return host;
}
