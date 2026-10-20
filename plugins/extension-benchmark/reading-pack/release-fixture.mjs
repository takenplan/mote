import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';

// A fixed release transport replaces network downloads only. Installation still
// verifies and expands this real ZIP through the production plugin catalog.
export function readingRelease() {
  const archive = readFileSync(new URL('./reading-pack.zip', import.meta.url));
  const manifestBytes = readFileSync(new URL('./mote-plugin.json', import.meta.url));
  const manifest = JSON.parse(manifestBytes.toString('utf8'));
  if (createHash('sha256').update(archive).digest('hex') !== manifest.archive.sha256) throw new Error('release_digest_mismatch');
  const repository = 'generated-reading/reading-pack';
  const tag = 'v1.0.0';
  const commit = '7e5ad640806d8c459b722140c7d972166d83a841';
  const base = `https://github.com/${repository}/releases/download/${tag}/`;
  const json = value => Buffer.from(JSON.stringify(value));
  let archiveDownloads = 0;
  const transport = async url => {
    if (url === `https://api.github.com/repos/${repository}/releases/tags/${tag}`) return {bytes: json({tag_name: tag, draft: false, assets: [
      {name: 'mote-plugin.json', browser_download_url: base + 'mote-plugin.json'},
      {name: 'reading-pack.zip', browser_download_url: base + 'reading-pack.zip'},
    ]})};
    if (url === `https://api.github.com/repos/${repository}/commits/${tag}`) return {bytes: json({sha: commit})};
    if (url === base + 'mote-plugin.json') return {bytes: Buffer.from(manifestBytes)};
    if (url === base + 'reading-pack.zip') { archiveDownloads += 1; return {bytes: Buffer.from(archive)}; }
    throw new Error('unexpected_generated_release_url: ' + url);
  };
  return {repository, tag, commit, manifest, transport, archiveDownloads: () => archiveDownloads};
}
