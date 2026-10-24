import {spawnSync} from 'node:child_process';
import {existsSync, mkdirSync, writeFileSync, readFileSync} from 'node:fs';
import {homedir} from 'node:os';
import {resolve} from 'node:path';

// No real device, external App or remote node participates. Build the development APKs first.
const serialIndex = process.argv.indexOf('--serial');
const serial = serialIndex >= 0 ? process.argv[serialIndex + 1] : undefined;
if (!serial?.startsWith('emulator-')) throw new Error('Pass --serial for the isolated mote_fixture_api35 emulator');
const adb = resolve(process.env.ANDROID_HOME ?? process.env.ANDROID_SDK_ROOT ?? resolve(homedir(), 'Library/Android/sdk'), 'platform-tools/adb');
function call(args) {
  const result = spawnSync(adb, ['-s', serial, ...args], {encoding: 'utf8', maxBuffer: 8 * 1024 * 1024});
  if (result.error || result.status !== 0) throw result.error ?? new Error(result.stderr || result.stdout);
  return result.stdout.trim();
}
const avd=call(['shell','getprop','ro.boot.qemu.avd_name']);
if(!['mote_fixture_api35','mote_fixture_api37'].includes(avd))throw new Error('Only dedicated Mote fixture AVDs are allowed');
for (const path of ['apps/android/app/build/outputs/apk/development/app-development.apk', 'apps/android/app/build/outputs/apk/androidTest/development/app-development-androidTest.apk']) {
  if (!existsSync(path)) throw new Error(`Build the generated fixture APK first: ${path}`);
  call(['install', '-r', resolve(path)]);
}
const application = 'dev.mote.collector.dev';
const permission = 'android.permission.POST_NOTIFICATIONS';
const granted = new RegExp(`${permission.replaceAll('.', '\\.')}:[^\n]*granted=true`).test(call(['shell', 'dumpsys', 'package', application]));
const services = call(['shell', 'settings', 'get', 'secure', 'enabled_accessibility_services']);
const enabled = call(['shell', 'settings', 'get', 'secure', 'accessibility_enabled']);
const tests = [
  'dev.mote.collector.UiPageReaderInstrumentedTest',
  'dev.mote.collector.UiPageLifecycleInstrumentedTest',
  'dev.mote.collector.UiPageServiceInstrumentedTest',
  'dev.mote.collector.AppPolicyInstrumentedTest#activityPipelineDoesNotNeedModelsAndMetadataTogglePreservesQueuedBytes',
  'dev.mote.collector.AppPolicyInstrumentedTest#generatedProviderReportsActualSizeAndModificationWithoutInventingDates',
  'dev.mote.collector.AppPolicyInstrumentedTest#expiredNodeSampleSkipsEphemeralOcrWhileCaptureAuthorizationRemainsCurrent',
];
const expectedTests=tests.reduce((count,test)=>{
  if(test.includes('#'))return count+1;
  const source=readFileSync(resolve('apps/android/app/src/androidTest/java',test.replaceAll('.','/')+'.kt'),'utf8');
  return count+(source.match(/@Test\b/g)??[]).length;
},0);
const centralIndex=process.argv.indexOf('--central-ready');
const central=centralIndex<0?undefined:JSON.parse(readFileSync(resolve(process.argv[centralIndex+1]),'utf8'));
if(central&&(!/^http:\/\/10\.0\.2\.2:\d+$/.test(central.url)||typeof central.token!=='string'||central.token.length<32))throw new Error('Central integration requires the generated isolated host fixture');
const fixtureArgs=central?['-e','fixtureCentralUrl',central.url,'-e','fixtureCentralToken',central.token]:[];
const startedAt = new Date().toISOString();
let output = '';
let failure;
try {
  call(['shell', 'pm', 'grant', application, permission]);
  output = call(['shell', 'am', 'instrument', '-w', '-r', '-e', 'class', tests.join(','), ...fixtureArgs, `${application}.test/androidx.test.runner.AndroidJUnitRunner`]);
  process.stdout.write(output + '\n');
  if (!output.includes(`OK (${expectedTests} tests)`) || /FAILURES!!!|INSTRUMENTATION_FAILED/.test(output)) throw new Error('The generated collection lifecycle suite did not pass');
} catch (error) {
  failure = error;
} finally {
  // Revoking the runner's host permission during Instrumentation kills the test process.
  // Restore it here, together with a second independent service-restoration boundary.
  const cleanupErrors = [];
  function cleanup(action) { try { action(); } catch (error) { cleanupErrors.push(error); } }
  for (const [key, value] of [['enabled_accessibility_services', services], ['accessibility_enabled', enabled]]) {
    cleanup(() => call(['shell', 'settings', value === 'null' ? 'delete' : 'put', 'secure', key, ...(value === 'null' ? [] : [value])]));
  }
  if (!granted) cleanup(() => call(['shell', 'pm', 'revoke', application, permission]));
  if (cleanupErrors.length) failure = new AggregateError([...(failure ? [failure] : []), ...cleanupErrors], 'Generated fixture suite or restoration failed');
}
const reportDirectory = resolve('apps/android/app/build/reports/page-capture-fixture');
mkdirSync(reportDirectory, {recursive: true});
writeFileSync(resolve(reportDirectory, 'last-run.json'), JSON.stringify({
  fixtureOnly: true, serial, avd, centralFixture:Boolean(central), startedAt,
  finishedAt: new Date().toISOString(), tests, status: failure ? 'failed' : 'passed',
  output, error: failure?.message,
}, null, 2) + '\n');
if (failure) throw failure;
