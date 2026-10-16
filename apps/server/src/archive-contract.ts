import {z} from 'zod';
import {StoreError} from './execution-storage.js';

export const MAX_FILE_BYTES=64*1024*1024;
/** Original generic archive contract. Structural paths only, no interpretation. */
export function archiveRelativePath(raw:string):string {
 if(!raw||raw.length>1000||/[\u0000-\u001f]/.test(raw)||raw.includes('\\')||raw.startsWith('/')||/^[a-zA-Z]:/.test(raw))throw new StoreError('Invalid archive path');
 const parts=raw.split('/');if(parts.some(p=>!p||p==='.'||p==='..'))throw new StoreError('Archive paths must be relative and cannot traverse directories');
 return parts.join('/');
}
export const importUploadManifestSchema=z.object({id:z.string().uuid().optional(),name:z.string().min(1).max(1000),sizeBytes:z.number().int().min(0).max(MAX_FILE_BYTES),mimeType:z.string().max(200).optional()}).strict();
export const archivedImportFileSchema=z.object({id:z.string().uuid(),hash:z.string().regex(/^[a-f0-9]{64}$/),name:z.string().min(1).max(1000),relativePath:z.string().min(1).max(1000),mimeType:z.string().min(1).max(200),sizeBytes:z.number().int().min(0).max(MAX_FILE_BYTES),createdAt:z.string().datetime({offset:true})}).strict();
