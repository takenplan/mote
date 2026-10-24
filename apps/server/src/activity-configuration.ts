import {z} from 'zod';

/** Paid activity understanding has its own explicit, prospective permission. */
export const activityConfigurationSchema=z.object({
  enabled:z.boolean().default(false),
  modelProfileId:z.string().min(1).max(80).nullable().default(null),
}).strict().superRefine((value,ctx)=>{
  if(value.enabled&&!value.modelProfileId)ctx.addIssue({code:'custom',path:['modelProfileId'],message:'Select an activity model profile before enabling automatic understanding'});
});
export type ActivityConfiguration=z.infer<typeof activityConfigurationSchema>;
