import {attachmentBinding,attachmentVisible} from './ingress-attachments.js';
import {fileForgetting} from './ingress-file-forget.js';
import {ScopedImportAttribution,importDeclarationSchema} from './import-attribution.js';
import {createHmac,timingSafeEqual,randomUUID} from 'node:crypto';
import type {DatabaseSync} from 'node:sqlite';
import {z} from 'zod';
import {heartbeatSchema,captureSchema,sourceItemSchema,sourceIdSchema,sourceConnectionSchema,fileRevisionSchema,FILE_PART_BYTES,type CaptureInput,type SourceItem} from '@mote/shared';
import type {UserContext,UserContextAuthority} from './context.js';
import type {ScopedRuntime} from './http.js';
import {ScopeError} from './baseline.js';
import {PrivateSql,PrivateDataError,missing} from './private-data-sql.js';
import {PrivateData} from './private-data.js';
import {materialDraftSchema} from './material-model.js';
import {Originals,identityHash,bytesHash,type Original,type OriginalWorkspace} from './originals.js';
import {installIngress,ingressActivity} from './ingress-schema.js';
import {ingressLifecycle} from './ingress-lifecycle.js';
import type {UserDataSubject} from './lifecycle.js';
import {importUploadData,recordArchivedFile} from './import-upload-data.js';
import {archiveRelativePath,MAX_FILE_BYTES} from '../archive-contract.js';

export const INGRESS_DOMAIN='ingress';
const batchId=z.string().min(1).max(256);
const conflict=()=>new PrivateDataError('conflict',409);
export const strictBase64=(value:string)=>{if(value.length%4!==0||!/^[A-Za-z0-9+/]*={0,2}$/.test(value))throw new PrivateDataError('invalid_data');const bytes=Buffer.from(value,'base64');if(bytes.toString('base64')!==value)throw new PrivateDataError('invalid_data');return bytes;};
const captureId=(sourceId:string,item:SourceItem)=>{const digest=identityHash([sourceId,item.externalId,item.revision]);return `${digest.slice(0,8)}-${digest.slice(8,12)}-5${digest.slice(13,16)}-a${digest.slice(17,20)}-${digest.slice(20,32)}`;};
export type IngressOriginalFormat='capture'|'source-item'|'file'|`processor:${string}`;
type SuppliedOriginal={bytes:Buffer;mime:string;format?:'source-item'|'file'|`processor:${string}`};
export type IngressReceipt={version:3;id:string;deploymentId:string;userId:string;sourceId:string;batchId:string;state:'received';captures:{id:string;duplicate:boolean;original?:Original}[]};
export interface SourceCapability {
 receiveCaptures(sourceId:string,batchId:string,values:unknown[]):IngressReceipt;
 receiveSourceItems(sourceId:string,batchId:string,values:unknown[]):IngressReceipt;
 readOriginal(ref:string,range?:{offset?:number;length?:number}):ReturnType<Originals['read']>;
 pageOriginals(sourceId:string,after?:string,limit?:number):{items:Original[];nextCursor:string|null};
 publishMaterial(draft:unknown,expectedRevision?:string):ReturnType<PrivateData['publishMaterial']>;
 withWorkspace<T>(work:(workspace:OriginalWorkspace)=>Promise<T>):Promise<T>;
}

/** Only the host retains this registrar. Plugins receive bindSource's frozen
 * facade, never an authority, context, SQL connection or arbitrary path. */
