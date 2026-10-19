import type {QueryInput} from '@mote/agent';
import type {CaptureRecord,QueryResult} from '@mote/shared';
import {z} from 'zod';
import {CONVERSATION_UNDERSTANDING_PROMPT,conversationProductText,parseConversationProducts} from '../conversation-products.js';
import {MemoryOutputValidationError} from '../memory-errors.js';
import type {MemoryWorkContract} from '../memory-strategy-contract.js';
import {memoryWorkInstruction,readMemoryWorkCoverage,type MemoryWorkMember} from '../memory-work-contract.js';
import {StoreError} from '../execution-storage.js';
import {materialId} from '../material-organizer-contract.js';
import {memoryHash,type ScopedMemoryData} from './memory-data.js';
import type {ScopedMemoryTask} from './memory-schema.js';
import type {MaterialDraft} from './material-model.js';
import {PrivateDataError,missing} from './private-data-sql.js';

type Range={id:string;offset:number;length:number};
export type ScopedCodingScope={
 material:ReturnType<ScopedMemoryData['privateData']['material']>;
 records:CaptureRecord[];ranges:Range[];
 /** A host-created identity, never decoded from conversation text. */
 fingerprint:string;
};

/** Select explicit, current clean-dialogue products only. A batch may contain
 * several sessions or ordinary originals; each Coding session is understood
 * independently. Final Memory batches also preserve the same provenance boundary. */
export function scopedCodingScopes(data:ScopedMemoryData,input:ScopedMemoryTask):ScopedCodingScope[]{
 if(input.phase!=='extract')return [];
 const records=data.assertInputs(input),ranges=data.ranges(input),scopes=new Map<string,ScopedCodingScope>();
 for(const range of ranges){
  const record=records.find(record=>record.id===range.id);if(!record)throw missing();
  const evidence=data.sql.get('SELECT material_id,material_revision FROM mm_evidence WHERE user_id=$user AND id=?',record.id);if(!evidence)throw missing();
  const material=data.privateData.material(String(evidence.material_id),String(evidence.material_revision));
  if(material.kind!=='mote.coding-session')continue;
  if(!input.materialPins?.some(pin=>pin.id===material.id&&pin.revision===material.revision)||
   !material.artifacts?.some(artifact=>artifact.key==='coding-dialogue'&&artifact.state==='ready'&&artifact.revision==='1')||
   record.appId!=='mote.material'||record.provenance?.externalId!==material.id||
   record.provenance?.document?.coding?.role!=='transcript'||
   range.offset<0||range.length<=0||range.offset+range.length>record.ocrText.length)throw new PrivateDataError('conflict',409);
  let scope=scopes.get(material.ref);if(!scope){scope={material,records:[],ranges:[],fingerprint:''};scopes.set(material.ref,scope);}
  if(!scope.records.some(item=>item.id===record.id))scope.records.push(record);scope.ranges.push({...range});
 }
 for(const scope of scopes.values()){
  if(scope.ranges.reduce((sum,range)=>sum+range.length,0)>12000)throw new PrivateDataError('invalid_data');
  scope.fingerprint=memoryHash([scope.material.ref,scope.ranges,input.strategy,input.model]);
 }
 return [...scopes.values()];
}

export type ScopedCodingPreparation={
 version:1;fingerprint:string;runId:string;materialRef:string;ranges:Range[];
 generationContract:string;workContract?:MemoryWorkContract;complete:true;
 /** Host-validated candidates with exact coverage and successful read receipts. */
 candidateResult:QueryResult;
 /** Structured products remain separate from the readable navigation text. */
 products:ReturnType<typeof parseConversationProducts>;
 text:string;materialDraft:MaterialDraft;
};
type CodingPorts={
 query:(input:QueryInput)=>Promise<QueryResult>;
 /** The original Memory host validates candidate policy and target coverage.
  * This grants no publication and does not bypass the independent reviewer. */
 validate:(draft:QueryResult)=>void;
 assertCurrent:()=>void;
 generationContract:string;
};
type Work={members?:MemoryWorkMember[];contextMembers?:MemoryWorkMember[];workContract?:MemoryWorkContract;[key:string]:unknown};
const inScope=(range:{id:string;offset:number;length:number},scope:ScopedCodingScope)=>scope.ranges.some(allowed=>range.id===allowed.id&&range.offset>=allowed.offset&&range.offset+range.length<=allowed.offset+allowed.length);

