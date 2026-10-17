import {readFileSync,existsSync} from 'node:fs';
import {join} from 'node:path';
import {configFromFile,serverConfigSchema} from '../config.js';
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
void main().catch(()=>{console.error('[dev] Development account initialization failed; no server was started.');process.exitCode=1;});
