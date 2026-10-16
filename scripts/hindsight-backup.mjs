import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {createHash,randomUUID} from 'node:crypto';
import {createReadStream} from 'node:fs';
import {mkdir,lstat,realpath,readFile,writeFile,copyFile,readdir,chmod} from 'node:fs/promises';
import {resolve,join} from 'node:path';

export const HINDSIGHT_BACKUP_IMAGE='ghcr.io/vectorize-io/hindsight@sha256:d1840062a5b79940ab7a9f4809ceb90fc776d4ad737cd9329e9b5836cc64ab70';
const run=promisify(execFile);
const docker=async args=>{try{return (await run('docker',args[0]==='run'&&!args.includes('--pull')?['run','--pull','never',...args.slice(1)]:args,{maxBuffer:1024*1024})).stdout.trim();}catch{throw Error('The owned Hindsight Docker snapshot operation failed; existing data was preserved');}};
const fingerprint=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const sha=async path=>{const hash=createHash('sha256');for await(const chunk of createReadStream(path))hash.update(chunk);return hash.digest('hex');};
async function containsCredentials(path,tokens){const values=tokens.filter(value=>typeof value==='string'&&value.length>=32).map(value=>Buffer.from(value));const overlap=Math.max(0,...values.map(value=>value.length-1));let prior=Buffer.alloc(0);for await(const chunk of createReadStream(path)){const data=Buffer.concat([prior,chunk]);if(values.some(value=>data.includes(value)))return true;prior=data.subarray(Math.max(0,data.length-overlap));}return false;}
const ordinary=async(path,directory=false)=>{const stat=await lstat(path);if(!(directory?stat.isDirectory():stat.isFile())||!directory&&stat.nlink!==1||await realpath(path)!==resolve(path))throw Error('Hindsight backup links and special files are not allowed');};
function descriptor(value){if(!value||value.version!==1||value.image!==HINDSIGHT_BACKUP_IMAGE||!/^[a-f0-9]{24}$/.test(value.identity)||!/^[a-f0-9]{64}$/.test(value.modelFingerprint)||!/^[a-f0-9]{64}$/.test(value.instanceFingerprint)||Object.keys(value).sort().join(',')!=='identity,image,instanceFingerprint,modelFingerprint,version')throw Error('Invalid fixed Hindsight runtime descriptor');return value;}

/** File-only admission is shared with whole-instance verification, before any
 * target directory, volume or provider is created. Native bytes are mandatory. */
export async function verifiedHindsightBackup(archiveDirectory){
 archiveDirectory=resolve(archiveDirectory);await ordinary(archiveDirectory,true);
 const names=['manifest.json','volume.tar','provider-control.json','runtime-descriptor.json','canonical-records.json'];
 if(JSON.stringify((await readdir(archiveDirectory)).sort())!==JSON.stringify([...names].sort()))throw Error('Incomplete or unexpected Hindsight native backup entries');
 for(const name of names)await ordinary(join(archiveDirectory,name));
 const manifest=JSON.parse(await readFile(join(archiveDirectory,'manifest.json'),'utf8')),runtime=descriptor(manifest.runtime);
 if(manifest.version!==1||manifest.provider!=='mote.hindsight'||manifest.providerVersion!=='0.10.2'||manifest.credentialsIncluded!==false||manifest.restoreAutomaticWork!==false||!Number.isFinite(Date.parse(manifest.createdAt))||Object.keys(manifest.checksums??{}).sort().join(',')!==names.filter(name=>name!=='manifest.json').sort().join(','))throw Error('Invalid Hindsight native backup manifest');
 for(const name of names.filter(name=>name!=='manifest.json'))if(!/^[a-f0-9]{64}$/.test(manifest.checksums[name])||await sha(join(archiveDirectory,name))!==manifest.checksums[name])throw Error('Hindsight native snapshot checksum failed');
 if(fingerprint(descriptor(JSON.parse(await readFile(join(archiveDirectory,'runtime-descriptor.json'),'utf8'))))!==fingerprint(runtime))throw Error('Hindsight runtime descriptor differs from its native snapshot');
 const control=JSON.parse(await readFile(join(archiveDirectory,'provider-control.json'),'utf8')),canonical=JSON.parse(await readFile(join(archiveDirectory,'canonical-records.json'),'utf8'));
 if(control.version!==1||!['entries','projections','prepared'].every(key=>Array.isArray(control[key]))||control.operations!==undefined&&!Array.isArray(control.operations)||canonical.version!==1||!Array.isArray(canonical.records))throw Error('Invalid Hindsight native control or canonical records');
 const key=value=>fingerprint([value.namespace,value.key]),entries=new Map(),records=new Map();
 for(const entry of control.entries){if(!entry.namespace||!entry.key||typeof entry.bank!=='string'||!/^[a-f0-9]{64}$/.test(entry.digest)||!['intent','applied','removed'].includes(entry.state)||entries.has(key(entry)))throw Error('Invalid Hindsight native entry');entries.set(key(entry),entry);}
 for(const record of canonical.records){const entry=entries.get(key(record));if(!entry||entry.state!=='applied'||fingerprint(record)!==entry.digest||records.has(key(record)))throw Error('Hindsight canonical body differs from its native receipt');records.set(key(record),record);}
 if([...entries.values()].filter(entry=>entry.state==='applied').length!==records.size)throw Error('Missing Hindsight canonical native body');
 return {manifest,runtime,control,records:canonical.records};
}

