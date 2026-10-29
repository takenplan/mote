import type {AttributionContext} from '@mote/shared';
export type NoteReadSpan={blockId:string;kind:'text'|'asset';format?:string;evidenceId?:string;evidenceOffset?:number;pageRange:{start:number;end:number};materialRange:{start:number;end:number};memberIds:string[];locator?:Record<string,unknown>;asset?:{hash:string;mimeType:string};attributionContext?:AttributionContext};
export type NoteReadText={text:string;spans?:NoteReadSpan[];material?:{attributionContext?:AttributionContext}};
/** A page's host-declared UTF-16 spans, never a guess based on source text or JSON shape. */
export function noteMaterialPage(page:NoteReadText){
 const valid=(page.spans??[]).filter(span=>Number.isSafeInteger(span.pageRange.start)&&Number.isSafeInteger(span.pageRange.end)&&span.pageRange.start>=0&&span.pageRange.end>=span.pageRange.start&&span.pageRange.end<=page.text.length);
 const plain=valid.filter(span=>span.kind==='text'&&span.format==='plain'),body=(span:NoteReadSpan)=>page.text.slice(span.pageRange.start,span.pageRange.end);
 const descriptions=new Map<string,string>();
 const context=page.material?.attributionContext;
 for(const item of context?.recordContextStatements??[])if(item.version===1&&context?.recordContextDeclarations?.some(pin=>pin.captureId===item.captureId&&pin.version===item.version&&/^[a-f0-9]{64}$/.test(pin.fingerprint))&&typeof item.description==='string'&&item.description.length)descriptions.set(JSON.stringify([item.captureId,item.version,item.description]),item.description);
 return {quotes:plain.filter(span=>span.blockId==='shared-original').map(body),records:plain.filter(span=>span.blockId==='record').map(body),other:plain.filter(span=>!['record','shared-original'].includes(span.blockId)).map(body),assets:valid.filter(span=>span.kind==='asset'),descriptions:[...descriptions.values()]};
}
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
/** These two attachment identities are declared by the authored-record schema, not parsed from prose. */
export function noteAssetTarget(span:NoteReadSpan):{kind:'archive'|'capture';id:string}|undefined {
 if(span.kind!=='asset'||!span.asset||!/^[a-f0-9]{64}$/.test(span.asset.hash)||!span.asset.mimeType)return;
 const fileId=span.locator?.fileId;
 if(typeof fileId==='string'&&uuid.test(fileId)&&span.blockId==='attachment:'+fileId)return{kind:'archive',id:fileId};
 const captureId=span.blockId.startsWith('record-attachment:')?span.blockId.slice('record-attachment:'.length):'';
 if(uuid.test(captureId)&&span.memberIds.includes(captureId))return{kind:'capture',id:captureId};
}
