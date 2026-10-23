import type {CaptureRecord} from '@mote/shared';

/** Raw redacted screen contents cannot become readable by acquiring a Material
 * anchor. Structured UI selected text keeps its separate typed producer contract;
 * metadata-only activity measurement does not use this content predicate. */
export function materialOriginalContentVisible(record:Pick<CaptureRecord,'source'|'privacy'|'provenance'>):boolean {
 return !record.privacy.excluded&&!record.provenance?.deleted&&!(record.source==='screen'&&record.privacy.redacted);
}
