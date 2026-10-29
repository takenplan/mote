import type {Api} from './api';
import type {Material} from './Materials';
type SourcePage={material:{id:string;ref:string;revision:string;kind:string;schemaVersion:number;textLength:number;blockCount:number};items:{type:string;text:string;blockId:string}[];next:{block:number;offset:number}|null};
/** Existing declared source presentation, at one immutable revision. Metadata and
 * assets are navigation facts; they never become an invented excerpt. */
export async function sourceMaterialExcerpt(api:Api,item:Pick<Material,'id'|'ref'|'revision'>,signal:AbortSignal){
 let block=0,offset=0,total:number|undefined,blocks:number|undefined,maxPages=1;
 for(let pageIndex=0;pageIndex<maxPages;pageIndex++){
  signal.throwIfAborted();const page=await api.request<SourcePage>('/api/materials/'+encodeURIComponent(item.id)+'/source-view?'+new URLSearchParams({revision:item.revision,block:String(block),offset:String(offset),length:'8000'}),{signal});signal.throwIfAborted();
  const m=page.material;
  if(m?.id!==item.id||m.ref!==item.ref||m.revision!==item.revision||m.kind!=='mote.file'||![1,2].includes(m.schemaVersion)||!Number.isSafeInteger(m.textLength)||m.textLength<0||!Number.isSafeInteger(m.blockCount)||m.blockCount<0||!Array.isArray(page.items))return;
  if(total===undefined){total=m.textLength;blocks=m.blockCount;maxPages=Math.ceil(total/8000)+blocks+2;if(!Number.isSafeInteger(maxPages))return;}else if(total!==m.textLength||blocks!==m.blockCount)return;
  for(const entry of page.items){
   if(typeof entry.blockId!=='string'||typeof entry.text!=='string')return;
   if((entry.type==='text'||entry.type==='source')&&entry.text.length)return entry.text.slice(0,240);
  }
  if(page.next===null)return;
  const next=page.next;if(!next||!Number.isSafeInteger(next.block)||!Number.isSafeInteger(next.offset)||next.block<block||next.block>m.blockCount||next.offset<0||next.offset>250000||next.block===block&&next.offset<=offset)return;
  block=next.block;offset=next.offset;
 }
}
