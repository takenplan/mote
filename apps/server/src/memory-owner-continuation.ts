import type {EvidenceRange} from './memory.js';
import type {MemoryStrategyRef,MemoryRecipeBinding} from './memory-strategy-contract.js';
import type {MemoryWorkMember,MemoryOwnerQuestion} from './memory-work-contract.js';

export type MemoryOwnerContinuationView={id:string;batches:{id:string;evidenceRanges:EvidenceRange[]}[]};
export type MemoryOwnerWorkView=MemoryOwnerContinuationView&{status:string};
export type MemoryOwnerWorkScope={job:{id:string;modelProfileId?:string;modelOverride?:string;recipes?:MemoryStrategyRef[];contextTime:string;timeZone?:string;batchCharacters?:number};member:MemoryWorkMember;strategy?:MemoryRecipeBinding};
export type MemoryOwnerContinuationRequest={evidenceIds:string[];evidenceRanges:EvidenceRange[];recipes?:MemoryStrategyRef[];contextTime:string;timeZone?:string;modelProfileId?:string;modelOverride?:string;originKey:string;batchCharacters?:number};
export type MemoryOwnerQuestionHandler={create:(input:{job:{id:string};batchId:string;member:MemoryWorkMember;question:MemoryOwnerQuestion})=>string;pending:(jobId:string)=>boolean};

/** The question provider can inspect and replace its own reviewed gap. It has
 * no automatic admission, retry, executor or provider-publication capability. */
export interface MemoryOwnerContinuationPort {
  read(jobId:string):MemoryOwnerWorkView;
  scope(jobId:string,batchId:string,key:string):MemoryOwnerWorkScope;
  assertCurrent(jobId:string,ref:string,ids:readonly string[]):void;
  create(input:MemoryOwnerContinuationRequest):MemoryOwnerContinuationView;
  link(jobId:string,batchId:string,continuation:MemoryOwnerContinuationView,memberKey:string):void;
  closeGap(jobId:string,batchId:string,key:string):void;
  dependencies(ids:readonly string[]):string[];
  setQuestions(handler?:MemoryOwnerQuestionHandler):void;
}
