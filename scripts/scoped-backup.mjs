import {DatabaseSync,backup} from 'node:sqlite';
import {scopedBackupSchema} from './scoped-backup-schema.mjs';
import {constants,createWriteStream} from 'node:fs';
import {open,lstat,realpath,mkdir,mkdtemp,readdir,readFile,writeFile,copyFile,chmod,rm,rename,rmdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {pipeline} from 'node:stream/promises';
import {join,resolve,relative,dirname,basename,isAbsolute,sep} from 'node:path';
import {tmpdir} from 'node:os';
import {snapshotHindsight,restoreHindsight,discardRestoredHindsight} from './hindsight-backup.mjs';
import {parseConfigDocument,serializeConfigDocument} from '../packages/shared/src/config-file.ts';

const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
const identity=value=>digest(JSON.stringify(value));
const has=(db,name)=>Boolean(db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(name));
const roots=new Set(['configuration','originals','plugins','connectors']);
const excluded=new Set(['server.pid','logs','media-models','tmp','blobs']);
const safe=name=>typeof name==='string'&&name.length<4096&&!/[\\\x00-\x1f:]/.test(name)&&!isAbsolute(name)&&name.split('/').every(part=>part&&part!=='.'&&part!=='..');
const signature=stat=>[stat.dev,stat.ino,stat.size,stat.mtimeMs,stat.ctimeMs].join(':');
const inside=(root,path)=>{const part=relative(root,path);return part===''||part!=='..'&&!part.startsWith('..'+sep)&&!isAbsolute(part);};
const present=async path=>{try{return await lstat(path);}catch(error){if(error.code==='ENOENT')return;throw error;}};
async function ordinary(path,directory=false){const stat=await lstat(path);if(stat.isSymbolicLink()||!(directory?stat.isDirectory():stat.isFile())||!directory&&stat.nlink!==1||await realpath(path)!==resolve(path))throw Error('Backup links and special files are not allowed');return stat;}
async function file(path,work){const before=await ordinary(path),fd=await open(path,constants.O_RDONLY|constants.O_NOFOLLOW|constants.O_NONBLOCK);try{const opened=await fd.stat();if(signature(before)!==signature(opened))throw Error('Backup source changed');const result=await work(fd);if(signature(opened)!==signature(await fd.stat())||signature(opened)!==signature(await lstat(path)))throw Error('Backup source changed');return result;}finally{await fd.close();}}
async function sha(path){return file(path,async fd=>{const hash=createHash('sha256');for await(const part of fd.createReadStream({autoClose:false}))hash.update(part);return hash.digest('hex');});}
async function copy(source,target){await mkdir(dirname(target),{recursive:true,mode:0o700});await file(source,async fd=>{await pipeline(fd.createReadStream({autoClose:false}),createWriteStream(target,{flags:'wx',mode:0o600}));});const fd=await open(target,'r');try{await fd.sync();}finally{await fd.close();}}
async function canonicalParent(path){try{return await realpath(path);}catch(error){if(error.code!=='ENOENT')throw error;if(await present(path))throw Error('Backup parent links must resolve');return join(await canonicalParent(dirname(path)),basename(path));}}
export async function assertScopedStopped(directory){
 const path=join(directory,'server.pid');if(!await present(path))return;await ordinary(path);const pid=Number((await readFile(path,'utf8')).trim());if(!Number.isSafeInteger(pid)||pid<1)throw Error('Invalid vault server.pid');try{process.kill(pid,0);throw Error('Stop the central node before backup or restore');}catch(error){if(error.code!=='ESRCH')throw error;}
}
async function stoppedLock(path){await ordinary(path);const value=JSON.parse(await readFile(path,'utf8'));if(!Number.isSafeInteger(value.pid)||value.pid<1)throw Error('Invalid provider lock');try{process.kill(value.pid,0);throw Error('Stop the provider before backup');}catch(error){if(error.code!=='ESRCH')throw error;}}

/** SQLite opens a disposable copy, so even WAL admission cannot create source
 * sidecars. The existing SQLite backup API retains all committed WAL pages. */
async function withDatabase(path,work){const scratch=await mkdtemp(join(tmpdir(),'mote-instance-sql-'));let db;try{for(const suffix of ['','-wal','-shm','-journal'])if(await present(path+suffix))await copy(path+suffix,join(scratch,'snapshot.sqlite'+suffix));db=new DatabaseSync(join(scratch,'snapshot.sqlite'));return await work(db);}finally{db?.close();await rm(scratch,{recursive:true,force:true});}}
function metadata(db){
 if(!has(db,'scope_meta'))return;
 const row=db.prepare('SELECT epoch,format,deployment_id FROM scope_meta WHERE singleton=1').get();
 if(!row||row.epoch!==5||row.format!=='mote-private-users-v1'||!/^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,159}$/.test(row.deployment_id)||db.prepare('PRAGMA user_version').get().user_version!==5)throw Error('Unsupported backup storage epoch');
 return {deploymentId:row.deployment_id};
}
function validateDatabase(db){const meta=metadata(db);if(!meta)throw Error('Unsupported backup storage epoch');if(db.prepare('PRAGMA quick_check').get().quick_check!=='ok'||db.prepare('PRAGMA foreign_key_check').all().length)throw Error('Incomplete or corrupt instance database');for(const [name,required] of Object.entries(scopedBackupSchema)){if(!has(db,name))throw Error('Incomplete instance domain database');const columns=new Set(db.prepare('PRAGMA table_info('+JSON.stringify(name)+')').all().map(column=>column.name));if(required.some(column=>!columns.has(column)))throw Error('Incomplete instance domain database');}validateOwners(db);validateCaptureUpdates(db);return meta;}
// This journal's high-water counter cannot be inferred from surviving events:
// a deleted highest capture is valid, but a missing/rewound counter is not.
function validateCaptureUpdates(db){
 const max=Number.MAX_SAFE_INTEGER;
 if(db.prepare("SELECT 1 FROM ig_capture_update_sequences WHERE typeof(next)<>'integer' OR next<0 OR next>? LIMIT 1").get(max)||
  db.prepare("SELECT 1 FROM ig_capture_updates u LEFT JOIN ig_capture_update_sequences s ON s.user_id=u.user_id AND s.device_id=u.device_id WHERE typeof(u.sequence)<>'integer' OR u.sequence<1 OR u.sequence>? OR s.next IS NULL OR s.next<u.sequence LIMIT 1").get(max))throw Error('Incomplete or corrupt device update journal');
}
// SQL owner namespaces must be validated before they can select canonical paths.
// Empty owners are reserved by the existing shared execution/operation catalogs.
function validateOwners(db){
 const ownerId=value=>typeof value==='string'&&/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,159}$/.test(value)&&safe(value),accounts=new Set(db.prepare('SELECT user_id FROM auth_accounts').all().map(row=>row.user_id));
 for(const id of accounts)if(!ownerId(id))throw Error('Invalid backup account identity');
 for(const [table,columns] of Object.entries(scopedBackupSchema)){if(!columns.includes('user_id'))continue;for(const {user_id:id} of db.prepare('SELECT DISTINCT user_id FROM '+JSON.stringify(table)).all()){if(id===''&&(table.startsWith('execution_')||table.startsWith('operation_')))continue;if(!ownerId(id)||!accounts.has(id))throw Error('Invalid backup domain owner');}}
}
function memoryBindings(db){
 const values=[],bindings=[];if(has(db,'mm_state'))values.push(...db.prepare('SELECT user_id,binding FROM mm_state').all());if(has(db,'mm_version_bindings'))values.push(...db.prepare('SELECT user_id,binding FROM mm_version_bindings').all());
 for(const row of values){const binding=JSON.parse(row.binding);if(binding.kind==='builtin')continue;if(binding.kind!=='plugin')throw Error('Invalid Memory binding');const snapshot=db.prepare('SELECT user_id,json FROM plugin_user_snapshots WHERE id=?').get(binding.snapshotId);if(!snapshot||snapshot.user_id!==row.user_id)throw Error('Missing fixed Memory provider snapshot');const fixed=JSON.parse(snapshot.json),pkg=db.prepare('SELECT json FROM plugin_packages WHERE id=?').get(fixed.packageId);if(!pkg)throw Error('Missing fixed Memory provider package');const adapter=JSON.parse(pkg.json).hostAdapter;if(!['mote.mem0@1','mote.hindsight@1'].includes(adapter))throw Error('External Memory provider requires a verified native snapshot protocol');
  const namespace={ownerId:row.user_id,instanceId:binding.instanceId,bindingRevision:binding.revision},directory=join('plugins','instances',identity([metadata(db).deploymentId,row.user_id]),identity([fixed.instance.id,fixed.packageId,fixed.instance.configuration]),'memory-'+identity(namespace));bindings.push({...row,namespace,directory,adapter});
 }return [...new Map(bindings.map(value=>[value.directory,value])).values()];
}
async function packageCompleteness(db,root){
 const values=[];for(const table of ['plugin_packages','plugin_retired_packages'])if(has(db,table))for(const row of db.prepare('SELECT json FROM '+table).all())values.push(JSON.parse(row.json));
 if(values.some(pkg=>pkg.view.state==='installed')){const source=new URL('../apps/server/src/plugin-release.ts',import.meta.url),{GitHubPluginReleases}=await present(source)?await (await import('tsx/esm/api')).tsImport(source.href,import.meta.url):await import('../apps/server/dist/plugin-release.js'),releases=new GitHubPluginReleases(join(root,'plugins','packages'));for(const pkg of values)if(pkg.view.state==='installed'&&!pkg.previewId?.startsWith('bundled'))releases.verifyInstalled(join(releases.directory,pkg.view.source.digest),pkg.view.source.digest,pkg.manifest,Boolean(pkg.hostAdapter));}
 for(const row of db.prepare('SELECT user_id,generation,restore_operation FROM user_configuration_state WHERE deleted=0').all()){
  const path=join(root,'configuration','users',row.user_id,'mote.yaml');
  // Reading /usage may create an account state before any ConfigService opens.
  // Its unchanged default is implicit; durable initialization/revision, receipts,
  // credentials or restore provenance require the real canonical YAML file.
  if(!await present(path)&&row.generation===0&&row.restore_operation===null&&['user_model_snapshot_revision','user_model_credential_generations','user_model_snapshots','user_model_usage','user_configuration_restore_journal'].every(table=>!db.prepare('SELECT 1 FROM '+table+' WHERE user_id=? LIMIT 1').get(row.user_id)))continue;
  await ordinary(path);parseConfigDocument(await readFile(path,'utf8'),{});
 }
}
async function providerCompleteness(db,root){
 for(const binding of memoryBindings(db)){
  if(binding.adapter!=='mote.mem0@1')continue;
  const directory=join(root,binding.directory);for(const name of ['operations.db','vectors.db','history.db'])await withDatabase(join(directory,name),native=>{if(native.prepare('PRAGMA quick_check').get().quick_check!=='ok')throw Error('Corrupt native Memory database');});
  const records=db.prepare('SELECT id,version,body_digest FROM mm_version_bindings WHERE user_id=? AND binding=?').all(binding.user_id,binding.binding);
  await withDatabase(join(directory,'operations.db'),journal=>withDatabase(join(directory,'vectors.db'),vectors=>{for(const row of records){const entry=journal.prepare('SELECT * FROM provider_records WHERE namespace=? AND memory_id=? AND version=? AND removed=0').get(JSON.stringify(binding.namespace),row.id,row.version),vector=entry?vectors.prepare('SELECT payload FROM vectors WHERE id=?').get(entry.external_id):undefined;if(!entry||!vector)throw Error('Missing canonical native Memory body');const payload=JSON.parse(vector.payload),record=payload.mote_record;if(!record||identity(record)!==entry.digest||payload.mote_digest!==entry.digest||identity(record.namespace)!==identity(binding.namespace)||record.key.memoryId!==row.id||record.key.version!==row.version||payload.data!==record.memory.title+'\n'+record.memory.statement)throw Error('Native Memory body differs from its fixed journal');const {status,staleReason,updatedAt,...body}=record.memory;if(identity(body)!==row.body_digest)throw Error('Native Memory body differs from its canonical host identity');}}));
 }
}
async function originalCompleteness(db,root,deploymentId,now){
 const rows=db.prepare('SELECT user_id,hash,bytes,parts FROM ig_objects').all();
 for(const row of rows){const refs=db.prepare('SELECT r.id,r.retention,s.expires FROM ig_originals r LEFT JOIN ig_snapshot_inputs s ON s.user_id=r.user_id AND s.original_id=r.id WHERE r.user_id=? AND r.hash=?').all(row.user_id,row.hash);const pinned=db.prepare('SELECT 1 FROM ig_pins WHERE user_id=? AND hash=? AND expires>? LIMIT 1').get(row.user_id,row.hash,now);if(!pinned&&!refs.some(ref=>ref.retention==='archive'||ref.expires===null||Number(ref.expires)>now))continue;if(!/^[a-f0-9]{64}$/.test(row.hash)||!Number.isSafeInteger(row.parts)||row.parts<0||!Number.isSafeInteger(row.bytes)||row.bytes<0)throw Error('Invalid original metadata');const hash=createHash('sha256');let size=0;for(let part=0;part<row.parts;part++){const path=join(root,'originals',identity([deploymentId,row.user_id]),'objects',row.hash,part+'.plain');await file(path,async fd=>{for await(const bytes of fd.createReadStream({autoClose:false})){size+=bytes.length;hash.update(bytes);}});}if(size!==row.bytes||hash.digest('hex')!==row.hash)throw Error('Incomplete or corrupt original bytes');}
}
async function inventory(root){
 const files=[],directories=[],native=[],states=[];
 async function walk(path,name=''){
  const stat=await ordinary(path,true);states.push([name,signature(stat)]);if(name)directories.push(name);
  const names=(await readdir(path)).sort();
  const hindsight=name&&/^plugins\/instances\/[a-f0-9]{64}\/[a-f0-9]{64}\/memory-[a-f0-9]{64}$/.test(name)&&names.includes('runtime')&&names.includes('provider');
  if(hindsight){await ordinary(join(path,'runtime'),true);await ordinary(join(path,'provider'),true);native.push(name);}
  for(const entry of names){const child=name?name+'/'+entry:entry;if(!safe(child))throw Error('Unsafe backup path');if(!name&&(excluded.has(entry)||entry.startsWith('.')&&entry.endsWith('.runtime.json')))continue;if(!name&&!['mote.sqlite','mote.sqlite-wal','mote.sqlite-shm','mote.sqlite-journal','instance.yaml'].includes(entry)&&!roots.has(entry))throw Error('Unknown instance storage path; declare its backup responsibility first');if(hindsight&&['runtime','provider'].includes(entry))continue;
   const target=join(root,child),info=await lstat(target);if(info.isDirectory()&&!info.isSymbolicLink())await walk(target,child);else{await ordinary(target);states.push([child,signature(info)]);if(entry==='provider.lock'||entry==='runtime-host.json'){await stoppedLock(target);continue;}if(/(?:\.db|\.sqlite)-(?:wal|shm|journal)$/.test(entry))continue;files.push(child);}
  }
 }
 await walk(root);return {files,directories,native,fingerprint:identity(states)};
}
export async function isScopedVault(source){return withDatabase(join(resolve(source),'mote.sqlite'),db=>Boolean(metadata(db)));}

