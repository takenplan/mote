# Container backup and recovery follow-up

Scope: the remaining epoch-5 Docker profile publication and Hindsight native
restore seam. Baseline: M16 final `eec967c66304fef78f683e3445900287e75bac21`.
This branch does not consume Joint's later Files/Imports schema work, replace a
live instance, enable CI, deploy, or merge into main/integration.

## Decisions and retained behavior

The [lifecycle ADR ledger](../design/multiuser-lifecycle.md),
[configuration authority](../adr-unified-configuration.md), and
[recovery failure contract](../adr-task-recovery-and-execution-budgets.md)
remain authoritative.

| Disposition | Behavior |
| --- | --- |
| KEEP | Stopped, empty selected target; exclusive archive destination; checksums/schema/owner/original validation. Native identity preservation and execution retirement are retained. |
| CHANGE | Stage and verify a fresh uniquely labelled Docker volume before one atomic profile YAML replacement. YAML `storage.source` is authoritative; `profile.json` retains initial deployment metadata. Model-volume selection, including its historical default, survives. |
| KEEP | The selected profile configuration is retained except for storage pointer/revision. The result names `/data/instance.yaml` for explicit adoption of the backed-up configuration. Old volumes remain; no Central/provider starts. Explicit `start` uses Compose `up` to recreate the selected mount. |
| CHANGE | Docker backup reads the selected named volume through a local-image helper, rather than a stale stopped container. No automatic pull/build. |
| CHANGE | Hindsight admits exact files/checksums/descriptor/canonical-native coverage before target writes. Whole-instance verification binds native bodies to SQL owner/binding/version/body digest. Read-only tar preflight precedes volume creation. New runtime identity retains original instance/model fingerprints and unknown facts, with no endpoint credentials. |
| CHANGE | Re-query volume existence for every empty-target check; exclusively create Hindsight provider metadata. Both independently reviewed races have actual protocol RED→GREEN. |
| CHANGE | Copy ordinary Docker backup files through bounded read/write/fsync loops into an exclusive private bind stage. Actual Docker Desktop cpSync directory copying returned EACCES; no user/capability expansion is needed. |
| VERIFIED | Actual Docker publication/rebackup, native reopening and the original Mote production entry now run against generated data, including two clean stop/start cycles. Offline Hindsight Python/tar/PostgreSQL/API recovery is separately verified. |
| VERIFIED | Restored Hindsight also reopens through production ManagedHindsightRuntime/HindsightEngine, rejects a wrong model profile and old API token, rotates private endpoint credentials, reads both canonical bodies, shuts down cleanly and rebacks up with zero inference. |
| UNKNOWN | The later Joint catalog composition remains a separate gate; literal fixture SQL setup does not prove semantic retain or live inference. |

Docker cannot atomically rename a volume root. One private YAML replacement after
complete staging avoids partial publication and a two-file metadata transaction.
Failed copy, concurrent configuration changes and newly occupied targets retain
current selection/data. Cleanup checks labels and removes only this operation's
fresh volumes. A crash before YAML publication may leave an unselected labelled
volume for operator inspection; no automatic existing-volume sweep is added.

## Actual environment boundary

macOS arm64; Docker CLI `29.8.2`, API `1.56`, context `desktop-linux`, endpoint
`unix://<redacted-personal-path>`.

Initial sandbox access reported socket `permission denied`. Standard-reviewed
read-only `docker version`, `info`, `image ls`, `ps -a`, and `volume ls` then
reported `Cannot connect to the Docker daemon ... Is the docker daemon running?`,
exit 1. No existing image/container/volume inventory was obtained.

Read-only checks found `/Applications/Docker.app`, bundle `com.docker.docker`,
signed TeamIdentifier `9BNSXJN65R`. No Docker process was observed; `docker desktop
status` could not retrieve status. After the parent's additional startup
authorization, standard-reviewed `docker desktop start --detach` exited 0 with
`Docker Desktop is already running`. The subsequent same-context daemon/inventory
probe still exited 1 with the same connection error. This contradictory
application/engine state was unresolved at that time.

Authorized read-only UI lookup `cua.getApp("Docker")` timed out with
`-10005: timeoutReached`; no window/startup prompt was observed. No permission or
agreement was clicked, context/socket/security setting changed, dependency/image
downloaded, or existing container/volume operated on. The parent asked the user
to inspect Docker Desktop's startup/error state.

