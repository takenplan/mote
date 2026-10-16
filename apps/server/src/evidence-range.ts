import type {CaptureRecord} from '@mote/shared';
import {sourceContentTime} from '@mote/shared';
import type {Range} from './store.js';
export function withinEvidenceScope(record:CaptureRecord,scope:Range={}) {
  const p=record.provenance,coding=p?.document?.coding,at=sourceContentTime(record);
  if(scope.deviceId&&record.deviceId!==scope.deviceId||scope.source&&record.source!==scope.source||scope.sourceId&&p?.sourceId!==scope.sourceId)return false;
  const correction=record.source==='note'?record.metadata?.memoryCorrection:undefined;
  for(const key of ['projectKey','repositoryKey','provider','sessionId'] as const)if(scope[key]&&(correction?.scopeRefs.length?correction.scopeRefs.some(ref=>ref[key]!==scope[key]):coding?.[key]!==scope[key]))return false;
  if(scope.after&&Date.parse(record.stateSeries?.samples?.at(-1)?.at??at)<Date.parse(scope.after)||scope.before&&Date.parse(at)>=Date.parse(scope.before))return false;
  if(scope.appId!==undefined&&(record.source==='media'?!record.metadata?.media?.sessions.some(s=>s.appId===scope.appId):record.appId!==scope.appId))return false;
  if(scope.collection==='activity'&&record.privacy.collection!=='activity'||scope.collection==='content'&&(record.source==='activity'||record.privacy.collection==='activity'))return false;
  return !scope.ocrStatus||record.ocr?.status===scope.ocrStatus;
}
