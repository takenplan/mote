import {createHash} from 'node:crypto';
import type {CaptureRecord} from '@mote/shared';
const hash=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
export function observationKey(record:{id:string;deviceId:string;capturedAt:string;source:string;appId?:string;windowTitle?:string;provenance?:CaptureRecord['provenance']}){
  // Mechanical boundaries, not an assertion that an app/window is one human task.
  // Only screen/UI samples can coalesce. Authored records keep their own identity.
  return hash([record.deviceId,record.source,record.appId,record.windowTitle,record.provenance?.sourceId,
    record.source==='screen'||record.source==='ui_page'?Math.floor(Date.parse(record.capturedAt)/300000):record.id]);
}
