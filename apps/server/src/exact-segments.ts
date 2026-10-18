import {createHash} from 'node:crypto';
import type {CaptureRecord} from '@mote/shared';

const hash=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
/** Mechanical archive partitioning, shared by the archive and scoped host.
 * Callers supply a single observationKey group in capture-time/ID order. */
export function partitionExactSegments(records:readonly CaptureRecord[]){
 const parts:CaptureRecord[][]=[];let part:CaptureRecord[]=[],characters=0;const texts=new Set<string>();
 for(const record of records){
  if(record.metadata?.uiPage?.version===2)continue;
  const text=record.ocrText,cost=texts.has(text)?0:Math.min(text.length,12000);
  if(part.length&&(part.length>=100||characters+cost>12000)){parts.push(part);part=[];characters=0;texts.clear();}
  part.push(record);if(!texts.has(text)){characters+=Math.min(text.length,12000);texts.add(text);}
 }
 if(part.length)parts.push(part);return parts;
}
export function describeExactSegment(records:readonly CaptureRecord[]){
 const entries=new Map<string,{text:string;ids:string[];firstAt:string;lastAt:string;complete:boolean}>();
 for(const record of records){const key=hash(record.ocrText),entry=entries.get(key)??{text:record.ocrText.slice(0,12000),ids:[],firstAt:record.capturedAt,lastAt:record.capturedAt,complete:record.ocrText.length<=12000};entry.ids.push(record.id);entry.lastAt=record.capturedAt;entries.set(key,entry);}
 const values=[...entries.values()],text=values.map(e=>e.text).filter(Boolean).join('\n\n').slice(0,12000),metadata={grouping:'fixed_time_and_explicit_identity',semanticGrouping:false,observationCount:records.length,uniqueTexts:entries.size,complete:values.every(e=>e.complete)&&values.reduce((n,e)=>n+e.text.length+2,0)<=12002,entries:values.map(({text,...e})=>({...e,characters:text.length})),originalCharacters:records.reduce((n,r)=>n+r.ocrText.length,0),characters:text.length};
 return {text,metadata,representativeIds:values.map(e=>e.ids[0]!)};
}
