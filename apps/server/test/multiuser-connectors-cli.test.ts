import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,chmodSync,rmSync,realpathSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createLarkRunner} from '../src/connectors/lark-cli.js';
import {createDwsRunner} from '../src/connectors/dingtalk-recordings.js';

test('actual CLI child processes receive isolated HOME, config, data, cache, temp and no inherited provider identity',async t=>{
 const root=mkdtempSync(join(tmpdir(),'mote-m10-cli-')),bin=join(root,'bin');mkdirSync(bin);t.after(()=>rmSync(root,{recursive:true,force:true}));
 const script=`#!${process.execPath}\nif(process.argv.includes('--version')){process.stdout.write('lark-cli 1.0.85');}else if(process.argv[2]==='version'){process.stdout.write(JSON.stringify({version:'1.0.62'}));}else process.stdout.write(JSON.stringify({argv:process.argv.slice(2),cwd:process.cwd(),env:process.env}));\n`;
 for(const name of ['lark-cli','dws']){const path=join(bin,name);writeFileSync(path,script);chmodSync(path,0o700);}
 const keys=['PATH','HOME','USERPROFILE','LARKSUITE_CLI_CONFIG_DIR','LARKSUITE_CLI_DATA_DIR','LARKSUITE_CLI_LOG_DIR','LARK_ACCESS_TOKEN','DWS_CONFIG_DIR','DWS_ACCESS_TOKEN','XDG_CONFIG_HOME','APPDATA'],before=Object.fromEntries(keys.map(key=>[key,process.env[key]]));
 t.after(()=>{for(const key of keys)if(before[key]===undefined)delete process.env[key];else process.env[key]=before[key];});
 process.env.PATH=bin+':'+process.env.PATH;for(const key of keys.filter(k=>k!=='PATH'))process.env[key]='HOST_SYNTHETIC_IDENTITY';
 const run=async(name:string)=>{const directory=join(root,name),dws=join(directory,'dws-runtime');mkdirSync(dws,{recursive:true});const lark=JSON.parse(await createLarkRunner(directory,{isolatedHome:true})({kind:'status'})),ding=await createDwsRunner(dws,{isolatedHome:true})({kind:'status'},'same-org:same-user') as any;return {lark,ding};};
 const a=await run('A'),b=await run('B');
 for(const platform of ['lark','ding'] as const){assert.notEqual(a[platform].env.HOME,b[platform].env.HOME);for(const result of [a[platform],b[platform]]){assert.equal(result.env.LARK_ACCESS_TOKEN,undefined);assert.equal(result.env.DWS_ACCESS_TOKEN,undefined);assert.equal(Object.values(result.env).includes('HOST_SYNTHETIC_IDENTITY'),false);for(const key of ['HOME','USERPROFILE','XDG_CONFIG_HOME','XDG_DATA_HOME','XDG_CACHE_HOME','APPDATA','LOCALAPPDATA','TMPDIR'])assert.ok(result.env[key].replace(root,realpathSync(root)).startsWith(result.cwd),key);}}
 assert.ok(a.lark.env.LARKSUITE_CLI_CONFIG_DIR.replace(root,realpathSync(root)).startsWith(a.lark.cwd));assert.ok(a.ding.env.DWS_CONFIG_DIR.replace(root,realpathSync(root)).startsWith(a.ding.cwd));assert.deepEqual(a.ding.argv.slice(0,2),['--profile','same-org:same-user']);
});
