import {randomUUID} from 'node:crypto';
import {z} from 'zod';
import {type CaptureRecord,type QueryResult} from '@mote/shared';
import type {QueryInput} from '@mote/agent';
import type {ContextProcessor} from './processing-runtime.js';
import type {ModelConfiguration} from './model-configuration.js';
import type {UsageLedger} from './usage.js';
import {StoreError,type Store} from './store.js';
import {MemoryStore,MemoryOutputValidationError} from './memory.js';
import {parseSemanticProducts,segmentUnderstandingQuestion} from './semantic-products.js';
export * from './semantic-products.js';
import {memoryProfile} from './memory-profiles.js';

export function semanticProcessor(options:{store:Store;memories:MemoryStore;query:(input:QueryInput)=>Promise<QueryResult>;records:(ids:string[])=>CaptureRecord[];selection:()=>ModelConfiguration&{configured:boolean};usage:UsageLedger}):ContextProcessor{
 return {id:'mote.segment-understanding',version:'3',lane:'semantic',async process(input){
  const selected=options.selection();if(!selected.configured)throw new StoreError('Model not configured',409);
  if(input.config.modelFingerprint!==selected.fingerprint)throw new StoreError('Model settings changed; enqueue a new workflow',409);
  const artifact=input.artifacts.flatMap(a=>a.outputs).find(a=>a.id===input.config.artifactId);
  if(!artifact||artifact.kind!=='segment'||artifact.metadata.complete!==true)throw new StoreError('A current complete segment is required',409);
  const records=options.records(artifact.representatives).filter(r=>r.ocrText.length>0);
  if(records.reduce((n,r)=>n+r.ocrText.length,0)>12000)throw new StoreError('Semantic input exceeds the bounded segment budget',413);
  if(!records.length)return [{kind:'semantic',text:'No textual evidence is available in this bounded segment.',metadata:{artifactId:artifact.id,artifactRevision:artifact.revision,evidenceRanges:[],citations:[],complete:false}}];
  const profile=memoryProfile(records[0]),ranges=records.map(r=>({id:r.id,offset:0,length:r.ocrText.length}));
  const parse=(result:QueryResult)=>{const output=parseSemanticProducts(result.answer,records,result.citations.map(c=>c.id));options.memories.extract({...result,answer:JSON.stringify({memories:output.memoryCandidates})},selected.model,{profile:profile.id,requireAdmission:true,evidenceRanges:ranges,validateOnly:true});return output;};
  const host={operationId:input.execution?.operationId??'semantic:'+artifact.id,jobId:input.execution?.jobId,requestId:randomUUID()};
  const meter=options.usage.start(selected.provider,selected.model,'segment-understanding',{moduleId:'memories',agentId:'segment-understanding',skillId:null,...host});
  try{const result=await options.query({executionLane:'background',modelProfileId:selected.profileId,modelOverride:selected.model,traceContext:host,evidenceIds:records.map(r=>r.id),evidenceRanges:ranges,question:segmentUnderstandingQuestion(records),validateOutput:result=>{try{parse(result);}catch(error){const detail=error instanceof MemoryOutputValidationError?error.repairInstruction:error instanceof z.ZodError?error.issues.slice(0,3).map(i=>i.path.join('.')+': '+i.message).join('; '):error instanceof StoreError?error.message:'Invalid JSON object';return {code:'semantic_products',feedback:detail+' '+'Return all five required fields summary, evidence, events, memoryCandidates and actionCues. Use empty arrays for absent products. Every product must quote exact original text and cite its UUID. Keep original attribution, project scope and explicit dates. Memory candidates must satisfy the supplied memory admission schema.'};}},signal:input.signal,onUsage:meter.update});
   const output=parse(result);if(options.selection().fingerprint!==selected.fingerprint)throw new StoreError('Model settings changed during semantic extraction',409);
   const usage=meter.finish('completed');return [{kind:'semantic',text:output.summary,metadata:{artifactId:artifact.id,artifactRevision:artifact.revision,productsVersion:1,configuration:selected,events:output.events,memoryCandidates:output.memoryCandidates,actionCues:output.actionCues,evidenceRanges:output.evidenceRanges,citations:[...new Set(output.evidenceRanges.map(e=>e.id))],complete:true,usage,runId:result.runId,model:selected.model,originalCharacters:artifact.metadata.originalCharacters,characters:output.summary.length}}];
  }catch(error){meter.finish('failed');throw error;}
 }};
}
