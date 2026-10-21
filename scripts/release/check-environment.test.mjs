import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { checkEnvironment, missingDependencies, desktopRuntimeFailure, androidEnvironment } from './check-environment.mjs';

test('dependency preflight detects undeclared installations without importing packages or building', t => {
  const directory = mkdtempSync(join(tmpdir(), 'mote-check-environment-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const path = join(directory, 'package.json');
  writeFileSync(path, JSON.stringify({ dependencies: { 'generated-missing-package': '1' } }));
  assert.deepEqual(missingDependencies(path), ['generated-missing-package']);
  assert.ok(checkEnvironment({ directory }).some(failure => failure.includes('generated-missing-package')));
  mkdirSync(join(directory, 'node_modules/generated-missing-package'), { recursive: true });
  writeFileSync(join(directory, 'node_modules/generated-missing-package/package.json'), '{}');
  writeFileSync(join(directory, 'node_modules/generated-missing-package/index.js'), 'throw Error("must not import")');
  assert.deepEqual(checkEnvironment({ directory }), []);
});

test('missing workspace manifests fail before native probes or application checks', t => {
  const directory = mkdtempSync(join(tmpdir(), 'mote-check-workspaces-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  writeFileSync(join(directory, 'package.json'), '{}');
  assert.ok(checkEnvironment({ directory, workspaces: ['@mote/web'] }).some(failure => failure.includes('apps/web/package.json')));
});

test('preflight exercises the actual nested Mem0 SQLite resolution as well as the Server adapter', t => {
  const directory = mkdtempSync(join(tmpdir(), 'mote-check-native-resolution-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const put = (path, body) => {
    const target = join(directory, path); mkdirSync(join(target, '..'), { recursive: true }); writeFileSync(target, body);
  };
  const adapter = 'module.exports=class {prepare(){return {get(){return 1}}}close(){}}';
  put('package.json', '{}');
  put('apps/server/package.json', JSON.stringify({ dependencies: { mem0ai: '1', 'better-sqlite3': '1' } }));
  put('node_modules/better-sqlite3/package.json', '{"main":"index.cjs"}');
  put('node_modules/better-sqlite3/index.cjs', adapter);
  put('apps/server/node_modules/mem0ai/package.json', '{"exports":{"./oss":"./oss.cjs"}}');
  put('apps/server/node_modules/mem0ai/oss.cjs', 'module.exports={}');
  put('apps/server/node_modules/mem0ai/node_modules/better-sqlite3/package.json', '{"main":"index.cjs"}');
  put('apps/server/node_modules/mem0ai/node_modules/better-sqlite3/index.cjs', 'throw Error("generated nested ABI failure")');
  assert.ok(checkEnvironment({ directory, workspaces: ['@mote/server'] }).some(failure => failure.includes('Mem0 native SQLite')));
  put('apps/server/node_modules/mem0ai/node_modules/better-sqlite3/index.cjs', adapter);
  assert.deepEqual(checkEnvironment({ directory, workspaces: ['@mote/server'] }), []);
});

test('Desktop preflight checks the installed Electron executable without opening a window', t => {
  const directory = mkdtempSync(join(tmpdir(), 'mote-check-electron-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const manifest = join(directory, 'package.json'); writeFileSync(manifest, '{}');
  assert.match(desktopRuntimeFailure(manifest), /Electron executable is missing/);
  const module = join(directory, 'node_modules/electron'); mkdirSync(module, { recursive: true });
  writeFileSync(join(module, 'package.json'), '{"main":"index.cjs"}');
  writeFileSync(join(module, 'index.cjs'), "module.exports=__dirname+'/generated-executable'");
  assert.match(desktopRuntimeFailure(manifest), /Electron executable is missing/);
  writeFileSync(join(module, 'generated-executable'), 'generated runtime marker; never executed');
  assert.equal(desktopRuntimeFailure(manifest), undefined);
});

test('Android SDK discovery agrees with Gradle local properties and validates packages before execution', t => {
  const directory = mkdtempSync(join(tmpdir(), 'mote-android-preflight-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  writeFileSync(join(directory, 'package.json'), '{}');
  const put = (path, value = '') => { mkdirSync(join(directory, path, '..'), { recursive: true }); writeFileSync(join(directory, path), value); };
  put('apps/android/gradlew');
  const sdk = join(directory, 'configured SDK'), other = join(directory, 'other SDK');
  put('apps/android/local.properties', `sdk.dir=${sdk.replace(/ /g, '\\ ')}\n`);
  const env = { ...process.env, ANDROID_HOME: other, ANDROID_SDK_ROOT: other };
  assert.deepEqual(androidEnvironment(directory, env), { ANDROID_HOME: sdk, ANDROID_SDK_ROOT: sdk });
  assert.ok(checkEnvironment({ directory, android: true, env }).some(failure => failure.includes('platforms/android-36/android.jar')));
  for (const path of ['platforms/android-36/android.jar', 'build-tools/36.0.0/source.properties']) put(`configured SDK/${path}`);
  assert.ok(!checkEnvironment({ directory, android: true, env }).some(failure => failure.includes('Android SDK prerequisite')));
  const discovered = androidEnvironment(directory, {}, directory);
  assert.equal(discovered.ANDROID_HOME, sdk, 'local.properties also works with no environment SDK');
});
