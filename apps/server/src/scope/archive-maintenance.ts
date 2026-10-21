import type {DatabaseSync} from 'node:sqlite';
import type {ContentEncryption} from '../content-encryption.js';
import {ScopeError,validScopeId} from './baseline.js';
import type {Configurations} from './configuration.js';
import {collectIngress} from './ingress-gc.js';
import {Originals} from './originals.js';
import {PrivateData} from './private-data.js';
import {PrivateCursor,PrivateSql,PrivateDataError} from './private-data-sql.js';

const hourly=3600000;
type Summary={owners:number;capturesDeleted:number;objectsRemoved:number;deferredOwners:number;failedOwners:number};
type Schedule=(work:()=>void,milliseconds:number)=>()=>void;
const schedule:Schedule=(work,milliseconds)=>{const timer=setInterval(work,milliseconds);timer.unref();return ()=>clearInterval(timer);};

/** Host maintenance has no request-selectable owner or user credentials. The
 * account inventory supplies one fixed owner and epoch at a time; every private
 * SQL operation revalidates that binding. Logging out cannot cancel retention.
 * Deleted accounts remain the durable account-deletion coordinator's concern. */
export class ArchiveMaintenance{
 private stop?:()=>void;
 private closed=false;
 constructor(private readonly options:{db:DatabaseSync;deploymentId:string;directory:string;cursorKey:string;configuration:Configurations;contentCipher?:(userId:string)=>ContentEncryption;onFailure?:(error:unknown)=>void;onSweep?:(summary:Summary)=>void},private readonly every:Schedule=schedule){}
 run():Summary{
  const result:Summary={owners:0,capturesDeleted:0,objectsRemoved:0,deferredOwners:0,failedOwners:0};
  if(this.closed)return result;
  const {db,deploymentId,directory,cursorKey,configuration,contentCipher}=this.options;
  const {retentionDays}=configuration.instance.current<{retentionDays:number}>('storage');
  if(!Number.isFinite(retentionDays)||retentionDays<0)throw new Error('Invalid archive retention');
  const before=retentionDays>0?new Date(Date.now()-retentionDays*86400000).toISOString():undefined;
  for(const owner of db.prepare('SELECT user_id,authorization_epoch FROM auth_accounts ORDER BY user_id').all()){
   const userId=String(owner.user_id),epoch=Number(owner.authorization_epoch);
   if(!validScopeId(userId)||!Number.isSafeInteger(epoch)||epoch<0)throw new ScopeError('invalid_identity',401);
   const assert=()=>{
    if(this.closed||db.prepare('SELECT authorization_epoch FROM auth_accounts WHERE user_id=?').get(userId)?.authorization_epoch!==epoch)throw new ScopeError('invalid_identity',401);
   },sql=new PrivateSql(db,userId,assert);
   if(sql.get('SELECT deleted FROM ig_state WHERE user_id=$user')?.deleted)continue;
   result.owners++;
   try{
    if(before)result.capturesDeleted+=new PrivateData(sql,new PrivateCursor(cursorKey,deploymentId,userId)).prune(before);
    result.objectsRemoved+=collectIngress(sql,new Originals(directory,deploymentId,sql,assert,contentCipher?()=>contentCipher(userId):undefined),epoch).removed;
   }catch(error){
    if(error instanceof PrivateDataError&&error.code==='conflict')result.deferredOwners++;
    else{result.failedOwners++;this.options.onFailure?.(error);}
   }
  }
  this.options.onSweep?.(result);
  return result;
 }
 start(){
  if(this.closed||this.stop)return;
  const result=this.run();
  this.stop=this.every(()=>{try{this.run();}catch(error){this.options.onFailure?.(error);}},hourly);
  return result;
 }
 close(){this.closed=true;this.stop?.();this.stop=undefined;}
}
