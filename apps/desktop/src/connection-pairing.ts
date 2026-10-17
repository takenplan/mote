import {createHash,randomUUID} from 'node:crypto';
import {mkdir,open,readFile,rename,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {accountKey,DESKTOP_PROTOCOL_HEADERS} from './account';
import type {Config,Platform} from './contracts';
import type {SecretStorage} from './config';
import {parseDesktopConnectionInvitation,type DesktopConnectionInvitation} from './connection-invitation';
import {connectionRequest,ConnectionError,testConnection,type ConnectionIdentity} from './connection';
import {loginVerifier} from './login-session';

type Device={deviceId:string;deviceName:string;platform:Platform};
type Grant={ready:true;token:string;credentialId:string;scope:'client';deploymentId:string;userId:string;serverUrl:string;expiresAt:number;purpose:'device';deviceId:string};
type Pending={version:1;id:string;invitation:DesktopConnectionInvitation;device:Device;verifier:string;sourceBinding:string;sourceSignedOutBinding:string;requestId?:string;requestExpiresAt?:number;grant?:Grant};
export type PairingPreview=Pick<DesktopConnectionInvitation,'serverUrl'|'deploymentId'|'userId'|'expiresAt'>;
const secret=/^[A-Za-z0-9_-]{43}$/;
const invalid=()=>new ConnectionError('INVALID_RESPONSE','Invalid device pairing response');
const fingerprint=(config:Config)=>createHash('sha256').update(JSON.stringify([config.serverUrl,accountKey(config),config.deviceId,config.token,Boolean(config.authSignedOut),config.authExpiresAt])).digest('hex');
const sourceMatches=(config:Config,pending:Pending)=>pending.sourceBinding===fingerprint(config)||Boolean(!config.token&&pending.sourceSignedOutBinding===fingerprint({...config,authSignedOut:true}));
function grantValue(value:unknown,pending:Pending,now:number):Grant {
 const v=value as Grant,i=pending.invitation;
 if(!v||typeof v!=='object'||Array.isArray(v)||Object.keys(v).sort().join(',')!=='credentialId,deploymentId,deviceId,expiresAt,purpose,ready,scope,serverUrl,token,userId'||v.ready!==true||v.scope!=='client'||v.purpose!=='device'||v.deploymentId!==i.deploymentId||v.userId!==i.userId||v.serverUrl!==i.serverUrl||v.deviceId!==pending.device.deviceId||typeof v.token!=='string'||v.token.length<32||v.token.length>4096||/[\x00-\x20\x7f]/.test(v.token)||typeof v.credentialId!=='string'||!v.credentialId||v.credentialId.length>128||/[\x00-\x1f\x7f]/.test(v.credentialId)||!Number.isSafeInteger(v.expiresAt)||v.expiresAt<=now)throw invalid();
 return {...v};
}
function assertIdentity(identity:ConnectionIdentity,pending:Pending,grant:Grant):void {
 if(identity.account.origin!==grant.serverUrl||identity.account.deploymentId!==grant.deploymentId||identity.account.userId!==grant.userId||identity.account.credentialId!==grant.credentialId||identity.credential.deviceId!==pending.device.deviceId||identity.credential.expiresAt!==grant.expiresAt||!identity.capabilities.authentication||!identity.capabilities.ingest||identity.capabilities.archiveRead)throw invalid();
}
function installed(config:Config,pending:Pending):boolean {
 const g=pending.grant;
 return Boolean(g&&config.token===g.token&&!config.authSignedOut&&config.serverUrl===g.serverUrl&&config.deviceId===g.deviceId&&config.account?.deploymentId===g.deploymentId&&config.account?.userId===g.userId&&config.authExpiresAt===g.expiresAt);
}

/** One encrypted recovery journal, using the existing OS secret store. It is an
 * M01 transport checkpoint, never an account credential inventory or upload queue. */
export class DesktopPairing {
 private writes:Promise<unknown>=Promise.resolve();
 private epoch=0;
 private busy=false;
 readonly path:string;
 constructor(private directory:string,private secrets:SecretStorage,private fetcher:typeof fetch=fetch,private now=Date.now){this.path=join(directory,'connection-pending.enc');}
 private serial<T>(operation:()=>Promise<T>):Promise<T>{const task=this.writes.then(operation);this.writes=task.catch(()=>{});return task;}
 private async read():Promise<Pending|undefined>{
  await this.writes;
  let bytes:Buffer;try{bytes=await readFile(this.path);}catch(error){if((error as NodeJS.ErrnoException).code==='ENOENT')return;throw error;}
  if(!this.secrets.available()||bytes.length>32768)throw invalid();
  let p:Pending;try{p=JSON.parse(this.secrets.decrypt(bytes));}catch{throw invalid();}
  if(!p||p.version!==1||typeof p.id!=='string'||!secret.test(p.verifier)||!/^[a-f0-9]{64}$/.test(p.sourceBinding)||!/^[a-f0-9]{64}$/.test(p.sourceSignedOutBinding)||!p.device||!/^[-a-zA-Z0-9_.:]{1,128}$/.test(p.device.deviceId)||typeof p.device.deviceName!=='string'||!p.device.deviceName.trim()||p.device.deviceName.length>128||!['macos','windows','linux','android','other'].includes(p.device.platform))throw invalid();
  p.invitation=parseDesktopConnectionInvitation(JSON.stringify(p.invitation),p.grant?0:this.now());
  if(p.invitation.deviceId&&p.invitation.deviceId!==p.device.deviceId)throw invalid();
  if(p.requestId!==undefined&&(!secret.test(p.requestId)||!Number.isSafeInteger(p.requestExpiresAt)||p.requestExpiresAt!>Date.parse(p.invitation.expiresAt)))throw invalid();
  if(p.grant)p.grant=grantValue(p.grant,p,this.now());
  return p;
 }
 private save(p:Pending,assertCurrent:()=>void):Promise<void>{return this.serial(async()=>{
  assertCurrent();if(!this.secrets.available())throw Error('System encrypted storage is unavailable');
  await mkdir(this.directory,{recursive:true,mode:0o700});
  const temporary=join(this.directory,`connection-pending.${randomUUID()}.tmp`),file=await open(temporary,'wx',0o600);
  try{await file.writeFile(this.secrets.encrypt(JSON.stringify(p)));await file.sync();}finally{await file.close();}
  try{assertCurrent();await rename(temporary,this.path);if(process.platform!=='win32'){const directory=await open(this.directory,'r');try{await directory.sync();}finally{await directory.close();}}}finally{await rm(temporary,{force:true});}
 });}
 async preview(config:Config):Promise<PairingPreview|undefined>{
  const pending=await this.read();if(!pending||!sourceMatches(config,pending)&&!installed(config,pending))return;
  const {serverUrl,deploymentId,userId,expiresAt}=pending.invitation;return {serverUrl,deploymentId,userId,expiresAt};
 }
 async cancel():Promise<void>{this.epoch++;await this.serial(()=>rm(this.path,{force:true}));}
 async begin(invitation:DesktopConnectionInvitation,config:Config,platform:Platform,assertCurrent:()=>void):Promise<void>{
  if(this.busy)throw Error('Device pairing is already in progress');
  if(invitation.deviceId&&invitation.deviceId!==config.deviceId)throw new ConnectionError('AUTH','Invitation belongs to a different device');
  const sourceBinding=fingerprint(config),existing=await this.read().catch(()=>undefined);assertCurrent();
  // Retry exactly the already durably fixed claim; never rotate its verifier.
  if(existing&&existing.sourceBinding===sourceBinding&&JSON.stringify(existing.invitation)===JSON.stringify(invitation)&&existing.device.deviceId===config.deviceId&&existing.device.deviceName===config.deviceName&&existing.device.platform===platform)return;
  const epoch=++this.epoch,{verifier}=loginVerifier();
  const sourceSignedOutBinding=fingerprint({...config,token:undefined,authSignedOut:true});
  await this.save({version:1,id:randomUUID(),invitation,device:{deviceId:config.deviceId,deviceName:config.deviceName,platform},verifier,sourceBinding,sourceSignedOutBinding},()=>{assertCurrent();if(epoch!==this.epoch)throw Error('Device pairing changed');});
 }
 async resume(config:Config,assertCurrent:()=>void,publish:(grant:Grant,identity:ConnectionIdentity,device:Readonly<Device>)=>Promise<void>):Promise<void>{
  if(this.busy)throw Error('Device pairing is already in progress');this.busy=true;
  const epoch=this.epoch;
  const current=()=>{assertCurrent();if(epoch!==this.epoch)throw Error('Device pairing changed');};
  try{
   let p=await this.read();current();
   if(!p||p.device.deviceId!==config.deviceId||!sourceMatches(config,p)&&!installed(config,p))throw Error('Device pairing belongs to another connection');
   const post=(path:string,body:unknown)=>connectionRequest(p!.invitation.serverUrl,path,{method:'POST',credentials:'omit',headers:{...DESKTOP_PROTOCOL_HEADERS,'Content-Type':'application/json'},body:JSON.stringify(body)},this.fetcher);
   if(!p.requestId){
    const i=p.invitation,result=await post('/api/connections/redeem',{code:i.code,expected:{deploymentId:i.deploymentId,userId:i.userId,serverUrl:i.serverUrl,purpose:i.purpose},...p.device,challenge:createHash('sha256').update(p.verifier).digest('hex')}) as {id:string;expiresAt:number};current();
    if(!result||Object.keys(result).sort().join(',')!=='expiresAt,id'||!secret.test(result.id)||!Number.isSafeInteger(result.expiresAt)||result.expiresAt<=this.now()||result.expiresAt>Date.parse(i.expiresAt))throw invalid();
    p={...p,requestId:result.id,requestExpiresAt:result.expiresAt};await this.save(p,current);
   }
   if(!p.grant){const result=await post('/api/login/poll',{id:p.requestId,verifier:p.verifier});current();p={...p,grant:grantValue(result,p,this.now())};await this.save(p,current);}
   const grant=p.grant!;
   const self=async()=>{const identity=await testConnection({serverUrl:grant.serverUrl,token:grant.token,deviceId:p!.device.deviceId},this.fetcher);current();assertIdentity(identity,p!,grant);return identity;};
   await self();
   try{const ack=await post('/api/login/ack',{id:p.requestId,verifier:p.verifier}) as {acknowledged?:boolean};current();if(!ack||Object.keys(ack).join(',')!=='acknowledged'||ack.acknowledged!==true)throw invalid();}
   catch(error){current();if(!(error instanceof ConnectionError&&error.httpStatus===410&&error.reason==='login_expired'))throw error;/* A restart/expired receipt is not credential revocation. Fresh self below decides. */}
   const identity=await self();current();
   await publish(grant,identity,Object.freeze({...p.device}));
   // Publication retires the old main generation. Cleanup is still ordered with
   // cancellation/new attempts, and cannot remove a newer recovery journal.
   if(epoch===this.epoch)await this.serial(()=>rm(this.path,{force:true}));
  }finally{this.busy=false;}
 }
}