/** The policy/model/range identity is host-authored and checked again at reuse.
 * An artifact cannot supply a looser admission policy or expand the batch. */
export function codingGenerationContract(input:ScopedMemoryTask,base:QueryInput){return memoryHash({productsVersion:3,strategy:input.strategy,model:input.model,binding:input.binding,profile:input.profile,question:base.question,work:base.taskContext?.memoryWork,timeZone:base.timeZone,contextTime:base.contextTime,ranges:base.evidenceRanges});}
export function reuseScopedCoding(prepared:ScopedCodingPreparation,input:ScopedMemoryTask,base:QueryInput):QueryResult|undefined{
 const ranges=(value:readonly Range[])=>[...value].sort((a,b)=>a.id.localeCompare(b.id)||a.offset-b.offset);
 const work=base.taskContext?.memoryWork as Work|undefined;
 if(prepared.version!==1||prepared.complete!==true||!work?.members||!prepared.candidateResult||prepared.generationContract!==codingGenerationContract(input,base)||prepared.workContract!==work.workContract||JSON.stringify(ranges(prepared.ranges))!==JSON.stringify(ranges(input.ranges??[])))return;
 try{const coverage=readMemoryWorkCoverage(prepared.candidateResult,work.members,undefined,undefined,work.workContract);if(coverage.incomplete||coverage.saturated||coverage.notAssessed.length||coverage.missing.length)return;}catch{return;}
 return prepared.candidateResult;
}

/** One shared semantic product contract runs behind account-bound query,
 * validation and publication ports. The returned preparation is persisted by
 * the Memory host before publishing navigation or starting extraction. */