A later fresh standard-reviewed `docker version` succeeded: Desktop 4.94.0
(241994), Engine 29.8.2, linux/arm64; evidence
`/tmp/mote-container-final-docker-probe.log/.exit` is **0**. Earlier failures
remain recorded. Read-only metadata inventory found the pinned Hindsight image
and six stopped Hindsight containers/volumes; none was started, stopped, mounted,
modified or removed. No Mote image existed. New tests use unique labels/names,
generated accounts/content and owned-only cleanup. Helpers and isolated API
phases use `--pull never` and network none; the managed-runtime phase separately
uses the product's loopback-published transport and prohibits model inference.

The installed pinned Hindsight image contains Node 24.21.0, Python 3.11.16,
PostgreSQL and baked BAAI/bge-small-en-v1.5 plus cross-encoder MiniLM caches.
It can supply the actual volume helpers and offline native API without downloads.
The separately claimed original Dockerfile build completed **exit 0**, 35/35
steps, from 18:30:49 to 19:00:17 UTC (29m27.558s). Build-stage npm took 617s;
runtime npm installed 954 packages in 1285.8s. The silent interval was diagnosed
through log age, CPU/memory and aggregate network counters, not called healthy
merely from Running status. See `/tmp/mote-container-build-diagnosis.md`.
No process was killed, setting changed or dependency source substituted.

The unique image `mote-container-validation:142` has immutable ID
`sha256:2e0a192ec624a902d9396a1b0308782a0018a6c02e3af70e279e3f526563d48b`,
3390189543 bytes, own `dev.mote.fixture=container142-production` label, and default
`node apps/server/dist/index.js`. Its official Node 24 base digest is
`sha256:a5f4366e834695d5f363b920c104953a535d3a9864d1bdf74566a0ebe01daee5`.
The source checkout was 53b with the host profile-copy candidate at build start;
subsequent differences are profile-lib (not copied into this image), opt-in
validation entries (not copied), and docs. All emitted application/package/runtime inputs remain unchanged; the later
SDK regression changes only a test fixture copied into the build stage, outside
the server compiler's source inputs and runtime image.
This build installs the repository's pinned/locked npm, PyPI and Debian runtime
dependencies; no host package or model weight is installed by these tests.
The original production entry was subsequently verified after the agreed slots
released; the exact command/image/source result is recorded below.

## Executed regressions

All accounts/content are generated. SQLite, YAML, filesystem staging, authority
retirement and native reopening use production entries. The new protocol tests
substitute only Docker command transport; the Node byte-copy verifier runs on
real path substitutes. Native Python extraction/PostgreSQL does not run there.

| Evidence files under `/tmp` (`.log` and corresponding `.exit`) | Actual outcome |
| --- | --- |
| `mote-container-epoch5-red` | Baseline eec: exit 1, two refusal failures, corruption negative passes. |
| `mote-container-epoch5-green2` | 3/3, exit 0; green1 had a macOS temp-path alias rejection, fixed by canonical staging parent. |
| `mote-hindsight-admission-red` | Exit 1 against original standalone helper; explicit failing dummy Docker prevents daemon contact during old-code reproduction. |
| `mote-container-volume-race-red` | ca22: 0/1, exit 1, absent→present target not rejected. |
| `mote-container-hindsight-exclusive-red` | ca22: 0/1, exit 1, simultaneous restores incorrectly return two successes. |
| `mote-container-races-green` | 39009c78: 15/15, exit 0, including both review findings, occupied/running/late-written volumes, YAML race, copy failure, corruption, selected-volume rebackup, native reopening/old-login rejection, native-body/descriptor mismatch and fresh Hindsight identity/unknown metadata. |

Actual Docker evidence added after the daemon became reachable:

