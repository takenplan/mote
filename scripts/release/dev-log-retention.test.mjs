import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, readdir, rm, stat, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseEnv } from 'node:util';
import { DatabaseSync } from 'node:sqlite';
import { createHash } from 'node:crypto';
import { profilePaths, loadProfile, atomicJson, nativeIdentity, stopNative, assertLogRetentionCompatible, composeOperation, compose } from '../profile-lib.mjs';
import { cli, freePort, updateEnvironment, request } from '../profile-fixtures.mjs';

async function fixture(t, profile = 'dev') {
  const home = await mkdtemp(join(tmpdir(), 'mote-log-retention-fixture-'));
  t.after(async () => {
    const p = await loadProfile(profilePaths(profile, home));
    const current = await nativeIdentity(p);
    if (current.running && current.managed) await stopNative(p);
    await rm(home, { recursive: true, force: true });
  });
  await cli(home, profile, 'init', ['--port', String(await freePort())]);
  const p = await loadProfile(profilePaths(profile, home)), release = await releaseFixture(home, 'capable');
  await atomicJson(p.metaFile, { ...p.meta, release });
  return loadProfile(profilePaths(profile, home));
}
async function releaseFixture(home, kind) {
  const release = join(home, `${kind}-release`);
  await mkdir(join(release, 'apps/server/dist'), { recursive: true });
  await writeFile(join(release, 'package.json'), '{"type":"module"}');
  if (kind === 'capable') await writeFile(join(release, 'apps/server/dist/log-retention-config.mjs'), '// Generated capacity capability marker\n');
  // A generated server with the historical strict 8 MiB parser demonstrates
  // compatibility through the real CLI/supervisor lifecycle without models.
  await writeFile(join(release, 'apps/server/dist/index.js'), `import {createServer} from 'node:http';import {writeFileSync} from 'node:fs';import {join} from 'node:path';
const input=process.env.MOTE_LOG_MAX_MB,max=${kind === 'capable' ? "input==='auto'?100:Number(input??2)" : 'Number(input??2)'};
if(!Number.isFinite(max)||max<0.1||max>${kind === 'capable' ? 100 : 8})throw Error('Generated strict capacity parser rejected configuration');
writeFileSync(join(process.env.MOTE_STORAGE_SOURCE,'generated-entry-ran'),'Generated entry reached');
const server=createServer((req,res)=>{res.setHeader('content-type','application/json');res.end(JSON.stringify(req.url==='/api/diagnostics'?{limits:{maxFileBytes:Math.floor(max*1024*1024),maxFiles:3,maxEvents:2000}}:{ok:true}));});
server.listen(Number(process.env.MOTE_PORT),'127.0.0.1');process.on('SIGTERM',()=>server.close(()=>process.exit(0)));\n`);
  return release;
}
const configuration = async p => JSON.parse((await cli(p.home, p.profile, 'config')).stdout).diagnostics;
const adopt = async p => JSON.parse((await cli(p.home, p.profile, 'log-retention', ['--defaults'])).stdout);
const otherValues = raw => Object.entries(parseEnv(raw)).filter(([key]) => key !== 'MOTE_LOG_MAX_MB').sort();

test('new DEV uses the profile default and other profiles retain explicit 2 MiB defaults', async t => {
  for (const profile of ['dev', 'test', 'prod']) {
    const p = await fixture(t, profile), raw = await readFile(p.envFile);
    assert.equal(p.env.MOTE_LOG_MAX_MB, profile === 'dev' ? 'auto' : '2');
    assert.deepEqual(await configuration(p), { logMaxMiB: profile === 'dev' ? 100 : 2, logMaxFiles: 3, logMaxEntries: 2000, logMaxMiBSource: profile === 'dev' ? 'profile-default' : 'explicit' });
    assert.deepEqual(await readFile(p.envFile), raw, 'Inspecting configuration never migrates the file');
    if (profile === 'dev') {
      const first = await adopt(p);
      assert.deepEqual(first, { profile, changed: false, before: { maxFileMiB: 100, maxFiles: 3 }, after: { maxFileMiB: 100, maxFiles: 3 }, restartRequired: true });
      assert.deepEqual(await readFile(p.envFile), raw);
    } else {
      const rejected = await cli(p.home, profile, 'log-retention', ['--defaults'], { fail: true });
      assert.match(rejected.stderr, /only available for the dev profile/);
      assert.deepEqual(await readFile(p.envFile), raw);
    }
  }
});

