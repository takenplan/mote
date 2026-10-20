# Generated ingress prefix: Linux replay and host-bind 503

This records the 2026-10-20 investigation of the first archive-ingress batch
returning `503 {"error":"scope_unavailable"}` before any plugin instance or
model invocation. The production ownership and symlink checks remain unchanged.

## Journey and environment

The replay creates a fresh vault, runs the compiled administrator initialization
CLI and Server entry point, logs in the administrator, creates and logs in a
second account, installs the generated finance plugin package, registers three
archive sources, and uploads 43 generated source items in batches of at most six.
It paginates originals and downloads each original with its authenticated ticket
to compare its identity, supplied fields, byte length, and SHA-256. It then stops
the host, copies the SQLite database and sidecars, and checks the copy read-only.
It does not configure a plugin instance or invoke a model.

Preserved environment conditions:

- Debian 12, Linux arm64, Node `24.19.0`, built-in SQLite `3.53.3`.
- Local image `sha256:d47cf0e648f7540a52223637b034ac959c060e7e3b6e915c37ff2c2fc68bf667`
  and its installed dependencies; no dependency installation in the replay.
- Shared, Agent, Diagnostics, and Server `dist` built on macOS and mounted into
  Linux. Source commit identity and compiled artifact identity are recorded
  separately. Agent's non-dist `skills` resources are also required.
- Offline container, no published ports, 3 CPUs, 5 GiB memory, 256 PIDs, and a
  150-second container lifetime. Individual HTTP requests have a 10-second limit;
  the driver has a 120-second journey deadline.
- Wire protocol `2`, ingress protocol `3`, and the original synthetic input SHA-256
  `42bb17ff1567cec5847084960d97d64d273f67d1674386ca421aa48d1261eb7d`.

## Confirmed findings and limits

The unmodified retained baseline and PR183 builds reproduced the original first
batch 503 on fresh macOS Docker host-bind directories. A separately labeled
diagnostic preload captured `Originals.put -> cleanStage -> existingArea ->
privateDirectory`. At failure, the process UID and effective UID were `1000`,
while the affected vault or originals directory was reported as UID/GID `0`.
The path was a directory, not a symbolic link. A synchronous system `stat` in the
same container under the same UID confirmed UID/GID `0`; a later inspection
reported `1000`.

The immediate failure was the owned-directory guard rejecting that filesystem
identity. It was converted to the existing generic HTTP 503 response. The
underlying Docker filesystem ownership-presentation mechanism remains **UNKNOWN**.
These observations do not justify accepting another UID or weakening the guard.

Keeping the image, Linux runtime, image dependencies, Mac-built dist, input and
HTTP sequence fixed, and changing only the run directory to a container-local
Linux-owned directory accepted and paginated all 43 items. Returning the baseline
to a fresh host-bind directory reproduced the 503 again. Both original versions
and the combined candidate passed with Linux-owned storage. A host-bind run on
another machine may pass; the replay reports its actual result and never forces
the historical failure.

The original 503 databases and new replay copies passed integrity checks. This
does not identify or fix the separately reported historical SQLite corruption.
That corruption's cause remains **UNKNOWN**. These prefix checks do not establish
full plugin acceptance, physical-device behavior, or live-model behavior.

## Replay

Use an existing Mac-built checkout, the extracted Linux arm64 Node distribution,
and a new output directory outside Git worktrees. The harness never builds,
pulls an image, or installs dependencies. The plugin source must contain the
existing generated finance release fixture; it may be a different checkout when
replaying a baseline that predates that fixture.

```sh
# Build on macOS before freezing the candidate; do not rebuild during a run.
npm run build:libs
npm run build -w @mote/server

node scripts/validation/ingress-prefix-repro.mjs \
  --source "$MAC_BUILT_CHECKOUT" \
  --plugin-source "$FINANCE_FIXTURE_CHECKOUT" \
  --runtime-dir "$NODE_24_19_LINUX_ARM64" \
  --output "$NEW_EVIDENCE_DIRECTORY" \
  --label generated-prefix
```

The default vault is container-local. Add `--storage host-bind` and use a different
new output directory to observe the host filesystem path. All Docker commands use
argument arrays, local-image inspection, `--pull=never`, and `--network none`.
The host creates and removes only its uniquely named, ownership-labeled container.
It binds each of the four dist directories and package manifests, Agent skills,
and the finance fixture individually read-only. It preserves the image's root
and nested `node_modules`; no Mac-installed dependencies are mounted. Actual
mounts are checked against that list. Only anonymous volumes declared by the
image are additionally accepted, with no overlap of runtime or dependency paths.
Owned anonymous volumes are removed with the container and checked for absence.

The [host CLI](../scripts/validation/ingress-prefix-repro.mjs) records Git HEAD and
dirty state, exact image ID, launch arguments, Linux runtime binary hash, and
per-file hashes of all four dist directories, required package manifests and Agent
skills. The [driver](../scripts/validation/fixtures/ingress-prefix-driver.mjs)
records resolved runtime modules, HTTP status metadata, source counts, per-original
verification, shutdown status, SQLite copy hashes/checks, zero plugin instances
and snapshots, and zero unexpected outbound requests. Before startup and after
shutdown, the host also records and compares both actual ESM import and require
entry paths/hashes, including `mem0ai/oss`, plus image dependency directory lists.
The
[release fixture](../scripts/validation/fixtures/ingress-prefix-release.mjs)
allows only generated release responses. The
[input](../scripts/validation/fixtures/ingress-prefix-input.json) contains only
generated evidence.

