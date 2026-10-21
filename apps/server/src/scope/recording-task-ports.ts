import type {RecordingPhase} from '../connectors/recording-flow.js';
export type RecordingTaskView={id:string;state:'waiting'|'running'|'succeeded'|'failed'|'blocked'|'cancelled'|'stale';attempts:number;availableAt:number;error?:string;failure?:{code:string}};
/** The same account-bound M05 executor owns every admitted phase. These ports
 * carry no user selector, provider transport or independent timer. */
export interface RecordingTaskPorts {
 parentId?:string;
 get(id:string):RecordingTaskView;
 submit?(phase:RecordingPhase,key:string,onAdmitted:(id:string)=>void):Promise<RecordingTaskView>;
 retry?(id:string):RecordingTaskView;
 /** Only a genuine explicit owner command supplies this atomic one-shot group. */
 retryGroup?:{read:()=>readonly string[]|undefined;commit:(ids:readonly string[],attach:()=>void)=>void};
}
