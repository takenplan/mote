import {configFromFile} from '../config.js';
import {openScopeStorage} from './storage.js';
import {Accounts} from './accounts.js';
import {z} from 'zod';

/** Run on a stopped, admitted epoch-5 or empty vault. Input is a JSON object on
 * stdin so passwords never appear in argv, URLs, logs or shell history. */
async function main(){
  let input='';for await(const part of process.stdin){input+=part;if(Buffer.byteLength(input)>8192)throw Error('invalid_request');}
  const credentials=z.object({username:z.string(),password:z.string()}).strict().parse(JSON.parse(input));
  const config=configFromFile(undefined,{initializeCredentials:false}),storage=openScopeStorage(config.dataDir);
  try{const accounts=new Accounts(storage.db,storage.deploymentId);const user=await accounts.initialize(credentials.username,credentials.password);console.info(JSON.stringify({event:'account.initialized',deploymentId:storage.deploymentId,userId:user.userId}));accounts.close();}
  finally{storage.close();}
}
void main().catch(error=>{console.error(JSON.stringify({event:'account.initialize_failed',category:(error as {code?:string}).code??'invalid_request'}));process.exitCode=1;});
