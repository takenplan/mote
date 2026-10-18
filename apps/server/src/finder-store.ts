/** Finder's DS_Store allocator header identifies filesystem metadata by bytes.
 * A filename alone never excludes an original from content processing. */
export function isFinderStore(prefix:Buffer,sizeBytes:number):boolean {
 if(prefix.length<20||prefix.readUInt32BE(0)!==1||prefix.subarray(4,8).toString('ascii')!=='Bud1')return false;
 const offset=prefix.readUInt32BE(8),length=prefix.readUInt32BE(12);
 return offset===prefix.readUInt32BE(16)&&offset>=20&&length>0&&offset+length+4<=sizeBytes;
}
