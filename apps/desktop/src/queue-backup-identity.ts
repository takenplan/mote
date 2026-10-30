import {basename} from 'node:path';
import {stat} from 'node:fs/promises';
import type {BackupFileIdentity} from './contracts/operations';

/** A display receipt for an already selected path. It never chooses or opens
 * an archive, supplies an import target, or changes the operation's outcome. */
export async function describeBackupFile(path:string):Promise<BackupFileIdentity>{
  const file:BackupFileIdentity={name:basename(path),path};
  try {
    const value=await stat(path);
    if(value.isFile()&&Number.isSafeInteger(value.size)&&value.size>=0)file.sizeBytes=value.size;
  } catch { /* Selection is known; unavailable file size remains unknown. */ }
  return file;
}
