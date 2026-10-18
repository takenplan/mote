import {ProviderFailure,providerHttpFailure,type TokenUsage} from '@mote/shared';

// This is the established embedding transport input policy, independent of the
// removed internal Ask result quotas. Full text remains available to literal search.
export const EMBEDDING_INPUT_CODE_UNITS=20000;
class EmbeddingError extends ProviderFailure {
 constructor(code:'embedding_http'|'embedding_invalid'|'embedding_transport',status?:number,retryAfter?:string|null){
  super(code==='embedding_http'?providerHttpFailure(status!,retryAfter):{category:code==='embedding_invalid'?'permanent':'transient',code},code==='embedding_http'?`Embedding provider returned HTTP ${status}`:code==='embedding_invalid'?'Embedding provider returned an invalid vector':'Embedding transport failed');
 }
}
export type EmbeddingConnection={model:string;baseUrl:string;apiKey:string;headers?:Readonly<Record<string,string>>;extraBody?:Readonly<Record<string,unknown>>};
/** The ordinary /embeddings request used by both owner-bound and legacy ports.
 * Callers own model admission, cancellation and measured usage. */
export async function requestEmbedding(connection:EmbeddingConnection,text:string,timeoutMs:number,signal?:AbortSignal,onIssued?:()=>void){
 const url=connection.baseUrl.replace(/\/$/,'')+'/embeddings';let response:Response;
 try{signal?.throwIfAborted();onIssued?.();response=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json',...(connection.apiKey?{Authorization:`Bearer ${connection.apiKey}`} : {}),...connection.headers},body:JSON.stringify({...connection.extraBody,model:connection.model,input:text.slice(0,EMBEDDING_INPUT_CODE_UNITS)}),signal:AbortSignal.any([AbortSignal.timeout(timeoutMs),...(signal?[signal]:[])]),redirect:'error'});}catch(error){if(signal?.aborted)throw error;throw new EmbeddingError('embedding_transport');}
 if(!response.ok){await response.body?.cancel();throw new EmbeddingError('embedding_http',response.status,response.headers.get('retry-after'));}
 let data:{data?:{embedding?:number[]}[];usage?:{prompt_tokens?:number;total_tokens?:number}};
 try{
  const limit=2*1024*1024,reader=response.body?.getReader(),bytes=Buffer.allocUnsafe(limit);let size=0;
  if(!reader)throw Error();
  try{if(Number(response.headers.get('content-length'))>limit)throw Error();for(;;){const {value,done}=await reader.read();if(done)break;if(size+value.byteLength>limit)throw Error();bytes.set(value,size);size+=value.byteLength;}data=JSON.parse(bytes.subarray(0,size).toString('utf8')) as typeof data;}
  catch(error){await reader.cancel().catch(()=>{});throw error;}finally{reader.releaseLock();}
 }catch{throw new EmbeddingError('embedding_invalid');}
 const vector=data?.data?.[0]?.embedding;
 if(!Array.isArray(vector)||!vector.length||vector.length>16384||!vector.every(Number.isFinite))throw new EmbeddingError('embedding_invalid');
 const count=data.usage?.prompt_tokens,total=data.usage?.total_tokens;
 const usage:TokenUsage|undefined=Number.isSafeInteger(count)&&count!>=0&&total===count?{requests:1,reportedRequests:1,inputTokens:count!,outputTokens:0,totalTokens:count!,cacheReadTokens:0,cacheWriteTokens:0}:undefined;
 return {vector,usage};
}
