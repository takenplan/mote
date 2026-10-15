import type {ModelFeature,ModelSettings} from '@mote/shared/models';
import type {ConfigDocument} from '@mote/shared/config-file';
import type {TokenUsage} from '@mote/shared';

/** Structural subset of M04's genuine ModelLease/Configurations contract. Only
 * M04 may issue the live object. Its persisted receipt never regains authority. */
export type TaskModelLease=Readonly<{id:string;deploymentId:string;userId:string;operationId:string;feature:ModelFeature;revision:number;instanceRevision:number;reference:Readonly<{kind:'shared'|'personal';id:string}>;provider:string;model:string}>;
export interface TaskModelConfiguration {lease(feature:ModelFeature,operationId:string):Promise<TaskModelLease>}
export type TaskModelUsage={status:'completed'|'failed';durationMs:number;tokens?:TokenUsage};
export interface TaskModelHost {
 assertLease(lease:TaskModelLease):unknown;
 withModel<T>(lease:TaskModelLease,work:(settings:Readonly<ModelSettings>,configuration:Readonly<ConfigDocument>)=>Promise<T>):Promise<T>;
 recordUsage(lease:TaskModelLease,result:TaskModelUsage):unknown;
}
export type TaskModelRun={lease:TaskModelLease;withModel:<T>(work:(settings:Readonly<ModelSettings>,configuration:Readonly<ConfigDocument>)=>Promise<T>)=>Promise<T>;recordUsage:(result:TaskModelUsage)=>unknown};
