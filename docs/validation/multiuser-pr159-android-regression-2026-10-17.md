# PR159 Android regression — 2026-10-17

All **77 non-live instrumentation methods** pass against unchanged PR159 production source `a5f3bf460ae623bfdb30d459fef4c23f299182cf`. This closes all **57 previously UNRUN methods** from the [original C2 report](multiuser-final-joint-e2e.md). Three additional existing fixture variants also pass: QR acknowledgement across a real server restart, revocation after that restart, and an ASR transcript containing a literal `[SPEAKER_0]` prefix. No live-model call, screenshot or UI dump was performed in this run.

The [machine receipt](multiuser-pr159-android-regression-2026-10-17.json) records every accepted method, source, fixture script/arguments/hash, run time, log hash, APK/test input hashes, the exact 57-method closure and remaining boundaries. The old C2 receipts retain their historical 21 passed / 57 UNRUN disposition; they are not rewritten as this run.

## Source and execution

The first residual run uses literal `a5f3bf46`. Test-only successor `70c45087dfa41055cf5f53b82bebe463f3d2df17` adds three lines to one instrumentation journey, reopening the new owner's existing Memory tab before its positive control. It changes no product source or APK; the product APK SHA-256 remains identical. The other method bodies, assertions and deadlines are unchanged. The corrected method and all 20 previously executed non-live methods then run on the rebuilt test APK. These are two explicit test-source versions, not a claim that every method ran from one APK build.

The dedicated package is `dev.mote.collector.m15fixture`, on a fresh, headless, read-only API37 emulator (`emulator-5584`, build `CE2A.260420.019`). All accounts, HTTP providers, files, recordings, capture bytes and model responses are generated fixtures. Each independent method gets a fresh backend and clean fixture-package data. Only the real process-death pair deliberately retains the same backend, package data and forwarding between phases.

| Check | Actual result |
| --- | --- |
| Fresh `assembleMultiuserFixture` and instrumentation APK | Exit 0; 17 seconds |
| Full debug JVM | 75 XML suites, **358/358**, zero failures/errors/skips |
| `lintMultiuserFixture` | Exit 0, **0 errors / 265 warnings** |
| Successor `check:affected --base a5f3bf46` | Exit 0; translation/release-tool checks and unchanged JVM inputs reused as up-to-date |
| Successor instrumentation compile and lint | Exit 0; seven tasks executed; corrected method actually ran |
| Accepted native matrix | **77 unique non-live methods + 3 variants**, zero failures/skips |
| Owned backend cleanup | 85 backend hosts exit naturally with 0; 85 host PIDs absent; 151 relevant ports have no listeners |

The 77 methods cover login/rotation/account retirement, offline queue and late ACK, generated capture, snapshot/source workers, anonymous binding, drafts/private archive/OCR/cursors, portable import/export and failed-download sentinels, Actions/Calendar, MCP, Models/processing policy, Agent/history/recording opt-out, Files stage/retry/unknown/delete recovery, recordings, Google/Gmail/Lark, plugin grants and configuration, and native overview/statistics.

The actual process-death check identifies owned PID `15263`, kills it with the fixture package's own UID, verifies both `/proc/15263` and package PID are absent, then runs phase two without clearing or reinstalling. B alone restores; explicitly returning to A resumes A's original bytes. Activity recreation or force-stop is not substituted for this check.

## Preserved unsuccessful attempts

The initial 57-method invocation completes with **54 pass / 3 fail**. Its original logs and hashes remain; none is called a production RED or hidden by a skip.

- Two overview methods were initially given the empty generic backend. Their first assertions require actual captures and admitted M12 operations, so they stop before UI verification. With the existing Actions producer, the unchanged methods pass in **2.141s** and **2.527s**.
- The old Memory-stop journey successfully proves the old dialog cannot change A or B's revision. Its B-positive step then waits on the installed-plugins tab because account replacement creates B's new `CentralAdmin`/`CentralPlugins`. The test-only successor explicitly selects B's existing Memory tab before the original positive Stop action. The same cross-account negative checks and B-positive revision check pass in **4.204s**. No product navigation or authorization behavior changes.

A sibling Web validation briefly edited the shared Files fixture before source ownership was clarified. Although all three potentially overlapping host receipts record the original fixture hash, their results are conservatively replaced by successful post-restoration repetitions (`P44`, `P45`, `P48`). The Web transport successor is developed separately. Accepted native evidence uses the original Files fixture, not a mixture of transport versions.

Across both phases there are **86 actual method invocations: 83 pass and those 3 preserved setup/orchestration failures**. The accepted matrix excludes the three initial failures and three potentially overlapping duplicate passes, leaving exactly 77 unique methods plus 3 explicit variants.

## Reproduction and boundaries

Build with JDK21 and the existing Android SDK, using `-Pmote.testBuildType=multiuserFixture`. Launch the dedicated emulator with `-no-window -no-audio -no-snapshot -read-only`. Start each recorded fixture script under `node --import tsx`; forward only its own loopback API/control ports through that emulator's ADB reverse; pass its generated private JSON path as the instrumentation `fixture` argument. Invoke the recorded method through `dev.mote.collector.MultiuserWorkerInstrumentedTest#METHOD` and require `OK (1 test)`. The receipt supplies the correct producer and flags for each method; a generic empty host cannot substitute for a populated Actions/Memory/Files producer.

Logs and local drivers are retained under `/tmp/mote-pr159-native/`, `/tmp/mote-pr159-native-current20/`, `/tmp/run-pr159-android-residual.py`, `/tmp/run-pr159-android-current20.py` and `/tmp/mote-pr159-android-*.log`. Generated credential JSON and temporary fixture data are not committed.

The explicit live-only Codex method is **not rerun**; its earlier C2 result remains historical. Physical/OEM Android, API29–36 runtime behavior, actual system grants/vendor background behavior, live calendar/mail/recording providers, public HTTPS, real external writes and model quality remain unperformed. This finite native completion does not claim whole-project, deployment or physical-device acceptance. PR143 appearance runs belong to their separate source and target branch.

Final cleanup: the owned emulator exits normally with 0; its PID and serial are absent, ADB reverse was empty, and only this run's temporary fixture/AVD resource directories are removed. Evidence logs remain. The shared ADB server and other user resources are retained.