export async function backupScopedInstance({source:requestedSource,out:requestedOut,configFile}){
 const source=join(await realpath(dirname(resolve(requestedSource))),basename(resolve(requestedSource)));await ordinary(source,true);await assertScopedStopped(source);
 const out=join(await canonicalParent(dirname(resolve(requestedOut))),basename(resolve(requestedOut)));if(inside(source,out)||inside(out,source))throw Error('Backup destination must be outside the active vault');
 const before=await inventory(source);if(!before.files.includes('instance.yaml')&&!configFile)throw Error('Complete instance backup requires its explicit --config file');
 if(configFile)configFile=await realpath(resolve(configFile));const configurationPath=configFile??join(source,'instance.yaml');await ordinary(configurationPath);const configHash=await sha(configurationPath);parseConfigDocument(await readFile(configurationPath,'utf8'),{});const now=Date.now();
 const meta=await withDatabase(join(source,'mote.sqlite'),async db=>{const value=validateDatabase(db);await packageCompleteness(db,source);await providerCompleteness(db,source);await originalCompleteness(db,source,value.deploymentId,now);return value;});
 await mkdir(dirname(out),{recursive:true,mode:0o700});await mkdir(out,{mode:0o700});
 try{
  const checksums={};for(const name of before.directories)await mkdir(join(out,name),{recursive:true,mode:0o700});
  for(const name of before.files){if(name==='instance.yaml'&&configFile)continue;const target=join(out,name);if(/(?:\.db|\.sqlite)$/.test(name)){await withDatabase(join(source,name),db=>backup(db,target));await chmod(target,0o600);}else await copy(join(source,name),target);checksums[name]=await sha(target);}
  if(configFile){await copy(resolve(configFile),join(out,'instance.yaml'));checksums['instance.yaml']=await sha(join(out,'instance.yaml'));}
  for(const name of before.native){const destination=join(out,name,'hindsight-backup');await snapshotHindsight({runtimeDirectory:join(source,name,'runtime'),providerDirectory:join(source,name,'provider'),destination});for(const filename of await readdir(destination)){const entry=name+'/hindsight-backup/'+filename;checksums[entry]=await sha(join(out,entry));}}
  await assertScopedStopped(source);if((await inventory(source)).fingerprint!==before.fingerprint||await sha(configurationPath)!==configHash)throw Error('Instance changed while backing up; no complete backup was published');
  const actual=await backupInventory(out),manifest={version:2,kind:'mote-instance-backup',storageEpoch:5,deploymentId:meta.deploymentId,createdAt:new Date(now).toISOString(),directories:actual.directories,checksums,coverage:{canonicalDatabase:true,identities:true,originals:true,configuration:true,plugins:true,providerNative:true,privateKeyMaterial:true,excluded:['server-pid','provider-locks','logs','downloaded-model-weights']},restore:{identity:'preserved',executionAuthority:'revoked',automaticWork:false},native:before.native};
  await writeFile(join(out,'backup-manifest.json'),JSON.stringify(manifest,null,2),{flag:'wx',mode:0o600});const fd=await open(out,'r');try{await fd.sync();}finally{await fd.close();}return {directory:out,manifest};
 }catch(error){await rm(out,{recursive:true,force:true});throw error;}
}
async function backupInventory(root){const files=[],directories=[];async function walk(path,name=''){await ordinary(path,true);for(const entry of (await readdir(path)).sort()){const child=name?name+'/'+entry:entry;if(!safe(child))throw Error('Unsafe backup manifest entry');const stat=await lstat(join(root,child));if(stat.isDirectory()&&!stat.isSymbolicLink()){directories.push(child);await walk(join(root,child),child);}else{await ordinary(join(root,child));if(child!=='backup-manifest.json')files.push(child);}}}await walk(root);return {files,directories};}
export async function verifiedScopedBackup(requested){
 const directory=join(await realpath(dirname(resolve(requested))),basename(resolve(requested)));await ordinary(directory,true);const path=join(directory,'backup-manifest.json');if((await ordinary(path)).size>16*1024*1024)throw Error('Backup manifest exceeds 16 MiB');const manifest=JSON.parse(await readFile(path,'utf8'));
 if(manifest.version!==2||manifest.kind!=='mote-instance-backup'||manifest.storageEpoch!==5||typeof manifest.deploymentId!=='string'||!Number.isFinite(Date.parse(manifest.createdAt))||!manifest.checksums||!Object.hasOwn(manifest.checksums,'mote.sqlite')||!Object.hasOwn(manifest.checksums,'instance.yaml')||!Array.isArray(manifest.directories)||!Array.isArray(manifest.native)||manifest.restore?.identity!=='preserved'||manifest.restore?.executionAuthority!=='revoked'||manifest.restore?.automaticWork!==false)throw Error('Invalid instance backup manifest');
 const names=Object.keys(manifest.checksums);for(const name of [...names,...manifest.directories,...manifest.native])if(!safe(name))throw Error('Unsafe backup manifest entry');if(new Set(manifest.directories).size!==manifest.directories.length||new Set(manifest.native).size!==manifest.native.length)throw Error('Duplicate backup manifest entry');
 const actual=await backupInventory(directory);if(JSON.stringify(actual.files.sort())!==JSON.stringify(names.sort())||JSON.stringify(actual.directories.sort())!==JSON.stringify([...manifest.directories].sort()))throw Error('Incomplete or unexpected backup entries');
 for(const name of names)if(!/^[a-f0-9]{64}$/.test(manifest.checksums[name])||await sha(join(directory,name))!==manifest.checksums[name])throw Error('Backup checksum mismatch; destination was not changed');
 parseConfigDocument(await readFile(join(directory,'instance.yaml'),'utf8'),{});
 await withDatabase(join(directory,'mote.sqlite'),async db=>{const meta=validateDatabase(db);if(meta.deploymentId!==manifest.deploymentId)throw Error('Backup deployment identity mismatch');await packageCompleteness(db,directory);const native=memoryBindings(db).filter(binding=>binding.adapter==='mote.hindsight@1').map(binding=>binding.directory.split(sep).join('/'));if(JSON.stringify([...new Set(native)].sort())!==JSON.stringify([...manifest.native].sort()))throw Error('Incomplete native Memory snapshot');await providerCompleteness(db,directory);await originalCompleteness(db,directory,meta.deploymentId,Math.min(Date.parse(manifest.createdAt),Date.now()));});
 return {directory,names,checksums:manifest.checksums,manifest};
}

