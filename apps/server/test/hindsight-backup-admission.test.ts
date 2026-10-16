import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm,realpath,readdir} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createHash} from 'node:crypto';
const module=await import(process.env.MOTE_HINDSIGHT_BACKUP_MODULE??'../../../scripts/hindsight-backup.mjs');
const hash=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');

async function fixture(t:any){
 const root=await realpath(await mkdtemp(join(tmpdir(),'mote-hindsight-admission-')));t.after(()=>rm(root,{recursive:true,force:true}));
 const archiveDirectory=join(root,'archive'),runtimeDirectory=join(root,'runtime'),providerDirectory=join(root,'provider');await mkdir(archiveDirectory);
 const runtime={version:1,identity:'a'.repeat(24),image:module.HINDSIGHT_BACKUP_IMAGE,modelFingerprint:'b'.repeat(64),instanceFingerprint:'c'.repeat(64)};
 const record={namespace:{ownerId:'generated-a',instanceId:'generated-instance',bindingRevision:1},key:{memoryId:'generated-memory',version:1},memory:{statement:'Generated original canonical Hindsight body'}};
 const control={version:1,entries:[{namespace:record.namespace,key:record.key,bank:'generated-bank',digest:hash(record),state:'applied'}],operations:[{opId:'generated-unknown',kind:'put',inputDigest:'d'.repeat(64)}],projections:[],prepared:[]};
 await writeFile(join(archiveDirectory,'volume.tar'),Buffer.alloc(1024));await writeFile(join(archiveDirectory,'provider-control.json'),JSON.stringify(control));await writeFile(join(archiveDirectory,'runtime-descriptor.json'),JSON.stringify(runtime));await writeFile(join(archiveDirectory,'canonical-records.json'),JSON.stringify({version:1,records:[record]}));
 const seal=async()=>{const checksums:Record<string,string>={};for(const name of ['volume.tar','provider-control.json','runtime-descriptor.json','canonical-records.json'])checksums[name]=createHash('sha256').update(await readFile(join(archiveDirectory,name))).digest('hex');await writeFile(join(archiveDirectory,'manifest.json'),JSON.stringify({version:1,provider:'mote.hindsight',providerVersion:'0.10.2',runtime,checksums,createdAt:new Date().toISOString(),credentialsIncluded:false,restoreAutomaticWork:false}));};await seal();
 return {root,archiveDirectory,runtimeDirectory,providerDirectory,runtime,record,control,seal};
}

for(const corruption of ['missing-body','changed-body','different-runtime','extra-entry'])test('Hindsight rejects '+corruption+' before Docker or target directory writes',async t=>{
 const f=await fixture(t);let calls=0;
 if(corruption==='missing-body')await writeFile(join(f.archiveDirectory,'canonical-records.json'),JSON.stringify({version:1,records:[]}));
 if(corruption==='changed-body')await writeFile(join(f.archiveDirectory,'canonical-records.json'),JSON.stringify({version:1,records:[{...f.record,memory:{statement:'Generated changed body'}}]}));
 if(corruption==='different-runtime')await writeFile(join(f.archiveDirectory,'runtime-descriptor.json'),JSON.stringify({...f.runtime,identity:'e'.repeat(24)}));
 if(corruption==='extra-entry')await writeFile(join(f.archiveDirectory,'unlisted-data'),'Generated unexpected data');
 await f.seal();
 await assert.rejects(module.restoreHindsight({...f,execute:async()=>{calls++;throw Error('Generated Docker must not run');}}),/canonical|native body|descriptor differs|unexpected/);
 assert.equal(calls,0);assert.deepEqual((await readdir(f.root)).sort(),['archive']);
});

test('Hindsight validates native tar before creating volume, preserving unknown operation receipts',async t=>{
 const f=await fixture(t),calls:string[][]=[];
 await assert.rejects(module.restoreHindsight({...f,execute:async(args:string[])=>{calls.push(args);assert.equal(args[0],'run');assert.equal(args[args.indexOf('--pull')+1],'never');assert.equal(args[args.indexOf('--network')+1],'none');throw Error('Generated unsafe native tar');}}),/unsafe native tar/);
 assert.equal(calls.length,1);assert.deepEqual(JSON.parse(await readFile(join(f.archiveDirectory,'provider-control.json'),'utf8')).operations,f.control.operations);assert.deepEqual(await readdir(f.root),['archive']);
});

test('Hindsight metadata publication rotates runtime identity and retains unknown facts without endpoint credentials',async t=>{
 const f=await fixture(t),calls:string[][]=[],volumes=new Map<string,string>();
 const result=await module.restoreHindsight({...f,execute:async(args:string[])=>{
  calls.push(args);
  if(args[0]==='volume'){
   const volume=args.at(-1)!;
   if(args[1]==='create'){volumes.set(volume,args[args.indexOf('--label')+1].split('=')[1]);return volume;}
   if(args[1]==='inspect')return JSON.stringify([{Name:volume,Labels:{'mote.runtime.identity':volumes.get(volume)}}]);
   throw Error('Unexpected native volume mutation');
  }
  assert.equal(args[0],'run');assert.equal(args[args.indexOf('--pull')+1],'never');assert.equal(args[args.indexOf('--network')+1],'none');
  return args[args.indexOf('--entrypoint')+1]==='tar'?'.':'';
 }});
 assert.notEqual(result.runtime.identity,f.runtime.identity);assert.equal(result.runtime.instanceFingerprint,f.runtime.instanceFingerprint);assert.equal(result.runtime.modelFingerprint,f.runtime.modelFingerprint);assert.equal(result.automaticWork,false);assert.equal(result.credentialsRequired,true);
 assert.deepEqual(JSON.parse(await readFile(join(f.providerDirectory,'provider-control.json'),'utf8')),f.control);
 assert.deepEqual(await readdir(f.runtimeDirectory),['runtime-descriptor.json']);assert.equal(calls[0][0],'run');assert.equal(calls[1][0],'volume');
});

test('simultaneous Hindsight metadata restores cannot overwrite one another after empty-target admission',async t=>{
 const a=await fixture(t),b=await fixture(t),providerDirectory=join(a.root,'shared-provider'),volumes=new Map<string,string>();
 let arrivals=0,release!:()=>void;const together=new Promise<void>(resolve=>{release=resolve;});
 const execute=async(args:string[])=>{
  const volume=args.at(-1)!;
  if(args[0]==='volume'){
   if(args[1]==='create'){volumes.set(volume,args[args.indexOf('--label')+1].split('=')[1]);return volume;}
   if(args[1]==='inspect')return JSON.stringify([{Name:volume,Labels:{'mote.runtime.identity':volumes.get(volume)}}]);
   if(args[1]==='rm'){volumes.delete(volume);return volume;}
  }
  if(args[0]==='run'){
   if(args[args.indexOf('--entrypoint')+1]==='tar')return '.';
   if(args.at(-1)!.includes('archive.extractall')){if(++arrivals===2)release();await together;}
   return '';
  }
  throw Error('Unexpected metadata protocol command');
 };
 const results=await Promise.allSettled([module.restoreHindsight({...a,providerDirectory,execute}),module.restoreHindsight({...b,providerDirectory,execute})]);
 assert.equal(results.filter(result=>result.status==='fulfilled').length,1);assert.equal(volumes.size,1);
 assert.deepEqual(JSON.parse(await readFile(join(providerDirectory,'provider-control.json'),'utf8')),a.control);
});
