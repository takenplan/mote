#!/usr/bin/env python3
"""Freeze one real Android art-direction candidate using a generated-only AVD.

Every PNG/scene JSON comes from the instrumented application's actual secure
windows. System keyboard pixels and the device compositor are never captured.
The output must be a new directory; previous candidates are never overwritten.
"""
import argparse
import hashlib
import io
import json
from pathlib import Path
import shutil
import subprocess
import tarfile
import time
import xml.etree.ElementTree as ET

REPO = Path(__file__).resolve().parents[3]
ANDROID = REPO / 'apps/android'
PACKAGE = 'dev.mote.collector.dev'
RUNNER = PACKAGE + '.test/androidx.test.runner.AndroidJUnitRunner'
AVD = 'mote_ui_focus_5330_api37'
SCENES = ['home', 'content-populated', 'note', 'home-note-original', 'ask',
          'settings', 'connection', 'import-local-task']
VARIANTS = ['default', 'english', 'compact', 'compact-english']

parser = argparse.ArgumentParser(description=__doc__)
candidate = parser.add_mutually_exclusive_group(required=True)
candidate.add_argument('--round', type=int, choices=range(1, 6))
candidate.add_argument('--label', choices=['rollout'], help='A new rollout, separate from the historical five candidates')
parser.add_argument('--output', type=Path, required=True)
parser.add_argument('--source-commit', required=True)
parser.add_argument('--serial', choices=['emulator-5582'], default='emulator-5582')
parser.add_argument('--adb', default=str(Path.home() / 'Library/Android/sdk/platform-tools/adb'))
parser.add_argument('--verify-journeys', action='store_true', help='First/last-round draft, lifecycle, Start and blocked queue checks')
args = parser.parse_args()
output = args.output.resolve()
if output.exists():
    raise SystemExit('Candidate output already exists; use a fresh directory and retain failed evidence.')
output.mkdir(parents=True)

def run(command, *, cwd=REPO, timeout=240, log=None):
    started = time.monotonic()
    result = subprocess.run(command, cwd=cwd, capture_output=True, timeout=timeout)
    if log:
        log.write_bytes(result.stdout + result.stderr)
    if result.returncode:
        raise RuntimeError(f'{command[0]} failed; see {log or "command output"}')
    return result.stdout, round(time.monotonic() - started, 3)

def git(*command):
    return run(['git', *command])[0].decode().strip()

commit = git('rev-parse', args.source_commit)
assert git('rev-parse', 'HEAD') == commit, 'Commit must be the current frozen candidate'
assert not git('diff', commit, '--', 'apps/android', 'packages/shared/design-tokens.json'), 'Android/token source differs from its frozen commit'
assert not git('ls-files', '--others', '--exclude-standard', '--', 'apps/android'), 'Untracked Android source cannot belong to a committed candidate'
source_files = git('ls-files', 'apps/android', 'packages/shared/design-tokens.json').splitlines()
source_hashes = {name: hashlib.sha256((REPO / name).read_bytes()).hexdigest() for name in source_files}
(output / 'source-hashes.json').write_text(json.dumps({'sourceCommit': commit, 'files': source_hashes}, indent=2))
run(['git', 'archive', '--format=tar', '--output=' + str(output / 'android-source.tar'), commit,
     'apps/android', 'packages/shared/design-tokens.json'])

_, build_seconds = run(['./gradlew', ':app:assembleDevelopment', ':app:assembleDevelopmentAndroidTest',
                        *([':app:testDevelopmentUnitTest'] if args.verify_journeys else []),
                        '-Pmote.testBuildType=development', '--console=plain', '--quiet'], cwd=ANDROID, timeout=900, log=output / 'build.log')
(output / 'build-results.json').write_text(json.dumps({'passed': True, 'elapsedSeconds': build_seconds}, indent=2))
jvm = None
if args.verify_journeys:
    report_dir = ANDROID / 'app/build/test-results/testDevelopmentUnitTest'
    reports = sorted(report_dir.glob('TEST-*.xml'))
    assert reports, 'The requested JVM verification must provide its actual XML reports'
    shutil.copytree(report_dir, output / 'jvm-xml')
    suites = [ET.parse(report).getroot() for report in reports]
    jvm = {'classes': len(suites), **{key: sum(int(suite.get(key, '0')) for suite in suites)
                                     for key in ['tests', 'failures', 'errors', 'skipped']}}
    assert jvm['tests'] > 0 and jvm['failures'] == 0 and jvm['errors'] == 0 and jvm['skipped'] == 0
    (output / 'jvm-results.json').write_text(json.dumps(jvm, indent=2))
assert source_hashes == {name: hashlib.sha256((REPO / name).read_bytes()).hexdigest() for name in source_files}, 'Source changed while building'

def adb(*command, timeout=240):
    return run([args.adb, '-s', args.serial, *command], timeout=timeout)[0]

def shell(*command):
    return adb('shell', *command).decode().strip()

