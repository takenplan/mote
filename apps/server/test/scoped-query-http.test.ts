import test,{type TestContext} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID,createHash} from 'node:crypto';
import sharp from 'sharp';
import {buildApp,type QueryAgent} from '../src/app.js';
import type {Config} from '../src/config.js';
import type {QueryInput} from '@mote/agent';
const headers={authorization:'Bearer generated-scoped-owner-token'};
async function fixture(t:TestContext,query:QueryAgent['query']){
 const dataDir=mkdtempSync(join(tmpdir(),'mote-scoped-query-'));
 const config:Config={dataDir,token:'generated-scoped-owner-token',tokenPath:'fixture-only',host:'127.0.0.1',port:0,maxStorageBytes:20_000_000,maxExportBytes:1_000_000,retentionDays:0,insightIntervalHours:0,allowedOrigins:[],model:'generated-model',modelBaseUrl:'https://generated.invalid',apiKey:'generated-key',allowUnauthenticatedLocal:false,embeddingModel:'',embeddingBaseUrl:'',embeddingApiKey:''};
 const build=()=>buildApp(config,{backgroundWorker:false,agent:{configured:true,query,close:async()=>{}}});let current=await build();
 t.after(async()=>{await current.app.close();rmSync(dataDir,{recursive:true,force:true});});return {get node(){return current;},restart:async()=>{await current.app.close();current=await build();}};
}
async function add(node:Awaited<ReturnType<typeof buildApp>>,deviceId='generated-device'){
 const note={id:randomUUID(),deviceId,deviceName:'Generated fixture',platform:'android',capturedAt:'2026-10-01T00:00:00Z',text:'Generated owner comment',metadata:{version:1,observedAt:'2026-10-01T00:00:00Z',noteOrigin:{kind:'share',text:'Generated quoted external original'}}};
 const r=await node.app.inject({method:'POST',url:'/api/notes',headers,payload:note});assert.equal(r.statusCode,201,r.body);await node.materialOrganizer.tick(100);return note;
}
const answer=(input:QueryInput)=>({answer:'Generated scoped answer',citations:(input.evidenceIds??[]).map(id=>({id,capturedAt:'2026-10-01T00:00:00Z',appName:'Generated fixture',excerpt:'Generated owner comment'})),trace:[],runId:randomUUID(),evidenceDependencies:{version:1 as const,complete:true,ids:input.evidenceIds??[]}});
async function completed(node:Awaited<ReturnType<typeof buildApp>>,id:string){const deadline=Date.now()+10000;while(Date.now()<deadline){const run=(await node.app.inject({url:'/api/query-runs/'+id,headers})).json();if(run.status!=='running')return run;await new Promise(resolve=>setTimeout(resolve,10));}throw Error('Generated query did not settle');}

