import {moteText} from '@mote/shared/i18n';
import type {Api} from './api';

export type LifecycleReceipt={id:string;kind:'export'|'delete';userId:string;deploymentId:string;state:string;phase:string;scope:{kind:'account'};progress:{mode:'semantic'};domains:{domain:string;state:string}[];createdAt:string;updatedAt:string;error?:string;logicalAccessRevoked?:boolean;format?:string;version?:number;coverage?:{domains:string[];credentials:false;activeAuthorization:false;instanceBackup:false};bytes?:number;sha256?:string;filename?:string;contentType?:string};
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
export function lifecycleReceipt(api:Api,value:unknown,kind:'export'|'delete',userId:string,id?:string):LifecycleReceipt{
 const r=value as LifecycleReceipt,invalid=()=>{throw Error(moteText('服务返回的操作回执与当前账号不一致。'));};
 if(api.connection?.mode!=='web'||!r||typeof r!=='object'||!uuid.test(r.id)||id!==undefined&&r.id!==id||r.kind!==kind||r.userId!==userId||r.deploymentId!==api.connection.deploymentId||r.scope?.kind!=='account'||r.progress?.mode!=='semantic'||!['working','completed','cancelled','failed','pending','result_unknown','blocked'].includes(r.state)||typeof r.phase!=='string'||!Array.isArray(r.domains)||r.domains.some(d=>!d||typeof d.domain!=='string'||typeof d.state!=='string')||!Number.isFinite(Date.parse(r.createdAt))||!Number.isFinite(Date.parse(r.updatedAt)))invalid();
 if(kind==='delete'&&r.logicalAccessRevoked!==true)invalid();
 if(kind==='export'){
  if(r.format!=='mote-portable'||r.version!==3||!Array.isArray(r.coverage?.domains)||r.coverage.domains.some(d=>typeof d!=='string')||r.coverage.credentials!==false||r.coverage.activeAuthorization!==false||r.coverage.instanceBackup!==false)invalid();
  if(r.state==='completed'&&(!Number.isSafeInteger(r.bytes)||r.bytes!<=0||!/^[a-f0-9]{64}$/.test(r.sha256??'')||r.filename!==`mote-portable-${r.id}.json`||r.contentType!=='application/json; charset=utf-8'))invalid();
 }
 return r;
}
export function lifecycleLabel(state:string){return ({working:moteText('正在处理'),completed:moteText('已完成'),cancelled:moteText('已取消'),failed:moteText('失败'),pending:moteText('等待清除确认'),result_unknown:moteText('外部结果待确认'),blocked:moteText('需要处理')} as Record<string,string>)[state]??state;}