deadline = time.monotonic() + 240
while time.monotonic() < deadline:
    try:
        if shell('getprop', 'sys.boot_completed') == '1':
            break
    except RuntimeError:
        pass
    time.sleep(2)
else:
    raise RuntimeError('Owned headless emulator did not finish booting')

identity = {'sourceCommit': commit, 'round': args.round, 'label': args.label or ('R' + str(args.round)), 'serial': args.serial,
            'avd': shell('getprop', 'ro.boot.qemu.avd_name'),
            'fingerprint': shell('getprop', 'ro.build.fingerprint'),
            'generatedOnly': True, 'captureKind': 'application-windows-own-view',
            'systemImePixelsCaptured': False,
            'tokenSha256': source_hashes['packages/shared/design-tokens.json']}
assert identity['avd'] == AVD and '/emu64a:' in identity['fingerprint'], 'Refusing any other AVD or physical device'
if args.label == 'rollout':
    avd_config = (Path.home() / '.android/avd' / (AVD + '.avd/config.ini')).read_text()
    assert 'hw.camera.back=emulated' in avd_config and 'hw.camera.front=none' in avd_config and 'webcam' not in avd_config
    identity['cameraBackend'] = {'back': 'emulated', 'front': 'none', 'configSha256': hashlib.sha256(avd_config.encode()).hexdigest()}
assert shell('getprop', 'ro.build.version.sdk') == '37', 'Expected the known API37 generated-only fixture'
apks = output / 'apks'; apks.mkdir()
for key, source, target in [
    ('productApkSha256', ANDROID / 'app/build/outputs/apk/development/app-development.apk', apks / 'mote-development.apk'),
    ('testApkSha256', ANDROID / 'app/build/outputs/apk/androidTest/development/app-development-androidTest.apk', apks / 'mote-development-androidTest.apk')]:
    shutil.copy2(source, target)
    identity[key] = hashlib.sha256(target.read_bytes()).hexdigest()
    adb('install', '-r', str(target))
(output / 'environment.json').write_text(json.dumps(identity, indent=2))
for option in ['window_animation_scale', 'transition_animation_scale', 'animator_duration_scale']:
    shell('settings', 'put', 'global', option, '0')
shell('settings', 'put', 'secure', 'show_ime_with_hard_keyboard', '1')
shell('input', 'keyevent', '82')

def clear_generated_profile():
    assert shell('getprop', 'ro.boot.qemu.avd_name') == AVD
    shell('am', 'force-stop', PACKAGE)
    assert shell('pm', 'clear', PACKAGE) == 'Success'

def instrument(class_name, extras, log, expected):
    command = ['am', 'instrument', '-w', '-r', '-e', 'class', class_name]
    for key, value in extras.items():
        command.extend(['-e', key, str(value)])
    command.append(RUNNER)
    started = time.monotonic()
    result = adb('shell', *command).decode()
    log.write_text(result)
    assert f'OK ({expected} test' in result and 'FAILURES!!!' not in result and 'INSTRUMENTATION_CODE: 0' not in result, f'Instrumentation failed: {log}'
    return round(time.monotonic() - started, 3)