/** Requires an already stopped Central and its owned native service. No model,
 * API or worker is started. Credentials are excluded; native canonical bodies,
 * old revisions, staging work, graphs, operations and usage history are copied
 * consistently from the cleanly stopped PostgreSQL volume. */
export async function snapshotHindsight({runtimeDirectory,providerDirectory,destination}){
 runtimeDirectory=resolve(runtimeDirectory);providerDirectory=resolve(providerDirectory);destination=resolve(destination);
 await ordinary(runtimeDirectory,true);await ordinary(providerDirectory,true);
 await ordinary(join(runtimeDirectory,'runtime-descriptor.json'));await ordinary(join(providerDirectory,'provider-control.json'));
 const runtime=descriptor(JSON.parse(await readFile(join(runtimeDirectory,'runtime-descriptor.json'),'utf8'))),container='mote-hindsight-'+runtime.identity,volume=container+'-data';
 const owners=(await docker(['ps','--all','--filter','volume='+volume,'--format','{{.Names}}'])).split(/\s+/).filter(Boolean);
 if(owners.some(name=>name!==container))throw Error('Hindsight native volume has an unexpected container owner');
 const containers=(await docker(['ps','--all','--filter','name=^'+container+'$','--format','{{.Names}}'])).split(/\s+/).filter(Boolean);
 if(containers.includes(container)){
  const inspection=JSON.parse(await docker(['inspect',container]))[0];
  if(inspection.Config?.Labels?.['mote.runtime.identity']!==runtime.identity||inspection.Config?.Image!==runtime.image||!inspection.Mounts?.some(mount=>mount.Type==='volume'&&mount.Name===volume&&mount.Destination==='/home/hindsight/.pg0'))throw Error('Hindsight native snapshot ownership or fixed image does not match');
  if(inspection.State?.Running||inspection.State?.Paused)throw Error('Stop Central and its owned Hindsight service before taking a complete backup');
  if(inspection.State?.OOMKilled||inspection.State?.ExitCode!==0)throw Error('Hindsight did not shut down cleanly; recover and stop it before taking a consistent backup');
 }else{
  // A fresh stopped restore deliberately has no API container or credentials.
  // Only its explicitly owned fresh volume can take this no-container path.
  const inspection=JSON.parse(await docker(['volume','inspect',volume]))[0];
  if(inspection.Name!==volume||inspection.Labels?.['mote.runtime.identity']!==runtime.identity||owners.length)throw Error('Hindsight restored native volume ownership does not match');
 }
 await mkdir(destination,{recursive:true,mode:0o700});await ordinary(destination,true);
 if((await readdir(destination)).length)throw Error('Hindsight snapshot destination must be empty');
 // The official image supplies tar; overriding the entrypoint and disabling
 // networking cannot execute the engine, install scripts, or make model calls.
 await docker(['run','--rm','--network','none','--read-only','--user','0','--volume',volume+':/source:ro','--volume',destination+':/backup','--entrypoint','tar',runtime.image,'-cpf','/backup/volume.tar','-C','/source','.']);
 await chmod(join(destination,'volume.tar'),0o600);
 let tokens=[];
 try{const path=join(runtimeDirectory,'runtime-credentials.json');await ordinary(path);const credentials=JSON.parse(await readFile(path,'utf8'));if(Object.keys(credentials).sort().join(',')!=='apiToken,port,token'||typeof credentials.token!=='string'||credentials.token.length<32||typeof credentials.apiToken!=='string'||credentials.apiToken.length<32||!Number.isSafeInteger(credentials.port)||credentials.port<1)throw Error('Invalid private runtime credentials');tokens=[credentials.token,credentials.apiToken];}catch(error){if(error.code!=='ENOENT')throw error;}
 // A fresh stopped restore deliberately has no runtime credentials. It can
 // be backed up before any API or model starts; scan known transient values
 // only when the original runtime supplied them, never generate credentials.
 if(await containsCredentials(join(destination,'volume.tar'),tokens))throw Error('Transient Hindsight endpoint credentials are present in the native volume; snapshot requires credential-safe recovery');
 await copyFile(join(providerDirectory,'provider-control.json'),join(destination,'provider-control.json'));
 await writeFile(join(destination,'runtime-descriptor.json'),JSON.stringify(runtime),{mode:0o600,flag:'wx'});
 // Read canonical bodies from a disposable clone of the stopped snapshot,
 // never from Central SQL and never by starting the Hindsight API/model. The
 // source volume stays untouched; the clone is removed even after failure.
 const probeVolume='mote-hindsight-backup-read-'+randomUUID();await docker(['volume','create',probeVolume]);
 try{
   await docker(['run','--rm','--network','none','--read-only','--user','0','--volume',probeVolume+':/target','--volume',destination+':/backup:ro','--entrypoint','tar',runtime.image,'-xpf','/backup/volume.tar','-C','/target']);
   const script=`import asyncio,asyncpg,json,hashlib,pathlib\nfrom hindsight_api.pg0 import EmbeddedPostgres\nasync def main():\n pg=EmbeddedPostgres();uri=await pg.ensure_running();conn=await asyncpg.connect(uri);control=json.loads(pathlib.Path('/backup/provider-control.json').read_text());records=[]\n try:\n  for entry in control['entries']:\n   if entry['state']!='applied':continue\n   rows=await conn.fetch('SELECT text,metadata FROM public.memory_units WHERE bank_id=$1',entry['bank'])\n   if len(rows)!=1:raise RuntimeError('Canonical native body is missing or duplicated')\n   metadata=rows[0]['metadata'];metadata=json.loads(metadata) if isinstance(metadata,str) else metadata;raw=metadata['mote_record'];record=json.loads(raw)\n   if hashlib.sha256(raw.encode()).hexdigest()!=entry['digest'] or metadata['mote_digest']!=entry['digest'] or record['namespace']!=entry['namespace'] or record['key']!=entry['key'] or record['memory']['statement']!=rows[0]['text']:raise RuntimeError('Canonical native body digest does not match its host receipt')\n   records.append(raw)\n  pathlib.Path('/backup/canonical-records.json').write_text('{"version":1,"records":['+','.join(records)+']}')\n finally:\n  await conn.close();await pg.stop()\nasyncio.run(main())`;
   await docker(['run','--rm','--network','none','--volume',probeVolume+':/home/hindsight/.pg0','--volume',destination+':/backup','--entrypoint','python3',runtime.image,'-c',script]);
   await chmod(join(destination,'canonical-records.json'),0o600);
 }finally{await docker(['volume','rm',probeVolume]).catch(()=>{});}
 const checksums=Object.fromEntries(await Promise.all(['volume.tar','provider-control.json','runtime-descriptor.json','canonical-records.json'].map(async name=>[name,await sha(join(destination,name))])));
 const manifest={version:1,provider:'mote.hindsight',providerVersion:'0.10.2',runtime,checksums,createdAt:new Date().toISOString(),credentialsIncluded:false,restoreAutomaticWork:false};
 await writeFile(join(destination,'manifest.json'),JSON.stringify(manifest,null,2),{mode:0o600,flag:'wx'});return manifest;
}

