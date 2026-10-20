import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {join} from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';
import {memoryFixture} from './fixtures/ask-reader-memory.js';

const deferred=()=>{let resolve!:()=>void;const promise=new Promise<void>(r=>resolve=r);return {promise,resolve};};
async function until(check:()=>boolean,description:string){const deadline=Date.now()+15000;while(!check()){assert.ok(Date.now()<deadline,description);await delay(10);}}

for(const retirement of ['source','material-pin','memory-tail','epoch','conversation','request-abort'] as const)test('Ask workspace Memory proof rechecks '+retirement+' after working preparation awaits',async t=>{
 const f=await memoryFixture(t),first=await f.publish(f.a,'A','same-source','first'),tail=await f.publish(f.a,'A','same-source','tail');
 await f.extract(f.a,first.id);await f.extract(f.a,tail.id);await f.enableAsk(f.a,'A');
 const cards=(await f.ok(f.a.token,'/api/memories')).items;assert.equal(cards.length,2);
 const context=await f.node.authority.authenticate(f.a.token),host=f.node.ask! as any,original=host.working,release=deferred(),controller=new AbortController();let held=false;
 // The normal fragment has opened and pinned both cards and created its real
 // Ingress workspace. Suspend the existing working await before its caller
 // resumes; this adds no mocked authorization or manually assembled Ask path.
 host.working=async function(...args:any[]){const prepared=await Reflect.apply(original,this,args);if(!held){held=true;await release.promise;}return prepared;};
 f.beforeClose(()=>release.resolve());t.after(()=>{host.working=original;});
 const read=<T>(work:(db:DatabaseSync)=>T)=>{const db=new DatabaseSync(join(f.root,'mote.sqlite'),{readOnly:true});try{return work(db);}finally{db.close();}};
 const conversationId=randomUUID(),id=randomUUID();await f.ok(f.a.token,'/api/conversations','POST',{id:conversationId});const before=f.requests.length;
 let foreground:Promise<unknown>|undefined;
 if(retirement==='request-abort')foreground=host.bind(context,{assertCurrent:()=>f.node.authority.assert(context)}).query({question:'GENERATED_WORKSPACE_REVOKED',conversationId},{signal:controller.signal}).then((value:unknown)=>({value}),(error:unknown)=>({error}));
 else await f.ok(f.a.token,'/api/query-runs','POST',{id,input:{question:'GENERATED_WORKSPACE_REVOKED',conversationId}});
 await until(()=>held,'normal Ask did not reach working await inside workspace');
 const row=read(db=>db.prepare('SELECT id,memory_pins,pins,materials FROM ma_runs WHERE user_id=? AND json_extract(input,\'$.conversationId\')=?').get(f.a.userId,conversationId)!);
 assert.equal(JSON.parse(String(row.memory_pins)).length,2,'all opening cards were pinned before suspension');
 assert.equal(read(db=>Number(db.prepare('SELECT count(*) n FROM ig_work WHERE user_id=?').get(f.a.userId)!.n)),1,'the real workspace remains live across the await');
 if(retirement==='source')await f.ok(f.a.token,'/api/sources/same-source','DELETE');
 else if(retirement==='material-pin')await f.ok(f.a.token,'/api/materials/'+tail.id+'/context','PATCH',{expectedRevision:tail.revision,ownerRelation:'owner'});
 else if(retirement==='memory-tail')await f.ok(f.a.token,'/api/memories/'+cards[1].id,'DELETE');
 else if(retirement==='epoch'){await f.ok(f.admin.token,'/api/admin/accounts/'+f.a.userId,'PATCH',{disabled:true});await f.ok(f.admin.token,'/api/admin/accounts/'+f.a.userId,'PATCH',{disabled:false});}
 else if(retirement==='conversation')await f.ok(f.a.token,'/api/conversations/'+conversationId,'DELETE');
 else controller.abort();
 release.resolve();
 if(foreground)assert.ok('error' in (await foreground as any),'foreground request cancellation propagates');
 await until(()=>read(db=>Number(db.prepare("SELECT count(*) n FROM execution_steps WHERE kind='ask.chat' AND state IN ('running','waiting')").get()!.n))===0,'revoked fragment did not settle');
 assert.equal(f.requests.length,before,'a revoked workspace cannot reach the Ask model transport');
 assert.equal(read(db=>Number(db.prepare('SELECT count(*) n FROM ma_artifacts WHERE user_id=? AND run_id=?').get(f.a.userId,row.id)!.n)),0,'no answer artifact is committed');
 assert.equal(read(db=>Number(db.prepare('SELECT count(*) n FROM ma_turns WHERE user_id=? AND conversation_id=? AND json_extract(result,\'$.answer\') IS NOT NULL').get(f.a.userId,conversationId)!.n)),0,'no successful dialogue body is disclosed');
});
