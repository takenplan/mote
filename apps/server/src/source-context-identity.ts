import {createHash} from 'node:crypto';
import type {SourceConnection,SourceContextDeclaration} from '@mote/shared';

/** Owner configuration only. Sync progress is an observation, not authority. */
export function sourceMetadataIdentity(source:Pick<SourceConnection,'id'|'name'|'kind'|'deviceId'|'platform'|'retention'|'enabled'>):SourceContextDeclaration{
 const value={sourceId:source.id,name:source.name,kind:source.kind,deviceId:source.deviceId,platform:source.platform,retention:source.retention,enabled:source.enabled};
 return {sourceId:source.id,version:1,kind:'metadata',fingerprint:createHash('sha256').update(JSON.stringify(['source-directory-metadata@1',value])).digest('hex')};
}
