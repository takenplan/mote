# Reading pack — fresh docs-only extension trial

This is an independent external source and processor bundle for generated reading
notes. It uses `createMotePlugin` in an immutable release ZIP and the production
`buildScopedApp` entry. The worker contains no imports from the host. Its processor
changes CRLF and CR separators into LF and publishes a real Transcript through
`stageExtraction`. The generated reading summaries are supplied text; the plugin
does not infer a summary, classify the content, or call a model.

## Public invocation contract

The package declares two components, both at component version `1`:

| Component | Surface / capability | Payload | Successful task result |
| --- | --- | --- | --- |
| `reading.source.enumerate` | `ingress` / `source` | `{ "sourceId": "reading-originals" }` | `{ items, pages, label, workerPid }` |
| `reading.processor.normalize` | `processing` / `processor` | `{ "originalRef": "original:<64 hex characters>" }` | `{ "artifactId": "<64 hex characters>" }` |

The source walks every cursor at a page size of two, so the generated three-item
corpus proves that a single page is not mistaken for the whole source. Every page
and original read passes through the host's fixed source grants. The processor
accepts archived SourceItem JSON with a string `text` field, not a raw text file.
Its generated fixture scope is at most 8,000 UTF-16 code units after normalization,
which fits one Transcript segment and preserves the exact body in the Material
reader. Larger inputs fail explicitly. Empty text is represented by zero segments;
empty-input publication is not part of this trial's validation.

The instance needs `configuration: {label: "<collection label>"}` and explicit
`grants: {capabilities: ["source", "processor"], sourceIds: ["reading-originals"],
history: false}`. User-facing history in this trial is the product's persisted
Material revision reader. The pack does not expose a repository/history adapter.

An archived generated note enters through
`POST /api/ingress/sources/reading-originals/items`:

```json
{
  "batchId": "generated-reading-batch",
  "items": [{
    "externalId": "note-0",
    "revision": "generated-v1",
    "observedAt": "2026-10-19T12:00:00Z",
    "title": "Generated reading summary",
    "text": "Reading summary: Generated Atlas\r\nFirst finding.\rSecond finding.\n",
    "kind": "message",
    "layer": "original"
  }]
}
```

The source is registered with `kind: "custom"`, `retention: "archive"`,
`platform: "import"`, and a generated device ID. The fixture disables automatic
processing through the user's configuration HTTP API before ingestion, then
explicitly invokes this processor. The Transcript contains `durationMs: 0`,
`coverage: "full"`, `engine: "reading-pack-normalize-v1"`, and one untimed segment
with the normalized text. The result is retrieved through
`GET /api/processing/artifacts/:artifactId`, `GET /api/materials`, and the existing
Material `/read`, `/members`, and `?revision=` API paths.

## Fixed release and test

`reading-pack.zip` contains the actual `plugin.mjs` entry. `mote-plugin.json` pins
its SHA-256. `release-fixture.mjs` serves only the generated GitHub release,
manifest, commit metadata, and ZIP; no download reaches the public network.
Production resolve and install both consume and verify the same ZIP bytes.
The fixture creates real Accounts, authenticates client tokens, and sends real
loopback HTTP requests. Its only host import is `buildScopedApp` in the test.
Administrator bootstrap calls the returned Accounts initializer before login.

From the repository root, with the supplied Node directory on `PATH` and built
workspace libraries available:

```sh
node plugins/extension-benchmark/reading-pack/build-release.mjs
node --import tsx --test apps/server/test/extension-benchmark-reading.test.ts
```

The retained ZIP and manifest are already built. Regeneration is needed only after
editing the entry. The exact trial runner was
`/opt/codex/runtimes/codex-primary-runtime/dependencies/node/bin/node`.
The local sandbox needs its approved escalation for the genuine child processes
and loopback sockets. There is no custom adapter registration or alternate host
composition in the fixture. Workspace libraries were already present; no broad
build/check suite was run.

## Observed result and boundaries

The final focused run passed: one complete journey, zero failures, 6.412 seconds
including runner startup. It verified actual source pagination, three exact
normalized Transcript/Material bodies, original evidence membership, repeated
operation identity without duplicate publications or progress events, missing
capability grants, same-user ungranted sources, cross-user originals, snapshots,
tasks, artifacts and Material reads, and administrator-only installation.

The lifecycle assertions verified that disable blocks new snapshots while a prior
snapshot drains and published revisions remain readable; deleting the snapshot
retires its actual worker PID; closing the app retires another user's worker;
restart restores the immutable snapshot, configuration, task identity, artifact
and Material history with a new worker PID; and stop retires a worker and rejects
its revoked snapshot. The other account continues independently.

No required gate remains blocked. Live GitHub transport, external model behavior,
model-produced summary quality, raw text-file import, large texts, active-task
cancellation, in-flight grant revocation, and deployment/native UI behavior were
not tested. The trial uses only generated data, with no mocked host callbacks and
no model calls. The instruction-like fixture text remains ordinary evidence.

See `trial-result.json` for timestamps, exact corrections, baseline and counts.
