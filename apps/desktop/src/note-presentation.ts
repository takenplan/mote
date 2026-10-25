import {moteText} from '@mote/shared/i18n';

/** Authored comments and shared evidence remain separate in the raw reader. */
export function noteBody(comment:string,metadata:unknown):string {
  if(!metadata||typeof metadata!=='object')return comment;
  const origin=(metadata as {noteOrigin?:unknown}).noteOrigin;
  if(!origin||typeof origin!=='object')return comment;
  const value=origin as {text?:unknown;app?:unknown;url?:unknown};
  if(typeof value.text!=='string'||!value.text.trim())return comment;
  const attribution=[value.app,value.url].filter((item):item is string=>typeof item==='string'&&Boolean(item)).join(' · ');
  return [comment?`${moteText('备注')}\n${comment}`:'',`${moteText('原文')}${attribution?' · '+attribution:''}\n${value.text}`].filter(Boolean).join('\n\n');
}
