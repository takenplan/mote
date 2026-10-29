import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {configureLocale} from '@mote/shared/i18n';
import {verifiedOriginals} from '../src/ask-original-reference';
import type {Api} from '../src/api';
configureLocale(()=>'zh-CN');

test('Memory Ask uses every saved original ID, never a displayed evidence subset or a silently truncated large scope',async()=>{
 const ids=Array.from({length:31},()=>randomUUID()),reads:string[]=[];
 const api={request:async(path:string)=>{reads.push(path);return {title:'Generated Memory',evidenceIds:ids,evidence:[{id:ids[0]}],evidenceCount:31};}} as Api;
 await assert.rejects(verifiedOriginals(api,{kind:'memory',id:randomUUID()},new AbortController().signal),/30/);assert.equal(reads.length,1);
 const seen:string[]=[],small={request:async(path:string)=>{seen.push(path);return path.startsWith('/api/memories/')?{title:'Generated Memory',evidenceIds:ids.slice(0,2),evidence:[{id:ids[0]}],evidenceCount:2}:{id:path.split('/').at(-1)};}} as Api;
 assert.deepEqual((await verifiedOriginals(small,{kind:'memory',id:randomUUID()},new AbortController().signal)).ids,ids.slice(0,2));assert.equal(seen.filter(path=>path.startsWith('/api/capture-browser/')).length,2);
 const partial={request:async()=>({title:'Incomplete projection',evidenceIds:ids.slice(0,2),evidenceCount:3})} as unknown as Api;await assert.rejects(verifiedOriginals(partial,{kind:'memory',id:randomUUID()},new AbortController().signal),/暂不可用/);
});

test('Material Ask actual owner HTTP projection preserves a pinned current complete version and refuses more than thirty originals',async t=>{
 const {buildApp}=await import('../../server/src/app.js'),{materialId}=await import('../../server/src/materials.js');
 const dir=mkdtempSync(join(tmpdir(),'mote-ask-originals-')),token='generated-ask-original-token-123456789';
 const node=await buildApp({dataDir:dir,token,tokenPath:'fixture',host:'127.0.0.1',port:0,maxStorageBytes:3_000_000,maxExportBytes:1_000_000,retentionDays:0,insightIntervalHours:0,allowedOrigins:[],model:'',modelBaseUrl:'',apiKey:'',allowUnauthenticatedLocal:false,embeddingModel:'',embeddingBaseUrl:'',embeddingApiKey:''},{backgroundWorker:false});
 t.after(async()=>{await node.app.close();rmSync(dir,{recursive:true,force:true});});
 const headers={authorization:'Bearer '+token},ids:string[]=[];
 for(let index=0;index<31;index++){const id=randomUUID();ids.push(id);const response=await node.app.inject({method:'POST',url:'/api/notes',headers,payload:{id,deviceId:'generated',deviceName:'Generated',platform:'import',capturedAt:'2026-10-29T00:00:00Z',text:'Generated original '+index}});assert.equal(response.statusCode,201,response.body);}
 const api={request:async(path:string)=>{const response=await node.app.inject({url:path,headers});assert.equal(response.statusCode,200,response.body);return response.json();}} as Api;
 const publish=(selected:string[],text='Generated original scope')=>node.materials.publish({id:materialId('generated','ask'),kind:'mote.file',schemaVersion:1,title:'Generated material',origin:{sourceId:'generated',externalId:'ask'},members:selected.map(id=>({id,kind:'capture',ref:'capture:'+id})),blocks:selected.map((id,index)=>({id:'body-'+index,kind:'text',format:'plain',text:text+' '+index,memberIds:[id]})),coverage:{state:'complete'},fidelity:{state:'lossless'},retention:{original:'retained',policy:'keep'}},{expectedRevision:node.materials.get(materialId('generated','ask'))?.revision});
 const first=publish(ids.slice(0,2));const supplied=await api.request<any>('/api/materials/'+first.id);assert.equal(supplied.memorySource.evidenceIds.length,2);assert.deepEqual((await verifiedOriginals(api,{kind:'material',id:first.ref},new AbortController().signal)).ids,supplied.memorySource.evidenceIds);
 const large=publish(ids);await assert.rejects(verifiedOriginals(api,{kind:'material',id:large.ref},new AbortController().signal),/30/);await assert.rejects(verifiedOriginals(api,{kind:'material',id:first.ref},new AbortController().signal),/暂不可用/);
 const changed=publish(ids.slice(0,2),'Changed original scope');node.materials.retire(changed.id,{expectedRevision:changed.revision});await assert.rejects(verifiedOriginals(api,{kind:'material',id:changed.ref},new AbortController().signal));
});
