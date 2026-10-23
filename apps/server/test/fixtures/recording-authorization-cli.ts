import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {createLarkRunner} from '../../src/connectors/lark-cli.js';
import {createDwsRunner} from '../../src/connectors/dingtalk-recordings.js';
import {createFeishuRecordings} from '../../src/connectors/lark-recordings.js';
import {createDingtalkRecordings} from '../../src/connectors/dingtalk-recordings.js';
export const generatedAuthorizationUrl='https://accounts.feishu.cn/device?opaque='+ 'generated%2B%2F%3D%26%3F'.repeat(150)+'&state=exact+a/b==&encoded=%252F';
export async function generatedRecordingCli(directory:string,provider:'feishu'|'dingtalk'){
 const root=join(directory,'generated-cli-'+provider),binary=join(root,'vendor-cli'),control=join(root,'complete'),log=join(root,'commands.jsonl');await mkdir(root,{recursive:true});
 const url=generatedAuthorizationUrl.replace('accounts.feishu.cn',provider==='feishu'?'accounts.feishu.cn':'login.dingtalk.com');
 const script=`#!/usr/bin/env node
 const fs=require('node:fs'),path=require('node:path'),args=process.argv.slice(2),root=${JSON.stringify(root)},provider=${JSON.stringify(provider)},control=${JSON.stringify(control)},log=${JSON.stringify(log)},url=${JSON.stringify(url)};
 fs.appendFileSync(log,JSON.stringify(args)+'\\n');
 const arg=name=>args[args.indexOf(name)+1],json=value=>console.log(JSON.stringify(value));
 const done=()=>fs.existsSync(control),wait=()=>new Promise(resolve=>{const timer=setInterval(()=>{if(done()){clearInterval(timer);resolve();}},5);});
 (async()=>{
 if(args.includes('--version'))return console.log('lark-cli 1.0.98');if(args[0]==='version')return json({version:'v1.0.64'});
 if(args.includes('config')){if(args.includes('--app-secret-stdin')){let input='';for await(const chunk of process.stdin)input+=chunk;if(input!=='GENERATED_APP_SECRET')process.exit(9);}fs.writeFileSync(path.join(root,'configured'),'yes');return json({ok:true});}
 if(args.includes('login')){if(provider==='feishu'&&args.includes('--no-wait'))return json({verification_url:url,device_code:'GENERATED_DEVICE_CODE',expires_in:600});if(provider==='dingtalk'){process.stdout.write(url.slice(0,300));process.stdout.write(url.slice(300)+'\\nhttps://login.dingtalk.com/manual-code\\n');}await wait();return json({ok:true});}
 if(args.includes('status'))return provider==='feishu'?json({appId:'cli_generated',identities:{user:{available:done(),openId:'generated-owner',userName:'Generated owner'}}}):json({data:{authenticated:done(),corp_id:'generated-org',user_id:'generated-owner'}});
 if(args.includes('+search'))return provider==='feishu'?json({data:{items:[{token:'generated-recording'}],has_more:false}}):json({data:{minutes:[{taskUuid:'generated-recording'}],complete:true}});
 if(args.includes('get'))return json({data:{minute:{token:'generated-recording',title:'Generated recording',create_time:'1789905600000',duration:'5000'}}});
 if(args.includes('+detail')&&provider==='dingtalk')return json({data:{'generated-recording':{basic:{result:{taskUuid:'generated-recording',title:'Generated recording',startTime:1789905600000,duration:5000}}}}});
 if(args.includes('+transcript'))return json({data:{taskUuid:'generated-recording',complete:true,paragraphList:[{paragraph:'Generated complete recording transcript.'}]}});
 if(args.includes('+detail')){const file=path.join(arg('--output-dir'),'transcript.txt');fs.writeFileSync(file,'Generated diary export\\n\\nOwner 00:00:00.000\\nGenerated complete recording transcript.\\n');return json({data:{minutes:[{minute_token:'generated-recording',artifacts:{transcript_file:file}}]}});}
 if(args.includes('+download')){const file=arg('--output');fs.writeFileSync(file,Buffer.concat([Buffer.from('RIFF0000WAVE'),Buffer.alloc(200)]));return provider==='feishu'?json({data:{}}):json({data:{ok:true,succeeded:1,results:[{taskUuid:'generated-recording'}]}});}
 process.exit(8);
 })().catch(()=>process.exit(7));`;
 await writeFile(binary,script,{mode:0o700});
 return {provider:provider==='feishu'?createFeishuRecordings(directory,createLarkRunner(directory,{localProfile:true,binary})):createDingtalkRecordings(directory,createDwsRunner(join(directory,'dws-runtime'),{binary})),url,binary,root,complete:()=>writeFile(control,'complete'),commands:async()=>{try{return (await readFile(log,'utf8')).trim().split('\n').map(line=>JSON.parse(line) as string[]);}catch{return [] as string[][];}}};
}
