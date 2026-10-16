import {lstat,mkdir,readdir,realpath} from 'node:fs/promises';
import {dirname,join} from 'node:path';
import {ConnectionBindingStore} from '../apps/desktop/src/connection-binding.js';
import {ensureStorageFormat,RESET_REQUIRED} from '../apps/desktop/src/storage-format.js';
import type {SourceSync} from '../apps/desktop/src/source-sync.js';
import type {Config} from '../apps/desktop/src/contracts.js';
import {accountKey} from '../apps/desktop/src/account.js';
type Connection=Pick<Config,'serverUrl'|'token'|'account'>;
const exists=async(path:string)=>{try{return await lstat(path);}catch(error){if((error as NodeJS.ErrnoException).code==='ENOENT')return;throw error;}};
async function safeTree(path:string):Promise<void>{const stat=await lstat(path);if(stat.isSymbolicLink()||!stat.isDirectory()&&(!stat.isFile()||stat.nlink!==1))throw Error('CLI state links and special files are not allowed');if(stat.isDirectory())for(const entry of await readdir(path))await safeTree(join(path,entry));}
/** Confirm M01 before any SourceSync/spool open. Reuse Desktop's format and
 * binding gates, preserving old unbound data instead of silently adopting it. */
export async function cliAccountDirectory(root:string,connection:Connection):Promise<string>{
 const key=accountKey(connection);if(!key||!connection.token)throw Error('Confirmed CLI account required');
 const info=await exists(root);if(info){if(!info.isDirectory()||info.isSymbolicLink())throw Error(RESET_REQUIRED);await safeTree(root);}
 const names=info?await readdir(root):[];await ensureStorageFormat(root,names.filter(name=>name!=='storage-format.json'));
 const directory=join(await realpath(root),'accounts',key);await mkdir(directory,{recursive:true,mode:0o700});await safeTree(directory);
 const binding=new ConnectionBindingStore(join(directory,'connection-binding.json'));await binding.initialize(connection,(await readdir(directory)).length>0);if(!binding.matches(connection))throw Error('CLI state belongs to another account or deployment');return directory;
}
export async function initializeCliIngressState(statePath:string,engine:SourceSync,connection:Connection):Promise<void>{
 if(!accountKey(connection)||!connection.token)throw Error('Confirmed CLI account required');
 const names=await readdir(dirname(statePath)),base=statePath.slice(dirname(statePath).length+1);for(const name of names.filter(name=>name===base||name.startsWith(base+'.')))await safeTree(join(dirname(statePath),name));
 const marker=statePath+'.account.json',binding=new ConnectionBindingStore(marker),hasData=names.some(name=>![base+'.account.json',base+'.lock',base+'.lock.recovery'].includes(name)&&(name===base||name.startsWith(base+'.')));
 await binding.initialize(connection,hasData);if(!binding.matches(connection))throw Error('CLI outbox belongs to another account or deployment');await engine.initialize();
}
