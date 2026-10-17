import {z} from 'zod';
import {sourceIdSchema,sourceItemSchema,type SourceConnection} from '@mote/shared';
import type {PrivateData} from './private-data.js';
import type {IngressHost} from './ingress.js';
import type {UserContext} from './context.js';
import {missing} from './private-data-sql.js';
import {identityHash} from './originals.js';

/** Source metadata and explicit M03 write capability only. All content reads
 * use McpQuery's genuine M08 reader, with no direct M02 fallback. */
export function mcpSources(data:PrivateData,ingress:IngressHost,context:UserContext,ids:readonly string[],write:boolean,assertCurrent:()=>void,sourceStatuses:(ids:readonly string[])=>ReadonlyMap<string,NonNullable<SourceConnection['status']>>){
 const source=(id:string)=>{assertCurrent();sourceIdSchema.parse(id);if(ids.length&&!ids.includes(id))throw missing();const result=data.source(id);if(!result.enabled)throw missing();return result;};
 const check=()=>{assertCurrent();for(const id of ids)source(id);};
 const result={
  check,
  sources:()=>{check();const selected=data.sources().filter(value=>(!ids.length||ids.includes(value.id))&&value.enabled),states=sourceStatuses(selected.map(source=>source.id)),items=selected.map(({id,name,kind,retention,deviceId,platform,enabled,createdAt,updatedAt})=>({id,name,kind,retention,deviceId,platform,enabled,createdAt,updatedAt,...(states.has(id)?{status:states.get(id)}:{})}));check();return {items};},
  put:(raw:unknown)=>{const input=z.object({sourceId:sourceIdSchema,item:sourceItemSchema}).strict().parse(raw);if(!write||!ids.includes(input.sourceId))throw missing();source(input.sourceId);const result=ingress.bindSource(context,[input.sourceId],assertCurrent).receiveSourceItems(input.sourceId,'mcp:'+identityHash(input.item),[input.item]);check();return result;},
 };
 return Object.freeze(result);
}
export type McpSources=ReturnType<typeof mcpSources>;
