import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtemp,readFile,rm,mkdir,writeFile,readdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';
import {mediaInstallerEnvironment,downloadMediaBootstrap,runMediaCommand,prepareNativeMediaRuntime,nativeMediaPlatform,MEDIA_UV_VERSION} from '../src/media-native-runtime.mjs';

test('installer environment isolates profile cache and never forwards credentials or package injection',()=>{
 const env=mediaInstallerEnvironment('/generated/profile',{PATH:'/usr/bin',HTTPS_PROXY:'http://127.0.0.1:9999',HOME:'/private/user',OPENAI_API_KEY:'secret',MOTE_TOKEN:'secret',PIP_EXTRA_INDEX_URL:'https://untrusted.invalid',PYTHONPATH:'/injected',UV_EXTRA_INDEX_URL:'https://untrusted.invalid'});
 assert.equal(env.PATH,'/usr/bin');assert.equal(env.HTTPS_PROXY,'http://127.0.0.1:9999');assert.equal(env.UV_CACHE_DIR,'/generated/profile/cache');assert.equal(env.UV_INDEX_URL,'https://pypi.org/simple');
 for(const name of ['HOME','OPENAI_API_KEY','MOTE_TOKEN','PIP_EXTRA_INDEX_URL','PYTHONPATH','UV_EXTRA_INDEX_URL'])assert.equal(env[name],undefined);
});
test('bootstrap validates digest and bytes before executable extraction and rejects non-upstream redirects',async()=>{
 const data=Buffer.from('generated archive'),spec={target:'generated',bytes:data.length,sha256:createHash('sha256').update(data).digest('hex')};
 assert.deepEqual(await downloadMediaBootstrap(spec,{fetchImpl:async()=>new Response(data)}),data);
 await assert.rejects(downloadMediaBootstrap({...spec,sha256:'0'.repeat(64)},{fetchImpl:async()=>new Response(data)}),/download_checksum/);
 await assert.rejects(downloadMediaBootstrap(spec,{fetchImpl:async()=>new Response(Buffer.concat([data,Buffer.from('x')]))}),/download_size/);
 await assert.rejects(downloadMediaBootstrap(spec,{fetchImpl:async()=>new Response(null,{status:302,headers:{location:'https://untrusted.invalid/uv'}})}),/download_source/);
});
test('cancelled dependency subprocess exits before caller is released, without publishing a late receipt',async t=>{
 const folder=await mkdtemp(join(tmpdir(),'mote-dependency-cancel-'));t.after(()=>rm(folder,{recursive:true,force:true}));
 const marker=join(folder,'late'),controller=new AbortController();
 const running=runMediaCommand(process.execPath,['-e',"setTimeout(()=>require('node:fs').writeFileSync(process.argv[1],'late'),4000)",marker],{signal:controller.signal});
 controller.abort();await assert.rejects(running);await assert.rejects(readFile(marker));
});
test('restart probes never bootstrap or download missing dependencies without an explicit prepare action',async t=>{
 const folder=await mkdtemp(join(tmpdir(),'mote-dependency-restart-'));t.after(()=>rm(folder,{recursive:true,force:true}));let commands=0,requests=0;
 await assert.rejects(prepareNativeMediaRuntime({repository:new URL('../../../',import.meta.url).pathname,directory:folder,allowInstall:false,run:async()=>{commands++;},fetchImpl:async()=>{requests++;}}),/not_prepared/);
 assert.equal(commands,0);assert.equal(requests,0);await assert.rejects(readFile(join(folder,'current.json')));
});
test('an explicit base Python publishes the same runtime receipt used by Central and failed replacement preserves it',async t=>{
 const directory=await mkdtemp(join(tmpdir(),'mote-explicit-python-'));t.after(()=>rm(directory,{recursive:true,force:true}));
 const repository=new URL('../../../',import.meta.url).pathname,platform=nativeMediaPlatform(),bootstrap=join(directory,'bootstrap',MEDIA_UV_VERSION,platform.target),binary=Buffer.from('generated bootstrap');
 await mkdir(bootstrap,{recursive:true});await writeFile(join(bootstrap,'uv'),binary);await writeFile(join(bootstrap,'receipt.json'),JSON.stringify({archiveSha256:platform.sha256,binarySha256:createHash('sha256').update(binary).digest('hex')}));
 const calls:{command:string;args:string[]}[]=[],sourcePython='/generated Python/bin/python';let target='',failInstall=false;
 const run=async(command:string,args:string[])=>{
  calls.push({command,args});
  if(args[0]==='venv'){target=args.at(-1)!;await mkdir(join(target,'bin'),{recursive:true});await mkdir(join(target,'lib'));await writeFile(join(target,'lib','ffmpeg'),'generated');}
  if(args[0]==='pip'&&failInstall)throw Error('generated package failure');
  if(args[0]==='-c')return Buffer.from(JSON.stringify({python:'3.11.17',ffmpeg:join(target,'lib','ffmpeg')}));
  return Buffer.alloc(0);
 };
 const fetchImpl=async()=>{throw Error('unexpected network');};
 const first=await prepareNativeMediaRuntime({repository,directory,sourcePython,run,fetchImpl});assert.equal(first.created,true);
 assert.deepEqual(calls.find(call=>call.args[0]==='venv')?.args,['venv','--no-python-downloads','--python',sourcePython,'--seed',join(directory,first.generation)]);
 assert.equal(calls.some(call=>call.args[0]==='python'),false,'explicit Python must never trigger a managed Python download');
 const marker=await readFile(join(directory,'current.json'),'utf8');assert.equal(JSON.parse(marker).sourcePython,sourcePython);
 calls.length=0;const central=await prepareNativeMediaRuntime({repository,directory,allowInstall:false,run,fetchImpl});assert.equal(central.python,first.python);assert.equal(central.created,false);assert.equal(calls.length,2,'Central only probes the CLI-prepared environment');
 failInstall=true;await assert.rejects(prepareNativeMediaRuntime({repository,directory,sourcePython:'/generated other/python',run,fetchImpl}),/generated package failure/);
 assert.equal(await readFile(join(directory,'current.json'),'utf8'),marker);assert.deepEqual((await readdir(directory)).filter(name=>name.startsWith('environment-')),[first.generation]);
});
test('cancellation also reaps a detached-output descendant that ignores TERM after its parent exits',async t=>{
 if(process.platform==='win32'){t.skip('POSIX process groups');return;}
 const folder=await mkdtemp(join(tmpdir(),'mote-dependency-descendant-'));t.after(()=>rm(folder,{recursive:true,force:true}));
 const ready=join(folder,'ready'),late=join(folder,'late'),controller=new AbortController();
 const descendant="const fs=require('node:fs');process.on('SIGTERM',()=>{});fs.writeFileSync(process.argv[1],String(process.pid));setTimeout(()=>fs.writeFileSync(process.argv[2],'late'),700);setInterval(()=>{},1000)";
 const parent="require('node:child_process').spawn(process.execPath,['-e',process.argv[1],process.argv[2],process.argv[3]],{stdio:'ignore'});setInterval(()=>{},1000)";
 const running=runMediaCommand(process.execPath,['-e',parent,descendant,ready,late],{signal:controller.signal});
 let pid;try{
  for(let i=0;i<200;i++){try{pid=Number(await readFile(ready,'utf8'));break;}catch{await delay(10);}}
  assert.ok(pid,'generated child became ready');controller.abort();await assert.rejects(running);await delay(800);await assert.rejects(readFile(late));
 }finally{controller.abort();await running.catch(()=>{});if(pid)try{process.kill(pid,'SIGKILL');}catch(error){if(error.code!=='ESRCH')throw error;}}
});
