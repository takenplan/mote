import {mkdir,readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {accountKey,sameAccount} from './account';
import {ConfigStore,defaultConfig,type SecretStorage} from './config';
import {connectionToken} from './login-session';
import {atomicSourceJson} from './source-sync';
import type {Config} from './contracts';

/** Directory/config selection only. Collection, outbox and retries keep their existing implementations. */
export class DesktopAccountStorage {
 constructor(readonly root:string,private readonly secrets:SecretStorage){}
 directory(config:Config):string {return join(this.root,'accounts',connectionToken(config)&&accountKey(config)?accountKey(config)!:'signed-out');}
 async open(config:Config):Promise<string>{
  const directory=this.directory(config),key=accountKey(config);
  await mkdir(directory,{recursive:true,mode:0o700});
  if(connectionToken(config)&&key){
   const path=join(directory,'account-binding.json'),binding={version:1,origin:config.serverUrl,deploymentId:config.account!.deploymentId,userId:config.account!.userId};
   try{if(JSON.stringify(JSON.parse(await readFile(path,'utf8')))!==JSON.stringify(binding))throw Error('Desktop account directory binding mismatch');}
   catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;await atomicSourceJson(path,binding);}
  }
  return directory;
 }
 async remember(config:Config):Promise<void>{
  if(!connectionToken(config)||!accountKey(config))return;
  await this.open(config);
  // Only the active root ConfigStore keeps a usable credential. Old account
  // preferences and custom queue locations survive without dormant credentials.
  await new ConfigStore(this.directory(config),this.secrets).save({...config,token:undefined,authSignedOut:true,authSessionOnly:false});
 }
 async forLogin(confirmed:Config):Promise<Config>{
  if(!accountKey(confirmed)||!connectionToken(confirmed))throw Error('Confirmed account required');
  const fallback={...defaultConfig(),deviceId:confirmed.deviceId,deviceName:confirmed.deviceName,serverUrl:confirmed.serverUrl};
  const stored=await new ConfigStore(this.directory(confirmed),this.secrets,()=>fallback).load();
  if(stored.account&&!sameAccount(stored,confirmed))throw Error('Stored account preferences mismatch');
  return {...stored,deviceId:confirmed.deviceId,serverUrl:confirmed.serverUrl,account:confirmed.account,token:confirmed.token,authSignedOut:false,authExpiresAt:confirmed.authExpiresAt,authSessionOnly:confirmed.authSessionOnly,credentialScope:confirmed.credentialScope,authSourceBinding:undefined};
 }
}
