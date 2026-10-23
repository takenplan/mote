import {createHash} from 'node:crypto';
/** Logical bytes/path identity and explicit intake lifetime remain separate.
 * A retry retains its accepted lifetime; a new request can never revive it. */
export function importSourceIdentity(files:readonly {relativePath:string;hash:string}[],requestId:string){
 const logical=files.map(file=>[file.relativePath,file.hash]).sort();
 return 'import.'+createHash('sha256').update(JSON.stringify([logical,requestId])).digest('hex').slice(0,32);
}
