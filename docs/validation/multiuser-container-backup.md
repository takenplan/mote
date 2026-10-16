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
| UNKNOWN | Actual Docker copy/publication, production startup/restart, pinned Python/tar/PostgreSQL recovery, and Hindsight native startup remain unverified. Transport substitution cannot close these retained-capability gaps. |

Docker cannot atomically rename a volume root. One private YAML replacement after
complete staging avoids partial publication and a two-file metadata transaction.
Failed copy, concurrent configuration changes and newly occupied targets retain
current selection/data. Cleanup checks labels and removes only this operation's
fresh volumes. A crash before YAML publication may leave an unselected labelled
volume for operator inspection; no automatic existing-volume sweep is added.

## Actual environment boundary

macOS arm64; Docker CLI `29.8.2`, API `1.56`, context `desktop-linux`, endpoint
`unix:///Users/utopiafar/.docker/run/docker.sock`.

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
application/engine state is unresolved.

Authorized read-only UI lookup `cua.getApp("Docker")` timed out with
`-10005: timeoutReached`; no window/startup prompt was observed. No permission or
agreement was clicked, context/socket/security setting changed, dependency/image
downloaded, or existing container/volume operated on. The parent asked the user
to inspect Docker Desktop's startup/error state.

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

Independent source-only review: `/tmp/mote-joint-review-container-ca22.md`.
The reviewer did not execute tests/Docker. This owner then reproduced and fixed
both findings. Exact `39009c78` race-fix and `d1810cd0` historical model-volume
default follow-ups are recorded there with no new confirmed finding in those
bounded deltas. This is not an actual Docker acceptance review.

## Failed attempts and dependency correction

`mote-container-native-adjacent.log/.exit` failed with restricted localhost
`listen EPERM`. Standard-reviewed rerun `mote-container-native-adjacent-authorized`
reached 51/52. Existing root better-sqlite3 uses ABI 147, whereas initially selected
Node 24.21.0 uses ABI 137. Installed Node 26.11.1/ABI 147 loads that binary.
`mote-container-native-adjacent-node26` still reached 51/52 because separate
`apps/server/node_modules/mem0ai` had not yet been copied into this checkout.

Existing root and nested dependencies were independently copied; peer files were
not changed, and nothing was installed/downloaded. The same failed Mem0 case then
passed 1/1, exit 0: `/tmp/mote-container-mem0-deps-restored.log/.exit`. Earlier
failed runs remain failures. Final checks use installed Node 26 and JDK 21.

## Final local gate and remaining acceptance

Fixed tested candidate: `d1810cd095e8c0075eb1caecdf45395825ec6bbd`.

```sh
export PATH=/opt/homebrew/opt/openjdk@21/bin:/opt/homebrew/bin:$PATH
export JAVA_HOME=/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home
export ANDROID_HOME=/Users/utopiafar/Library/Android/sdk
export ANDROID_SDK_ROOT=/Users/utopiafar/Library/Android/sdk
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

All heavy work was explicitly released after that exit 0. Final changes after
`d1810cd0` are documentation only, checked for formatting/links and with
`git diff --check`; apps/packages/scripts/protocol have zero difference.

Actual Docker and native Hindsight remain blocked above. No existing
container/volume was inspected successfully or operated on, and no real Docker
profile publication, container production startup/restart, native tar/Python/
PostgreSQL extraction or Hindsight service recovery is counted as passed.
The source fixes and local gates are reviewable; overall container acceptance
remains OPEN pending a working existing daemon and a separately coordinated
generated-data run. Joint's new catalog/Imports composition is a later gate.
