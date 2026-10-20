import {createHash} from 'node:crypto';
import {readFile, writeFile} from 'node:fs/promises';
import {zipSync} from 'fflate';

const archive = zipSync({'plugin.mjs': [new Uint8Array(await readFile(new URL('./plugin.mjs', import.meta.url))), {mtime: new Date('2026-10-19T00:00:00Z')}]});
const manifest = {
  schemaVersion: 1, id: 'generated.reading-pack', name: 'Generated reading notes', version: '1.0.0',
  runtime: 'worker', entry: 'plugin.mjs',
  archive: {asset: 'reading-pack.zip', sha256: createHash('sha256').update(archive).digest('hex')},
  capabilities: ['source', 'processor'],
  configuration: [{id: 'label', label: 'Reading collection', type: 'text', required: true}],
  dependencies: [], access: ['Explicitly granted archived reading sources'],
  components: [
    {id: 'reading.source.enumerate', version: '1', surface: 'ingress', capability: 'source'},
    {id: 'reading.processor.normalize', version: '1', surface: 'processing', capability: 'processor'},
  ],
};
await writeFile(new URL('./reading-pack.zip', import.meta.url), archive);
await writeFile(new URL('./mote-plugin.json', import.meta.url), JSON.stringify(manifest, null, 2) + '\n');
console.log(JSON.stringify({archive: manifest.archive, bytes: archive.length}));