test('legacy and custom numeric DEV limits stay explicit until requested; adoption changes only the per-file setting', async t => {
  for (const maxMiB of ['2', '7', '75', '100']) {
    let p = await fixture(t);
    p = await updateEnvironment(p, { MOTE_LOG_MAX_MB: maxMiB, MOTE_LOG_MAX_FILES: '6', MOTE_LOG_MAX_ENTRIES: '4317', MOTE_MODEL_API_KEY: 'generated-private-model-key', MOTE_DATA_KEY: 'generated-private-data-key', MOTE_PUBLIC_URL: 'https://generated-retention.example' });
    const raw = await readFile(p.envFile, 'utf8'), metadata = await readFile(p.metaFile);
    await writeFile(join(p.dataDir, 'generated-evidence.txt'), 'Generated archive marker');
    assert.deepEqual(await configuration(p), { logMaxMiB: Number(maxMiB), logMaxFiles: 6, logMaxEntries: 4317, logMaxMiBSource: 'explicit' });
    assert.deepEqual(await readFile(p.envFile, 'utf8'), raw);
    await cli(p.home, 'dev', 'log-retention', [], { fail: true });
    assert.equal(await readFile(p.envFile, 'utf8'), raw, 'The explicit adoption flag is required');
    const result = await adopt(p), next = await readFile(p.envFile, 'utf8');
    assert.deepEqual(result, { profile: 'dev', changed: true, before: { maxFileMiB: Number(maxMiB), maxFiles: 6 }, after: { maxFileMiB: 100, maxFiles: 6 }, restartRequired: true });
    assert.equal(next, raw.replace(/^MOTE_LOG_MAX_MB=.*$/m, "MOTE_LOG_MAX_MB='auto'"));
    assert.deepEqual(otherValues(next), otherValues(raw));
    assert.deepEqual(await readFile(p.metaFile), metadata);
    assert.equal((await stat(p.envFile)).mode & 0o777, 0o600);
    assert.deepEqual(await readdir(p.dataDir), ['generated-evidence.txt']);
    assert.ok(!(await readdir(p.directory)).some(name => name === 'process.json' || name === 'lifecycle.lock' || name.endsWith('.tmp')));
    for (const privateValue of [p.directory, p.env.MOTE_TOKEN, 'generated-private-model-key', 'generated-private-data-key', 'https://generated-retention.example']) assert.ok(!JSON.stringify(result).includes(privateValue));
    assert.equal((await adopt(p)).changed, false);
    assert.equal(await readFile(p.envFile, 'utf8'), next, 'Repeated adoption is byte-for-byte idempotent');
    assert.deepEqual(await configuration(p), { logMaxMiB: 100, logMaxFiles: 6, logMaxEntries: 4317, logMaxMiBSource: 'profile-default' });
  }
});

test('adoption safely handles a missing or exported setting while preserving comments and other fields', async t => {
  for (const assignment of ['', "  export MOTE_LOG_MAX_MB = '2' # generated legacy setting"]) {
    const p = await fixture(t);
    const initial = await readFile(p.envFile, 'utf8');
    const raw = initial.replace(/^MOTE_LOG_MAX_MB=.*$/m, assignment) + '# Generated trailing comment\n';
    await writeFile(p.envFile, raw);
    const result = await adopt(p), next = await readFile(p.envFile, 'utf8');
    assert.equal(result.changed, true);
    assert.equal(result.before.maxFileMiB, assignment ? 2 : 100);
    assert.equal(parseEnv(next).MOTE_LOG_MAX_MB, 'auto');
    assert.deepEqual(otherValues(next), otherValues(raw));
    assert.ok(next.includes('# Generated trailing comment\n'));
    assert.equal((await stat(p.envFile)).mode & 0o777, 0o600);
  }
});

