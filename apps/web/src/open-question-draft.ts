import type {Api} from './api';
import {moteText} from '@mote/shared/i18n';
import {unsentDrafts} from './chat-drafts';
/** Preparing a question is navigation only. Existing unsent work requires the same explicit guard. */
export function openQuestionDraft(api:Api,question:string){
 const draft=unsentDrafts.get(api);
 if(question&&draft&&(draft.question||draft.attachments.length)&&!window.confirm(moteText('有未保存的修改。离开并丢弃修改？')))return;
 window.location.hash='#/ask'+(question?'?'+new URLSearchParams({questionDraft:question}):'');
}
