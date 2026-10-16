import {useEffect,useRef,useState} from 'react';
import {z} from 'zod';
import {calendarDraftSchema,calendarChoiceSchema,calendarEventSchema,ownerQuestionSchema,formatEvidenceRef,type OwnerQuestion} from '@mote/shared';
import {moteText} from '@mote/shared/i18n';
import {type Api,ApiError,errorMessage} from './api';
import {useResource} from './useResource';
import {resources} from './resource-cache';

const target=z.object({deviceId:z.string().min(1).max(200),calendarId:z.string().min(1).max(1000)}).strict();
const status=z.enum(['proposed','dismissed','approved','executing','succeeded','uncertain','stale']);
const related=z.object({operationId:z.string().uuid().optional(),actionId:z.string().uuid(),version:z.number().int().positive(),status,event:calendarDraftSchema,target:target.optional(),externalId:z.string().min(1).max(2000).optional()}).strict();
const reviewed=z.object({
 id:z.string().uuid(),version:z.number().int().positive(),kind:z.enum(['calendar.create','calendar.update','calendar.cancel','calendar.complete']),event:calendarDraftSchema,target:target.optional(),
 targetDetails:z.object({deviceId:z.string().min(1).max(200),deviceName:z.string().min(1).max(200),calendar:calendarChoiceSchema.extend({accountId:z.string().min(1).max(1000).optional()})}).strict().optional(),related:related.optional(),
 evidence:z.array(z.object({id:z.string().uuid(),quote:z.string().min(1).max(2000),fingerprint:z.string().regex(/^[a-f0-9]{64}$/),source:z.string(),capturedAt:z.string().datetime({offset:true})}).strict()).min(1).max(40),fingerprint:z.string().regex(/^[a-f0-9]{64}$/),
}).strict();
const reviewSchema=ownerQuestionSchema.extend({reviewedAction:reviewed}).strict();
export type FixedActionReview=z.infer<typeof reviewSchema>;
/** Presentation validation never reconstructs the server's grant or epochs. */
export function readActionReview(value:unknown,actionId:string,questionId?:string):FixedActionReview{
 const result=reviewSchema.parse(value),action=result.reviewedAction;
 if(result.provider.id!=='actions.calendar'||result.provider.version!=='1'||result.workId!==actionId||action.id!==actionId||questionId!==undefined&&result.id!==questionId||result.choices.length!==2||new Set(result.choices.map(choice=>choice.id)).size!==2||!result.choices.every(choice=>['approve','dismiss'].includes(choice.id)))throw Error(moteText('服务返回的操作回执与当前账号不一致。'));
 if(Boolean(action.target)!==Boolean(action.targetDetails)||action.target&&(action.target.deviceId!==action.targetDetails!.deviceId||action.target.calendarId!==action.targetDetails!.calendar.id)||action.kind==='calendar.create'&&!action.target)throw Error(moteText('服务返回的操作回执与当前账号不一致。'));
 if(['calendar.create','calendar.update'].includes(action.kind))calendarEventSchema.parse(action.event);
 return result;
}
const kindLabel=(kind:FixedActionReview['reviewedAction']['kind'])=>({'calendar.create':moteText('添加日程'),'calendar.update':moteText('更新日程'),'calendar.cancel':moteText('取消日程'),'calendar.complete':moteText('标记安排完成')})[kind];

