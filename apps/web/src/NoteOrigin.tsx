import type {Api,Capture} from './api';
import {moteText} from '@mote/shared/i18n';
import {formatEvidenceRef} from '@mote/shared';
import {useResource} from './useResource';
export function NoteOrigin({capture}:{capture:Capture}){
 const origin=capture.metadata?.noteOrigin;
 if(!origin||origin.kind==='manual')return null;
 return <section className="note-origin"><h3>{moteText(origin.kind==='conversation'?'引用原文':'分享内容')}</h3>{origin.text&&<pre>{origin.text}</pre>}{origin.app&&<small>{origin.app}</small>}{origin.url&&<p><code>{origin.url}</code></p>}</section>;
}
function NoteAttachment({api,id,index,onOpen}:{api:Api;id:string;index:number;onOpen:(ref:string)=>void}){
 const file=useResource<{item:{title:string}}>(api,'/api/files/'+encodeURIComponent(id));
 return <button className="button subtle" onClick={()=>onOpen(formatEvidenceRef('capture',id))}>{file.data?.item.title||`${moteText('查看附件')} ${index+1}`}</button>;
}
export function NoteAttachments({api,capture,onOpen}:{api:Api;capture:Capture;onOpen:(ref:string)=>void}){
 const ids=capture.metadata?.attachments??[];
 return ids.length?<section className="note-attachments" aria-label={moteText('附件')}>{ids.map((id,index)=><NoteAttachment key={id} api={api} id={id} index={index} onOpen={onOpen}/>)}</section>:null;
}
