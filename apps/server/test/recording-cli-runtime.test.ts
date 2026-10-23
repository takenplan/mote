import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createLarkRunner} from '../src/connectors/lark-cli.js';
import {createFeishuRecordings} from '../src/connectors/lark-recordings.js';
import {createDwsRunner} from '../src/connectors/dingtalk-recordings.js';
import {authorizationOutput} from '../src/connectors/authorization-output.js';

for(const provider of ['lark','dingtalk'] as const)test(provider+' refuses missing/wrong managed executable and waits for killed authorization child',async t=>{
 const directory=await mkdtemp(join(tmpdir(),'mote-managed-cli-')),binary=join(directory,'vendor'),log=join(directory,'calls'),pidFile=join(directory,'pid');t.after(()=>rm(directory,{recursive:true,force:true}));
 const runner=(file:string)=>provider==='lark'?{status:()=>createLarkRunner(directory,{localProfile:true,binary:file})({kind:'status'}),login:(signal:AbortSignal,onOutput:(chunk:string)=>void)=>createLarkRunner(directory,{localProfile:true,binary:file})({kind:'complete',deviceCode:'GENERATED_DEVICE'},{signal,onOutput})}:{status:()=>createDwsRunner(directory,{binary:file})({kind:'status'},undefined),login:(signal:AbortSignal,onOutput:(chunk:string)=>void)=>createDwsRunner(directory,{binary:file})({kind:'login'},undefined,signal,onOutput)};
 const trap=join(directory,'fallback-used');for(const name of ['lark-cli','dws'])await writeFile(join(directory,name),'#!/bin/sh\necho unsafe > '+trap+'\n',{mode:0o700});const priorPath=process.env.PATH;process.env.PATH=directory+':'+priorPath;
 try{await assert.rejects(runner(join(directory,'missing')).status(),{code:provider==='lark'?'lark_cli_missing':'dingtalk_cli_missing'});}finally{process.env.PATH=priorPath;}await assert.rejects(readFile(trap),{code:'ENOENT'});
 await writeFile(binary,`#!/usr/bin/env node\nrequire('node:fs').appendFileSync(${JSON.stringify(log)},JSON.stringify(process.argv.slice(2))+'\\n');console.log(process.argv.includes('--version')?'lark-cli 0.0.1':JSON.stringify({version:'v0.0.1'}));`,{mode:0o700});await assert.rejects(runner(binary).status(),{code:provider==='lark'?'lark_cli_version_unsupported':'dingtalk_cli_version_unsupported'});assert.equal((await readFile(log,'utf8')).trim().split('\n').length,1,'wrong version never reaches account status');
 await writeFile(binary,`#!/usr/bin/env node\nconst fs=require('node:fs');if(process.argv.includes('--version'))console.log('lark-cli 1.0.98');else if(process.argv[2]==='version')console.log('{"version":"v1.0.64"}');else{fs.writeFileSync(${JSON.stringify(pidFile)},String(process.pid));console.log('https://login.dingtalk.com/generated');setInterval(()=>{},1000);}`,{mode:0o700});
 const controller=new AbortController();let enter!:()=>void;const entered=new Promise<void>(resolve=>enter=resolve),pending=runner(binary).login(controller.signal,chunk=>{if(chunk.includes('https://'))enter();});await entered;const pid=Number(await readFile(pidFile,'utf8'));controller.abort();await assert.rejects(pending,{code:provider==='lark'?'lark_operation_cancelled':'dingtalk_operation_cancelled'});assert.throws(()=>process.kill(pid,0),{code:'ESRCH'});
});

test('transcript acquisition bypasses the lossy batch wrapper and retains typed failures through the real CLI process',async t=>{
 const directory=await mkdtemp(join(tmpdir(),'mote-transcript-cli-')),binary=join(directory,'vendor'),response=join(directory,'response'),log=join(directory,'calls');t.after(()=>rm(directory,{recursive:true,force:true}));
 await writeFile(binary,`#!/usr/bin/env node
 const fs=require('node:fs'),args=process.argv.slice(2);
 if(args.includes('--version'))console.log('lark-cli 1.0.98');else{
 fs.appendFileSync(${JSON.stringify(log)},JSON.stringify(args)+'\\n');
 if(args[0]!=='api'){console.error('[minutes +detail] querying one generated minute');console.log(JSON.stringify({ok:false,data:{minutes:[{minute_token:'generated',error:'Generated provider prose without a typed cause'}]}}));}
 else console.error(fs.readFileSync(${JSON.stringify(response)},'utf8'));
 process.exitCode=1;}`,{mode:0o700});
 const provider=createFeishuRecordings(directory,createLarkRunner(directory,{localProfile:true,binary})),account={id:'generated-owner'},metadata={id:'generated',title:'Generated',durationMs:5000},signal=new AbortController().signal;
 for(const [error,code] of [
  [{type:'api',subtype:'rate_limit',code:99991400,retryable:true},'lark_rate_limited'],
  [{type:'authorization',subtype:'resource_permission',code:2091005},'lark_permission_required'],
  [{type:'api',code:2091003},'recording_transcript_not_ready'],
  [{type:'api',subtype:'unknown',retryable:true},'lark_command_failed'],
 ] as const){await writeFile(response,JSON.stringify({ok:false,error:{...error,message:'Generated private provider prose'}}));await assert.rejects(provider.transcript(account,metadata,signal),(failure:any)=>failure.code===code&&failure.message===code);}
 const calls=(await readFile(log,'utf8')).trim().split('\n').map(line=>JSON.parse(line));
 assert.equal(calls.length,4);for(const args of calls)assert.deepEqual(args,['api','GET','/open-apis/minutes/v1/minutes/generated/artifacts','--as','user','--format','json']);
});

