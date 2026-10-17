import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import type {QueryInput} from '@mote/agent';
import {buildApp} from '../src/app.js';
import type {Config} from '../src/config.js';
import {defaultLifecycleSettings} from '../src/memory-lifecycle.js';

const token='generated-cache-history-owner',headers={authorization:`Bearer ${token}`,'content-type':'application/json'};
const config=(dataDir:string):Config=>({dataDir,token,tokenPath:'fixture',host:'127.0.0.1',port:0,maxStorageBytes:50_000_000,maxExportBytes:1_000_000,retentionDays:0,insightIntervalHours:0,allowedOrigins:[],model:'',modelBaseUrl:'',apiKey:'',allowUnauthenticatedLocal:false,embeddingModel:'',embeddingBaseUrl:'',embeddingApiKey:''});
const result=(ids:string[],answer='Generated answer based on the first interpretation.')=>({answer,citations:[],trace:[],runId:randomUUID(),evidenceDependencies:{version:1 as const,complete:true,ids}});
async function fixture(t:any){
 const directory=await mkdtemp(join(tmpdir(),'mote-cache-history-integration-'));let ids:string[]=[],calls=0,hook:(()=>void)|undefined;const seen:QueryInput[]=[];
 const agent={configured:true,close:async()=>{},query:async(input:QueryInput)=>{calls++;seen.push(input);hook?.();return result(ids);}};
 let node=await buildApp(config(directory),{backgroundWorker:false,agent}),base=await node.app.listen({host:'127.0.0.1',port:0});
 t.after(async()=>{await node.app.close();await rm(directory,{recursive:true,force:true});});
 const request=async(path:string,payload?:unknown)=>{const response=await fetch(base+path,{headers,...(payload?{method:'POST',body:JSON.stringify(payload)}:{})});return {status:response.status,body:await response.json() as any};};
 const original=randomUUID();await node.store.ingest({id:original,deviceId:'generated',deviceName:'Generated',platform:'import',source:'note',capturedAt:'2026-10-01T00:00:00Z',durationMs:0,ocrText:'Generated original evidence.'});
 const artifactId='a'.repeat(64),inputs=[{id:original,fingerprint:node.store.archive.fingerprint(original)!}],save=(revision='1'.repeat(64),text='Generated first interpretation.')=>node.store.archive.save(artifactId,'generated-group',revision,{kind:'semantic',text,metadata:{}},inputs,'generated','1','generated');
 save();ids=[artifactId];
 const saved=await request('/api/query',{question:'Generated initial question'});assert.equal(saved.status,200,JSON.stringify(saved.body));
 return {get node(){return node;},original,artifactId,save,request,conversationId:saved.body.conversationId as string,seen,calls:()=>calls,setIds:(value:string[])=>{ids=value;},setHook:(value?:()=>void)=>{hook=value;},async restart(){await node.app.close();node=await buildApp(config(directory),{backgroundWorker:false,agent});base=await node.app.listen({host:'127.0.0.1',port:0});}};
}

