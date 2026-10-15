import {ProviderFailure} from '@mote/shared';

/** Host metadata only. Never attach messages, prompts, stderr or provider prose. */
export type FailureContext={workId?:string;jobId?:string;batchId?:string;runId?:string;phase?:string;causeStepId?:string;causeCode?:string;causeState?:string};
const contexts=new WeakMap<object,FailureContext>();
const identity=(value:unknown)=>typeof value==='string'&&/^[A-Za-z0-9_.:@/-]{1,256}$/.test(value)?value:undefined;
export function safeFailureContext(value:FailureContext):FailureContext {
 return Object.fromEntries(Object.entries(value).flatMap(([key,value])=>['workId','jobId','batchId','runId','phase','causeStepId','causeCode','causeState'].includes(key)&&identity(value)?[[key,value]]:[]));
}
export function failureContext(error:unknown):FailureContext{return error&&typeof error==='object'?contexts.get(error)??{}:{};}
export function retainFailureContext<T>(error:T,value:FailureContext):T {
 if(error&&typeof error==='object')contexts.set(error,{...failureContext(error),...safeFailureContext(value)});
 return error;
}
/** Same-input paid recovery requires a typed temporary transport fact. */
export function recoverableProviderFailure(error:ProviderFailure):boolean {
 return error.details.category==='transient'&&['rate_limited','provider_network','provider_unavailable','provider_timeout'].includes(error.details.code);
}
