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
both findings. Final follow-up review/check evidence is recorded below.

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

## Final acceptance

Pending final required checks and review of race fixes. Actual Docker and native
Hindsight remain blocked above and cannot be counted as passed even if local
automated gates pass.
