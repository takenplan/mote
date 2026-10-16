import { moteText } from './i18n.js';
import type {Transcript} from '@mote/shared';
import {FileStore} from './files.js';
import {StoreError} from './store.js';

import {transcriptMarkdown as markdown,transcriptCsv as csv,csvCell} from './file-export-tar.js';
export function fileExportEntries(files:FileStore,id:string,maxBytes=64*1024*1024){
  const file=files.detail(id),db=files.store.db;
  const artifacts=(db.prepare('SELECT id,kind,json FROM file_artifacts WHERE capture_id=? AND current=1 ORDER BY created_at DESC').all(id) as {id:string;kind:string;json:string}[]).map(a=>({...a,data:JSON.parse(a.json)}));
  const raw=artifacts.find(a=>['transcript','text','image-text'].includes(a.kind)),dialogue=artifacts.find(a=>a.kind==='dialogue'),diarization=artifacts.find(a=>a.kind==='diarization'),corrected=artifacts.find(a=>a.kind==='corrected-dialogue');
  if(!raw?.data.transcript)throw new StoreError('A current transcript is required for export',409);
  const entries:{name:string;bytes:Buffer}[]=[];let total=0;
  const add=(name:string,value:string|Buffer)=>{const bytes=Buffer.isBuffer(value)?value:Buffer.from(value);total+=bytes.length;if(total>maxBytes)throw new StoreError('Processing export exceeds limit',413);entries.push({name,bytes});};
  add(moteText("原始转写_未校正.md"),markdown(raw.data.transcript,moteText("原始转写 · 未校正")));
  add(moteText("原始转写.json"),JSON.stringify(raw.data.transcript,null,2));
  if(diarization){
    const data=diarization.data;
    add('diarization.json',JSON.stringify(data,null,2));
    add('diarization.rttm',data.segments.map((s:any)=>`SPEAKER ${id} 1 ${(s.startMs/1000).toFixed(3)} ${((s.endMs-s.startMs)/1000).toFixed(3)} <NA> <NA> ${s.speaker} <NA> <NA>`).join('\n')+'\n');
    add('diarization.csv',[['start_ms','end_ms','speaker'],...data.segments.map((s:any)=>[s.startMs,s.endMs,s.speaker])].map(row=>row.map(csvCell).join(',')).join('\r\n'));
    for(const asset of db.prepare('SELECT name FROM file_assets WHERE artifact_id=? ORDER BY name').all(diarization.id) as {name:string}[])add(asset.name,files.asset(id,diarization.id,asset.name).bytes);
  }
  if(dialogue){add(moteText("带说话人_未校正完整记录.md"),markdown(dialogue.data.transcript,moteText("带说话人完整记录 · 未校正")));add(moteText("带说话人_未校正完整记录.csv"),csv(dialogue.data.transcript));}
  if(corrected){add(moteText("带说话人_已确认校正记录.md"),markdown(corrected.data.transcript,moteText("已确认校正记录")));add(moteText("带说话人_已确认校正记录.csv"),csv(corrected.data.transcript));}
  const calendar=artifacts.find(a=>a.kind==='calendar-link')?.data,names=artifacts.find(a=>a.kind==='speaker-names')?.data;
  if(calendar)add(moteText("已确认场次.json"),JSON.stringify(calendar,null,2));if(names)add(moteText("已确认说话人.json"),JSON.stringify(names,null,2));
  add('manifest.json',JSON.stringify({version:1,captureId:id,sourceId:file.sourceId,originalTitle:file.item.title,originalSha256:file.sha256,job:file.job,steps:file.steps,processingPolicy:(()=>{const json=db.prepare('SELECT policy_json FROM file_jobs WHERE capture_id=?').get(id)?.policy_json;return json?JSON.parse(String(json)):null;})(),uncorrectedPreserved:true,artifacts:artifacts.map(({id,kind})=>({id,kind})),calendarConfirmed:!!calendar,speakerNamesConfirmed:!!names},null,2));
  return entries;
}
export {exportTar} from './file-export-tar.js';
