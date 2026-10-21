import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export function missingDependencies(manifestPath) {
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  const require = createRequire(manifestPath);
  return Object.keys({ ...manifest.dependencies, ...manifest.devDependencies }).filter(name =>
    !require.resolve.paths(name)?.some(directory => existsSync(join(directory, name, 'package.json'))));
}

export function desktopRuntimeFailure(manifestPath) {
  try {
    const binary = createRequire(manifestPath)('electron');
    if (typeof binary === 'string' && existsSync(binary)) return undefined;
  } catch {}
  return 'Electron executable is missing for the macOS hidden-window regression. Run npm rebuild electron before retrying.';
}

/** Gradle's local.properties takes precedence over environment discovery. */
export function androidEnvironment(directory = process.cwd(), env = process.env, home = homedir()) {
  const properties = join(directory, 'apps/android/local.properties');
  const configured = existsSync(properties) ? /^sdk\.dir\s*=\s*(.+)$/m.exec(readFileSync(properties, 'utf8'))?.[1]?.trim()
    .replace(/\\:/g, ':').replace(/\\ /g, ' ').replace(/\\\\/g, '\\') : undefined;
  const sdk = configured ? resolve(directory, 'apps/android', configured) : resolve(env.ANDROID_HOME || env.ANDROID_SDK_ROOT ||
    (process.platform === 'darwin' ? join(home, 'Library/Android/sdk') : join(home, 'Android/Sdk')));
  return { ANDROID_HOME: sdk, ANDROID_SDK_ROOT: sdk };
}

export function checkEnvironment({ directory = process.cwd(), workspaces = [], android = false, env = process.env, home = homedir(), dependencies = true } = {}) {
  const failures = [];
  const manifest = resolve(directory, 'package.json');
  if (Number(process.versions.node.split('.')[0]) < 24) failures.push('Node 24 or newer is required.');
  const manifests = dependencies ? [manifest] : [];
  for (const name of workspaces) {
    const parent = name === '@mote/server' || name === '@mote/web' || name === '@mote/desktop' ? 'apps' : 'packages';
    manifests.push(resolve(directory, parent, name.slice('@mote/'.length), 'package.json'));
  }
  for (const path of manifests) {
    try {
      const missing = missingDependencies(path);
      if (missing.length) failures.push(`Missing dependencies in ${path}: ${missing.join(', ')}. Run npm ci first.`);
    } catch (error) { failures.push(`Cannot inspect dependencies: ${path}: ${error.code ?? error.message}`); }
  }
  if (!failures.length && process.platform === 'darwin' && workspaces.includes('@mote/desktop')) {
    const failure = desktopRuntimeFailure(resolve(directory, 'apps/desktop/package.json'));
    if (failure) failures.push(failure);
  }
  // Web integration fixtures use the real Server's native SQLite adapter too.
  if (!failures.length && workspaces.some(name => name === '@mote/server' || name === '@mote/web')) {
    const probe = spawnSync(process.execPath, ['-e', [
      "const {createRequire}=require('node:module'),{resolve}=require('node:path');",
      "const server=createRequire(resolve('apps/server/package.json'));",
      "const mem0=createRequire(server.resolve('mem0ai/oss'));",
      "for(const path of new Set([server.resolve('better-sqlite3'),mem0.resolve('better-sqlite3')])){const D=require(path),db=new D(':memory:');db.prepare('SELECT 1').get();db.close();}",
    ].join('')],
      { cwd: directory, encoding: 'utf8' });
    if (probe.status !== 0) failures.push(`Server/Mem0 native SQLite cannot run on Node ${process.versions.node} (ABI ${process.versions.modules}). Rebuild better-sqlite3 using this Node runtime and verify the Server's Mem0 installation.`);
  }
  if (android) {
    if (!existsSync(join(directory, 'apps/android/gradlew'))) failures.push('Android Gradle wrapper is missing.');
    const java = env.JAVA_HOME ? join(env.JAVA_HOME, 'bin/java') : 'java';
    const result = spawnSync(java, ['-version'], { encoding: 'utf8', env: { ...env } });
    const major = /version "(?:1\.)?(\d+)/.exec(`${result.stderr ?? ''} ${result.stdout ?? ''}`)?.[1];
    if (result.status !== 0 || !major || Number(major) < 17) failures.push('Java 17 or newer is required for the Android unit check. Set JAVA_HOME.');
    const sdk = androidEnvironment(directory, env, home).ANDROID_HOME;
    for (const path of ['platforms/android-36/android.jar', 'build-tools/36.0.0/source.properties']) {
      if (!existsSync(join(sdk, path))) failures.push(`Android SDK prerequisite is missing: ${join(sdk, path)}. Install platforms;android-36 and build-tools;36.0.0.`);
    }
  }
  return failures;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const workspaces = []; let android = false, dependencies = true;
  for (let i = 2; i < process.argv.length; i++) {
    if (process.argv[i] === '--workspace' && process.argv[i + 1]?.startsWith('@mote/')) workspaces.push(process.argv[++i]);
    else if (process.argv[i] === '--android') android = true;
    else if (process.argv[i] === '--node-only') dependencies = false;
    else throw Error(`Invalid environment check argument: ${process.argv[i]}`);
  }
  const failures = checkEnvironment({ workspaces, android, dependencies });
  if (failures.length) { console.error(failures.join('\n')); process.exitCode = 1; }
  else console.log(`Environment ready: Node ${process.versions.node}, ABI ${process.versions.modules}${android ? ', Android prerequisites present' : ''}.`);
}
