import type {QueryInput} from '@mote/agent';
import type {QueryResult} from '@mote/shared';
import type {MemoryWorkCandidate} from '../../src/material-memory-work.js';
import type {MemoryWorkMember} from '../../src/memory-work-contract.js';

/** Synthetic responses preserve the envelope of the host's explicit contract. */
export function fixtureMemoryCapacity(input:Pick<QueryInput,'taskContext'>){return (input.taskContext?.memoryWork as {workContract?:string}|undefined)?.workContract==='range-evaluation@1'?{}:{capacity:{saturated:false}};}

/** Explicit synthetic provider behavior for the durable planning protocol. */
export async function planGeneratedMemory(input:QueryInput){
 const catalog=(input.taskContext?.memoryWork as {catalog?:MemoryWorkCandidate[]}|undefined)?.catalog;
 if(!catalog)return false;
 for(let index=0;index<catalog.length;index++)await input.hostControlChannel!.execute('delegation_submit',{units:[{id:'generated-'+index,capabilityId:'memory.package',title:'Generated original '+index,goal:'Inspect this generated original',input:{members:[catalog[index].key],instruction:'Inspect the full generated original and preserve its source attribution'}}]});
 return true;
}

export function generatedMemoryOutput(input:QueryInput,memories:{evidenceIds:string[];[key:string]:unknown}[]=[]){
 const work=input.taskContext?.memoryWork as {members?:MemoryWorkMember[];workContract?:string}|undefined,members=work?.members;
 return JSON.stringify({memories,...(members?{coverage:members.map(member=>{const candidateIndexes=memories.flatMap((memory,index)=>memory.evidenceIds.includes(member.id)?[index]:[]);return {key:member.key,state:candidateIndexes.length?'checked':'no_candidates',candidateIndexes};}),...fixtureMemoryCapacity(input)}:{})});
}

export async function fixtureMemoryPlan(input:QueryInput):Promise<QueryResult|undefined>{
 if(!await planGeneratedMemory(input))return undefined;
 return {answer:'Generated packages submitted.',citations:[],trace:[],runId:'generated-memory-plan'};
}

export function fixtureMemoryWorkResult(input:QueryInput,result:QueryResult):QueryResult{
 const raw=JSON.parse(result.answer),selected=(input.taskContext?.memoryWork as {workContract?:string}|undefined)?.workContract==='range-evaluation@1',output=selected?(({capacity:_capacity,...value})=>value)(raw):raw;
 if(Array.isArray(output.memoryCandidates)&&input.taskContext?.memoryWork){const {memories:_memories,...accounting}=JSON.parse(generatedMemoryOutput(input,output.memoryCandidates));return {...result,answer:JSON.stringify({...output,...accounting})};}
 if(!Array.isArray(output.memories))return result;
 const members=(input.taskContext?.memoryWork as {members?:MemoryWorkMember[]}|undefined)?.members;if(!members)return result;
 return {...result,answer:JSON.stringify({...output,...JSON.parse(generatedMemoryOutput(input,output.memories))})};
}
