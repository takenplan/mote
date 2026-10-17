import {z} from 'zod';
import type {GoogleDependencies} from '../connectors/google.js';
import type {LarkRunner} from '../connectors/lark-cli.js';
import type {DwsRunner} from '../connectors/dingtalk-recordings.js';
export const connectorId=z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,79}$/);
export const providerId=z.string().regex(/^[a-z][a-z0-9.-]{1,79}$/);
export type ConnectorProvider=z.infer<typeof providerId>;
export const connectionSchema=z.object({id:connectorId,provider:providerId,syncIntervalMs:z.number().int().min(60000).max(2147483647).default(300000),autoSync:z.boolean().default(true),googleClientId:z.string().max(2000).optional(),googleClientSecret:z.string().max(4000).optional(),googleRedirectUri:z.string().url().max(4000).optional()}).strict();
export const connectorSettings=z.object({connections:z.array(connectionSchema).max(1000)}).strict().superRefine(({connections},ctx)=>{if(new Set(connections.map(c=>c.id)).size!==connections.length)ctx.addIssue({code:'custom',message:'Duplicate connection'});});
export type ConnectionSettings=z.infer<typeof connectionSchema>;
export const connectorTask=z.object({connectionId:connectorId,generation:z.number().int().positive(),snapshotId:z.string().uuid(),action:z.enum(['oauth','sync','operation']),operation:z.string().max(80).optional(),payloadRef:z.string().uuid().optional(),state:z.string().max(200).optional(),due:z.number().int().nonnegative().default(0),recurring:z.boolean().default(false)}).strict();
export type ConnectorTask=z.infer<typeof connectorTask>;
/** Dependency injection is transport-only. The real adapter, state machine,
 * executor, source capability and SQLite are always used in fixture acceptance. */
export type ConnectorTransports={google?:(scope:{userId:string;instanceId:string})=>GoogleDependencies;lark?:(scope:{userId:string;instanceId:string;directory:string})=>LarkRunner;dingtalk?:(scope:{userId:string;instanceId:string;directory:string})=>DwsRunner};

/** Trusted deployment code extends the M09 catalog before first admission.
 * A normal user supplies only an installed provider id, never this factory. */
export interface ConnectorAdapter {
 init?():Promise<void>;
 status():unknown|Promise<unknown>;
 sync(automatic?:boolean):Promise<unknown>;
 disconnect():Promise<unknown>;
 close():Promise<void>;
 operate?(operation:string,payload:Record<string,unknown>):Promise<unknown>;
 oauth?:{start():Promise<{authorizationUrl:string;expiresIn:number}>;callback(state:string,code:string):Promise<unknown>};
}
export interface ConnectorDefinition {
 id:string;version:string;name:string;
 operations?:Readonly<Record<string,z.ZodType<Record<string,unknown>>>>;
 create(context:import('../connectors/ports.js').LarkContext,scope:Readonly<{userId:string;instanceId:string;directory:string}>,signal:AbortSignal):ConnectorAdapter|Promise<ConnectorAdapter>;
}
