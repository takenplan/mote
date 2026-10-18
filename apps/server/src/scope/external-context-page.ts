import {z} from 'zod';
import {MAX_SCAN,type ContextCard,type ContextQueryInput} from '../context-query-core.js';
import {AskError} from './ask-schema.js';

/** The public Context/MCP response contract is independent of model tool reads. */
export const EXTERNAL_CONTEXT_MAX_CHARACTERS=16000;
const input=z.object({cursor:z.string().max(8192).optional(),limit:z.number().int().min(1).max(100).default(20),maxCharacters:z.number().int().min(1000).max(24000).optional()}).passthrough();
const positionSchema=z.object({inner:z.string().max(8192)}).strict();
export type ExternalContextCursor={encode:(identity:unknown,position:{inner:string})=>string;decode:(cursor:string,identity:unknown)=>unknown};
export type ExternalContextCandidates={items:ContextCard[];nextCursor:string|null;coverage:{recordsScanned:number}};
const canonical=(value:Record<string,unknown>)=>Object.fromEntries(Object.entries(value).filter(([,item])=>item!==undefined).sort(([left],[right])=>left.localeCompare(right)));
export const externalContextBudget=(maxCharacters?:number)=>Math.min(maxCharacters??EXTERNAL_CONTEXT_MAX_CHARACTERS,EXTERNAL_CONTEXT_MAX_CHARACTERS);

/** Fetch one canonical entity at a time so a card omitted for response capacity
 * is still available at the next cursor. The signed cursor binds the external
 * mode, complete query and account source capability, including the requested
 * response size. Cursor persistence and owner authentication belong to the host. */
export async function externalContextPage(raw:ContextQueryInput,mode:'browse'|'search',sourceIds:readonly string[]|undefined,cursors:ExternalContextCursor,fetch:(query:ContextQueryInput)=>ExternalContextCandidates|Promise<ExternalContextCandidates>){
 const {cursor,limit,maxCharacters,...query}=input.parse(raw),budget=externalContextBudget(maxCharacters),identity={collection:'external-context',mode,sources:sourceIds??null,query:canonical(query),limit,maxCharacters:maxCharacters??null};
 let inner=cursor?positionSchema.parse(cursors.decode(cursor,identity)).inner:undefined,scanned=0;
 const result={items:[] as ContextCard[],nextCursor:null as string|null,coverage:{recordsScanned:0,recordsReturned:0,scope:'query-visible',truncated:false},truncated:false},groups=new Set<string>();
 const update=(position:string|null|undefined)=>{result.nextCursor=position?cursors.encode(identity,{inner:position}):null;result.truncated=Boolean(result.nextCursor);result.coverage.recordsReturned=result.items.length;result.coverage.truncated=result.truncated;};
 for(;;){
  // Preserve the public browse scan window even when every candidate belongs
  // to an already emitted collection. Internal Ask readers have no such cap.
  if(mode==='browse'&&scanned>=MAX_SCAN){update(inner);break;}
  const page=await fetch({...query,limit:1,...(inner?{cursor:inner}:{})});result.coverage.recordsScanned+=page.coverage.recordsScanned;scanned++;
  if(page.items.length>1)throw new Error('External Context pagination requires one entity per candidate page');
  const card=page.items[0],group=card&&mode==='browse'&&card.expansion?.kind==='search'?JSON.stringify(canonical(card.expansion.scope)):card?.ref;
  if(card&&!groups.has(group!)){
   if(result.items.length>=limit){update(inner);break;}
   result.items.push(structuredClone(card));update(page.nextCursor);
   // The established public fallback keeps the first entity discoverable at the
   // minimum page size; its exact text remains available through its read ref.
   if(JSON.stringify(result).length>budget&&result.items.length===1){const first=result.items[0];first.snippet=first.snippet.slice(0,40);first.title=first.title.slice(0,40);first.matchReasons=[];delete first.locator;first.evidenceRefs=[];}
   if(JSON.stringify(result).length>budget){result.items.pop();update(inner);if(!result.items.length)throw new AskError('context_response_budget_exceeded',413);break;}
   groups.add(group!);
  }
  const previous=inner;inner=page.nextCursor??undefined;update(inner);
  if(!inner)break;
  if(inner===previous)throw new Error('Context candidate cursor did not advance');
 }
 if(JSON.stringify(result).length>budget)throw new AskError('context_response_budget_exceeded',413);
 return result;
}

/** Ranked retrieval keeps relevance order and its per-call degradation report.
 * As in the public ranked contract, the result is bounded without a paging
 * cursor; omitted suffix cards are reported through truncated. */
export function boundExternalRetrieval<T extends {items:ContextCard[];truncated:boolean;coverage?:{recordsReturned:number;truncated:boolean}}>(page:T,raw:ContextQueryInput):T{
 const {cursor,maxCharacters}=input.parse(raw);if(cursor)throw new AskError('Ranked retrieval does not accept pagination cursors');
 const budget=externalContextBudget(maxCharacters),result={...page,items:[] as ContextCard[],...(page.coverage?{coverage:{...page.coverage,recordsReturned:0,truncated:page.truncated}}:{})};
 for(const card of page.items){
  result.items.push(card);if(result.coverage)result.coverage.recordsReturned=result.items.length;
  const serialized=JSON.stringify(result);if(serialized.length>budget||Buffer.byteLength(serialized)>65536){result.items.pop();result.truncated=true;if(result.coverage){result.coverage.recordsReturned=result.items.length;result.coverage.truncated=true;}break;}
 }
 if(page.items.length&&!result.items.length)throw new AskError('context_response_budget_exceeded',413);
 const serialized=JSON.stringify(result);if(serialized.length>budget||Buffer.byteLength(serialized)>65536)throw new AskError('context_response_budget_exceeded',413);
 return result as T;
}
