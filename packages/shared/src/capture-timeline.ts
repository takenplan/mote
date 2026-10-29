import type {CapturePreview} from './index.js';

/** Owner browsing projections. These locators never grant original access. */
export interface CaptureTimelineGroup {
  type:'group'; id:string; kind:'screen-session'|'source';
  source:CapturePreview['source']; deviceId:string; deviceName:string; day:string;
  firstAt:string; lastAt:string; recordCount:number; imageCount:number;
  /** Complete only when every member carries its actual stateSeries. */
  sampleCount:number|null;
  /** Only screen sessions have an observed common application identity. */
  appId?:string; appName?:string;
}
export interface CaptureTimelineRecord {type:'record';id:string;day:string;firstAt:string;lastAt:string;sampleCount:number|null;record:CapturePreview}
export interface CaptureTimelinePage {revision:string;items:(CaptureTimelineGroup|CaptureTimelineRecord)[];nextCursor:string|null}
export interface CaptureTimelineMember {record:CapturePreview;firstAt:string;lastAt:string;sampleCount:number|null}
export interface CaptureTimelineMembers {revision:string;group:CaptureTimelineGroup;items:CaptureTimelineMember[];nextCursor:string|null}
