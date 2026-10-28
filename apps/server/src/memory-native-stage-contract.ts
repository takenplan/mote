import type {QueryInput} from '@mote/agent';
import type {QueryResult} from '@mote/shared';
import type {Memory} from './memory-schema.js';
import type {MemoryProviderNamespace} from './memory-provider-contract.js';

export type MemoryEngineDraftContext={phase:'extract'|'integrate';opId:string;evidenceIds:string[];checkpointId?:string;cleanupGeneration?:string;relatedMemories?:Memory[];assertAuthority?:()=>void;provider?:{instanceId:string;configurationIdentity:string;namespace:MemoryProviderNamespace}};
export type MemoryEngineDraftPin=Omit<MemoryEngineDraftContext,'relatedMemories'|'assertAuthority'>;
export function memoryEngineDraftPin(context:MemoryEngineDraftContext):MemoryEngineDraftPin{const {relatedMemories:_,assertAuthority:__,...pin}=context;return structuredClone(pin);}

/** Semantic transport only. The host owns durable pins and cleanup recovery. */
export type MemoryNativeStageAdapter={
  prepare?:(input:QueryInput,context:MemoryEngineDraftContext)=>Promise<QueryResult|undefined>;
  settle?:(context:MemoryEngineDraftPin)=>Promise<void>;
};
export interface MemoryNativeStagePort {
  prepare(input:QueryInput,context:MemoryEngineDraftContext):Promise<QueryResult|undefined>;
  settle(context:MemoryEngineDraftContext|MemoryEngineDraftPin):Promise<void>;
  abandon(context:MemoryEngineDraftContext|MemoryEngineDraftPin):void;
}
