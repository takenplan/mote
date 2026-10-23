import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { verifyComponent, buildProfile } from './components.mjs';
import { androidDevBuild, androidDevTag } from './android-dev-build.mjs';

// Separate entrypoint: production tag publication continues to reject Dev packages.
const policy = JSON.parse(readFileSync('release/signing-policy.json', 'utf8'));
if (process.argv.length !== 2) throw Error('Usage: node scripts/release/publish-android-dev.mjs');
if (buildProfile() !== 'dev' || process.env.GITHUB_REF !== 'refs/heads/main'
    || process.env.GITHUB_EVENT_NAME !== 'workflow_dispatch' || process.env.GITHUB_REPOSITORY !== policy.repository
    || process.env.MOTE_ANDROID_DEV_RUN !== process.env.GITHUB_RUN_NUMBER) {
  throw Error('Android Dev publication requires the trusted repository main workflow dispatch and its run number');
}
const release = verifyComponent('android', { profile: 'dev', ref: process.env.GITHUB_REF });
const build = androidDevBuild(release.version);
const commit = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
if (commit !== process.env.GITHUB_SHA) throw Error('Android Dev checkout does not match the workflow commit');
const tag = androidDevTag(build, commit), repo = policy.repository;
const directory = resolve(process.env.MOTE_RELEASE_OUTPUT || 'artifacts/release');
const installers = readdirSync(directory).filter(name => /\.(?:apk|zip|tar\.gz)$/.test(name));
if (installers.length !== 1 || installers[0] !== build.name) throw Error('Expected exactly one Android Dev installer');
const apk = readFileSync(join(directory, build.name));
const sha256 = createHash('sha256').update(apk).digest('hex');
const metadata = JSON.parse(readFileSync(join(directory, `${build.name}.asset.json`), 'utf8'));
const expected = {
  component: 'android', profile: 'dev', platform: 'android', arch: 'arm64', format: 'apk',
  name: build.name, packageName: 'dev.mote.collector.dev', versionCode: build.versionCode, versionName: build.versionName,
  certificateSha256: policy.androidCertificateSha256, commit, size: apk.length, sha256,
  url: `https://github.com/${repo}/releases/download/${tag}/${build.name}`,
};
for (const [key, value] of Object.entries(expected)) {
  if (metadata[key] !== value) throw Error(`Android Dev installer verification mismatch: ${key}`);
}
const gh = args => execFileSync('gh', args, { encoding: 'utf8', maxBuffer: 16e6 });
// Fail closed on API errors; include all pages so drafts/other components cannot hide a newer Dev.
const releases = JSON.parse(gh(['api', `repos/${repo}/releases?per_page=100`, '--paginate', '--slurp'])).flat();
const existing = releases.find(item => item.tag_name === tag);
if (existing && !existing.draft) throw Error('Published versions are immutable; start a new workflow run');
if (releases.some(item => !item.draft && Number(/^android-dev-(\d+)-[a-f0-9]{12}$/.exec(item.tag_name)?.[1]) > build.run)) {
  throw Error('A newer Android Dev build is already published; start a new workflow run');
}
// GitHub may defer creating a draft's tag until publication. Check both the draft
// target and any actual ref, without treating arbitrary API failures as absence.
const refs = JSON.parse(gh(['api', `repos/${repo}/git/matching-refs/tags/${tag}`]));
const ref = refs.find(item => item.ref === `refs/tags/${tag}`);
if (existing && (existing.target_commitish !== commit || (ref && (ref.object.type !== 'commit' || ref.object.sha !== commit)))) {
  throw Error('Android Dev tag or draft points to another commit');
}
if (!existing && ref) throw Error('Android Dev tag already exists without a release');
const notes = join(directory, 'android-dev-notes.md');
writeFileSync(notes, `Android Dev build ${build.run} · ${build.versionName}\n\n`
  + `[Download APK](${metadata.url}) — download on your phone and confirm the Android installation.\n\n`
  + `Package: \`dev.mote.collector.dev\`; versionCode: \`${build.versionCode}\`. Uses the existing Dev signing certificate. `
  + `Install over Mote Dev to retain its data. Dev and Prod remain separate apps.\n\n`
  + `Commit: [\`${commit}\`](https://github.com/${repo}/commit/${commit})\n\n`
  + `SHA-256: \`${sha256}\`\n\n`
  + `Development build; production Beta/stable releases use the Prod profile. Updates require manual installation.\n`);
const title = `Mote Android Dev ${build.run} (${release.version})`;
if (!existing) gh(['release', 'create', tag, '--repo', repo, '--target', commit, '--draft', '--prerelease', '--latest=false', '--title', title, '--notes-file', notes]);
gh(['release', 'upload', tag, '--repo', repo, '--clobber', join(directory, build.name)]);
const remote = JSON.parse(gh(['release', 'view', tag, '--repo', repo, '--json', 'assets']));
if (remote.assets.length !== 1 || remote.assets[0].name !== build.name || remote.assets[0].size !== apk.length
    || remote.assets[0].digest !== `sha256:${sha256}`) throw Error('Uploaded Android Dev installer is incomplete or changed');
gh(['release', 'edit', tag, '--repo', repo, '--draft=false', '--prerelease', '--latest=false', '--title', title, '--notes-file', notes]);
const url = `https://github.com/${repo}/releases/tag/${tag}`;
console.log(JSON.stringify({ published: tag, url, apk: metadata.url, versionCode: build.versionCode }));
