/** A one-use handoff for an explicit language reload in this same window. No cross-client storage. */
export interface LanguageAskDraft {scope:string;question:string;conversationId?:string;view:'history'|'conversation'}
const key='mote-language-ask-draft';
export function keepLanguageAskDraft(storage:Pick<Storage,'setItem'>,value:LanguageAskDraft):void{storage.setItem(key,JSON.stringify(value));}
export function dropLanguageAskDraft(storage:Pick<Storage,'removeItem'>):void{storage.removeItem(key);}
export function takeLanguageAskDraft(storage:Pick<Storage,'getItem'|'removeItem'>,scope:string):LanguageAskDraft|undefined{
 const text=storage.getItem(key);storage.removeItem(key);if(!text)return;
 try{const value=JSON.parse(text);if(value.scope!==scope||typeof value.question!=='string'||value.question.length>8000||!['history','conversation'].includes(value.view)||value.conversationId!==undefined&&!/^[0-9a-f-]{36}$/i.test(value.conversationId))return;return value;}catch{return;}
}
