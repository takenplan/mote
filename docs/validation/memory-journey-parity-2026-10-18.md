# Memory original journey parity validation

Scope: MEM-M01–M08 from the 2026-10-18 multiuser journey audit. Original production
baseline: `2c2627621e2598332ae8169845bc7343be7ed63e`; fixed implementation starting
point: `2c78ca8d52a7d17fae20962cf68d09a717ffc73a`. These scenarios exercise
`buildApp`, authenticated HTTP entry points, the real scoped Memory host, Agent
provider transport/tool loop and durable executor. Provider responses and all
source content are generated. Legacy composition tests are additional regression
coverage, not evidence that the scoped production journey works.

| Item | Durable production regression |
| --- | --- |
| M01 | `scoped-memory-parity.test.ts`: exact shared output contract/example in extraction and independent review. |
| M02 | Same-original cross-batch `context_evidence`; same IDs under two owners; foreign tool request denied; cross-original actual-read dependency versus unread catalog; deletion and restart; separate catalog metadata fences allow unread-body revision through actual target publication while rejecting changed disclosed metadata. |
| M03 | Independently reviewed legal empty output; missing coverage; incomplete partial proposals blocked without batch publication; original job retry after restart preserves completed sibling task IDs/attempts. |
| M04 | `multiuser-memory-integration-domains.test.ts`: actual personal/coding split, independent reviews, either domain fails while the sibling commits, restart and same-job retry preserve completed domain. |
| M05 | Oversized publication drains through frozen bounded successors, preserving due-time wait, successful supersession, restart and cancel/stop fences. Observation-only publication creates no consolidation window; observations do not satisfy `minChanges` or enter the integration prompt. |
| M06 | `multiuser-memory-coding-preparation.test.ts`: same-ID dual-owner clean Coding intake, independent understanding, work/event Material, extraction, independent review; restart reuse, incomplete retry and cancel/delete/account-disable late results. |
| M07 | Both extraction and independent review receive `quote_not_found` correction before quote-backed coverage checks, and retain content-free candidate/span diagnostics. |
| M08 | Eight independent generated originals keep subsequent model work pending/running behind a provider gate while the first reviewed batch is already searchable; persisted draft/review/prepared checkpoints and stage dependencies remain. |

`multiuser-memory.test.ts` and the existing scoped Memory suites additionally cover
source withdrawal, cancellation, account disable, original-image review, external
provider unknown results, binding changes and deletion. Broad-check results must
be attached to the frozen candidate; prior successes are not relabeled.

## Execution dependency and validation boundaries

The qualified Execution API seam `f416966727bdb182c0fd2921a94a57be43e5a987`
provides operation parent aggregation and is included as an explicit dependency.
The qualified shared semantic-contract seam
`ece742f090a9d2502775184b0396e073050e4de9` is likewise included; Coding and
the legacy processor now share the same pure product parser rather than importing
a retired Store host. The remaining Execution module changes restore effective
configured `memory.models` concurrency. The standalone Memory branch removes the
publisher lock from model work and retains per-original exclusion. More than two
simultaneous configured model calls are
cross-module checks; they require the frozen Execution dependency and are not
claimed by standalone two-slot fixtures.

Local preparation used Node `v26.11.1`, ABI `147`. `npm ci --ignore-scripts` and
shared/Agent builds completed; ignored native installation is not a readiness
claim. The actual Server and Mem0 SQLite resolver preflight must pass before the
required affected check. No lockfile or shared dependency symlink was changed.

The PR description and its attached external validation receipt record the final
candidate SHA, exact commands, exit statuses, evidence paths and required
affected-check receipt. Preliminary WIP successes are not relabeled as frozen
candidate validation.
Physical devices, live models, real SDK/provider accounts and deployment remain
UNRUN. No personal screenshots or production data were collected or replayed.
