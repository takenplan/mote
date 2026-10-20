import type {MemoryWorkContract} from './memory-strategy-contract.js';
import type {ConversationPreparation} from './memory-pipeline.js';
import {randomUUID} from 'node:crypto';
import {z} from 'zod';
import {CODING_DIALOGUE_SCHEMA_VERSION,type CaptureRecord,type QueryResult} from '@mote/shared';
import {AgentResponseError,type QueryInput} from '@mote/agent';
import {ProcessingFailure,type ContextProcessor} from './processing-runtime.js';
import type {MaterialReadPage} from './materials.js';
import {materialRequirementsSchema} from './material-readiness.js';
import type {ModelConfiguration} from './model-configuration.js';
import type {UsageLedger} from './usage.js';
import {StoreError} from './store.js';
import {memoryWorkCoverageFor,memoryWorkCapacitySchema,readMemoryWorkCoverage,type MemoryWorkMember} from './memory-work-contract.js';
import {MemoryOutputValidationError,type MemoryStore,type EvidenceRange} from './memory.js';
import {memoryProfile} from './memory-profiles.js';
import {CONVERSATION_UNDERSTANDING_PROMPT,conversationProductText,parseConversationProducts} from './conversation-products.js';
export {CONVERSATION_UNDERSTANDING_PROMPT,conversationProductText,parseConversationProducts} from './conversation-products.js';

export type ConversationEvidenceScope={records:CaptureRecord[];ranges:EvidenceRange[]};
export type ConversationUnderstandingOptions={
 query:(input:QueryInput)=>Promise<QueryResult>;
 selection:(config?:Record<string,unknown>)=>ModelConfiguration&{configured:boolean};
 resolveMemoryPreparation?:(generationContract:string)=>Pick<ConversationPreparation,'memoryWork'|'candidatePolicy'>;
 usage:UsageLedger;
 memories:Pick<MemoryStore,'extract'>;
 /** Host-owned anchor lookup. It has no raw archive or derived-product read surface. */
 resolveEvidence:(page:MaterialReadPage)=>ConversationEvidenceScope;
};

const materialInputsSchema=z.array(z.object({materialId:z.string().regex(/^mat_[a-f0-9]{64}$/),required:materialRequirementsSchema,
 fingerprint:z.string().regex(/^[a-f0-9]{64}$/),evidenceIds:z.array(z.string().uuid()).min(1).max(20000)}).strict()).min(1).max(32);
const candidatePolicySchema=z.object({prompt:z.string().min(1).max(32000),profile:z.enum(['personal','coding']),fingerprint:z.string().regex(/^[a-f0-9]{64}$/)}).strict();

/** The caller supplies complete bounded pages, never an arbitrary slice of raw tool logs. */
function originalScope(pages:MaterialReadPage[],resolve:ConversationUnderstandingOptions['resolveEvidence']){
 if(!pages.length||new Set(pages.map(page=>page.material.ref)).size!==1)throw new StoreError('One pinned Coding conversation is required',409);
 const records=new Map<string,CaptureRecord>(),ranges:EvidenceRange[]=[];
 let characters=0;
 for(const page of pages){
  if(page.material.kind!=='mote.coding-session'||page.material.schemaVersion<CODING_DIALOGUE_SCHEMA_VERSION||
   !page.material.artifacts?.some(artifact=>artifact.key==='conversation'&&artifact.state==='ready'))throw new StoreError('A current rule-cleaned Coding dialogue is required',409);
  if(!page.text.length||page.textRange.offset<0||page.textRange.offset+page.text.length>page.textRange.total)throw new StoreError('Coding conversation page is unavailable',409);
  characters+=page.text.length;if(characters>12000)throw new StoreError('Conversation understanding input exceeds the bounded 12000-character budget',413);
  const resolved=resolve(page),byId=new Map(resolved.records.map(record=>[record.id,record]));
  const expected:EvidenceRange[]=[];
  let cursor=0;
  for(const rawSpan of page.spans){
   const span=rawSpan as typeof rawSpan&{evidenceId?:string;evidenceOffset?:number};
   if(span.kind!=='text'||span.pageRange.start!==cursor||span.pageRange.end<=cursor||span.pageRange.end>page.text.length||
    !span.evidenceId||!Number.isSafeInteger(span.evidenceOffset)||span.evidenceOffset!<0)throw new StoreError('Coding page needs exact original anchor ranges',409);
   const record=byId.get(span.evidenceId),length=span.pageRange.end-span.pageRange.start;
   if(!record||record.appId!=='mote.material'||record.provenance?.externalId!==page.material.id||
    record.provenance?.document?.coding?.role!=='transcript'||
    !record.provenance?.uri?.endsWith('#'+span.blockId)||
    record.ocrText.slice(span.evidenceOffset,span.evidenceOffset!+length)!==page.text.slice(cursor,span.pageRange.end))throw new StoreError('Coding page does not match its original anchor',409);
   expected.push({id:record.id,offset:span.evidenceOffset!,length});records.set(record.id,record);cursor=span.pageRange.end;
  }
  if(cursor!==page.text.length||JSON.stringify(resolved.ranges)!==JSON.stringify(expected)||new Set(resolved.ranges.map(range=>range.id)).size!==byId.size)throw new StoreError('Coding evidence resolver expanded the supplied page scope',409);
  ranges.push(...expected);
 }
 // Coalesce only adjacent/overlapping ranges, preserving exact source addressing.
 const union:EvidenceRange[]=[];
 for(const range of ranges.sort((a,b)=>a.id.localeCompare(b.id)||a.offset-b.offset)){
  const prior=union.at(-1);
  if(prior?.id===range.id&&range.offset<=prior.offset+prior.length)prior.length=Math.max(prior.length,range.offset+range.length-prior.offset);
  else union.push({...range});
 }
 return {records:[...records.values()],ranges:union,characters};
}

