import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {fixture} from './fixtures/scoped-actions.js';
import {waitForState} from './fixtures/scoped-query-accounts.js';

async function exported(f:Awaited<ReturnType<typeof fixture>>){return f.ok(f.a.token,'/api/export');}
async function imported(f:Awaited<ReturnType<typeof fixture>>,archive:unknown,id=randomUUID()){await f.ok(f.a.token,'/api/portable/imports','POST',{operationId:id,archive});return waitForState(()=>f.ok(f.a.token,'/api/portable/imports/'+id),value=>value.state!=='working','actual account import');}

test('actual portable HTTP imports owned missing todos and preserves Actions authority while same-ID B and successful retries stay unchanged',async t=>{
 const f=await fixture(t),id=randomUUID(),input={id,title:'GENERATED_OWNED_TODO_A'};for(const user of [f.a,f.b]){const response=await f.request(user.token,'/api/todos','POST',user===f.a?input:{id,title:'GENERATED_OWNED_TODO_B'});assert.equal(response.statusCode,201,response.body);}const saved=await exported(f),context=await f.node.authority.authenticate(f.a.token);await f.node.services.forUser(context).deleteUser('todos',randomUUID());const beforeB=await f.ok(f.b.token,'/api/todos'),beforeGrants=f.read(db=>db.prepare('SELECT * FROM task_authorizations ORDER BY task_id').all()),operationId=randomUUID();
 const receipt=await imported(f,saved,operationId);assert.equal(receipt.state,'completed',JSON.stringify(receipt));assert.ok(receipt.coverage.importedDomains.includes('todos'));assert.ok(receipt.coverage.preservedDomains.includes('actions'));assert.equal((await f.ok(f.a.token,'/api/todos')).items[0].title,input.title);assert.deepEqual(await f.ok(f.b.token,'/api/todos'),beforeB);assert.deepEqual(f.read(db=>db.prepare('SELECT * FROM task_authorizations ORDER BY task_id').all()),beforeGrants);assert.deepEqual(await imported(f,saved,operationId),receipt);assert.equal((await imported(f,saved)).state,'completed');
 await f.restart();assert.deepEqual(await f.ok(f.a.token,'/api/portable/imports/'+operationId),receipt);const replay=await f.request(f.a.token,'/api/todos','POST',input);assert.equal(replay.statusCode,201,replay.body);assert.equal(replay.json().version,1);assert.equal((await f.request(f.b.token,'/api/portable/imports','POST',{operationId:randomUUID(),archive:saved})).statusCode,403);
});

test('a changed current todo or duplicate archive ID fails the real shared import atomically without overwriting local work',async t=>{
 const f=await fixture(t),id=randomUUID(),created=await f.request(f.a.token,'/api/todos','POST',{id,title:'Generated archived todo'});assert.equal(created.statusCode,201);const saved=await exported(f);await f.ok(f.a.token,'/api/todos/'+id,'PATCH',{version:1,title:'Generated later local title'});const before=await f.ok(f.a.token,'/api/todos'),invalid=structuredClone(saved),todos=invalid.domains.find((value:any)=>value.domain==='todos').payload.todos,newId=randomUUID();todos.unshift({...todos[0],id:newId});const conflict=await imported(f,invalid);assert.equal(conflict.state,'failed');assert.equal(conflict.error,'archive_conflict');assert.deepEqual(await f.ok(f.a.token,'/api/todos'),before);assert.equal(f.read(db=>Number(db.prepare('SELECT count(*) n FROM td_todos WHERE user_id=? AND id=?').get(f.a.userId,newId)!.n)),0);
 const duplicate=structuredClone(saved),list=duplicate.domains.find((value:any)=>value.domain==='todos').payload.todos;list.push({...list[0]});const rejected=await imported(f,duplicate);assert.equal(rejected.state,'failed');assert.deepEqual(await f.ok(f.a.token,'/api/todos'),before);
});
