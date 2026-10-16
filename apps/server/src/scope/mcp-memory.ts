import {z} from 'zod';
import {evidenceRefId,sourceIdSchema} from '@mote/shared';
import type {Memory} from '../memory-schema.js';
import {memoryEvidenceFingerprint} from '../memory-contract.js';
import {memoryPageFields,memoryPageSchema,memoryReadFiltersSchema} from './memory-data.js';
import type {MemoryHost} from './memory.js';
import type {UserContext} from './context.js';
import {missing,PrivateDataError} from './private-data-sql.js';

const memoryRef=z.string().max(64).refine(value=>Boolean(evidenceRefId(value,'memory')),'Invalid Memory reference');
export const mcpMemoryInput={...memoryPageFields,includeHistory:z.boolean().optional(),sourceId:sourceIdSchema.optional(),id:memoryRef.optional(),version:z.number().int().positive().optional()};
const requestSchema=z.object(mcpMemoryInput).strict();

/** A fresh request capability over the genuine M07 host. Neither a Memory card
 * nor its citation metadata is an original-disclosure grant for another tool. */
export class McpMemory{
 constructor(private readonly host:MemoryHost,private readonly context:UserContext,private readonly sourceIds:readonly string[],private readonly assertParent:()=>void,private readonly sourceFence:(ids?:readonly string[])=>()=>void){}
 request(sourceId:string|undefined,signal:AbortSignal){
  this.assertParent();signal.throwIfAborted();
  if(sourceId!==undefined){sourceIdSchema.parse(sourceId);if(this.sourceIds.length&&!this.sourceIds.includes(sourceId))throw missing();}
  // M01 [] explicitly means all. M07 [] explicitly means none: do not pass the
  // credential array through or omit a nonempty allowlist.
  const sourceIds=sourceId?[sourceId]:this.sourceIds.length?this.sourceIds:undefined;
  const fence=this.sourceFence(sourceIds),assert=()=>{this.assertParent();signal.throwIfAborted();fence();};
  const reader=this.host.bindRead(this.context,{sourceIds,assertCurrent:assert});
  const memories=new Map<string,{id:string;version:number;fingerprint:string}>(),evidence=new Map<string,{id:string;hash:string}>(),exactPins:{assertCurrent():void}[]=[];
  const remember=(memory:Memory,current=true)=>{
   assert();if(current){reader.assertMemory(memory);const old=memories.get(memory.id);if(old&&(old.version!==memory.version||old.fingerprint!==memory.fingerprint))throw new PrivateDataError('conflict',409);if(!old)memories.set(memory.id,{id:memory.id,version:memory.version,fingerprint:memory.fingerprint});}
   for(const record of reader.evidence(memory.evidenceIds)){const hash=memoryEvidenceFingerprint(record),old=evidence.get(record.id);if(old&&old.hash!==hash)throw new PrivateDataError('conflict',409);if(!old)evidence.set(record.id,{id:record.id,hash});}
  };
  const assertCurrent=()=>{assert();for(const pin of exactPins)pin.assertCurrent();for(const pin of memories.values())reader.assertMemory(pin);reader.assertEvidence([...evidence.values()]);assert();};
  return Object.freeze({assertCurrent,
   page:async(raw:unknown={})=>{
    const {id,version,sourceId:_sourceId,...args}=requestSchema.parse(raw);
    if(_sourceId!==sourceId)throw missing();
    if(version!==undefined&&!id)throw missing();
    if(id){
     const key=evidenceRefId(id,'memory')!,{cursor,limit:_limit,...rawFilters}=args;if(cursor)throw missing();
     // Explicit IDs retain the existing exact/history read semantics unless the
     // caller selects canonical-only visibility. Page reads default to current.
     const filters=memoryReadFiltersSchema.parse({...rawFilters,includeHistory:rawFilters.includeHistory??true,sourceId}),pin=reader.pin(key,version,filters);exactPins.push(pin);
     const selected=await reader.read(key,version,filters);remember(selected,false);assertCurrent();return {items:[selected],nextCursor:null};
    }
    const page=await reader.page(memoryPageSchema.parse(args));for(const memory of page.items)remember(memory);assertCurrent();return page;
   },
  });
 }
}
