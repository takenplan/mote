// Generated-data opt-in Docker acceptance. Run with node --import tsx.
// Only this run's uniquely labelled containers/volumes are removed in finally.
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,rmSync,cpSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID,createHash} from 'node:crypto';
import {execFileSync,spawnSync} from 'node:child_process';
import {DatabaseSync} from 'node:sqlite';
import {setTimeout as delay} from 'node:timers/promises';
import {EXECUTION_POLICIES} from '../../apps/server/src/execution-policy.ts';
import {buildApp} from '../../apps/server/src/app.ts';
import {backupScopedInstance} from '../scoped-backup.mjs';
import {initialize,profilePaths,loadProfile,restoreProfile,backupProfile,dockerConfigurationUser} from '../profile-lib.mjs';
const runId='container142-'+randomUUID(),directory=mkdtempSync(join(tmpdir(),'mote-actual-container-')),source=join(directory,'source'),archive=join(directory,'archive');
// Explicit opt-in: the image must already exist. No pull/build is performed.
const image=process.env.MOTE_CONTAINER_VALIDATION_IMAGE;
assert.ok(image,'Set MOTE_CONTAINER_VALIDATION_IMAGE to an existing local image');
const production=process.env.MOTE_CONTAINER_VALIDATE_STARTUP==='1';
const sourceSha=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
const docker=(args:string[])=>execFileSync('docker',args,{encoding:'utf8',timeout:120000,stdio:['ignore','pipe','pipe']}).trim();
const created=new Set<string>();let p:any,node:any,index=0,containerCreated=false;
const container=runId+'-central';
const execute=async(command:string,args:string[])=>{assert.equal(command,'docker');const actual=args[0]==='run'?['run','--name',runId+'-'+(++index),'--label','dev.mote.fixture='+runId,...args.slice(1)]:args;return docker(actual);};
try{
 node=await buildApp({dataDir:source});assert.ok(node.execution);
 node.execution.register({kind:'generated.container-unknown',pool:'generated-container',concurrency:()=>1,policy:EXECUTION_POLICIES.deterministic,parseInput:input=>input,portableInput:input=>input,execute:async run=>{run.external.begin('generated-external-unknown');return null;}});
 const password='Generated-actual-container-password';await node.accounts.initialize('generated-admin',password);const admin=await node.accounts.login('generated-admin',password,'generated','client',0),context=await node.authority.authenticate(admin.token),users=[];
 const captureId='03030303-0303-4303-8303-030303030303';
 const original=Buffer.alloc(2*1024*1024+71,0x61);original.write('Generated actual Docker original bytes; both owner namespaces retain this original.');
 for(const name of ['a','b']){const user=await node.accounts.createAccount(context,node.authority,{username:'generated-'+name,password,administrator:false}),grant=await node.accounts.login(user.username,password,'generated','client',0),scope=await node.authority.authenticate(grant.token),ingress=node.ingress.forUser(scope);users.push({...user,...grant});ingress.registerSource({id:'same-source',name:'Generated original',kind:'local-files',deviceId:'same-device',platform:'import',retention:'archive'});const captured=await node.app.inject({method:'POST',url:'/api/ingress/sources/same-source/captures',headers:{authorization:'Bearer '+grant.token,'x-mote-protocol-version':'2','x-mote-ingress-version':'3'},payload:{batchId:'same-batch',items:[{id:captureId,deviceId:'same-device',deviceName:'Generated',platform:'import',capturedAt:'2026-01-01T00:00:00Z',durationMs:0,source:'screen',ocrText:'Generated '+name,imageBase64:original.toString('base64'),imageMime:'image/png'}]}});assert.equal(captured.statusCode,200,captured.body);}
 const task=await node.app.inject({method:'POST',url:'/api/tasks',headers:{authorization:'Bearer '+users[0].token,'x-mote-protocol-version':'2'},payload:{kind:'generated.container-unknown',operationId:'generated-unknown',input:{generated:true}}});assert.equal(task.statusCode,200,task.body);
 const taskId=task.json().id;for(let n=0;n<500;n++){const step=node.execution.engine.get(taskId);if(step&&['blocked','failed','succeeded','cancelled'].includes(step.state))break;await delay(10);}
 const deploymentId=node.deploymentId;await node.app.close();
 const originalDb=new DatabaseSync(join(source,'mote.sqlite'));let unknown:any;try{assert.ok(Number(originalDb.prepare('SELECT count(*) n FROM task_authorizations WHERE revoked=0').get()!.n)>0);unknown=originalDb.prepare('SELECT task_id,external_state,external_key,external_issuance FROM user_tasks WHERE task_id=?').get(taskId);assert.ok(['issued','unknown'].includes(unknown.external_state));}finally{originalDb.close();}
 node=undefined;await backupScopedInstance({source,out:archive});
 const paths=profilePaths('actual',join(directory,'profiles'));await initialize(paths,{runtime:'docker',image});p=await loadProfile(paths);let selected=p.meta.volume;
 docker(['volume','create','--label','dev.mote.fixture='+runId,selected]);created.add(selected);
 const occupied=selected,occupiedProfile=p,selectedYaml=readFileSync(p.configFile,'utf8'),corrupt=join(directory,'corrupt');cpSync(archive,corrupt,{recursive:true});writeFileSync(join(corrupt,'instance.yaml'),'Generated damaged configuration');let admitted=0;
 await assert.rejects(restoreProfile(p,corrupt,{execute:async(command:string,args:string[])=>{admitted++;return execute(command,args);}}),/checksum/);assert.equal(admitted,0);assert.equal(readFileSync(p.configFile,'utf8'),selectedYaml);
 const sentinel='Generated current valid data must remain unchanged';docker(['run','--pull','never','--rm','--name',runId+'-sentinel-write','--label','dev.mote.fixture='+runId,'--network','none','--user','0','--mount',`type=volume,source=${occupied},target=/target`,'--entrypoint','node',image!,'-e',`require('node:fs').writeFileSync('/target/sentinel',${JSON.stringify(sentinel)},{mode:0o600,flag:'wx'});`]);
 await assert.rejects(restoreProfile(p,archive,{execute}),/empty data volume/);assert.equal(readFileSync(p.configFile,'utf8'),selectedYaml);
 const targetPaths=profilePaths('empty-target',join(directory,'profiles'));await initialize(targetPaths,{runtime:'docker',image});p=await loadProfile(targetPaths);selected=p.meta.volume;docker(['volume','create','--label','dev.mote.fixture='+runId,selected]);created.add(selected);

 const restored=await restoreProfile(p,archive,{execute});created.add(restored.volume);assert.notEqual(restored.volume,selected);assert.equal(restored.deploymentId,deploymentId);p=await loadProfile(profilePaths(p.profile,p.home));assert.equal(p.meta.volume,restored.volume);
 if(production){
  const user=await dockerConfigurationUser(p,execute);
  docker(['run','--pull','never','--detach','--name',container,'--label','dev.mote.fixture='+runId,'--network','none','--security-opt','no-new-privileges:true','--cap-drop','ALL','--user',user,'--mount',`type=volume,source=${restored.volume},target=/data`,'--mount',`type=bind,source=${p.directory},target=/config`,'--env','MOTE_CONFIG_FILE=/config/mote.yaml',image!]);containerCreated=true;
  const request=(path:string,token?:string,payload?:unknown)=>JSON.parse(docker(['exec',container,'node','-e',`(async()=>{const r=await fetch('http://127.0.0.1:${p.port}'+${JSON.stringify(path)},{method:${JSON.stringify(payload===undefined?'GET':'POST')},headers:{'x-mote-protocol-version':'2','Content-Type':'application/json',...${JSON.stringify(token?{authorization:'Bearer '+token}:{})}},body:${JSON.stringify(payload===undefined?undefined:JSON.stringify(payload))}});console.log(JSON.stringify({status:r.status,body:await r.json()}));})().catch(()=>process.exit(1));`]));
  for(let cycle=0;cycle<2;cycle++){
   if(cycle)docker(['start',container]);
   docker(['exec',container,'node','-e',`(async()=>{for(let n=0;n<150;n++){try{if((await fetch('http://127.0.0.1:${p.port}/api/health')).ok)return;}catch{}await new Promise(r=>setTimeout(r,200));}process.exit(1);})();`]);
   for(const old of [admin,...users])assert.equal(request('/api/auth/self',old.token).status,401);
   for(const user of users){const fresh=request('/api/auth/login',undefined,{username:user.username,password,mode:'client',durationMs:86400000});assert.equal(fresh.status,200);assert.equal(fresh.body.userId,user.userId);const captured=request('/api/captures',fresh.body.token);assert.equal(captured.status,200);assert.equal(captured.body.items.length,1);assert.equal(captured.body.items[0].id,captureId);assert.equal(captured.body.items[0].ocrText,'Generated '+user.username.slice(-1));}
   docker(['stop','--time','20',container]);const state=JSON.parse(docker(['inspect',container]))[0];assert.equal(state.State.ExitCode,0);assert.equal(state.State.Running,false);
  }
 }
 const readback=join(directory,'actual-readback');await backupProfile(p,readback,{execute});
 const db=new DatabaseSync(join(readback,'mote.sqlite'));try{assert.equal(db.prepare('SELECT deployment_id FROM scope_meta').get()!.deployment_id,deploymentId);const active=Number(db.prepare('SELECT count(*) n FROM auth_credentials WHERE revoked_at IS NULL').get()!.n);assert.ok(production?active>=2:active===0);assert.equal(db.prepare('SELECT count(*) n FROM pd_captures').get()!.n,2);assert.equal(db.prepare('SELECT count(DISTINCT id) n FROM pd_captures').get()!.n,1);assert.equal(db.prepare('SELECT count(*) n FROM task_authorizations WHERE revoked=0').get()!.n,0);assert.deepEqual(db.prepare('SELECT task_id,external_state,external_key,external_issuance FROM user_tasks WHERE task_id=?').get(taskId),unknown);}finally{db.close();}
 const manifest=JSON.parse(readFileSync(join(readback,'backup-manifest.json'),'utf8')),parts=Object.keys(manifest.checksums).filter(name=>name.startsWith('originals/')&&name.endsWith('.plain'));assert.equal(parts.length,2);for(const part of parts)assert.deepEqual(readFileSync(join(readback,part)),original);
 node=await buildApp({dataDir:readback});assert.equal(node.deploymentId,deploymentId);assert.equal((await node.app.inject({url:'/api/auth/self',headers:{authorization:'Bearer '+admin.token,'x-mote-protocol-version':'2'}})).statusCode,401);
 for(const user of users){const fresh=await node.accounts.login(user.username,password,'generated','client',0);assert.equal(fresh.userId,user.userId);const context=await node.authority.authenticate(fresh.token);const captures=node.services.forUser(context).get('private-data').captures({}).items;assert.equal(captures.length,1);assert.equal(captures[0].id,captureId);assert.equal(captures[0].ocrText,'Generated '+user.username.slice(-1));}
 assert.equal(readFileSync(occupiedProfile.configFile,'utf8'),selectedYaml);assert.equal(docker(['run','--pull','never','--rm','--name',runId+'-sentinel-read','--label','dev.mote.fixture='+runId,'--network','none','--read-only','--user','0','--mount',`type=volume,source=${occupied},target=/source,readonly`,'--entrypoint','node',image!,'-e',"process.stdout.write(require('node:fs').readFileSync('/source/sentinel','utf8'))"]),sentinel);
 console.log(JSON.stringify({result:'PASS',runId,image,sourceSha,deploymentId,originalSha256:createHash('sha256').update(original).digest('hex'),copiedOriginals:parts.length,oldCredentialsRevived:0,taskAuthorizationsRevived:0,unknownExternalFactPreserved:true,sameCaptureIdOwnerIsolated:true,currentValidVolumePreserved:true,corruptPackageBeforeDocker:true,restoredVolume:restored.volume,previousVolume:selected,actualDockerCommands:true,productionContainerStartup:production,productionRestart:production,cleanShutdownCycles:production?2:0}));
}catch(error){
 if(containerCreated){const logs=spawnSync('docker',['logs',container],{encoding:'utf8'});writeFileSync(join(tmpdir(),'mote-container-production-'+runId+'.log'),(logs.stdout??'')+(logs.stderr??''));}
 throw error;
}finally{
 await node?.app.close();
 if(containerCreated){const state=JSON.parse(docker(['inspect',container]))[0];assert.equal(state.Config.Labels?.['dev.mote.fixture'],runId);if(state.State.Running)docker(['stop','--time','20',container]);docker(['rm',container]);}
 for(const volume of created){const state=JSON.parse(docker(['volume','inspect',volume]))[0];assert.ok(state.Labels?.['dev.mote.fixture']===runId||state.Labels?.['dev.mote.profile']===p.project);docker(['volume','rm',volume]);}
 rmSync(directory,{recursive:true,force:true});
}