/** Stage everything before the existing empty-target rename. No runtime or
 * provider is started. Identity and canonical history survive; old execution
 * authority is explicitly revoked before the target can be opened. */
export async function stageScopedRestore(checked,stage,target){
 stage=await realpath(stage);await ordinary(stage,true);
 const rechecked=await verifiedScopedBackup(checked.directory);if(identity(rechecked.manifest)!==identity(checked.manifest))throw Error('Backup changed before restoration');
 for(const name of checked.manifest.directories)await mkdir(join(stage,name),{recursive:true,mode:0o700});for(const name of checked.names){await copy(join(checked.directory,name),join(stage,name));if(await sha(join(stage,name))!==checked.checksums[name])throw Error('Backup changed while restoring');}
 if(target){const path=join(stage,'instance.yaml'),{savedDocument}=parseConfigDocument(await readFile(path,'utf8'),{});savedDocument.actions={...savedDocument.actions,enabled:false};savedDocument.storage={...savedDocument.storage,dataDir:target,...(target!=='/data'?{kind:'local-directory',source:target,mount:''}:{})};savedDocument.diagnostics={...savedDocument.diagnostics,directory:join(target,'logs')};await writeFile(path,serializeConfigDocument(savedDocument),{mode:0o600});}
 // Retain canonical configuration and secret references, but retire admitted
 // background/extension permission in both its YAML source and SQL mirrors.
 for(const name of checked.names.filter(name=>/^configuration\/users\/[^/]+\/mote.yaml$/.test(name))){const path=join(stage,name),{savedDocument}=parseConfigDocument(await readFile(path,'utf8'),{});if(savedDocument.pluginInstances?.instances)savedDocument.pluginInstances.instances=savedDocument.pluginInstances.instances.map(instance=>({...instance,desired:false,revocation:'restored',grants:{capabilities:[],sourceIds:[],history:false}}));if(savedDocument.processing)savedDocument.processing.automatic=false;if(savedDocument.memory)savedDocument.memory.automatic=false;if(savedDocument.actions)savedDocument.actions.enabled=false;if(savedDocument.mcpConnections?.connections)savedDocument.mcpConnections.connections=savedDocument.mcpConnections.connections.map(connection=>({...connection,enabled:false}));savedDocument.revision++;await writeFile(path,serializeConfigDocument(savedDocument),{mode:0o600});}
 const db=new DatabaseSync(join(stage,'mote.sqlite'));try{db.exec('PRAGMA foreign_keys=ON; BEGIN IMMEDIATE');const now=Date.now();db.prepare('UPDATE auth_credentials SET revoked_at=? WHERE revoked_at IS NULL').run(now);db.exec('UPDATE auth_accounts SET authorization_epoch=authorization_epoch+1; UPDATE task_authorizations SET revoked=1;');
  if(has(db,'execution_steps'))db.exec("UPDATE execution_steps SET lease_until=0,fence=NULL,state=CASE WHEN state IN ('waiting','running') THEN 'blocked' ELSE state END,error=CASE WHEN state IN ('waiting','running') THEN 'restore_authorization_required' ELSE error END");
  if(has(db,'plugin_user_snapshots'))db.exec('UPDATE plugin_user_snapshots SET released=1');if(has(db,'plugin_user_instances'))for(const row of db.prepare('SELECT user_id,id,json FROM plugin_user_instances').all()){const instance=JSON.parse(row.json);db.prepare('UPDATE plugin_user_instances SET generation=generation+1,verified_hash=NULL,json=? WHERE user_id=? AND id=?').run(JSON.stringify({...instance,desired:false,revocation:'restored',grants:{capabilities:[],sourceIds:[],history:false}}),row.user_id,row.id);}
  if(has(db,'mm_state'))db.exec("UPDATE mm_state SET desired=0,generation=generation+1,settings=json_set(settings,'$.automatic',json('false'))");if(has(db,'mp_state'))db.exec("UPDATE mp_state SET generation=generation+1,settings=json_set(settings,'$.automatic',json('false'))");
  if(has(db,'ac_state'))db.exec("UPDATE ac_state SET generation=generation+1,authorization_revision=authorization_revision+1,settings=json_set(settings,'$.enabled',json('false')),review_devices='[]',policy_id=NULL,policy_task=NULL; DELETE FROM ac_targets; UPDATE ac_operations SET revoked=1");
  if(has(db,'connector_connections'))db.exec('UPDATE connector_connections SET sync_authorized=0');if(has(db,'ma_automations'))db.exec("UPDATE ma_automations SET state='paused' WHERE state='active'");
  if(has(db,'lifecycle_operations'))db.exec("UPDATE lifecycle_operations SET state='failed',error='restore_authorization_required' WHERE kind='export' AND state='working'");
  db.exec('COMMIT');if(db.prepare('PRAGMA foreign_key_check').all().length)throw Error('Restored instance consistency failed');
 }catch(error){if(db.isTransaction)db.exec('ROLLBACK');throw error;}finally{db.close();}
 const nativeVolumes=[];try{for(const name of checked.manifest.native){if(!/^plugins\/instances\/[a-f0-9]{64}\/[a-f0-9]{64}\/memory-[a-f0-9]{64}$/.test(name))throw Error('Unsafe native backup path');const result=await restoreHindsight({archiveDirectory:join(stage,name,'hindsight-backup'),runtimeDirectory:join(stage,name,'runtime'),providerDirectory:join(stage,name,'provider')});nativeVolumes.push(result.volume);await rm(join(stage,name,'hindsight-backup'),{recursive:true});}return nativeVolumes;}catch(error){for(const volume of nativeVolumes)await discardRestoredHindsight(volume).catch(()=>{});await rm(stage,{recursive:true,force:true});throw error;}
}

