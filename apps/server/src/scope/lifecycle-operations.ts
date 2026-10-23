import {createHash,randomUUID,randomBytes} from 'node:crypto';
import type {DatabaseSync} from 'node:sqlite';
import {z} from 'zod';
import {AuthError} from './accounts.js';
import {ScopeError} from './baseline.js';
import type {UserContext,OperationIdentityVerifier,VerifiedOperationIdentity} from './context.js';
import type {ScopedRuntime} from './http.js';
import {LifecycleAuthority,type LifecycleContext,type UserExport,type DeletionReceipt} from './lifecycle.js';
import {PrivateDataError,PrivateCursor} from './private-data-sql.js';
import {archiveReadSet} from './archive-read-set.js';
import {installExportErasure} from './lifecycle-export-retention.js';

const hash=(value:Buffer|string)=>createHash('sha256').update(value).digest('hex');
const operationId=z.string().uuid();
const personalArchive=z.object({format:z.literal('mote-portable'),version:z.literal(3),deploymentId:z.string(),userId:z.string(),createdAt:z.string().datetime({offset:true}),coverage:z.object({domains:z.array(z.string()),credentials:z.literal(false),activeAuthorization:z.literal(false),instanceBackup:z.literal(false)}).strict(),domains:z.array(z.object({domain:z.string(),version:z.number().int().positive(),deploymentId:z.string(),userId:z.string(),payload:z.unknown()}).strict())}).strict();
const importOrder=['private-data','ingress','processing','memory','ask'];
type State='working'|'completed'|'cancelled'|'failed'|'pending'|'result_unknown'|'blocked';
type Operation={id:string;user_id:string;kind:'export'|'delete'|'import';epoch:number;state:State;domains:string;created_at:string;updated_at:string;error:string|null;bytes:number|null;sha256:string|null};
const required=['private-data','configuration','execution','ingress','plugins','processing','connectors','memory','ask','ask-automation','mcp','owner-questions'];
// Providers must finish while their original configuration, references and
// pinned packages still exist. Keep dependent cleanup behind unknown results.
const deletionOrder=['execution','mcp','connectors','ask-automation','ask','processing','memory','owner-questions','ingress','private-data','plugins','configuration'];

/** A durable host journal, not an alternate identity or task executor. Grants
 * are internal locators for one approved operation/domain/purpose only. */
