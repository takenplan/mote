import {createAgent,AgentResponseError,AgentTimeoutError,AgentConfigurationError,AgentNotConfiguredError,AgentYieldError,type AgentOptions,type AgentAnswer,type QueryInput} from '@mote/agent';
import {ProviderFailure,type TokenUsage} from '@mote/shared';
import {ExecutionFailure} from '../execution-engine.js';
import {retainFailureContext,type FailureContext} from '../execution-failures.js';
import {validationFeedback} from '../memory-validation.js';
import type {TaskModelRun} from './task-model.js';
import type {ModelUsageStart} from './model-usage.js';

export function fencedUsage(start:TaskModelRun['startUsage'],commit:<T>(work:()=>T)=>T,codex?:AgentOptions['codex']):Pick<TaskModelRun,'startUsage'|'codex'>{
 return {codex,startUsage:options=>{const meter=commit(()=>start(options));return {id:meter.id,interrupt:()=>meter.interrupt(),issued:()=>commit(()=>meter.issued()),update:tokens=>commit(()=>meter.update(tokens)),finish:(status,facts)=>{try{return commit(()=>meter.finish(status,facts));}catch(error){try{meter.interrupt();}catch{}throw error;}}};}};
}

const reasons=new Set(['invalid_response','invalid_json','invalid_shape','response_too_large','unretrieved_citation','truncated_citation','undeclared_citation','output_limit','tools_unverified','host_validation','tool_failure','image_disclosure_disabled']);
const validationCodes=new Set([...Object.keys(validationFeedback),'owner_reply','memory_feedback_plan','summary_length','summary_too_long','invalid_summary_citations','invalid_semantic_grouping','invalid_import_manifest','semantic_products','calendar_shape','calendar_relation','calendar_quote']);
const completedFailures=new WeakSet<object>();
const terminalProviderFailures=new Set(['blocked:provider_authentication','blocked:provider_endpoint','blocked:provider_redirect','blocked:provider_quota',
 'permanent:provider_policy','permanent:provider_request_invalid','permanent:processing_limit','permanent:unsupported_format']);
/** Only the exact safe error produced by a definitively ended query carries
 * this local fact. Messages, serialized copies and caller properties cannot. */
export function completedQueryFailure(error:unknown):boolean{return !!error&&typeof error==='object'&&completedFailures.has(error);}
/** Only concrete host types and fixed reason codes cross the credential boundary.
 * Arbitrary messages, stacks and structural lookalikes never become diagnostics. */
export function safeAgentFailure(error:unknown,context:FailureContext={}){
 const failure=error instanceof ProviderFailure||error instanceof ExecutionFailure||error instanceof AgentYieldError?error:
  error instanceof AgentResponseError?new ExecutionFailure('permanent',reasons.has(error.reason)?'agent_'+error.reason:'agent_invalid_response'):
  error instanceof AgentTimeoutError?new ExecutionFailure('blocked','agent_request_timeout'):
  error instanceof AgentNotConfiguredError?new ExecutionFailure('blocked','agent_not_configured'):
  error instanceof AgentConfigurationError?new ExecutionFailure('blocked','agent_configuration_invalid'):
  new ExecutionFailure('permanent','agent_internal_error');
 return retainFailureContext(failure,context);
}

/** One genuine query is one accounting fragment; provider request counts remain
 * provider facts. Authorization runs at the actual model-send boundary, after
 * resource gates. Stream callbacks replace the fragment's cumulative sample. */
export function queryWithUsage(model:Pick<TaskModelRun,'startUsage'|'codex'>,options:AgentOptions,input:QueryInput,attribution?:ModelUsageStart['attribution']):Promise<AgentAnswer>;
export function queryWithUsage<T>(model:Pick<TaskModelRun,'startUsage'|'codex'>,options:AgentOptions,input:QueryInput,attribution:ModelUsageStart['attribution']|undefined,accept:(result:AgentAnswer)=>T|Promise<T>):Promise<T>;
export async function queryWithUsage(model:Pick<TaskModelRun,'startUsage'|'codex'>,options:AgentOptions,input:QueryInput,attribution?:ModelUsageStart['attribution'],accept?:(result:AgentAnswer)=>unknown):Promise<unknown>{
 const meter=model.startUsage({attribution});let agent:ReturnType<typeof createAgent>|undefined,status:'completed'|'failed'='failed',context:FailureContext={},facts:{executionStarted:false}|undefined,sample:TokenUsage|undefined,sends=0,failed=false;
 try{
  agent=createAgent({...options,codex:model.codex??options.codex,authorizeModelRequest:async()=>{await options.authorizeModelRequest?.();meter.issued();sends++;}});
  const result=await agent.query({...input,onUsage:tokens=>{sample=tokens;meter.update(tokens);input.onUsage?.(tokens);},onTrace:event=>{if(event.runId)context.runId=event.runId;input.onTrace?.(event);},...(input.validateOutput?{validateOutput:async answer=>{const issue=await input.validateOutput!(answer);if(issue&&validationCodes.has(issue.code))context.causeCode=issue.code;return issue;}}:{})});
  // Acceptance is a local final check, after the model run has ended. A failed
  // check keeps the fragment failed and never asks the model to repair output.
  const accepted=accept?await accept(result):result;status='completed';return accepted;
 }catch(error){failed=true;if(error instanceof AgentYieldError)status='completed';if(error instanceof ProviderFailure&&(error.details.executionStarted===false||error.details.category==='transient'&&error.details.code==='rate_limited')&&sends<=1&&(!sample||sample.totalTokens===0))facts={executionStarted:false};const safe=safeAgentFailure(error,context);if(error instanceof AgentResponseError&&error.reason==='host_validation'||error instanceof ProviderFailure&&terminalProviderFailures.has(error.details.category+':'+error.details.code))completedFailures.add(safe);throw safe;}
 finally{try{await agent?.close();}finally{try{meter.finish(status,facts);}catch(error){try{meter.interrupt();}catch{}if(!failed)throw error;}}}
}
