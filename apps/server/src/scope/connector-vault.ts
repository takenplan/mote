import {createHash,createCipheriv,createDecipheriv,randomBytes} from 'node:crypto';
import {constants,openSync,closeSync,writeFileSync,readFileSync,fsyncSync,fstatSync} from 'node:fs';
import {join} from 'node:path';
import type {DatabaseSync} from 'node:sqlite';
import {privateDirectory} from '../private-storage.js';
import {ConnectorError} from '../connectors/types.js';
import type {ConnectorState} from '../connectors/ports.js';

export const connectorHash=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
/** An instance key and authenticated payload bind every secret to the fixed
 * deployment/account/connection/name. Callers receive no filesystem selector. */
export class ConnectorVault {
 readonly directory:string;
 private key:Buffer;
 constructor(private db:DatabaseSync,root:string,private deploymentId:string,private userId:string,private instanceId:string,private assert:()=>void){
  assert();const users=join(root,'connectors'),user=join(users,connectorHash([deploymentId,userId]));this.directory=join(user,connectorHash(instanceId));
  for(const path of [root,users,user,this.directory])privateDirectory(path);
  const path=join(this.directory,'key');let fd:number;
  try{fd=openSync(path,constants.O_WRONLY|constants.O_NOFOLLOW|constants.O_CREAT|constants.O_EXCL,0o600);try{writeFileSync(fd,randomBytes(32));fsyncSync(fd);}finally{closeSync(fd);}}catch(e){if((e as NodeJS.ErrnoException).code!=='EEXIST')throw e;}
  fd=openSync(path,constants.O_RDONLY|constants.O_NOFOLLOW|constants.O_NONBLOCK);try{const stat=fstatSync(fd);if(!stat.isFile()||stat.nlink!==1||stat.size!==32||(stat.mode&0o077)!==0||(process.getuid&&stat.uid!==process.getuid()))throw new ConnectorError('connector_key_unavailable',503);this.key=readFileSync(fd);}finally{closeSync(fd);}
 }
 private aad(name:string){return Buffer.from(JSON.stringify([this.deploymentId,this.userId,this.instanceId,name]));}
 read<T>(name:string):T|undefined{this.assert();const row=this.db.prepare('SELECT payload FROM connector_secrets WHERE user_id=? AND instance_id=? AND name=?').get(this.userId,this.instanceId,name);if(!row)return;try{const [iv,tag,data]=String(row.payload).split('.').map(v=>Buffer.from(v,'base64')),decipher=createDecipheriv('aes-256-gcm',this.key,iv);decipher.setAAD(this.aad(name));decipher.setAuthTag(tag);return JSON.parse(Buffer.concat([decipher.update(data),decipher.final()]).toString());}catch{throw new ConnectorError('connector_state_unavailable',503);}}
 write(name:string,value:unknown){this.assert();const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',this.key,iv);cipher.setAAD(this.aad(name));const data=Buffer.concat([cipher.update(JSON.stringify(value)),cipher.final()]),payload=[iv,cipher.getAuthTag(),data].map(v=>v.toString('base64')).join('.');this.db.prepare('INSERT INTO connector_secrets VALUES(?,?,?,?) ON CONFLICT(user_id,instance_id,name) DO UPDATE SET payload=excluded.payload').run(this.userId,this.instanceId,name,payload);this.assert();}
 clear(name:string){this.assert();this.db.prepare('DELETE FROM connector_secrets WHERE user_id=? AND instance_id=? AND name=?').run(this.userId,this.instanceId,name);}
 state<T>(name:string):ConnectorState<T>{return {read:async()=>this.read<T>(name),write:async value=>this.write(name,value),clear:async()=>this.clear(name),flush:async()=>{}};}
}
