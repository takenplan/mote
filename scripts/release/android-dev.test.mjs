import test from 'node:test';
import assert from 'node:assert/strict';
import { chmodSync, readFileSync } from 'node:fs';
import { delimiter, join } from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { releaseFixture } from './fixtures.mjs';
import { androidDevBuild, androidDevTag } from './android-dev-build.mjs';

function fixture(t, run = 42) {
  const f = releaseFixture(t), git = args => execFileSync('git', args, { cwd: f.root, encoding: 'utf8', stdio: 'pipe' }).trim();
  git(['init']); git(['add', '.']);
  git(['-c', 'user.name=Generated Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '-m', 'Generated Android Dev source']);
  const commit = git(['rev-parse', 'HEAD']), build = androidDevBuild('3.8.0', { MOTE_ANDROID_DEV_RUN: String(run) });
  const executable = (name, body) => { f.write(name, `#!${process.execPath}\n${body}\n`); chmodSync(join(f.root, name), 0o755); };
  // Only Android SDK and GitHub are substituted; actual metadata and publisher CLIs run below.
  executable('sdk/build-tools/36.0.0/aapt2', `console.log(process.env.FIXTURE_BADGING);`);
  executable('sdk/build-tools/36.0.0/apksigner', `console.log('Signer #1 certificate SHA-256 digest: '+process.env.FIXTURE_CERT);`);
  executable('sdk/build-tools/36.0.0/zipalign', '');
  executable('bin/gh', `
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const args=process.argv.slice(2),file=process.env.FIXTURE_GITHUB_STATE;
fs.appendFileSync(process.env.FIXTURE_GITHUB_LOG,JSON.stringify(args)+'\\n');
const state=JSON.parse(fs.readFileSync(file,'utf8'));
if(process.env.FIXTURE_API_ERROR)process.exit(1);
if(args[0]==='api'){
  if(args[1].includes('/releases?'))console.log(JSON.stringify([state.releases]));
  else if(args[1].includes('/git/matching-refs/'))console.log(JSON.stringify(state.orphanTag?[{ref:'refs/tags/'+state.orphanTag}]:state.tagCommit?[{ref:'refs/tags/'+state.releases[0].tag_name,object:{type:'commit',sha:state.tagCommit}}]:[]));
  else process.exit(2);
}else if(args[1]==='create'){
  state.releases.push({tag_name:args[2],draft:true,target_commitish:args[args.indexOf('--target')+1]});
}else if(args[1]==='upload'){
  state.assets=args.slice(args.indexOf('--clobber')+1).map(file=>({name:path.basename(file),size:fs.statSync(file).size,digest:'sha256:'+crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')}));
  if(process.env.FIXTURE_CORRUPT_UPLOAD)state.assets[0].digest='sha256:corrupt';
}else if(args[1]==='view')console.log(JSON.stringify({assets:state.assets}));
else if(args[1]==='edit')state.releases.find(r=>r.tag_name===args[2]).draft=false;
else process.exit(2);
fs.writeFileSync(file,JSON.stringify(state));
`);
  f.write('generated.apk', 'Generated Android Dev APK bytes');
  f.write('github-state.json', { releases: [] });
  const env = {
    ...process.env, PATH: join(f.root, 'bin') + delimiter + process.env.PATH,
    MOTE_BUILD_PROFILE: 'dev', MOTE_ANDROID_DEV_RUN: String(run), GITHUB_RUN_NUMBER: String(run),
    GITHUB_SHA: commit, GITHUB_REF: 'refs/heads/main', GITHUB_EVENT_NAME: 'workflow_dispatch', GITHUB_REPOSITORY: f.policy.repository,
    MOTE_RELEASE_OUTPUT: join(f.root, 'artifacts/release'), ANDROID_HOME: join(f.root, 'sdk'),
    FIXTURE_BADGING: `package: name='dev.mote.collector.dev' versionCode='${build.versionCode}' versionName='${build.versionName}'\napplication-debuggable`,
    FIXTURE_CERT: 'aabb', FIXTURE_GITHUB_STATE: join(f.root, 'github-state.json'), FIXTURE_GITHUB_LOG: join(f.root, 'github-calls.jsonl'),
  };
  f.policy.androidCertificateSha256 = 'aabb'; f.write('release/signing-policy.json', f.policy);
  const cli = (name, args = [], overrides = {}) => spawnSync(process.execPath, [new URL(name, import.meta.url).pathname, ...args], { cwd: f.root, env: { ...env, ...overrides }, encoding: 'utf8' });
  const packageApk = overrides => cli('asset-metadata.mjs', ['android', join(f.root, 'generated.apk')], overrides);
  const publish = overrides => cli('publish-android-dev.mjs', [], overrides);
  const state = () => JSON.parse(f.read('github-state.json'));
  return { ...f, env, build, commit, tag: androidDevTag(build, commit), packageApk, publish, state };
}

test('unchanged source versions get increasing Dev install codes; local builds keep their identity', () => {
  const first = androidDevBuild('0.0.88', { MOTE_ANDROID_DEV_RUN: '41' });
  const next = androidDevBuild('0.0.88', { MOTE_ANDROID_DEV_RUN: '42' });
  assert.equal(next.versionCode, first.versionCode + 1);
  assert.equal(next.versionName, '0.0.88-dev.42');
  assert.equal(androidDevBuild('0.0.88', {}), undefined);
  assert.equal(androidDevBuild('0.0.88', { MOTE_ANDROID_DEV_RUN: '1100000000' }).versionCode, 2_100_000_000);
  for (const run of ['0', '-1', '1.2', '01', '1100000001', 'Infinity', '999999999999999999999']) {
    assert.throws(() => androidDevBuild('0.0.88', { MOTE_ANDROID_DEV_RUN: run }), /run number/);
  }
});

test('phone download journey packages a Dev APK then publishes an immutable prerelease with a direct APK link', t => {
  const f = fixture(t);
  const packaged = f.packageApk(); assert.equal(packaged.status, 0, packaged.stderr);
  const info = JSON.parse(f.read('artifacts/release/build-info.json'));
  assert.equal(info.tag, f.tag); assert.equal(info.commit, f.commit); assert.equal(info.versionCode, f.build.versionCode);
  const result = f.publish(); assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(result.stdout).published, f.tag);
  assert.deepEqual(f.state().assets.map(a => a.name), [f.build.name]);
  assert.equal(f.state().releases[0].draft, false);
  const notes = f.read('artifacts/release/android-dev-notes.md');
  assert.ok(notes.includes(`[Download APK](https://github.com/${f.policy.repository}/releases/download/${f.tag}/${f.build.name})`));
  assert.ok(notes.includes(f.commit)); assert.ok(notes.includes('versionCode: `1000000042`'));
  const calls = f.read('github-calls.jsonl').trim().split('\n').map(JSON.parse);
  const create = calls.find(a => a[1] === 'create'), edit = calls.find(a => a[1] === 'edit');
  assert.equal(create[create.indexOf('--target') + 1], f.commit);
  for (const call of [create, edit]) { assert.ok(call.includes('--prerelease')); assert.ok(call.includes('--latest=false')); }
  const before = f.read('github-state.json');
  const repeat = f.publish(); assert.notEqual(repeat.status, 0); assert.match(repeat.stderr, /immutable/);
  assert.equal(f.read('github-state.json'), before);
});

test('Dev metadata rejects wrong app, certificate, version name or install code before publication', t => {
  const f = fixture(t);
  for (const env of [
    { FIXTURE_CERT: 'deadbeef' },
    { FIXTURE_BADGING: f.env.FIXTURE_BADGING.replace('collector.dev', 'collector') },
    { FIXTURE_BADGING: f.env.FIXTURE_BADGING.replace('1000000042', '87') },
    { FIXTURE_BADGING: f.env.FIXTURE_BADGING.replace('dev.42', 'dev.41') },
  ]) {
    const result = f.packageApk(env); assert.notEqual(result.status, 0); assert.match(result.stderr, /identity|version|profile/);
  }
  assert.throws(() => f.read('github-calls.jsonl'), /ENOENT/);
});

test('the CI Dev run environment leaves production and ordinary local Dev package versions unchanged', t => {
  const f = fixture(t);
  const prod = f.packageApk({ MOTE_BUILD_PROFILE: 'prod', FIXTURE_BADGING: "package: name='dev.mote.collector' versionCode='87' versionName='3.8.0'" });
  assert.equal(prod.status, 0, prod.stderr);
  const metadata = JSON.parse(f.read('artifacts/release/mote-android-arm64-3.8.0.apk.asset.json'));
  assert.equal(metadata.versionCode, 87); assert.equal(metadata.versionName, '3.8.0'); assert.equal(metadata.profile, 'prod');
  const local = f.packageApk({ MOTE_ANDROID_DEV_RUN: '', FIXTURE_BADGING: "package: name='dev.mote.collector.dev' versionCode='87' versionName='3.8.0-dev'\napplication-debuggable" });
  assert.equal(local.status, 0, local.stderr);
  const info = JSON.parse(f.read('artifacts/release/build-info.json'));
  assert.equal(info.tag, undefined); assert.equal(info.run, undefined);
});

test('Dev publication rejects untrusted triggers and mismatched build evidence without contacting GitHub', t => {
  const f = fixture(t); assert.equal(f.packageApk().status, 0);
  for (const env of [
    { MOTE_BUILD_PROFILE: 'prod' }, { GITHUB_REF: 'refs/heads/feature' }, { GITHUB_REF: 'refs/tags/android-v3.8.0' },
    { GITHUB_REPOSITORY: 'fork/mote' }, { GITHUB_EVENT_NAME: 'pull_request' }, { GITHUB_SHA: 'b'.repeat(40) },
    { GITHUB_RUN_NUMBER: '43' }, { MOTE_ANDROID_DEV_RUN: '' },
  ]) { assert.notEqual(f.publish(env).status, 0); }
  const metadataPath = `artifacts/release/${f.build.name}.asset.json`, metadata = JSON.parse(f.read(metadataPath));
  for (const changes of [{ profile: 'prod' }, { commit: 'b'.repeat(40) }, { packageName: 'dev.mote.collector' }, { versionCode: 87 }, { certificateSha256: 'deadbeef' }, { url: 'https://example.invalid/fixture.apk' }]) {
    f.write(metadataPath, { ...metadata, ...changes });
    assert.match(f.publish().stderr, /verification mismatch/);
  }
  f.write(metadataPath, metadata); f.write(`artifacts/release/${f.build.name}`, 'Changed bytes');
  assert.match(f.publish().stderr, /verification mismatch/);
  assert.throws(() => f.read('github-calls.jsonl'), /ENOENT/);
});

test('a failed draft can be repaired only at its exact tag commit; stale runs cannot become the newest download', t => {
  const f = fixture(t); assert.equal(f.packageApk().status, 0);
  f.write('github-state.json', { releases: [{ tag_name: f.tag, draft: true, target_commitish: f.commit }], tagCommit: 'b'.repeat(40) });
  assert.match(f.publish().stderr, /another commit/);
  f.write('github-state.json', { releases: [{ tag_name: 'android-dev-43-aaaaaaaaaaaa', draft: false }] });
  assert.match(f.publish().stderr, /newer Android Dev/);
  f.write('github-state.json', { releases: [], orphanTag: f.tag });
  assert.match(f.publish().stderr, /already exists without a release/);
  f.write('github-state.json', { releases: [{ tag_name: f.tag, draft: true, target_commitish: f.commit }], tagCommit: f.commit });
  const retry = f.publish(); assert.equal(retry.status, 0, retry.stderr);
  assert.equal(f.state().releases[0].draft, false);
});

test('API failures and uploaded-byte mismatches leave the download unpublished', t => {
  const f = fixture(t); assert.equal(f.packageApk().status, 0);
  assert.notEqual(f.publish({ FIXTURE_API_ERROR: '1' }).status, 0);
  assert.deepEqual(f.state().releases, []);
  const corrupt = f.publish({ FIXTURE_CORRUPT_UPLOAD: '1' });
  assert.notEqual(corrupt.status, 0); assert.match(corrupt.stderr, /incomplete or changed/);
  assert.equal(f.state().releases[0].draft, true);
  const retry = f.publish(); assert.equal(retry.status, 0, retry.stderr);
});
