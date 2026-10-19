import assert from 'node:assert/strict';
import type {TestContext} from 'node:test';
import {createHash,randomUUID} from 'node:crypto';
import {mkdtempSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {zipSync} from 'fflate';
import type {ArchivedFile,ImportJob} from '@mote/shared';
import {scopedFilesFixture} from './scoped-files.js';
import {waitForScopedState} from './scoped-process.js';

export const generatedFixedSourcePackSkip=process.platform!=='darwin'||process.env.MOTE_TEST_PYTHON_OS_SANDBOX!=='1';
export const generatedFixedSourcePackParentText='Generated fixed Source Pack parent.\n';
export const generatedFixedSourcePackWave=(()=>{
 const bytes=Buffer.alloc(48);bytes.write('RIFF');bytes.writeUInt32LE(40,4);bytes.write('WAVEfmt ',8);bytes.writeUInt32LE(16,16);
 bytes.writeUInt16LE(1,20);bytes.writeUInt16LE(1,22);bytes.writeUInt32LE(8000,24);bytes.writeUInt32LE(16000,28);
 bytes.writeUInt16LE(2,32);bytes.writeUInt16LE(16,34);bytes.write('data',36);bytes.writeUInt32LE(4,40);bytes.writeInt16LE(1,46);return bytes;
})();
export const generatedFixedSourcePackMetadata=(()=>{
 const bytes=Buffer.alloc(68,0xff);bytes.writeUInt32BE(1,0);bytes.write('Bud1',4,'ascii');
 bytes.writeUInt32BE(32,8);bytes.writeUInt32BE(32,12);bytes.writeUInt32BE(32,16);return bytes;
})();
export type FixedSourcePackAccount={token:string;userId:string};

/** A trusted configured parser, run through the real OS-sandboxed executor.
 * It maps a fixed generated format; it does not classify captured content. */
export async function generatedFixedSourcePack(t:TestContext,options:{invalidAttachmentDisposition?:boolean}={}){
 const packRoot=mkdtempSync(join(tmpdir(),'mote-generated-fixed-pack-'));
 const script=`import hashlib, json, struct
from pathlib import Path, PurePosixPath

request = json.loads(Path('request.json').read_text())
inputs = request['inputs']
names = [item['relativePath'] for item in inputs]
assert len(names) == len(set(names))
by_name = {}
hashes = {}
for item in inputs:
    name = PurePosixPath(item['relativePath']).name
    assert name not in by_name
    by_name[name] = item
    data = Path(item['path']).read_bytes()
    assert len(data) == item['sizeBytes']
    hashes[item['relativePath']] = hashlib.sha256(data).hexdigest()
assert set(by_name) in ({'parent.txt', 'audio.wav', '.DS_Store'}, {'generated.zip', 'parent.txt', 'audio.wav', '.DS_Store'})
parent = by_name['parent.txt']
audio = by_name['audio.wav']
text = Path(parent['path']).read_text()
assert text == 'Generated fixed Source Pack parent.\\n'
wave = Path(audio['path']).read_bytes()
assert len(wave) == 48 and wave[:4] == b'RIFF' and struct.unpack_from('<I', wave, 4)[0] == 40
assert wave[8:16] == b'WAVEfmt ' and struct.unpack_from('<I', wave, 16)[0] == 16
assert struct.unpack_from('<HHIIHH', wave, 20) == (1, 1, 8000, 16000, 2, 16)
assert wave[36:40] == b'data' and struct.unpack_from('<I', wave, 40)[0] == 4
assert wave[44:] == bytes([0, 0, 1, 0])
metadata = Path(by_name['.DS_Store']['path']).read_bytes()
assert len(metadata) == 68 and metadata[4:8] == b'Bud1'
if 'generated.zip' in by_name:
    assert Path(by_name['generated.zip']['path']).read_bytes()[:4] == b'PK\\x03\\x04'
    assert all(item['relativePath'].startswith('generated.zip.contents/') for name, item in by_name.items() if name != 'generated.zip')
dispositions = []
for item in inputs:
    name = PurePosixPath(item['relativePath']).name
    role = {'parent.txt': 'parsed', 'audio.wav': 'attachment', '.DS_Store': 'excluded', 'generated.zip': 'container'}[name]
    if name == 'audio.wav' and request['config'].get('invalidAttachmentDisposition', False):
        role = 'excluded'
    dispositions.append({'index': item['index'], 'status': role, 'reason': 'Fixed generated format accounts for this original.'})
revision = hashlib.sha256(json.dumps(sorted(hashes.items())).encode()).hexdigest()
print(json.dumps({
    'summary': 'Generated complete fixed-format parent and audio attachment.',
    'warnings': [],
    'reviewDecision': {'confidence': 'high', 'ambiguous': False, 'reason': 'Fixed generated format has explicit structural mappings.'},
    'dispositions': dispositions,
    'records': [{
        'item': {'externalId': 'generated-fixed-parent', 'revision': revision, 'observedAt': '2026-10-16T00:00:00Z',
                 'title': 'Generated fixed parent', 'text': text, 'kind': 'message', 'layer': 'original',
                 'document': {'contentRole': 'authored', 'timeBasis': 'unknown',
                              'originalMetadata': {'packInputPaths': names, 'packInputHashes': hashes}}},
        'evidenceIndexes': [parent['index']], 'attachmentIndexes': [audio['index']]
    }]
}))
`;
 writeFileSync(join(packRoot,'pack.py'),script,{mode:0o600});
 const spec={id:'generated.fixed-source-pack',version:'1',packRoot,script:'pack.py',scriptSha256:createHash('sha256').update(script).digest('hex'),pythonExecutable:'/Library/Developer/CommandLineTools/usr/bin/python3',config:{invalidAttachmentDisposition:options.invalidAttachmentDisposition??false}};
 let f:Awaited<ReturnType<typeof scopedFilesFixture>>;
 try{f=await scopedFilesFixture(t,{importPythonPacks:[spec]});}catch(error){rmSync(packRoot,{recursive:true,force:true});throw error;}
 // Close explicitly before removing trusted code, regardless of hook ordering.
 // scopedFilesFixture remains responsible for its hosts and vault cleanup.
 t.after(async()=>{try{await f.host.app.close();}finally{rmSync(packRoot,{recursive:true,force:true});}});
 const uploadInputs=async(account:FixedSourcePackAccount,mode:'loose'|'zip'='loose'):Promise<ArchivedFile[]>=>{
  const members=[{name:'parent.txt',bytes:Buffer.from(generatedFixedSourcePackParentText),mimeType:'text/plain'},{name:'audio.wav',bytes:generatedFixedSourcePackWave,mimeType:'audio/wav'},{name:'.DS_Store',bytes:generatedFixedSourcePackMetadata,mimeType:'application/octet-stream'}];
  const supplied=mode==='zip'?[{name:'generated.zip',bytes:Buffer.from(zipSync(Object.fromEntries(members.map(file=>[file.name,file.bytes])))),mimeType:'application/zip'}]:members;
  const files:ArchivedFile[]=[];
  for(const file of supplied){
   const id=randomUUID();await f.checked(account.token,'/api/import-uploads','POST',{id,name:file.name,sizeBytes:file.bytes.length,mimeType:file.mimeType});
   assert.equal((await f.request(account.token,'/api/import-uploads/'+id+'/parts/0','PUT',file.bytes,{'content-type':'application/octet-stream'})).statusCode,200);
   files.push(await f.checked(account.token,'/api/import-uploads/'+id+'/commit','POST',{}));
  }
  return files;
 };
 const importPreview=async(account:FixedSourcePackAccount,files:readonly ArchivedFile[],requestId:string=randomUUID()):Promise<ImportJob>=>{
  const created=await f.request(account.token,'/api/imports','POST',{requestId,archivedFileIds:files.map(file=>file.id),sourcePackId:spec.id,processing:'preview'});
  assert.equal(created.statusCode,202,created.body);let job:ImportJob=created.json();
  await waitForScopedState(async()=>{job=await f.checked(account.token,'/api/imports/'+job.id);assert.ok(!['failed','needs_configuration','unsupported','cancelled'].includes(job.status),JSON.stringify(job));return job.status==='awaiting_confirmation';},()=>JSON.stringify(job),15000);
  return job;
 };
 const confirmImport=async(account:FixedSourcePackAccount,id:string):Promise<ImportJob>=>{
  const confirmed=await f.request(account.token,'/api/imports/'+id+'/confirm','POST',{});assert.equal(confirmed.statusCode,202,confirmed.body);let job:ImportJob=confirmed.json();
  await waitForScopedState(async()=>{job=await f.checked(account.token,'/api/imports/'+id);assert.ok(!['failed','needs_configuration','unsupported','cancelled'].includes(job.status),JSON.stringify(job));return job.status==='completed';},()=>JSON.stringify(job),15000);
  return job;
 };
 return {f,packRoot,spec,script,uploadInputs,importPreview,confirmImport};
}
