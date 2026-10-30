import {expect,it,vi} from 'vitest';
import {readFileSync} from 'node:fs';
const permissionStatus=new Function(readFileSync(new URL('../chrome-extension/permissions.js',import.meta.url),'utf8').replace('export async function permissionStatus','return async function permissionStatus'))();
const id='4c638c5a-aa55-4979-bfff-d93294c25d0d';
it('rejects wider or malformed origins without consulting permissions',async()=>{
 const contains=vi.fn(async()=>true);
 for(const origins of [['https://*.example'],['https://fixture.example/path'],['file:///tmp/test'],['https://user:password@fixture.example'],['https://fixture.example/'],['https://fixture.example','https://fixture.example'],Array.from({length:101},(_,i)=>`https://a${i}.example`)])expect(await permissionStatus({id,type:'permission-status',origins},{contains})).toBeUndefined();
 expect(contains).not.toHaveBeenCalled();
});
it('returns no partial grants when the browser cannot finish checking',async()=>{
 const contains=vi.fn().mockResolvedValueOnce(true).mockRejectedValueOnce(Error('Generated browser failure'));
 expect(await permissionStatus({id,type:'permission-status',origins:['https://one.example','https://two.example']},{contains})).toEqual({id,type:'permission-status',status:'failed',origins:[]});
});
