import {z} from 'zod';

export const recordingSelectionSchema=z.object({
 enabled:z.boolean(),start:z.string().datetime({offset:true}),end:z.string().datetime({offset:true}).optional(),
 autoSync:z.boolean(),backupAudio:z.literal(true).default(true),
}).strict().refine(v=>!v.end||Date.parse(v.end)>=Date.parse(v.start),{message:'Invalid recording range'});
export type RecordingSelection=z.infer<typeof recordingSelectionSchema>;
export interface RecordingStatus {
 category?:'recordings';label?:string;setup?:{description?:string;command?:string;documentationUrl?:string};
 authorization?:RecordingAuthorizationStatus;
 provider:string;connected:boolean;accountName?:string;sourceId?:string;selection:RecordingSelection;
 steps:{id:string;phase:string;state:string;attempts:number;title?:string;availableAt?:number;error?:string}[];
 stepsTotal?:number;
 counts:{transcripts:number;audio:number;empty?:number;pending:number;failed:number};error?:string;
}

export interface RecordingEnvironment {installed:boolean;version?:string;configured:boolean;error?:string}
export interface RecordingAuthorizationStatus {
 revision:string;environment?:RecordingEnvironment;
 task?:{id:string;kind:'setup'|'configure'|'login';state:'running'|'waiting'|'completed'|'failed'|'cancelled';authorizationUrl?:string;expiresAt?:string;error?:string};
}