export class LifecycleOperations {
 readonly authority:LifecycleAuthority;
 readonly importVerifier:OperationIdentityVerifier={
  verify:async grantId=>{try{return this.importIdentity(grantId);}catch{return undefined;}},
  isCurrent:identity=>{try{const current=this.importIdentity(identity.credentialId);return JSON.stringify(current)===JSON.stringify(identity);}catch{return false;}},
 };
 private readonly cursorKey:string;
 private runtime:ScopedRuntime|undefined;
 private readonly active=new Map<string,Promise<void>>();
 private closed=false;
 private importPublication?: (context:UserContext,work:()=>void)=>void;
 bindImportPublication(publish:(context:UserContext,work:()=>void)=>void){if(this.importPublication)throw new ScopeError('undeclared_scope',500);this.importPublication=publish;}
 constructor(private readonly db:DatabaseSync,readonly deploymentId:string,readonly maxExportBytes=64*1024*1024){
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
 private importIdentity(grantId:string):VerifiedOperationIdentity{
  const runtime=this.host(),row=this.db.prepare("SELECT o.* FROM lifecycle_operations o JOIN lifecycle_domains d ON d.operation_id=o.id WHERE d.grant_id=? AND d.domain='configuration' AND o.kind='import' AND o.state='working'").get(grantId) as Operation|undefined;
  if(!row||!row.sha256||!runtime.accounts)throw new ScopeError('invalid_identity',401);
  runtime.accounts.assertAccountEnabled(row.user_id,row.epoch);
  const admitted=this.db.prepare('SELECT domain,state FROM lifecycle_domains WHERE operation_id=? ORDER BY domain').all(row.id);
  const names=admitted.map(item=>String(item.domain)),writeDomains=admitted.filter(item=>item.state!=='preserved').map(item=>String(item.domain));
  const current=runtime.services.personalImportDomains();
  if(JSON.stringify(names)!==JSON.stringify((JSON.parse(row.domains) as string[]).sort())||JSON.stringify(names)!==JSON.stringify(current.map(item=>item.id))||current.some(item=>item.mode!==(writeDomains.includes(item.id)?'merge':'preserve')))throw new ScopeError('invalid_identity',401);
  return {deploymentId:this.deploymentId,userId:row.user_id,credentialId:grantId,authorizationEpoch:row.epoch,administrator:false,operation:{id:row.id,purpose:'personal-import',digest:row.sha256,readDomains:[...new Set(['configuration',...writeDomains])].sort(),writeDomains}};
 }
 private log(event:string,fields:Parameters<NonNullable<ScopedRuntime['diagnostics']>['record']>[1]={},level:'debug'|'info'|'warn'|'error'='info'){this.runtime?.diagnostics?.record(event,fields,level);}
 private current(context:LifecycleContext){return !this.closed&&context.deploymentId===this.deploymentId&&context.purpose==='delete'&&Boolean(this.db.prepare("SELECT 1 FROM lifecycle_operations o JOIN lifecycle_domains d ON d.operation_id=o.id JOIN auth_account_deletions a ON a.user_id=o.user_id AND a.operation_id=o.id WHERE o.id=? AND o.user_id=? AND o.kind='delete' AND o.state IN ('working','pending','result_unknown','failed','blocked') AND d.domain=? AND d.state<>'complete'").get(context.operationId,context.userId,context.domain));}
 private transaction<T>(work:()=>T){this.db.exec('BEGIN IMMEDIATE');try{const value=work();this.db.exec('COMMIT');return value;}catch(error){this.db.exec('ROLLBACK');throw error;}}
 private row(id:string){return this.db.prepare('SELECT * FROM lifecycle_operations WHERE id=?').get(operationId.parse(id)) as Operation|undefined;}
 private domains(){const domains=this.host().services.lifecycleDomains();if(required.some(id=>!domains.includes(id)))throw new ScopeError('scope_unavailable',503);return [...domains];}
 private create(id:string,userId:string,kind:Operation['kind'],epoch:number,domains:string[]){const at=new Date().toISOString();this.db.prepare("INSERT INTO lifecycle_operations VALUES(?,?,?,?,'working',?,?,?,NULL,NULL,NULL)").run(id,userId,kind,epoch,JSON.stringify(domains),at,at);for(const domain of domains)this.db.prepare("INSERT INTO lifecycle_domains VALUES(?,?,'waiting',?)").run(id,domain,randomUUID());return this.row(id)!;}
 private update(id:string,state:State,error:string|null=null){this.db.prepare('UPDATE lifecycle_operations SET state=?,updated_at=?,error=? WHERE id=?').run(state,new Date().toISOString(),error,id);}
 private receipt(row:Operation){return {id:row.id,kind:row.kind,userId:row.user_id,deploymentId:this.deploymentId,state:row.state,phase:row.state==='working'?(row.kind==='export'?'exporting':row.kind==='import'?'validating':'erasing'):row.state,progress:{mode:'semantic' as const},scope:{kind:'account' as const},createdAt:row.created_at,updatedAt:row.updated_at,domains:this.db.prepare('SELECT domain,state FROM lifecycle_domains WHERE operation_id=? ORDER BY domain').all(row.id),...(row.error?{error:row.error}:{}),...(row.kind==='export'?{format:'mote-portable',version:3,coverage:{domains:JSON.parse(row.domains) as string[],credentials:false,activeAuthorization:false,instanceBackup:false},...(row.state==='completed'?{bytes:row.bytes,sha256:row.sha256,filename:`mote-portable-${row.id}.json`,contentType:'application/json; charset=utf-8'}:{})}:row.kind==='import'?{format:'mote-portable',version:3,coverage:{importedDomains:this.db.prepare("SELECT domain FROM lifecycle_domains WHERE operation_id=? AND state<>'preserved' ORDER BY domain").all(row.id).map(value=>String(value.domain)),preservedDomains:this.db.prepare("SELECT domain FROM lifecycle_domains WHERE operation_id=? AND state='preserved' ORDER BY domain").all(row.id).map(value=>String(value.domain)),credentials:false,activeAuthorization:false,instanceBackup:false}}:{logicalAccessRevoked:true})};}
 private own(context:UserContext,id:string){const runtime:ScopedRuntime=this.host();runtime.authority.assert(context);const row=this.row(id);if(!row||row.kind!=='export'||row.user_id!==context.userId)throw new AuthError('archive_not_found',404);if(row.epoch!==context.authorizationEpoch)throw new AuthError('archive_authorization_changed',409);return row;}
 exportReceipt(context:UserContext,id:string){return this.receipt(this.own(context,id));}
 listImports(context:UserContext,raw:unknown){return this.listPersonal(context,raw,'import');}
 private listPersonal(context:UserContext,raw:unknown,kind:'export'|'import'){const runtime:ScopedRuntime=this.host();runtime.authority.assert(context);const {limit,cursor}=z.object({limit:z.coerce.number().int().min(1).max(100).default(30),cursor:z.string().max(8192).optional()}).strict().parse(raw),identity={collection:'portable-'+kind+'s',limit,epoch:context.authorizationEpoch},codec=new PrivateCursor(this.cursorKey,this.deploymentId,context.userId),position=cursor?codec.decode(cursor,identity):undefined;
  const rows=this.db.prepare(`SELECT * FROM lifecycle_operations WHERE user_id=? AND kind=? AND epoch=? ${position?'AND(created_at<? OR(created_at=? AND id<?))':''} ORDER BY created_at DESC,id DESC LIMIT ?`).all(context.userId,kind,context.authorizationEpoch,...(position?[position.at,position.at,position.id]:[]),limit+1) as Operation[],selected=rows.slice(0,limit),last=selected.at(-1);runtime.authority.assert(context);return {items:selected.map(row=>this.receipt(row)),nextCursor:rows.length>limit&&last?codec.encode(identity,{at:last.created_at,id:last.id}):null};
 }
 private launch(id:string,work:()=>Promise<void>){if(this.active.has(id))return;const promise=Promise.resolve().then(work).catch(error=>{if(!this.closed&&this.row(id)?.state==='working')this.update(id,'failed','lifecycle_failed');this.log('lifecycle.operation_failed',{operationId:id,errorName:error instanceof Error?error.name:undefined,detail:error instanceof Error?error.message:undefined},'error');}).finally(()=>this.active.delete(id));this.active.set(id,promise);}
 private async generateExport(context:UserContext,id:string,assert:()=>void){
  const runtime=this.host();
   assert();const domains=JSON.parse(this.row(id)!.domains) as string[];
   if(domains.some(domain=>!runtime.services.lifecycleDomains().includes(domain)))throw new ScopeError('scope_unavailable',503);
   // Warm the existing ConfigService first: opening its own defaults can write.
   // No SQLite transaction spans an asynchronous provider read. Changes during
   // the export invalidate the archive rather than returning mixed epochs.
   await runtime.services.forUser(context).exportUser('configuration');assert();
   const snapshot=await archiveReadSet(context.userId,async()=>{
    // Begin every independent domain read before awaiting providers. Canonical
    // SQL snapshots are thus observed before a slow external Memory read, and
    // the final witness still rechecks every observed dependency atomically.
    const results=await Promise.allSettled(domains.map(async domain=>{assert();const value=await runtime.services.forUser(context).exportUser(domain);assert();return value;}));
    const failure=results.find(value=>value.status==='rejected');if(failure?.status==='rejected')throw failure.reason;
    const archives:UserExport[]=results.map(value=>(value as PromiseFulfilledResult<UserExport>).value);
    const configuration=await runtime.services.forUser(context).exportUser('configuration');assert();
    if(JSON.stringify(configuration)!==JSON.stringify(archives.find(value=>value.domain==='configuration')))throw new AuthError('archive_changed',409);
    return archives;
   }),archives=snapshot.value;
   const content=Buffer.from(JSON.stringify({format:'mote-portable',version:3,deploymentId:this.deploymentId,userId:context.userId,createdAt:this.row(id)!.created_at,coverage:{domains,credentials:false,activeAuthorization:false,instanceBackup:false},domains:archives}));
   if(content.length>this.maxExportBytes)throw new AuthError('archive_too_large',413);
   return {content,domains,current:()=>{assert();if(!snapshot.current()||JSON.stringify(domains)!==JSON.stringify(runtime.services.lifecycleDomains()))throw new AuthError('archive_changed',409);}};
 }
 private publishExport(id:string,value:Awaited<ReturnType<LifecycleOperations['generateExport']>>){
  this.transaction(()=>{value.current();this.db.prepare("UPDATE lifecycle_domains SET state='complete' WHERE operation_id=?").run(id);this.db.prepare('UPDATE lifecycle_operations SET bytes=?,sha256=? WHERE id=?').run(value.content.length,hash(value.content),id);this.update(id,'completed');});
 }
 /** One original user action generates and delivers a current full archive.
  * A no-content receipt may survive; no raw archive is persisted or retained by
  * the host after this request finishes. */
 async download(context:UserContext,signal:AbortSignal){
  const id=randomUUID(),runtime:ScopedRuntime=this.host();runtime.authority.assert(context);const domains=this.domains();this.transaction(()=>this.create(id,context.userId,'export',context.authorizationEpoch,domains));
  this.log('lifecycle.export_started',{userId:context.userId,operationId:id,count:domains.length});
  const abort=()=>{if(!this.closed&&this.row(id)?.state==='working')this.update(id,'cancelled');};signal.addEventListener('abort',abort,{once:true});
  const assert=()=>{signal.throwIfAborted();runtime.authority.assert(context);if(this.closed||this.row(id)?.state!=='working')throw new AuthError('archive_cancelled',409);};
  try{const value=await this.generateExport(context,id,assert);this.publishExport(id,value);this.log('lifecycle.export_completed',{userId:context.userId,operationId:id,bytes:value.content.length,count:domains.length});return this.delivery(context,id,value.content,signal);}
  catch(error){if(!this.closed&&this.row(id)?.state!=='cancelled')this.update(id,'failed',error instanceof AuthError?error.code:error instanceof ScopeError?'domain_unavailable':'domain_export_failed');this.log('lifecycle.export_failed',{userId:context.userId,operationId:id,category:error instanceof AuthError?error.code:undefined,errorName:error instanceof Error?error.name:undefined,detail:error instanceof Error?error.message:undefined},'warn');throw error;}
  finally{signal.removeEventListener('abort',abort);}
 }
 private delivery(context:UserContext,id:string,bytes:Buffer,signal?:AbortSignal){
  const runtime:ScopedRuntime=this.host(),row=this.own(context,id),deadline=this.snapshotDeadline(bytes),assert=()=>{signal?.throwIfAborted();runtime.authority.assert(context);if(this.row(id)?.state!=='completed')throw new AuthError('archive_changed',409);if(Date.now()>=deadline){this.update(id,'failed','archive_changed');throw new AuthError('archive_changed',409);}};
  assert();return {operationId:id,bytes,sha256:row.sha256!,filename:`mote-portable-${id}.json`,assert,finish:(completed:boolean)=>{if(!completed&&!this.closed&&this.row(id)?.state==='completed')this.update(id,'failed','delivery_interrupted');}};
 }
 private snapshotDeadline(bytes:Buffer){
  const ingress=(JSON.parse(bytes.toString()) as {domains:UserExport[]}).domains.find(domain=>domain.domain==='ingress')?.payload as {originals?:{id:string;hash:string}[];objects?:{hash:string}[];snapshots?:{id:string;expires:number}[]}|undefined;
  const included=new Set(ingress?.objects?.map(value=>value.hash)),originals=new Map(ingress?.originals?.map(value=>[value.id,value.hash]));return (ingress?.snapshots??[]).reduce((at,value)=>included.has(originals.get(value.id)!)?Math.min(at,value.expires):at,Infinity);
 }
 private ownImport(context:UserContext,id:string){const runtime:ScopedRuntime=this.host();runtime.authority.assert(context);const row=this.row(id);if(!row||row.kind!=='import'||row.user_id!==context.userId)throw new AuthError('archive_not_found',404);if(row.epoch!==context.authorizationEpoch)throw new AuthError('archive_authorization_changed',409);return row;}
 importReceipt(context:UserContext,id:string){return this.receipt(this.ownImport(context,id));}
 importArchive(context:UserContext,rawId:string,raw:unknown){
  const runtime:ScopedRuntime=this.host();runtime.authority.assert(context);const id=operationId.parse(rawId),archive=personalArchive.parse(raw),domains=this.domains(),plan=runtime.services.personalImportDomains();
  if(archive.userId!==context.userId||archive.deploymentId!==this.deploymentId||archive.domains.some(item=>item.userId!==context.userId||item.deploymentId!==this.deploymentId))throw new AuthError('archive_identity_mismatch',403);
  if(plan.some(domain=>domain.mode==='unavailable')||!this.importPublication)throw new AuthError('archive_import_unavailable',503);
  const expected=JSON.stringify([...domains].sort());if(JSON.stringify([...archive.coverage.domains].sort())!==expected||JSON.stringify(archive.domains.map(value=>value.domain).sort())!==expected)throw new AuthError('archive_incomplete',400);
  const bytes=Buffer.from(JSON.stringify(archive)),sha256=hash(bytes);if(bytes.length>this.maxExportBytes)throw new AuthError('archive_too_large',413);
  const prior=this.row(id);if(prior){const own=this.ownImport(context,id);if(own.sha256!==sha256)throw new AuthError('archive_conflict',409);if(own.state!=='failed')return this.receipt(own);this.update(id,'working');}
  else this.transaction(()=>{runtime.authority.assert(context);this.create(id,context.userId,'import',context.authorizationEpoch,domains);this.db.prepare('UPDATE lifecycle_operations SET bytes=?,sha256=? WHERE id=?').run(bytes.length,sha256,id);for(const domain of plan.filter(value=>value.mode==='preserve'))this.db.prepare("UPDATE lifecycle_domains SET state='preserved' WHERE operation_id=? AND domain=?").run(id,domain.id);});
  this.log('lifecycle.import_started',{userId:context.userId,operationId:id,bytes:bytes.length,count:domains.length});
  const grant=String(this.db.prepare("SELECT grant_id FROM lifecycle_domains WHERE operation_id=? AND domain='configuration'").get(id)!.grant_id);
  this.launch(id,async()=>{const operation=await runtime.authority.restoreOperation(grant);await this.writeImport(operation,id,archive);});return this.importReceipt(context,id);
 }
 cancelImport(context:UserContext,id:string){const row=this.ownImport(context,id);if(row.state==='completed')throw new AuthError('archive_already_committed',409);this.update(id,'cancelled');this.log('lifecycle.import_cancelled',{userId:context.userId,operationId:id});return this.importReceipt(context,id);}
 private async writeImport(context:UserContext,id:string,archive:z.infer<typeof personalArchive>){
  const runtime:ScopedRuntime=this.host(),cleanup:Array<()=>void>=[],assert=()=>{runtime.authority.assert(context);const claim=runtime.authority.operation(context);if(!claim||claim.id!==id)throw new AuthError('archive_conflict',409);if(this.closed||this.row(id)?.state!=='working')throw new AuthError('archive_cancelled',409);},assertArchive=()=>{assert();if(runtime.authority.operation(context)!.digest!==hash(JSON.stringify(archive)))throw new AuthError('archive_conflict',409);};
  try{
   assertArchive();const policy=runtime.services.personalImportDomains(),merged=policy.filter(value=>value.mode==='merge').map(value=>value.id).sort((a,b)=>{const x=importOrder.indexOf(a),y=importOrder.indexOf(b);return (x<0?importOrder.length:x)-(y<0?importOrder.length:y)||a.localeCompare(b);});
   await runtime.services.forUser(context).exportUser('configuration');assert();
   // Verify actual current provider bodies outside SQLite. No asynchronous
   // hook, native provider or model runs inside the publication transaction.
   const snapshot=await archiveReadSet(context.userId,async()=>{
    await runtime.services.forUser(context).exportUser('configuration');assert();
    for(const domain of merged){await runtime.services.forUser(context).exportUser(domain);assert();}
   });
   this.transaction(()=>{assertArchive();if(!snapshot.current()||JSON.stringify(policy)!==JSON.stringify(runtime.services.personalImportDomains()))throw new AuthError('archive_changed',409);this.importPublication!(context,()=>{for(const domain of merged){assert();const rollback=runtime.services.forUser(context).importUser(domain,{...archive.domains.find(item=>item.domain===domain)!,payload:archive.domains.find(item=>item.domain===domain)!.payload},id);if(rollback!==undefined){if(typeof rollback!=='function')throw new ScopeError('undeclared_scope',500);cleanup.push(rollback);}this.db.prepare("UPDATE lifecycle_domains SET state='complete' WHERE operation_id=? AND domain=?").run(id,domain);}assertArchive();});this.update(id,'completed');});
   this.log('lifecycle.import_completed',{userId:context.userId,operationId:id,count:merged.length});
  }catch(error){let clean=true;for(const rollback of cleanup.reverse())try{rollback();}catch{clean=false;}if(this.closed||this.row(id)?.state==='cancelled')return;const code=!clean?'archive_cleanup_required':error instanceof AuthError?error.code:error instanceof PrivateDataError&&error.code==='conflict'?'archive_conflict':error instanceof ScopeError?'domain_unavailable':'archive_invalid';this.update(id,'failed',code);this.log('lifecycle.import_failed',{userId:context.userId,operationId:id,category:code,errorName:error instanceof Error?error.name:undefined,detail:error instanceof Error?error.message:undefined},'error');}
 }
 deleteAccount(context:UserContext,userId:string,rawId:string){const runtime=this.host();runtime.authority.assertAdministrator(context);const id=operationId.parse(rawId),prior=this.row(id);if(prior){if(prior.kind!=='delete'||prior.user_id!==userId)throw new AuthError('deletion_conflict',409);return this.receipt(prior);}const domains=this.domains();const row=this.transaction(()=>{this.db.prepare('DELETE FROM lifecycle_future WHERE user_id=?').run(userId);runtime.accounts!.beginDeletion(context,runtime.authority,userId,id);for(const old of this.db.prepare("SELECT id FROM lifecycle_operations WHERE user_id=? AND kind IN ('export','import')").all(userId)){this.db.prepare('DELETE FROM lifecycle_exports WHERE operation_id=?').run(old.id);this.update(String(old.id),'cancelled');}return this.create(id,userId,'delete',0,domains);});this.log('lifecycle.delete_started',{userId:context.userId,accountId:userId,operationId:id,count:domains.length});this.launch(id,()=>this.erase(id));return this.receipt(row);}
 deletionReceipt(context:UserContext,id:string){this.host().authority.assertAdministrator(context);const row=this.row(id);if(!row||row.kind!=='delete')throw new AuthError('deletion_not_found',404);return this.receipt(row);}
 retryDeletion(context:UserContext,id:string){const runtime=this.host();runtime.authority.assertAdministrator(context);const row=this.row(id);if(!row||row.kind!=='delete')throw new AuthError('deletion_not_found',404);if(row.state==='completed'||this.active.has(id))return this.receipt(row);const domains=[...new Set([...(JSON.parse(row.domains) as string[]),...this.domains()])];this.transaction(()=>{for(const domain of domains)this.db.prepare("INSERT OR IGNORE INTO lifecycle_domains VALUES(?,?,'waiting',?)").run(id,domain,randomUUID());this.db.prepare('UPDATE lifecycle_operations SET domains=? WHERE id=?').run(JSON.stringify(domains),id);this.update(id,'working');});this.log('lifecycle.delete_retried',{userId:context.userId,accountId:row.user_id,operationId:id,count:domains.length});this.launch(id,()=>this.erase(id));return this.receipt(this.row(id)!);}
 private async erase(id:string){
  const runtime=this.host(),domains=JSON.parse(this.row(id)!.domains) as string[],rank=(id:string)=>{const value=deletionOrder.indexOf(id);return value<0?deletionOrder.indexOf('plugins'):value;};
  for(const domain of [...domains].sort((a,b)=>rank(a)-rank(b)||a.localeCompare(b))){
   if(this.closed)return;const row=this.db.prepare('SELECT * FROM lifecycle_domains WHERE operation_id=? AND domain=?').get(id,domain)!;if(row.state==='complete')continue;
   if(!runtime.services.lifecycleDomains().includes(domain)){this.update(id,'blocked','domain_unavailable');return;}
   try{const grant=await this.authority.authorize(String(row.grant_id));if(this.closed)return;const receipt=await runtime.services.forLifecycle(grant).run() as DeletionReceipt;this.authority.assert(grant);if(receipt.operationId!==id||!['complete','pending','result_unknown'].includes(receipt.status))throw new AuthError('invalid_deletion_receipt',503);this.db.prepare('UPDATE lifecycle_domains SET state=? WHERE operation_id=? AND domain=?').run(receipt.status,id,domain);this.log('lifecycle.domain_deleted',{operationId:id,name:domain,state:receipt.status},'debug');if(receipt.status!=='complete'){this.update(id,receipt.status);return;}}
   catch(error){if(!this.closed)this.update(id,'failed','domain_delete_failed');this.log('lifecycle.domain_delete_failed',{operationId:id,name:domain,errorName:error instanceof Error?error.name:undefined,detail:error instanceof Error?error.message:undefined},'error');return;}
  }
  if(!this.closed&&JSON.stringify([...this.domains()].sort())!==JSON.stringify([...domains].sort())){this.update(id,'blocked','domain_registry_changed');return;}
  if(!this.closed){const userId=this.row(id)!.user_id;this.transaction(()=>{runtime.accounts!.finishDeletion(userId,id);this.update(id,'completed');});this.log('lifecycle.delete_completed',{accountId:userId,operationId:id});}
 }
 /** A crashed export has no live owner capability to resume. Delete operations
  * retain their explicit approval, but retry is an administrator action. */
 recover(){installExportErasure(this.db);this.db.prepare("UPDATE lifecycle_operations SET state='failed',error='interrupted' WHERE state='working'").run();}
 async close(){this.closed=true;await Promise.allSettled(this.active.values());}
}
