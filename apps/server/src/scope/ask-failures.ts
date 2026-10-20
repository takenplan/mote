import {randomUUID} from 'node:crypto';
import {z} from 'zod';
import type {ExecutionFailureReceipt,ExecutionState} from '../execution-engine.js';
import {AskError,askHash,askInputSchema,type AskRow} from './ask-schema.js';
import type {PrivateSql} from './private-data-sql.js';

/** A failed question is history, not an empty assistant answer or a reusable
 * evidence grant. Only fixed host error metadata is retained. */
export const ASK_FAILURE_MESSAGE='This answer did not complete. You can ask the question again.';
export const askFailureResultSchema=z.object({
 status:z.literal('failed'),runId:z.string().uuid(),receipt:z.string().regex(/^[a-f0-9]{64}$/),
 error:z.object({code:z.string().regex(/^[a-z][a-z0-9_.:-]{0,99}$/),message:z.literal(ASK_FAILURE_MESSAGE)}).strict(),
}).strict();
export type AskFailureResult=z.infer<typeof askFailureResultSchema>;
export function failedAskTurnResult(value:unknown):AskFailureResult|undefined{
 const parsed=askFailureResultSchema.safeParse(value);return parsed.success?parsed.data:undefined;
}

// Transport/authorization state is deterministic host metadata. None of these
// outcomes can renew an expired model/input grant by publishing a failed turn.
const unpublished=new Set([
 'timeout','agent_request_timeout','provider_timeout','grant_revoked','input_changed',
 'ask_revoked','ask_request_ended','ask_automation_revoked','ask_evidence_changed',
 'conversation_changed','source_context_changed','model_authority_revoked',
 'credentials_revoked','shared_resource_revoked','external_result_unknown',
]);
export function publishableAskFailure(task:{state:ExecutionState;failure?:ExecutionFailureReceipt}):ExecutionFailureReceipt|undefined{
 const failure=task.failure;
 if(!failure||!['failed','blocked'].includes(task.state)||failure.state!==task.state||
  !['permanent','blocked','transient'].includes(failure.category)||failure.admissionWaiting||
  unpublished.has(failure.code)||!/^[a-z][a-z0-9_.:-]{0,99}$/.test(failure.code))return;
 return failure;
}

/** Called only by the live coordinator through grant.commit. The caller must
 * revalidate its complete evidence/model/source authority before entering it.
 * A separate turn identity preserves failure history when an explicit task
 * retry later completes the original run and its reserved successful turn. */
export function appendAskFailure(sql:PrivateSql,row:AskRow,failure:ExecutionFailureReceipt,assertCurrent:()=>void){
 if(row.mode==='compact'||!publishableAskFailure({state:failure.state,failure}))return;
 const request=askInputSchema.parse(JSON.parse(row.input)),receipt=askHash([row.id,failure.stepId,failure.attempt,failure.at]);
 return sql.transaction(()=>{
  assertCurrent();
  const run=sql.get('SELECT input,status,generation,conversation_revision,conversation_incarnation FROM ma_runs WHERE user_id=$user AND id=?',row.id),conversation=sql.get('SELECT scope,incarnation,revision FROM ma_conversations WHERE user_id=$user AND id=?',request.conversationId!);
  if(!run||run.input!==row.input||run.status!=='running'||run.generation!==row.generation||
   !conversation||conversation.scope!==row.scope||conversation.incarnation!==row.conversation_incarnation||
   conversation.incarnation!==run.conversation_incarnation||conversation.revision!==run.conversation_revision)throw new AskError('conversation_changed',409);
  const previous=sql.get("SELECT id FROM ma_turns WHERE user_id=$user AND conversation_id=? AND json_extract(result,'$.status')='failed' AND json_extract(result,'$.receipt')=?",request.conversationId!,receipt);
  if(previous)return {conversationId:request.conversationId!,turnId:String(previous.id)};
  const turnId=randomUUID(),input=JSON.stringify({...request,turnId}),result=JSON.stringify(askFailureResultSchema.parse({status:'failed',runId:row.id,receipt,error:{code:failure.code,message:ASK_FAILURE_MESSAGE}})),createdAt=new Date().toISOString();
  const size=sql.get('SELECT count(*) n,coalesce(sum(length(CAST(input AS BLOB))+length(CAST(result AS BLOB))),0) bytes FROM ma_turns WHERE user_id=$user AND conversation_id=?',request.conversationId!)!;
  if(Number(size.n)>=200)throw new AskError('conversation_turn_limit',409);
  if(Number(size.bytes)+Buffer.byteLength(input)+Buffer.byteLength(result)>4*1024*1024)throw new AskError('conversation_storage_limit',413);
  sql.run('INSERT INTO ma_turns SELECT $user,?,?,coalesce(max(position),0)+1,?,?,\'[]\',\'[]\',? FROM ma_turns WHERE user_id=$user AND conversation_id=?',request.conversationId!,turnId,input,result,createdAt,request.conversationId!);
  // No provider prose, history, receipts or observed originals are published.
  // Saving an explicit empty proof prevents unrelated privacy changes from
  // treating this user question as unknown derived-answer lineage.
  sql.run('INSERT INTO ma_history_turns VALUES($user,?,?,0,0)',turnId,JSON.stringify({version:1,roots:[],pins:[],materials:[]}));
  sql.run('UPDATE ma_conversations SET revision=revision+1,updated_at=? WHERE user_id=$user AND id=?',createdAt,request.conversationId!);
  sql.run('UPDATE ma_runs SET conversation_revision=conversation_revision+1,updated_at=? WHERE user_id=$user AND id=?',createdAt,row.id);
  assertCurrent();return {conversationId:request.conversationId!,turnId};
 });
}
