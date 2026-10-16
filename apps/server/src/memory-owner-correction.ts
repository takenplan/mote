import {z} from 'zod';
import {memorySchema,type Memory} from './memory-schema.js';
import {memoryEvidenceReference,type MemoryRecord} from './memory-contract.js';
export const ownerMemoryCorrectionSchema=z.object({version:z.number().int().positive(),title:z.string().trim().min(1).max(160),statement:z.string().trim().min(1).max(6000),uncertainty:z.string().max(2000).default(''),validFrom:z.string().datetime({offset:true}).optional(),validUntil:z.string().datetime({offset:true}).optional()}).strict();
/** Explicit owner edits use their newly saved original note as proof. This is
 * the existing correction contract, shared by both storage adapters. */
export function prepareOwnerMemoryCorrection(original:Memory,raw:unknown,evidence:MemoryRecord,identity:{memoryId:string;at:string;fingerprint:string}){
 const input=ownerMemoryCorrectionSchema.parse(raw);if(original.version!==input.version||original.supersededBy||evidence.ocrText!==input.statement)throw new Error('Memory correction input changed');
 if(input.validUntil&&Date.parse(input.validFrom??identity.at)>=Date.parse(input.validUntil))throw new Error('Correction validity dates are reversed');
 const saved=memorySchema.parse({id:identity.memoryId,version:1,domain:original.domain,scopeRefs:original.scopeRefs,coding:original.coding?{...original.coding,validation:'user_confirmed'}:undefined,tier:original.tier,kind:original.kind,title:input.title,statement:input.statement+' ['+evidence.id+']',uncertainty:input.uncertainty,validFrom:input.validFrom??identity.at,validUntil:input.validUntil,evidenceIds:[evidence.id],evidence:[memoryEvidenceReference(evidence,{offset:0,length:input.statement.length,quote:input.statement})],createdAt:identity.at,status:'published',model:'owner',runId:'owner-correction:'+evidence.id,skillVersion:'owner-correction@1',admission:{layer:original.admission.layer,reason:'Explicit owner correction',scope:original.admission.scope,attribution:'user'},fingerprint:identity.fingerprint,relations:[{kind:'supersedes',memoryId:original.id,fingerprint:original.fingerprint,version:original.version}],correction:{memoryId:original.id,fingerprint:original.fingerprint,noteId:evidence.id}});
 const current=memorySchema.parse({...original,supersededBy:saved.id,supersededAt:saved.validFrom,version:original.version+1,updatedAt:identity.at});return {saved,current};
}
