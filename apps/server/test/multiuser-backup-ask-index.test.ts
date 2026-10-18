import test from 'node:test';
import assert from 'node:assert/strict';
import {cpSync,existsSync,mkdtempSync,readFileSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {createServer} from 'node:http';
import {DatabaseSync} from 'node:sqlite';
import {setTimeout as delay} from 'node:timers/promises';
import {buildApp} from '../src/app.js';
import {defaultModelSettings} from '../src/model-settings.js';
import {defaultProcessingSettings} from '../src/scope/processing-schema.js';
import {defaultMemorySettings} from '../src/scope/memory-schema.js';
import {EXECUTION_POLICIES} from '../src/execution-policy.js';
import {fixture,item} from './fixtures/ask-reader-host.js';
import {password,queryHttp,waitForState} from './fixtures/scoped-query-accounts.js';

const backupScript=fileURLToPath(new URL('../../../scripts/backup.ts',import.meta.url)),restoreScript=fileURLToPath(new URL('../../../scripts/restore-instance.mjs',import.meta.url));
const currentIndexColumns={ma_embeddings:['user_id','evidence_id','fingerprint','receipt','anchor_hash','model_key','embedding'],ma_embedding_events:['user_id','id','input']};
const cli=(script:string,args:string[])=>spawnSync(process.execPath,['--import','tsx',script,...args],{encoding:'utf8',timeout:30000});
const backup=(source:string,out:string)=>cli(backupScript,['--data',source,'--out',out]);
const restore=(from:string,target:string,deploymentId:string)=>cli(restoreScript,['--from',from,'--data',target,'--deployment-id',deploymentId]);
const database=<T>(root:string,work:(db:DatabaseSync)=>T):T=>{const db=new DatabaseSync(join(root,'mote.sqlite'));try{return work(db);}finally{db.close();}};
const successful=(result:ReturnType<typeof cli>)=>{assert.equal(result.error,undefined);assert.equal(result.signal,null);assert.equal(result.status,0,result.stderr);};
const checksummed=(archive:string)=>{const path=join(archive,'backup-manifest.json'),manifest=JSON.parse(readFileSync(path,'utf8'));manifest.checksums['mote.sqlite']=createHash('sha256').update(readFileSync(join(archive,'mote.sqlite'))).digest('hex');writeFileSync(path,JSON.stringify(manifest));};

test('ASK-STATIC-01 actual backup and restore CLIs reject every missing current Ask index table or column before publication',async t=>{
 const f=await fixture(t),directory=mkdtempSync(join(tmpdir(),'mote-ask-index-admission-')),snapshot=join(directory,'complete');t.after(()=>rmSync(directory,{recursive:true,force:true}));await f.node.app.close();
 successful(backup(f.root,snapshot));
 const damages=Object.entries(currentIndexColumns).flatMap(([table,columns])=>[{name:table+'-table',sql:'DROP TABLE '+table},...columns.map(column=>({name:table+'-'+column,sql:'ALTER TABLE '+table+' RENAME COLUMN '+column+' TO generated_missing_'+column}))]);
 for(const [mode,path]of [['source',f.root],['archive',snapshot]] as const)for(const damage of damages)await t.test(mode+'-'+damage.name,()=>{
  const malformed=join(directory,mode+'-'+damage.name),output=malformed+'-rejected';cpSync(path,malformed,{recursive:true});database(malformed,db=>db.exec(damage.sql));
  if(mode==='archive')checksummed(malformed);const unchanged=createHash('sha256').update(readFileSync(join(malformed,'mote.sqlite'))).digest('hex');
  const result=mode==='source'?backup(malformed,output):restore(malformed,output,f.node.deploymentId);assert.equal(result.error,undefined);assert.equal(result.signal,null);assert.equal(result.status,1,mode+' accepted '+damage.name);assert.match(result.stderr,mode==='source'?/Incomplete instance domain database/:/Instance restore failed/);assert.equal(existsSync(output),false,'incomplete current schema must be refused before destination creation');assert.equal(createHash('sha256').update(readFileSync(join(malformed,'mote.sqlite'))).digest('hex'),unchanged,'admission cannot repair or mutate the source database');
 });
});

test('current stopped index roundtrip retains vectors and pending events without replay, and fresh authorized intake indexes normally',async t=>{
 const f=await fixture(t),directory=mkdtempSync(join(tmpdir(),'mote-ask-index-roundtrip-')),snapshot=join(directory,'backup'),target=join(directory,'restored'),calls:{owner:string;input:string}[]=[];
 const provider=createServer((request,response)=>{void(async()=>{let raw='';for await(const chunk of request)raw+=chunk;const body=JSON.parse(raw),input=String(body.input),owner=String(request.headers.authorization).includes('_A_')?'A':'B';calls.push({owner,input});response.setHeader('content-type','application/json');response.end(JSON.stringify({data:[{embedding:input.includes('FUTURE_TRAVEL')||input==='generated future synonym'?[1,0]:[0,1]}],usage:{prompt_tokens:3,total_tokens:3}}));})().catch(()=>response.destroy());});
 await new Promise<void>(resolve=>provider.listen(0,'127.0.0.1',resolve));let restored:Awaited<ReturnType<typeof buildApp>>|undefined;
 t.after(async()=>{await restored?.app.close();provider.closeAllConnections();await new Promise<void>(resolve=>provider.close(()=>resolve()));rmSync(directory,{recursive:true,force:true});});
 const set=async(user:any,domain:string,value:unknown)=>{const view=await f.ok(user.token,'/api/configuration');return f.ok(user.token,'/api/configuration/'+domain,'PUT',{revision:view.revision,value});};
 for(const [user,owner]of [[f.a,'A'],[f.b,'B']] as const){
  await set(user,'models',{profiles:[{id:'same-embedding',name:'Generated stopped-backup embedding',settings:{...defaultModelSettings(),provider:'custom',protocol:'openai-completions',model:'generated-embedding',baseUrl:'http://127.0.0.1:'+(provider.address() as {port:number}).port+'/v1',apiKey:'GENERATED_'+owner+'_EMBEDDING'}}],selections:owner==='A'?{embedding:{kind:'personal',id:'same-embedding'}}:{}});
  await set(user,'processing',{...defaultProcessingSettings(),automatic:false,understandingEnabled:false});await set(user,'memory',{...defaultMemorySettings(),automatic:false,integration:false});
 }
 const ingest=async(token:string,id:string,text:string)=>f.ok(token,'/api/ingress/sources/same-source/items','POST',{batchId:id,items:[item(text,id)]});
 await ingest(f.a.token,'completed','GENERATED_COMPLETED_TRAVEL');
 await waitForState(async()=>database(f.root,db=>({vectors:Number(db.prepare('SELECT count(*) n FROM ma_embeddings WHERE user_id=?').get(f.a.userId)!.n),active:Number(db.prepare("SELECT count(*) n FROM execution_steps WHERE kind IN ('ask.index-admit','ask.embedding','memory.materials') AND state IN ('waiting','running')").get()!.n)})),value=>value.vectors>0&&value.active===0,'production completed index is ready');
 // Hold the real admission pool with an abortable generated task. The intake
 // still reaches its normal durable event/task transaction; no index row or
 // event is assembled by the test and shutdown retires the local blocker.
 const blockerKind='generated.ask-backup-admission';f.node.execution!.register({kind:blockerKind,pool:'embedding.admission',concurrency:()=>1,policy:EXECUTION_POLICIES.control,parseInput:raw=>raw as Record<string,unknown>,execute:async run=>{await delay(60000,undefined,{signal:run.signal});return {};}});
 const blocking=await f.ok(f.a.token,'/api/tasks','POST',{kind:blockerKind,operationId:'generated-ask-backup-blocker',input:{}});await waitForState(()=>f.ok(f.a.token,'/api/tasks/'+blocking.id),value=>value.state==='running','generated admission blocker entered');
 await ingest(f.a.token,'pending','GENERATED_PENDING_MUST_NOT_REPLAY');await waitForState(async()=>database(f.root,db=>db.prepare("SELECT id FROM execution_steps WHERE user_id=? AND kind='ask.index-admit' AND state='waiting'").all(f.a.userId)),rows=>rows.length>0,'actual intake persisted a waiting index admission');
 await f.node.app.close();const before=database(f.root,db=>({vectors:db.prepare('SELECT * FROM ma_embeddings ORDER BY user_id,evidence_id,model_key').all(),events:db.prepare('SELECT * FROM ma_embedding_events ORDER BY user_id,id').all(),pending:db.prepare("SELECT id FROM execution_steps WHERE kind='ask.index-admit' AND state='waiting' ORDER BY id").all()}));assert.ok(before.pending.length);assert.ok(before.events.length);const callsBefore=calls.length;
 successful(backup(f.root,snapshot));successful(restore(snapshot,target,f.node.deploymentId));
 database(target,db=>{assert.deepEqual(db.prepare('SELECT * FROM ma_embeddings ORDER BY user_id,evidence_id,model_key').all(),before.vectors);assert.deepEqual(db.prepare('SELECT * FROM ma_embedding_events ORDER BY user_id,id').all(),before.events);assert.equal(db.prepare('SELECT count(*) n FROM task_authorizations WHERE revoked=0').get()!.n,0);for(const row of before.pending){const task=db.prepare('SELECT state,error FROM execution_steps WHERE id=?').get(row.id);assert.equal(task!.state,'blocked');assert.equal(task!.error,'restore_authorization_required');}});
 restored=await buildApp({dataDir:target});let http=queryHttp(()=>restored!);assert.equal((await http.request(f.a.token,'/api/auth/self')).statusCode,401);
 const a=await http.ok(undefined,'/api/auth/login','POST',{username:f.a.username,password,mode:'client'}),b=await http.ok(undefined,'/api/auth/login','POST',{username:f.b.username,password,mode:'client'});await delay(100);assert.equal(calls.length,callsBefore,'new login does not replay backed-up index admissions');
 await restored.app.close();restored=await buildApp({dataDir:target});http=queryHttp(()=>restored!);await http.ok(a.token,'/api/auth/self');await delay(100);assert.equal(calls.length,callsBefore,'a further real restart does not backfill retained events');
 for(const row of before.pending)assert.notEqual((await http.request(a.token,'/api/tasks/'+row.id+'/retry','POST',{})).statusCode,200,'fresh identity cannot revive an old task grant');
 await http.ok(a.token,'/api/ingress/sources/same-source/items','POST',{batchId:'future-a',items:[item('GENERATED_FUTURE_TRAVEL_A','future-a')]});
 await waitForState(async()=>database(target,db=>db.prepare('SELECT id FROM pd_captures WHERE user_id=? AND external_id=?').get(a.userId,'future-a')),Boolean,'new original accepted');
 await waitForState(async()=>calls.slice(callsBefore).filter(call=>call.input.includes('GENERATED_FUTURE_TRAVEL_A')).length,count=>count>0,'fresh production index calls selected owner embedding');
 await waitForState(async()=>http.ok(a.token,'/api/context/retrieve?'+new URLSearchParams({query:'generated future synonym'})),page=>page.retrieval.mode==='hybrid'&&page.items.some((card:any)=>card.snippet.includes('GENERATED_FUTURE_TRAVEL_A')),'fresh indexed original is queryable');
 await http.ok(b.token,'/api/ingress/sources/same-source/items','POST',{batchId:'future-b',items:[item('GENERATED_UNCONFIGURED_B','future-b')]});await waitForState(async()=>database(target,db=>db.prepare("SELECT state FROM execution_steps WHERE user_id=? AND kind='ask.index-admit'").all(b.userId)),rows=>rows.length>0&&rows.every(row=>row.state==='succeeded'),'unconfigured future event admitted and consumed');assert.equal(calls.filter(call=>call.owner==='B').length,0,'unconfigured indexing still admits its durable event without calling a provider');assert.equal(calls.filter(call=>call.input.includes('GENERATED_PENDING_MUST_NOT_REPLAY')).length,0);
 database(target,db=>{for(const row of before.pending)assert.equal(db.prepare('SELECT state FROM execution_steps WHERE id=?').get(row.id)!.state,'blocked');assert.deepEqual(db.prepare('SELECT * FROM ma_embedding_events WHERE id IN(SELECT value FROM json_each(?)) ORDER BY user_id,id').all(JSON.stringify(before.events.map(row=>row.id))),before.events);});
});
