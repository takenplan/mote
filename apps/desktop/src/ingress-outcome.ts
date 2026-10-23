import {moteText} from '@mote/shared/i18n';
import {TransportFailure} from './support';

type Registration={id:string;deviceId:string;platform:string;kind:string};
/** A disabled registration is retryable source state, never a record conflict. */
export class SourcePausedFailure extends TransportFailure {
 readonly paused=true;
 constructor(){super(moteText('中央已暂停该来源；待上传版本保留在本机'),'WAIT_NETWORK',409);}
}
export function requireSourceRegistration(value:unknown,source:Registration,account=false):void{
 const current=value as Record<string,unknown>|null;
 if(!current||current.id!==source.id||typeof current.enabled!=='boolean'||account&&(
  current.deviceId!==source.deviceId||current.platform!==source.platform||current.kind!==source.kind||
  typeof current.name!=='string'||!current.name||!['snapshot','reference','archive'].includes(String(current.retention))
 ))throw new TransportFailure(moteText('中央来源注册确认无效'),'RESPONSE');
 if(!current.enabled)throw new SourcePausedFailure();
}
export const isUploadExpired=(error:unknown):boolean=>Boolean((error as {uploadExpired?:boolean}|null)?.uploadExpired);