for(const operation of ['replacement','eviction','parent-cascade'] as const)test(`context ${operation} preserves historical HTTP answers, revokes snapshots and summaries, and still erases on original deletion`,async t=>{
 const f=await fixture(t),history=async()=>(await f.request('/api/conversations/'+f.conversationId)).body;
 const before=await history();f.save();assert.deepEqual(await history(),before,'exact replay must not expire dialogue');
 await f.node.working.compact(f.conversationId,{...defaultLifecycleSettings,recentTurns:0},async()=>result([],'Generated historical summary.'));
 assert.ok(f.node.working.get(f.node.featureServices.conversations.get(f.conversationId)));
 const frozen=f.node.working.context(f.node.featureServices.conversations.get(f.conversationId),defaultLifecycleSettings);
 if(operation==='replacement')f.save('2'.repeat(64),'Generated corrected interpretation.');
 else if(operation==='eviction')f.node.store.db.prepare('DELETE FROM context_artifacts WHERE id=?').run(f.artifactId);
 else {
  const parent=f.node.store.archive.save('b'.repeat(64),'generated-parent','1'.repeat(64),{kind:'semantic',text:'Generated parent',metadata:{}},[{id:f.original,fingerprint:f.node.store.archive.fingerprint(f.original)!}],'generated','1','generated');
  f.node.store.db.prepare('INSERT INTO artifact_dependencies VALUES(?,?,?)').run(f.artifactId,parent.id,parent.revision);
  f.node.store.db.prepare('DELETE FROM context_artifacts WHERE id=?').run(parent.id);
 }
 const after=await history();assert.deepEqual(after.turns[0].result,before.turns[0].result);assert.equal(after.turns[0].evidenceDeleted,undefined);assert.equal(after.turns[0].evidenceStale,true);assert.ok(after.revision>before.revision);
 assert.equal(f.node.working.get(f.node.featureServices.conversations.get(f.conversationId)),undefined);
 const calls=f.calls();await assert.rejects(f.node.featureServices.queryAgent({question:'Generated frozen replay',conversation:frozen}),/Conversation changed/);assert.equal(f.calls(),calls,'expired snapshots never enter the provider');
 f.setIds([]);await f.restart();const followup=await f.request('/api/query',{conversationId:f.conversationId,question:'Discuss the earlier proposal'});assert.equal(followup.status,200,JSON.stringify(followup.body));assert.equal(f.seen.at(-1)!.conversation!.turns[0].evidenceStale,true);
 f.node.store.delete(f.original);const erased=await history();assert.ok(erased.turns.every((turn:any)=>turn.evidenceDeleted));assert.doesNotMatch(JSON.stringify(erased),/Generated answer based/);
});

for(const stage of ['model-result','summary'] as const)test(`changed context rejects a late ${stage} against the frozen conversation`,async t=>{
 const f=await fixture(t),change=()=>f.save('2'.repeat(64),'Generated corrected interpretation.');f.setIds([]);
 if(stage==='model-result'){
  f.setHook(change);const response=await f.request('/api/query',{conversationId:f.conversationId,question:'Generated in-flight follow-up'});assert.equal(response.status,409,JSON.stringify(response.body));f.setHook();
 }else await assert.rejects(f.node.working.compact(f.conversationId,{...defaultLifecycleSettings,recentTurns:0},async()=>{change();return result([],'Generated late summary.');}),/Conversation changed/);
 const conversation=f.node.featureServices.conversations.get(f.conversationId);assert.equal(conversation.turns.filter(turn=>turn.result).length,1);assert.equal(conversation.turns[0].evidenceStale,true);assert.equal(f.node.working.get(conversation),undefined);
});

test('startup installs the context-history lifecycle and a failed expiry rolls back the artifact and dialogue together',async t=>{
 const f=await fixture(t);f.node.store.db.exec('DROP TRIGGER context_history_invalidation');await f.restart();
 const db=f.node.store.db,before=f.node.featureServices.conversations.get(f.conversationId),artifact=f.node.store.archive.get(f.artifactId);
 db.exec("CREATE TRIGGER generated_context_expiry_failure BEFORE UPDATE ON conversations BEGIN SELECT RAISE(ABORT,'Generated snapshot expiry failure'); END");
 assert.throws(()=>f.save('2'.repeat(64),'Generated corrected interpretation.'),/Generated snapshot expiry failure/);
 assert.deepEqual(f.node.featureServices.conversations.get(f.conversationId),before,'failed deletion cannot commit partial history invalidation');assert.deepEqual(f.node.store.archive.get(f.artifactId),artifact,'the previous artifact remains intact for retry');
 db.exec('DROP TRIGGER generated_context_expiry_failure');f.save('2'.repeat(64),'Generated corrected interpretation.');assert.equal(f.node.featureServices.conversations.get(f.conversationId).turns[0].evidenceStale,true);
});