export class IngressHost{
 readonly key:string;
 private readonly active=new Set<string>();
 private readonly importCommits=new Map<string,Promise<unknown>>();
 private readonly accepted=new Set<(context:UserContext,receipt:IngressReceipt,format:IngressOriginalFormat,formats:Readonly<Record<string,IngressOriginalFormat>>)=>void>();
 private fileRetirement?:(context:UserContext,refs:readonly string[])=>void;
 configureFileRetirement(retire:(context:UserContext,refs:readonly string[])=>void){this.fileRetirement=retire;}
 private fileProfiles?:{prepare:(context:UserContext,id:string)=>Promise<void>;bind:(context:UserContext,ref:string,id:string)=>void};
 configureFileProfiles(profiles:{prepare:(context:UserContext,id:string)=>Promise<void>;bind:(context:UserContext,ref:string,id:string)=>void}){this.fileProfiles=profiles;}
 async prepareFileProfile(context:UserContext,id:string){this.runtime.authority.assert(context);z.string().regex(/^[a-z][a-z0-9.-]{0,99}$/).parse(id);if(!this.fileProfiles)throw new PrivateDataError('scope_unavailable',503);await this.fileProfiles.prepare(context,id);this.runtime.authority.assert(context);}
 private bindFileProfile(context:UserContext,ref:string,id:string){this.runtime.authority.assert(context);if(!this.fileProfiles)throw new PrivateDataError('scope_unavailable',503);this.fileProfiles.bind(context,ref,id);this.runtime.authority.assert(context);}
 private snapshotRecovery?:{needed:(context:UserContext,ref:string)=>boolean;restored:(context:UserContext,ref:string)=>void};
 configureSnapshotRecovery(policy:{needed:(context:UserContext,ref:string)=>boolean;restored:(context:UserContext,ref:string)=>void}){this.snapshotRecovery=policy;}
 onAccepted(receive:(context:UserContext,receipt:IngressReceipt,format:IngressOriginalFormat,formats:Readonly<Record<string,IngressOriginalFormat>>)=>void){this.accepted.add(receive);return ()=>{this.accepted.delete(receive);};}
 constructor(private readonly runtime:ScopedRuntime,private readonly db:DatabaseSync,private readonly directory:string){
  this.key=installIngress(db);
  runtime.services.registerUser(INGRESS_DOMAIN,{scope:'user',create:context=>this.forUser(context),lifecycle:ingressLifecycle(runtime,db,directory)});
 }
 private deletionSql(subject:UserDataSubject){
  const assert=()=>{this.runtime.services.assertSubject(subject,INGRESS_DOMAIN,'delete');if('credentialId' in subject)throw new ScopeError('invalid_identity',403);};
  const sql=new PrivateSql(this.db,subject.userId,assert);if(!sql.get('SELECT deleted FROM ig_state WHERE user_id=$user')?.deleted)throw conflict();return sql;
 }
 /** M16 may reconcile a crashed local activity only after independently
  * observing that its old process/worker has stopped. This cannot read data,
  * renew an upload/task grant, or settle a known live operation. */
 pendingErasure(subject:UserDataSubject){return this.deletionSql(subject).all('SELECT id FROM ig_activity WHERE user_id=$user ORDER BY id').map(row=>({id:String(row.id),live:this.active.has(identityHash([subject.userId,row.id]))}));}
 settleErasure(subject:UserDataSubject,id:string,outcome:'stopped'){
  const sql=this.deletionSql(subject);if(outcome!=='stopped'||this.active.has(identityHash([subject.userId,id])))throw conflict();sql.run('DELETE FROM ig_activity WHERE user_id=$user AND id=?',id);
 }
 bindSource(context:UserContext,sourceIds:readonly string[],assertCurrent:()=>void):SourceCapability{
  const ids=Object.freeze([...new Set(z.array(sourceIdSchema).min(1).parse(sourceIds))]);
  const service=this.forUser(context,ids,assertCurrent);
  return Object.freeze({receiveCaptures:service.receiveCaptures,receiveSourceItems:service.receiveSourceItems,readOriginal:service.readOriginal,pageOriginals:service.pageOriginals,publishMaterial:service.publishMaterial,withWorkspace:service.withWorkspace});
 }
 /** Host-only retention of a fixed container worker's expanded original. This
  * is absent from both the user facade and plugin SourceCapability. The exact
  * existing task context fences M03's shared worker before/after its await. */
 async retainArchive(context:UserContext,name:string,bytes:Buffer,mimeType?:string,signal?:AbortSignal){
  archiveRelativePath(name);if(bytes.length>MAX_FILE_BYTES)throw new PrivateDataError('invalid_data',413);
  const assert=()=>{this.runtime.authority.assert(context);signal?.throwIfAborted();},sql=new PrivateSql(this.db,context.userId,assert),originals=new Originals(this.directory,context.deploymentId,sql,assert),id=randomUUID();
  assert();if(sql.get('SELECT deleted FROM ig_state WHERE user_id=$user')?.deleted)throw conflict();
  const activity=ingressActivity(this.db,context.userId),key=identityHash([context.userId,activity.id]);this.active.add(key);
  try{
   const parts:{part:number;bytes:number;hash:string}[]=[];for(let offset=0;offset<bytes.length;offset+=FILE_PART_BYTES){const part=bytes.subarray(offset,offset+FILE_PART_BYTES),index=parts.length;originals.writePart(id,index,part);parts.push({part:index,bytes:part.length,hash:bytesHash(part)});}
   const prepared=await originals.prepareArchive(id,bytes.length,parts,signal);assert();return sql.transaction(()=>recordArchivedFile(sql,prepared.hash,name,bytes.length,mimeType));
  }finally{originals.cleanUpload(id);this.active.delete(key);activity.finish();}
 }
 forUser(context:UserContext,sourceIds?:readonly string[],assertCurrent:()=>void=()=>{}){
  const authority:UserContextAuthority=this.runtime.authority;const base=()=>{authority.assert(context);assertCurrent();},state=new PrivateSql(this.db,context.userId,base);
  const assert=()=>{base();if(state.get('SELECT deleted FROM ig_state WHERE user_id=$user')?.deleted)throw new ScopeError('invalid_identity',401);};
  assert();const sql=new PrivateSql(this.db,context.userId,assert),originals=new Originals(this.directory,context.deploymentId,sql,assert);
  const data=()=>this.runtime.services.forUser(context).get<PrivateData>('private-data');
  const deviceId=authority.isTask(context)?undefined:this.runtime.accounts?.credentialInfo(context,authority).deviceId;
  const imports=new ScopedImportAttribution(sql),declaration=(sourceId:string,raw:unknown)=>{if(raw===undefined)return;if(sourceIds||deviceId||authority.isTask(context)||!['client','web'].includes(this.runtime.accounts!.credentialInfo(context,authority).kind))throw new ScopeError('invalid_identity',403);source(sourceId);return imports.freeze(sourceId,raw);};
  const source=(id:string)=>{
   assert();sourceIdSchema.parse(id);if(sourceIds&&!sourceIds.includes(id))throw missing();const result=data().source(id);
   if(deviceId&&result.deviceId!==deviceId)throw missing();if(!result.enabled)throw conflict();return result;
  };
  const original=(ref:string)=>{assert();const result=originals.original(ref);source(result.sourceId);attachmentBinding(sql,result.captureId);return result;};
  const forgetting=fileForgetting(sql,originals,data,()=>{assert();if(sourceIds||deviceId||authority.isTask(context))throw new ScopeError('invalid_identity',403);},source,refs=>{if(!this.fileRetirement)throw new PrivateDataError('scope_unavailable',503);this.fileRetirement(context,refs);});
  const recoveryKey=(ref:string)=>identityHash([ref,Number(sql.get('SELECT expires FROM ig_snapshot_inputs WHERE user_id=$user AND original_id=?',ref.slice(9))?.expires??0)]);
  const needsRecovery=(value:Original)=>{const binding=source(value.sourceId),record=data().capture(value.captureId),p=record.provenance;if(binding.retention!=='snapshot'||value.retention!=='snapshot'||value.available!==false||!p||p.layer!=='snapshot'||p.deleted||data().sourceItem(value.sourceId,p.externalId)?.captureId!==record.id)return false;if(!this.snapshotRecovery)throw new PrivateDataError('scope_unavailable',503);return this.snapshotRecovery.needed(context,value.ref);};
  const during=async<T>(work:()=>Promise<T>)=>{assert();const activity=ingressActivity(this.db,context.userId),key=identityHash([context.userId,activity.id]);this.active.add(key);try{return await work();}finally{this.active.delete(key);activity.finish();}};
  const serialize=async<T>(id:string,work:()=>Promise<T>)=>{const key=identityHash([context.userId,id]),prior=this.importCommits.get(key)??Promise.resolve(),next=prior.catch(()=>{}).then(work);this.importCommits.set(key,next);try{return await next;}finally{if(this.importCommits.get(key)===next)this.importCommits.delete(key);}};
  const archive=importUploadData(sql,originals,context.authorizationEpoch,()=>{assert();if(sourceIds||deviceId||authority.isTask(context))throw new ScopeError('invalid_identity',403);},during,serialize);
  const receipt=(sourceId:string,id:string,captures:IngressReceipt['captures']):IngressReceipt=>({version:3,id:identityHash([context.deploymentId,context.userId,sourceId,id]),deploymentId:context.deploymentId,userId:context.userId,sourceId,batchId:id,state:'received',captures});
  const checkReceipt=(value:IngressReceipt)=>{source(value.sourceId);return {...value,captures:value.captures.map(item=>{data().capture(item.id);return {...item,...(item.original?{original:original(item.original.ref)}:{})};})};};
  const batch=(sourceId:string,id:string,payload:unknown,format:IngressOriginalFormat,write:()=>IngressReceipt,formats:(receipt:IngressReceipt)=>Readonly<Record<string,IngressOriginalFormat>>=()=>({}))=>sql.transaction(()=>{
   source(sourceId);batchId.parse(id);const digest=identityHash(payload),previous=sql.get('SELECT digest,receipt FROM ig_batches WHERE user_id=$user AND source_id=? AND batch_id=?',sourceId,id);
   if(previous){if(previous.digest!==digest)throw conflict();return checkReceipt(JSON.parse(String(previous.receipt)));}
   const result=write();sql.run('INSERT INTO ig_batches VALUES($user,?,?,?,?)',sourceId,id,digest,JSON.stringify(result));assert();for(const receive of this.accepted)receive(context,result,format,Object.freeze(formats(result)));assert();return result;
  });
  const service={
   registerSource:(value:unknown)=>{assert();const input=sourceConnectionSchema.parse(value);if(sourceIds&&!sourceIds.includes(input.id)||deviceId&&input.deviceId!==deviceId)throw new ScopeError('invalid_identity',403);return sql.transaction(()=>data().registerSource(input));},
   configureSource:(id:string,value:unknown)=>{source(id);const patch=z.object({name:z.string().trim().min(1).max(200).optional(),retention:z.enum(['snapshot','reference','archive']).optional(),initialSync:z.enum(['all','new_only']).optional()}).strict().parse(value);return sql.transaction(()=>{source(id);return data().updateSource(id,patch);});},
   sourceContext:(id:string,version?:number)=>{source(id);return data().sourceContext(id,version);},
   configureSourceContext:(id:string,value:unknown)=>{source(id);return sql.transaction(()=>{source(id);return data().updateSourceContext(id,value);});},
   sourceHead:(id:string,externalId:unknown)=>{source(id);return {revision:data().sourceItem(id,z.string().min(1).max(1000).parse(externalId))?.revision??null};},
   registerDevice:(value:unknown)=>{const input=z.object({id:sourceIdSchema,name:z.string().min(1).max(200),platform:z.enum(['android','macos','windows','linux','import'])}).strict().parse(value);if(sourceIds||deviceId&&input.id!==deviceId)throw new ScopeError('invalid_identity',403);return sql.transaction(()=>{const prior=sql.get('SELECT json FROM ig_devices WHERE user_id=$user AND id=?',input.id),record={...(prior?JSON.parse(String(prior.json)):{}),...input};sql.run('INSERT INTO ig_devices VALUES($user,?,?) ON CONFLICT(user_id,id) DO UPDATE SET json=excluded.json',input.id,JSON.stringify(record));return input;});},
   heartbeat:(value:unknown)=>{
    const input=heartbeatSchema.parse(value);if(sourceIds||deviceId&&input.deviceId!==deviceId)throw new ScopeError('invalid_identity',403);
    return sql.transaction(()=>{const prior=sql.get('SELECT json FROM ig_devices WHERE user_id=$user AND id=?',input.deviceId),heartbeat={...(prior?JSON.parse(String(prior.json)):{}),...input,id:input.deviceId,name:input.deviceName,lastSeenAt:new Date().toISOString()};sql.run('INSERT INTO ig_devices VALUES($user,?,?) ON CONFLICT(user_id,id) DO UPDATE SET json=excluded.json',input.deviceId,JSON.stringify(heartbeat));return {ok:true};});
   },
   reconcile:(id:string,value:unknown)=>{
    const input=z.object({ids:z.array(z.string().uuid()).max(100)}).strict().parse(value);sourceIdSchema.parse(id);if(sourceIds||deviceId&&id!==deviceId)throw new ScopeError('invalid_identity',403);
    const items=input.ids.map(captureId=>{
     const row=sql.get('SELECT source_id FROM ig_capture_scopes WHERE user_id=$user AND capture_id=?',captureId);
     let state:'present'|'unavailable'='unavailable';
     if(row){try{const binding=source(String(row.source_id)),capture=data().capture(captureId);if(binding.deviceId===id&&capture.deviceId===id)state='present';}catch(error){if(!(error instanceof PrivateDataError)&&!(error instanceof ScopeError))throw error;}}
     return {id:captureId,state};
    });assert();return {checkedAt:new Date().toISOString(),items};
   },
   devices:()=>{if(deviceId||sourceIds)throw new ScopeError('invalid_identity',403);return {items:sql.all('SELECT json FROM ig_devices WHERE user_id=$user ORDER BY id').map(row=>JSON.parse(String(row.json)))};},
   receiveCaptures:(sourceId:string,id:string,values:unknown[],importDeclaration?:unknown)=>{
    const inputs=z.array(captureSchema).min(1).max(500).parse(values);
    return batch(sourceId,id,importDeclaration===undefined?inputs:{items:inputs,importDeclaration},'capture',()=>{
     const pin=declaration(sourceId,importDeclaration),binding=source(sourceId),images=new Map<string,string>();
     if(binding.retention==='reference')throw conflict();
     for(const input of inputs){
      if(input.deviceId!==binding.deviceId||input.platform!==binding.platform||input.provenance)throw conflict();
      const prior=sql.get('SELECT source_id FROM ig_capture_scopes WHERE user_id=$user AND capture_id=?',input.id);if(prior&&prior.source_id!==sourceId)throw conflict();
      if(input.imageBase64)images.set(input.id,originals.put(strictBase64(input.imageBase64)).hash);
     }
     const acks=data().receiveCaptures(inputs,{sourceId,verify:(input:CaptureInput)=>{if(images.get(input.id)!==bytesHash(strictBase64(input.imageBase64!)))throw conflict();}});
     const captures=acks.map((ack,index)=>{
      sql.run('INSERT INTO ig_capture_scopes VALUES($user,?,?) ON CONFLICT(user_id,capture_id) DO NOTHING',ack.id,sourceId);
      if(!ack.duplicate)imports.bind(ack.id,pin);const hash=images.get(ack.id);return {...ack,...(hash?{original:originals.attach(sourceId,ack.id,hash,inputs[index].imageMime!,binding.retention==='archive'?'archive':'snapshot')}:{})};
     });return receipt(sourceId,id,captures);
    });
   },
   receiveSourceItems:(sourceId:string,id:string,values:unknown[],importDeclaration?:unknown)=>intakeSourceItems(sourceId,id,values,undefined,undefined,importDeclaration),
   /** Host adapter seam: the original is selected before publication, so one
    * capture has one immutable descriptor. Worker RPCs never expose this seam. */
   receiveSourceItemsWithOriginals:(sourceId:string,id:string,values:unknown[],inputs:(SuppliedOriginal|undefined)[],formats?:readonly(IngressOriginalFormat|undefined)[])=>intakeSourceItems(sourceId,id,values,inputs,formats),
   prepareAttachment:(parentId:string,fileId:string,raw:unknown)=>sql.transaction(()=>{
    assert();if(sourceIds||deviceId||authority.isTask(context))throw new ScopeError('invalid_identity',403);z.string().uuid().parse(parentId);z.string().uuid().parse(fileId);
    const options=z.object({mimeType:z.string().regex(/^[a-z0-9.+-]+\/[a-z0-9.+-]+$/).max(200).optional(),processingProfileId:z.string().max(100).optional()}).strict().parse(raw??{});if(options.processingProfileId)throw new PrivateDataError('scope_unavailable',503);
    const parent=data().capture(parentId),p=parent.provenance;if(!p||p.deleted||parent.privacy.excluded||p.document?.attachmentOf||!p.document?.attachments?.some(a=>a.id===fileId)||data().sourceItem(p.sourceId,p.externalId)?.captureId!==parentId||!sql.get('SELECT file_id FROM ig_archive_links WHERE user_id=$user AND capture_id=? AND file_id=?',parentId,fileId))throw missing();source(p.sourceId);
    const file=archive.file(fileId),mime=options.mimeType??file.mimeType;if(mime==='application/octet-stream')throw new PrivateDataError('invalid_data');if(file.mimeType!=='application/octet-stream'&&file.mimeType!==mime)throw conflict();
    const externalId='attachment:'+identityHash([parentId,fileId]),revision=identityHash([file.hash,mime]),item=sourceItemSchema.parse({externalId,revision,observedAt:parent.capturedAt,title:file.name,text:'',kind:'file',layer:'original',mimeType:mime,document:{attachmentOf:{captureId:parentId,fileId},contentRole:'other',recordedAt:p.document?.recordedAt,timeBasis:p.document?.recordedAt?'recorded':'unknown'}}),childId=captureId(p.sourceId,item),prior=sql.get('SELECT binding_id FROM ig_attachment_links WHERE user_id=$user AND capture_id=?',childId);
    if(prior){attachmentBinding(sql,childId);return {captureId:childId,parentId,attachmentId:fileId,duplicate:true};}
    const object=sql.get('SELECT bytes FROM ig_objects WHERE user_id=$user AND hash=?',file.hash);if(!object||Number(object.bytes)!==file.sizeBytes)throw conflict();const bindingId=randomUUID();
    intakeSourceItems(p.sourceId,'attachment:'+bindingId,[item],undefined,undefined,undefined,receipt=>{if(receipt.captures[0]?.id!==childId)throw conflict();sql.run('INSERT INTO ig_attachment_links VALUES($user,?,?,?,?)',childId,parentId,fileId,bindingId);},{hash:file.hash,mime,bytes:file.sizeBytes});
    attachmentBinding(sql,childId);return {captureId:childId,parentId,attachmentId:fileId,duplicate:false};
   }),
   forgetFile:forgetting.forget,fileForgetReceipt:forgetting.receipt,forgottenFile:forgetting.forgotten,allowFileAgain:forgetting.allowAgain,
   readOriginal:(ref:string,range?:{offset?:number;length?:number})=>{original(ref);const result=originals.read(ref,range);assert();return result;},
   originalForCapture:(id:string)=>{data().capture(id);const row=sql.get('SELECT id FROM ig_originals WHERE user_id=$user AND capture_id=?',id);if(!row)throw missing();return original('original:'+row.id);},
   holdOriginal:(ref:string)=>{const value=original(ref);if(value.available===false)throw new PrivateDataError('snapshot_input_expired',410);return originals.pin(value.hash,false,ref.slice(9));},
   releaseSnapshot:(ref:string)=>sql.transaction(()=>{const value=original(ref);if(value.retention!=='snapshot')throw new ScopeError('invalid_identity',403);originals.releaseSnapshot(ref);}),
   snapshotRecovery:(sourceId:string,after='')=>{source(sourceId);if(after&&!/^[a-f0-9]{64}$/.test(after))throw new PrivateDataError('invalid_cursor');const rows=sql.all("SELECT r.id FROM ig_originals r JOIN ig_snapshot_inputs s ON s.user_id=r.user_id AND s.original_id=r.id JOIN pd_source_heads h ON h.user_id=r.user_id AND h.capture_id=r.capture_id WHERE r.user_id=$user AND r.source_id=? AND s.expires<=? AND r.id>? ORDER BY r.id LIMIT 201",sourceId,Date.now(),after);const items=[];
    for(const row of rows.slice(0,200)){const value=original('original:'+row.id);if(!needsRecovery(value))continue;const record=data().capture(value.captureId),p=record.provenance!;items.push({captureId:value.captureId,externalId:p.externalId,revision:p.revision,sha256:value.hash,sizeBytes:value.bytes,observedAt:record.capturedAt,recoveryId:recoveryKey(value.ref)});}return {items,nextCursor:rows.length>200?String(rows[199].id):null};
   },
   beginSnapshotRecovery:(sourceId:string,captureId:string,value:unknown):any=>sql.transaction(()=>{
    source(sourceId);const input=z.object({batchId,revision:fileRevisionSchema,recoveryId:z.string().regex(/^[a-f0-9]{64}$/)}).strict().parse(value),row=sql.get('SELECT id FROM ig_originals WHERE user_id=$user AND source_id=? AND capture_id=?',sourceId,captureId);if(!row)throw missing();const descriptor=original('original:'+row.id),record=data().capture(captureId),prior=sql.get('SELECT u.id,u.receipt,r.recovery_id FROM ig_uploads u JOIN ig_upload_recoveries r ON r.user_id=u.user_id AND r.upload_id=u.id WHERE u.user_id=$user AND u.source_id=? AND u.request_key=? AND r.original_id=?',sourceId,input.batchId,String(row.id));
    const {sourceId:canonicalSource,...provenance}=record.provenance!;const canonical=sourceItemSchema.parse({...provenance,observedAt:record.capturedAt,title:record.windowTitle,text:record.ocrText,kind:record.source});
    if(input.revision.sourceId!==sourceId||input.revision.sha256!==descriptor.hash||input.revision.sizeBytes!==descriptor.bytes||identityHash({...sourceItemSchema.parse(input.revision.item),observedAt:new Date(input.revision.item.observedAt).toISOString()})!==identityHash(canonical))throw conflict();
    if(prior&&prior.recovery_id!==input.recoveryId)throw conflict();
    if(!prior?.receipt&&(!needsRecovery(descriptor)||input.recoveryId!==recoveryKey(descriptor.ref)))throw conflict();
    const upload=service.beginUpload(sourceId,{batchId:input.batchId,revision:input.revision});sql.run('INSERT INTO ig_upload_recoveries VALUES($user,?,?,?) ON CONFLICT(user_id,upload_id) DO NOTHING',upload.id,String(row.id),input.recoveryId);return upload;
   }),
   pageOriginals:(sourceId:string,after='',limit=50)=>{
    source(sourceId);if(after&&!/^[a-f0-9]{64}$/.test(after)||!Number.isSafeInteger(limit)||limit<1||limit>100)throw new PrivateDataError('invalid_data');
    const rows=sql.all(`SELECT r.id FROM ig_originals r JOIN pd_captures c ON c.user_id=r.user_id AND c.id=r.capture_id WHERE r.user_id=$user AND r.source_id=? AND r.id>? AND ${attachmentVisible()} ORDER BY r.id LIMIT ?`,sourceId,after,limit+1),items=rows.slice(0,limit).map(row=>original('original:'+row.id));
    return {items,nextCursor:rows.length>limit?String(rows[limit-1].id):null};
   },
   publishMaterial:(value:unknown,expectedRevision?:string)=>sql.transaction(()=>{
    const draft=materialDraftSchema.parse(value);source(draft.origin.sourceId);
    const requireCapture=(id:string)=>{const capture=data().capture(id),binding=capture.provenance?.sourceId??sql.get('SELECT source_id FROM ig_capture_scopes WHERE user_id=$user AND capture_id=?',id)?.source_id;if(typeof binding!=='string')throw missing();source(binding);return attachmentBinding(sql,id);};
    for(const member of draft.members){
     if(member.kind==='capture'&&member.ref.startsWith('capture:')){const parent=requireCapture(member.ref.slice(8));if(parent)member.locator={...member.locator,attachmentGeneration:parent.id};if(parent&&!draft.members.some(input=>input.kind==='capture'&&input.ref==='capture:'+parent.parentId)){const id='attachment-parent:'+member.ref.slice(8);if(draft.members.some(input=>input.id===id))throw conflict();draft.members.push({id,kind:'capture',ref:'capture:'+parent.parentId});}}
     else if(member.kind==='material'){
      const input=data().material(member.ref);source(input.origin.sourceId);
      for(const row of sql.all('SELECT source_id FROM pd_material_sources WHERE user_id=$user AND material_id=? AND revision=?',input.id,input.revision))source(String(row.source_id));
     }else throw new PrivateDataError('scope_unavailable',503);
    }
    const checkAttribution=(value:any)=>{if(value?.sourceDeclaration)source(value.sourceDeclaration.sourceId);for(const entry of [...(value?.sourceContextDeclarations??[]),...(value?.sourceContextStatements??[])])source(entry.sourceId);};
    checkAttribution(draft.attributionContext);for(const block of draft.blocks)if(block.kind==='text')checkAttribution(block.evidenceContext?.attributionContext);
    const result=data().publishMaterial(draft,expectedRevision);assert();return result;
   }),
   withWorkspace:<T>(work:(workspace:OriginalWorkspace)=>Promise<T>)=>during(()=>originals.workspace(work)),
   beginUpload:(sourceId:string,value:unknown)=>sql.transaction(()=>{
    const input=z.object({batchId,revision:fileRevisionSchema,importDeclaration:importDeclarationSchema.optional()}).strict().parse(value),binding=source(sourceId),manifest=input.revision;
    if(/^[\\/]|^[a-zA-Z]:/.test(manifest.relativePath)||manifest.relativePath.split(/[\\/]/).some(part=>part==='..'||part.includes('\0')))throw new PrivateDataError('invalid_data');
    if(manifest.sourceId!==sourceId||manifest.item.kind!=='file'||manifest.item.text||binding.retention==='reference'&&manifest.item.layer!=='reference'||binding.retention!=='reference'&&manifest.item.layer==='reference')throw conflict();
    forgetting.allowed(sourceId,manifest.item);declaration(sourceId,input.importDeclaration);const digest=identityHash(input.importDeclaration===undefined?manifest:{manifest,importDeclaration:input.importDeclaration}),previous=sql.get('SELECT * FROM ig_uploads WHERE user_id=$user AND source_id=? AND request_key=?',sourceId,input.batchId);
    if(previous){if(previous.manifest_hash!==digest||previous.authorization_epoch!==context.authorizationEpoch||Number(previous.expires)<=Date.now())throw conflict();if(previous.receipt)checkReceipt(JSON.parse(String(previous.receipt)));return {id:String(previous.id),deploymentId:context.deploymentId,userId:context.userId,sourceId,partBytes:FILE_PART_BYTES,parts:sql.all('SELECT part,checksum,bytes FROM ig_upload_parts WHERE user_id=$user AND upload_id=? ORDER BY part',String(previous.id)),...(previous.receipt?{receipt:JSON.parse(String(previous.receipt))}:{})};}
    const id=randomUUID();sql.run('INSERT INTO ig_uploads VALUES($user,?,?,?,?,?,?,?,NULL)',id,sourceId,input.batchId,digest,JSON.stringify(manifest),context.authorizationEpoch,Date.now()+86400000);
    if(input.importDeclaration)sql.run('INSERT INTO ig_upload_imports VALUES($user,?,?)',id,JSON.stringify(input.importDeclaration));return {id,deploymentId:context.deploymentId,userId:context.userId,sourceId,partBytes:FILE_PART_BYTES,parts:[]};
   }),
   uploadPart:(id:string,part:number,value:unknown)=>sql.transaction(()=>{
    const row=upload(id),manifest=fileRevisionSchema.parse(JSON.parse(String(row.manifest))),input=z.object({bytes:z.string().max(Math.ceil(FILE_PART_BYTES/3)*4),checksum:z.string().regex(/^[a-f0-9]{64}$/)}).strict().parse(value),bytes=strictBase64(input.bytes);
    if(row.receipt||!manifest.sha256||manifest.item.deleted||!Number.isSafeInteger(part)||part<0||part>=Math.ceil(manifest.sizeBytes/FILE_PART_BYTES)||bytes.length!==Math.min(FILE_PART_BYTES,manifest.sizeBytes-part*FILE_PART_BYTES)||bytesHash(bytes)!==input.checksum)throw conflict();
    const prior=sql.get('SELECT checksum,bytes FROM ig_upload_parts WHERE user_id=$user AND upload_id=? AND part=?',id,part);if(prior&&(prior.checksum!==input.checksum||prior.bytes!==bytes.length))throw conflict();
    originals.writePart(id,part,bytes);sql.run('INSERT INTO ig_upload_parts VALUES($user,?,?,?,?) ON CONFLICT(user_id,upload_id,part) DO NOTHING',id,part,input.checksum,bytes.length);return {part,checksum:input.checksum,bytes:bytes.length};
   }),
   commitUpload:async(id:string)=>during(async()=>{
    const row=upload(id);if(row.receipt)return checkReceipt(JSON.parse(String(row.receipt)));
    const manifest=fileRevisionSchema.parse(JSON.parse(String(row.manifest))),hasBytes=!!manifest.sha256&&!manifest.item.deleted;
    if(hasBytes&&manifest.processingProfileId)await this.prepareFileProfile(context,manifest.processingProfileId);
    const prepared=hasBytes?await originals.prepareUpload(id,manifest.sizeBytes,manifest.sha256!):undefined;
    let received=false;try{const result=sql.transaction(()=>{
     const current=upload(id);if(current.receipt)return checkReceipt(JSON.parse(String(current.receipt)));
     const binding=source(String(current.source_id)),head=data().sourceItem(binding.id,manifest.item.externalId);
     if((head?.revision??null)!==manifest.previousRevision&&head?.revision!==manifest.item.revision)throw conflict();
     const ack=data().receiveSourceItems(binding.id,[manifest.item],binding.retention==='archive'?{verify:()=>{if(hasBytes&&!prepared)throw conflict();}}:undefined).receipts[0];
     const importRow=sql.get('SELECT json FROM ig_upload_imports WHERE user_id=$user AND upload_id=?',id);if(importRow&&!ack.duplicate)imports.bind(ack.id,declaration(binding.id,JSON.parse(String(importRow.json))));
     let reference=prepared?originals.attach(binding.id,ack.id,prepared.hash,manifest.item.mimeType??'application/octet-stream',binding.retention==='archive'?'archive':'snapshot',manifest.item.layer==='snapshot'):undefined;
     if(reference&&!ack.duplicate&&manifest.processingProfileId)this.bindFileProfile(context,reference.ref,manifest.processingProfileId);
     const recovery=sql.get('SELECT original_id FROM ig_upload_recoveries WHERE user_id=$user AND upload_id=?',id);
     if(recovery){if(!reference||reference.ref!=='original:'+recovery.original_id||!needsRecovery(reference))throw conflict();reference=originals.restoreSnapshot(reference.ref);this.snapshotRecovery!.restored(context,reference.ref);}
     const result=receipt(binding.id,String(current.request_key),[{...ack,...(reference?{original:reference}:{})}]);sql.run('UPDATE ig_uploads SET receipt=? WHERE user_id=$user AND id=?',JSON.stringify(result),id);assert();for(const receive of this.accepted)receive(context,result,'file',Object.freeze({}));assert();return result;
    });received=true;return result;}finally{try{prepared?.release();}catch{/* Revoked pins expire or are removed by lifecycle. */}if(received)originals.cleanUpload(id);}
   }),
   beginImportUpload:archive.begin,importUploadPart:archive.part,commitImportUpload:archive.commit,archivedFile:archive.file,archivedBytes:archive.bytes,removeArchivedFiles:archive.remove,
   attachArchivedFiles:(captureId:string,fileIds:string[])=>sql.transaction(()=>{const capture=data().capture(captureId);source(capture.provenance?.sourceId??String(sql.get('SELECT source_id FROM ig_capture_scopes WHERE user_id=$user AND capture_id=?',captureId)?.source_id??''));for(const id of z.array(z.string().uuid()).max(200).parse(fileIds)){archive.file(id);sql.run('INSERT OR IGNORE INTO ig_archive_links VALUES($user,?,?)',captureId,id);}}),
   captureArchivedFiles:(captureId:string)=>{const capture=data().capture(z.string().uuid().parse(captureId));source(capture.provenance?.sourceId??String(sql.get('SELECT source_id FROM ig_capture_scopes WHERE user_id=$user AND capture_id=?',captureId)?.source_id??''));return {items:sql.all('SELECT file_id FROM ig_archive_links WHERE user_id=$user AND capture_id=? ORDER BY file_id',captureId).map(row=>archive.file(String(row.file_id)))};},
   uploadReceipt:(id:string)=>{const row=upload(id);return row.receipt?checkReceipt(JSON.parse(String(row.receipt))):{state:'pending',id,deploymentId:context.deploymentId,userId:context.userId};},
   batchReceipt:(sourceId:string,id:string)=>{source(sourceId);const row=sql.get('SELECT receipt FROM ig_batches WHERE user_id=$user AND source_id=? AND batch_id=?',sourceId,id);if(!row)throw missing();return checkReceipt(JSON.parse(String(row.receipt)));},
   ticket:(ref:string,mode:'download'|'play'='download')=>{if(original(ref).available===false)throw new PrivateDataError('snapshot_input_expired',410);if(!['download','play'].includes(mode))throw new PrivateDataError('invalid_data');const body=Buffer.from(JSON.stringify({v:3,deployment:context.deploymentId,user:context.userId,credential:context.credentialId,epoch:context.authorizationEpoch,fileGeneration:forgetting.generation(original(ref)),attachmentGeneration:attachmentBinding(sql,original(ref).captureId)?.id,ref,mode,expires:Date.now()+300000})).toString('base64url');return {ticket:body+'.'+createHmac('sha256',this.key).update(body).digest('base64url'),expiresIn:300};},
   verifyTicket:(ref:string,ticket:string)=>{
    try{const [body,signature,...extra]=ticket.split('.'),actual=Buffer.from(signature??'','base64url'),expected=createHmac('sha256',this.key).update(body??'').digest();if(extra.length||actual.length!==expected.length||!timingSafeEqual(actual,expected))throw Error();const value=JSON.parse(Buffer.from(body,'base64url').toString());if(value.v!==3||value.deployment!==context.deploymentId||value.user!==context.userId||value.credential!==context.credentialId||value.epoch!==context.authorizationEpoch||value.ref!==ref||value.expires<=Date.now())throw Error();if(original(ref).available===false||(value.fileGeneration??0)!==forgetting.generation(original(ref))||value.attachmentGeneration!==attachmentBinding(sql,original(ref).captureId)?.id)throw Error();return value.mode as 'play'|'download';}catch{throw missing();}
   },
   gc:()=>{if(sourceIds||deviceId)throw new ScopeError('invalid_identity',403);return sql.transaction(()=>{
    if(sql.get('SELECT id FROM ig_activity WHERE user_id=$user LIMIT 1'))throw conflict();
    for(const row of sql.all('SELECT id FROM ig_uploads WHERE user_id=$user AND (expires<=? OR authorization_epoch<>?)',Date.now(),context.authorizationEpoch)){originals.cleanUpload(String(row.id));sql.run('DELETE FROM ig_uploads WHERE user_id=$user AND id=?',String(row.id));}
    for(const row of sql.all('SELECT id FROM ig_work WHERE user_id=$user AND expires<=?',Date.now())){originals.cleanWork(String(row.id));sql.run('DELETE FROM ig_work WHERE user_id=$user AND id=?',String(row.id));}
    return originals.gc();
   });},
  };
  function intakeSourceItems(sourceId:string,id:string,values:unknown[],inputs?:(SuppliedOriginal|undefined)[],formats?:readonly(IngressOriginalFormat|undefined)[],importDeclaration?:unknown,afterWrite?:(receipt:IngressReceipt)=>void,retained?:{hash:string;mime:string;bytes:number}){
   const items=z.array(sourceItemSchema).min(1).max(500).parse(values);
   if(retained&&(items.length!==1||!sql.get('SELECT hash FROM ig_objects WHERE user_id=$user AND hash=? AND bytes=?',retained.hash,retained.bytes)))throw conflict();
   if(inputs&&(inputs.length!==items.length||inputs.some(v=>v&&(!Buffer.isBuffer(v.bytes)||v.bytes.length>512*1024*1024||!v.mime||v.mime.length>200||v.format!==undefined&&!['source-item','file'].includes(v.format)&&!/^processor:[a-z][a-z0-9.-]{0,99}$/.test(v.format)))))throw new PrivateDataError('invalid_data');
   if(formats&&(formats.length!==items.length||formats.some(format=>format!==undefined&&!['capture','source-item','file'].includes(format)&&!/^processor:[a-z][a-z0-9.-]{0,99}$/.test(format))))throw new PrivateDataError('invalid_data');
   for(const item of items)forgetting.allowed(sourceId,item);
   return batch(sourceId,id,inputs?{items,formats,originals:inputs.map(v=>v?{hash:bytesHash(v.bytes),mime:v.mime,format:v.format??'file'}:null),...(importDeclaration===undefined?{}:{importDeclaration})}:retained?{items,retained}:importDeclaration===undefined?items:{items,importDeclaration},'source-item',()=>{
    const pin=declaration(sourceId,importDeclaration),binding=source(sourceId),archive=binding.retention==='archive';if(binding.retention==='reference'&&(inputs?.some(Boolean)||retained))throw conflict();
    const descriptors=items.map((item,index)=>{
     const capture=captureId(sourceId,item),prior=sql.get('SELECT id,hash,mime,retention FROM ig_originals WHERE user_id=$user AND source_id=? AND capture_id=?',sourceId,capture),input=inputs?.[index];
     if(prior){if(input&&(prior.hash!==bytesHash(input.bytes)||prior.mime!==input.mime)||retained&&(prior.hash!==retained.hash||prior.mime!==retained.mime))throw conflict();return originals.original('original:'+prior.id);}
     if(retained)return {hash:retained.hash,mime:retained.mime};
     if(!archive&&!input)return;
     const object=originals.put(input?.bytes??Buffer.from(JSON.stringify(item)));return {hash:object.hash,mime:input?.mime??'application/json'};
    });
    const acks=data().receiveSourceItems(sourceId,items,archive?{verify:item=>{if(!descriptors[items.findIndex(value=>value.externalId===item.externalId&&value.revision===item.revision)])throw conflict();}}:undefined).receipts;
    for(const ack of acks)if(!ack.duplicate)imports.bind(ack.id,pin);
    const result=receipt(sourceId,id,acks.map((ack,index)=>{const descriptor=descriptors[index];return {...ack,...(descriptor?{original:originals.attach(sourceId,ack.id,descriptor.hash,descriptor.mime,archive?'archive':'snapshot')}:{})};}));afterWrite?.(result);return result;
   },result=>Object.fromEntries(result.captures.flatMap((ack,index)=>ack.original&&(formats?.[index]||inputs?.[index]||retained)?[[ack.original.ref,formats?.[index]??inputs?.[index]?.format??'file']]:[])));
  }
  function upload(id:string){assert();if(!/^[a-f0-9-]{36}$/.test(id))throw missing();const row=sql.get('SELECT * FROM ig_uploads WHERE user_id=$user AND id=?',id);if(!row)throw missing();source(String(row.source_id));forgetting.allowed(String(row.source_id),fileRevisionSchema.parse(JSON.parse(String(row.manifest))).item);if(row.authorization_epoch!==context.authorizationEpoch||Number(row.expires)<=Date.now())throw conflict();return row;}
  return Object.freeze(service);
 }
}
export type UserIngress=ReturnType<IngressHost['forUser']>;
