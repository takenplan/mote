import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn,execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {mkdtemp,mkdir,readFile,writeFile,readdir,copyFile,symlink,rm,stat} from 'node:fs/promises';
import {join,dirname} from 'node:path';
import {tmpdir} from 'node:os';
import {setTimeout as delay} from 'node:timers/promises';
import {DatabaseSync} from 'node:sqlite';
import {createServer} from 'node:net';
import {repository,profilePaths,loadProfile,updateProfileConfiguration} from '../profile-lib.mjs';
import {developmentProfile} from '../dev-server.mjs';
import {freePort} from '../profile-fixtures.mjs';
import {serializeConfigDocument} from '../../packages/shared/src/config-file.ts';

const exec=promisify(execFile),protocol={'x-mote-protocol-version':'2'};
const exists=path=>stat(path).then(()=>true,error=>error.code==='ENOENT'?false:Promise.reject(error));

// Compile the actual current server into an owned checkout. The launcher and
// profile code are copied verbatim; only npm's already-completed build commands
// are no-ops. No test installs dependencies into the shared working checkout.
async function checkout(directory){
 const root=join(directory,'checkout');await mkdir(join(root,'apps/server'),{recursive:true});await mkdir(join(root,'scripts'),{recursive:true});await mkdir(join(root,'packages'),{recursive:true});await mkdir(join(root,'node_modules'));
 for(const file of ['package.json','package-lock.json','apps/server/package.json'])await copyFile(join(repository,file),join(root,file));
 await symlink(join(repository,'packages/shared'),join(root,'packages/shared'),'dir');
 await symlink(join(repository,'apps/server/src'),join(root,'apps/server/src'),'dir');
 for(const name of await readdir(join(repository,'node_modules')))if(!name.startsWith('.'))await symlink(join(repository,'node_modules',name),join(root,'node_modules',name),'dir');
 for(const name of await readdir(join(repository,'scripts')))if(name.endsWith('.mjs')){
  if(['dev-server.mjs','profile-lib.mjs'].includes(name))await copyFile(join(repository,'scripts',name),join(root,'scripts',name));
  else await symlink(join(repository,'scripts',name),join(root,'scripts',name));
 }
 await exec(process.execPath,[join(repository,'node_modules/typescript/bin/tsc'),'-p',join(repository,'apps/server/tsconfig.json'),'--outDir',join(root,'apps/server/dist')],{cwd:repository,timeout:120000,maxBuffer:2*1024*1024});
 for(const name of await readdir(join(repository,'apps/server/src'),{recursive:true}))if(/\.(mjs|py)$/.test(name)){
  const target=join(root,'apps/server/dist',name);await mkdir(dirname(target),{recursive:true});await copyFile(join(repository,'apps/server/src',name),target);
 }
 const bin=join(root,'generated-bin');await mkdir(bin);
 await writeFile(join(bin,'npm.cjs'),`#!${process.execPath}\nconst fs=require('node:fs');fs.appendFileSync('generated-npm-calls.jsonl',JSON.stringify(process.argv.slice(2))+'\\n');if(fs.existsSync('generated-build-failure'))process.exit(23);if(process.argv[2]==='ci')fs.writeFileSync('node_modules/.package-lock.json','{}');\n`,{mode:0o700});
 await symlink('npm.cjs',join(bin,'npm'));
 assert.equal(await readFile(join(root,'scripts/dev-server.mjs'),'utf8'),await readFile(join(repository,'scripts/dev-server.mjs'),'utf8'));
 return {root,bin,runs:[]};
}
function launch(fixture,p){
 const child=spawn(process.execPath,[join(fixture.root,'scripts/dev-server.mjs'),'--home',p.home,...(p.profile?['--profile',p.profile]:[]),'--startup-timeout','15000'],{cwd:fixture.root,env:{...process.env,PATH:fixture.bin+':'+process.env.PATH},stdio:['ignore','pipe','pipe']});
 let output='';for(const stream of [child.stdout,child.stderr])stream.on('data',part=>{output+=part;});
 const done=new Promise((resolve,reject)=>{child.once('error',reject);child.once('close',(code,signal)=>resolve({code,signal,output}));});
 const run={child,done,output:()=>output};fixture.runs.push(run);return run;
}
async function ready(run){
 const deadline=Date.now()+30000;
 for(;;){if(run.output().includes(' ready at '))return;assert.equal(run.child.exitCode,null,run.output());assert.equal(run.child.signalCode,null,run.output());assert.ok(Date.now()<deadline,'generated dev launcher readiness timeout: '+run.output());await delay(25);}
}
async function stop(run){if(run.child.exitCode===null&&run.child.signalCode===null)run.child.kill('SIGTERM');const result=await run.done;assert.equal(result.code,0,result.output);}
function accounts(p){
 const db=new DatabaseSync(join(p.dataDir,'mote.sqlite'),{readOnly:true});
 try{return db.prepare('SELECT * FROM auth_accounts ORDER BY user_id').all();}finally{db.close();}
}
async function request(p,path,body,token){
 const response=await fetch(p.url+path,{method:body===undefined?'GET':'POST',headers:{...protocol,...(body===undefined?{}:{'content-type':'application/json'}),...(token?{authorization:'Bearer '+token}:{})},...(body===undefined?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(10000)});
 return {status:response.status,value:await response.json(),headers:response.headers};
}
async function isolatedProfile(home,name='dev'){
 const p=await developmentProfile({home,profile:name}),port=await freePort();
 await updateProfileConfiguration(p,document=>{document.server.port=port;document.media.workerToken='';});
 return loadProfile(profilePaths(name,home));
}

test('development launcher creates one fixed local admin on first start, preserves passwords and fails without stray processes',{timeout:180000,skip:process.platform==='win32'},async t=>{
 const directory=await mkdtemp(join(tmpdir(),'mote-dev-launcher-'));let active,fixture;
 t.after(async()=>{try{for(const run of fixture?.runs??[])if(run.child.exitCode===null&&run.child.signalCode===null)await stop(run);}finally{await rm(directory,{recursive:true,force:true});}});
 fixture=await checkout(directory);
 const home=join(directory,'profiles');
 await writeFile(join(fixture.root,'generated-build-failure'),'generated first build failure');
 const firstAttempt=await launch(fixture,{home}).done;assert.notEqual(firstAttempt.code,0);
 let p=await loadProfile(profilePaths('dev',home));assert.match(firstAttempt.output,/Created isolated native dev profile/);assert.equal(await exists(join(p.dataDir,'mote.sqlite')),false);
 await rm(join(fixture.root,'generated-build-failure'));
 const port=await freePort();await updateProfileConfiguration(p,document=>{document.server.port=port;document.media.workerToken='';});p=await loadProfile(profilePaths('dev',home));
 assert.equal(p.profile,'dev');assert.equal(p.meta.runtime,'native');assert.equal(p.env.MOTE_HOST,'127.0.0.1');assert.equal(await exists(join(p.dataDir,'mote.sqlite')),false,'creating a profile does not initialize an account database');
 active=launch(fixture,p);await ready(active);assert.match(active.output(),/Created local development account: admin \/ admin/);
 const initial=accounts(p);assert.equal(initial.length,1);assert.equal(initial[0].username,'admin');assert.equal(initial[0].administrator,1);assert.notEqual(initial[0].password_hash,'admin');
 const login=await request(p,'/api/auth/login',{username:'admin',password:'admin',mode:'client'});assert.equal(login.status,200);
 assert.equal((await request(p,'/api/admin/accounts',{username:'short-password-user',password:'admin'},login.value.token)).status,400,'ordinary HTTP creation keeps its strong-password rule');
 assert.equal((await request(p,'/api/auth/password',{currentPassword:'admin',password:'admin'},login.value.token)).status,400,'ordinary password changes keep their strong-password rule');
 assert.equal((await request(p,'/api/admin/accounts/'+login.value.userId+'/password',{password:'admin'},login.value.token)).status,400,'administrator password resets keep their strong-password rule');
 const web=await request(p,'/api/auth/login',{username:'admin',password:'admin',mode:'web'});assert.equal(web.status,200);assert.equal(web.value.token,undefined);
 const cookie=web.headers.get('set-cookie').split(';')[0],self=await fetch(p.url+'/api/auth/self',{headers:{...protocol,cookie}}),identity=await self.json();assert.equal(self.status,200);assert.equal(identity.username,'admin');assert.equal(identity.administrator,true);assert.equal(typeof identity.csrfToken,'string');
 const logout=await fetch(p.url+'/api/auth/logout',{method:'POST',headers:{...protocol,cookie,'x-mote-csrf':identity.csrfToken,'content-type':'application/json'},body:'{}'});assert.equal(logout.status,200);await logout.body?.cancel();
 const password='Generated-development-replacement-01';assert.equal((await request(p,'/api/auth/password',{currentPassword:'admin',password},login.value.token)).status,200);const changed=accounts(p);
 await stop(active);active=undefined;assert.equal(await exists(p.processFile),false);assert.equal(await exists(join(p.dataDir,'server.pid')),false);
 active=launch(fixture,p);await ready(active);assert.match(active.output(),/Existing accounts preserved/);assert.ok(!active.output().includes('admin / admin'));assert.deepEqual(accounts(p),changed,'restart must not reset the existing password or account identity');
 assert.equal((await request(p,'/api/auth/login',{username:'admin',password:'admin',mode:'client'})).status,401);assert.equal((await request(p,'/api/auth/login',{username:'admin',password,mode:'client'})).status,200);
 await stop(active);active=undefined;

 const occupied=createServer();await new Promise(resolve=>occupied.listen(p.port,'127.0.0.1',resolve));
 try{const rejected=await launch(fixture,p).done;assert.notEqual(rejected.code,0);assert.match(rejected.output,/unmanaged process/);assert.deepEqual(accounts(p),changed);assert.equal(await exists(p.processFile),false);}finally{await new Promise(resolve=>occupied.close(resolve));}
 await writeFile(join(fixture.root,'generated-build-failure'),'generated build failure');const failed=await launch(fixture,p).done;assert.notEqual(failed.code,0);assert.match(failed.output,/no server was started/);assert.deepEqual(accounts(p),changed);assert.equal(await exists(p.processFile),false);await rm(join(fixture.root,'generated-build-failure'));
 active=launch(fixture,p);await ready(active);assert.equal((await request(p,'/api/auth/login',{username:'admin',password,mode:'client'})).status,200);await stop(active);active=undefined;

 const existing=await isolatedProfile(home,'existing');
 const initialize=exec(process.execPath,[join(fixture.root,'apps/server/dist/scope/initialize-admin.js')],{env:{...process.env,MOTE_CONFIG_FILE:existing.configFile},timeout:15000});initialize.child.stdin.end(JSON.stringify({username:'generated-existing-admin',password}));await initialize;
 const saved=accounts(existing);active=launch(fixture,existing);await ready(active);assert.deepEqual(accounts(existing),saved);assert.equal((await request(existing,'/api/auth/login',{username:'generated-existing-admin',password,mode:'client'})).status,200);assert.equal((await request(existing,'/api/auth/login',{username:'admin',password:'admin',mode:'client'})).status,401);await stop(active);active=undefined;
 const deniedHome=join(directory,'denied');await assert.rejects(developmentProfile({home:deniedHome,profile:'prod'}),/not prod/);assert.equal(await exists(deniedHome),false);
 const remote=await isolatedProfile(home,'remote');await updateProfileConfiguration(remote,document=>{document.server.host='0.0.0.0';});const bytes=await readFile(remote.configFile);const rejected=await launch(fixture,remote).done;assert.notEqual(rejected.code,0);assert.match(rejected.output,/loopback/);assert.deepEqual(await readFile(remote.configFile),bytes);assert.equal(await exists(join(remote.dataDir,'mote.sqlite')),false);
 const held=await isolatedProfile(home,'held'),pidFile=join(held.dataDir,'server.pid');await writeFile(pidFile,String(process.pid));await assert.rejects(exec(process.execPath,[join(fixture.root,'apps/server/dist/scope/initialize-development.js')],{env:{...process.env,MOTE_CONFIG_FILE:held.configFile},timeout:15000}));assert.equal(await exists(join(held.dataDir,'mote.sqlite')),false);assert.equal(await readFile(pidFile,'utf8'),String(process.pid));await rm(pidFile);
 const unsupported=await isolatedProfile(home,'unsupported'),sentinel=join(unsupported.dataDir,'generated-old-archive');await writeFile(sentinel,'GENERATED_OLD_ARCHIVE');const refused=await launch(fixture,unsupported).done;assert.notEqual(refused.code,0);assert.match(refused.output,/initialization failed/);assert.equal(await readFile(sentinel,'utf8'),'GENERATED_OLD_ARCHIVE');assert.equal(await exists(join(unsupported.dataDir,'mote.sqlite')),false);assert.equal(await exists(unsupported.processFile),false);
 for(const [name,server]of [['prod',{profile:'prod'}],['unmanaged',{runtime:'unknown'}],['remote',{host:'0.0.0.0'}],['docker',{runtime:'docker'}],['production-port',{port:47832}]]){
  const config=join(directory,'guard-'+name+'.yaml'),dataDir=join(directory,'guard-'+name+'-vault'),document=structuredClone(p.savedDocument);document.server={...document.server,...server};document.storage.dataDir=dataDir;await writeFile(config,serializeConfigDocument(document));
  await assert.rejects(exec(process.execPath,[join(fixture.root,'apps/server/dist/scope/initialize-development.js')],{env:{...process.env,MOTE_CONFIG_FILE:config},timeout:15000}));assert.equal(await exists(dataDir),false,'refused bootstrap must not create a '+name+' vault');
 }
 t.diagnostic('Generated profiles and current compiled server; actual foreground launcher subprocesses stay hidden. No real dev data, model calls, media workers or shared dependency installation.');
});
