import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {modelFixture,event} from './fixtures/scoped-actions.js';
import {source,waitForState} from './fixtures/scoped-query-accounts.js';
import {writeMessagesResponse} from '../../../scripts/fixtures/messages-provider.js';
import {defaultProcessingSettings} from '../src/scope/processing-schema.js';

const envelope=(body:any)=>JSON.parse(typeof body.messages[0].content==='string'?body.messages[0].content:body.messages[0].content[0].text);
const complete=async(f:Awaited<ReturnType<typeof modelFixture>>,sourceId:string)=>waitForState(async()=>f.read(db=>Boolean(db.prepare("SELECT 1 FROM ac_jobs j,json_each(j.proof,'$.sources') s WHERE j.user_id=? AND j.state='completed' AND json_extract(s.value,'$.id')=?").get(f.a.userId,sourceId))),value=>value,'actual action job for '+sourceId);

test('real model chooses independent same-title events and a later sameAs preserves the dismissed decision',async t=>{
 const f=await modelFixture(t);let sameAs:string|null=null;
 f.scripts.set('A',(body,_raw,res)=>{const data=envelope(body),id=data.untrustedEvidence[0].id;writeMessagesResponse(res,{stage:1,text:JSON.stringify({answer:JSON.stringify({actions:[{kind:'calendar.create',event,uncertainty:'Generated',sameAs,evidence:[{id,quote:'GENERATED_A_PRIVATE_APPOINTMENT'}]}]}),citationIds:[id]})});});
 await f.ingest(f.a,'A');await f.enable(f.a);const first=(await f.proposal(f.a)).items[0];await f.ok(f.a.token,'/api/actions/'+first.id+'/dismiss','POST',{version:first.version});
 await f.ok(f.a.token,'/api/ingress/sources','POST',source('independent-source'));await f.ingest(f.a,'A','same-item','independent-source');await f.ok(f.a.token,'/api/actions/retry','POST',{});await complete(f,'independent-source');
 assert.equal((await f.ok(f.a.token,'/api/actions')).items.length,2,'same title/time is not a host semantic merge');sameAs=first.id;
 await f.ok(f.a.token,'/api/ingress/sources','POST',source('duplicate-source'));await f.ingest(f.a,'A','same-item','duplicate-source');await f.ok(f.a.token,'/api/actions/retry','POST',{});await complete(f,'duplicate-source');const page=await f.ok(f.a.token,'/api/actions'),merged=page.items.find((a:any)=>a.id===first.id);assert.equal(page.items.length,2);assert.equal(merged.status,'dismissed');assert.equal(merged.evidence.length,2);assert.equal(merged.version,first.version+2);
});

test('actual model proposals paginate without gaps and the read-only catalog filters all sources before its limit',async t=>{
 const f=await modelFixture(t);let phase='allowed';f.scripts.set('A',(body,_raw,res)=>{const data=envelope(body),id=data.untrustedEvidence[0].id;writeMessagesResponse(res,{stage:1,text:JSON.stringify({answer:JSON.stringify({actions:Array.from({length:8},(_,i)=>({kind:'calendar.create',event:{...event,title:'Generated '+id+' '+i,description:phase==='hidden'?'GENERATED_HIDDEN_CATALOG_DESCRIPTION':'Generated allowed description'},uncertainty:'Generated',sameAs:null,evidence:[{id,quote:'GENERATED_A_PRIVATE_APPOINTMENT'}]}))}),citationIds:[id]})});});
 await f.ingest(f.a,'A');await f.enable(f.a);await complete(f,'same-source');phase='hidden';await f.ingest(f.a,'A','same-item','other-source');await f.ok(f.a.token,'/api/actions/retry','POST',{});await complete(f,'other-source');
 const seen=new Set<string>();let cursor:string|undefined;do{const page=await f.ok(f.a.token,'/api/actions?limit=5'+(cursor?'&cursor='+encodeURIComponent(cursor):''));for(const a of page.items){assert.ok(!seen.has(a.id));seen.add(a.id);}cursor=page.nextCursor??undefined;}while(cursor);assert.equal(seen.size,16);
 const first=await f.ok(f.a.token,'/api/actions?limit=1');assert.equal((await f.request(f.b.token,'/api/actions?limit=1&cursor='+encodeURIComponent(first.nextCursor))).statusCode,400);
 const context=await f.node.authority.authenticate(f.a.token),catalog=f.node.actions!.discovery.catalog(context,['same-source'],{limit:1});assert.equal(catalog.items.length,1);assert.ok(!JSON.stringify(catalog).includes('GENERATED_HIDDEN_CATALOG_DESCRIPTION'));assert.equal(f.node.actions!.discovery.catalog(context,[],{limit:1}).items.length,0);
 assert.throws(()=>f.node.actions!.discovery.catalog(context,['other-source'],{limit:1,cursor:catalog.nextCursor!}));
 await f.ingest(f.b,'B');await f.enable(f.b);assert.equal((await f.proposal(f.b)).items.length,1);assert.ok(f.requests.every(request=>!request.raw.includes(request.owner==='A'?'GENERATED_B_PRIVATE':'GENERATED_A_PRIVATE')));
});

