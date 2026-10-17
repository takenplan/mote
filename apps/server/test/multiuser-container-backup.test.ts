import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,mkdirSync,readFileSync,writeFileSync,readdirSync,existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {DatabaseSync} from 'node:sqlite';
import {buildApp} from '../src/app.js';
import {initialize,profilePaths,loadProfile,restoreProfile,backupProfile} from '../../../scripts/profile-lib.mjs';
import {backupScopedInstance} from '../../../scripts/scoped-backup.mjs';

// Only the Docker transport is substituted. The production staging, SQLite,
// authority retirement, file-copy verifier and YAML publication run unchanged.
async function fixture(t:any){
 const root=mkdtempSync(join(tmpdir(),'mote-container-protocol-'));
 t.after(()=>rmSync(root,{recursive:true,force:true}));
 const source=join(root,'source'),archive=join(root,'archive'),node=await buildApp({dataDir:source});
 await node.accounts!.initialize('generated-container-admin','Generated-container-password');
 const login=await node.accounts!.login('generated-container-admin','Generated-container-password','generated','client',0);
 const deployment=node.deploymentId;await node.app.close();await backupScopedInstance({source,out:archive});
 const paths=profilePaths('fixture',join(root,'profiles'));await initialize(paths,{runtime:'docker',image:'generated-local-image'});const p=await loadProfile(paths);
 const volumes=new Map<string,{directory:string;labels:Record<string,string>}>(),calls:string[][]=[];
 const originalVolume=p.meta.volume,empty=join(root,'empty');mkdirSync(empty);volumes.set(originalVolume,{directory:empty,labels:{}});
 let failure=false,running=false,afterTransfer=()=>{};
 const execute=async(command:string,args:string[])=>{
  assert.equal(command,'docker');calls.push(args);
  if(args[0]==='ps')return running?'generated-running-container':'';
  if(args[0]==='image')return 'sha256:'+'a'.repeat(64);
  if(args[0]==='volume'){
   if(args[1]==='ls')return volumes.has(originalVolume)?originalVolume:'';
   if(args[1]==='create'){
    const name=args.at(-1)!,directory=join(root,name);mkdirSync(directory);
    const labels:Record<string,string>={};for(let i=0;i<args.length;i++)if(args[i]==='--label'){const [key,value]=args[i+1].split('=');labels[key]=value;}
    volumes.set(name,{directory,labels});return name;
   }
   const name=args.at(-1)!,entry=volumes.get(name);assert.ok(entry);
   if(args[1]==='inspect')return JSON.stringify([{Name:name,Labels:entry.labels}]);
   if(args[1]==='rm'){rmSync(entry.directory,{recursive:true});volumes.delete(name);return name;}
  }
  if(args[0]==='run'){
   assert.equal(args[args.indexOf('--pull')+1],'never');assert.equal(args[args.indexOf('--network')+1],'none');
   let script=args[args.indexOf('-e')+1];
   for(let i=0;i<args.length;i++)if(args[i]==='--mount'){
    const fields=Object.fromEntries(args[i+1].split(',').map(field=>field.split('='))),path=fields.type==='volume'?volumes.get(fields.source)!.directory:fields.source;
    script=script.replaceAll(fields.target,path);
   }
   execFileSync(process.execPath,['-e',script],{stdio:'pipe'});
   if(args.some(arg=>arg.includes('target=/target')))afterTransfer();
   if(failure&&args.some(arg=>arg.includes('target=/target')))throw Error('Generated transport loss after copied bytes');
   return '';
  }
  throw Error('Unexpected Docker command '+JSON.stringify(args));
 };
 return {root,source,archive,p,login,deployment,volumes,calls,originalVolume,dependencies:{execute,configurationUser:async()=>`${process.getuid!()}:${process.getgid!()}`},fail:()=>{failure=true;},running:()=>{running=true;},afterTransfer:(work:()=>void)=>{afterTransfer=work;}};
}