matrix = []; images = []; route_journeys = []; reader_lifecycle = []
for variant in VARIANTS:
    clear_generated_profile()
    compact = 'compact' in variant
    shell('wm', 'size', '1080x2400')
    shell('wm', 'density', '540' if compact else '420')
    shell('settings', 'put', 'system', 'font_scale', '1.3' if compact else '1.0')
    extras = {'uiIterationFixture': 'true', 'uiIterationRound': args.label or args.round, 'uiIterationVariant': variant}
    if compact:
        extras['uiIterationKeyboard'] = 'true'
    seconds = instrument('dev.mote.collector.UiIterationInstrumentedTest', extras, output / (variant + '.log'), 3)
    assert 'INSTRUMENTATION_STATUS_CODE: -4' not in (output / (variant + '.log')).read_text(), 'Matrix must not skip generated scenes'
    archive_path = f'files/ui-iterations/round-{args.label or args.round}'
    if args.label == 'rollout':
        shell('pm', 'grant', PACKAGE, 'android.permission.CAMERA')
        try:
            instrument('dev.mote.collector.UiRolloutInstrumentedTest',
                       {'uiIterationFixture': 'true', 'uiIterationRound': args.label, 'uiIterationVariant': variant, 'uiRolloutCameraBackend': 'emulated'},
                       output / ('rollout-surfaces-' + variant + '.log'), 1)
        finally:
            # Revoking this UID's runtime permission ends it; never do it inside instrumentation.
            shell('pm', 'revoke', PACKAGE, 'android.permission.CAMERA')
    if args.label == 'rollout':
        instrument('dev.mote.collector.UiInventoryRolloutInstrumentedTest',
                   {'uiIterationFixture': 'true', 'uiIterationVariant': variant},
                   output / ('rollout-inventory-' + variant + '.log'), 1)
    archive = adb('exec-out', 'run-as', PACKAGE, 'tar', '-cf', '-', archive_path)
    destination = output / variant; destination.mkdir()
    with tarfile.open(fileobj=io.BytesIO(archive)) as bundle:
        for member in bundle.getmembers():
            if member.isfile():
                relative = Path(member.name).relative_to(archive_path)
                if variant != 'default':
                    relative = relative.relative_to(variant)
                assert '..' not in relative.parts
                target = destination / relative; target.parent.mkdir(parents=True, exist_ok=True)
                target.write_bytes(bundle.extractfile(member).read())
    for scene in SCENES:
        assert (destination / (scene + '.png')).exists(), f'Missing required scene {variant}/{scene}'
    for png in sorted(destination.glob('*.png')):
        metadata = json.loads(png.with_suffix('.json').read_text())
        assert metadata['readiness']['ready'] is True and metadata['secureWindow'] is True
        assert metadata['captureKind'] == 'application-windows-own-view' and metadata['generatedOnly'] is True
        assert metadata['baseWindow']['width'] == 1080 and metadata['baseWindow']['height'] == 2400
        images.append({'path': str(png.relative_to(output)), 'sha256': hashlib.sha256(png.read_bytes()).hexdigest(),
                       'variant': variant, 'scene': png.stem, **metadata})
    if args.label == 'rollout' or args.round >= 2:
        clear_generated_profile()
        log = output / ('connection-return-' + variant + '.log')
        route_seconds = instrument('dev.mote.collector.ConnectionTaskReturnInstrumentedTest',
                                   {'uiIterationFixture': 'true', 'uiIterationVariant': variant}, log, 4)
        assert 'INSTRUMENTATION_STATUS_CODE: -4' not in log.read_text(), 'Actual task returns cannot be skipped'
        route_journeys.append({'variant': variant, 'passed': 4, 'skipped': 0, 'elapsedSeconds': route_seconds})
        (output / 'connection-return-results.json').write_text(json.dumps(route_journeys, indent=2))
    if args.label == 'rollout' or args.round == 5:
        clear_generated_profile()
        log = output / ('reader-lifecycle-' + variant + '.log')
        lifecycle_seconds = instrument('dev.mote.collector.CaptureReaderLifecycleInstrumentedTest',
                                       {'uiIterationFixture': 'true', 'uiIterationVariant': variant}, log, 2)
        assert 'INSTRUMENTATION_STATUS_CODE: -4' not in log.read_text(), 'Closed/opened reader lifecycle journeys cannot be skipped'
        reader_lifecycle.append({'variant': variant, 'passed': 2, 'skipped': 0, 'elapsedSeconds': lifecycle_seconds})
        (output / 'reader-lifecycle-results.json').write_text(json.dumps(reader_lifecycle, indent=2))
    matrix.append({'variant': variant, 'passed': 3, 'skipped': 0, 'elapsedSeconds': seconds,
                   'densityDpi': 540 if compact else 420, 'fontScale': 1.3 if compact else 1.0,
                   'actualImeExercised': compact, 'pngCount': len(list(destination.glob('*.png')))})
    (output / 'matrix-results.json').write_text(json.dumps(matrix, indent=2))
    print(json.dumps(matrix[-1]), flush=True)

journeys = []
if args.verify_journeys:
    shell('wm', 'density', '420'); shell('settings', 'put', 'system', 'font_scale', '1.0')
    for name, expected, extras in [
        ('NavigationInstrumentedTest', 10, {}),
        ('NotesDiagnosticsInstrumentedTest#readableDraftRestoresNativeEditorAfterActivityRecreation', 1, {}),
        ('AppCaptureSetupInstrumentedTest', 5, {}),
        ('LibraryResponsivenessInstrumentedTest#startButtonCommitsWhileBackgroundLibraryWorkHoldsTheQueue', 1, {'uiIterationFixture': 'true'})]:
        clear_generated_profile()
        log = output / (name.replace('#', '-') + '.log')
        seconds = instrument('dev.mote.collector.' + name, extras, log, expected)
        skips = log.read_text().count('INSTRUMENTATION_STATUS_CODE: -4')
        assert skips == (2 if name == 'NavigationInstrumentedTest' else 0), f'Unexpected journey skip: {log}'
        journeys.append({'test': name, 'passed': expected - skips, 'skipped': skips, 'elapsedSeconds': seconds})
(output / 'journey-results.json').write_text(json.dumps(journeys, indent=2))
assert source_hashes == {name: hashlib.sha256((REPO / name).read_bytes()).hexdigest() for name in source_files}, 'Source changed during capture'
manifest = {**identity, 'images': images, 'matrix': matrix, 'journeys': journeys, 'connectionReturns': route_journeys, 'readerLifecycle': reader_lifecycle, 'jvm': jvm}
(output / 'image-manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2))

# Hand off a clean generated profile, without stopping the held AVD until review releases it.
clear_generated_profile()
shell('wm', 'density', '420'); shell('settings', 'put', 'system', 'font_scale', '1.0')
print(json.dumps({'ready': True, 'output': str(output), 'images': len(images), **identity}), flush=True)
