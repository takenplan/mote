import { it, expect, onTestFinished } from 'vitest';
import { chmodSync } from 'node:fs';
import { delimiter, join } from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { releaseFixture } from '../../../scripts/release/fixtures.mjs';

function fixture(arch = 'arm64', signing = 'adhoc') {
  const f = releaseFixture({ after: callback => onTestFinished(callback) });
  const git = args => execFileSync('git', args, { cwd: f.root, encoding: 'utf8', stdio: 'pipe' }).trim();
  git(['init']); git(['add', '.']);
  git(['-c', 'user.name=Generated Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '-m', 'Generated Desktop Dev source']);
  const commit = git(['rev-parse', 'HEAD']), run = 13, tag = `desktop-dev-${run}-${commit.slice(0, 12)}`;
  f.write('generated.zip', 'Generated Desktop Dev archive bytes');
  f.write('github-state.json', { releases: [] });
  // GitHub is the only substituted service. The actual metadata and publication
  // CLIs consume the generated archive; native packaging is qualified separately.
  f.write('bin/gh', `#!${process.execPath}
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const args=process.argv.slice(2),file=process.env.FIXTURE_GITHUB_STATE;
fs.appendFileSync(process.env.FIXTURE_GITHUB_LOG,JSON.stringify(args)+'\\n');
const state=JSON.parse(fs.readFileSync(file,'utf8'));
if(process.env.FIXTURE_API_ERROR)process.exit(1);
if(args[0]==='api'){
 if(args[1].includes('/releases?'))console.log(JSON.stringify([state.releases]));
 else if(args[1].includes('/git/matching-refs/'))console.log(JSON.stringify(state.refs||[]));
 else process.exit(2);
}else if(args[1]==='create')state.releases.push({tag_name:args[2],draft:true,target_commitish:args[args.indexOf('--target')+1]});
else if(args[1]==='upload'){
 state.assets=args.slice(args.indexOf('--clobber')+1).map(file=>({name:path.basename(file),size:fs.statSync(file).size,digest:'sha256:'+crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')}));
 if(process.env.FIXTURE_CORRUPT_UPLOAD)state.assets[0].digest='sha256:corrupt';
}else if(args[1]==='view')console.log(JSON.stringify({assets:state.assets}));
else if(args[1]==='edit')state.releases.find(r=>r.tag_name===args[2]).draft=false;
else process.exit(2);
fs.writeFileSync(file,JSON.stringify(state));
`);
  chmodSync(join(f.root, 'bin/gh'), 0o755);
  const env = {
    ...process.env, MOTE_BUILD_PROFILE: 'dev', GITHUB_REF: 'refs/heads/main', GITHUB_EVENT_NAME: 'workflow_dispatch',
    GITHUB_REPOSITORY: f.policy.repository, GITHUB_RUN_NUMBER: String(run), GITHUB_SHA: commit,
    MOTE_RELEASE_OUTPUT: join(f.root, 'artifacts/release'), MOTE_MAC_SIGNING_MODE: signing, MOTE_APPLE_TEAM_ID: 'FIXTURE123',
    PATH: join(f.root, 'bin') + delimiter + process.env.PATH,
    FIXTURE_GITHUB_STATE: join(f.root, 'github-state.json'), FIXTURE_GITHUB_LOG: join(f.root, 'github-calls.jsonl'),
  };
  execFileSync(process.execPath, [new URL('../../../scripts/release/asset-metadata.mjs', import.meta.url).pathname, 'desktop', join(f.root, 'generated.zip'), arch], { cwd: f.root, env, stdio: 'pipe' });
  const name = `mote-desktop-macos-dev-${arch}-2.5.0.zip`, metadataPath = `artifacts/release/${name}.asset.json`;
  const publish = (overrides = {}) => spawnSync(process.execPath, [new URL('../scripts/publish-dev.mjs', import.meta.url).pathname], { cwd: f.root, env: { ...env, ...overrides }, encoding: 'utf8' });
  const state = () => JSON.parse(f.read('github-state.json'));
  return { ...f, env, commit, run, tag, name, metadataPath, publish, state };
}

it('publishes the verified Mac Dev ZIP as its own immutable prerelease with a direct download and signing disclosure', () => {
  for (const [arch, signing] of [['arm64', 'adhoc'], ['x64', 'developer-id']]) {
    const f = fixture(arch, signing), result = f.publish();
    expect(result.status, result.stderr).toBe(0);
    expect(JSON.parse(result.stdout).published).toBe(f.tag);
    expect(f.state().releases[0].draft).toBe(false);
    expect(f.state().assets.map(asset => asset.name)).toEqual([f.name]);
    const notes = f.read('artifacts/release/desktop-dev-notes.md');
    expect(notes).toContain(`[Download Mac ZIP](https://github.com/${f.policy.repository}/releases/download/${f.tag}/${f.name})`);
    expect(notes).toContain(f.commit);
    expect(notes).toContain(signing === 'adhoc' ? 'ad-hoc; not Apple notarized' : 'Developer ID, team FIXTURE123');
    const calls = f.read('github-calls.jsonl').trim().split('\n').map(line => JSON.parse(line));
    const create = calls.find(args => args[1] === 'create');
    expect(create[create.indexOf('--target') + 1]).toBe(f.commit);
    for (const call of calls.filter(args => ['create', 'edit'].includes(args[1]))) {
      expect(call).toContain('--prerelease'); expect(call).toContain('--latest=false');
    }
    const before = f.read('github-state.json'), repeat = f.publish();
    expect(repeat.status).not.toBe(0); expect(repeat.stderr).toMatch(/immutable/);
    expect(f.read('github-state.json')).toBe(before);
  }
});

it('rejects untrusted triggers, wrong source revisions and invalid run numbers before accessing GitHub', () => {
  const f = fixture();
  for (const overrides of [
    { MOTE_BUILD_PROFILE: 'prod' }, { GITHUB_REF: 'refs/heads/feature' }, { GITHUB_REF: 'refs/tags/desktop-v2.5.0' },
    { GITHUB_REPOSITORY: 'fork/mote' }, { GITHUB_EVENT_NAME: 'pull_request' }, { GITHUB_SHA: 'a'.repeat(40) },
    { GITHUB_RUN_NUMBER: '' }, { GITHUB_RUN_NUMBER: '0' }, { GITHUB_RUN_NUMBER: '1.5' }, { GITHUB_RUN_NUMBER: '999999999999999999' },
  ]) expect(f.publish(overrides).status).not.toBe(0);
  expect(() => f.read('github-calls.jsonl')).toThrow(/ENOENT/);
});

it('refuses production identities, altered archives, mismatched provenance and invalid Developer ID metadata', () => {
  const f = fixture(), metadata = JSON.parse(f.read(f.metadataPath));
  for (const overrides of [
    { profile: 'prod' }, { component: 'android' }, { bundleId: 'dev.mote.collector' },
    { commit: 'a'.repeat(40) }, { arch: 'invalid' }, { platform: 'linux' }, { format: 'apk' },
    { signing: 'unsigned' }, { signing: 'developer-id', teamId: 'invalid' },
  ]) {
    f.write(f.metadataPath, { ...metadata, ...overrides });
    expect(f.publish().status).not.toBe(0);
  }
  f.write(f.metadataPath, metadata);
  const infoPath = 'artifacts/release/build-info.json', info = JSON.parse(f.read(infoPath));
  f.write(infoPath, { ...info, profile: 'prod' }); expect(f.publish().stderr).toMatch(/build information/);
  f.write(infoPath, info); f.write(`artifacts/release/${f.name}`, 'Changed archive bytes');
  expect(f.publish().stderr).toMatch(/verification mismatch/);
  expect(() => f.read('github-calls.jsonl')).toThrow(/ENOENT/);
});

it('never attaches installers from other components or profiles to the Dev release', () => {
  const f = fixture(); f.write('artifacts/release/mote-android.apk', 'Generated foreign installer');
  expect(f.publish().stderr).toMatch(/exactly one Desktop Dev/);
  expect(() => f.read('github-calls.jsonl')).toThrow(/ENOENT/);
});

it('blocks older runs, changed drafts, moved tags and orphan refs while repairing only the exact unfinished build', () => {
  const f = fixture();
  f.write('github-state.json', { releases: [{ tag_name: 'desktop-dev-14-aaaaaaaaaaaa', draft: false }] });
  expect(f.publish().stderr).toMatch(/newer Desktop Dev/);
  f.write('github-state.json', { releases: [{ tag_name: f.tag, draft: true, target_commitish: 'a'.repeat(40) }] });
  expect(f.publish().stderr).toMatch(/another commit/);
  const ref = { ref: `refs/tags/${f.tag}`, object: { type: 'commit', sha: 'a'.repeat(40) } };
  f.write('github-state.json', { releases: [{ tag_name: f.tag, draft: true, target_commitish: f.commit }], refs: [ref] });
  expect(f.publish().stderr).toMatch(/another commit/);
  f.write('github-state.json', { releases: [], refs: [ref] });
  expect(f.publish().stderr).toMatch(/without a release/);
  f.write('github-state.json', { releases: [{ tag_name: f.tag, draft: true, target_commitish: f.commit }] });
  const repaired = f.publish(); expect(repaired.status, repaired.stderr).toBe(0);
  expect(f.state().releases[0].draft).toBe(false);
});

it('keeps API failures and corrupt uploads unpublished, then repairs an interrupted draft', () => {
  const f = fixture();
  expect(f.publish({ FIXTURE_API_ERROR: '1' }).status).not.toBe(0);
  expect(f.state().releases).toEqual([]);
  const corrupt = f.publish({ FIXTURE_CORRUPT_UPLOAD: '1' });
  expect(corrupt.status).not.toBe(0); expect(corrupt.stderr).toMatch(/incomplete or changed/);
  expect(f.state().releases[0].draft).toBe(true);
  const retry = f.publish(); expect(retry.status, retry.stderr).toBe(0);
  expect(f.state().releases[0].draft).toBe(false);
});
