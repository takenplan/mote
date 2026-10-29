import {useEffect,useMemo,useState} from 'react';
import {decodeSourceText} from '@mote/shared';
import type {Api,Capture} from './api';
type Span={blockId:string;kind:string;format?:string;evidenceId?:string;evidenceOffset?:number;pageRange:{start:number;end:number};materialRange:{start:number;end:number};locator?:Record<string,unknown>};
type Page={material:{id:string;revision:string;ref:string;kind:string;schemaVersion:number;textLength:number;blockCount:number};text:string;textRange:{offset:number;total:number;nextOffset:number|null};spans:Span[]};
function speechBody(canonical:string,locator?:Record<string,unknown>){
 const end=canonical.indexOf('\n');if(end<0)return;let header:unknown;try{header=JSON.parse(canonical.slice(0,end));}catch{return;}
 if(!header||typeof header!=='object'||Array.isArray(header)||Object.keys(header).some(key=>!['speaker','speakerAttribution','imageLocation'].includes(key)))return;
 const decoded=decodeSourceText('speech-text-v2',canonical);if(decoded?.kind!=='speech')return;
 if(locator&&JSON.stringify(decoded.imageLocation)!==JSON.stringify(locator.imageLocation))return;return decoded.text;
}
const pinPattern=/^(material:(mat_[a-f0-9]{64})@([a-f0-9]{64}))#(chunk:([a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}))$/i;
/** The owner API has already checked this opaque pin against the complete stored anchor bytes. */
export function mediaEvidencePin(capture:Capture|undefined){
 const uri=capture?.provenance?.uri;
 if(!capture||capture.source!=='file'||capture.provenance?.layer!=='derived'||typeof uri!=='string'||capture.libraryVersion!==uri)return;
 const match=pinPattern.exec(uri);return match?{ref:match[1],id:match[2],revision:match[3],blockId:match[4],chunkId:match[5]}:undefined;
}
/** Read only the selected immutable Material until its declared chunk is found.
 * The existing API exposes no block-position index. Returned continuation offsets,
 * text length and block count bound this walk; no newer parent file is consulted. */
export async function pinnedMediaText(api:Api,capture:Capture,signal:AbortSignal):Promise<string|undefined>{
 const pin=mediaEvidencePin(capture);if(!pin)return;
 let offset=0,total:number|undefined,blocks:number|undefined,maxPages=1;
 for(let count=0;count<maxPages;count++){
  signal.throwIfAborted();
  const page=await api.request<Page>(`/api/materials/${pin.id}/read?revision=${pin.revision}&offset=${offset}&length=12000`,{signal});signal.throwIfAborted();
  const m=page.material,r=page.textRange;
  if(m?.id!==pin.id||m.revision!==pin.revision||m.ref!==pin.ref||m.kind!=='mote.file'||m.schemaVersion!==2||!Number.isSafeInteger(m.textLength)||m.textLength<0||!Number.isSafeInteger(m.blockCount)||m.blockCount<0||r?.offset!==offset||r.total!==m.textLength||typeof page.text!=='string'||!Array.isArray(page.spans))return;
  if(total===undefined){total=m.textLength;blocks=m.blockCount;maxPages=Math.ceil(total/11999)+Math.ceil(blocks/64)+2;if(!Number.isSafeInteger(maxPages))return;}else if(m.textLength!==total||m.blockCount!==blocks)return;
  const candidates=page.spans.filter(span=>span.blockId===pin.blockId);
  if(candidates.length){
   if(candidates.length!==1)return;const span=candidates[0],a=span.pageRange,b=span.materialRange,e=span.evidenceOffset;
   if(span.kind!=='text'||span.format!=='speech-text'||span.evidenceId!==capture.id||span.locator?.chunkId!==pin.chunkId||span.locator.textStart!==0||span.locator.textEnd!==capture.ocrText.length||typeof e!=='number'||!a||!b||![a.start,a.end,b.start,b.end,e].every(value=>Number.isSafeInteger(value))||a.start<0||a.end<=a.start||a.end>page.text.length||b.start<offset||b.end>b.start+12000||b.end>r.total||b.end-b.start!==a.end-a.start||e<0||b.start-e<0||e+a.end-a.start>capture.ocrText.length+1)return;
   // Material serialization appends exactly one separator, outside anchor content.
   if(page.text.slice(a.start,a.end)!==(capture.ocrText+'\n').slice(e,e+a.end-a.start))return;
   return speechBody(capture.ocrText,span.locator);
  }
  const next=r.nextOffset;if(next===null)return;if(!Number.isSafeInteger(next)||next<=offset||next>r.total)return;offset=next;
 }
}
export function useMediaEvidenceText(api:Api,capture:Capture|undefined){
 const direct=capture?.evidencePresentation==='speech-text-v2'?speechBody(capture.ocrText):capture?.evidencePresentation==='speech-json-v1'?decodeSourceText(capture.evidencePresentation,capture.ocrText):undefined;
 const declared=typeof direct==='string'?direct:direct?.kind==='speech'?direct.text:undefined;
 const pin=declared===undefined?mediaEvidencePin(capture):undefined,identity=useMemo(()=>({api,id:capture?.id,pin:capture?.libraryVersion,text:capture?.ocrText,format:capture?.evidencePresentation}),[api,capture?.id,capture?.libraryVersion,capture?.ocrText,capture?.evidencePresentation]);
 const [resolved,setResolved]=useState<{identity:typeof identity;text?:string}>();
 useEffect(()=>{if(!capture||!pin)return;const controller=new AbortController();void pinnedMediaText(api,capture,controller.signal).then(text=>{if(!controller.signal.aborted)setResolved({identity,text});}).catch(()=>{if(!controller.signal.aborted)setResolved({identity});});return()=>controller.abort();},[identity]);
 return {loading:Boolean(pin)&&resolved?.identity!==identity,text:declared??(resolved?.identity===identity?resolved.text:undefined)};
}
