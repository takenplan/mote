import {createHash,randomUUID} from 'node:crypto';
import {mkdir,readFile,writeFile,rename,rm,lstat,chmod} from 'node:fs/promises';
import {dirname,join,resolve} from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {cliReleases,cliRuntimeDirectory,managedCliBinary} from '../apps/server/src/connectors/cli-runtime.mjs';

const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
async function regular(path){const stat=await lstat(path);if(!stat.isFile()||stat.nlink!==1)throw Error('Managed connector CLI is not a regular private file');}
async function ready(binary,archiveHash){
 try{await regular(binary);if((await lstat(dirname(binary))).isSymbolicLink())throw Error('Managed connector CLI version directory cannot be a symlink');if(!((await lstat(binary)).mode&0o111))throw Error('Managed connector CLI binary is not executable; run connectors-prepare after restoring its code directory');await regular(binary+'.json');const marker=JSON.parse(await readFile(binary+'.json','utf8'));return marker.archiveSha256===archiveHash&&marker.binarySha256===hash(await readFile(binary));}
 catch(error){if(error.code==='ENOENT')return false;throw error;}
}
async function download(url){
 const response=await fetch(url,{signal:AbortSignal.timeout(300000)});if(!response.ok)throw Error('Managed connector CLI download failed ('+response.status+')');
 const chunks=[];let bytes=0;for await(const chunk of response.body){bytes+=chunk.byteLength;if(bytes>160*1024*1024)throw Error('Managed connector CLI archive is too large');chunks.push(Buffer.from(chunk));}return Buffer.concat(chunks);
}
/** Deployment-only, fixed official archives. No npm lifecycle scripts, skills,
 * global binaries, provider profiles or system Keychain entries are touched. */
export async function prepareConnectorRuntime({directory=cliRuntimeDirectory,platform=process.platform,arch=process.arch,fetchArchive=download,releases=cliReleases}={}){
 const results=[];
 for(const provider of ['lark','dingtalk']){
  const release=releases[provider],asset=release.archives[platform+'-'+arch];if(!asset)throw Error('Managed connector CLI platform is unsupported');
  const [archiveName,archiveHash]=asset,binary=managedCliBinary(provider,directory,platform,arch),destination=dirname(binary);
  try{if((await lstat(directory)).isSymbolicLink())throw Error('Managed connector CLI directory cannot be a symlink');}catch(error){if(error.code!=='ENOENT')throw error;}
  if(await ready(binary,archiveHash)){results.push({provider,version:release.version,prepared:true});continue;}
  try{await lstat(destination);throw Error('Managed connector CLI deployment is incomplete or damaged; remove its versioned code directory and run connectors-prepare again');}catch(error){if(error.code!=='ENOENT')throw error;}
  await mkdir(directory,{recursive:true,mode:0o700});if((await lstat(directory)).isSymbolicLink())throw Error('Managed connector CLI directory cannot be a symlink');
  const stage=join(directory,'.prepare-'+randomUUID()),archive=join(stage,'archive.tar.gz');await mkdir(stage,{mode:0o700});
  try{
   const bytes=await fetchArchive('https://github.com/'+release.repository+'/releases/download/v'+release.version+'/'+archiveName);
   if(hash(bytes)!==archiveHash)throw Error('Managed connector CLI archive checksum mismatch');
   await writeFile(archive,bytes,{flag:'wx',mode:0o600});
   // Stream only the named binary from the authenticated archive, never extract
   // paths, links, installers or skills into the filesystem.
   const members=execFileSync('tar',['-tzf',archive],{encoding:'utf8',maxBuffer:1024*1024}).split(/\r?\n/).filter(Boolean);
   const member=members.find(value=>value===release.binary||value==='./'+release.binary);
   if(!member||members.filter(value=>value===release.binary||value==='./'+release.binary).length!==1)throw Error('Managed connector CLI archive has no unique binary');
   const executable=execFileSync('tar',['-xOzf',archive,member],{maxBuffer:160*1024*1024}),target=join(stage,release.binary);
   if(!executable.length)throw Error('Managed connector CLI binary is empty');
   await writeFile(target,executable,{flag:'wx',mode:0o700});await chmod(target,0o755);
   await writeFile(target+'.json',JSON.stringify({archiveSha256:archiveHash,binarySha256:hash(executable)})+'\n',{flag:'wx',mode:0o600});
   await rm(archive);
   try{await rename(stage,destination);}catch(error){if(!['EEXIST','ENOTEMPTY'].includes(error.code)||!await ready(binary,archiveHash))throw error;}
   if(!await ready(binary,archiveHash))throw Error('Managed connector CLI preparation is incomplete');
   results.push({provider,version:release.version,prepared:true});
  }finally{await rm(stage,{recursive:true,force:true});}
 }
 return results;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{if(process.argv.length>2)throw Error('Connector preparation takes no arguments');console.log(JSON.stringify(await prepareConnectorRuntime()));}
 catch(error){console.error('Connector dependency preparation failed: '+error.message);process.exitCode=1;}
}
