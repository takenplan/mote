// Native media dependencies belong to one Mote profile. No package manager,
// shell profile, system Python, credentials or security settings are modified.
import {createHash,randomUUID} from 'node:crypto';
import {spawn} from 'node:child_process';
import {mkdir,readFile,writeFile,rename,rm,chmod,symlink,stat} from 'node:fs/promises';
import {join,dirname,relative,resolve,isAbsolute} from 'node:path';

export const MEDIA_UV_VERSION='0.13.6';
export const MEDIA_PYTHON_REQUEST='3.11';
export const MEDIA_PYTHON_BUILD='20261021';
// Digests and byte counts from the upstream immutable 0.13.6 release.
export const MEDIA_BOOTSTRAP_PLATFORMS=Object.freeze({
 'darwin-arm64':{target:'aarch64-apple-darwin',bytes:14235670,sha256:'60fbd5c8a1ed681845eea28d9d622fcde03c51e91a43465b64a1e17db1ed3472'},
 'darwin-x64':{target:'x86_64-apple-darwin',bytes:17004934,sha256:'63ba17fdda55ad1a230d4b37fc6017ffa10c23688c83818bd3bfdf914c652a02'},
 'linux-arm64':{target:'aarch64-unknown-linux-gnu',bytes:15794886,sha256:'229e194255c7958d86d56e8790d969a6f74736592133f0dfd0076f754c642c1d'},
 'linux-x64':{target:'x86_64-unknown-linux-gnu',bytes:16799024,sha256:'f29c3e94ffabd7e6f3ba521dba169a9b7ec12100bf3257087f0f24f6123f3645'},
});
export function nativeMediaPlatform(platform=process.platform,arch=process.arch){
 const value=MEDIA_BOOTSTRAP_PLATFORMS[`${platform}-${arch}`];
 if(!value||platform==='linux'&&!process.report?.getReport().header.glibcVersionRuntime)throw Error('media.runtime.unsupported_platform');
 return value;
}
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
const checkSignal=signal=>signal?.throwIfAborted();
export function mediaInstallerEnvironment(directory,env=process.env){
 const clean=Object.fromEntries(['PATH','LANG','TMPDIR','TMP','TEMP','HTTPS_PROXY','HTTP_PROXY','ALL_PROXY','NO_PROXY','https_proxy','http_proxy','all_proxy','no_proxy'].filter(key=>env[key]!==undefined).map(key=>[key,env[key]]));
 return {...clean,UV_NO_CONFIG:'1',UV_NO_MODIFY_PATH:'1',UV_KEYRING_PROVIDER:'disabled',UV_NO_PROGRESS:'1',UV_CACHE_DIR:join(directory,'cache'),UV_PYTHON_INSTALL_DIR:join(directory,'python'),UV_PYTHON_BIN_DIR:join(directory,'bin'),UV_PYTHON_INSTALL_BIN:'0',UV_PYTHON_NO_REGISTRY:'1',UV_PYTHON_CPYTHON_BUILD:MEDIA_PYTHON_BUILD,UV_INDEX_URL:'https://pypi.org/simple',PYTHONNOUSERSITE:'1',PADDLE_PDX_DISABLE_MODEL_SOURCE_CHECK:'True',HF_HUB_OFFLINE:'1',HF_HUB_DISABLE_TELEMETRY:'1'};
}
/** Bounded captured output is used only for local install receipts, never logs. */
export function runMediaCommand(command,args,{env,signal,cwd,timeoutMs=30*60*1000,maxBytes=64*1024*1024}={}){
 checkSignal(signal);
 return new Promise((resolve,reject)=>{
  const child=spawn(command,args,{cwd,env,detached:process.platform!=='win32',stdio:['ignore','pipe','ignore']});
  const chunks=[];let bytes=0,failure,force;
  const kill=signal=>{try{if(process.platform!=='win32'&&child.pid)process.kill(-child.pid,signal);else child.kill(signal);}catch(error){if(error.code!=='ESRCH')throw error;}};
  const stop=()=>{kill('SIGTERM');force??=setTimeout(()=>kill('SIGKILL'),5000);};
  const abort=()=>{failure=signal?.reason??Error('media.runtime.cancelled');stop();};
  const timer=setTimeout(()=>{failure=Error('media.runtime.command_timeout');stop();},timeoutMs);
  signal?.addEventListener('abort',abort,{once:true});
  if(signal?.aborted)abort();
  child.stdout.on('data',chunk=>{bytes+=chunk.length;if(bytes>maxBytes){failure=Error('media.runtime.output_limit');stop();}else chunks.push(chunk);});
  child.once('error',error=>{failure=error;});
  child.once('close',code=>{clearTimeout(timer);if(force)kill('SIGKILL');clearTimeout(force);signal?.removeEventListener('abort',abort);if(failure||code!==0)reject(failure??Error('media.runtime.command_failed'));else resolve(Buffer.concat(chunks));});
 });
}
function upstreamUrl(value){const url=new URL(value);if(url.protocol!=='https:'||url.username||url.password||!['github.com','release-assets.githubusercontent.com','objects.githubusercontent.com'].includes(url.hostname))throw Error('media.runtime.download_source');return url.toString();}
export async function downloadMediaBootstrap(spec,{fetchImpl=fetch,signal}={}){
 let url=upstreamUrl(`https://github.com/astral-sh/uv/releases/download/${MEDIA_UV_VERSION}/uv-${spec.target}.tar.gz`),response;
 for(let redirects=0;redirects<6;redirects++){
  checkSignal(signal);response=await fetchImpl(url,{redirect:'manual',signal:AbortSignal.any([...(signal?[signal]:[]),AbortSignal.timeout(120000)])});
  if([301,302,303,307,308].includes(response.status)){const target=response.headers.get('location');await response.body?.cancel();if(!target)throw Error('media.runtime.download_redirect');url=upstreamUrl(new URL(target,url));continue;}break;
 }
 if(!response?.ok||!response.body)throw Error('media.runtime.download_failed');
 const reader=response.body.getReader(),chunks=[];let size=0;
 try{for(;;){checkSignal(signal);const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>spec.bytes)throw Error('media.runtime.download_size');chunks.push(value);}}catch(error){await reader.cancel().catch(()=>{});throw error;}finally{reader.releaseLock();}
 const bytes=Buffer.concat(chunks);if(size!==spec.bytes||digest(bytes)!==spec.sha256)throw Error('media.runtime.download_checksum');return bytes;
}
export async function ensureMediaBootstrap(directory,{signal,run=runMediaCommand,fetchImpl=fetch,platform=nativeMediaPlatform()}={}){
 const folder=join(directory,'bootstrap',MEDIA_UV_VERSION,platform.target),binary=join(folder,'uv'),receipt=join(folder,'receipt.json');
 try{const saved=JSON.parse(await readFile(receipt,'utf8'));if(saved.archiveSha256===platform.sha256&&saved.binarySha256===digest(await readFile(binary)))return binary;}catch{/* Partial/corrupt profile cache is replaced only after verification. */}
 await mkdir(folder,{recursive:true,mode:0o700});
 const archive=join(folder,`${randomUUID()}.tar.gz`),temporary=join(folder,`${randomUUID()}.uv`);
 try{
  const bytes=await downloadMediaBootstrap(platform,{signal,fetchImpl});checkSignal(signal);await writeFile(archive,bytes,{mode:0o600,flag:'wx'});
  const executable=await run('tar',['-xOzf',archive,`uv-${platform.target}/uv`],{signal,timeoutMs:30000,env:mediaInstallerEnvironment(directory)});
  if(!executable.length)throw Error('media.runtime.bootstrap_empty');checkSignal(signal);
  await writeFile(temporary,executable,{mode:0o700,flag:'wx'});await chmod(temporary,0o700);await rename(temporary,binary);
  await writeFile(receipt,JSON.stringify({version:MEDIA_UV_VERSION,archiveSha256:platform.sha256,binarySha256:digest(executable)}),{mode:0o600});return binary;
 }finally{await rm(archive,{force:true});await rm(temporary,{force:true});}
}
const probeScript='import json,sys,paddlex,onnxruntime,PIL,faster_whisper,sherpa_onnx,imageio_ffmpeg; print(json.dumps({"python":sys.version.split()[0],"ffmpeg":imageio_ffmpeg.get_ffmpeg_exe()}))';
/** Publish an immutable prepared environment only after imports and ffmpeg work. */
export async function prepareNativeMediaRuntime({repository,directory,signal,onStage=()=>{},run=runMediaCommand,fetchImpl=fetch,env=process.env,allowInstall=true,sourcePython}){
 if(!isAbsolute(directory))throw Error('media.runtime.profile_directory');
 const platform=nativeMediaPlatform(),requirements=['requirements-audio.txt','requirements-ocr.txt'].map(name=>join(repository,'scripts',name));
 const version=digest(Buffer.concat([Buffer.from(JSON.stringify([MEDIA_UV_VERSION,MEDIA_PYTHON_REQUEST,MEDIA_PYTHON_BUILD,platform.target])),...await Promise.all(requirements.map(path=>readFile(path)))]));
 const clean=mediaInstallerEnvironment(directory,env),marker=join(directory,'current.json');
 await mkdir(directory,{recursive:true,mode:0o700});
 try{
  const current=JSON.parse(await readFile(marker,'utf8'));
  if(current.version===version&&/^environment-[a-f0-9-]+$/.test(current.generation)&&(!sourcePython||current.sourcePython===sourcePython)){
   const python=join(directory,current.generation,'bin','python');
   await run(python,['-c',probeScript],{env:clean,signal,timeoutMs:120000});await run(join(dirname(python),'ffmpeg'),['-version'],{env:clean,signal,timeoutMs:30000});
   return {python,version,generation:current.generation,created:false};
  }
 }catch(error){checkSignal(signal);}
 if(!allowInstall)throw Error('media.runtime.not_prepared');
 onStage('dependencies');const uv=await ensureMediaBootstrap(directory,{signal,run,fetchImpl,platform});
 const generation=`environment-${randomUUID()}`,target=join(directory,generation),temporaryMarker=join(directory,`${randomUUID()}.current.json`);
 try{
  if(!sourcePython)await run(uv,['python','install',MEDIA_PYTHON_REQUEST],{env:clean,signal,cwd:directory});
  await run(uv,['venv',...(sourcePython?['--no-python-downloads','--python',sourcePython]:['--managed-python','--python',MEDIA_PYTHON_REQUEST]),'--seed',target],{env:clean,signal,cwd:directory});
  const python=join(target,'bin','python');
  await run(uv,['pip','install','--python',python,'--index-url','https://pypi.org/simple',...requirements.flatMap(path=>['-r',path])],{env:clean,signal,cwd:directory});
  onStage('verifying_dependencies');
  const receipt=JSON.parse(String(await run(python,['-c',probeScript],{env:clean,signal,timeoutMs:120000})));
  const ffmpeg=resolve(receipt.ffmpeg);if(!ffmpeg.startsWith(target+'/')||!(await stat(ffmpeg)).isFile())throw Error('media.runtime.ffmpeg_not_managed');
  await symlink(relative(join(target,'bin'),ffmpeg),join(target,'bin','ffmpeg'));
  await run(join(target,'bin','ffmpeg'),['-version'],{env:clean,signal,timeoutMs:30000});checkSignal(signal);
  await writeFile(temporaryMarker,JSON.stringify({version,generation,pythonVersion:receipt.python,sourcePython:sourcePython??null,uvVersion:MEDIA_UV_VERSION,preparedAt:new Date().toISOString()}),{mode:0o600,flag:'wx'});checkSignal(signal);await rename(temporaryMarker,marker);
  return {python,version,generation,created:true};
 }catch(error){await rm(target,{recursive:true,force:true});throw error;}finally{await rm(temporaryMarker,{force:true});}
}