| Evidence under `/tmp` | Actual outcome |
| --- | --- |
| `mote-container-actual-volume-53b.log/.exit` | Exit 1: actual Docker Desktop directory cpSync fails EACCES on nested originals. Diagnostic root/cap attempt also fails (`actual-volume-green1`) and was fully reverted. |
| `mote-container-actual-volume-green3.log/.exit` | Exit 0: ordinary-user streamed copy closes the same actual volume case. This temporary driver predates the durable fixture and is not attributed to an unchanged 53b commit. |
| `mote-container-actual-volume-durable.log/.exit` | e5ceb27e: exit 0, actual Docker volume publication/rebackup, two generated originals each 2 MiB + 71 bytes, A/B same source/device IDs, deployment/account identity, old token rejection, a real issued task grant retired, unknown external issuance unchanged, native reopening. No production container startup in this run. |
| `mote-container-actual-volume-preservation.log/.exit` | 155b9008: exit 0, separate occupied sentinel volume and its selected YAML unchanged after rejection and later successful restore; damaged archive fails before any Docker call. |
| `mote-container-actual-volume-sameid.log/.exit` | c92d4b9f108245201c368451a27f60fa39dd99af: exit 0, repeats preservation with the same literal capture UUID for both owners, distinct owner text and one row per owner after native reopening. Earlier runs used different capture UUIDs. |
| `mote-container-production-actual.log/.exit` | 13515436f4306d26913753ad52897c90c01e1340: exit 0 with the immutable Mote image above. Reloads authoritative YAML from disk, then real default production CMD, two start/clean-stop cycles, fresh A/B logins/identity/same capture ID and distinct text, old tokens 401, original-byte rebackup, unknown external issuance unchanged and zero old task grants. |
| `mote-container-hindsight-actual-red.log/.exit` | Exit 1: fixture used the macOS temporary-directory alias; no product permission workaround. Canonicalizing the fixture parent fixes admission. |
| `mote-container-hindsight-actual-red2.log/.exit` | e5ceb27e: exit 0, actual offline API start/clean stop/native snapshot/new identity restore/API restart/rebackup, initially empty canonical collection. |
| `mote-container-hindsight-nonempty.log/.exit` | d65321b5: exit 0, two owner namespaces with same memory ID, real native canonical digest/body snapshot and restored HTTP reads; checksummed unsafe tar rejected by real pinned Python before volume creation. |
| `mote-container-hindsight-final.log/.exit` | 06fd62eb66254e3c4c7038c9018953f5ec4f657e: exit 0, repeats the nonempty native chain with source private credentials, restored old API token 401, API version 0.10.2, worker false, retained unknown operation, fresh runtime identity and original model/instance fingerprints. |

The added managed phase first failed at13515436: the generated literal SQL
records had not passed the same schema normalization/order used by production
`put` before hashing. The unchanged production adapter correctly rejected their
digest. `/tmp/mote-container-hindsight-managed-actual.log/.exit` remains **1**.
The fixture alone now uses `memoryProviderRecordSchema.parse` before hashing.

`/tmp/mote-container-hindsight-managed-green.log/.exit` is **0** at
`258f787d9bb4d2ae0d7f106a65fe33eecc445aa3`. It repeats the native chain, then
uses the production `ManagedHindsightRuntime.service` and `HindsightEngine.read`
against the fresh restored identity/volume. The wrong model profile is refused
before startup; the approved profile creates new private credentials, old API
tokens receive 401, both owner bodies read correctly, model calls remain zero,
and managed shutdown/rebackup succeeds. It uses the owned stopped-container
branch, so no image pull occurs. This managed phase uses the normal
loopback-published runtime transport, not the direct phase's network-none shell.
All model requests are denied by the host authority callback; the profile is a
generated local placeholder. No real provider credential or inference is used.

The real production command (repository root) was:

```sh
MOTE_CONTAINER_VALIDATE_STARTUP=1 \
MOTE_CONTAINER_VALIDATION_IMAGE=sha256:2e0a192ec624a902d9396a1b0308782a0018a6c02e3af70e279e3f526563d48b \
node --import tsx scripts/validation/container-recovery.ts
```

The container publishes no host port, uses network none and the verified private
profile user. Health/auth/private data requests execute inside its own network
namespace. Only the generated test volumes/containers are cleaned up; the unique
validation image remains available for the later joint composition.

The durable opt-in entries are
[`container-recovery.ts`](../../scripts/validation/container-recovery.ts) and
[`hindsight-recovery.ts`](../../scripts/validation/hindsight-recovery.ts).
The Hindsight fixture creates banks through the real API and inserts generated
literal canonical rows into its actual migrated PostgreSQL schema. This setup
bypasses semantic retain and workers. Backup, tar validation/extraction, clone
PostgreSQL canonical verification, restored native API health/version/body reads,
clean shutdown and rebackup are real operations. The API runs with network none,
HF/Transformers offline, baked models and automatic worker false. This direct-API phase does not claim live-model or semantic-extraction behavior.
The separately described managed-runtime phase verifies history reopening and
credential/model identity seams without semantic work.

