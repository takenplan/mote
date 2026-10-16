import {createHash,randomUUID,randomBytes} from 'node:crypto';
import type {DatabaseSync} from 'node:sqlite';
import {z} from 'zod';
import {AuthError} from './accounts.js';
import {ScopeError} from './baseline.js';
import type {UserContext} from './context.js';
import type {ScopedRuntime} from './http.js';
import {LifecycleAuthority,type LifecycleContext,type UserExport,type DeletionReceipt} from './lifecycle.js';
import {PrivateCursor} from './private-data-sql.js';

const hash=(value:Buffer|string)=>createHash('sha256').update(value).digest('hex');
const operationId=z.string().uuid();
type State='working'|'completed'|'cancelled'|'failed'|'pending'|'result_unknown'|'blocked';
type Operation={id:string;user_id:string;kind:'export'|'delete';epoch:number;state:State;domains:string;created_at:string;updated_at:string;error:string|null;bytes:number|null;sha256:string|null};
const required=['private-data','configuration','execution','ingress','plugins','processing','connectors','memory','ask','ask-automation','mcp','owner-questions'];
// Providers must finish while their original configuration, references and
// pinned packages still exist. Keep dependent cleanup behind unknown results.
const deletionOrder=['execution','mcp','connectors','ask-automation','ask','processing','memory','owner-questions','ingress','private-data','plugins','configuration'];

/** A durable host journal, not an alternate identity or task executor. Grants
 * are internal locators for one approved operation/domain/purpose only. */
