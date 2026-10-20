# Independent Round 4 cancellation pack

This independently authored release exercises the current scoped source and
processor worker boundary. Its frozen host candidate is
`b3d956189ba81e4843e9ceacdec06bb7f30a352e`. The submitted runtime imports only
Node built-ins and its own modules. It registers no host adapter and owns no
task queue, user identity, model routing, or publication authority.

The first submitted runtime ZIP is `plugin.zip`, with SHA256
`f4e054fa8211acc8a2eb2bf47baea1be1c52ac74b47646399bdb7bcd15605c0e`.
Its manifest declares `[cancel.processor, cancel.source]`; `plugin.mjs`
composes the separately implemented modules in `[cancel.source,
cancel.processor]` order. Both components have version `1`.

## Install and run

The checked-in ZIP and `mote-plugin.json` are an installable release pair.
The focused test substitutes only their fixed GitHub release transport. Normal
release resolution, ZIP digest verification, extraction, package catalog,
Accounts, HTTP authentication, task execution, worker subprocesses, Ingress,
ProcessingHost, and durable Material/Artifact storage run unchanged.

```sh
export PATH=/opt/codex/runtimes/codex-primary-runtime/dependencies/node/bin:$PATH
npm run build:libs
node --import tsx --test apps/server/test/extension-benchmark-cancel.test.ts
```

The default test uses temporary generated data and does not modify any release,
fixture, or report in the checkout. To preserve a run report, select its path
explicitly:

```sh
MOTE_CANCEL_REPORT_PATH=/tmp/cancel-run.json \
  node --import tsx --test apps/server/test/extension-benchmark-cancel.test.ts
```

`package-release.mjs` is a development packaging command. Running it explicitly
regenerates this directory's ZIP and manifest from the five runtime modules;
the test never invokes it.

The test launches the production `buildScopedApp` composition in a real child
process and uses a loopback HTTP listener. It terminates that process and opens
the same isolated data directory in a distinct process. It does not exercise
the shipped `index.ts` launcher. Its single allowed substitution is generated
release download transport; the generated text extraction requires no model.

## Public input contract

Create a source through `/api/ingress/sources`, then configure a normal plugin
instance with `{label: string}`, source and processor capability grants, and
the source ID. Use `check`, `enable`, and `snapshots` before `invoke`.

| Component/action | Payload | Durable effect or result |
| --- | --- | --- |
| `cancel.source` / `ingest` | `{action, sourceId, batchId, items}` | Passes standard SourceItem records through `receiveSourceItems`; returns `{pid, receipt}`. |
| `cancel.source` / `page` | `{action, sourceId}` | Calls `pageOriginals` with limit 2 until its cursor is null, reads every original, and returns documents plus exact page observations. |
| `cancel.source` / `publish` | `{action, sourceId, key}` | Reads every original, joins actual `item.text` values and the configured label, and publishes a Material with all capture members. |
| `cancel.source` / `delay-publish` | `{action, sourceId, key, delayMs}` | Writes a generated start observation, waits with the invocation's signal, and performs the same real publication. |
| `cancel.source` / `hold-cancel` | `{action, sourceId, key}` | Waits for cancellation, clears its timer and listener, and deliberately attempts both late publication and late progress emission. |
| `cancel.source` / `read-original` | `{action, originalRef}` | Calls the authorized `readOriginal` method. |
| `cancel.source` / `trigger-probe` | `{action, sourceId}` | Attempts `host.call('registerTrigger', ...)` to establish the missing public method. |
| `cancel.processor` | `{originalRef, key}` | Reads real original bytes, stages an exact Transcript through `stageExtraction`, and returns `{artifactId}`. |

Diagnostic `key` values match `/^[a-zA-Z0-9_-]{1,96}$/`. Source records are
normal generated SourceItems, including `externalId`, `revision`,
`observedAt`, `title`, `text`, `kind: 'message'`, and `layer: 'original'`.
The processor's exact generated output text is
`Extracted: ${item.text}\nSHA256: ${sha256OfOriginalBytes}`, in a zero-duration
Transcript with engine `cancel-pack.generated-text-v1`.

The source result includes the worker PID, Material ID, original descriptors,
decoded documents, and page counts/cursors. Original JSON arrives through the
worker RPC Buffer representation `{type: 'Buffer', data: [...]}`. Material
body and evidence readback use `/api/materials/:id/read` and
`/api/materials/:id/members`, respectively. Processor readback also uses
`/api/processing/artifacts/:id`.

## Cancellation observation contract

The plugin writes generated diagnostics in its own worker current directory:

- `cancel-pack.<key>.started.json`: PID, action, and prospective Material ID.
- `cancel-pack.<key>.cancelled.json`: observed signal, cleared timer, removed
  listener, zero owned pending waits, and both attempted callback outcomes.
- `cancel-pack.<key>.retired.json`: an interrupted delayed publication.
- `cancel-pack.<key>.processor.json`: actual original hash and staged Artifact.
- `cancel-pack.worker-<pid>.closed.json`: graceful runtime close observation.

Writes use an atomic rename. The test only locates and reads these diagnostics
under the isolated `plugins/instances` tree. It neither writes release gates
nor registers test callbacks on the host. Diagnostics cannot authorize work
or stand in for official publication readback.

The test first observes a running held task and a running sibling in the same
worker. It then calls `POST /api/tasks/:id/cancel` with `{}`. Both post-cancel
`host.call` attempts must fail, and the prospective Material must be absent.
The sibling and another user's concurrent task must publish readable
Materials. A further task must use the original worker PID. Instance stop and
host close are separately required to retire the relevant worker processes.

## Observed first delivery

The complete focused test passed on 2026-10-19 in 10.294 seconds of test time
(11.594 seconds including the test runner). The static `trial.json` preserves
timestamps, digest identities, concrete public failures, declared scope, and
the first-delivery record. The independent Evaluator's verdict is separate.

| Declared focused assertion | Iterator observation |
| --- | --- |
| Pre-install capability discovery | PASS; only source and processor reported registered for generic invoke. |
| Reordered modular composition, three originals across two pages, real source publication | PASS. |
| Real processor staging, Artifact, Material, original hash and evidence readback | PASS. |
| Selective task cancellation, owned wait cleanup, both late callbacks rejected | PASS. |
| Same-worker concurrent task publishes with unchanged PID; other user remains operational | PASS. |
| Foreign original, snapshot and task rejection, including administrator task selection | PASS. |
| Stop and close retire workers; distinct host restart preserves lawful history | PASS. |
| Native apply-only release | FAIL / NO_EXTENSION_POINT; installation succeeded, real check returned HTTP 502 `execution_unavailable`, and the instance remained unchecked. |
| Custom durable trigger | FAIL / NO_EXTENSION_POINT; manifest resolve and policy admission returned HTTP 400; actual source worker RPC became blocked. |

The native specimen remains an unchanged `apply(ctx)` module with a generated
read-only checksum tool. No native Harness session was reached. The trigger
probe neither creates a private scheduler nor treats a manifest enum as an
active domain adapter.

Full E01 and E08 business cases remain PARTIAL: this release proves generated
text source and processing boundaries, not the financial insight, image,
Memory, or UI requirements. Full E10 and E11 are also PARTIAL: package version
upgrade, crash recovery outcomes, model-resource isolation, and export
behavior were not run. E04 and E06 have the concrete extension-point failures
above. E02, E03, E05, E07, E09, and E12 are NOT RUN. Native builds, browser
interaction, physical devices, live model quality, and resource performance
are NOT RUN. Existing regression ownership belongs to the integration driver;
this Iterator ran the library build and its narrow new test.
