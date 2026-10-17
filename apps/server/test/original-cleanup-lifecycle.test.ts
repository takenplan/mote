import test,{type TestContext} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {chmodSync,lstatSync,mkdtempSync,readFileSync,rmSync,symlinkSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {basename,join} from 'node:path';
import {privateDirectory} from '../src/private-storage.js';
import {installPrivateData} from '../src/scope/private-data-schema.js';
import {PrivateSql} from '../src/scope/private-data-sql.js';
import {installIngress} from '../src/scope/ingress-schema.js';
import {identityHash,Originals} from '../src/scope/originals.js';

type Area='work'|'uploads'|'objects';
const areas:Area[]=['work','uploads','objects'];
const absent=(path:string)=>assert.throws(()=>lstatSync(path),{code:'ENOENT'});
function fixture(t:TestContext){
 const base=mkdtempSync(join(tmpdir(),'mote-original-cleanup-')),vault=join(base,'vault'),db=new DatabaseSync(':memory:');
 t.after(()=>{db.close();rmSync(base,{recursive:true,force:true});});
 installPrivateData(db);installIngress(db);
 let current=true;const revoked=new Error('generated_revoked'),authorize=()=>{if(!current)throw revoked;};
 const a=new Originals(vault,'generated-cleanup',new PrivateSql(db,'A',authorize),authorize),b=new Originals(vault,'generated-cleanup',new PrivateSql(db,'B',()=>{}),()=>{});
 return {base,vault,db,a,b,revoked,revoke:()=>{current=false;}};
}
function entry(originals:Originals,area:Area,id=randomUUID()){
 const name=area==='objects'?identityHash('generated-stage')+'.'+id+'.tmp':id,path=join(originals.area(area),name);privateDirectory(path);writeFileSync(join(path,'generated.txt'),'generated owned cleanup fixture');return path;
}
function clean(originals:Originals,area:Area,path:string){
 if(area==='objects')(originals as unknown as {cleanStage(path:string):void}).cleanStage(path);
 else if(area==='uploads')originals.cleanUpload(basename(path));else originals.cleanWork(basename(path));
}

test('private directories keep the default creation and mode contract, with explicit noncreating checks',t=>{
 const f=fixture(t),path=join(f.base,'missing-parent','child');
 assert.equal(privateDirectory(path,false),false);absent(join(f.base,'missing-parent'));
 assert.equal(privateDirectory(path),true);assert.equal(lstatSync(path).mode&0o777,0o700);
 chmodSync(path,0o755);assert.equal(privateDirectory(path),true);assert.equal(lstatSync(path).mode&0o777,0o700);
 assert.equal(privateDirectory(path,false),true);
});

test('original cleanup never recreates a missing vault, owner, area or entry',async t=>{
 for(const area of areas)for(const level of ['vault','originals','owner','area','entry'] as const)await t.test(area+' missing '+level,t=>{
  const f=fixture(t),path=entry(f.a,area),root=f.a.root(),parent=join(root,area),missing={vault:f.vault,originals:join(f.vault,'originals'),owner:root,area:parent,entry:path}[level];
  rmSync(missing,{recursive:true});clean(f.a,area,path);absent(missing);
 });
});

test('original cleanup removes only the requested A directory and retains siblings and B',async t=>{
 for(const area of areas)await t.test(area,t=>{
  const f=fixture(t),id=randomUUID(),target=entry(f.a,area,id),sibling=entry(f.a,area),other=entry(f.b,area,id);
  clean(f.a,area,target);absent(target);
  for(const retained of [sibling,other])assert.equal(readFileSync(join(retained,'generated.txt'),'utf8'),'generated owned cleanup fixture');
 });
});

test('original cleanup refuses existing and dangling symlinks at every checked level',async t=>{
 for(const area of areas)for(const level of ['vault','originals','owner','area','entry'] as const)for(const dangling of [false,true])await t.test(area+' '+level+(dangling?' dangling':' existing'),t=>{
  const f=fixture(t),path=entry(f.a,area),root=f.a.root(),parent=join(root,area),link={vault:f.vault,originals:join(f.vault,'originals'),owner:root,area:parent,entry:path}[level],outside=join(f.base,'outside');
  if(!dangling){privateDirectory(outside);writeFileSync(join(outside,'retain.txt'),'generated outside marker');}
  rmSync(link,{recursive:true});symlinkSync(outside,link,'dir');
  assert.throws(()=>clean(f.a,area,path));assert.ok(lstatSync(link).isSymbolicLink());
  if(!dangling)assert.equal(readFileSync(join(outside,'retain.txt'),'utf8'),'generated outside marker');else absent(outside);
 });
});

test('stage cleanup rejects a different owner or parent before testing missing A storage',t=>{
 const f=fixture(t),other=entry(f.b,'objects'),aRoot=f.a.root();rmSync(aRoot,{recursive:true});
 assert.throws(()=>clean(f.a,'objects',other),{message:'conflict'});absent(aRoot);
 assert.equal(readFileSync(join(other,'generated.txt'),'utf8'),'generated owned cleanup fixture');
 const outside=join(f.base,'unrelated');privateDirectory(outside);assert.throws(()=>clean(f.a,'objects',outside),{message:'conflict'});assert.ok(lstatSync(outside).isDirectory());absent(aRoot);
});

test('a late real workspace finally cleans without recreating the removed vault',async t=>{
 const f=fixture(t);let release!:()=>void,entered!:()=>void;
 const held=new Promise<void>(resolve=>{release=resolve;}),ready=new Promise<void>(resolve=>{entered=resolve;});
 const pending=f.a.workspace(async workspace=>{workspace.write('generated.txt',Buffer.from('generated workspace'));entered();await held;return 'generated result';});
 await ready;rmSync(f.vault,{recursive:true});release();assert.equal(await pending,'generated result');absent(f.vault);
 assert.equal(f.db.prepare('SELECT count(*) AS n FROM ig_work').get()!.n,0);
});

test('revoked workspace finally retains the authority failure and does not recreate removed storage',async t=>{
 const f=fixture(t);let release!:()=>void,entered!:()=>void;
 const held=new Promise<void>(resolve=>{release=resolve;}),ready=new Promise<void>(resolve=>{entered=resolve;});
 const pending=f.a.workspace(async workspace=>{workspace.write('generated.txt',Buffer.from('generated workspace'));entered();await held;return 'generated result';});
 await ready;rmSync(f.vault,{recursive:true});f.revoke();release();await assert.rejects(pending,error=>error===f.revoked);absent(f.vault);
 assert.equal(f.db.prepare('SELECT count(*) AS n FROM ig_work').get()!.n,1,'revoked metadata cleanup remains lifecycle recovery work');
});
