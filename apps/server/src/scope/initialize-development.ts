import {readFileSync,existsSync} from 'node:fs';
import {join} from 'node:path';
import {configFromFile,serverConfigSchema,ConfigError} from '../config.js';
import {openScopeStorage} from './storage.js';
import {Accounts} from './accounts.js';

/** Called only by the foreground development launcher after its build, under
 * the profile lock and before starting the server. No model or worker opens. */
async function main(){
 const config=configFromFile(undefined,{initializeCredentials:false}),server=serverConfigSchema.parse(config.configuration.document?.server);
 if(server.profile==='prod'||server.runtime!=='native'||config.port===47832||!['127.0.0.1','::1','localhost'].includes(config.host))throw Error('development_profile_required');
 const pidPath=join(config.dataDir,'server.pid');
 if(existsSync(pidPath)){
  const pid=Number(readFileSync(pidPath,'utf8').trim());
  if(Number.isSafeInteger(pid)&&pid>0){try{process.kill(pid,0);throw Error('development_server_running');}catch(error){if((error as NodeJS.ErrnoException).code!=='ESRCH')throw error;}}
 }
 const storage=openScopeStorage(config.dataDir);
 try{
  const accounts=new Accounts(storage.db,storage.deploymentId);
  try{console.info(await accounts.initializeDevelopment()?'[dev] Created local development account: admin / admin':'[dev] Existing accounts preserved; sign in with your current username and password.');}
  finally{accounts.close();}
 }finally{storage.close();}
}
void main().catch(error=>{
 // Match the server entry point's field-only configuration diagnostics. Raw
 // errors can contain credentials, SQL or private paths and must stay private.
 const code=(error as NodeJS.ErrnoException)?.code;
 const guard=error instanceof Error&&['development_profile_required','development_server_running'].includes(error.message)?error.message:undefined;
 const filesystem=['ENOENT','ENOTDIR','EROFS','ENOSPC','ELOOP','EEXIST','EMFILE','ENFILE'].includes(code??'');
 const category=error instanceof ConfigError?'configuration':guard==='development_profile_required'?'development_profile_required':guard==='development_server_running'?'data_directory_in_use':code==='unsupported_vault'?'unsupported_vault':code==='EACCES'||code==='EPERM'?'permission':filesystem?'filesystem':code==='ERR_SQLITE_ERROR'?'database':'initialization';
 const sqliteCode=(error as {errcode?:unknown})?.errcode;
 const diagnostic={event:'development.initialize_failed',category,
  ...(error instanceof ConfigError?{field:error.field}:{}),
  ...(filesystem||category==='permission'||category==='database'?{code}:{}),
  ...(category==='database'&&Number.isSafeInteger(sqliteCode)?{sqliteCode}:{})};
 console.error('[dev] Development account initialization failed; no server was started. '+JSON.stringify(diagnostic));
 process.exitCode=1;
});
