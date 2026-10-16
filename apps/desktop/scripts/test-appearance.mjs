import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {spawn} from 'node:child_process';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url),electron=require('electron'),directory=dirname(fileURLToPath(import.meta.url));
for(const preference of ['light','dark','auto'])for(const os of ['light','dark']){
 const root=await mkdtemp(join(tmpdir(),'mote-theme-process-'));await writeFile(join(root,'fixture-marker'),'synthetic-only',{mode:0o600});
 try{
  for(const restart of [false,true]){
   const child=spawn(electron,[join(directory,'appearance-smoke.cjs')],{env:{...process.env,MOTE_THEME_FIXTURE_ROOT:root,MOTE_THEME_FIXTURE_PREFERENCE:preference,MOTE_THEME_FIXTURE_OS:os,...(restart?{MOTE_THEME_FIXTURE_RESTART:'1'}:{})},stdio:['ignore','pipe','pipe']});
   let stdout='',stderr='';child.stdout.on('data',chunk=>stdout+=chunk);child.stderr.on('data',chunk=>stderr+=chunk);
   const code=await new Promise((resolve,reject)=>{child.on('exit',resolve);child.on('error',reject);});
   assert.equal(code,0,`${preference}/${os}/${restart?'restart':'cold'}: ${stderr.slice(-4000)}`);
   const result=stdout.split('\n').map(line=>{try{return JSON.parse(line);}catch{return null;}}).find(value=>value?.ok);assert.ok(result);console.log(JSON.stringify(result));
  }
 }finally{await rm(root,{recursive:true,force:true});}
}
