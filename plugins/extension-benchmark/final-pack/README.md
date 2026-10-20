# Round 5 independent Iterator: financial source and text processor

This implementation was authored from the frozen case plan, `cases.json`, current
`docs/plugin-authoring.md`, and original non-benchmark source/tests at
`88fb30af6cc70d369625f4b1350e78f01e207650`. No earlier Iterator plugin or report was
read. Host business source and existing tests are unchanged.

The implemented unit is a real, explicitly invoked source-to-Material financial
ledger plus an independently invoked processor-to-Transcript/Material path.
**Full E01 remains FAIL / NO_EXTENSION_POINT**: the default worker inventory has
no model adapter or external automatic insight policy. No normal query, Memory
insight generation, or UI journey is claimed from a ledger Material.

## Public execution

`http-host.ts` starts the shipped `buildScopedApp` composition in an actual child
process and listens on loopback. It uses normal Accounts initialization. Everything
after the one-time test administrator bootstrap uses authenticated HTTP. It adds
no adapters, task kinds, stores, schedulers, identity selectors, or private routes.

The only supplied host dependency is a generated release-download transport. The
host still resolves a fixed repository/tag/commit, verifies the actual ZIP SHA-256,
extracts and installs the archive, checks actual worker exports, fixes snapshots,
admits tasks, executes worker RPCs, and commits/reads normal persistent products.

```sh
PATH=/opt/codex/runtimes/codex-primary-runtime/dependencies/node/bin:$PATH \
  node --import tsx --test apps/server/test/extension-benchmark-final.test.ts
```

The focused test does not write any tracked fixture or report. To record a run,
provide an explicit output path:

```sh
MOTE_EXTENSION_FINAL_REPORT=/tmp/mote-round5-run.json \
  node --import tsx --test apps/server/test/extension-benchmark-final.test.ts
```

Real server/worker processes and loopback networking require the executor's
authorized process/network permission. The root integration driver owns broad
regression checks; this Iterator does not substitute a focused result for G5.

## Release and component contract

`release.mjs` exports `makeRelease(version = '1.0.0', variant = 'finance')`. It
returns `{repository, tag, manifest, archive, responses}`. `responses` is a Map of
the exact generated GitHub URLs to bytes. `releaseTransport()` combines versions
1.0.0, 1.1.0, and the native-ABI probe without permitting other destinations.

`mote-plugin.json` and `plugin.zip` are the frozen 1.0.0 release. The release maker
also builds 1.1.0 by changing only the bundled `version.mjs` constant and manifest
version. Its archive digest therefore changes. The runtime code is retained per
admitted snapshot; it is not edited in place during an upgrade.

| Runtime module | Component | Capability | Public role |
| --- | --- | --- | --- |
| `source.mjs` | `final.finance.source`, version `1`, ingress | source | Receive optional source items; scan authorized original pages; normalize, deduplicate, associate refunds and publish a monthly Material |
| `processor.mjs` | `final.text.processor`, version `1`, processing | processor | Read an authorized original; normalize supplied text; stage a real Transcript that the host publishes |

The runtime lists source first and processor second. The manifest deliberately
lists processor first and source second. The modules can be packaged separately;
neither depends on the other. The test also configures them in independent
instances with distinct capability grants and real workers.

Each user configures an instance using the installed package ID, a page size, and
explicit grants. Installation and checking perform no history scan or semantic
mock call.

```json
{
  "id": "same-instance",
  "packageId": "<installed package ID>",
  "name": "Generated monthly ledger",
  "configuration": {"pageLimit": 7},
  "desired": false,
  "grants": {
    "capabilities": ["source"],
    "sourceIds": ["source-bank", "source-notice", "source-email"],
    "history": false
  }
}
```

After normal check, enable, and snapshot admission, invoke the source with:

```json
{
  "componentId": "final.finance.source",
  "payload": {
    "sourceIds": ["source-bank", "source-notice", "source-email"],
    "month": "2026-09",
    "operationId": "<same request operation identity>",
    "pageLimit": 7
  },
  "operationId": "<same request operation identity>"
}
```

The invocation page limit overrides the instance page limit, which defaults to 7.
Valid limits are the public host range 1–100. The scanner follows `nextCursor`
through every granted source. The visible bank, email, and notification fixtures
require respectively 3, 2, and 3 pages at limit 7.

For optional intake, invoke the same source component with
`{mode:"receive", sourceId, batchId, items}`. It directly calls the normal
`receiveSourceItems` method. No ingestion outcome is seeded in internal tables.

## Replaceable semantic seam

The independent Evaluator agreed on this public ABI before delivery:

```js
export async function normalize(
  {originalRef, sourceId, text},
  {signal} = {},
) {
  return {observations: [
    {
      transactionId: 'explicit-transaction-id',
      occurredOn: '2026-09-02',
      amountMinor: 1234,
      currency: 'USD',
      kind: 'payment',
      evidenceId: originalRef,
    },
  ]};
}
```

Refund observations use `kind:"refund"`, a nonnegative integer `amountMinor`, and
mandatory `refundOf` pointing to an observed payment identity. Noise produces
`{observations:[]}`. `semantic-mock.mjs` is the sole semantic implementation and
can be replaced in the ZIP before its digest is calculated. The bundled version
maps the SHA-256 of each exact generated original to explicit row facts in
`semantic-fixtures.json`; it never infers meaning by keywords. One declared
generated fixture adds an abortable 3.5-second model-response delay for lifecycle
checks. It does not introduce a private scheduler or authority queue.

The source obtains **actual authorized original references** from `pageOriginals`,
reads every byte with `readOriginal`, preserves UTF-8 across chunks, and passes
the exact full original text to `normalize` once per original. Source-item
originals are JSON envelopes; their text field is not substituted for the full
original at this semantic seam. Progress events identify the operation, original,
source, exact text and hash, permitting independent request comparison.