export async function prepareScopedCoding(scope:ScopedCodingScope,base:QueryInput,ports:CodingPorts):Promise<ScopedCodingPreparation>{
 ports.assertCurrent();base.signal?.throwIfAborted();
 const work=base.taskContext?.memoryWork as Work|undefined;
 const selectedMembers=work?.members?.filter(member=>inScope(member,scope));
 const selectedWork=work?{...work,members:selectedMembers,contextMembers:work.contextMembers?.filter(member=>inScope(member,scope)),...(selectedMembers?{instruction:memoryWorkInstruction(selectedMembers,undefined,work.workContract)}:{})}:undefined;
 const contract=selectedWork?.workContract;
 const parse=(result:QueryResult)=>{
  const {coverage,capacity,...raw}=JSON.parse(result.answer);
  if(contract&&capacity!==undefined)throw new MemoryOutputValidationError('schema','Range evaluation does not accept legacy capacity',{workContract:contract});
  const products=parseConversationProducts(JSON.stringify(raw),scope,result.citations.map(citation=>citation.id),8,contract);
  const draft={...result,answer:JSON.stringify({memories:products.memoryCandidates,...(selectedWork?{coverage,...(contract?{}:{capacity})}:{})})};
  ports.validate(draft);
  if(selectedMembers){const accounting=readMemoryWorkCoverage(draft,selectedMembers,undefined,id=>scope.records.find(record=>record.id===id)?.ocrText,contract);if(accounting.missing.length||accounting.notAssessed.length)throw new MemoryOutputValidationError('coverage','Every supplied conversation target requires completed evaluation',{workContract:contract});}
  else if(coverage!==undefined||capacity!==undefined)throw new MemoryOutputValidationError('schema','Conversation products must not invent a coverage contract');
  return products;
 };
 const result=await ports.query({...base,skill:undefined,traceContext:{...base.traceContext,phase:'coding-understanding'},executionLane:'background',responseMode:'memory-extraction',
  contextTime:scope.records.map(record=>record.capturedAt).sort().at(-1),
  evidenceIds:scope.records.map(record=>record.id),evidenceRanges:scope.ranges,
  evidenceReadRanges:scope.ranges,processingImages:undefined,
  ...(base.processingEvidence?{processingEvidence:Object.fromEntries(Object.entries(base.processingEvidence).filter(([id])=>scope.records.some(record=>record.id===id)))}:{}),
  processingMaterialInputs:[{materialId:scope.material.id,required:['coding-dialogue'],fingerprint:scope.fingerprint,evidenceIds:scope.records.map(record=>record.id)}],
  taskContext:{...base.taskContext,turns:base.taskContext?.turns??[],...(selectedWork?{memoryWork:selectedWork}:{})},
  question:'The following guidance applies only to memoryCandidates. Its sample memories envelope is subordinate to the final unified contract.\n'+base.question+
   '\nFINAL UNIFIED RESPONSE CONTRACT:\n'+(contract?CONVERSATION_UNDERSTANDING_PROMPT.replace('memoryCandidates (0–8 matching the supplied memory admission contract)','memoryCandidates (a variable selected set matching the memory contract below)'):CONVERSATION_UNDERSTANDING_PROMPT)+
   (selectedWork?'\nApply the complete supplied taskContext.memoryWork package and coverage contract to the listed original ranges. memoryCandidates is the memories array for that coverage contract. Additionally return coverage'+(contract?'':' and capacity')+'.':''),
  validateOutput:value=>{try{parse(value);return undefined;}catch(error){const detail=error instanceof MemoryOutputValidationError?error.repairInstruction:error instanceof z.ZodError?error.issues.slice(0,3).map(issue=>issue.path.join('.')+': '+issue.message).join('; '):error instanceof StoreError?error.message:'Invalid JSON object';return {code:'conversation_products',feedback:detail+' Return summary, evidence, workRecords, events, memoryCandidates and actionCues. Absent products use empty arrays; actionCues must be empty. Quote only the supplied original ranges and preserve attribution, status, basis, sourceTime and uncertainty.'};}},
 });
 base.signal?.throwIfAborted();ports.assertCurrent();const products=parse(result),text=conversationProductText(products);
 const externalId='coding-understanding:'+scope.fingerprint;
 const materialDraft:MaterialDraft={id:materialId(scope.material.origin.sourceId,externalId),kind:'summary',schemaVersion:1,
  title:scope.material.title,origin:{...scope.material.origin,externalId},
  members:[{id:'conversation',kind:'material',ref:scope.material.id+'@'+scope.material.revision,revision:scope.material.revision}],
  // Memory candidates are deliberately absent: this projection is searchable
  // navigation and must never expose a rejected draft as a published Memory.
  blocks:[{id:'understanding',kind:'text',format:'markdown',text,memberIds:['conversation']},
   {id:'work-records',kind:'text',format:'json',text:JSON.stringify({workRecords:products.workRecords}),memberIds:['conversation']},
   {id:'events',kind:'text',format:'json',text:JSON.stringify({events:products.events}),memberIds:['conversation']}],
  coverage:{state:'partial',reason:'bounded_conversation_interpretation'},
  artifacts:[{key:'coding-understanding',state:'ready',revision:scope.fingerprint,blockIds:['understanding']},
   {key:'work-records',state:'ready',revision:scope.fingerprint,blockIds:['work-records']},
   {key:'events',state:'ready',revision:scope.fingerprint,blockIds:['events']}],
  fidelity:{state:'summary-only',limitations:['model_interpretation','bounded_conversation']},retention:{original:'retained',policy:'keep'}};
 const {coverage,capacity}=JSON.parse(result.answer),candidateResult={...result,answer:JSON.stringify({memories:products.memoryCandidates,...(selectedWork?{coverage,...(contract?{}:{capacity})}:{})})};
 ports.assertCurrent();return {version:1,complete:true,generationContract:ports.generationContract,workContract:contract,candidateResult,fingerprint:scope.fingerprint,runId:result.runId,materialRef:scope.material.ref,ranges:scope.ranges.map(range=>({...range})),products,text,materialDraft};
}

/** Call only through the current Memory grant's commit fence after durable
 * preparation. PrivateData keeps dependency visibility and source withdrawal. */
export function publishScopedCoding(data:ScopedMemoryData,scope:ScopedCodingScope,prepared:ScopedCodingPreparation,assertCurrent:()=>void){
 assertCurrent();if(prepared.version!==1||prepared.fingerprint!==scope.fingerprint||prepared.materialRef!==scope.material.ref||memoryHash(prepared.ranges)!==memoryHash(scope.ranges)||data.privateData.material(scope.material.id).revision!==scope.material.revision)throw new PrivateDataError('conflict',409);
 const published=data.privateData.publishMaterial(prepared.materialDraft);assertCurrent();return {id:published.id,revision:published.revision,ref:published.ref};
}

/** The later extractor/reviewer receives untrusted navigation and retains its
 * original evidence range, independent validation and independent review. */
export function codingInterpretation(prepared:ScopedCodingPreparation,published:{id:string;revision:string;ref:string}){
 return {kind:'coding-conversation-understanding',artifactRef:published.ref,materialRef:prepared.materialRef,ranges:prepared.ranges,summary:prepared.text};
}