test('public selected evidence persists through runs, restart and inherited follow-ups; explicit null restores normal retrieval',async t=>{
 const seen:QueryInput[]=[],f=await fixture(t,async input=>{seen.push(input);const result=answer(input);if(input.evidenceIds){const {evidenceDependencies:_,...withoutModelLineage}=result;return withoutModelLineage;}return result;});const selected=await add(f.node),other=await add(f.node,'generated-other');
 const id=randomUUID(),payload={id,input:{question:'Generated selected original question',evidenceIds:[selected.id]}};
 const admitted=await f.node.app.inject({method:'POST',url:'/api/query-runs',headers,payload});assert.equal(admitted.statusCode,202,admitted.body);const first=await completed(f.node,id);assert.equal(first.status,'completed',JSON.stringify(first));
 assert.deepEqual(seen[0].evidenceIds,[selected.id]);assert.deepEqual(seen[0].openingMemories,[]);assert.deepEqual(seen[0].contextEvidenceDependencies?.ids,[selected.id]);assert.ok(seen[0].processingEvidence?.[selected.id]);assert.ok(!seen[0].contextEvidenceDependencies?.ids.includes(other.id));
 assert.deepEqual(f.node.featureServices.delegation.get('query:'+id).scope.evidenceIds,[selected.id]);
 const conversation=(await f.node.app.inject({url:'/api/conversations/'+first.conversationId,headers})).json();assert.deepEqual(conversation.scope.evidenceIds,[selected.id]);assert.deepEqual(conversation.turns[0].scope.evidenceIds,[selected.id]);assert.ok(conversation.turns[0].result.evidenceDependencies.ids.includes(selected.id),'host selection lineage survives a model boundary omitting an optional receipt');
 assert.equal((await f.node.app.inject({method:'POST',url:'/api/query-runs',headers,payload})).statusCode,202);assert.equal(seen.length,1);
 await f.restart();
 const follow=await f.node.app.inject({method:'POST',url:'/api/query',headers,payload:{question:'Generated follow-up',conversationId:first.conversationId}});assert.equal(follow.statusCode,200,follow.body);assert.deepEqual(seen.at(-1)!.evidenceIds,[selected.id]);assert.equal(seen.at(-1)!.conversation?.turns.length,1);
 const clear=await f.node.app.inject({method:'POST',url:'/api/query',headers,payload:{question:'Generated explicit clear',conversationId:first.conversationId,evidenceIds:null}});assert.equal(clear.statusCode,200,clear.body);assert.equal(seen.at(-1)!.evidenceIds,undefined);
 assert.equal((await f.node.app.inject({url:'/api/conversations/'+first.conversationId,headers})).json().scope.evidenceIds,undefined);
 const changed=await f.node.app.inject({method:'POST',url:'/api/query',headers,payload:{question:'Generated narrower replacement',conversationId:first.conversationId,evidenceIds:[other.id]}});assert.equal(changed.statusCode,200,changed.body);assert.deepEqual(seen.at(-1)!.evidenceIds,[other.id]);assert.equal(seen.at(-1)!.conversation?.turns.length,0,'narrow selection cannot disclose earlier differently-scoped or unscoped dialogue');
 const normal=await f.node.app.inject({method:'POST',url:'/api/query',headers,payload:{question:'Generated ordinary query'}});assert.equal(normal.statusCode,200,normal.body);assert.equal(seen.at(-1)!.evidenceIds,undefined);
});

test('invalid, missing and out-of-scope originals never reach a model; model citations cannot escape exact selection',async t=>{
 let calls=0,unrelated='';const f=await fixture(t,async input=>{calls++;return {...answer(input),citations:[{id:unrelated,capturedAt:'2026-10-01T00:00:00Z',appName:'Generated unrelated',excerpt:'Not selected'}]};});const selected=await add(f.node),other=await add(f.node,'generated-other');unrelated=other.id;
 for(const evidenceIds of [[],[selected.id,selected.id],Array.from({length:31},()=>randomUUID())])assert.equal((await f.node.app.inject({method:'POST',url:'/api/query',headers,payload:{question:'Generated invalid selection',evidenceIds}})).statusCode,400);
 for(const scope of [{evidenceIds:[randomUUID()]},{evidenceIds:[selected.id],deviceId:'generated-other'},{evidenceIds:[selected.id],after:'2026-10-02T00:00:00Z'}]){const r=await f.node.app.inject({method:'POST',url:'/api/query',headers,payload:{question:'Generated inaccessible selection',...scope}});assert.equal(r.statusCode,409,r.body);}
 assert.equal(calls,0);const escaped=await f.node.app.inject({method:'POST',url:'/api/query',headers,payload:{question:'Generated selected query',evidenceIds:[selected.id]}});assert.equal(escaped.statusCode,409,escaped.body);assert.equal(calls,1);
});

