import {afterEach,beforeEach,expect,it} from 'vitest';
import {spawn} from 'node:child_process';
import {createRequire} from 'node:module';
import {DatabaseSync} from 'node:sqlite';
import {createHash} from 'node:crypto';
import {mkdtemp,mkdir,readdir,realpath,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {serializeConfigDocument} from '@mote/shared/config-file';
const nativeImport=createRequire(import.meta.url)('./native-backend.cjs') as (url:string)=>Promise<any>;
const password='Generated-cli-regression-only-01';
let root:string,url:string,node:Awaited<ReturnType<typeof import('../../server/src/app')['buildApp']>>,fail:boolean;
let sessions:Record<string,{token:string;userId:string}>;
beforeEach(async()=>{
 root=await realpath(await mkdtemp(join(tmpdir(),'mote-source-cli-')));fail=false;
 const {buildApp}=await nativeImport(pathToFileURL(resolve('../../apps/server/src/app.ts')).href) as typeof import('../../server/src/app');
 node=await buildApp({dataDir:join(root,'central')});await node.accounts!.initialize('generated-admin',password);
 const admin=await node.accounts!.login('generated-admin',password,'generated','client',0),context=await node.authority.authenticate(admin.token);sessions={};
 for(const profile of ['dev','test']){await node.accounts!.createAccount(context,node.authority,{username:'generated-'+profile,password,administrator:false});sessions[profile]=await node.accounts!.login('generated-'+profile,password,'generated','client',0);}
 // Fault only the response after actual authorized M03 SQL/filesystem publication.
 node.app.addHook('onSend',async(request,reply,payload)=>{if(fail&&request.url.endsWith('/commit'))reply.raw.destroy();return payload;});
 url=await node.app.listen({host:'127.0.0.1',port:0});
});
afterEach(async()=>{await node?.app.close();await rm(root,{recursive:true,force:true});});
function read<T>(work:(db:DatabaseSync)=>T){const db=new DatabaseSync(join(root,'central','mote.sqlite'));try{return work(db);}finally{db.close();}}
const captures=(profile='dev')=>read(db=>db.prepare('SELECT json FROM pd_captures WHERE user_id=? ORDER BY rowid').all(sessions[profile].userId).map(row=>JSON.parse(String(row.json))));
async function run(profile:string,args:string[]=[],token=sessions[profile].token,confirmTransient=true){
 const directory=join(root,profile);await mkdir(directory,{recursive:true});const configFile=join(directory,'mote.yaml'),connection=new URL(url);
 await writeFile(configFile,serializeConfigDocument({version:1,revision:0,server:{profile,host:connection.hostname,port:Number(connection.port),token},storage:{dataDir:'./data'}}),{mode:0o600});
 const child=spawn(process.execPath,['--import','tsx',resolve('../../scripts/import-files.ts'),'--root',join(root,'selected'),...(confirmTransient?['--allow-transient-upload']:[]),...args],{cwd:resolve('../..'),env:{...Object.fromEntries(Object.entries(process.env).filter(([k])=>!k.startsWith('MOTE_'))),MOTE_CONFIG_FILE:configFile},stdio:['ignore','pipe','pipe']});
 let output='',errors='';child.stdout.on('data',chunk=>output+=chunk);child.stderr.on('data',chunk=>errors+=chunk);
 const code=await new Promise<number|null>((done,reject)=>{child.once('error',reject);child.once('exit',done);});return {code,output,errors,directory};
}
it('CLI independently syncs equal input for two real accounts, then skips acknowledged unchanged versions',async()=>{
 await mkdir(join(root,'selected'));await writeFile(join(root,'selected','a.md'),'合成 CLI 🧑🏽‍💻');
 for(const profile of ['dev','test']){const first=await run(profile);expect(first.code,first.errors).toBe(0);expect(first.output).toContain('Received 1 changed');expect((await run(profile)).output).toContain('Received 0 changed');expect(captures(profile)).toHaveLength(1);}
 expect(read(db=>db.prepare('SELECT count(*) n FROM ig_originals').get()!.n)).toBe(2);
},20000);
it('CLI reconciles lost real commit ACK after process exit, then tracks explicit deletion and restoration',async()=>{
 await mkdir(join(root,'selected'));const file=join(root,'selected','a.md');await writeFile(file,'合成离线版本');
 fail=true;expect((await run('dev',['--track-deletions'])).code).not.toBe(0);expect(captures()).toHaveLength(1);
 fail=false;const retried=await run('dev',['--track-deletions']);expect(retried.code,retried.errors).toBe(0);expect(captures()).toHaveLength(1);
 await rm(file);const removed=await run('dev',['--track-deletions']);expect(removed.code,removed.errors).toBe(0);expect(captures().at(-1)?.provenance.deleted).toBe(true);
 await writeFile(file,'合成离线版本');const restored=await run('dev',['--track-deletions']);expect(restored.code,restored.errors).toBe(0);expect(captures()).toHaveLength(3);expect(captures().at(-1)?.provenance.revision).not.toBe(captures()[0].provenance.revision);
},20000);
it('CLI recovers its dead process lock in the stable account partition without reimporting acknowledged data',async()=>{
 await mkdir(join(root,'selected'));await writeFile(join(root,'selected','a.md'),'合成 crash lock');const imported=await run('dev');expect(imported.code,imported.errors).toBe(0);
 const accounts=join(imported.directory,'file-sync','accounts'),partition=join(accounts,(await readdir(accounts))[0]),stateFile=(await readdir(partition)).find(file=>file.endsWith('.json.sqlite'))!.replace(/\.sqlite$/,'');
 const child=spawn(process.execPath,['-e','process.exit(0)']);await new Promise(done=>child.once('exit',done));await writeFile(join(partition,stateFile+'.lock'),String(child.pid));
 expect((await run('dev')).output).toContain('Received 0 changed');expect(captures()).toHaveLength(1);
},20000);
it('CLI account change at the same URL keeps A pending bytes out of the B scan and preserves both owners',async()=>{
 await mkdir(join(root,'selected'));const file=join(root,'selected','a.md');await writeFile(file,'old synthetic private text');fail=true;expect((await run('dev')).code).not.toBe(0);
 fail=false;await writeFile(file,'new synthetic current text');const next=await run('dev',[],sessions.test.token);expect(next.code,next.errors).toBe(0);expect(captures('dev')).toHaveLength(1);expect(captures('test')).toHaveLength(1);
 const hashes=read(db=>db.prepare('SELECT user_id,hash FROM ig_objects ORDER BY user_id').all());expect(hashes.find(row=>row.user_id===sessions.dev.userId)?.hash).toBe(createHash('sha256').update('old synthetic private text').digest('hex'));expect(hashes.find(row=>row.user_id===sessions.test.userId)?.hash).toBe(createHash('sha256').update('new synthetic current text').digest('hex'));
 const accounts=join(next.directory,'file-sync','accounts');expect(await readdir(accounts)).toHaveLength(2);
},20000);
it('CLI dry-run writes no sync state, while real reference ingestion sends no original body',async()=>{
 await mkdir(join(root,'selected'));await writeFile(join(root,'selected','a.md'),'合成引用正文');const dry=await run('dev',['--dry-run']);expect(dry.code,dry.errors).toBe(0);expect(await readdir(dry.directory)).toEqual(['mote.yaml']);expect(captures()).toHaveLength(0);
 const reference=await run('dev',['--retention','reference']);expect(reference.code,reference.errors).toBe(0);expect(captures()[0].provenance.layer).toBe('reference');expect(captures()[0].ocrText).toBe('');expect(read(db=>db.prepare('SELECT count(*) n FROM ig_originals').get()!.n)).toBe(0);
},20000);
it('CLI refuses transient bytes without consent before creating an outbox or contacting the real host',async()=>{
 await mkdir(join(root,'selected'));await writeFile(join(root,'selected','a.md'),'Generated consent fixture');const blocked=await run('dev',[],sessions.dev.token,false);expect(blocked.code).not.toBe(0);expect(captures()).toHaveLength(0);expect(await readdir(blocked.directory)).toEqual(['mote.yaml']);
 const dry=await run('dev',['--dry-run'],sessions.dev.token,false);expect(dry.code,dry.errors).toBe(0);expect(await readdir(dry.directory)).toEqual(['mote.yaml']);
 const reference=await run('dev',['--retention','reference'],sessions.dev.token,false);expect(reference.code,reference.errors).toBe(0);expect(captures()).toHaveLength(1);expect(captures()[0].provenance.layer).toBe('reference');
},20000);
it('CLI resumes its directory checkpoint after a generated file exceeds the per-pass byte budget',async()=>{
 await mkdir(join(root,'selected'));await writeFile(join(root,'selected','a.md'),Buffer.alloc(17*1024*1024+19,65));await writeFile(join(root,'selected','b.md'),'Generated file after large snapshot');
 for(let pass=0;pass<2;pass++){const result=await run('dev',['--retention','archive']);expect(result.code,result.errors).toBe(0);expect(result.output).toContain('Received 1 changed');expect(captures()).toHaveLength(pass+1);}
 const reconciled=await run('dev',['--retention','archive']);expect(reconciled.code,reconciled.errors).toBe(0);expect(reconciled.output).toContain('Received 0 changed');expect(captures()).toHaveLength(2);expect(read(db=>db.prepare('SELECT count(*) n FROM ig_parts').get()!.n)).toBe(6);
},30000);
