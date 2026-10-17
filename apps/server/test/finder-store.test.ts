import test from 'node:test';
import assert from 'node:assert/strict';
import {isFinderStore} from '../src/finder-store.js';
import {ImportIntakeRegistry,installImportIntake} from '../src/import-intake.js';

export function generatedFinderStore(){
 const bytes=Buffer.alloc(68,0xff);bytes.writeUInt32BE(1,0);bytes.write('Bud1',4,'ascii');bytes.writeUInt32BE(32,8);bytes.writeUInt32BE(32,12);bytes.writeUInt32BE(32,16);return bytes;
}
test('Finder metadata is excluded by its bounded allocator header while matching filenames stay ordinary content',()=>{
 const registry=new ImportIntakeRegistry(),dispose=installImportIntake(registry),bytes=generatedFinderStore();
 try{
  const file={id:'11111111-1111-4111-8111-111111111111',hash:'a'.repeat(64),name:'ordinary.md',relativePath:'ordinary.md',mimeType:'text/markdown',sizeBytes:bytes.length,createdAt:'2026-10-18T00:00:00Z'};
  assert.equal(registry.format({file,prefix:bytes})?.excluded,true);
  assert.equal(registry.format({file:{...file,name:'.DS_Store',relativePath:'.DS_Store',sizeBytes:5},prefix:Buffer.from('hello')}),undefined);
  const changed=Buffer.from(bytes);changed.writeUInt32BE(31,16);assert.equal(isFinderStore(changed,changed.length),false);
  assert.equal(isFinderStore(bytes,bytes.length-1),false);
  assert.equal(isFinderStore(bytes.subarray(0,19),bytes.length),false);
 }finally{dispose();}
});
