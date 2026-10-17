import type {ModelFeature,ModelSettings} from '@mote/shared/models';
import type {ConfigDocument} from '@mote/shared/config-file';
import type {TokenUsage} from '@mote/shared';
import type {Configurations,ModelLease,UserConfigurationService} from './configuration.js';

/** Genuine M04 host objects; persisted receipts only locate its encrypted
 * snapshot and can never be deserialized into a usable lease. */
export type TaskModelLease=ModelLease;
export type TaskModelConfiguration=Pick<UserConfigurationService,'lease'|'restoreLease'>;
export type TaskModelUsage={status:'completed'|'failed';durationMs:number;tokens?:TokenUsage};
export type TaskModelHost=Pick<Configurations,'assertLease'|'withModel'|'recordUsage'|'restoreLease'>;
export type TaskModelRun={lease:TaskModelLease;withModel:<T>(work:(settings:Readonly<ModelSettings>,configuration:Readonly<ConfigDocument>)=>Promise<T>)=>Promise<T>;recordUsage:(result:TaskModelUsage)=>unknown};
