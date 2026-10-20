import {readdir,lstat} from 'node:fs/promises';
import {constants,closeSync,fstatSync,lstatSync,openSync,readSync,realpathSync} from 'node:fs';
import {isAbsolute,join,relative,resolve,sep} from 'node:path';
import {archiveRelativePath,MAX_FILE_BYTES} from './archive-contract.js';
import {StoreError} from './execution-storage.js';
import {moteText} from './i18n.js';

export const MAX_IMPORT_INPUT_BYTES=256*1024*1024,MAX_IMPORT_FILES=4000;
export class ImportInputError extends StoreError {
 constructor(public code:'import_directory_missing'|'import_directory_unreadable'|'import_directory_required',message:string){super(message,422);}
}
export type HostImportEntry={name:string;path:string;sizeBytes:number;identity:string};
const inside=(root:string,path:string)=>{const rel=relative(root,path);return rel===''||(!rel.startsWith(`..${sep}`)&&rel!=='..'&&!isAbsolute(rel));};
const fileIdentity=(info:import('node:fs').BigIntStats)=>[info.dev,info.ino,info.size,info.mtimeNs,info.ctimeNs].join(':');

/** Structural host input only. The caller establishes administrator authority,
 * supplies the actual vault root and archives these entries through its port. */
export async function hostImportDirectory(directory:string,vaultDirectory:string,assert:()=>void=()=>{}):Promise<HostImportEntry[]> {
 try{
  assert();const source=realpathSync(resolve(directory)),vault=realpathSync(vaultDirectory),entries:HostImportEntry[]=[];let total=0;
  if(inside(source,vault)||inside(vault,source))throw new StoreError('Choose a directory outside the Mote data directory');
  if(!lstatSync(source).isDirectory())throw new ImportInputError('import_directory_required',moteText('该路径不是目录，请填写中央服务器上可读取的目录。'));
  const walk=async(path:string,depth:number):Promise<void>=>{
   assert();if(depth>30)throw new StoreError('Directory nesting exceeds 30 levels',413);
   for(const name of (await readdir(path)).sort()){
    assert();const child=join(path,name),info=await lstat(child,{bigint:true});assert();
    if(info.isSymbolicLink())throw new StoreError('Directory imports cannot follow symbolic links');
    if(info.isDirectory())await walk(child,depth+1);else if(info.isFile()){
     const size=Number(info.size);if(size>MAX_FILE_BYTES||total+size>MAX_IMPORT_INPUT_BYTES||entries.length>=MAX_IMPORT_FILES)throw new StoreError('Directory exceeds import size limits',413);
     entries.push({name:archiveRelativePath(relative(source,child).split(sep).join('/')),path:child,sizeBytes:size,identity:fileIdentity(info)});total+=size;
    }
   }
  };await walk(source,0);assert();return entries;
 }catch(error){
  const code=(error as NodeJS.ErrnoException).code;
  if(code==='ENOENT'||code==='ENOTDIR')throw new ImportInputError('import_directory_missing',moteText('中央服务器上的目录不存在或文件已移动，请检查路径后重新提交。'));
  if(code==='EACCES'||code==='EPERM')throw new ImportInputError('import_directory_unreadable',moteText('中央服务器无法读取该目录，请检查访问权限后重新提交。'));
  throw error;
 }
}

/** Check the enumerated inode/metadata before and after streaming. A replaced
 * parent or file cannot redirect an archived original to another host path. */
export function* readImportParts(path:string,expected?:string,assert:()=>void=()=>{}){
 assert();const fd=openSync(path,constants.O_RDONLY|constants.O_NOFOLLOW|constants.O_NONBLOCK),buffer=Buffer.alloc(4*1024*1024);
 const check=()=>{assert();const info=fstatSync(fd,{bigint:true});if(!info.isFile()||expected&&(fileIdentity(info)!==expected||realpathSync(path)!==path))throw new StoreError('Original file changed during import',409);};
 try{check();let size:number;while((size=readSync(fd,buffer,0,buffer.length,null))>0){assert();yield buffer.subarray(0,size);}check();}finally{closeSync(fd);}
}
