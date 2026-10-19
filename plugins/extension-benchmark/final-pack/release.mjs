import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {zipSync, strToU8} from 'fflate';

const hash = value => createHash('sha256').update(value).digest('hex');
export const componentIds = {source: 'final.finance.source', processor: 'final.text.processor'};
export const generatedPassword = 'Generated-Round5-Accounts-Only-51';
export const components = [
  {id: componentIds.processor, version: '1', surface: 'processing', capability: 'processor'},
  {id: componentIds.source, version: '1', surface: 'ingress', capability: 'source'},
];

// Release download is the only replaced host transport. Every call is a pinned
// GitHub metadata/manifest/archive response and unexpected network targets fail.
export async function makeRelease(version = '1.0.0', variant = 'finance') {
  const names = variant === 'native' ? ['native-apply.mjs'] : [
    'plugin.mjs', 'source.mjs', 'processor.mjs', 'originals.mjs', 'semantic-mock.mjs',
    'semantic-fixtures.json', 'version.mjs',
  ];
  const entries = {};
  for (const name of names) {
    const bytes = name === 'version.mjs' ? strToU8(`export const releaseVersion = ${JSON.stringify(version)};\n`) :
      new Uint8Array(await readFile(new URL(name, import.meta.url)));
    entries[name] = [bytes, {mtime: new Date('2026-10-19T00:00:00Z')}];
  }
  const archive = zipSync(entries), repository = 'generated-final/' + variant, tag = 'v' + version;
  const manifest = {
    schemaVersion: 1, id: variant === 'native' ? 'benchmark.native-apply' : 'benchmark.final-finance',
    name: variant === 'native' ? 'Native apply ABI probe' : 'Round 5 independent financial ledger',
    version, runtime: 'worker', entry: variant === 'native' ? 'native-apply.mjs' : 'plugin.mjs',
    archive: {asset: 'plugin.zip', sha256: hash(archive)},
    capabilities: variant === 'native' ? ['source'] : ['source', 'processor'],
    configuration: variant === 'native' ? [] : [{id: 'pageLimit', label: 'Originals per page', type: 'number', description: '1–100; default 7'}],
    dependencies: [], access: ['Only source IDs explicitly granted by the current owner'],
    components: variant === 'native' ? [components[1]] : components,
  };
  const base = `https://github.com/${repository}/releases/download/${tag}/`;
  const responses = new Map([
    [`https://api.github.com/repos/${repository}/releases/tags/${tag}`, strToU8(JSON.stringify({tag_name: tag, draft: false,
      assets: [{name: 'mote-plugin.json', browser_download_url: base + 'mote-plugin.json'}, {name: 'plugin.zip', browser_download_url: base + 'plugin.zip'}]}))],
    [`https://api.github.com/repos/${repository}/commits/${tag}`, strToU8(JSON.stringify({sha: hash(archive).slice(0, 40)}))],
    [base + 'mote-plugin.json', strToU8(JSON.stringify(manifest))],
    [base + 'plugin.zip', archive],
  ]);
  return {repository, tag, manifest, archive, responses};
}

export async function releaseTransport() {
  const releases = await Promise.all([makeRelease(), makeRelease('1.1.0'), makeRelease('1.0.0', 'native')]);
  const responses = new Map(releases.flatMap(release => [...release.responses]));
  return async url => {
    const bytes = responses.get(url);
    if (!bytes) throw Error('unapproved_release_transport_target');
    return {bytes};
  };
}
