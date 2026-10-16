import {z} from 'zod';
import {sourceIdSchema,sourceItemSchema} from '@mote/shared';
import type {PrivateData} from './private-data.js';
import {privateListSchema} from './private-data.js';
import type {IngressHost} from './ingress.js';
import type {UserContext} from './context.js';
import {missing} from './private-data-sql.js';
import {identityHash} from './originals.js';

/** This facade contains source capabilities only. M08 supplies the actual
 * EvidenceReader/Memory/Ask projection before those tools can be registered. */
export function mcpSources(data:PrivateData,ingress:IngressHost,context:UserContext,ids:readonly string[],write:boolean,assertCurrent:()=>void){
 const source=(id:string)=>{assertCurrent();sourceIdSchema.parse(id);if(ids.length&&!ids.includes(id))throw missing();const result=data.source(id);if(!result.enabled)throw missing();return result;};
 const readable=(id:string)=>{const result=source(id);if(result.kind==='coding-agent')throw missing();return result;};
 const material=(ref:string)=>{assertCurrent();const value=data.material(ref);readable(value.origin.sourceId);for(const id of data.materialSources(ref))readable(id);return value;};
 const check=()=>{assertCurrent();for(const id of ids)source(id);};
 const result={
  check,
  sources:()=>{check();return {items:data.sources().filter(value=>(!ids.length||ids.includes(value.id))&&value.enabled).map(value=>({id:value.id,name:value.name,kind:value.kind,retention:value.retention}))};},
  items:(raw:unknown)=>{const input=privateListSchema.extend({sourceId:sourceIdSchema,limit:z.number().int().min(1).max(50).default(20)}).strict().parse(raw);readable(input.sourceId);const page=data.captures(input,true);check();return page;},
  history:(raw:unknown)=>{const input=z.object({sourceId:sourceIdSchema,externalId:z.string().min(1).max(1000)}).strict().parse(raw);readable(input.sourceId);const items=data.sourceHistory(input.sourceId,input.externalId);check();return {items};},
  materials:(raw:unknown)=>{const input=privateListSchema.extend({sourceId:sourceIdSchema,limit:z.number().int().min(1).max(50).default(20)}).strict().parse(raw);readable(input.sourceId);const allowed=data.sources().filter(value=>value.enabled&&value.kind!=='coding-agent'&&(!ids.length||ids.includes(value.id))).map(value=>value.id),page=data.materials(input,allowed);for(const value of page.items)material(value.ref);check();return page;},
  readMaterial:(raw:unknown)=>{const input=z.object({ref:z.string().min(1).max(160),offset:z.number().int().nonnegative().default(0),length:z.number().int().min(1).max(12000).default(4000)}).strict().parse(raw);material(input.ref);const value=data.readMaterial(input.ref,input);check();return value;},
  search:(raw:unknown)=>{const input=z.object({sourceId:sourceIdSchema,query:z.string().trim().min(1).max(500),limit:z.number().int().min(1).max(50).default(20)}).strict().parse(raw);readable(input.sourceId);const result=data.search({query:input.query,limit:input.limit},[input.sourceId]);check();return result;},
  put:(raw:unknown)=>{const input=z.object({sourceId:sourceIdSchema,item:sourceItemSchema}).strict().parse(raw);if(!write||!ids.includes(input.sourceId))throw missing();source(input.sourceId);const result=ingress.bindSource(context,[input.sourceId],assertCurrent).receiveSourceItems(input.sourceId,'mcp:'+identityHash(input.item),[input.item]);check();return result;},
 };
 return Object.freeze(result);
}
export type McpSources=ReturnType<typeof mcpSources>;