test('native transcript JSON preserves large exports and UTF-8 byte bounds without raising other CLI caps',async t=>{
 const directory=await mkdtemp(join(tmpdir(),'mote-transcript-size-')),binary=join(directory,'vendor'),response=join(directory,'response');t.after(()=>rm(directory,{recursive:true,force:true}));
 await writeFile(binary,`#!/usr/bin/env node\nif(process.argv.includes('--version'))console.log('lark-cli 1.0.98');else process.stdout.write(require('node:fs').readFileSync(${JSON.stringify(response)}));`,{mode:0o700});
 const runner=createLarkRunner(directory,{localProfile:true,binary}),provider=createFeishuRecordings(directory,runner),account={id:'generated-owner'},metadata={id:'generated',title:'Generated',durationMs:5000},signal=new AbortController().signal;
 const raw='Owner 00:00:00.000\n'+'"'.repeat(8*1024*1024+1);await writeFile(response,JSON.stringify({ok:true,data:{transcript:raw}}));
 assert.ok((await readFile(response)).length>8*1024*1024);const exported=await provider.transcript(account,metadata,signal);assert.equal(exported.rawText,raw);assert.equal(exported.transcript!.segments.map(s=>s.text).join(''),raw.split('\n')[1]);
 await assert.rejects(runner({kind:'status'}),{code:'lark_output_too_large'});
 const limit=16*1024*1024,boundary='界'.repeat(Math.floor(limit/3))+'x'.repeat(limit%3);assert.equal(Buffer.byteLength(boundary),limit);
 await writeFile(response,JSON.stringify({ok:true,data:{transcript:boundary}}));const exact=await provider.transcript(account,metadata,signal);assert.equal(exact.rawText,boundary);assert.equal(exact.formatError,'recording_transcript_format_unsupported');
 await writeFile(response,JSON.stringify({ok:true,data:{transcript:boundary+'界'}}));await assert.rejects(provider.transcript(account,metadata,signal),(failure:any)=>failure.code==='recording_export_size_invalid'&&failure.category==='permanent');
 for(const data of [{},{transcript:null},{transcript:17},{transcript:{text:'Generated'}}]){await writeFile(response,JSON.stringify({ok:true,data}));await assert.rejects(provider.transcript(account,metadata,signal),(failure:any)=>failure.code==='recording_contract_invalid'&&failure.category==='permanent');}
});
test('authorization parser retains a complete opaque URL beyond old line bounds and never replaces it with a manual-code link',()=>{const url='https://login.dingtalk.com/device?opaque='+ 'generated%2B%2F%3D'.repeat(1200)+'&state=a+b/c==',values:string[]=[],publish=authorizationOutput('dingtalk',value=>values.push(value));publish('non-link output\n'+url.slice(0,17000));assert.equal(values.length,0);publish(url.slice(17000)+'\nhttps://login.dingtalk.com/manual\n');assert.deepEqual(values,[url]);});

test('Lark metadata rate limits retain a fixed retryable code without exposing provider prose',async t=>{
 const directory=await mkdtemp(join(tmpdir(),'mote-lark-rate-limit-')),binary=join(directory,'vendor'),response=join(directory,'response');t.after(()=>rm(directory,{recursive:true,force:true}));
 await writeFile(binary,`#!/usr/bin/env node\nif(process.argv.includes('--version'))console.log('lark-cli 1.0.98');else{console.error(require('node:fs').readFileSync(${JSON.stringify(response)},'utf8'));process.exitCode=1;}`,{mode:0o700});
 const runner=createLarkRunner(directory,{localProfile:true,binary});
 for(const [error,code] of [
  [{type:'api',subtype:'rate_limit',code:99991400,retryable:true},'lark_rate_limited'],
  [{type:'api',subtype:'rate_limit',retryable:true},'lark_rate_limited'],
  [{type:'api',code:99991400},'lark_rate_limited'],
  [{type:'authorization',subtype:'resource_permission',code:2091005},'lark_permission_required'],
  [{type:'api',subtype:'not_found',code:2091002},'lark_command_failed'],
  [{type:'api',subtype:'unknown',retryable:true},'lark_command_failed'],
 ] as const){
  await writeFile(response,JSON.stringify({ok:false,error:{...error,message:'Generated private provider prose',hint:'Generated private hint'}}));
  await assert.rejects(runner({kind:'minutes-metadata',id:'generated-minute'}),(failure:any)=>failure.code===code&&failure.message===code);
 }
 await writeFile(response,JSON.stringify({ok:false,error:{type:'api',code:2091003}}));
 await assert.rejects(runner({kind:'minutes-transcript',id:'generated-minute'}),{code:'recording_transcript_not_ready'});
 await assert.rejects(runner({kind:'minutes-metadata',id:'generated-minute'}),{code:'lark_command_failed'});
});
