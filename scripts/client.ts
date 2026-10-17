import {constants,closeSync,fstatSync,openSync,readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {loadEnvironment} from '@mote/shared/environment';
import {accountKey} from '../apps/desktop/src/account.js';
import {defaultConfig,validateServerUrl} from '../apps/desktop/src/config.js';
import {testConnection} from '../apps/desktop/src/connection.js';
import {ingressRequest} from '../apps/desktop/src/ingress-client.js';
import type {SourceRequest} from '../apps/desktop/src/source-types.js';
const {env,baseDir,envFile}=loadEnvironment(fileURLToPath(new URL('../',import.meta.url)));
export const resolvedConnection={url:(env.MOTE_URL||`http://127.0.0.1:${env.MOTE_PORT||47832}`).replace(/\/$/,''),baseDir,envFile,profileDirectory:env.MOTE_CONFIG_FILE?baseDir:undefined,profile:env.MOTE_PROFILE||'default'};
function configuredToken(){
 if(env.MOTE_TOKEN)return env.MOTE_TOKEN;
 if(!env.MOTE_TOKEN_FILE)throw Error('Configure an explicit personal client credential in the selected YAML or MOTE_TOKEN/MOTE_TOKEN_FILE');
 const fd=openSync(resolve(baseDir,env.MOTE_TOKEN_FILE),constants.O_RDONLY|constants.O_NOFOLLOW|constants.O_NONBLOCK);
 try{const stat=fstatSync(fd);if(!stat.isFile()||stat.nlink!==1||stat.size>16384)throw Error('Client credential must be a regular private file');return readFileSync(fd,'utf8').trim();}finally{closeSync(fd);}
}
/** A selected credential first proves its stable M01 identity. No retired owner
 * token, token-hash ownership or v2 fallback can claim the local outbox. */
export async function apiClient(connection?:{url:string;token:string}){
 const url=validateServerUrl(connection?.url??resolvedConnection.url),token=connection?.token??configuredToken();
 const identity=await testConnection({serverUrl:url,token,deviceId:'cli'},fetch,false),account=Object.freeze({origin:identity.account.origin,deploymentId:identity.account.deploymentId,userId:identity.account.userId,username:identity.account.username});
 const config={...defaultConfig(),serverUrl:url,token,account,authSignedOut:false,authExpiresAt:identity.credential.expiresAt,credentialScope:'client' as const,deviceId:identity.credential.deviceId??'cli'};
 const request:SourceRequest=async(path,body,method=body===undefined?'GET':'POST',signal)=>{
  if(method==='POST'&&['/api/captures','/api/notes'].includes(path))throw Error('Use the account-bound Ingress 3 source endpoint');
  // The shared transport owns fresh identity admission and abort checks for
  // every private request. Do not add a second outer handshake.
  return ingressRequest(config,path,body,method,signal);
 };
 return Object.assign(request,{account,binding:accountKey(config)!,identity,config});
}