/** One model interpretation feeds work/event consumers and independently reviewed Memory. */
export function conversationUnderstandingProcessor(options:ConversationUnderstandingOptions):ContextProcessor{
 return {id:'mote.coding-conversation-understanding',version:'4',lane:'semantic',async process(input){
  input.signal.throwIfAborted();
  const selected=options.selection(input.config);
  if(!selected.configured)throw new StoreError('Model not configured',409);
  if(input.config.modelFingerprint!==selected.fingerprint)throw new StoreError('Model settings changed; enqueue a new workflow',409);
  const scope=originalScope(input.materials,options.resolveEvidence),material=input.materials[0].material;
  const materialInputs=materialInputsSchema.parse(input.config.processingMaterialInputs);
  if(materialInputs.some(pin=>pin.materialId!==material.id)||scope.records.some(record=>!materialInputs.some(pin=>pin.evidenceIds.includes(record.id))))throw new StoreError('Conversation understanding needs the parent Memory material authorization',409);
  const profile=memoryProfile(scope.records[0]);
  const generationContract=typeof input.config.generationContract==='string'?input.config.generationContract:undefined;
  const preparation=input.config.memoryPreparation===true?options.resolveMemoryPreparation?.(generationContract??''):undefined;
  if(input.config.memoryPreparation===true&&!preparation)throw new StoreError('Conversation preparation provider unavailable',409);
  const candidatePolicy=candidatePolicySchema.optional().parse(preparation?.candidatePolicy??input.config.candidatePolicy),candidateProfile=candidatePolicy?.profile??profile.id;
  const work=(preparation?.memoryWork??input.config.memoryWork) as {members:MemoryWorkMember[];workContract?:MemoryWorkContract;maxCandidates?:number;instruction:string}|undefined;
  if(work&&!generationContract)throw new StoreError('Conversation candidate reuse requires the complete generation contract',409);
  const parse=(result:QueryResult)=>{
   const value=JSON.parse(result.answer),{coverage,capacity,...products}=value;
   if(work?.workContract&&capacity!==undefined)throw new MemoryOutputValidationError('schema','Range evaluation does not accept legacy capacity',{workContract:work.workContract});
   const output=parseConversationProducts(JSON.stringify(products),scope,result.citations.map(citation=>citation.id),work?.maxCandidates??8,work?.workContract);
   if(work){const accounting=readMemoryWorkCoverage({...result,answer:JSON.stringify({memories:output.memoryCandidates,coverage,...(!work?.workContract?{capacity}:{})})},work.members,work.maxCandidates,id=>scope.records.find(record=>record.id===id)?.ocrText,work.workContract);if(accounting.missing.length||accounting.notAssessed.length)throw new MemoryOutputValidationError('coverage','Every supplied conversation target requires completed evaluation',{workContract:work.workContract});}
   else if(coverage!==undefined||capacity!==undefined)throw new StoreError('Legacy conversation products must not invent a coverage contract',502);
   options.memories.extract({...result,answer:JSON.stringify({memories:output.memoryCandidates,...(work?{coverage,...(!work.workContract?{capacity}:{})}:{})})},selected.model,{workContract:work?.workContract,maxCandidates:work?.maxCandidates,profile:candidateProfile,requireAdmission:true,evidenceRanges:scope.ranges,validateOnly:true});
   return output;
  };
  const host={operationId:input.execution?.operationId??'conversation:'+material.id,jobId:input.execution?.jobId,requestId:randomUUID()};
  const meter=options.usage.start(selected.provider,selected.model,'coding-conversation-understanding',{moduleId:'memories',agentId:'coding-conversation-understanding',skillId:null,...host});
  try{
   const result=await options.query({executionLane:'background',responseMode:'memory-extraction',processingMaterialInputs:materialInputs,modelProfileId:selected.profileId,modelOverride:selected.model,traceContext:host,
    contextTime:typeof input.config.contextTime==='string'?input.config.contextTime:undefined,
    timeZone:typeof input.config.timeZone==='string'?input.config.timeZone:undefined,
    language:input.config.language==='en'?'en':input.config.language==='zh-CN'?'zh-CN':undefined,
    taskContext:work?{turns:[],memoryWork:work}:undefined,
    evidenceIds:scope.records.map(record=>record.id),evidenceRanges:scope.ranges,
    // The complete package and range contract already travel in memoryWork.
    question:'The following guidance applies only to memoryCandidates. Its sample memories envelope is subordinate to the final unified contract.\n'+(candidatePolicy?.prompt??profile.prompt)+'\nFINAL UNIFIED RESPONSE CONTRACT:\n'+(work?.workContract?CONVERSATION_UNDERSTANDING_PROMPT.replace('memoryCandidates (0–8 matching the supplied memory admission contract)','memoryCandidates (a variable selected set matching the memory contract below)'):CONVERSATION_UNDERSTANDING_PROMPT)+(work?'\nApply the complete supplied taskContext.memoryWork package and coverage contract to the listed original ranges. That contract supersedes the legacy eight-candidate ceiling. Additionally return coverage'+(work.workContract?'':' and capacity')+' for all supplied members. memoryCandidates is the memories array for this coverage contract.':''),
    validateOutput:result=>{try{parse(result);}catch(error){const detail=error instanceof MemoryOutputValidationError?error.repairInstruction:error instanceof z.ZodError?error.issues.slice(0,3).map(issue=>issue.path.join('.')+': '+issue.message).join('; '):error instanceof StoreError?error.message:'Invalid JSON object';return {code:'conversation_products',feedback:detail+' Return summary, evidence, workRecords, events, memoryCandidates and actionCues. Absent products use empty arrays; actionCues must be empty. Every claim must preserve attribution, status, basis, sourceTime and uncertainty, with exact cited original quotes inside the supplied ranges.'};}},
    signal:input.signal,onUsage:meter.update});
   input.signal.throwIfAborted();const output=parse(result);
   if(options.selection(input.config).fingerprint!==selected.fingerprint)throw new StoreError('Model settings changed during conversation understanding',409);
   const usage=meter.finish('completed');
   const text=conversationProductText(output);
   return [{kind:'semantic',text,metadata:{productsVersion:work?.workContract?3:work?2:1,...(work?{generationContract,workContract:work.workContract,memoryCoverage:memoryWorkCoverageFor(work.workContract).parse(JSON.parse(result.answer).coverage),...(!work.workContract?{memoryCapacity:memoryWorkCapacitySchema.parse(JSON.parse(result.answer).capacity)}:{})}:{}),configuration:selected,materialRef:material.ref,summary:output.summary,
    ...(candidatePolicy?{candidatePolicyFingerprint:candidatePolicy.fingerprint}:{}),
    workRecords:output.workRecords,events:output.events,memoryCandidates:output.memoryCandidates,actionCues:[],
    evidenceRanges:scope.ranges,supportRanges:output.evidenceRanges,citations:[...new Set(output.evidenceRanges.map(range=>range.id))],
    coverage:{scope:'bounded-conversation',ranges:input.materials.map(page=>({ref:page.material.ref,offset:page.textRange.offset,length:page.text.length,total:page.textRange.total})),source:material.coverage},
    complete:true,usage,runId:result.runId,model:selected.model,originalCharacters:scope.characters,characters:text.length}}];
  }catch(error){meter.finish('failed');if(error instanceof AgentResponseError||error instanceof z.ZodError||error instanceof SyntaxError||error instanceof MemoryOutputValidationError||error instanceof StoreError&&error.statusCode===502)throw new ProcessingFailure('permanent','invalid_model_output');throw error;}
 }};
}