The source rejects malformed dates/amounts/currencies, extra aggregate fields,
evidence not bound to the current original, conflicting duplicate identities, and
refunds without an observed original payment. It verifies refund relationships
before the month filter so an out-of-month payment can remain the refund's
original charge. It sums safe integer cents, retains refunds as separate ledger
identities, and preserves every repeated observation's evidence.

There are **zero live model calls** and no real model-token/cost measurement.
Unknown development token and cost fields remain `null`. The fixture proves the
data and authorization path, not semantic quality or provider compatibility.

## Material and processor readback

The source publishes a standard `document` Material, schema version 1. Its text is
JSON with `format:"mote-finance-ledger-v1"` and these fields:

| Field | Meaning |
| --- | --- |
| `month`, `currency`, `sourceIds`, `releaseVersion` | Fixed selection and actual loaded plugin version |
| `statistics` | Total originals, normalized observations, unique identities, noise, repeats, monthly payment and refund counts |
| `totals` | Plugin-computed `grossCents`, `refundCents`, and `netCents` |
| `transactions` | Unique transactions within the requested UTC month |
| `allTransactions` | All observed identities, including out-of-month charges and refund links |
| Per-transaction `evidenceIds`, `sourceIds`, `evidence` | Every observed duplicate's original/source/capture identity and hash |
| `inputs` | Every scanned original, including four visible noise originals |
| `pagesBySource` | Actual host page requests per source |

All 43 visible originals are formal capture members. Each member's locator keeps
its actual original reference and source. The host allows at most 32 member IDs
on one block, so subsequent evidence blocks retain the remaining members while
the first block carries the JSON ledger text. Normal paginated `/read` and
`/members` APIs expose the complete body and evidence. Identical month/source
selection and inputs publish an identical Material ID/revision; the host owns
operation deduplication and persistent identity.

The processor is intentionally deterministic: read the complete original; if it
is a JSON envelope with a string `text`, select that field; normalize CRLF/CR to
LF and trim. It calls `stageExtraction` with a full untimed Transcript and engine
`final-text-normalizer-<release version>`, then returns the host's `{artifactId}`.
The test independently reads `/api/processing/artifacts/:id` and the resulting
formal Material, checks actual text and original lineage, and finds capture
membership. No OCR, VLM, ASR, or speaker-quality result is implied.

## What the focused test establishes

- Visible E01 data: 43 originals from three sources, 23 identities, 4 noise rows,
  16 repeated observations, 19 September payments, 2 September refunds, and
  89,335 − 6,000 = **83,335 cents**; August/October transactions stay outside the
  monthly sum while their identities/evidence remain available.
- Real Accounts A/B with colliding instance/source identifiers, distinct original
  bytes, foreign snapshot/task/original denials, and administrator private-read
  denial. Same-owner ungranted originals and ungranted sources are also rejected.
- Idempotent host operation identity and repeat publication; no semantic calls
  from install, check, or intake.
- Separate source/processor workers, reversed manifest/runtime ordering, a
  **directly observed running v1 task during v1.1 configuration**, retained exact
  v1/v1.1 snapshots, and public reading of the old Material revision.
- Disable closes new snapshot admission while existing authorized work drains;
  lawful history remains; explicit resume does not automatically scan new gap
  data. Single-task cancellation preserves a sibling call in the same worker.
- Source-grant revocation and stop fence late Material publication; B and the
  independent processor continue. Revoked snapshots return HTTP 401.
- Actual termination and new process/PID reopening the same vault retain task
  identity, old snapshot bytes, original products, lawful history, and isolation.
- Uninstall is rejected while referenced; after public snapshot release and
  instance removal, package uninstall preserves the earlier Materials/artifacts.

## Boundaries and case status

The pre-install `GET /api/plugins/host-capabilities` is a real default-host
observation. It declares source and processor registered and model unavailable.
The native `apply(ctx)` file is installed unchanged as a generated release and its
actual worker check is rejected; it is never rewritten as a Mote factory. This is
an ABI/loading probe, not evidence that a native Harness tool ran. The custom
`benchmark-periodic-v1` payload is submitted to `/api/ask-automations`; admission
returns HTTP 400 and contributes no policy or callback.

| Full case | Scope of this delivery |
| --- | --- |
| E01 | FAIL / NO_EXTENSION_POINT for complete automatic insight/model/query/UI; implemented source/processor subpaths execute |
| E02 | NOT RUN |
| E03 | NOT RUN; availability discovery is not a Central/local-device model routing run |
| E04 | FAIL / NO_EXTENSION_POINT; concrete apply-only worker ABI check, no native tool execution |
| E05 | NOT RUN |
| E06 | FAIL / NO_EXTENSION_POINT; concrete custom policy admission rejection |
| E07 | NOT RUN |
| E08 | PARTIAL; text staging subprobe only |
| E09 | NOT RUN |
| E10 | PARTIAL; upgrade, lifecycle and real history restart execute; in-flight crash recovery not run |
| E11 | PARTIAL; actual A/B isolation executes; model-resource/export branch not run |
| E12 | NOT RUN |

No full-case percentage or complete hard-gate PASS is inferred from these narrow
results. Broad regression G5 and independent held-out scoring belong to the root
driver/Evaluator. Browser, Web DOM, macOS, Android, physical-device, real-provider,
quality and performance dimensions are NOT RUN. This test restarts the actual
process after completed work; it does not claim recovery from an in-flight crash.

`trial.json` is static submission metadata. It is not regenerated by the default
test. Generated reports require the explicit environment path shown above.