/** Restores into a fresh volume and empty directories only. The engine stays
 * stopped, with no relay credentials and no automatic work admission. The host
 * must restore its matching binding/intent graph and approved model profile
 * before creating a service or explicitly resuming authorized old work. */
export async function restoreHindsight({archiveDirectory,runtimeDirectory,providerDirectory,execute=docker}){
 archiveDirectory=resolve(archiveDirectory);runtimeDirectory=resolve(runtimeDirectory);providerDirectory=resolve(providerDirectory);
 const checked=await verifiedHindsightBackup(archiveDirectory),original=checked.runtime;
 const invoke=execute;
 for(const directory of [runtimeDirectory,providerDirectory])try{await ordinary(directory,true);if((await readdir(directory)).length)throw Error('Hindsight restore requires an empty target directory');}catch(error){if(error.code!=='ENOENT')throw error;}
 // Consume and validate the entire tar in a read-only container before creating
 // even the fresh volume. Reject links used as later extraction ancestors.
 const validate=`import tarfile,posixpath\nseen=set();links=set()\nwith tarfile.open('/backup/volume.tar') as archive:\n for member in archive:\n  name=posixpath.normpath(member.name)\n  if member.name.startswith('/') or name=='..' or name.startswith('../') or any(ord(c)<32 or ord(c)==127 for c in member.name):raise RuntimeError('Unsafe native archive path')\n  if name=='.' and member.isdir():continue\n  if name in seen or not (member.isfile() or member.isdir() or member.issym() or member.islnk()):raise RuntimeError('Invalid native archive member')\n  if any(name.startswith(link+'/') for link in links):raise RuntimeError('Native archive traverses a link')\n  tarfile.data_filter(member,'/target')\n  if member.issym() or member.islnk():\n   target=posixpath.normpath(posixpath.join(posixpath.dirname(name) if member.issym() else '',member.linkname))\n   if member.linkname.startswith('/') or target=='..' or target.startswith('../') or any(prior.startswith(name+'/') for prior in seen):raise RuntimeError('Unsafe native archive link')\n   links.add(name)\n  seen.add(name)\n  if member.isfile():\n   stream=archive.extractfile(member)\n   while stream.read(1024*1024):pass`;
 await invoke(['run','--pull','never','--rm','--network','none','--read-only','--volume',archiveDirectory+':/backup:ro','--entrypoint','python3',original.image,'-c',validate]);
 if(fingerprint((await verifiedHindsightBackup(archiveDirectory)).manifest)!==fingerprint(checked.manifest))throw Error('Hindsight backup changed during admission');
 const runtime={...original,identity:createHash('sha256').update(original.identity+randomUUID()).digest('hex').slice(0,24)},volume='mote-hindsight-'+runtime.identity+'-data';
 await invoke(['volume','create','--label','mote.runtime.identity='+runtime.identity,volume]);
 try{
   const ownership=JSON.parse(await invoke(['volume','inspect',volume]))[0];
   if(ownership.Name!==volume||ownership.Labels?.['mote.runtime.identity']!==runtime.identity)throw Error('Fresh Hindsight restore volume ownership does not match');
   // This archive was produced from the owned volume by the same pinned image.
   // List paths before extraction: no traversal or absolute archive entries.
   const names=await invoke(['run','--pull','never','--rm','--network','none','--read-only','--volume',archiveDirectory+':/backup:ro','--entrypoint','tar',runtime.image,'-tf','/backup/volume.tar']);
   if(names.split('\n').some(name=>!name||name.startsWith('/')||name.split('/').some(part=>part==='..')||/[\x00-\x1f\x7f]/.test(name)))throw Error('Unsafe Hindsight volume archive path');
   // PostgreSQL's bundled distribution has relative library symlinks. The
   // data filter rejects devices and escaping links, including traversal
   // through previously extracted symlinks. Ownership and private modes are
   // preserved only after validation, inside a fresh owned Docker volume.
   const extract=`import tarfile\nwith tarfile.open('/backup/volume.tar') as archive:\n def safe(member,path):\n  checked=tarfile.data_filter(member,path)\n  return checked.replace(uid=member.uid,gid=member.gid,uname=member.uname,gname=member.gname,mode=member.mode&0o777) if checked else None\n archive.extractall('/target',filter=safe)`;
   await invoke(['run','--pull','never','--rm','--network','none','--read-only','--user','0','--volume',volume+':/target','--volume',archiveDirectory+':/backup:ro','--entrypoint','python3',runtime.image,'-c',extract]);
   for(const directory of [runtimeDirectory,providerDirectory]){await mkdir(directory,{recursive:true,mode:0o700});await ordinary(directory,true);if((await readdir(directory)).length)throw Error('Hindsight restore target changed');}
   await copyFile(join(archiveDirectory,'provider-control.json'),join(providerDirectory,'provider-control.json'));
   await chmod(join(providerDirectory,'provider-control.json'),0o600);
   await writeFile(join(runtimeDirectory,'runtime-descriptor.json'),JSON.stringify(runtime),{mode:0o600,flag:'wx'});
 }catch(error){try{const ownership=JSON.parse(await invoke(['volume','inspect',volume]))[0];if(ownership.Name===volume&&ownership.Labels?.['mote.runtime.identity']===runtime.identity)await invoke(['volume','rm',volume]);}catch{}throw error;}
 return {runtime,volume,automaticWork:false,credentialsRequired:true};
}

/** Roll back only a fresh volume returned by restoreHindsight, never a source. */
export async function discardRestoredHindsight(volume){
 const match=/^mote-hindsight-([a-f0-9]{24})-data$/.exec(volume);if(!match)throw Error('Invalid restored native volume');
 const inspection=JSON.parse(await docker(['volume','inspect',volume]))[0];if(inspection.Name!==volume||inspection.Labels?.['mote.runtime.identity']!==match[1])throw Error('Restored native volume ownership changed');
 await docker(['volume','rm',volume]);
}