test('duplicate settings, invalid limits and active lifecycle ownership fail without changing private configuration', async t => {
  for (const change of ["MOTE_LOG_MAX_MB='auto'\nMOTE_LOG_MAX_MB='auto'", "MOTE_LOG_MAX_MB=''", "MOTE_LOG_MAX_MB='101'"]) {
    const p = await fixture(t), initial = await readFile(p.envFile, 'utf8');
    const raw = initial.replace(/^MOTE_LOG_MAX_MB=.*$/m, change);
    await writeFile(p.envFile, raw);
    await cli(p.home, 'dev', 'log-retention', ['--defaults'], { fail: true });
    assert.equal(await readFile(p.envFile, 'utf8'), raw);
    assert.ok(!(await readdir(p.directory)).some(name => name === 'lifecycle.lock' || name.endsWith('.tmp')));
  }
  const p = await fixture(t), raw = await readFile(p.envFile);
  await writeFile(join(p.directory, 'lifecycle.lock'), String(process.pid), { mode: 0o600 });
  const rejected = await cli(p.home, 'dev', 'log-retention', ['--defaults'], { fail: true });
  assert.match(rejected.stderr, /Another profile command is running/);
  assert.deepEqual(await readFile(p.envFile), raw);
  assert.equal(await readFile(join(p.directory, 'lifecycle.lock'), 'utf8'), String(process.pid));
});

test('old native releases reject auto/large limits and migration before launch or private writes; numeric 2 remains usable', async t => {
  let p = await fixture(t), release = await releaseFixture(p.home, 'legacy');
  await atomicJson(p.metaFile, { ...p.meta, release });
  p = await loadProfile(profilePaths('dev', p.home));
  await writeFile(join(p.dataDir, 'generated-evidence.txt'), 'Generated evidence is untouched');
  for (const maxMiB of ['auto', '100']) {
    p = await updateEnvironment(p, { MOTE_LOG_MAX_MB: maxMiB });
    const env = await readFile(p.envFile), meta = await readFile(p.metaFile);
    const rejected = await cli(p.home, 'dev', 'start', [], { fail: true });
    assert.match(rejected.stderr, /updated release\/image.*explicit MOTE_LOG_MAX_MB of 8 or less/);
    assert.deepEqual(await readFile(p.envFile), env); assert.deepEqual(await readFile(p.metaFile), meta);
    assert.deepEqual(await readdir(p.dataDir), ['generated-evidence.txt']);
    assert.ok(!(await readdir(p.directory)).includes('process.json'));
  }
  p = await updateEnvironment(p, { MOTE_LOG_MAX_MB: '2' });
  const env = await readFile(p.envFile), meta = await readFile(p.metaFile);
  await cli(p.home, 'dev', 'log-retention', ['--defaults'], { fail: true });
  assert.deepEqual(await readFile(p.envFile), env); assert.deepEqual(await readFile(p.metaFile), meta);
  assert.deepEqual(await readdir(p.dataDir), ['generated-evidence.txt']);
  await cli(p.home, 'dev', 'start');
  assert.equal((await request(p, '/api/diagnostics')).limits.maxFileBytes, 2 * 1024 * 1024);
  assert.equal((await nativeIdentity(p)).running, true);
});

test('incompatible upgrade and rollback reject before stopping the current process or making a backup', async t => {
  let p = await fixture(t), legacy = await releaseFixture(p.home, 'legacy');
  const snapshot = join(p.home, 'generated-previous-snapshot'); await mkdir(snapshot);
  const database = new DatabaseSync(join(snapshot, 'mote.sqlite'));
  database.exec("CREATE TABLE settings (key TEXT PRIMARY KEY,value TEXT); INSERT INTO settings VALUES ('backend_epoch','4')"); database.close();
  const hash = createHash('sha256').update(await readFile(join(snapshot, 'mote.sqlite'))).digest('hex');
  await atomicJson(join(snapshot, 'backup-manifest.json'), { version: 1, storageEpoch: 4, checksums: { 'mote.sqlite': hash } });
  await atomicJson(p.metaFile, { ...p.meta, previous: { ...p.meta, release: legacy, backup: snapshot } });
  p = await loadProfile(profilePaths('dev', p.home));
  await writeFile(join(p.dataDir, 'generated-evidence.txt'), 'Generated current evidence');
  await cli(p.home, 'dev', 'start');
  const env = await readFile(p.envFile), meta = await readFile(p.metaFile), processRecord = await readFile(p.processFile);
  const dataNames = (await readdir(p.dataDir)).sort(), backupNames = await readdir(join(p.directory, 'backups'));
  for (const [action, args] of [['upgrade', ['--release', legacy]], ['rollback', ['--restore-data']]]) {
    const rejected = await cli(p.home, 'dev', action, args, { fail: true });
    assert.match(rejected.stderr, /selected release\/image could not be verified to support this log capacity/);
    assert.deepEqual(await readFile(p.envFile), env); assert.deepEqual(await readFile(p.metaFile), meta);
    assert.deepEqual(await readFile(p.processFile), processRecord);
    assert.deepEqual((await readdir(p.dataDir)).sort(), dataNames);
    assert.deepEqual(await readdir(join(p.directory, 'backups')), backupNames);
    assert.equal(await readFile(join(p.dataDir, 'generated-evidence.txt'), 'utf8'), 'Generated current evidence');
    assert.equal((await nativeIdentity(p)).running, true);
    assert.equal((await request(p, '/api/diagnostics')).limits.maxFileBytes, 100 * 1024 * 1024);
  }
});

