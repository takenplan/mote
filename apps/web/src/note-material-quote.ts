import type {Api,Capture} from './api';
import {noteQuoteCaptureId,type NoteReadSpan,type NoteReadText} from './note-material-render';

type PinnedPage=NoteReadText&{textRange:{offset:number;total:number;nextOffset:number|null};material:NonNullable<NoteReadText['material']>;spans?:NoteReadSpan[]};
/** Explicitly verify one complete saved quote against bounded reads of its
 * pinned host Material. No other block, member, revision or live source is
 * inferred from the text. The caller displays it only after a fresh turn read. */
export async function verifyCompleteNoteQuote(api:Api,page:PinnedPage,span:NoteReadSpan,captureId:string,snapshot:string,conversationId:string,turnId:string,signal:AbortSignal){
 const expected=snapshot+'\n',blockStart=span.materialRange.start-span.evidenceOffset!;
 if(snapshot.length>100000||noteQuoteCaptureId(page,span)!==captureId||blockStart<0||blockStart+expected.length>page.textRange.total)throw Error('Invalid saved quote range');
 if(page.text.slice(span.pageRange.start,span.pageRange.end)!==expected.slice(span.evidenceOffset!,span.evidenceOffset!+span.pageRange.end-span.pageRange.start))throw Error('Saved quote page differs');
 const material=page.material,ref=material.ref!,end=blockStart+expected.length;
 let cursor=blockStart;
 while(cursor<end){
  signal.throwIfAborted();const length=Math.min(12000,end-cursor);
  const read=await api.request<PinnedPage>(`/api/materials/${encodeURIComponent(material.id!)}/read?`+new URLSearchParams({revision:material.revision!,offset:String(cursor),length:String(length)}),{signal});
  signal.throwIfAborted();
  const part=read.spans?.[0],next=cursor+read.text.length;
  if(read.material.ref!==ref||read.textRange.offset!==cursor||read.textRange.total!==page.textRange.total||read.spans?.length!==1||!part||noteQuoteCaptureId(read,part)!==captureId||part.pageRange.start!==0||part.pageRange.end!==read.text.length||part.materialRange.start!==cursor||part.materialRange.end!==next||part.evidenceOffset!==cursor-blockStart||!read.text.length||read.text.length>length||next>end||read.text!==expected.slice(cursor-blockStart,next-blockStart)||(next<end&&read.textRange.nextOffset!==next))throw Error('Pinned quote changed or is incomplete');
  cursor=next;
 }
 const fresh=await api.request<Capture>('/api/capture-browser/'+encodeURIComponent(captureId),{signal});signal.throwIfAborted();const origin=fresh.metadata?.noteOrigin;
 if(fresh.id!==captureId||fresh.source!=='note'||origin?.kind!=='conversation'||origin.conversationId!==conversationId||origin.messageIds?.length!==1||origin.messageIds[0]!==turnId||origin.text!==snapshot)throw Error('Saved quote source changed or is unavailable');
}