test('real M03 file and M06 transcript reach the final Unicode action range with explicit old timezone',async t=>{
 const f=await modelFixture(t),tail='GENERATED_LONG_FINAL_APPOINTMENT';f.scripts.set('A',(body,_raw,res)=>{const data=envelope(body),record=data.untrustedEvidence[0],actions=record.ocrText.includes(tail)?[{kind:'calendar.create',event:{...event,title:'Generated final file action'},uncertainty:'Generated final range',sameAs:null,evidence:[{id:record.id,quote:tail}]}]:[];writeMessagesResponse(res,{stage:1,text:JSON.stringify({answer:JSON.stringify({actions}),citationIds:actions.length?[record.id]:[]})});});
 await f.replace(f.a,'processing',{...defaultProcessingSettings(),automatic:true,understandingEnabled:false,summarize:false,semanticTurns:false});await f.ok(f.a.token,'/api/ingress/sources','POST',{...source('long-file'),kind:'local-files',retention:'archive'});const text='GENERATED_LONG_BEGIN '+('A😀B'.repeat(11000))+' '+tail,bytes=Buffer.from(text),hash=createHash('sha256').update(bytes).digest('hex'),upload=await f.ok(f.a.token,'/api/ingress/sources/long-file/uploads','POST',{batchId:'same-file-upload',revision:{sourceId:'long-file',item:{externalId:'same-file',revision:'same-revision',observedAt:'2026-10-16T00:00:00Z',title:'Generated long file',text:'',kind:'file',layer:'original',mimeType:'text/plain'},sizeBytes:bytes.length,sha256:hash,relativePath:'generated.txt'}});
 await f.ok(f.a.token,'/api/ingress/uploads/'+upload.id+'/parts/0','PUT',{bytes:bytes.toString('base64'),checksum:hash});const accepted=await f.ok(f.a.token,'/api/ingress/uploads/'+upload.id+'/commit','POST',{}),original=accepted.captures[0].original.ref;await waitForState(()=>f.ok(f.a.token,'/api/processing/originals/'+original.slice(9)),value=>value.indexed===true,'exact long file formal publication');await f.enable(f.a);const page=await waitForState(()=>f.ok(f.a.token,'/api/actions'),value=>value.items.some((action:any)=>action.event.title==='Generated final file action'),'actual final long-file action',90000);assert.equal(page.items[0].event.title,'Generated final file action');assert.equal(page.items[0].evidence[0].quote,tail);
 assert.ok(f.requests.length>=2);let sawTail=false;for(const request of f.requests){const data=envelope(request.body);assert.equal(data.timeZone,'UTC');for(const record of data.untrustedEvidence){assert.ok(!/^[\uDC00-\uDFFF]/u.test(record.ocrText));assert.ok(!/[\uD800-\uDBFF]$/u.test(record.ocrText));if(record.ocrText.includes(tail))sawTail=true;}}assert.equal(sawTail,true);
});
