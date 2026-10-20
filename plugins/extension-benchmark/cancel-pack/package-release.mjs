import {createHash} from 'node:crypto';
import {readFileSync, writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
import {zipSync} from 'fflate';

const directory = fileURLToPath(new URL('.', import.meta.url));
const names = ['plugin.mjs', 'source.mjs', 'processor.mjs', 'data.mjs', 'observations.mjs'];
const archive = zipSync(Object.fromEntries(names.map(name => [name, [readFileSync(join(directory, name)), {mtime: new Date('2026-10-19T00:00:00Z')}]])));
const manifest = {
  schemaVersion: 1, id: 'benchmark.cancel-pack', name: 'Generated cancellation evidence pack', version: '1.0.0',
  runtime: 'worker', entry: 'plugin.mjs', archive: {asset: 'plugin.zip', sha256: createHash('sha256').update(archive).digest('hex')},
  capabilities: ['source', 'processor'], configuration: [{id: 'label', label: 'Generated owner label', type: 'text', required: true}],
  dependencies: [], access: ['Explicitly granted generated source originals'],
  components: [{id: 'cancel.processor', version: '1', surface: 'processing', capability: 'processor'}, {id: 'cancel.source', version: '1', surface: 'ingress', capability: 'source'}],
};
writeFileSync(join(directory, 'plugin.zip'), archive);
writeFileSync(join(directory, 'mote-plugin.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(JSON.stringify({archive: manifest.archive.asset, sha256: manifest.archive.sha256, files: names}));
