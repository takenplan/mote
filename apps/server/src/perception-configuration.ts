import {z} from 'zod';
const endpoint=z.string().max(2048).refine(value=>{if(!value)return true;try{const u=new URL(value);return ['http:','https:'].includes(u.protocol)&&!u.username&&!u.password&&!u.search&&!u.hash&&(u.protocol==='https:'||['127.0.0.1','localhost','[::1]'].includes(u.hostname));}catch{return false;}},'Use HTTPS or loopback HTTP');
export const perceptionSettingsSchema=z.object({
  ocrProcessorId:z.string().max(100).default('image.http'),concurrency:z.number().int().min(1).max(8).default(1),
  providerRevision:z.string().min(1).max(128).default('1'),enabled:z.boolean().default(true),ocrEndpoint:endpoint.default(''),
  allowExternalProcessing:z.boolean().default(false),allowQueryImages:z.boolean().default(false),
}).strict();
export const imageSettingsSchema=perceptionSettingsSchema.extend({understandingEnabled:z.boolean().default(true),profileId:z.string().max(100).optional()});
/** The endpoint and selected profile belong to processing.policy, avoiding duplicate authority. */
export const perceptionConfigurationSchema=imageSettingsSchema.omit({ocrEndpoint:true,ocrProcessorId:true,profileId:true}).strict();
export type PerceptionConfiguration=z.infer<typeof perceptionConfigurationSchema>;
export function defaultPerceptionConfiguration():PerceptionConfiguration{return perceptionConfigurationSchema.parse({});}
