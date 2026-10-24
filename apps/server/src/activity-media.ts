import {createHash} from 'node:crypto';
import type {CaptureInput,CaptureRecord} from '@mote/shared';

const hash=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
/** Exact provider content and declared session identity. Clock and playback
 * position are excluded; this classifies no genre or intent. */
export function mediaContentIdentity(record:CaptureInput|CaptureRecord){
  const sessions=record.metadata?.media?.sessions??[];
  const content=sessions.map(session=>({appId:session.appId,sessionId:session.sessionId,mediaId:session.mediaId,title:session.title,artist:session.artist,album:session.album,displaySubtitle:session.displaySubtitle})).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)));
  return hash(content);
}
/** Exact time-accounting state. Distinct sessions or provider contents cannot
 * merge, and every measured interval retains its endpoints and raw members. */
export function mediaIntervalIdentity(record:CaptureRecord){return hash({content:mediaContentIdentity(record),availability:record.metadata?.media?.status,
  collection:record.privacy.collection??'content',screenLocked:record.metadata?.state?.screenLocked,
  sessions:(record.metadata?.media?.sessions??[]).map(session=>({appId:session.appId,sessionId:session.sessionId,state:session.playbackState,visibility:session.appVisibility,playbackType:session.playbackType,playbackSpeed:session.playbackSpeed})).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)))});}
