// Offline Linux replay of the generated archive-ingress startup journey.
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {createHash,randomUUID} from 'node:crypto';
import {existsSync,lstatSync,mkdirSync,readFileSync,readdirSync,realpathSync,writeFileSync} from 'node:fs';
import {basename,dirname,isAbsolute,join,relative,resolve,sep} from 'node:path';
import {fileURLToPath} from 'node:url';

const fixture=join(dirname(fileURLToPath(import.meta.url)),'fixtures');
const historicalImage='sha256:d47cf0e648f7540a52223637b034ac959c060e7e3b6e915c37ff2c2fc68bf667';
const runtimeResources=['packages/shared','packages/agent','packages/diagnostics','apps/server'].flatMap(path=>[path+'/dist',path+'/package.json']).concat('packages/agent/skills');
const dependencyProbe=`import{createRequire}from'node:module';import{existsSync,readdirSync,readFileSync,realpathSync}from'node:fs';import{createHash}from'node:crypto';import{fileURLToPath}from'node:url';const require=createRequire(import.meta.url),names=['fastify','zod','yaml','fflate','better-sqlite3','@deepseek-ai/cordis','mem0ai/oss','node-fetch'];const identity=path=>({path,realpath:realpathSync(path),sha256:createHash('sha256').update(readFileSync(path)).digest('hex')});const entries=names.map(name=>({name,require:identity(require.resolve(name)),import:identity(fileURLToPath(import.meta.resolve(name)))}));const layouts=['/app/node_modules','/app/apps/server/node_modules','/app/packages/agent/node_modules'].map(path=>({path,exists:existsSync(path),entries:existsSync(path)?readdirSync(path).sort():[]}));console.log(JSON.stringify({entries,layouts,mem0Exports:Object.keys(await import('mem0ai/oss')).sort()}));`;
const help=`Usage: node scripts/validation/ingress-prefix-repro.mjs --source MAC_BUILT_CHECKOUT --runtime-dir NODE_24_19_LINUX_ARM64 --output NEW_DIRECTORY [--plugin-source CHECKOUT] [--image LOCAL_IMAGE] [--storage linux|host-bind] [--label NAME]
Requires prebuilt Shared, Agent, Diagnostics and Server dist; never builds or installs dependencies.
Uses an existing local Docker image, its dependencies, offline networking, and a Linux-owned vault by default.
--storage host-bind records the actual result on the host filesystem; it does not guarantee the historical 503.
Output includes a private synthetic-account test database. Keep the output directory outside source control.`;
const hash=path=>createHash('sha256').update(readFileSync(path)).digest('hex');
const inside=(parent,child)=>{const r=relative(parent,child);return r===''||(!r.startsWith('..'+sep)&&r!=='..'&&!isAbsolute(r));};
function command(args,timeout=150000){
 const result=spawnSync('docker',args,{encoding:'utf8',timeout,maxBuffer:8*1024*1024});
 if(result.error)throw result.error;
 if(result.status!==0)throw new Error(`docker ${args[0]} exited ${result.status}: ${result.stderr.trim()}`);
 return result.stdout;
}
function options(argv){
 const values={image:historicalImage,storage:'linux',label:'generated-ingress-prefix'};
 const keys=new Set(['source','runtime-dir','output','plugin-source','image','storage','label']);
 for(let i=0;i<argv.length;i++){
  const name=argv[i].slice(2);if(!argv[i].startsWith('--')||!keys.has(name)||argv[i+1]===undefined||argv[i+1].startsWith('--'))throw new Error('Unknown or incomplete argument: '+argv[i]);
  if(Object.hasOwn(values,name)&&!['image','storage','label'].includes(name))throw new Error('Duplicate argument: '+argv[i]);
  values[name]=argv[++i];
 }
 for(const key of ['source','runtime-dir','output'])if(!values[key])throw new Error('Missing --'+key);
 if(!['linux','host-bind'].includes(values.storage))throw new Error('Invalid --storage');
 if(!/^[a-z0-9][a-z0-9-]{0,47}$/.test(values.label))throw new Error('Invalid --label');
 values.source=realpathSync(values.source);values['plugin-source']=realpathSync(values['plugin-source']??values.source);values['runtime-dir']=realpathSync(values['runtime-dir']);
 const output=resolve(values.output);values.output=join(realpathSync(dirname(output)),basename(output));
 for(const root of [values.source,values['plugin-source'],values['runtime-dir'],resolve(dirname(fileURLToPath(import.meta.url)),'../..')])if(inside(root,values.output))throw new Error('--output must be outside source and runtime directories');
 if(existsSync(values.output))throw new Error('--output must be a new directory');
 if(spawnSync('git',['-C',dirname(values.output),'rev-parse','--is-inside-work-tree'],{encoding:'utf8'}).status===0)throw new Error('--output must be outside Git worktrees');
 for(const path of ['packages/shared/dist/index.js','packages/agent/dist/index.js','packages/agent/skills/calendar-extraction/SKILL.md','packages/diagnostics/dist/index.js','apps/server/dist/index.js','apps/server/dist/scope/initialize-admin.js'])if(!existsSync(join(values.source,path)))throw new Error('Missing prebuilt source resource: '+path);
 for(const path of [join(values['runtime-dir'],'bin/node'),join(values['plugin-source'],'plugins/extension-benchmark/final-pack/release.mjs')])if(!existsSync(path))throw new Error('Missing runtime resource: '+path);
 return values;
}
function manifest(root,paths){
 const result=[];
 const visit=path=>{const stat=lstatSync(path);if(stat.isSymbolicLink())throw new Error('Manifest resource is a symbolic link: '+path);if(stat.isDirectory()){for(const name of readdirSync(path).sort())visit(join(path,name));}else if(stat.isFile())result.push({path:relative(root,path),realpath:realpathSync(path),bytes:stat.size,sha256:hash(path)});};
 for(const path of paths)visit(join(root,path));return result;
}
function gitIdentity(source){
 const read=args=>{const r=spawnSync('git',['-C',source,...args],{encoding:'utf8'});if(r.status!==0)throw new Error('Cannot read source Git identity');return r.stdout.trim();};
 return {head:read(['rev-parse','HEAD']),dirty:Boolean(read(['status','--porcelain']))};
}
function main(){
 if(process.argv.slice(2).includes('--help')){console.log(help);return;}
 const value=options(process.argv.slice(2)),image=JSON.parse(command(['image','inspect',value.image],10000))[0];
 if(image.Os!=='linux'||image.Architecture!=='arm64')throw new Error('Replay requires a local Linux arm64 image');
 const sourceFiles=manifest(value.source,['package.json','package-lock.json','packages/shared/package.json','packages/shared/dist','packages/agent/package.json','packages/agent/dist','packages/agent/skills','packages/diagnostics/package.json','packages/diagnostics/dist','apps/server/package.json','apps/server/dist']);
 const releaseFiles=manifest(value['plugin-source'],['plugins/extension-benchmark/final-pack']);
 const replayFiles=manifest(fixture,['ingress-prefix-driver.mjs','ingress-prefix-release.mjs','ingress-prefix-input.json']);
 mkdirSync(value.output,{mode:0o700});
 const save=(name,data)=>writeFileSync(join(value.output,name),JSON.stringify(data,null,2)+'\n',{mode:0o600});
 save('source-manifest.json',{git:gitIdentity(value.source),files:sourceFiles});save('release-manifest.json',releaseFiles);save('replay-manifest.json',replayFiles);
 const name='mote-ingress-prefix-'+randomUUID(),run=value.storage==='linux'?'/tmp/mote-ingress-prefix':'/evidence/host-bind-run';
 const args=['create','--pull=never','--name',name,'--label','mote.ingress-prefix-replay='+name,'--network','none','--cpus','3','--memory','5g','--pids-limit','256','--entrypoint','/bin/sh'];
 const mounts=[[fixture,'/replay',true],[value['runtime-dir'],'/runtime',true],...runtimeResources.map(path=>[join(value.source,path),'/app/'+path,true]),[join(value['plugin-source'],'plugins/extension-benchmark/final-pack'),'/app/plugins/extension-benchmark/final-pack',true],[value.output,'/evidence',false]];
 for(const [source,target,readonly]of mounts)args.push('--mount',`type=bind,source=${source},target=${target}${readonly?',readonly':''}`);
 args.push(image.Id,'-c','sleep 150');
 save('launch.json',{startedAt:new Date().toISOString(),hostPlatform:process.platform,hostNode:process.version,imageId:image.Id,storage:value.storage,run,argv:['docker',...args],limits:{cpus:3,memory:'5g',pids:256,hardTimeoutMs:150000},runtimeNodeSha256:hash(join(value['runtime-dir'],'bin/node'))});
 let created=false,failure,execution,cleanup={};
 try{
  created=true;command(args,10000);command(['start',name],10000);
  const actualMounts=JSON.parse(command(['inspect',name],10000))[0].Mounts;
  save('mounts.json',actualMounts);assert.equal(actualMounts.filter(mount=>mount.Type==='bind').length,mounts.length);
  for(const [source,target,readonly]of mounts){const mount=actualMounts.find(mount=>mount.Destination===target);assert.ok(mount,'Missing runtime mount');assert.equal(mount.Type,'bind');assert.equal(mount.Source,realpathSync(source));assert.equal(mount.RW,!readonly);}
  for(const mount of actualMounts){
   if(mount.Type!=='bind'){assert.equal(mount.Type,'volume');assert.ok(Object.hasOwn(image.Config.Volumes??{},mount.Destination),'Undeclared image volume');assert.ok(!mounts.some(([,target])=>inside(mount.Destination,target)),'Image volume shadows a replay resource');}
   for(const root of ['/app/node_modules','/app/apps/server/node_modules','/app/packages/agent/node_modules'])assert.ok(!inside(mount.Destination,root),'Mount shadows image dependencies');
  }
  const probe=()=>JSON.parse(command(['exec','--workdir','/app/apps/server',name,'/runtime/bin/node','--input-type=module','--eval',dependencyProbe],10000));
  const before=probe();save('dependencies-before.json',before);
  for(const entry of before.entries)for(const condition of ['require','import']){
   const path=entry[condition].realpath;assert.ok(['/app/node_modules','/app/apps/server/node_modules'].some(root=>inside(root,path)),'Third-party dependency must resolve from image: '+entry.name);
   assert.ok(!actualMounts.some(mount=>inside(mount.Destination,path)),'Dependency was shadowed by a host mount: '+entry.name);
  }
  execution=spawnSync('docker',['exec',name,'/runtime/bin/node','/replay/ingress-prefix-driver.mjs',run,value.label],{encoding:'utf8',timeout:150000,maxBuffer:8*1024*1024});
  // The driver prints only its token-free result, never HTTP request bodies.
  writeFileSync(join(value.output,'driver.stdout'),execution.stdout??'',{mode:0o600});writeFileSync(join(value.output,'driver.stderr'),execution.stderr??'',{mode:0o600});
  const after=probe();save('dependencies-after.json',after);assert.deepEqual(after,before,'Image dependency entries changed during replay');
  assert.deepEqual(manifest(value.source,['package.json','package-lock.json','packages/shared/package.json','packages/shared/dist','packages/agent/package.json','packages/agent/dist','packages/agent/skills','packages/diagnostics/package.json','packages/diagnostics/dist','apps/server/package.json','apps/server/dist']),sourceFiles,'Mac runtime resources changed during replay');
  if(execution.error)failure=execution.error;
  else if(execution.status!==0)failure=new Error('Replay driver exited '+execution.status);
 }catch(error){failure=error;}
 finally{
  if(created){
   let owned=false,anonymousVolumes=[];
   try{const container=JSON.parse(command(['inspect',name],10000))[0];owned=container.Config.Labels?.['mote.ingress-prefix-replay']===name;cleanup.beforeRemoval=container.State;anonymousVolumes=container.Mounts.filter(mount=>mount.Type==='volume').map(mount=>mount.Name);}catch(error){cleanup.inspect={error:error.message};}
   if(owned){
    try{command(['cp',name+':'+run,join(value.output,'run')],10000);cleanup.copy='complete';}catch(error){cleanup.copy={error:error.message};}
    try{command(['rm','--force','--volumes',name],10000);cleanup.removed=true;const remaining=command(['volume','ls','--format','{{.Name}}'],10000).trim().split('\n');cleanup.anonymousVolumes=anonymousVolumes;cleanup.remainingOwnedVolumes=anonymousVolumes.filter(volume=>remaining.includes(volume));cleanup.volumesRemoved=cleanup.remainingOwnedVolumes.length===0;}catch(error){cleanup.removed=false;cleanup.error=error.message;}
   }else cleanup.removed=false;
  }
  save('cleanup.json',cleanup);
 }
 let result;try{result=JSON.parse(readFileSync(join(value.output,'run/result.json'),'utf8'));}catch{}
 console.log(JSON.stringify({output:value.output,status:result?.status??'HARNESS_ERROR',error:failure?.message,cleanup:{copy:cleanup.copy,removed:cleanup.removed,volumesRemoved:cleanup.volumesRemoved}}));
 if(failure||!result||result.status!=='PREFIX_COMPLETED_NO_REPRODUCTION'||cleanup.copy!=='complete'||!cleanup.removed||!cleanup.volumesRemoved)process.exitCode=1;
}
try{main();}catch(error){console.error(error.message);process.exitCode=1;}
