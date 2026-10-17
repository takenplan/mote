import assert from 'node:assert/strict';
import test from 'node:test';
import {DatabaseSync} from 'node:sqlite';
import {join} from 'node:path';
import {Readable} from 'node:stream';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {keepFixture} from './fixtures/keep-controls.js';
import {PrivateSql} from '../src/scope/private-data-sql.js';

type Fixture=Awaited<ReturnType<typeof keepFixture>>;
type User={token:string;userId:string};
const deferred=()=>{let resolve!:()=>void;const promise=new Promise<void>(r=>resolve=r);return {promise,resolve};};
const path='/api/files/export?mode=data&selection=current&type=text%2Fplain';
const hostDb=(f:Fixture)=>(f.node.ingress as unknown as {db:DatabaseSync}).db;
const rawToken=(db:DatabaseSync)=>String(db.prepare('SELECT total_changes() n').get()!.n)+':'+String(db.prepare('PRAGMA data_version').get()!.data_version);
function untar(bytes:Buffer){const tar=gunzipSync(bytes),files=new Map<string,Buffer>();for(let at=0;at+512<=tar.length;){const h=tar.subarray(at,at+512);if(h.every(n=>!n))break;const name=h.subarray(0,100).toString().replace(/\0.*$/s,''),size=parseInt(h.subarray(124,136).toString(),8);assert.ok(!name.startsWith('/')&&!name.split('/').includes('..'));files.set(name,tar.subarray(at+512,at+512+size));at+=512+Math.ceil(size/512)*512;}return files;}
async function seed(f:Fixture,user:User,bytes=Buffer.from('HAND_AUTHORED_CACHE_FIXTURE'),revision='v1'){
 const source=await f.request(user.token,'/api/ingress/sources','POST',{id:'cache-source',name:'Synthetic cache source',kind:'local-files',deviceId:'cache-device',platform:'import',retention:'archive'});assert.equal(source.status,200,source.text);
 const ingress=f.node.ingress.forUser(await f.node.authority.authenticate(user.token));
 const r=ingress.receiveSourceItemsWithOriginals('cache-source','cache-batch-'+revision,[{externalId:'same-file',revision,observedAt:revision==='v1'?'2026-01-01T00:00:00Z':'2026-01-02T00:00:00Z',title:'Synthetic cache '+revision,text:'',kind:'file',layer:'original',mimeType:'text/plain'}],[{bytes,mime:'text/plain',format:'file'}]);return r.captures[0];
}
async function held(t:Parameters<typeof keepFixture>[0]){
 let barrier:{entered:ReturnType<typeof deferred>;release:ReturnType<typeof deferred>}|undefined;
 const f=await keepFixture(t,node=>node.app.addHook('onSend',async(req,_reply,payload)=>{if(barrier&&req.url.startsWith('/api/files/export')){const current=barrier;current.entered.resolve();await current.release.promise;}return payload;}));
 return {f,start:()=>{assert.equal(barrier,undefined);const current={entered:deferred(),release:deferred()};barrier=current;const response=f.request(f.a.token,path).then(r=>({ok:true,bytes:r.bytes})).catch(()=>({ok:false,bytes:Buffer.alloc(0)}));return {entered:current.entered.promise,response,release:()=>{barrier=undefined;current.release.resolve();}};}};
}

test('KEEP cache token observes same-connection writes and rollback plus only committed external changes',async t=>{
 const f=await keepFixture(t);await seed(f,f.a);const db=hostDb(f),external=new DatabaseSync(join(f.directory,'mote.sqlite'));t.after(()=>external.close());
 const context=await f.node.authority.authenticate(f.a.token),sql=new PrivateSql(db,context.userId,()=>f.node.authority.assert(context)),before=sql.changeToken();
 assert.equal(sql.changeToken(),before,'reads do not invalidate');
 db.exec('BEGIN');sql.run("UPDATE pd_sources SET json=json_set(json,'$.enabled',json('false')) WHERE user_id=$user AND id=?",'cache-source');const written=sql.changeToken();assert.notEqual(written,before);db.exec('ROLLBACK');assert.notEqual(sql.changeToken(),before,'rolled-back writes still invalidate');
 assert.equal((await f.request(f.a.token,'/api/sources/cache-source')).json().enabled,true);
 const rolledBack=sql.changeToken();external.exec('BEGIN');external.prepare("UPDATE pd_sources SET json=json_set(json,'$.enabled',json('false')) WHERE user_id=? AND id=?").run(f.a.userId,'cache-source');assert.equal(sql.changeToken(),rolledBack,'uncommitted external write is invisible');external.exec('ROLLBACK');assert.equal(sql.changeToken(),rolledBack,'external rollback changes no visible snapshot');
 external.exec('BEGIN');external.prepare("UPDATE pd_sources SET json=json_set(json,'$.enabled',json('false')) WHERE user_id=? AND id=?").run(f.a.userId,'cache-source');external.exec('COMMIT');assert.notEqual(sql.changeToken(),rolledBack);assert.equal((await f.request(f.a.token,path)).status,200);assert.equal(JSON.parse(untar((await f.request(f.a.token,path)).bytes).get('metadata.json')!.toString()).originals.length,0);
});