Outputs include a database with generated test-account credentials and remain
local outside source control. Request authorization and content-ticket values are
excluded from HTTP metadata. Copy, inspection, or cleanup failures remain separate
from the first HTTP failure. A successful run requires `hostExit.code: 0`, 43
verified originals, clean database checks, and successful evidence copy/removal.

## Executed evidence

Source identities were baseline `2c78ca8d52a7d17fae20962cf68d09a717ffc73a`,
original PR183 `74da386f33adde6521d5dd3435bf9643da89f495`, and combined candidate
`2b88e3d6e1775bbca2d857b4ab721ad441768935`. The combined Mac build was performed
before the replay. No Linux rebuild replaced it.

| Input | Storage | Observed result |
| --- | --- | --- |
| Retained baseline | Fresh host-bind | First batch 503; setup HTTP 200 |
| Same baseline | Linux-owned | 43 accepted; 20/8/15 originals paginated; integrity OK |
| Same baseline | Fresh host-bind again | First batch 503 again |
| Retained original PR183 | Fresh host-bind | First batch 503; setup HTTP 200 |
| Same PR183 | Linux-owned | 43 accepted; 20/8/15 originals paginated; integrity OK |
| Combined candidate | Linux-owned | 43 accepted; 20/8/15 originals paginated; integrity OK |
| First durable CLI run | Linux-owned, mixed dependencies | 43 originals verified; database OK; partial lifecycle receipt |
| Second durable CLI run | Linux-owned, mixed dependencies | 43 originals verified; database and host exit OK; environment not accepted |
| Strict mount preflight | No application launched | Harness rejected image-declared `/data` volume; corrected before final replay |
| Final durable CLI | Linux-owned, image dependencies verified | 43 originals verified; database, host exit, artifact copy and cleanup passed |

The first attempt at minimal source staging omitted Agent skills and failed
initialization with `ENOENT`. That failure is retained separately and does not
count as an ingress result. The first durable CLI run stopped the host with raw
exit code `0`, but a child-object identity bug omitted the explicit shutdown
assertion and `hostExit` field from its result. That receipt remains partial;
the driver was corrected before the final replay.

The first two durable CLI runs mounted whole Mac workspace directories and
therefore exposed local `apps/server/node_modules`. They retain their observed
journey results but do not satisfy the image-dependency condition. The earlier
two-container diagnostic used reduced runtime resources and established the
guard/storage contrast, but did not inventory every nested dependency. The final
CLI uses individual runtime-resource mounts and verifies image dependencies;
earlier receipts are not relabeled with that stronger conclusion.

The first strict mount check then failed before application launch because the
image declares an anonymous `/data` volume in addition to explicit bind mounts.
That harness failure and unavailable run-copy result are retained. The predicate
was checked offline against the saved mount inventory: the declared volume is
accepted, while extra binds, undeclared volumes, and dependency-covering volumes
are rejected. Five earlier owned anonymous volumes were traced to exact owned
container IDs using Docker events and removed; no unrelated volume was removed.

The final CLI exited `0` in 9.386 seconds. All 43 originals were downloaded and
verified, the host exited with `{code: 0, signal: null}`, and SQLite contained two
accounts, 43 captures, 43 originals, zero instances, and zero snapshots. Read-only
quick/integrity checks passed and the inspected copy's hash did not change.
The container, its anonymous volume, and all other containers created by this
investigation were removed. No live network/model request occurred.

Final local result SHA-256:
`1b0930b41502317141f808ef354bee667f68fe9efa31a61263e679e377543912`.
The dependency inventories before startup and after shutdown are byte-identical,
SHA-256 `a81295770b72f0d7f395479147bd4aa989a512d684d5ff0cabd11ad8466903b1`.
The actual mounts inventory SHA-256 is
`5ac4c7df7e325439aa0952ffd30edff74089b7cd0739eb5190fc09cb6987c711`.
The production ESM `mem0ai/oss` entry resolved to the image's
`/app/apps/server/node_modules/mem0ai/dist/oss/index.mjs`, SHA-256
`0344af33887153828c572e7e74c59081976b6f769e516fbb66ef3ebdd8a8bbd7`;
its require entry was recorded separately as `index.js`.

The original scripts had changed after the historical runs. Their later commands
are not claimed to be byte-for-byte replays of those original commands. New
executions use frozen copies and their own script and artifact manifests. The
historical inventory contains 3,054 files and has SHA-256
`f2ffa3f97543bed671e51f7c3eae9e71bf7a302b5a7cded79fc2d94c2792363c`.
The complete combined staging manifest has SHA-256
`818e92fb0669344201163b117f134bd8d53ba55976d4f1ba1f1b2548c1021810`.

Combined dist tree hashes below hash the sorted lines `relative-path SHA256\n`
for every file inside each directory. Raw per-file manifests accompany the local
evidence; a clean source checkout alone does not prove these artifact hashes.

| Mac-built directory | SHA-256 |
| --- | --- |
| `packages/shared/dist` | `341089c93ea3f27af64122595358f369524e065c8ee73040e40ed7e5a5c660e7` |
| `packages/agent/dist` | `8b77ec65ef404829210c112bf156206609657bc23b989f2ff9e682a36f567b00` |
| `packages/diagnostics/dist` | `ea2f9fa133b5909a2e4cfb93398d66e44a9f07f8d58388afd8eb9089091d6630` |
| `apps/server/dist` | `7dc9d48dccd0ffadd97d5c6d425b7834b31f6581d2d524a74e6cca7fee8bce21` |

Only synthetic fixture checks were run. No real personal capture, physical-device
test, or live-model request was used. The root integration check driver reports
the final affected-component check separately.
