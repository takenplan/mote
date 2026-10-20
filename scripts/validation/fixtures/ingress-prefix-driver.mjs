import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createHash,randomUUID} from 'node:crypto';
import {closeSync,copyFileSync,existsSync,mkdirSync,openSync,readFileSync,realpathSync,writeFileSync,appendFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {join} from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {setTimeout as delay} from 'node:timers/promises';

const run=process.argv[2],label=process.argv[3],started=Date.now(),deadline=started+120000;
mkdirSync(run,{recursive:true,mode:0o700});
const save=(name,data)=>writeFileSync(join(run,name),JSON.stringify(data,null,2)+'\n',{mode:0o600});
const hash=path=>createHash('sha256').update(readFileSync(path)).digest('hex');
const event=(type,data={})=>appendFileSync(join(run,'events.jsonl'),JSON.stringify({at:new Date().toISOString(),type,...data})+'\n',{mode:0o600});
const inputPath='/replay/ingress-prefix-input.json',input=JSON.parse(readFileSync(inputPath,'utf8'));
assert.equal(hash(inputPath),'42bb17ff1567cec5847084960d97d64d273f67d1674386ca421aa48d1261eb7d');
assert.deepEqual(Object.values(input).map(items=>items.length),[20,8,15]);
const config=join(run,'mote.yaml'),credentials={username:'round5-admin',password:'Generated-'+randomUUID()};
save('mote.yaml',{version:1,revision:0,server:{host:'127.0.0.1',port:0},storage:{dataDir:join(run,'vault')}});
copyFileSync(inputPath,join(run,'input.json'));
const env={PATH:process.env.PATH,HOME:join(run,'home'),TMPDIR:join(run,'tmp'),MOTE_CONFIG_FILE:config,REPRO_RUN:run};
mkdirSync(env.HOME,{mode:0o700});mkdirSync(env.TMPDIR,{mode:0o700});
const result={label,startedAt:new Date(started).toISOString(),nodeVersion:process.version,sqliteVersion:process.versions.sqlite,platform:process.platform,architecture:process.arch,uid:process.getuid(),inputSha256:hash(inputPath),sources:[],status:'IN_PROGRESS'};
const children=[];
function child(role,args,body){
 const fds=[openSync(join(run,role+'.stdout'),'w',0o600),openSync(join(run,role+'.stderr'),'w',0o600)];
 const process=spawn(globalThis.process.execPath,args,{env,cwd:'/app',detached:true,stdio:['pipe',...fds]});fds.forEach(closeSync);
 const exit=new Promise((resolve,reject)=>{process.once('error',reject);process.once('close',(code,signal)=>{event(role+'.exit',{code,signal});resolve({code,signal});});});
 const owned={process,exit};children.push(owned);process.stdin.end(body?JSON.stringify(body):undefined);event(role+'.spawn',{pid:process.pid});return owned;
}
async function exitedWithin(owned,ms){return Promise.race([owned.exit,delay(ms,null,{ref:false})]);}
async function stop(owned){
 if(owned.process.exitCode!==null||owned.process.signalCode!==null)return owned.exit;
 try{process.kill(-owned.process.pid,'SIGTERM');}catch(error){if(error.code!=='ESRCH')throw error;}
 const exit=await exitedWithin(owned,10000);if(exit)return exit;
 try{process.kill(-owned.process.pid,'SIGKILL');}catch(error){if(error.code!=='ESRCH')throw error;}return owned.exit;
}
let base,host,error;
async function request(token,path,method='GET',body,binary=false){
 if(Date.now()>deadline)throw new Error('ROUND_DEADLINE');
 const response=await fetch(base+path,{method,headers:{'x-mote-protocol-version':'2','x-mote-ingress-version':'3',...(body?{'content-type':'application/json'}:{}),...(token?{authorization:'Bearer '+token}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(10000)});
 // Content ticket values and credentials never enter the evidence log.
 event('http',{path:path.split('?')[0],method,status:response.status});
 if(response.status!==200){let code='non_json_error';try{code=(await response.json()).error??'unknown_error';}catch{};throw new Error(`HTTP ${method} ${path.split('?')[0]} ${response.status} ${code}`);}
 return binary?Buffer.from(await response.arrayBuffer()):response.json();
}
try{
 assert.equal(process.version,'v24.19.0');assert.equal(process.platform,'linux');assert.equal(process.arch,'arm64');assert.equal(process.versions.sqlite,'3.53.3');
 const require=createRequire('/app/apps/server/package.json'),modules=[];
 for(const name of ['fastify','zod','yaml','fflate','better-sqlite3','@deepseek-ai/cordis','@mote/shared','@mote/agent']){const path=require.resolve(name);modules.push({name,path,realpath:realpathSync(path),sha256:hash(path)});}
 save('runtime.json',{versions:process.versions,modules});
 const bootstrap=child('bootstrap',['/app/apps/server/dist/scope/initialize-admin.js'],credentials),initialized=await exitedWithin(bootstrap,20000);
 if(!initialized)throw new Error('INIT_TIMEOUT');assert.equal(initialized.code,0,'initialize-admin exit');
 host=child('host',['--import','/replay/ingress-prefix-release.mjs','/app/apps/server/dist/index.js']);
 while(!base){
  for(const line of readFileSync(join(run,'host.stdout'),'utf8').split('\n'))try{const row=JSON.parse(line);if(row.event==='server.listening')base='http://127.0.0.1:'+row.port;}catch{}
  if(host.process.exitCode!==null||host.process.signalCode!==null)throw new Error('HOST_START_EXIT');
  if(Date.now()-started>30000)throw new Error('START_TIMEOUT');if(!base)await delay(10);
 }
 const admin=await request(undefined,'/api/auth/login','POST',{...credentials,mode:'client'});
 await request(admin.token,'/api/admin/accounts','POST',{username:'round5-second',password:credentials.password});
 await request(undefined,'/api/auth/login','POST',{username:'round5-second',password:credentials.password,mode:'client'});
 const preview=await request(admin.token,'/api/plugins/resolve','POST',{repository:'generated-final/finance',tag:'v1.0.0'}),catalog=await request(admin.token,'/api/admin/plugins');
 await request(admin.token,'/api/plugins/install','POST',{previewId:preview.id,expectedRevision:catalog.revision,operationId:randomUUID()});
 for(;;){const current=await request(admin.token,'/api/admin/plugins');if(current.packages.some(item=>item.state==='installed'))break;if(Date.now()>deadline)throw new Error('INSTALL_TIMEOUT');await delay(10);}
 for(const [sourceId,items]of Object.entries(input)){
  await request(admin.token,'/api/ingress/sources','POST',{id:sourceId,name:'Generated '+sourceId,kind:'custom',deviceId:'generated-r5',platform:'import',retention:'archive'});
  let accepted=0;const acceptedRefs=new Set();
  for(let offset=0;offset<items.length;offset+=6){
   const receipt=await request(admin.token,'/api/ingress/sources/'+sourceId+'/items','POST',{batchId:'generated-'+sourceId+'-'+offset,items:items.slice(offset,offset+6)});
   assert.equal(receipt.sourceId,sourceId);assert.equal(receipt.captures.length,Math.min(6,items.length-offset));
   for(const item of receipt.captures){assert.equal(item.duplicate,false);assert.equal(item.original.sourceId,sourceId);acceptedRefs.add(item.original.ref);}accepted+=receipt.captures.length;
  }
  const originals=[];let after='',pages=0;
  do{const page=await request(admin.token,'/api/ingress/sources/'+sourceId+'/originals?limit=7'+(after?'&after='+encodeURIComponent(after):''));originals.push(...page.items);pages++;after=page.nextCursor;}while(after);
  assert.equal(accepted,items.length);assert.equal(originals.length,items.length);assert.deepEqual(new Set(originals.map(item=>item.ref)),acceptedRefs);
  const expected=new Map(items.map(item=>[JSON.stringify([item.externalId,item.revision]),item]));
  for(const original of originals){
   assert.equal(original.sourceId,sourceId);const id=original.ref.slice(9),ticket=await request(admin.token,'/api/ingress/originals/'+id+'/tickets','POST',{});
   const bytes=await request(admin.token,'/api/ingress/originals/'+id+'/content?ticket='+encodeURIComponent(ticket.ticket),'GET',undefined,true),value=JSON.parse(bytes);
   assert.equal(createHash('sha256').update(bytes).digest('hex'),original.hash);assert.equal(bytes.length,original.bytes);
   const key=JSON.stringify([value.externalId,value.revision]),item=expected.get(key);assert.ok(item,'unexpected original identity');
   for(const name of Object.keys(item))assert.deepEqual(value[name],item[name]);expected.delete(key);
  }
  assert.equal(expected.size,0);result.sources.push({sourceId,expected:items.length,accepted,pages,originalsVerified:originals.length});
 }
 await delay(1000);assert.equal(host.process.exitCode,null);assert.equal(host.process.signalCode,null);
}catch(failure){error=failure;result.error={message:failure.message,stack:failure.stack};event('first_exception',{message:failure.message});}
finally{
 const cleanupErrors=[];
 for(const owned of [...children].reverse())try{const exit=await stop(owned);if(owned===host){result.hostExit=exit;if(!error&&exit.code!==0)throw new Error('Host shutdown exit was not zero');}}catch(failure){cleanupErrors.push(failure.message);}
 try{
  const directory=join(run,'inspection-copy');mkdirSync(directory,{mode:0o700});
  for(const suffix of ['','-wal','-shm','-journal']){const path=join(run,'vault','mote.sqlite'+suffix);if(existsSync(path))copyFileSync(path,join(directory,'mote.sqlite'+suffix));}
  const path=join(directory,'mote.sqlite'),before=hash(path),db=new DatabaseSync(path,{readOnly:true});db.exec('PRAGMA query_only=ON');
  const inspection={before,quickCheck:db.prepare('PRAGMA quick_check').all().map(row=>({...row})),integrityCheck:db.prepare('PRAGMA integrity_check').all().map(row=>({...row})),counts:{}};
  try{for(const table of ['auth_accounts','plugin_user_instances','plugin_user_snapshots','pd_captures','ig_originals'])inspection.counts[table]=db.prepare('SELECT count(*) n FROM '+table).get().n;}finally{db.close();}
  inspection.after=hash(path);save('inspection.json',inspection);
  assert.equal(inspection.before,inspection.after);assert.deepEqual(inspection.quickCheck,[{quick_check:'ok'}]);assert.deepEqual(inspection.integrityCheck,[{integrity_check:'ok'}]);
  assert.equal(inspection.counts.plugin_user_instances,0);assert.equal(inspection.counts.plugin_user_snapshots,0);result.pluginInstanceCount=0;result.pluginSnapshotCount=0;
  const outbound=readFileSync(join(run,'outbound-metadata.jsonl'),'utf8').trim().split('\n').filter(Boolean).map(line=>JSON.parse(line));
  result.unexpectedNetworkAttempts=outbound.filter(row=>!row.allowed).length;assert.equal(result.unexpectedNetworkAttempts,0);
  if(!error){assert.equal(inspection.counts.auth_accounts,2);assert.equal(inspection.counts.pd_captures,43);assert.equal(inspection.counts.ig_originals,43);}
 }catch(failure){result.inspectionError={message:failure.message};}
 if(cleanupErrors.length)result.cleanupErrors=cleanupErrors;
 result.status=error||result.inspectionError||cleanupErrors.length?'EXPERIMENT_ERROR':'PREFIX_COMPLETED_NO_REPRODUCTION';result.finishedAt=new Date().toISOString();result.elapsedMs=Date.now()-started;
 save('result.json',result);console.log(JSON.stringify(result));if(result.status!=='PREFIX_COMPLETED_NO_REPRODUCTION')process.exitCode=1;
}
