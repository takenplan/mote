import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,writeFileSync,readFileSync,mkdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import type {ArchivedFile} from '@mote/shared';
import {formatWork} from '../src/format-work.js';
import {importTextEncoding} from '../src/import-text-decoding.js';
import {importSourceIdentity} from '../src/scope/import-identity.js';
import {assertDecodedImportEvidence,importPreviewDispositions} from '../src/scope/import-preview-contract.js';

test('trusted decoding accounts for every original and accepts declared UTF16 without aborting on unsupported peers',async t=>{
 const directory=mkdtempSync(join(tmpdir(),'mote-import-decode-'));t.after(()=>rmSync(directory,{recursive:true,force:true}));mkdirSync(join(directory,'inputs'),{mode:0o700});
 const text='GENERATED_UTF16_合成😀',little=Buffer.concat([Buffer.from([0xff,0xfe]),Buffer.from(text,'utf16le')]),big=Buffer.from(little);big.swap16();
 const originals=[['utf8.txt',Buffer.from('GENERATED_UTF8')],['little.data',little],['big.unknown',big],['unsupported.bin',Buffer.from([0xff,0xf0,0x80])]] as const;
 const inputs=originals.map(([name,bytes])=>{const path=join(directory,'inputs',name);writeFileSync(path,bytes,{mode:0o600});return {path,file:{id:randomUUID(),name,relativePath:name,sizeBytes:bytes.length,hash:createHash('sha256').update(bytes).digest('hex'),mimeType:'application/octet-stream',createdAt:'2026-10-23T00:00:00Z'} as ArchivedFile};}),manifest=join(directory,'prepared.jsonl');
 const result=await formatWork({kind:'plain',inputs,createdAt:'2026-10-23T00:00:00Z',manifest});assert.equal(result.count,3);assert.equal(result.outcomes.length,4);assert.deepEqual(result.outcomes.map(outcome=>outcome.status),['decoded','decoded','decoded','unsupported']);assert.equal(result.partial,true);
 const records=readFileSync(manifest,'utf8').trim().split('\n').map(line=>JSON.parse(line));assert.deepEqual(records.map(record=>record.item.text),['GENERATED_UTF8',text,text]);assert.ok(result.warnings.some(value=>value.includes('text_encoding_unsupported')));assert.equal(importTextEncoding(big),'utf-16be');
});

test('host unsupported outcomes cannot be promoted to parsed text or silently used as evidence',()=>{
 const id=randomUUID(),files=[{id,relativePath:'unsupported.bin',decoding:{fileId:id,status:'unsupported' as const,reason:'text_encoding_unsupported'}}],fabricated={item:{} as any,evidencePaths:[id],attachments:[]};
 assert.throws(()=>assertDecodedImportEvidence(files,[fabricated]));assert.throws(()=>importPreviewDispositions(files,[],[{fileId:id,status:'parsed',reason:'Untrusted override'}]));assert.deepEqual(importPreviewDispositions(files,[]),[{fileId:id,status:'unsupported',reason:'text_encoding_unsupported'}]);
 const known=randomUUID(),all=[...files,{id:known,relativePath:'known.txt',decoding:{fileId:known,status:'decoded' as const,reason:'utf8'}}],record={item:{} as any,evidencePaths:[known],attachments:[id]};assert.doesNotThrow(()=>assertDecodedImportEvidence(all,[record]));assert.deepEqual(importPreviewDispositions(all,[record]).map(item=>item.status),['attachment','parsed']);
});

test('an explicit import request owns a stable lifetime separate from the same logical bytes',()=>{
 const files=[{relativePath:'generated.txt',hash:'a'.repeat(64)}],a=randomUUID(),b=randomUUID();assert.equal(importSourceIdentity(files,a),importSourceIdentity(files,a));assert.notEqual(importSourceIdentity(files,a),importSourceIdentity(files,b));assert.equal(importSourceIdentity([...files,{relativePath:'second.txt',hash:'b'.repeat(64)}],a),importSourceIdentity([{relativePath:'second.txt',hash:'b'.repeat(64)},...files],a));
});

test('a mapper cannot label decoded originals unsupported to admit an empty preview',()=>{
 const id=randomUUID(),files=[{id,relativePath:'decoded.txt',decoding:{fileId:id,status:'decoded' as const,reason:'utf8'}}];
 assert.throws(()=>importPreviewDispositions(files,[],[{fileId:id,status:'unsupported',reason:'Untrusted capability override'}]),/unsupported_import_evidence/);
 const excluded=[{fileId:id,status:'excluded' as const,reason:'Explicitly outside the requested mapping scope'}];
 assert.deepEqual(importPreviewDispositions(files,[],excluded),excluded);
});