export async function restoreScopedInstance({from,target:requestedTarget,deploymentId}){
 const checked=await verifiedScopedBackup(from);if(deploymentId&&deploymentId!==checked.manifest.deploymentId)throw Error('Backup deployment identity mismatch');const target=join(await canonicalParent(dirname(resolve(requestedTarget))),basename(resolve(requestedTarget)));if(inside(checked.directory,target)||inside(target,checked.directory))throw Error('Restore destination overlaps backup');await assertScopedStopped(target);const existing=await present(target);if(existing){await ordinary(target,true);if((await readdir(target)).length)throw Error('Restore requires an empty data directory; existing data is never overwritten');}
 await mkdir(dirname(target),{recursive:true,mode:0o700});const stage=await mkdtemp(join(dirname(target),'.mote-restore-'));let nativeVolumes=[],published=false;try{nativeVolumes=await stageScopedRestore(checked,stage,target);if(await present(target)){await ordinary(target,true);if((await readdir(target)).length)throw Error('Restore requires an empty data directory');await rmdir(target);}await rename(stage,target);published=true;return {restored:true,deploymentId:checked.manifest.deploymentId,directory:target,configurationFile:join(target,'instance.yaml')};}finally{if(!published)for(const volume of nativeVolumes)await discardRestoredHindsight(volume).catch(()=>{});await rm(stage,{recursive:true,force:true});}
}