test('selected deletion and cancellation fence late answers without publishing their text',async t=>{
 for(const mode of ['delete','cancel'] as const)await t.test(mode,async sub=>{
  let entered!:()=>void,release!:()=>void;const started=new Promise<void>(done=>{entered=done;}),gate=new Promise<void>(done=>{release=done;});
  const f=await fixture(sub,async input=>{entered();await gate;return {...answer(input),answer:'Generated late selected answer'};});sub.after(()=>release());const selected=await add(f.node),id=randomUUID();
  assert.equal((await f.node.app.inject({method:'POST',url:'/api/query-runs',headers,payload:{id,input:{question:'Generated blocked scoped query',evidenceIds:[selected.id]}}})).statusCode,202);await started;
  if(mode==='delete')assert.equal((await f.node.app.inject({method:'DELETE',url:'/api/notes/'+selected.id,headers})).statusCode,200);else assert.equal((await f.node.app.inject({method:'POST',url:'/api/query-runs/'+id+'/cancel',headers,payload:{}})).statusCode,200);
  release();const run=await completed(f.node,id);assert.notEqual(run.status,'completed',JSON.stringify(run));const history=(await f.node.app.inject({url:'/api/conversations',headers})).json();for(const summary of history.items){const conversation=(await f.node.app.inject({url:'/api/conversations/'+summary.id,headers})).json();assert.ok(!JSON.stringify(conversation).includes('Generated late selected answer'));}
 });
});


test('A-only scoped follow-up excludes prior B-derived text until image B is explicitly attached again',async t=>{
 const seen:QueryInput[]=[],f=await fixture(t,async input=>{
  seen.push(input);const images=input.directImages?.map(image=>image.id)??[];
  return {...answer(input),answer:images.length?'Generated B-derived historical prose':'Generated A-only answer',evidenceDependencies:{version:1,complete:true,ids:[...(input.evidenceIds??[]),...images]}};
 });
 const selected=await add(f.node);
 f.node.sources.register({id:'generated-scope-image',name:'Generated scope image',kind:'upload',deviceId:'generated-device',platform:'import',retention:'archive'});
 const bytes=await sharp({create:{width:8,height:8,channels:3,background:'#554488'}}).png().toBuffer();
 const upload=f.node.files.begin({sourceId:'generated-scope-image',item:{externalId:'generated-image-b',revision:'1',observedAt:'2026-10-01T00:00:00Z',title:'Generated image B',kind:'file',layer:'original',text:'',mimeType:'image/png'},sha256:createHash('sha256').update(bytes).digest('hex'),sizeBytes:bytes.length},()=>{});
 f.node.files.part(upload.uploadId,0,bytes,()=>{});const attachment=(await f.node.files.commit(upload.uploadId,()=>{})).captureId;
 const first=await f.node.app.inject({method:'POST',url:'/api/query',headers,payload:{question:'Generated selected A with image B',evidenceIds:[selected.id],attachmentIds:[attachment]}});assert.equal(first.statusCode,200,first.body);const conversationId=first.json().conversationId;
 const second=await f.node.app.inject({method:'POST',url:'/api/query',headers,payload:{question:'Generated A-only follow-up',conversationId}});assert.equal(second.statusCode,200,second.body);
 assert.deepEqual(seen.at(-1)!.evidenceIds,[selected.id]);assert.deepEqual(seen.at(-1)!.directImages,[]);
 assert.equal(seen.at(-1)!.conversation?.turns.length,0,'earlier B-derived answer and its attachment lineage are excluded from current A-only context');
 const third=await f.node.app.inject({method:'POST',url:'/api/query',headers,payload:{question:'Generated A with B explicitly reattached',conversationId,attachmentIds:[attachment]}});assert.equal(third.statusCode,200,third.body);
 assert.deepEqual(seen.at(-1)!.directImages?.map(image=>image.id),[attachment]);
 assert.ok(seen.at(-1)!.conversation?.turns.some(turn=>turn.answer==='Generated B-derived historical prose'),'current explicit B authorization permits the prior A+B turn again');
});
