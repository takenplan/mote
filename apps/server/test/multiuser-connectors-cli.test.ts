import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,chmodSync,rmSync,realpathSync,existsSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createLarkRunner} from '../src/connectors/lark-cli.js';
import {createDwsRunner} from '../src/connectors/dingtalk-recordings.js';

for(const kind of ['lark','dingtalk']as const)test('real '+kind+' runner rechecks current acquisition authority after asynchronous version/home preparation and before spawn',async t=>{
 const root=mkdtempSync(join(tmpdir(),'mote-recording-final-guard-')),log=join(root,'issued.jsonl'),binary=join(root,'generated-cli');t.after(()=>rmSync(root,{recursive:true,force:true}));
 writeFileSync(binary,`#!${process.execPath}\nconst fs=require('node:fs');fs.appendFileSync(${JSON.stringify(log)},JSON.stringify(process.argv.slice(2))+'\\n');process.stdout.write(process.argv.includes('--version')?'lark-cli 1.0.98':JSON.stringify(process.argv[2]==='version'?{version:'v1.0.64'}:{}));\n`);chmodSync(binary,0o700);
 const authorize=()=>{if(existsSync(log))throw Error('generated_revoked_after_version');};
 const result=kind==='lark'?createLarkRunner(root,{isolatedHome:true,binary})({kind:'status'},{assertCurrent:authorize}):createDwsRunner(root,{isolatedHome:true,binary})({kind:'status'},undefined,undefined,undefined,authorize);
 await assert.rejects(result,/generated_revoked_after_version/);const issued=readFileSync(log,'utf8').trim().split('\n').map(line=>JSON.parse(line));assert.equal(issued.length,1,'Only the version probe may have been physically issued');assert.equal(issued[0][0],kind==='lark'?'--version':'version');
});

test('actual CLI child processes receive isolated HOME, config, data, cache, temp and no inherited provider identity',async t=>{
 const root=mkdtempSync(join(tmpdir(),'mote-m10-cli-')),bin=join(root,'bin');mkdirSync(bin);t.after(()=>rmSync(root,{recursive:true,force:true}));
 const script=`#!${process.execPath}\nif(process.argv.includes('--version')){process.stdout.write('lark-cli 1.0.98');}else if(process.argv[2]==='version'){process.stdout.write(JSON.stringify({version:'v1.0.64'}));}else process.stdout.write(JSON.stringify({argv:process.argv.slice(2),cwd:process.cwd(),env:process.env}));\n`;
 for(const name of ['lark-cli','dws']){const path=join(bin,name);writeFileSync(path,script);chmodSync(path,0o700);}
 const keys=['PATH','HOME','USERPROFILE','LARKSUITE_CLI_CONFIG_DIR','LARKSUITE_CLI_DATA_DIR','LARKSUITE_CLI_LOG_DIR','LARK_ACCESS_TOKEN','DWS_CONFIG_DIR','DWS_ACCESS_TOKEN','XDG_CONFIG_HOME','APPDATA'],before=Object.fromEntries(keys.map(key=>[key,process.env[key]]));
 t.after(()=>{for(const key of keys)if(before[key]===undefined)delete process.env[key];else process.env[key]=before[key];});
 process.env.PATH=bin+':'+process.env.PATH;for(const key of keys.filter(k=>k!=='PATH'))process.env[key]='HOST_SYNTHETIC_IDENTITY';
 const run=async(name:string)=>{const directory=join(root,name),dws=join(directory,'dws-runtime');mkdirSync(dws,{recursive:true});const lark=JSON.parse(await createLarkRunner(directory,{isolatedHome:true,binary:join(bin,'lark-cli')})({kind:'status'})),ding=await createDwsRunner(dws,{isolatedHome:true,binary:join(bin,'dws')})({kind:'status'},'same-org:same-user') as any;return {lark,ding};};
 const a=await run('A'),b=await run('B');
 for(const platform of ['lark','ding'] as const){assert.notEqual(a[platform].env.HOME,b[platform].env.HOME);for(const result of [a[platform],b[platform]]){assert.equal(result.env.LARK_ACCESS_TOKEN,undefined);assert.equal(result.env.DWS_ACCESS_TOKEN,undefined);assert.equal(Object.values(result.env).includes('HOST_SYNTHETIC_IDENTITY'),false);for(const key of ['HOME','USERPROFILE','XDG_CONFIG_HOME','XDG_DATA_HOME','XDG_CACHE_HOME','APPDATA','LOCALAPPDATA','TMPDIR'])assert.ok(result.env[key].replace(root,realpathSync(root)).startsWith(result.cwd),key);}}
 assert.ok(a.lark.env.LARKSUITE_CLI_CONFIG_DIR.replace(root,realpathSync(root)).startsWith(a.lark.cwd));assert.ok(a.ding.env.DWS_CONFIG_DIR.replace(root,realpathSync(root)).startsWith(a.ding.cwd));assert.deepEqual(a.ding.argv.slice(0,2),['--profile','same-org:same-user']);
});

for(const kind of ['lark','dingtalk'] as const)test('real '+kind+' runner joins physical child exit after cancellation and contains output-callback revocation',async t=>{
 const root=mkdtempSync(join(tmpdir(),'mote-m10-cli-stop-')),bin=join(root,'bin');mkdirSync(bin);const previous=process.env.PATH;process.env.PATH=bin+':'+previous;t.after(()=>{process.env.PATH=previous;rmSync(root,{recursive:true,force:true});});
 const script=`#!${process.execPath}\nif(process.argv.includes('--version'))process.stdout.write('lark-cli 1.0.98');else if(process.argv[2]==='version')process.stdout.write(JSON.stringify({version:'v1.0.64'}));else {process.stdout.write('PID:'+process.pid+'\\n');setInterval(()=>process.stdout.write('generated heartbeat\\n'),10);}\n`;
 for(const name of ['lark-cli','dws']){writeFileSync(join(bin,name),script);chmodSync(join(bin,name),0o700);}
 for(const revoke of ['abort','callback'] as const){
  const directory=join(root,revoke);mkdirSync(directory);let resolve!:()=>void,pid=0;const entered=new Promise<void>(done=>resolve=done),controller=new AbortController(),onOutput=(value:string)=>{const match=value.match(/PID:(\d+)/);if(match){pid=Number(match[1]);resolve();if(revoke==='callback')throw Error('synthetic revoked callback');}};
  const promise=(kind==='lark'?createLarkRunner(directory,{isolatedHome:true,binary:join(bin,'lark-cli')})({kind:'status'},{signal:controller.signal,onOutput}):createDwsRunner(directory,{isolatedHome:true,binary:join(bin,'dws')})({kind:'login'},undefined,controller.signal,onOutput)).then(()=>undefined,error=>error);
  await entered;if(revoke==='abort')controller.abort();const error=await promise;assert.equal(error.code,kind==='lark'?'lark_operation_cancelled':'dingtalk_operation_cancelled');assert.throws(()=>process.kill(pid,0),{code:'ESRCH'});
 }
});
