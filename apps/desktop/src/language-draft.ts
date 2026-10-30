/** A one-use handoff for an explicit language reload in this same window. No cross-client storage. */
export interface LanguageAskDraft {
  scope:string;
  question:string;
  conversationId?:string;
  view:'history'|'conversation';
  reading?:{oldestTurnId?:string;scrollY:number;anchor?:{turnId:string;top:number}};
  submittedQuestion?:string;
  pendingRequest?:{id:string;question:string;conversationId?:string};
  /** An admitted run may have no local request body. Only its identity is retained. */
  unresolvedRun?:{id:string;conversationId?:string;stopPending?:true};
}
const key='mote-language-ask-draft';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function keepLanguageAskDraft(storage:Pick<Storage,'setItem'>,value:LanguageAskDraft):void { storage.setItem(key,JSON.stringify(value)); }
export function dropLanguageAskDraft(storage:Pick<Storage,'removeItem'>):void { storage.removeItem(key); }
export function takeLanguageAskDraft(storage:Pick<Storage,'getItem'|'removeItem'>,scope:string):LanguageAskDraft|undefined {
  const text=storage.getItem(key);storage.removeItem(key);if(!text)return;
  try {
    const value=JSON.parse(text);
    if(value.scope!==scope||typeof value.question!=='string'||value.question.length>8000||!['history','conversation'].includes(value.view)||value.conversationId!==undefined&&!uuid.test(value.conversationId))return;
    if(value.submittedQuestion!==undefined&&(typeof value.submittedQuestion!=='string'||value.submittedQuestion.length>8000))return;
    const reading=value.reading;
    const turnId=(id:unknown)=>typeof id==='string'&&id.length>0&&id.length<=128;
    if(reading!==undefined&&(!value.conversationId||!reading||typeof reading!=='object'||!Number.isFinite(reading.scrollY)||reading.scrollY<0||reading.scrollY>1e9||reading.oldestTurnId!==undefined&&!turnId(reading.oldestTurnId)||reading.anchor!==undefined&&(!reading.anchor||typeof reading.anchor!=='object'||!turnId(reading.anchor.turnId)||!Number.isFinite(reading.anchor.top)||Math.abs(reading.anchor.top)>1e6)))return;
    const pending=value.pendingRequest;
    if(pending&&(typeof pending.question!=='string'||!pending.question.trim()||pending.question.length>8000||!uuid.test(pending.id)||pending.conversationId!==undefined&&!uuid.test(pending.conversationId)))return;
    const run=value.unresolvedRun;
    if(run&&(!uuid.test(run.id)||run.conversationId!==undefined&&!uuid.test(run.conversationId)||run.stopPending!==undefined&&run.stopPending!==true))return;
    return value;
  } catch { return; }
}
