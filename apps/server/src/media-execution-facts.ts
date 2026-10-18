import {z} from 'zod';
import {requestLocalJson,isLoopback} from './local-http.js';

/** Fixed transport metadata only. Result bodies and provider prose never enter
 * the durable call journal. Missing or inaccessible facts remain unknown. */
export const mediaExecutionFact=z.object({version:z.literal(1),requestId:z.string().uuid(),incarnation:z.string().uuid().optional(),stage:z.enum(['ocr','transcribe','diarize']).optional(),state:z.enum(['accepted','running','succeeded','failed','unknown']),acceptedAt:z.number().int().nonnegative().optional(),startedAt:z.number().int().nonnegative().optional(),finishedAt:z.number().int().nonnegative().optional(),outcome:z.enum(['completed','processing_failed','worker_restarted','receipt_unavailable']).optional()}).strict();
export async function readMediaExecutionFact(input:{endpoint:string;apiKey:string;scope:string;requestId:string;signal:AbortSignal}){
 if(!isLoopback(input.endpoint)||!input.apiKey)return;
 const endpoint=new URL(input.endpoint);endpoint.pathname='/executions/'+input.requestId;endpoint.search='';endpoint.hash='';
 try{
  const value=mediaExecutionFact.parse(await requestLocalJson(endpoint,{headers:{Authorization:'Bearer '+input.apiKey,'X-Mote-Request-Scope':input.scope},signal:AbortSignal.any([input.signal,AbortSignal.timeout(10000)]),limit:4096}));
  return value.requestId===input.requestId?value:undefined;
 }catch{input.signal.throwIfAborted();return;}
}