The first durable volume fixture at a5da exited 1 because it treated `waiting`
as a finished execution state; the same fixture now waits for actual issued
external work before backup. Its failure is retained separately from the real
cpSync production failure. All generated resources were cleaned after each run.

Independent source-only review: `/tmp/mote-joint-review-container-ca22.md`.
The reviewer did not execute tests/Docker. This owner then reproduced and fixed
both findings. Exact `39009c78` race-fix and `d1810cd0` historical model-volume
default follow-ups are recorded there with no new confirmed finding in those
bounded deltas. This review did not execute the actual Docker acceptance. A separate bounded
source review of the streamed-copy delta is
`/tmp/mote-joint-review-container-streamed-copy.md`, with no new confirmed finding. The actual fixture source-only review is
`/tmp/mote-joint-review-container-actual-fixtures.md`; actual execution evidence
belongs to this owner, not the reviewer.

## Failed attempts and dependency correction

`mote-container-native-adjacent.log/.exit` failed with restricted localhost
`listen EPERM`. Standard-reviewed rerun `mote-container-native-adjacent-authorized`
reached 51/52. Existing root better-sqlite3 uses ABI 147, whereas initially selected
Node 24.21.0 uses ABI 137. Installed Node 26.11.1/ABI 147 loads that binary.
`mote-container-native-adjacent-node26` still reached 51/52 because separate
`apps/server/node_modules/mem0ai` had not yet been copied into this checkout.

Existing root and nested host dependencies were independently copied; peer files
were not changed and no host package was installed/downloaded. The separate
Dockerfile image dependency installation is recorded above. The same failed Mem0 case then
passed 1/1, exit 0: `/tmp/mote-container-mem0-deps-restored.log/.exit`. Earlier
failed runs remain failures. Final checks use installed Node 26 and JDK 21.

## Local gates and joint boundary

### Final current gate

Frozen tested candidate: `ab7069aa2a1c59eda1a0775ae8d52c0632a70c89`.
Base main/integration refs were independently refreshed at
`6272a9b51ec92cc4c32e2ff1a1eeb4fa38b142ed`.

`npm run check:affected -- --base origin/codex/mote-multiuser-integration`
actually ended **exit 0**. Evidence:
`/tmp/mote-container-required-final3.log/.exit/.sha` and
`/tmp/mote-container-required-final3-evidence.json`. Total 972.579 seconds;
Server 794438.224 ms.

| Component | Final actual result |
| --- | --- |
| Libraries/types | All exit 0, including the opt-in script types. |
| Desktop | 492/492, 59 files. |
| Server | 2641 pass, 0 fail, one existing default macOS-sandbox opt-in skip. Includes all 15 container/Hindsight protocol regressions and the repaired SDK UTF-16 case. |
| Web | 505/505. |
| Agent | 317 pass, one existing installed-Codex opt-in skip. |
| Shared / Diagnostics | 192/192 and 5/5. |
| Root / client / Central runner | 81/81, 5/5 and exit 0. |
| Android | 352/352, 74 new XML files, 0 failure/error/skip; actual unit-test task executed. Gradle 32 seconds, 1 executed and 24 up-to-date tasks. |

Only this checkout's generated Android unit-report directories were cleared
before the run, forcing the unit task to execute. All XML modification times
are after this run's SHA checkpoint. Compiled inputs were reused; this is not
claimed as fresh Kotlin/Java compilation or native UI validation. Main and
integration were not modified. After this actual terminal result, all heavy
resources were explicitly released; final publication changes only this ledger.

### Historical gate

Fixed historical tested candidate: `d1810cd095e8c0075eb1caecdf45395825ec6bbd`.

```sh
export PATH=/opt/homebrew/opt/openjdk@21/bin:/opt/homebrew/bin:$PATH
export JAVA_HOME=/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home
export ANDROID_HOME=<redacted-personal-path>
export ANDROID_SDK_ROOT=<redacted-personal-path>
npm run check:affected -- --base origin/codex/mote-multiuser-integration
```

