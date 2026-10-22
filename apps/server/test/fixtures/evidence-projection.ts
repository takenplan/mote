import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {createHash} from 'node:crypto';
import {installIngress} from '../../src/scope/ingress-schema.js';
import {installPrivateData} from '../../src/scope/private-data-schema.js';
import {PrivateData} from '../../src/scope/private-data.js';
import {PrivateSql,PrivateCursor} from '../../src/scope/private-data-sql.js';
import {installScopedMemory} from '../../src/scope/memory-schema.js';
import {installAsk,installAskRetrieval} from '../../src/scope/ask-schema.js';
import {AskEvidence} from '../../src/scope/ask-evidence.js';
const hash=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');

export function evidenceFixture(t:any){
 const db=new DatabaseSync(':memory:');t.after(()=>db.close());const key=installPrivateData(db);installIngress(db);installScopedMemory(db);installAsk(db);installAskRetrieval(db);
 // Byte storage is not exercised by this repository→reader seam.
 db.exec('CREATE TABLE user_tasks(user_id TEXT,task_id TEXT,checkpoints TEXT,progress TEXT);');
 const sql=new PrivateSql(db,'generated-a',()=>{}),cursor=new PrivateCursor(key,'generated-host','generated-a'),data=new PrivateData(sql,cursor),reader=new AskEvidence(sql,data,cursor,{assertCurrent:()=>{}});
 data.registerSource({id:'generated-source',kind:'custom',name:'Generated source',deviceId:'generated-device',platform:'import',retention:'snapshot'});
 const receive=(externalId:string,at:string,text:string,kind='file',calendar?:unknown)=>data.receiveSourceItems('generated-source',[{externalId,revision:'1',observedAt:at,title:'Generated '+externalId,text,kind,layer:'original',...(calendar?{calendar}:{})}]).receipts[0].id;
 const publish=(externalId:string,ids:string[],texts:string[])=>data.publishMaterial({id:'mat_'+hash(['generated-source',externalId]),kind:'document',schemaVersion:1,title:'Generated '+externalId,origin:{sourceId:'generated-source',externalId,firstAt:'2026-10-16T00:00:00Z',lastAt:'2026-10-18T00:00:00Z'},members:ids.map((id,index)=>({id:String(index),kind:'capture',ref:'capture:'+id})),blocks:ids.map((id,index)=>({id:'text-'+index,kind:'text',format:'plain',text:texts[index],memberIds:[String(index)]})),coverage:{state:'complete'},fidelity:{state:'lossless'},retention:{original:'retained',policy:'keep'}});
 return {db,sql,data,reader,receive,publish};
}

