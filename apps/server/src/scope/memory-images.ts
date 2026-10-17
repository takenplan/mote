import {attachmentBinding} from './ingress-attachments.js';
import {memoryAttribution} from './memory-evidence-context.js';
import {memoryEvidenceFingerprint,type MemoryRecord} from '../memory-contract.js';
import type {PrivateSql} from './private-data-sql.js';
import type {PrivateData} from './private-data.js';
import type {MaterialDraft} from './material-model.js';
import {memoryUUID,memoryHash} from './memory-identity.js';
export function memoryImageAnchors(sql:PrivateSql,data:PrivateData,draft:MaterialDraft,material:{id:string;revision:string;ref:string;createdAt:string},records:readonly MemoryRecord[]){
 return draft.members.filter(member=>member.kind==='capture').flatMap(member=>{
  const captureId=member.ref.slice(8),original=sql.get("SELECT * FROM ig_originals WHERE user_id=$user AND capture_id=? AND mime IN ('image/png','image/jpeg','image/webp')",captureId);if(!original)return [];
  const binding=attachmentBinding(sql,captureId),capture=data.capture(captureId),blockId='image:'+captureId+(binding?':'+binding.id:''),id=memoryUUID([sql.userId,material.id,material.revision,blockId,original.hash,...(binding?[{attachmentGeneration:binding.id}]:[])]),attribution=memoryAttribution(data,draft.attributionContext,draft.blocks.find(block=>block.kind==='text'&&block.memberIds.includes(member.id))?.kind==='text'?(draft.blocks.find(block=>block.kind==='text'&&block.memberIds.includes(member.id)) as Extract<MaterialDraft['blocks'][number],{kind:'text'}>).evidenceContext?.attributionContext:undefined);
  const record:MemoryRecord={...capture,id,blobHash:null,imageMime:String(original.mime),capturedAt:capture.capturedAt,receivedAt:material.createdAt,appName:draft.title,windowTitle:draft.title,ocrText:JSON.stringify({kind:'authorized-original-image',originalSha256:original.hash,mimeType:original.mime,instruction:'Navigation only; call read_image for original pixels. This is not original text.'}),attributionContext:attribution,provenance:{sourceId:draft.origin.sourceId,externalId:material.id,revision:material.revision,layer:'snapshot',deleted:false,uri:material.ref+'#'+blockId,document:capture.provenance?.document}},hash=memoryEvidenceFingerprint(record),prior=sql.get('SELECT hash,json FROM mm_evidence WHERE user_id=$user AND id=?',id);
  if(prior&&(prior.hash!==hash||prior.json!==JSON.stringify(record)))throw new Error('Memory image anchor changed');
  sql.run('INSERT OR IGNORE INTO mm_evidence VALUES($user,?,?,?,?,?,?)',id,material.id,material.revision,blockId,hash,JSON.stringify(record));sql.run('INSERT OR IGNORE INTO mm_images VALUES($user,?,?,?)',id,original.id,original.hash);return [record];
 });
}
export function memoryImage(sql:PrivateSql,id:string){return sql.get('SELECT i.id,i.original_id,i.hash,o.source_id,o.mime,e.material_id,e.material_revision FROM mm_images i JOIN ig_originals o ON o.user_id=i.user_id AND o.id=i.original_id AND o.hash=i.hash JOIN mm_evidence e ON e.user_id=i.user_id AND e.id=i.id WHERE i.user_id=$user AND o.user_id=$user AND e.user_id=$user AND i.id=?',id);}
export function memoryImageGrants(sql:PrivateSql,ids:readonly string[]){return ids.flatMap(id=>{const image=memoryImage(sql,id);return image?[{id,materialId:String(image.material_id),required:['material'],fingerprint:memoryHash([image.material_id,image.material_revision,image.hash]),originalSha256:String(image.hash)}]:[];});}