Actual **exit 0**: `/tmp/mote-container-required-d181-resumed.log/.exit`.
Desktop 492/492; Server 2641 pass, 0 fail, one existing default macOS-sandbox
opt-in skip; Web 505/505; Agent 317 pass and one existing installed-Codex opt-in
skip; Diagnostics 5/5; Shared 192/192; root 81/81; client 5/5; Central runner 0;
all types and library builds 0. Server duration: 857778 ms.

Android: **352/352**, 74 XML files, 0 failure/error/skip. Gradle 51 seconds,
25/25 tasks executed; Kotlin/Java and unit-test compilation plus
`:app:testDebugUnitTest` actually ran, rather than an up-to-date/cache-only gate.
The own protocol cases are included in the Server result. Source-host native
backup/reopening is freshly checked; M16's prior compiled/package evidence is
not relabelled as a fresh compiled or Docker run here.

The initial same-SHA required invocation exited 1 before a test plan because the
new local clone lacked `origin/codex/mote-multiuser-integration`:
`/tmp/mote-container-required-d181.log/.exit`. A read-only remote fetch supplied
the missing reference and independently verified both main/integration remained
`6272a9b51ec92cc4c32e2ff1a1eeb4fa38b142ed`. Only then was the unchanged candidate
run to exit 0 above. The original failed invocation remains recorded.

All heavy work was explicitly released after that exit 0. That historical gate
was valid for d181/53b. The later actual Docker failure led to the streamed-copy
fix and durable opt-in entries required a fresh final gate. The exit-0 final3
above covers the later source; this earlier result is not relabelled.

The first final invocation on `271779bdc21b5205530947153ade28919eea5721`
ended **exit 2** during script type checking, before the suites:
`/tmp/mote-container-required-final.log/.exit` (exact SHA in `.sha`). The new
opt-in entries used TypeScript import suffixes under NodeNext, lacked the profile
module declaration, and lost task-handler contextual types. The repair uses the
repository's `.js` import convention, declares the consumed profile APIs, checks
the handler against its host contract and asserts the Docker result volume.
No production recovery logic changed. Narrow script type checking and actual
tsx resolution of all six imported runtime modules both exit 0:
`/tmp/mote-container-validation-types.log/.exit` and
`/tmp/mote-container-validation-imports.log/.exit`. The failed full invocation is
retained; those narrow checks did not replace the subsequent full attempts.

The second final invocation on `b722de7453aa85f39e0468392754fc3428df6d5a`
ended **exit 1**, preserved in `/tmp/mote-container-required-final2.log/.exit/.sha`.
Types and Desktop492/Web505/Agent317 (+ one installed-Codex opt-in skip)/Shared192
passed, but Server2640 passed and one failed (+ one default macOS-sandbox opt-in
skip). Root/client/Android were not reached. The failure was an existing SDK
UTF-16 fixture reading a note's raw locator after its real automatic Material
had already replaced it; the actual tool correctly returned `not_found`.
A standalone run passing does not erase this full-gate failure.

A deterministic barrier waiting for the real note Material reproduces the same
failure at `1f1897dbde03c7af2d13cd82a3528be987e63025`, exit 1. The fixture-only
repair at `0efc09edfe8e3d2a2d91ab69b70f9d320b2b3399` keeps that settled-note raw
rejection, then uses the genuine unprocessed M03 source-item HTTP path for its
raw UTF-16 read before explicit formal Material publication. Exact character,
offset/total/nextOffset, spans and retired-raw rejection assertions remain.
Same-case exit 0: `/tmp/mote-container-mcp-unicode-race-green.log/.exit/.sha`;
the corresponding `-red` files retain the deterministic failure. Production
reader/privacy and container recovery code are unchanged. The fresh full retry
at ab706 above now passes; this second failed invocation remains recorded as a
failure. Independent exact fixture-delta review is in
`/tmp/mote-joint-review-container-mcp-0efc.md`, with no new confirmed finding and
no reviewer execution.

Actual volume publication and native Hindsight recovery now have the evidence
above, including actual Mote production startup/restart and managed Hindsight
canonical reads. Final3 closes the local required gate; the old d181 result
remains historical. Joint's newer catalog/Imports composition is a separate
later joint gate. No existing user
service/data/volume was operated on, and no merge, deployment or CI enablement
was performed.