/** Shared by the original action dialog and the OwnerQuestions entry. */
export function ActionReview({api,actionId,questionId,onOpen,onResolved}:{api:Api;actionId:string;questionId:string;onOpen:(ref:string)=>void;onResolved?:(value:OwnerQuestion)=>void}){
 const path='/api/actions/'+encodeURIComponent(actionId)+'/reviews/'+encodeURIComponent(questionId),read=useResource<unknown>(api,path);
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[accepted,setAccepted]=useState<OwnerQuestion>();
 const identity=useRef({api,actionId,questionId});identity.current={api,actionId,questionId};
 const alive=useRef(true),running=useRef(false),pending=useRef<{choice:string;body:string}|undefined>(undefined);
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;pending.current=undefined;};},[api,actionId,questionId]);
 const live=()=>alive.current&&identity.current.api===api&&identity.current.actionId===actionId&&identity.current.questionId===questionId;
 let value:FixedActionReview|undefined,invalid:unknown;
 if(read.error===undefined&&read.data!==undefined)try{value=readActionReview(read.data,actionId,questionId);}catch(e){invalid=e;}
 const question=accepted??value,canReply=value&&question?.state==='open'&&read.error===undefined&&!invalid&&!busy;
 useEffect(()=>question?.state==='open'?resources(api).get(path).poll(3000):undefined,[api,path,question?.state]);
 async function reply(choice:'approve'|'dismiss'){
  if(!live()||running.current||!canReply||!value)return;
  const input={requestId:crypto.randomUUID(),expectedRevision:value.revision,action:'answer',choiceId:choice},key=JSON.stringify([value.id,value.revision,value.reviewedAction.fingerprint,choice]);
  const intent=pending.current?.choice===key?pending.current:{choice:key,body:JSON.stringify(input)};pending.current=intent;running.current=true;setBusy(true);setError('');
  try{
   const result=ownerQuestionSchema.parse(await api.request('/api/owner-questions/'+encodeURIComponent(questionId)+'/reply',{method:'POST',body:intent.body}));
   if(!live())return;
   if(result.id!==questionId||result.workId!==actionId||result.provider.id!=='actions.calendar'||result.state!=='closed'||result.outcome!==(choice==='approve'?'approved':'dismissed'))throw Error(moteText('服务返回的操作回执与当前账号不一致。'));
   pending.current=undefined;setAccepted(result);resources(api).invalidate(key=>key.startsWith('/api/actions')||key.startsWith('/api/owner-questions')||key.startsWith('/api/work-activity'));onResolved?.(result);
  }catch(e){if(live()){setError(errorMessage(e));if(e instanceof ApiError&&[401,403,404,409,410].includes(e.status)){pending.current=undefined;read.refresh();}}}
  finally{if(live()){running.current=false;setBusy(false);}}
 }
 return <section className="action-fixed-review" aria-label={moteText('固定日程审批')}>
  {(error||read.error!==undefined||invalid!==undefined)&&<p className="notice error" role="alert">{error||errorMessage(read.error??invalid)} <button className="button subtle" disabled={busy} onClick={read.refresh}>{moteText('刷新')}</button></p>}
  {read.loading&&!value&&<p role="status">{moteText('正在读取…')}</p>}
  {value&&<><h2>{kindLabel(value.reviewedAction.kind)}</h2><p>{moteText('版本 {0}',value.reviewedAction.version)}</p><h3>{value.reviewedAction.event.title}</h3>
   <p>{value.reviewedAction.event.start??'—'} → {value.reviewedAction.event.end??'—'} · {value.reviewedAction.event.timeZone??'—'}{value.reviewedAction.event.allDay?moteText(' · 全天'):''}</p>
   <p>{value.reviewedAction.event.location}</p><p className="file-text">{value.reviewedAction.event.description}</p>
   {value.reviewedAction.related&&<p>{moteText('原安排')}：{value.reviewedAction.related.event.title} · {value.reviewedAction.related.event.start??'—'} → {value.reviewedAction.related.event.end??'—'}</p>}
   {value.reviewedAction.targetDetails&&<p>{value.reviewedAction.targetDetails.deviceName} · {value.reviewedAction.targetDetails.deviceId} · {value.reviewedAction.targetDetails.calendar.title} · {value.reviewedAction.targetDetails.calendar.id}{value.reviewedAction.targetDetails.calendar.accountId&&<> · {value.reviewedAction.targetDetails.calendar.accountId}</>}</p>}
   <details open><summary>{moteText('查看原文依据（')}{value.reviewedAction.evidence.length}）</summary>{value.reviewedAction.evidence.map((evidence,index)=><blockquote key={index}><p>{evidence.quote}</p><button className="button subtle" onClick={()=>{if(live())onOpen('context:'+formatEvidenceRef('capture',evidence.id));}}>{evidence.source} · {moteText('查看原文')}</button></blockquote>)}</details>
   <p>{value.reviewedAction.kind==='calendar.complete'?moteText('确认后仅在 Mote 中标记完成。'):moteText('仅批准上方固定内容、证据、设备和日历；修改需要返回重新核对。')}</p>
   {question?.state==='open'?<div className="action-toolbar"><button className="button primary" disabled={!canReply} onClick={()=>void reply('approve')}>{value.reviewedAction.kind==='calendar.create'?moteText('确认添加到此日历'):moteText('确认变更')}</button><button className="button subtle" disabled={!canReply} onClick={()=>void reply('dismiss')}>{moteText('忽略')}</button></div>:<p role="status">{question?.outcome==='approved'?moteText('等待客户端写入'):question?.outcome==='dismissed'?moteText('已忽略'):moteText('这个问题已更新，请查看最新内容后再回答。')}</p>}
  </>}
 </section>;
}
