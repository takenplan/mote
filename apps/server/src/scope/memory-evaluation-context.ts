import {z} from 'zod';
import {PrivateDataError} from './private-data-sql.js';

/** Semantic evaluation time only. Never an execution clock or a read grant. */
export const memoryEvaluationTimeSchema=z.string().max(64).datetime({offset:true}).refine(value=>Number.isFinite(Date.parse(value)));
export const memoryEvaluationContextSchema=z.object({time:memoryEvaluationTimeSchema,inputs:z.array(z.object({id:z.string().uuid(),time:memoryEvaluationTimeSchema}).strict()).min(1)}).strict().refine(value=>new Set(value.inputs.map(input=>input.id)).size===value.inputs.length);
export type MemoryEvaluationContext=z.infer<typeof memoryEvaluationContextSchema>;
type Evaluated={evaluationContext:MemoryEvaluationContext};

export function freezeMemoryEvaluationTime(clock:()=>string=()=>new Date().toISOString()){return memoryEvaluationTimeSchema.parse(clock());}
export function memoryEvaluationContext(time:string,inputs:readonly {id:string;time?:string}[]):MemoryEvaluationContext{
 const values=new Map<string,{id:string;time:string}>();
 for(const input of inputs){const value={id:input.id,time:input.time??time},prior=values.get(input.id);if(prior&&prior.time!==value.time)throw new PrivateDataError('conflict',409);values.set(input.id,value);}
 return memoryEvaluationContextSchema.parse({time,inputs:[...values.values()]});
}
export function memoryEvaluationTime(input:Evaluated,id?:string):string{
 if(id===undefined)return input.evaluationContext.time;
 const value=input.evaluationContext.inputs.find(value=>value.id===id);if(!value)throw new PrivateDataError('conflict',409);return value.time;
}
export function selectMemoryEvaluationContext(input:Evaluated,ids:readonly string[],time=input.evaluationContext.time):MemoryEvaluationContext{
 return memoryEvaluationContext(time,[...new Set(ids)].map(id=>({id,time:memoryEvaluationTime(input,id)})));
}
/** Only clock metadata is excluded; every original policy field still groups. */
export function memoryIntakePolicy(value:Record<string,unknown>){const {evaluationTime:_,...policy}=value;return policy;}
