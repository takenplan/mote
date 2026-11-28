import {randomUUID} from 'node:crypto';
import type {Transcript,TranscriptionEvidence} from '@mote/shared';
import {sha256,StoreError,type EvidenceStore as Store} from './evidence-store.js';

type ChunkRow={id:string;text:string;start_ms:number|null;end_ms:number|null;metadata:string};

function noticesBySegment(transcript:Transcript){
  const result=new Map<number,NonNullable<TranscriptionEvidence['notices']>>();
  const segments=transcript.segments;
  for(const notice of transcript.transcription?.notices??[]){
    // Keep the exact original interval even when the detector produced no text.
    // Give the neighbouring passages access to that gap without inserting words.
    let low=0,high=segments.length;
    while(low<high){const middle=(low+high)>>>1;if(segments[middle].startMs<notice.startMs)low=middle+1;else high=middle;}
    for(const index of [low-1,low]){
      if(index<0||index>=segments.length)continue;
      const notices=result.get(index);
      if(notices)notices.push(notice);else result.set(index,[notice]);
    }
  }
  return result;
}

/** Called in the artifact publication transaction. Reusing a chunk moves its
 * current container, not its immutable evidence; historical transcript JSON stays intact. */
export function writeFileTranscriptChunks(store:Store,captureId:string,artifactId:string,transcript:Transcript,
  reuse:{kind:string}|{artifactId:string}){
  const db=store.db,correction='artifactId' in reuse;
  const rows=db.prepare(`SELECT c.id,c.text,c.start_ms,c.end_ms,c.metadata FROM file_chunks c
    JOIN file_artifacts a ON a.id=c.artifact_id WHERE c.capture_id=? AND ${correction?'a.id=?':'a.kind=?'}
    ORDER BY a.created_at DESC,c.start_ms,c.ordinal,c.rowid`).all(captureId,correction?reuse.artifactId:reuse.kind) as ChunkRow[];
  if(correction&&rows.length!==transcript.segments.length)throw new StoreError('Transcript chunk layout changed',409);
  const identity=(text:string,start:number|null,end:number|null,metadata:string)=>sha256(JSON.stringify([text,start,end,JSON.parse(metadata)]));
  const prior=new Map<string,string[]>();
  for(const row of rows){const key=identity(row.text,row.start_ms,row.end_ms,row.metadata);prior.set(key,[...(prior.get(key)??[]),row.id]);}
  const move=db.prepare('UPDATE file_chunks SET artifact_id=?,ordinal=? WHERE id=?');
  const insert=db.prepare('INSERT INTO file_chunks(id,artifact_id,capture_id,start_ms,end_ms,text,metadata,ordinal) VALUES(?,?,?,?,?,?,?,?)');
  const notices=noticesBySegment(transcript);
  for(const [ordinal,segment] of transcript.segments.entries()){
    const original=correction?rows[ordinal]:undefined;
    const {speaker,uncertain,overlap,documentLocation,imageLocation}=segment;
    const untimed=!correction&&(segment.untimed||reuse.kind==='text'||reuse.kind==='image-text');
    const start=original?original.start_ms:untimed?null:segment.startMs,end=original?original.end_ms:untimed?null:segment.endMs;
    // A confirmed text edit cannot change location or speaker metadata.
    const transcription=!untimed&&transcript.transcription?{automatic:transcript.transcription.automatic,notices:notices.get(ordinal)}:undefined;
    const metadata=original?.metadata??JSON.stringify({speaker,uncertain,overlap,documentLocation,imageLocation,transcription});
    const existing=prior.get(identity(segment.text,start,end,metadata))?.shift();
    if(existing)move.run(artifactId,ordinal,existing);
    else insert.run(randomUUID(),artifactId,captureId,start,end,segment.text,metadata,ordinal);
  }
}
