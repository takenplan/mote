/** One reply/CAS state protocol for the legacy and multiuser hosts. */
import {createHash} from 'node:crypto';
import {ownerQuestionReplySchema,type OwnerQuestion,type OwnerQuestionReply} from '@mote/shared';
import {moteText} from './i18n.js';
import {ownerQuestionAnswerSchema,type OwnerQuestionRecord,type OwnerQuestionProvider,type OwnerQuestionAnswer,type ResolvedOwnerQuestionReply} from './owner-question-contract.js';
export type OwnerQuestionCurrent={record:OwnerQuestionRecord;stored:{installationEpoch:string};provider?:OwnerQuestionProvider};
export interface OwnerQuestionReplyPort {
 conflict(message:string):Error;
 receipt(id:string,reply:OwnerQuestionReply,hash:string):boolean;
 get(id:string):OwnerQuestion;
 current(id:string):OwnerQuestionCurrent;
 transaction<T>(work:()=>T):T;
 afterEffect(id:string):{record:OwnerQuestionRecord};
 now():string;
 save(record:OwnerQuestionRecord,epoch:string):void;
 remember(id:string,reply:OwnerQuestionReply,hash:string):void;
}
export class OwnerQuestionReplyProtocol {
 private readonly pending=new Map<string,{hash:string;work:Promise<OwnerQuestion>}>();
 constructor(private readonly port:OwnerQuestionReplyPort){}
 reply(id:string,raw:OwnerQuestionReply){
  const reply=ownerQuestionReplySchema.parse(raw),hash=createHash('sha256').update(JSON.stringify(reply)).digest('hex'),key=JSON.stringify([id,reply.requestId]),active=this.pending.get(key);
  if(active){if(active.hash!==hash)return Promise.reject(this.port.conflict('Owner reply request ID was reused with different content'));return active.work;}
  const work=performOwnerQuestionReply(this.port,id,reply,hash);this.pending.set(key,{hash,work});void work.finally(()=>{if(this.pending.get(key)?.work===work)this.pending.delete(key);}).catch(()=>{});return work;
 }
}
export async function performOwnerQuestionReply(port:OwnerQuestionReplyPort,id:string,reply:OwnerQuestionReply,hash:string):Promise<OwnerQuestion>{
  if(port.receipt(id,reply,hash))return port.get(id);
  const initial=port.current(id),record=structuredClone(initial.record),provider=initial.provider;
  if(record.question.state==='obsolete')throw port.conflict('Owner question is obsolete');
  if(!provider)throw port.conflict('Owner question provider unavailable');
  if(record.question.state==='answered'||record.question.revision!==reply.expectedRevision)throw port.conflict('Owner question changed; reload before answering');
  const resolved:ResolvedOwnerQuestionReply={...reply};
  if(reply.choiceId){const choice=record.question.choices.find(choice=>choice.id===reply.choiceId);if(!choice)throw port.conflict('Owner question choice is no longer available');resolved.answer=choice.answer;}
  const prepared:OwnerQuestionAnswer|undefined=reply.action==='defer'?undefined:ownerQuestionAnswerSchema.parse(await provider.answer(record,resolved));
  // Preparation may await a model; recheck before entering the transaction and again before writes.
  port.current(id);
  return port.transaction(()=>{
   if(port.receipt(id,reply,hash))return port.get(id);
   const current=port.current(id);
   if(current.record.question.state==='obsolete'||current.record.question.revision!==reply.expectedRevision||current.provider!==provider||current.stored.installationEpoch!==provider.installationEpoch)throw port.conflict('Owner question changed while interpreting the answer');
   const value=structuredClone(current.record),question=value.question,at=port.now();
   let outcome=prepared;
   if(prepared){const committed=provider.commit?.(value,resolved,prepared);if(committed!==undefined)outcome=ownerQuestionAnswerSchema.parse(committed);}
   question.updatedAt=at;question.revision++;
   if(reply.action==='defer'){question.state='deferred';question.messages.push({role:'user',text:moteText('稍后再说'),createdAt:at});}
   else {
    if(resolved.answer!==undefined)question.messages.push({role:'user',text:resolved.answer,createdAt:at});
    else if(reply.action==='unknown')question.messages.push({role:'user',text:moteText('我也不知道，结束这次追问'),createdAt:at});
    if(outcome!.kind==='followup'){question.state='open';question.prompt=outcome!.prompt;if(outcome!.choices!==undefined)question.choices=outcome!.choices;question.messages.push({role:'assistant',text:outcome!.prompt,createdAt:at});delete question.outcome;delete question.continuationId;}
    else if(outcome!.kind==='continued'){question.state='answered';question.continuationId=outcome!.continuationId;question.outcome=outcome!.outcome;}
    else {question.state='closed';question.outcome=outcome!.outcome;delete question.continuationId;}
   }
   const afterEffect=port.afterEffect(id);
   if(afterEffect.record.question.state==='obsolete'||afterEffect.record.question.revision!==reply.expectedRevision)throw port.conflict('Owner question evidence changed during continuation');
   if(!provider.validate(value))throw port.conflict('Owner question continuation failed current validation');
   port.save(value,current.stored.installationEpoch);
   port.remember(id,reply,hash);
   return structuredClone(question);
  });
 }
