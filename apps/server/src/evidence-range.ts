import type {CaptureRecord} from '@mote/shared';
import {sourceContentTime} from '@mote/shared';
import type {Range} from './store.js';
export type EvidenceDimensions=Pick<CaptureRecord,'source'|'deviceId'|'capturedAt'|'appId'|'privacy'> & Partial<Pick<CaptureRecord,'provenance'|'stateSeries'|'metadata'|'ocr'|'durationMs'>>;
/** Business time is a typed fact: calendar plans are intervals, documents use
 * their declared content time, observations use their observed samples. */
export function evidenceInterval(record:EvidenceDimensions){
  const calendar=record.provenance?.calendar;
  if(calendar)return {start:calendar.start,end:calendar.end,interval:Date.parse(calendar.end)>Date.parse(calendar.start)};
  const start=sourceContentTime(record);
  if(record.source==='screen'||record.source==='activity'){
    const samples=record.stateSeries?.samples?.length?record.stateSeries.samples:[{at:record.capturedAt,durationMs:record.durationMs??0}],first=Math.min(...samples.map(sample=>Date.parse(sample.at)-sample.durationMs)),last=Math.max(...samples.map(sample=>Date.parse(sample.at)));
    return {start:new Date(first).toISOString(),end:new Date(last).toISOString(),interval:last>first};
  }
  return {start,end:record.stateSeries?.samples?.at(-1)?.at??start,interval:false};
}
export function withinEvidenceScope(record:EvidenceDimensions,scope:Range={},sourceId:string|null|undefined=record.provenance?.sourceId) {
  const p=record.provenance,coding=p?.document?.coding;
  if(scope.deviceId&&record.deviceId!==scope.deviceId||scope.source&&record.source!==scope.source||scope.sourceId&&sourceId!==scope.sourceId)return false;
  const correction=record.source==='note'?record.metadata?.memoryCorrection:undefined;
  for(const key of ['projectKey','repositoryKey','provider','sessionId'] as const)if(scope[key]&&(correction?.scopeRefs.length?correction.scopeRefs.some(ref=>ref[key]!==scope[key]):coding?.[key]!==scope[key]))return false;
  const time=evidenceInterval(record);
  if(scope.after&&(time.interval?Date.parse(time.end)<=Date.parse(scope.after):Date.parse(time.end)<Date.parse(scope.after))||scope.before&&Date.parse(time.start)>=Date.parse(scope.before))return false;
  if(scope.appId!==undefined&&(record.source==='media'?!record.metadata?.media?.sessions.some(s=>s.appId===scope.appId):record.appId!==scope.appId))return false;
  if(scope.collection==='activity'&&record.privacy.collection!=='activity'||scope.collection==='content'&&(record.source==='activity'||record.privacy.collection==='activity'))return false;
  return !scope.ocrStatus||record.ocr?.status===scope.ocrStatus;
}
