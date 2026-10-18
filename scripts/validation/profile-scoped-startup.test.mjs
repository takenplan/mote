// Run after build:central. This exercises the real CLI and compiled scoped host.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {spawn,spawnSync} from 'node:child_process';
import {once} from 'node:events';
import {mkdtemp,readFile,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {cli,initializeFixture} from '../profile-fixtures.mjs';
import {atomicJson,loadProfile,nativeIdentity,profilePaths,updateProfileConfiguration} from '../profile-lib.mjs';

const safeHealth={ok:true,mode:'multiuser-auth',authentication:'username-password',storageEpoch:5,protocol:{min:2,max:2}};
function managedAlive(pid,marker){
 try{process.kill(pid,0);}catch(error){if(error.code==='ESRCH')return false;throw error;}
 const result=spawnSync('ps',['-p',String(pid),'-o','args='],{encoding:'utf8'});
 return result.status===0&&result.stdout.includes('--mote-instance='+marker);
}

test('real native dev/test CLI starts before account initialization, restarts safely and refuses foreign ports and PIDs',async t=>{
 const directory=await mkdtemp(join(tmpdir(),'mote-scoped-profile-startup-')),home=join(directory,'profiles'),profiles=[],owned=[];
 let occupied,foreign;
 t.after(async()=>{
  try{
   for(const p of [...profiles].reverse())await cli(home,p.profile,'stop');
   for(const record of owned)assert.equal(managedAlive(record.pid,record.marker),false,'owned profile process must stop naturally');
  }finally{
   if(occupied?.listening)await new Promise(resolve=>occupied.close(resolve));
   if(foreign?.exitCode===null&&foreign.signalCode===null){const exited=once(foreign,'exit');foreign.kill('SIGTERM');await exited;}
   if(owned.every(record=>!managedAlive(record.pid,record.marker)))await rm(directory,{recursive:true,force:true});
  }
 });
 for(const name of ['dev','test'])profiles.push(await initializeFixture(home,name));
 for(const p of profiles){assert.equal(p.document.diagnostics.debug,p.profile==='dev');assert.equal(p.document.diagnostics.traceEnabled,false);}
 assert.notEqual(profiles[0].dataDir,profiles[1].dataDir);
 assert.notEqual(profiles[0].port,profiles[1].port);
 assert.notEqual(profiles[0].project,profiles[1].project);
 const check=async p=>{
  const state=JSON.parse((await cli(home,p.profile,'status')).stdout);
  assert.equal(state.healthy,true);
  assert.equal(state.running,true);
  assert.equal(state.managed,true);
  const response=await fetch(p.url+'/api/health',{redirect:'error',signal:AbortSignal.timeout(5000)});
  assert.equal(response.status,200);
  const body=await response.json();
  for(const [key,value]of Object.entries(safeHealth))assert.deepEqual(body[key],value);
  assert.deepEqual(Object.keys(body).sort(),[...Object.keys(safeHealth),'privateCapabilities'].sort());
  assert.ok(Array.isArray(body.privateCapabilities));
  assert.ok(!JSON.stringify(body).includes(p.env.MOTE_TOKEN));
  const unauthorized=await fetch(p.url+'/api/auth/self',{headers:{'x-mote-protocol-version':'2',authorization:'Bearer '+p.env.MOTE_TOKEN},signal:AbortSignal.timeout(5000)});
  assert.equal(unauthorized.status,401,'profile readiness cannot turn a legacy deployment token into account authority');
  const db=new DatabaseSync(join(p.dataDir,'mote.sqlite'),{readOnly:true});
  try{assert.equal(db.prepare('SELECT count(*) n FROM auth_accounts').get().n,0);}finally{db.close();}
  owned.push(state.record);
  try{const pid=Number((await readFile(join(p.dataDir,'server.pid'),'utf8')).trim());if(Number.isSafeInteger(pid))owned.push({...state.record,pid});}catch(error){if(error.code!=='ENOENT')throw error;}
  return state.record;
 };
 for(const p of profiles){await cli(home,p.profile,'start');await check(p);}
 const [dev,other]=profiles,first=await nativeIdentity(dev);
 await cli(home,'dev','stop');
 assert.equal((await nativeIdentity(dev)).running,false);
 await check(other);
 await cli(home,'dev','start');
 const restarted=await check(dev);
 assert.notEqual(restarted.marker,first.record.marker);
 for(const p of profiles){await cli(home,p.profile,'stop');assert.equal(JSON.parse((await cli(home,p.profile,'status')).stdout).healthy,false);}

 occupied=createServer((_request,response)=>response.end('GENERATED_FOREIGN_LISTENER'));
 await new Promise(resolve=>occupied.listen(0,'127.0.0.1',resolve));
 const savedProcess=await readFile(dev.processFile),port=occupied.address().port;
 await updateProfileConfiguration(dev,document=>{document.server.port=port;});
 try{
  const failed=await cli(home,'dev','start',[],{fail:true});
  assert.match(failed.stderr,/already in use/);
  assert.deepEqual(await readFile(dev.processFile),savedProcess);
  assert.equal(await(await fetch('http://127.0.0.1:'+port)).text(),'GENERATED_FOREIGN_LISTENER');
 }finally{await updateProfileConfiguration(await loadProfile(profilePaths('dev',home)),document=>{document.server.port=dev.port;});}
 await new Promise(resolve=>occupied.close(resolve));

 foreign=spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{stdio:'ignore'});
 await once(foreign,'spawn');
 await atomicJson(dev.processFile,{pid:foreign.pid,marker:randomUUID(),dataDir:dev.dataDir});
 try{
  for(const action of ['start','stop']){const failed=await cli(home,'dev',action,[],{fail:true});assert.match(failed.stderr,/another process/);process.kill(foreign.pid,0);assert.equal(foreign.exitCode,null);assert.equal(foreign.signalCode,null);}
 }finally{await writeFile(dev.processFile,savedProcess,{mode:0o600});}
 const exited=once(foreign,'exit');foreign.kill('SIGTERM');await exited;
 await cli(home,'dev','start');
 await check(await loadProfile(profilePaths('dev',home)));
 await cli(home,'dev','stop');
 t.diagnostic('Generated native dev/test profiles; four real cold starts; public Wire2/epoch5 readiness; zero accounts, models, collectors or foreground UI.');
});
