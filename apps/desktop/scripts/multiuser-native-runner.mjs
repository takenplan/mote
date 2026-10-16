import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {spawn} from 'node:child_process';
import {createRequire} from 'node:module';
import {setTimeout as delay} from 'node:timers/promises';
import {buildApp} from '../../server/src/app.ts';
const require=createRequire(import.meta.url),electron=require('electron'),directory=await mkdtemp(join(tmpdir(),'mote-m14-native-')),profile=join(directory,'profile'),password='Generated-native-Desktop-01';
let child,node;const protocol={'x-mote-protocol-version':'2','x-mote-ingress-version':'3'};
try{
 node=await buildApp({dataDir:join(directory,'central')});await node.accounts.initialize('generated-admin',password);
 const request=(token,url,method='GET',payload)=>node.app.inject({url,method,headers:{...protocol,...(token?{authorization:'Bearer '+token}:{})},...(payload===undefined?{}:{payload})});
 const login=async(username)=>{const r=await request(undefined,'/api/auth/login','POST',{username,password,mode:'client'});assert.equal(r.statusCode,200,r.body);return r.json();};
 const admin=await login('generated-admin');for(const username of ['generated-a','generated-b'])assert.equal((await request(admin.token,'/api/admin/accounts','POST',{username,password})).statusCode,200);
 const users={a:await login('generated-a'),b:await login('generated-b')};
 async function launch(){
  child=spawn(electron,[resolve('apps/desktop/scripts/multiuser-native.cjs'),profile],{cwd:process.cwd(),env:{...process.env,MOTE_PROFILE:'default'},stdio:['ignore','pipe','pipe','ipc']});
  const running=child,pending=new Map();let next=0,error='',loaded=0,exited=false;
  running.stderr.on('data',chunk=>{error+=chunk.toString();});running.stdout.on('data',chunk=>process.stdout.write(chunk));running.on('exit',()=>{exited=true;});
  running.on('message',async message=>{if(message.type==='loaded')loaded++;if(message.type==='result'){const task=pending.get(message.id);pending.delete(message.id);if(message.error)task?.reject(Error(message.error));else task?.resolve(message.value);}if(message.type==='fetch')try{const url=new URL(message.url),r=await node.app.inject({url:url.pathname+url.search,method:message.method,headers:message.headers,...(message.body?{payload:Buffer.from(message.body,'base64')}:{})});if(!exited)running.send({type:'fetch-response',id:message.id,status:r.statusCode,headers:r.headers,body:r.rawPayload.toString('base64')});}catch(cause){if(!exited)running.send({type:'fetch-response',id:message.id,error:String(cause)});}});
  const js=code=>new Promise((resolve,reject)=>{if(exited)return reject(Error('Desktop exited: '+error));const id=++next;pending.set(id,{resolve,reject});running.send({type:'execute',id,code});});
  const until=async(read,accept,label)=>{const deadline=Date.now()+20000;let last;for(;;){if(exited)throw Error('Desktop exited '+label+': '+error);try{last=await read();if(accept(last))return last;}catch(cause){last=String(cause);}assert(Date.now()<deadline,label+': '+JSON.stringify(last)+' '+error);await delay(20);}};
  await until(()=>Promise.resolve(loaded),value=>value>0,'initial document load');await until(()=>js('Boolean(window.mote&&document.querySelector("#ask-login"))'),Boolean,'real preload and renderer');
  return {running,js,until,status:()=>js('window.mote.status()'),async login(label){await js(`(()=>{document.querySelector('#ask-username').value='generated-${label}';document.querySelector('#ask-password').value=${JSON.stringify(password)};document.querySelector('#ask-login').click();return true;})()`);return until(()=>js('window.mote.status()'),value=>value.config.account?.userId===users[label].userId,'login '+label);},async kill(){running.kill('SIGKILL');await new Promise(resolve=>running.once('exit',resolve));}};
 }
 let desktop=await launch();await desktop.js('(async()=>{const s=await window.mote.status();await window.mote.configure({...s.config,syncMode:"manual",metadataEnabled:false,defaultCollection:"activity"});})()').catch(()=>{});await desktop.login('a');await desktop.js('(async()=>{const s=await window.mote.status();await window.mote.configure({...s.config,syncMode:"manual",metadataEnabled:false});})()');
 const aNote=await desktop.js('(async()=>{const d=await window.mote.noteDraft();await window.mote.saveNote({...d,text:"Generated A native queued note",revision:1});return d.id;})()');
 await desktop.js('(async()=>{const d=await window.mote.noteDraft();return window.mote.updateNoteDraft({...d,text:"Generated A native editable draft",revision:1});})()');assert.equal((await desktop.status()).queueDepth,1);
 await desktop.login('b');let status=await desktop.status();assert.equal(status.queueDepth,0);assert.equal(status.running,false);assert.equal((await desktop.js('window.mote.noteDraft()')).text,'');
 await desktop.js('(async()=>{const s=await window.mote.status();await window.mote.configure({...s.config,syncMode:"manual",metadataEnabled:false});})()');
 const bNote=await desktop.js('(async()=>{const d=await window.mote.noteDraft();await window.mote.saveNote({...d,text:"Generated B native queued note",revision:1});return d.id;})()');assert.equal((await desktop.status()).queueDepth,1);await desktop.kill();
 desktop=await launch();status=await desktop.status();assert.equal(status.config.account.userId,users.b.userId);assert.equal(status.queueDepth,1);assert.equal(status.running,false);await desktop.js('window.mote.retry()');assert.equal((await desktop.status()).queueDepth,0);
 await desktop.login('a');assert.equal((await desktop.status()).queueDepth,1);assert.equal((await desktop.js('window.mote.noteDraft()')).text,'Generated A native editable draft');await desktop.js('window.mote.retry()');assert.equal((await desktop.status()).queueDepth,0);
 await desktop.until(()=>desktop.js('document.querySelector("#settings-connection-summary").textContent'),value=>value.includes('generated-a'),'actual account label');
 const a=await login('generated-a'),b=await login('generated-b');assert.equal((await request(a.token,'/api/captures/'+aNote)).statusCode,200);assert.equal((await request(b.token,'/api/captures/'+aNote)).statusCode,404);assert.equal((await request(b.token,'/api/captures/'+bNote)).statusCode,200);assert.equal((await request(a.token,'/api/captures/'+bNote)).statusCode,404);
 console.log(JSON.stringify({ok:true,actualElectronMainPreloadRenderer:true,generatedExternalIOOnly:true,offlineA:true,bStartsStopped:true,sigkillRestartB:true,aDraftAndQueueResume:true,backendAccountIsolation:true}));
 desktop.running.send({type:'quit'});await new Promise(resolve=>desktop.running.once('exit',resolve));
}finally{if(child&&child.exitCode===null&&child.signalCode===null){child.kill('SIGKILL');await new Promise(resolve=>child.once('exit',resolve));}await node?.app.close();await rm(directory,{recursive:true,force:true});}