export class LifecycleOperations {
 readonly authority:LifecycleAuthority;
 private readonly cursorKey:string;
 private runtime:ScopedRuntime|undefined;
 private readonly active=new Map<string,Promise<void>>();
 private closed=false;
 constructor(private readonly db:DatabaseSync,readonly deploymentId:string,private readonly maxExportBytes=64*1024*1024){
  db.exec(`CREATE TABLE IF NOT EXISTS lifecycle_operations(id TEXT PRIMARY KEY,user_id TEXT NOT NULL,kind TEXT NOT NULL,epoch INTEGER NOT NULL,state TEXT NOT NULL,domains TEXT NOT NULL,created_at TEXT NOT NULL,updated_at TEXT NOT NULL,error TEXT,bytes INTEGER,sha256 TEXT);
   CREATE TABLE IF NOT EXISTS lifecycle_metadata(singleton INTEGER PRIMARY KEY CHECK(singleton=1),cursor_key TEXT NOT NULL);
   CREATE TABLE IF NOT EXISTS lifecycle_domains(operation_id TEXT NOT NULL REFERENCES lifecycle_operations(id),domain TEXT NOT NULL,state TEXT NOT NULL,grant_id TEXT NOT NULL UNIQUE,PRIMARY KEY(operation_id,domain));
   CREATE TABLE IF NOT EXISTS lifecycle_exports(operation_id TEXT PRIMARY KEY REFERENCES lifecycle_operations(id),content BLOB NOT NULL);
   CREATE INDEX IF NOT EXISTS lifecycle_operations_user ON lifecycle_operations(user_id,kind);`);
  db.prepare('INSERT OR IGNORE INTO lifecycle_metadata VALUES(1,?)').run(randomBytes(32).toString('hex'));this.cursorKey=String(db.prepare('SELECT cursor_key FROM lifecycle_metadata WHERE singleton=1').get()!.cursor_key);
  this.authority=new LifecycleAuthority(deploymentId,{verify:async grant=>{
   const row=this.db.prepare("SELECT o.id,o.user_id,d.domain FROM lifecycle_domains d JOIN lifecycle_operations o ON o.id=d.operation_id WHERE d.grant_id=? AND o.kind='delete' AND o.state IN ('working','pending','result_unknown','failed','blocked') AND d.state<>'complete'").get(grant);
   return row?{deploymentId,userId:String(row.user_id),domain:String(row.domain),operationId:String(row.id),purpose:'delete' as const}:undefined;
  },isCurrent:context=>this.current(context)});
 }
 bind(runtime:ScopedRuntime){if(this.runtime)throw new ScopeError('undeclared_scope',500);this.runtime=runtime;}
 private host():ScopedRuntime{if(!this.runtime||this.closed)throw new ScopeError('scope_unavailable',503);return this.runtime;}
 private current(context:LifecycleContext){return !this.closed&&context.deploymentId===this.deploymentId&&context.purpose==='delete'&&Boolean(this.db.prepare("SELECT 1 FROM lifecycle_operations o JOIN lifecycle_domains d ON d.operation_id=o.id JOIN auth_account_deletions a ON a.user_id=o.user_id AND a.operation_id=o.id WHERE o.id=? AND o.user_id=? AND o.kind='delete' AND o.state IN ('working','pending','result_unknown','failed','blocked') AND d.domain=? AND d.state<>'complete'").get(context.operationId,context.userId,context.domain));}
 private transaction<T>(work:()=>T){this.db.exec('BEGIN IMMEDIATE');try{const value=work();this.db.exec('COMMIT');return value;}catch(error){this.db.exec('ROLLBACK');throw error;}}
 private row(id:string){return this.db.prepare('SELECT * FROM lifecycle_operations WHERE id=?').get(operationId.parse(id)) as Operation|undefined;}
 private domains(){const domains=this.host().services.lifecycleDomains();if(required.some(id=>!domains.includes(id)))throw new ScopeError('scope_unavailable',503);return [...domains];}
 private create(id:string,userId:string,kind:Operation['kind'],epoch:number,domains:string[]){const at=new Date().toISOString();this.db.prepare("INSERT INTO lifecycle_operations VALUES(?,?,?,?,'working',?,?,?,NULL,NULL,NULL)").run(id,userId,kind,epoch,JSON.stringify(domains),at,at);for(const domain of domains)this.db.prepare("INSERT INTO lifecycle_domains VALUES(?,?,'waiting',?)").run(id,domain,randomUUID());return this.row(id)!;}
 private update(id:string,state:State,error:string|null=null){this.db.prepare('UPDATE lifecycle_operations SET state=?,updated_at=?,error=? WHERE id=?').run(state,new Date().toISOString(),error,id);}
 private receipt(row:Operation){return {id:row.id,kind:row.kind,userId:row.user_id,deploymentId:this.deploymentId,state:row.state,phase:row.state==='working'?(row.kind==='export'?'exporting':'erasing'):row.state,progress:{mode:'semantic' as const},scope:{kind:'account' as const},createdAt:row.created_at,updatedAt:row.updated_at,domains:this.db.prepare('SELECT domain,state FROM lifecycle_domains WHERE operation_id=? ORDER BY domain').all(row.id),...(row.error?{error:row.error}:{}),...(row.kind==='export'?{format:'mote-portable',version:3,coverage:{domains:JSON.parse(row.domains) as string[],credentials:false,activeAuthorization:false,instanceBackup:false},...(row.state==='completed'?{bytes:row.bytes,sha256:row.sha256,filename:`mote-portable-${row.id}.json`,contentType:'application/json; charset=utf-8'}:{})}:{logicalAccessRevoked:true})};}
 private own(context:UserContext,id:string){const runtime:ScopedRuntime=this.host();runtime.authority.assert(context);const row=this.row(id);if(!row||row.kind!=='export'||row.user_id!==context.userId)throw new AuthError('archive_not_found',404);if(row.epoch!==context.authorizationEpoch)throw new AuthError('archive_authorization_changed',409);return row;}
 exportReceipt(context:UserContext,id:string){return this.receipt(this.own(context,id));}
 listExports(context:UserContext,raw:unknown){const runtime:ScopedRuntime=this.host();runtime.authority.assert(context);const {limit,cursor}=z.object({limit:z.coerce.number().int().min(1).max(100).default(30),cursor:z.string().max(8192).optional()}).strict().parse(raw),identity={collection:'portable-exports',limit,epoch:context.authorizationEpoch},codec=new PrivateCursor(this.cursorKey,this.deploymentId,context.userId),position=cursor?codec.decode(cursor,identity):undefined;
  const rows=this.db.prepare(`SELECT * FROM lifecycle_operations WHERE user_id=? AND kind='export' AND epoch=? ${position?'AND(created_at<? OR(created_at=? AND id<?))':''} ORDER BY created_at DESC,id DESC LIMIT ?`).all(context.userId,context.authorizationEpoch,...(position?[position.at,position.at,position.id]:[]),limit+1) as Operation[],selected=rows.slice(0,limit),last=selected.at(-1);runtime.authority.assert(context);return {items:selected.map(row=>this.receipt(row)),nextCursor:rows.length>limit&&last?codec.encode(identity,{at:last.created_at,id:last.id}):null};
 }
 private launch(id:string,work:()=>Promise<void>){if(this.active.has(id))return;const promise=Promise.resolve().then(work).catch(()=>{if(!this.closed&&this.row(id)?.state==='working')this.update(id,'failed','lifecycle_failed');}).finally(()=>this.active.delete(id));this.active.set(id,promise);}
 export(context:UserContext,rawId:string){const id=operationId.parse(rawId);const runtime:ScopedRuntime=this.host();runtime.authority.assert(context);const prior=this.row(id);if(prior)return this.exportReceipt(context,id);const domains=this.domains(),row=this.transaction(()=>{runtime.authority.assert(context);return this.create(id,context.userId,'export',context.authorizationEpoch,domains);});this.launch(id,()=>this.writeExport(context,id));return this.receipt(row);}
 private async writeExport(context:UserContext,id:string){
  const runtime:ScopedRuntime=this.host(),assert:()=>void=()=>{runtime.authority.assert(context);if(this.closed||this.row(id)?.state!=='working')throw new AuthError('archive_cancelled',409);};
  try{
   assert();const domains=JSON.parse(this.row(id)!.domains) as string[];
   if(domains.some(domain=>!runtime.services.lifecycleDomains().includes(domain)))throw new ScopeError('scope_unavailable',503);
   // Warm the existing ConfigService first: opening its own defaults can write.
   // No SQLite transaction spans an asynchronous provider read. Changes during
   // the export invalidate the archive rather than returning mixed epochs.
   await runtime.services.forUser(context).exportUser('configuration');assert();
   const changes=()=>JSON.stringify([this.db.prepare('SELECT total_changes() n').get()!.n,this.db.prepare('PRAGMA data_version').get()!.data_version]);
   const before=changes(),archives:UserExport[]=[];
   for(const domain of domains){assert();const value=await runtime.services.forUser(context).exportUser(domain);assert();archives.push(value);}
   const configuration=await runtime.services.forUser(context).exportUser('configuration');assert();
   if(JSON.stringify(configuration)!==JSON.stringify(archives.find(value=>value.domain==='configuration'))||JSON.stringify(domains)!==JSON.stringify(runtime.services.lifecycleDomains()))throw new AuthError('archive_changed',409);
   if(before!==changes())throw new AuthError('archive_changed',409);
   const content=Buffer.from(JSON.stringify({format:'mote-portable',version:3,deploymentId:this.deploymentId,userId:context.userId,createdAt:this.row(id)!.created_at,coverage:{domains,credentials:false,activeAuthorization:false,instanceBackup:false},domains:archives}));
   if(content.length>this.maxExportBytes)throw new AuthError('archive_too_large',413);
   this.transaction(()=>{assert();this.db.prepare('INSERT INTO lifecycle_exports VALUES(?,?)').run(id,content);this.db.prepare("UPDATE lifecycle_domains SET state='complete' WHERE operation_id=?").run(id);this.db.prepare('UPDATE lifecycle_operations SET bytes=?,sha256=? WHERE id=?').run(content.length,hash(content),id);this.update(id,'completed');});
  }catch(error){if(this.closed)return;if(this.row(id)?.state==='cancelled')return;this.update(id,'failed',error instanceof AuthError?error.code:error instanceof ScopeError?'domain_unavailable':'domain_export_failed');}
 }
 retryExport(context:UserContext,id:string){const row=this.own(context,id);if(row.state!=='failed')throw new AuthError('archive_conflict',409);this.update(id,'working');this.launch(id,()=>this.writeExport(context,id));return this.exportReceipt(context,id);}
 cancelExport(context:UserContext,id:string){this.own(context,id);this.transaction(()=>{this.db.prepare('DELETE FROM lifecycle_exports WHERE operation_id=?').run(id);this.update(id,'cancelled');});return this.exportReceipt(context,id);}
 content(context:UserContext,id:string){const row=this.own(context,id);if(row.state!=='completed')throw new AuthError('archive_not_ready',409);const value=this.db.prepare('SELECT content FROM lifecycle_exports WHERE operation_id=?').get(id);if(!value)throw new AuthError('archive_not_ready',409);const bytes=Buffer.from(value.content as Uint8Array);if(bytes.length!==row.bytes||hash(bytes)!==row.sha256)throw new AuthError('archive_corrupt',409);const runtime:ScopedRuntime=this.host();runtime.authority.assert(context);return {bytes,sha256:row.sha256!,filename:`mote-portable-${id}.json`};}
 deleteAccount(context:UserContext,userId:string,rawId:string){const runtime=this.host();runtime.authority.assertAdministrator(context);const id=operationId.parse(rawId),prior=this.row(id);if(prior){if(prior.kind!=='delete'||prior.user_id!==userId)throw new AuthError('deletion_conflict',409);return this.receipt(prior);}const domains=this.domains();const row=this.transaction(()=>{runtime.accounts!.beginDeletion(context,runtime.authority,userId,id);for(const old of this.db.prepare("SELECT id FROM lifecycle_operations WHERE user_id=? AND kind='export'").all(userId)){this.db.prepare('DELETE FROM lifecycle_exports WHERE operation_id=?').run(old.id);this.update(String(old.id),'cancelled');}return this.create(id,userId,'delete',0,domains);});this.launch(id,()=>this.erase(id));return this.receipt(row);}
 deletionReceipt(context:UserContext,id:string){this.host().authority.assertAdministrator(context);const row=this.row(id);if(!row||row.kind!=='delete')throw new AuthError('deletion_not_found',404);return this.receipt(row);}
 retryDeletion(context:UserContext,id:string){const runtime=this.host();runtime.authority.assertAdministrator(context);const row=this.row(id);if(!row||row.kind!=='delete')throw new AuthError('deletion_not_found',404);if(row.state==='completed')return this.receipt(row);this.update(id,'working');this.launch(id,()=>this.erase(id));return this.receipt(this.row(id)!);}
 private async erase(id:string){
  const runtime=this.host(),domains=JSON.parse(this.row(id)!.domains) as string[],rank=(id:string)=>{const value=deletionOrder.indexOf(id);return value<0?deletionOrder.indexOf('plugins'):value;};
  for(const domain of [...domains].sort((a,b)=>rank(a)-rank(b)||a.localeCompare(b))){
   if(this.closed)return;const row=this.db.prepare('SELECT * FROM lifecycle_domains WHERE operation_id=? AND domain=?').get(id,domain)!;if(row.state==='complete')continue;
   if(!runtime.services.lifecycleDomains().includes(domain)){this.update(id,'blocked','domain_unavailable');return;}
   try{const grant=await this.authority.authorize(String(row.grant_id));if(this.closed)return;const receipt=await runtime.services.forLifecycle(grant).run() as DeletionReceipt;this.authority.assert(grant);if(receipt.operationId!==id||!['complete','pending','result_unknown'].includes(receipt.status))throw new AuthError('invalid_deletion_receipt',503);this.db.prepare('UPDATE lifecycle_domains SET state=? WHERE operation_id=? AND domain=?').run(receipt.status,id,domain);if(receipt.status!=='complete'){this.update(id,receipt.status);return;}}
   catch{if(!this.closed)this.update(id,'failed','domain_delete_failed');return;}
  }
  if(!this.closed)this.update(id,'completed');
 }
 /** A crashed export has no live owner capability to resume. Delete operations
  * retain their explicit approval, but retry is an administrator action. */
 recover(){this.db.prepare("UPDATE lifecycle_operations SET state='failed',error='interrupted' WHERE state='working'").run();}
 async close(){this.closed=true;await Promise.allSettled(this.active.values());}
}
