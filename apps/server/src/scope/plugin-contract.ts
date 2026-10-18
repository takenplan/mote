import {z} from 'zod';
import type {FeatureComponent,PluginCapability} from '@mote/shared';
import type {UserContext} from './context.js';
import type {TaskRun} from './task-execution.js';
import type {ModelFeature} from '@mote/shared/models';
import type {PluginRuntime} from '../plugin-runtime.js';

export const PLUGINS_DOMAIN='plugins';
export const PLUGIN_CONFIGURATION_DOMAIN='pluginInstances';
export const pluginCapability=z.enum(['source','processor','repository','retrieval','engine','model','ui']);
export type PluginCapabilityId=z.infer<typeof pluginCapability>;
export const componentSchema=z.object({id:z.string().min(1).max(160),version:z.string().min(1).max(80),surface:z.enum(['ingress','processing','data','agent','card','panel','settings']),capability:pluginCapability}).strict();
export type PluginComponent=z.infer<typeof componentSchema>;
export const instanceSchema=z.object({id:z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,127}$/),packageId:z.string().min(1).max(240),name:z.string().trim().min(1).max(160),configuration:z.record(z.union([z.string(),z.number().finite(),z.boolean()])),desired:z.boolean().default(false),revocation:z.string().max(100).default('initial'),grants:z.object({capabilities:z.array(pluginCapability).max(7),sourceIds:z.array(z.string().min(1).max(256)).max(1000),history:z.boolean().default(false)}).strict()}).strict();
export type UserPluginInstance=z.infer<typeof instanceSchema>;
export const pluginConfigurationSchema=z.object({instances:z.array(instanceSchema).max(1000)}).strict().superRefine(({instances},ctx)=>{if(new Set(instances.map(i=>i.id)).size!==instances.length)ctx.addIssue({code:'custom',message:'Duplicate plugin instance identity'});});
export type PluginConfiguration=z.infer<typeof pluginConfigurationSchema>;
export const invokeSchema=z.object({snapshotId:z.string().uuid(),componentId:z.string().min(1).max(160),payload:z.record(z.unknown())}).strict();
/** M03 binds this to its IngressHost.bindSource. This contract is host-only;
 * worker RPCs receive methods and values, never context, SQLite or host paths. */
export type SourceCapabilityBinder=(context:UserContext,sourceIds:readonly string[],assertCurrent:()=>void)=>Readonly<Record<string,(...input:any[])=>unknown|Promise<unknown>>>;
export type PluginInvocation=Readonly<{
 context:UserContext;instanceId:string;snapshotId:string;packageId:string;
 configuration:Readonly<Record<string,string|number|boolean>>;
 sourceIds:readonly string[];history:boolean;
 namespace:Readonly<{ownerId:string;instanceId:string;bindingRevision:number}>;
 component:PluginComponent;run:TaskRun;assertCurrent:()=>void;
}>;
/** Each domain supplies its existing validator/publication mechanism. Returning
 * a value does not publish it; commit is synchronous inside M05's transaction. */
export interface PluginDomainAdapter {
 modelFeature?:ModelFeature;
 bind?(invocation:PluginInvocation):Readonly<Record<string,(...input:any[])=>unknown|Promise<unknown>>>;
 validateResult(value:unknown,invocation:PluginInvocation):unknown;
 commit?(value:unknown,invocation:PluginInvocation):void;
 validateHistory?(value:unknown,input:Readonly<{context:UserContext;sourceIds:readonly string[];assertCurrent:()=>void;namespace:PluginInvocation['namespace'];method:'read'|'search'|'export';params:Record<string,unknown>}>):unknown|Promise<unknown>;
}
export type ScopedPluginComponent=FeatureComponent&{capability:PluginCapabilityId};
/** Trusted host recipe factory. Construction is synchronous, like the existing
 * worker adapters; asynchronous initialization belongs in call(). Paths and
 * owner facts stay in this host boundary and are never worker/user arguments. */
export type PluginRuntimeFactory=(scope:Readonly<{userId:string;instanceId:string;generation:number;directory:string;configuration:Readonly<Record<string,string|number|boolean>>}>)=>PluginRuntime;

/** Capability owners execute the real provider check under this fixed host
 * scope. Generated probe storage and cleanup never reuse live provider data. */
export type PluginCapabilityProbe=(input:Readonly<{
 context:UserContext;instance:UserPluginInstance;components:readonly PluginComponent[];packageId:string;adapter?:string;
 directory:string;namespace:PluginInvocation['namespace'];signal:AbortSignal;
 assertCurrent:()=>void;runtime:()=>PluginRuntime;restart:()=>Promise<PluginRuntime>;
 onClose:(close:()=>Promise<void>)=>void;
}>)=>Promise<{capabilities:PluginCapability[];issues:string[]}>;
