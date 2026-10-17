import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {spawn,execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {serializeConfigDocument} from '@mote/shared/config-file';

// Always exercise the production process. A separate smoke invocation supplies
// the freshly built entry to prove the emitted JS path as well as TypeScript.
const entry=process.env.MOTE_AUTH_PROCESS_ENTRY??fileURLToPath(new URL('../src/index.ts',import.meta.url));
const password='Generated-process-only-secret-01';
test('production process bootstraps, authenticates, persists sessions over restart, manages accounts and revokes access',async t=>{
 const root=mkdtempSync(join(tmpdir(),'mote-auth-process-')),directory=join(root,'vault'),file=join(root,'config.yaml');
 writeFileSync(file,serializeConfigDocument({version:1,revision:0,storage:{dataDir:directory},server:{host:'127.0.0.1',port:0}}));
 const env={...process.env,MOTE_CONFIG_FILE:file,MOTE_TOKEN:'synthetic-retired-instance-token-12345'};
 const bootstrap=fileURLToPath(new URL('../src/scope/initialize-admin.ts',import.meta.url));
 execFileSync(process.execPath,['--import','tsx',bootstrap],{env,input:JSON.stringify({username:'process-admin',password}),stdio:['pipe','pipe','pipe'],timeout:15000});
 let active:Awaited<ReturnType<typeof start>>|undefined;
 async function start(){
  const child=spawn(process.execPath,entry.endsWith('.ts')?['--import','tsx',entry]:[entry],{env,stdio:['ignore','pipe','pipe']});
  const closed=new Promise<void>(resolve=>child.once('close',()=>resolve()));
  const url=await new Promise<string>((resolve,reject)=>{
   const timer=setTimeout(()=>{child.kill('SIGTERM');reject(Error('Synthetic authentication startup timed out'));},15000);let output='';
   child.once('exit',code=>{clearTimeout(timer);reject(Error('Synthetic authentication startup exited '+code));});
   child.stdout.on('data',part=>{output+=part;for(const line of output.split('\n')){try{const event=JSON.parse(line);if(event.event==='server.listening'){clearTimeout(timer);resolve('http://127.0.0.1:'+event.port);}}catch{}}});
  });return {child,closed,url};
 }
 t.after(async()=>{if(active){active.child.kill('SIGTERM');await active.closed;}rmSync(root,{recursive:true,force:true});});
 active=await start();
 const request=async(method:string,path:string,body?:unknown,token?:string)=>{const r=await fetch(active!.url+path,{method,headers:{'x-mote-protocol-version':'2',...(body===undefined?{}:{'content-type':'application/json'}),...(token?{authorization:'Bearer '+token}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});return {status:r.status,body:await r.json() as any};};
 assert.equal((await request('GET','/api/health')).body.mode,'multiuser-auth');
 assert.equal((await request('GET','/api/auth/self',undefined,env.MOTE_TOKEN)).status,401);
 const admin=await request('POST','/api/auth/login',{username:'process-admin',password,mode:'client'});assert.equal(admin.status,200);
 const token=admin.body.token,userId=admin.body.userId;
 const user=await request('POST','/api/admin/accounts',{username:'process-user',password},token);assert.equal(user.status,200);
 const personal=await request('POST','/api/auth/login',{username:'process-user',password,mode:'client'});assert.equal(personal.status,200);
 assert.equal((await request('GET','/api/admin/accounts',undefined,personal.body.token)).status,403);
 assert.equal((await request('GET','/api/materials',undefined,token)).status,200);
 active.child.kill('SIGTERM');await active.closed;active=undefined;active=await start();
 const self=await request('GET','/api/auth/self',undefined,token);assert.equal(self.status,200);assert.equal(self.body.userId,userId);
 assert.equal((await request('PATCH',`/api/admin/accounts/${user.body.userId}`,{disabled:true},token)).status,200);
 assert.equal((await request('GET','/api/auth/self',undefined,personal.body.token)).status,401);
 assert.equal((await request('POST','/api/auth/logout',{},token)).status,200);
 assert.equal((await request('GET','/api/auth/self',undefined,token)).status,401);
});
