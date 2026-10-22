import type {PreparedRecord} from '../import-record.js';
import type {ImportDecodeOutcome} from '../import-text-decoding.js';
import {ExecutionFailure} from '../execution-engine.js';
export type ImportPreviewFile={id:string;relativePath:string;decoding:ImportDecodeOutcome};
export type ImportPreviewDisposition={fileId:string;status:'parsed'|'attachment'|'container'|'excluded'|'unsupported';reason:string};
/** Mapping receives only decoded text. Retaining an unsupported original as an
 * attachment is allowed; it can never mint an original text evidence path. */
export function assertDecodedImportEvidence(files:readonly ImportPreviewFile[],records:readonly PreparedRecord[]){
 const known=new Map(files.map(file=>[file.id,file.decoding.status]));
 for(const record of records){if(record.evidencePaths.some(id=>known.get(id)!=='decoded'))throw new ExecutionFailure('permanent','unsupported_import_evidence');if(record.attachments.some(id=>!known.has(id)))throw new ExecutionFailure('permanent','invalid_import_file_reference');}
}
export function importPreviewDispositions(files:readonly ImportPreviewFile[],records:readonly PreparedRecord[],proposed?:readonly ImportPreviewDisposition[]):ImportPreviewDisposition[]{
 assertDecodedImportEvidence(files,records);
 const dispositions=proposed?[...proposed]:files.map(file=>{
  const evidence=records.some(record=>record.evidencePaths.includes(file.id)),attachment=records.some(record=>record.attachments.includes(file.id));
  if(evidence)return {fileId:file.id,status:'parsed' as const,reason:'The decoded original is referenced by the mapped text.'};
  if(attachment)return {fileId:file.id,status:'attachment' as const,reason:'The original is retained as an explicit attachment.'};
  if(file.decoding.status==='unsupported')return {fileId:file.id,status:'unsupported' as const,reason:file.decoding.reason};
  throw new ExecutionFailure('permanent','import_file_not_accounted');
 });
 if(dispositions.length!==files.length||new Set(dispositions.map(item=>item.fileId)).size!==files.length||files.some(file=>!dispositions.some(item=>item.fileId===file.id)))throw new ExecutionFailure('permanent','import_file_not_accounted');
 for(const item of dispositions){const file=files.find(file=>file.id===item.fileId);if(!file||file.decoding.status==='unsupported'&&item.status==='parsed')throw new ExecutionFailure('permanent','unsupported_import_evidence');}
 return dispositions;
}