test('Docker capacity capability probe is inert, offline and bounded, with no probe for compatible explicit limits', async () => {
  const p = { profile: 'dev', env: { MOTE_LOG_MAX_MB: 'auto', MOTE_TOKEN: 'generated-private-token' }, meta: { runtime: 'docker', image: 'generated-capability-image' } };
  const calls = [];
  await assertLogRetentionCompatible(p, { execute: async (...args) => { calls.push(args); return ''; } });
  assert.equal(calls.length, 1);
  const [binary, args, options] = calls[0];
  assert.equal(binary, 'docker');
  assert.deepEqual(args.slice(0, 10), ['run', '--rm', '--pull', 'never', '--network', 'none', '--entrypoint', 'node', 'generated-capability-image', '--input-type=module']);
  assert.deepEqual(options, { capture: true, timeoutMs: 15000 });
  assert.ok(!JSON.stringify(calls).includes('generated-private-token'));
  assert.ok(!args.slice(0, 9).some(value => ['--volume', '--mount', '-v', '-e', '--env', '--env-file'].includes(value)));
  await assert.rejects(assertLogRetentionCompatible(p, { execute: async () => { throw Error('Generated private Docker output'); } }), error => /updated release\/image/.test(error.message) && !error.message.includes('Generated private Docker output'));
  for (const maxMiB of ['2', '8']) await assertLogRetentionCompatible({ ...p, env: { ...p.env, MOTE_LOG_MAX_MB: maxMiB } }, { execute: async () => { throw Error('Compatible numeric setting must not probe'); } });
});

test('Compose capacity dispatch finds the subcommand after global options without changing transport arguments', () => {
  for (const [args, operation] of [
    [['up', '--detach'], 'up'],
    [['--profile', 'up', 'ps'], 'ps'],
    [['--ansi', 'never', '--parallel', '2', '--progress', 'plain', 'up', '--detach'], 'up'],
    [['-p', 'generated-project', '-f', 'generated.yaml', '--project-directory', '/generated', '--env-file', '/generated.env', 'create'], 'create'],
    [['--project-name=generated', '--file=generated.yaml', '--profile=generated', '--parallel=2', '--ansi=never', '--progress=plain', 'restart'], 'restart'],
    [['-pgenerated', '-fgenerated.yaml', '--dry-run', 'run', '--rm', 'mote'], 'run'],
    [['--compatibility', '--', 'up'], 'up'],
    [['--help'], undefined],
  ]) {
    const before = [...args];
    assert.equal(composeOperation(args), operation);
    assert.deepEqual(args, before);
  }
});

test('Compose global flags cannot bypass capacity preflight before private generated configuration is written', async t => {
  const p = await fixture(t), release = await releaseFixture(p.home, 'legacy');
  const prospective = { ...p, meta: { ...p.meta, release } };
  const env = await readFile(p.envFile), meta = await readFile(p.metaFile);
  // Native marker inspection makes this dispatch fixture independent of an
  // installed Docker engine; the guard must fail before reaching transport.
  for (const operation of ['up', 'create', 'run', 'restart']) {
    await assert.rejects(compose(prospective, ['--ansi', 'never', '--profile=generated', '-pgenerated', operation]), /could not be verified to support this log capacity/);
    assert.deepEqual(await readdir(join(p.directory, 'generated')), []);
    assert.deepEqual(await readFile(p.envFile), env); assert.deepEqual(await readFile(p.metaFile), meta);
  }
});
