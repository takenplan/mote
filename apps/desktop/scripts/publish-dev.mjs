import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { buildProfile, verifyComponent } from '../../../scripts/release/components.mjs';

// Public Dev distribution is separate from the production component-tag publisher.
const policy = JSON.parse(readFileSync('release/signing-policy.json', 'utf8'));
const runText = process.env.GITHUB_RUN_NUMBER;
if (process.argv.length !== 2) throw Error('Usage: node apps/desktop/scripts/publish-dev.mjs');
if (buildProfile() !== 'dev' || process.env.GITHUB_REF !== 'refs/heads/main'
    || process.env.GITHUB_EVENT_NAME !== 'workflow_dispatch' || process.env.GITHUB_REPOSITORY !== policy.repository
    || !/^[1-9]\d*$/.test(runText || '') || !Number.isSafeInteger(Number(runText))) {
  throw Error('Desktop Dev publication requires the trusted repository main workflow dispatch and its run number');
}
const release = verifyComponent('desktop', { profile: 'dev', ref: process.env.GITHUB_REF });
const commit = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
if (!/^[a-f0-9]{40}$/.test(commit) || commit !== process.env.GITHUB_SHA) throw Error('Desktop Dev checkout does not match the workflow commit');
const run = Number(runText), tag = `desktop-dev-${run}-${commit.slice(0, 12)}`, repo = policy.repository;
const directory = resolve(process.env.MOTE_RELEASE_OUTPUT || 'artifacts/release');
const installers = readdirSync(directory).filter(name => /\.(?:zip|apk|tar\.gz)$/.test(name));
if (installers.length !== 1) throw Error('Expected exactly one Desktop Dev installer');
const name = installers[0], path = join(directory, name), zip = readFileSync(path);
const sha256 = createHash('sha256').update(zip).digest('hex');
const metadata = JSON.parse(readFileSync(path + '.asset.json', 'utf8'));
if (!['arm64', 'x64'].includes(metadata.arch)
    || name !== `mote-desktop-macos-dev-${metadata.arch}-${release.version}.zip`) throw Error('Unexpected Desktop Dev installer name or architecture');
const expected = {
  name, component: 'desktop', profile: 'dev', platform: 'darwin', format: 'zip',
  bundleId: 'dev.mote.collector.dev', commit, size: zip.length, sha256,
};
for (const [key, value] of Object.entries(expected)) {
  if (metadata[key] !== value) throw Error(`Desktop Dev installer verification mismatch: ${key}`);
}
if (!['adhoc', 'developer-id'].includes(metadata.signing)
    || (metadata.signing === 'developer-id' && !/^[A-Z0-9]{10}$/.test(metadata.teamId || ''))) throw Error('Unexpected Desktop Dev signing identity');
const info = JSON.parse(readFileSync(join(directory, 'build-info.json'), 'utf8'));
if (info.component !== 'desktop' || info.profile !== 'dev' || info.version !== release.version || info.commit !== commit) {
  throw Error('Desktop Dev build information does not match the workflow');
}
const gh = args => execFileSync('gh', args, { encoding: 'utf8', maxBuffer: 16e6 });
const releases = JSON.parse(gh(['api', `repos/${repo}/releases?per_page=100`, '--paginate', '--slurp'])).flat();
const existing = releases.find(item => item.tag_name === tag);
if (existing && !existing.draft) throw Error('Published versions are immutable; start a new workflow run');
if (releases.some(item => !item.draft && Number(/^desktop-dev-(\d+)-[a-f0-9]{12}$/.exec(item.tag_name)?.[1]) > run)) {
  throw Error('A newer Desktop Dev build is already published; start a new workflow run');
}
// A draft may not have a tag yet. Refuse retargeted drafts, moved refs and orphan tags.
const refs = JSON.parse(gh(['api', `repos/${repo}/git/matching-refs/tags/${tag}`]));
const ref = refs.find(item => item.ref === `refs/tags/${tag}`);
if (existing && (existing.target_commitish !== commit || (ref && (ref.object.type !== 'commit' || ref.object.sha !== commit)))) {
  throw Error('Desktop Dev tag or draft points to another commit');
}
if (!existing && ref) throw Error('Desktop Dev tag already exists without a release');
const download = `https://github.com/${repo}/releases/download/${tag}/${name}`, notes = join(directory, 'desktop-dev-notes.md');
writeFileSync(notes, `Desktop Dev build ${run} · ${release.version} · ${metadata.arch}\n\n`
  + `[Download Mac ZIP](${download}) — quit Mote Collector Dev, unzip, and replace Mote Collector Dev.app in Applications.\n\n`
  + `Bundle ID: \`dev.mote.collector.dev\`. Dev retains its separate local profile; do not delete its data directory when replacing the app.\n\n`
  + `Signing: ${metadata.signing === 'adhoc' ? 'ad-hoc; not Apple notarized.' : `Developer ID, team ${metadata.teamId}; notarization verified during packaging.`}\n\n`
  + `Commit: [\`${commit}\`](https://github.com/${repo}/commit/${commit})\n\nSHA-256: \`${sha256}\`\n\n`
  + `Development build; production Beta/stable releases use the Prod profile. Updates require manual installation.\n`);
const title = `Mote Desktop Dev ${run} (${release.version}, ${metadata.arch})`;
if (!existing) gh(['release', 'create', tag, '--repo', repo, '--target', commit, '--draft', '--prerelease', '--latest=false', '--title', title, '--notes-file', notes]);
gh(['release', 'upload', tag, '--repo', repo, '--clobber', path]);
const remote = JSON.parse(gh(['release', 'view', tag, '--repo', repo, '--json', 'assets']));
if (remote.assets.length !== 1 || remote.assets[0].name !== name || remote.assets[0].size !== zip.length
    || remote.assets[0].digest !== `sha256:${sha256}`) throw Error('Uploaded Desktop Dev installer is incomplete or changed');
gh(['release', 'edit', tag, '--repo', repo, '--draft=false', '--prerelease', '--latest=false', '--title', title, '--notes-file', notes]);
console.log(JSON.stringify({ published: tag, url: `https://github.com/${repo}/releases/tag/${tag}`, download, signing: metadata.signing }));
