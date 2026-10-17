import type {QueryInput} from '@mote/agent';

export type WorkingTurn={turnId:string;question:string;answer:string;[field:string]:unknown};
/** Existing complete-prefix compaction, independent of storage and identity.
 * Long turns are read as ordered UTF-16-safe spans; no prefix is discarded. */
export function workingMemoryPlan(turns:readonly(WorkingTurn|null)[],start:number,end:number,previousSummary=''){
 let count=start,characters=JSON.stringify({previousSummary:previousSummary||undefined,turns:[]}).length;
 const prefix:WorkingTurn[]=[],batches:NonNullable<QueryInput['taskContext']>['turns'][]=[];
 for(const entry of turns.slice(start,end)){
  if(!entry){count++;continue;}
  const text=JSON.stringify(entry);if(characters+text.length>60000){
   if(prefix.length)break;
   const {question:_question,answer:_answer,...metadata}=entry;
   for(const field of ['question','answer'] as const){const original=entry[field];let offset=0;while(offset<original.length){let end=Math.min(original.length,offset+6000);if(end<original.length&&/[\uD800-\uDBFF]/.test(original[end-1]))end--;batches.push([{...metadata,field,offset,end,total:original.length,text:original.slice(offset,end)}]);offset=end;}}
   count++;break;
  }
  prefix.push(entry);characters+=text.length+1;count++;
 }
 if(prefix.length)batches.push(prefix);
 return {count,batches};
}
