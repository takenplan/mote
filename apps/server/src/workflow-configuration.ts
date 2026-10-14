import {z} from 'zod';
export const WORKFLOW_LANES=['extract','aggregate','semantic','memory'] as const;
export type WorkflowLane=typeof WORKFLOW_LANES[number];
const laneSchema=(concurrency:number)=>z.object({concurrency:z.number().int().min(1).max(8).default(concurrency),enabled:z.boolean().default(true)}).strict().default({});
export const workflowConfigurationSchema=z.object({extract:laneSchema(1),aggregate:laneSchema(2),semantic:laneSchema(1),memory:laneSchema(1)}).strict();
export type WorkflowConfiguration=z.infer<typeof workflowConfigurationSchema>;
export function defaultWorkflowConfiguration(limits:Partial<Record<WorkflowLane,{concurrency:number;enabled?:boolean}>>={}):WorkflowConfiguration{return workflowConfigurationSchema.parse(limits);}