test('KEEP cached stream rechecks a same-connection rollback without aborting the unchanged authorized archive',async t=>{
 const h=await held(t),{f}=h,bytes=Buffer.from('SYNTHETIC_ROLLBACK_STAYS_AUTHORIZED');await seed(f,f.a,bytes);const run=h.start();
 try{await run.entered;const db=hostDb(f),before=rawToken(db);db.exec('BEGIN');db.prepare("UPDATE pd_sources SET json=json_set(json,'$.enabled',json('false')) WHERE user_id=? AND id=?").run(f.a.userId,'cache-source');db.exec('ROLLBACK');assert.notEqual(rawToken(db),before);run.release();const r=await run.response;assert.equal(r.ok,true);const files=untar(r.bytes),manifest=JSON.parse(files.get('metadata.json')!.toString());assert.equal(manifest.originals.length,1);assert.deepEqual(files.get(manifest.originals[0].member),bytes);}finally{run.release();}
});

test('KEEP cached selection retires on externally committed head change and preserves retained history',async t=>{
 const h=await held(t),{f}=h,first=Buffer.from('SYNTHETIC_HEAD_V1'),second=Buffer.from('SYNTHETIC_HEAD_V2'),a=await seed(f,f.a,first),b=await seed(f,f.a,second,'v2');
 const external=new DatabaseSync(join(f.directory,'mote.sqlite'));t.after(()=>external.close());const run=h.start();
 try{await run.entered;external.exec('BEGIN');external.prepare('UPDATE pd_source_heads SET capture_id=? WHERE user_id=? AND source_id=? AND external_id=?').run(a.id,f.a.userId,'cache-source','same-file');external.exec('COMMIT');run.release();const r=await run.response;assert.throws(()=>gunzipSync(r.bytes));}finally{run.release();}
 const current=untar((await f.request(f.a.token,path)).bytes),manifest=JSON.parse(current.get('metadata.json')!.toString());assert.equal(manifest.originals[0].captureId,a.id);assert.deepEqual(current.get(manifest.originals[0].member),first);
 const history=JSON.parse(untar((await f.request(f.a.token,path.replace('selection=current','selection=history'))).bytes).get('metadata.json')!.toString());assert.equal(history.originals.length,2);assert.equal(history.originals.find((r:{captureId:string})=>r.captureId===b.id).current,false);
});

test('KEEP cached stream retires after real source deletion and identical source/capture reconstruction',async t=>{
 const h=await held(t),{f}=h,bytes=Buffer.from('SYNTHETIC_IDENTICAL_RECONSTRUCTION'),before=await seed(f,f.a,bytes);await seed(f,f.b,Buffer.from('SYNTHETIC_OTHER_OWNER'));const run=h.start();
 try{await run.entered;assert.equal((await f.request(f.a.token,'/api/sources/cache-source','DELETE')).status,200);const after=await seed(f,f.a,bytes);assert.equal(after.id,before.id);run.release();const retired=await run.response;assert.throws(()=>gunzipSync(retired.bytes));}finally{run.release();}
 const fresh=untar((await f.request(f.a.token,path)).bytes),manifest=JSON.parse(fresh.get('metadata.json')!.toString());assert.equal(manifest.originals.length,1);assert.ok(manifest.originals[0].originalGeneration>0);assert.deepEqual(fresh.get(manifest.originals[0].member),bytes);assert.equal((await f.request(f.b.token,path)).status,200);
});

test('KEEP cached output revalidates host authorization even when SQLite token is unchanged',async t=>{
 const entered=deferred(),release=deferred();let active=false,emitted=0;
 const f=await keepFixture(t,node=>node.app.addHook('onSend',async(req,_reply,payload)=>{if(!active||!req.url.startsWith('/api/files/export'))return payload;const stream=payload as Readable;return Readable.from((async function*(){try{for await(const chunk of stream){emitted++;yield chunk;if(emitted===1){entered.resolve();await release.promise;}}}finally{stream.destroy();}})());}));
 const bytes=Buffer.concat(Array.from({length:32768},(_,n)=>createHash('sha256').update('SYNTHETIC_LIFECYCLE_'+n).digest()));await seed(f,f.a,bytes);active=true;
 const response=f.request(f.a.token,path).then(()=>true).catch(()=>false);
 try{await entered.promise;const db=hostDb(f),before=rawToken(db);await f.node.accounts!.close();assert.equal(rawToken(db),before,'closing the actual account verifier mutates no SQLite data');release.resolve();assert.equal(await response,false);assert.equal(emitted,1);}finally{active=false;release.resolve();}
});
