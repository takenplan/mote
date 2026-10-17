import type {DatabaseSync} from 'node:sqlite';
import {z} from 'zod';
import type {UserContext} from './context.js';
import {PrivateCursor,PrivateSql} from './private-data-sql.js';
type Step={id:string;kind:string;pool:string;state:string;attempts:number;availableAt:number;error?:string;failure?:{code:string};result?:unknown;externalState:string;externalUnresolved:number};
/** Read-only rendering of existing M05 rows for original M06 context-step UI.
 * No input body, model snapshot, scheduler, inferred output or new execution path. */
export function contextStepPage(db:DatabaseSync,context:UserContext,key:string,raw:unknown,authorize:()=>void,metadata:(row:Record<string,unknown>)=>{task:Step;hasAuthority:boolean}){
 authorize();const query=z.object({state:z.enum(['waiting','running','blocked','failed','cancelled','succeeded','stale']).optional(),limit:z.coerce.number().int().min(1).max(100).default(10),cursor:z.string().max(8192).optional()}).strict().parse(raw),identity={collection:'context-steps',state:query.state??null,limit:query.limit},cursor=new PrivateCursor(key,context.deploymentId,context.userId),position=query.cursor?z.number().int().safe().positive().parse(cursor.decodeCompact(query.cursor,identity)):undefined,sql=new PrivateSql(db,context.userId,authorize),values:(string|number)[]=[],where:string[]=[];
    if(query.state){where.push('e.state=?');values.push(query.state);}if(position!==undefined){where.push('u.user_position<?');values.push(position);}
    const rows=sql.all(`SELECT u.* FROM user_tasks u JOIN execution_steps e ON e.user_id=u.user_id AND e.id=u.task_id WHERE u.user_id=$user AND e.user_id=$user AND e.kind LIKE 'processing.%' ${where.length?'AND '+where.join(' AND '):''} ORDER BY u.user_position DESC LIMIT ?`,...values,query.limit+1),page=rows.slice(0,query.limit);
    return {scope:'account' as const,engine:'scoped-task' as const,limit:query.limit,nextCursor:rows.length>query.limit?cursor.encodeCompact(identity,Number(page.at(-1)!.user_position)):null,jobs:page.map(row=>{
     const {task,hasAuthority}=metadata(row),outputs=new Set<string>(),read=(value:unknown)=>{if(!value||typeof value!=='object')return;const result=value as {artifactId?:unknown;results?:unknown[]};if(typeof result.artifactId==='string'&&/^[a-f0-9]{64}$/.test(result.artifactId))outputs.add(result.artifactId);if(Array.isArray(result.results))for(const child of result.results)read(child);};read(task.result);
     return {id:task.id,engine:'scoped-task' as const,title:task.kind,state:task.state,lane:task.pool,attempts:task.attempts,availableAt:task.availableAt,reason:task.failure?.code??task.error,dependencies:sql.all('SELECT d.dependency_id FROM execution_dependencies d JOIN user_tasks u ON u.task_id=d.step_id WHERE u.user_id=$user AND d.step_id=?',task.id).map(row=>String(row.dependency_id)),outputs:[...outputs],externalUnresolved:task.externalUnresolved,confirmUnknownRequired:['issued','unknown'].includes(task.externalState),allowedActions:[...(hasAuthority&&['failed','blocked','cancelled'].includes(task.state)?['retry-step' as const]:[]),...(!['succeeded','cancelled','stale'].includes(task.state)?['cancel' as const]:[])]};
    })};
}
