import type {RecordMetadata, UiPageV3} from '@mote/shared';
import type {Rectangle} from './contracts';

/** A host-requested observation. This interface grants no independent sampling. */
export interface BrowserCaptureRequest {
  observationId: string;
  appId: string;
  pid: number;
  origins: string[];
  observedAt: string;
  masks: Rectangle[];
  /** False authorizes identity checks only; it must not read page text or media. */
  structured: boolean;
}
export interface BrowserCaptureResult {
  status: 'ok'|'unsupported'|'blocked'|'failed'|'permission_required'|'disconnected'|'stale';
  pages: UiPageV3[];
  media?: RecordMetadata['media'];
  /** Local opaque binding, never archived or interpreted as a platform ID. */
  identity?: string;
  /** True only when every visible Chrome window belongs to this one binding. */
  screenshotSafe?: boolean;
}
export interface BrowserCaptureProvider {
  sample(request: BrowserCaptureRequest, signal: AbortSignal): Promise<BrowserCaptureResult>;
  validate(identity: string, signal: AbortSignal): Promise<boolean>;
}