test('epoch-5 Docker publication stages complete retired authority then atomically selects a fresh volume',async t=>{
 const f=await fixture(t),before=readFileSync(f.p.configFile,'utf8');
 const result=await restoreProfile(f.p,f.archive,f.dependencies);
 assert.equal(result.deploymentId,f.deployment);assert.notEqual(f.p.meta.volume,f.originalVolume);
 assert.equal(f.volumes.has(f.originalVolume),true);assert.deepEqual(readdirSync(f.volumes.get(f.originalVolume)!.directory),[]);
 const restored=f.volumes.get(f.p.meta.volume)!;const db=new DatabaseSync(join(restored.directory,'mote.sqlite'));
 try{assert.equal(db.prepare('SELECT deployment_id FROM scope_meta').get()!.deployment_id,f.deployment);assert.equal(db.prepare('SELECT count(*) n FROM auth_credentials WHERE revoked_at IS NULL').get()!.n,0);}finally{db.close();}
 const loaded=await loadProfile(profilePaths(f.p.profile,f.p.home));assert.equal(loaded.meta.volume,f.p.meta.volume);assert.equal(loaded.meta.modelsVolume,f.p.meta.modelsVolume);
 assert.notEqual(readFileSync(f.p.configFile,'utf8'),before);assert.equal(result.configurationFile,'/data/instance.yaml');
 const opened=await buildApp({dataDir:restored.directory});try{assert.equal((await opened.app.inject({url:'/api/auth/self',headers:{authorization:'Bearer '+f.login.token,'x-mote-protocol-version':'2'}})).statusCode,401);assert.equal((await opened.accounts!.login('generated-container-admin','Generated-container-password','generated','client',0)).userId,f.login.userId);}finally{await opened.app.close();}
 assert.ok(f.calls.every(args=>!['start','stop','restart','pull','build','cp'].includes(args[0])));
 const again=join(f.root,'rebackup');await backupProfile(loaded,again,f.dependencies);
 const copied=new DatabaseSync(join(again,'mote.sqlite'));try{assert.equal(copied.prepare('SELECT deployment_id FROM scope_meta').get()!.deployment_id,f.deployment);}finally{copied.close();}
});

for(const timing of ['occupied','running','late-write','late-created-volume','yaml-race'])test('Docker restore preserves current state for '+timing,async t=>{
 const f=await fixture(t),before=readFileSync(f.p.configFile,'utf8'),selected=f.volumes.get(f.originalVolume)!.directory;
 if(timing==='occupied')writeFileSync(join(selected,'sentinel'),'Generated current valid data');
 if(timing==='running')f.running();
 if(timing==='late-write')f.afterTransfer(()=>writeFileSync(join(selected,'sentinel'),'Generated current valid data'));
 if(timing==='late-created-volume'){const original=f.volumes.get(f.originalVolume)!;f.volumes.delete(f.originalVolume);f.afterTransfer(()=>{f.volumes.set(f.originalVolume,original);writeFileSync(join(selected,'sentinel'),'Generated current valid data');});}
 if(timing==='yaml-race')f.afterTransfer(()=>writeFileSync(f.p.configFile,before+'\n# Generated concurrent operator edit\n'));
 await assert.rejects(restoreProfile(f.p,f.archive,f.dependencies),/empty data volume|Stop every container|Configuration changed/);
 assert.equal(f.volumes.size,1);assert.equal(f.p.meta.volume,f.originalVolume);
 assert.equal(readFileSync(f.p.configFile,'utf8'),timing==='yaml-race'?before+'\n# Generated concurrent operator edit\n':before);
 if(timing==='occupied'||timing==='late-write'||timing==='late-created-volume')assert.equal(readFileSync(join(selected,'sentinel'),'utf8'),'Generated current valid data');
});

test('Docker restore copy failure leaves selected profile and original volume unchanged',async t=>{
 const f=await fixture(t),before=readFileSync(f.p.configFile,'utf8');f.fail();
 await assert.rejects(restoreProfile(f.p,f.archive,f.dependencies),/transport loss/);
 assert.equal(readFileSync(f.p.configFile,'utf8'),before);assert.equal(f.p.meta.volume,f.originalVolume);assert.equal(f.volumes.size,1);
});

test('corrupt epoch-5 archive cannot invoke any Docker mutation or change its selected YAML',async t=>{
 const f=await fixture(t),before=readFileSync(f.p.configFile,'utf8');writeFileSync(join(f.archive,'instance.yaml'),'Generated corruption');
 await assert.rejects(restoreProfile(f.p,f.archive,f.dependencies),/checksum/);assert.equal(f.calls.length,0);assert.equal(readFileSync(f.p.configFile,'utf8'),before);
 assert.equal(existsSync(join(f.root,'must-not-exist')),false);
});
