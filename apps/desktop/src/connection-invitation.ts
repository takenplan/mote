import {CONNECTION_INPUT_MAX_BYTES,connectionServerUrl} from '@mote/shared/connection';
import {moteText} from '@mote/shared/i18n';

/** The Central generation consent fixes this subject before the Desktop claims it. */
export interface DesktopConnectionInvitation {
 readonly format:'mote.connection';
 readonly version:2;
 readonly deploymentId:string;
 readonly userId:string;
 readonly serverUrl:string;
 readonly purpose:'device';
 readonly code:string;
 readonly expiresAt:string;
 readonly deviceId?:string;
}

const required=['format','version','deploymentId','userId','serverUrl','purpose','code','expiresAt'];
const invalid=()=>new Error(moteText('连接邀请格式无效'));
const subjectId=(value:unknown):value is string=>typeof value==='string'&&value.length>0&&value.length<=128&&!/[\x00-\x1f\x7f]/.test(value);

/** Desktop intentionally rejects retired v1/owner invitations. Shared v1 remains
 * available to the isolated legacy algorithm fixtures that still consume it. */
export function parseDesktopConnectionInvitation(input:unknown,now=Date.now()):DesktopConnectionInvitation {
 if(typeof input!=='string'||new TextEncoder().encode(input).length>CONNECTION_INPUT_MAX_BYTES)throw new Error(moteText('连接邀请不能超过 8 KiB'));
 let json=input.trim();
 if(json.startsWith('mote:')){
  const match=/^mote:\/\/connect\?data=([A-Za-z0-9_-]+)$/.exec(json);
  if(!match)throw new Error(moteText('Mote 连接链接格式无效'));
  try{
   const encoded=match[1]!,bytes=Buffer.from(encoded,'base64url');
   if(bytes.toString('base64url')!==encoded)throw invalid();
   json=new TextDecoder('utf-8',{fatal:true}).decode(bytes);
  }catch{throw new Error(moteText('Mote 连接链接编码无效'));}
 }
 let raw:unknown;
 try{raw=JSON.parse(json);}catch{throw new Error(moteText('请粘贴连接邀请 JSON 或 mote://connect 链接'));}
 if(!raw||typeof raw!=='object'||Array.isArray(raw))throw invalid();
 const value=raw as Record<string,unknown>,keys=Object.keys(value);
 if(required.some(key=>!keys.includes(key))||keys.some(key=>!required.includes(key)&&key!=='deviceId')||value.format!=='mote.connection'||value.version!==2||value.purpose!=='device'||!subjectId(value.deploymentId)||!subjectId(value.userId)||typeof value.serverUrl!=='string'||typeof value.code!=='string'||!/^[A-Za-z0-9_-]{43}$/.test(value.code)||typeof value.expiresAt!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(value.expiresAt)||(keys.includes('deviceId')&&(typeof value.deviceId!=='string'||!/^[A-Za-z0-9_.:-]{1,128}$/.test(value.deviceId))))throw invalid();
 // Invitation origins come from the producer's connectionServerUrl output. Do
 // not silently rewrite the subject that will later be compared with the host.
 if(connectionServerUrl(value.serverUrl)!==value.serverUrl)throw invalid();
 const expires=Date.parse(value.expiresAt);
 if(!Number.isFinite(expires)||new Date(expires).toISOString()!==value.expiresAt.replace(/(?:\.(\d{1,3}))?Z$/,(_match,fraction:string|undefined)=>'.'+(fraction??'').padEnd(3,'0')+'Z'))throw invalid();
 if(!Number.isFinite(now)||expires<=now)throw new Error(moteText('连接邀请已过期，请在中央节点重新生成'));
 return Object.freeze({format:'mote.connection',version:2,deploymentId:value.deploymentId,userId:value.userId,serverUrl:value.serverUrl,purpose:'device',code:value.code,expiresAt:value.expiresAt,...(typeof value.deviceId==='string'?{deviceId:value.deviceId}:{})});
}
