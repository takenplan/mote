import {z} from 'zod';
import {fileTypePattern,processingProfileSchema,resolveFileRule} from '@mote/shared';
import {PrivateDataError} from './private-data-sql.js';
import {identityHash} from './originals.js';

/** The original named profile/rule graph, with complete M04 references replacing
 * its endpoint/key copies. This value contract grants no model or byte access. */
export const processingServiceReferenceSchema=z.object({
 id:z.string().regex(/^[a-z][a-z0-9.-]{0,99}$/),name:z.string().trim().min(1).max(100),kind:z.enum(['asr','image','file','model']),
 reference:z.object({kind:z.enum(['personal','shared']),id:z.string().min(1).max(256)}).strict(),
}).strict();
export const scopedFilePolicySchema=z.object({
 version:z.literal(1),services:z.array(processingServiceReferenceSchema).max(100),profiles:z.array(processingProfileSchema).min(1).max(100),
 rules:z.array(z.object({sourceId:z.string().min(1).max(128).optional(),type:fileTypePattern,profileId:z.string().regex(/^[a-z][a-z0-9.-]{0,99}$/)}).strict()).min(1).max(500),
}).strict().superRefine((policy,context)=>{
 const issue=(message:string)=>context.addIssue({code:'custom',message});
 for(const rows of [policy.services,policy.profiles])if(new Set(rows.map(row=>row.id)).size!==rows.length)issue('Service and profile IDs must be unique');
 if(new Set(policy.rules.map(rule=>JSON.stringify([rule.sourceId??'',rule.type]))).size!==policy.rules.length)issue('Source/type rules must be unique');
 if(!policy.rules.some(rule=>!rule.sourceId&&rule.type==='*/*'))issue('A default fallback rule is required');
 for(const rule of policy.rules)if(!policy.profiles.some(profile=>profile.id===rule.profileId))issue('Rule profile is unavailable');
 for(const profile of policy.profiles){
  for(const id of [profile.serviceId,profile.modelServiceId].filter(Boolean))if(!policy.services.some(service=>service.id===id))issue('Profile service is unavailable');
  if(profile.modelServiceId&&policy.services.find(service=>service.id===profile.modelServiceId)?.kind!=='model')issue('Analysis requires a model service');
  // Preserve the original archive profile validation; inactive imageRecipe
  // metadata is retained just as in parseFilePolicy, never executed by archive.
  if(profile.processorId==='archive'&&(profile.serviceId||profile.modelServiceId||profile.summarize||Object.keys(profile.parameters).length))issue('Archive profiles have no processing steps');
 }
});
export type ScopedFilePolicy=z.infer<typeof scopedFilePolicySchema>;
export function selectScopedFilePolicy(raw:unknown,sourceId:string,mimeType:string,override?:string){
 const policy=scopedFilePolicySchema.parse(raw);if(override!==undefined)processingProfileSchema.shape.id.parse(override);z.string().min(1).max(128).parse(sourceId);z.string().regex(/^[a-z0-9.+-]+\/[a-z0-9.+-]+$/).parse(mimeType);
 // The existing selector reads only the original rules. This adapter supplies
 // no invented endpoints/credentials and makes no model-selection fallback.
 const rule=override?{sourceId,type:mimeType,profileId:override}:resolveFileRule({version:1,rules:policy.rules,profiles:policy.profiles,services:[]},sourceId,mimeType),profile=policy.profiles.find(profile=>profile.id===rule.profileId);if(!profile)throw new PrivateDataError('conflict',409);
 const services=policy.services.filter(service=>service.id===profile.serviceId||service.id===profile.modelServiceId),parameters=Object.fromEntries(Object.entries(profile.parameters).sort(([left],[right])=>left.localeCompare(right)));
 const fingerprint=identityHash({processorId:profile.processorId,parameters,diarizationProcessor:profile.diarizationProcessor,summarize:profile.summarize,imageRecipe:profile.imageRecipe,services:services.map(({id,kind,reference})=>({id,kind,reference})).sort((left,right)=>left.id.localeCompare(right.id))});
 return {rule,profile,services,fingerprint,archiveOnly:profile.processorId==='archive'};
}
