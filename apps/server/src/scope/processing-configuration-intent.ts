import {createHash} from 'node:crypto';
import {isDeepStrictEqual} from 'node:util';
import {z} from 'zod';

const digest=z.string().regex(/^[a-f0-9]{64}$/);
export const processingConfigurationInput=z.object({intentId:digest,rootIntentId:digest,originalRef:z.string().regex(/^original:[a-f0-9]{64}$/),receiptId:digest,preserveImagePlan:z.boolean()}).strict();
export type ProcessingConfigurationInput=z.infer<typeof processingConfigurationInput>;
export const processingConfigurationHash=(value:unknown):string=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
/** Revision is provenance. Only execution facts retire the current receipt. */
export function processingConfigurationChanged(before:unknown,after:unknown){const wire=(value:unknown)=>value===undefined?undefined:JSON.parse(JSON.stringify(value));return !isDeepStrictEqual(wire(before),wire(after));}
export function processingConfigurationReceipt(userId:string,epoch:number,sequence:number,facts:unknown,preserveImagePlan:boolean){
 return {id:processingConfigurationHash([userId,epoch,sequence,facts,preserveImagePlan]),sequence,facts,preserveImagePlan};
}
