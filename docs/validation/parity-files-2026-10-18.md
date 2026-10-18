# Files parity restoration — candidate validation

Baseline: `2c78ca8d52a7d17fae20962cf68d09a717ffc73a`. The comparison baseline
is `2c2627621e2598332ae8169845bc7343be7ed63e`. This record describes generated
fixtures and current source, not deployment, live-provider or physical-device
acceptance. The final candidate SHA and affected-check receipt are recorded in
the module PR; evidence is not transferred from an older candidate.

## Supersession check

| Disposition | Scope |
| --- | --- |
| KEEP | Current wire/storage; account, source, attachment and incarnation fences; immutable originals; independent processing choice and original retention; prepare → preview → confirm → publication; cancellation and unknown external-result barriers; signed owner/query-bound pagination. |
| CHANGE | Formal processing Materials project device and authoritative content time. Parent image composition reads the immutable applied plan and named products. Files reads metadata heads and retained archive versions through a canonical owner/source/external-ID file-head projection; paths/sizes use existing provenance fields. Administrators can stage a host directory through the shared ImportJob flow. |
| REMOVE | Retention-as-archive-only inference, originals-only catalog JOIN, current-head-only archive reads, title-only search, and unconditional host-directory rejection. |
| EXCEPTION | Retained extraction reads do not restore query visibility or execution authority; processing preview skips non-current and metadata-only entries. Semantic derivations/calendar links retain existing visibility/context fences. Ordinary accounts still cannot import server paths. Central forgetting invalidates all owned versions/tickets; physical byte reclamation is independently governed by existing lifecycle/pins. |
| UNKNOWN | Physical device/provider behavior, actual model quality, host permission denial under real deployment credentials, and physical external erasure require separate checks. |

## Generated journey matrix

| Item | Production entry and transitions | Durable regression |
| --- | --- | --- |
| FILE-01 | HTTP source registration → native upload → processing → Ask catalog filtered by device and recorded/occurred/observation date → restart; equal external IDs in A/B. | `multiuser-files-material-parity.test.ts` |
| FILE-02 | Parent archive + caption → HTTP attachment processing → OCR/understanding pending → named products ready → parent composition; archive retention, custom understanding-only and named OCR recipes; account isolation and restart. | `multiuser-files-material-parity.test.ts` |
| FILE-03 | Native archive → extraction → deleted revision → Files list/detail/chunks/playback/export → reference replacement → restart → explicit central forget → old ID/ticket denied; equal-ID B remains available. | `multiuser-file-catalog-parity.test.ts` |
| FILE-04 | Metadata-only native and source-item reference → catalog/detail with no original capability; same IDs/paths in A/B, owner cursor rejection, restart and central forget. | `multiuser-file-catalog-parity.test.ts` |
| FILE-05 | Administrator host directory → private archived originals → preview → explicit confirm → publication; duplicate request, same path/request ID in two admins, cancel/delete/restart, source directory disappears after preview; ordinary account/vault/symlink and missing/non-directory rejection. | `scoped-admin-directory.test.ts` |
| FILE-06 | Native relative path and reference document path → case-insensitive literal directory query under owner filters and pagination; expired exact snapshot recovery uses the same canonical path/size projection as publication and rejects changed path/title/time/hash/size. | `multiuser-file-catalog-parity.test.ts`, `multiuser-snapshot-recovery.test.ts`, Desktop `multiuser-desktop.test.ts` |
| C07 consumer | File summary/review and document import preview → actual generated-provider usage receipt with explicit agent/module/skill; A/B isolation and restart without replay. | `multiuser-processing-usage-attribution.test.ts` |
| Policy consumer | Mixed current/reference/deleted-origin catalog → preview → reprocess admits only current byte-backed file; catalog entries retain cancellation shape. | `multiuser-file-catalog-parity.test.ts` |

The material fixture associates an archived attachment through the trusted host
port because no public archive-link mutation route exists; attachment admission,
processing, catalog and model reads use production HTTP. Only the external model
transport is generated. The directory helper's legacy tests verify extraction
reuse and are not production multi-user acceptance.

FILE-03 proves that archive entry points remain available and central forgetting
revokes access. It does not prove physical byte deletion. Existing held-export,
file-forget, cancellation, snapshot recovery and attachment tests remain adjacent
regressions and are included in the module's affected check.

## Existing data boundary

An existing epoch-5 vault may already have a deleted source head without a durable
last non-deleted file-head identity. No historical scan, backfill or rowid/UUID/time
guess is authorized. That existing deleted-head main-list case remains unrepaired;
known capture IDs remain directly readable and current live heads remain exact.
Fresh writes and newly exported/imported portable payloads must preserve the exact
retained head, including multiple revisions with equal timestamps. This limitation
is distinct from the generated fresh/restore journey acceptance.

## Existing defect outside this restoration

FILE-07 remains an existing defect: ZIP Markdown decoding does not reconstruct
relative image attachments as canonical parent/file relations. Both comparison
baselines have that gap. This change adds no historical repair, data replay or
new Markdown attachment behavior.

## Execution record

Focused commands use `node --import tsx --test --test-concurrency=1
--test-timeout=120000` with the files above. Logs and exact candidate metadata are
attached to the module PR and reported to the integration driver. Full affected
checks are required before opening/updating that PR. Native builds, UI, physical
devices, live models/providers and deployment are reported separately; none is
implied by passing generated HTTP fixtures.

## Native consumer and additional image-control work

`CentralFileViewTest` covers the production DTO capability projection used by
`CentralLibrary` and the immutable delete descriptor used by `CentralScreens`.
`FilesCatalogParityInstrumentedTest` adds two generated real scoped Activity
journeys: metadata detail without chunks/original reads and lost-delete-ACK
recreation/account switching; retained historical transcript/original/export
without historical edit/retry authority. The actual backend fixture is
`apps/android/test-fixtures/multiuser-files-backend.ts`. Its setup smoke passed;
Gradle and emulator execution remain **UNRUN pending the driver window**.

The later FILE-PERCEPTION assignment adds independent image automatic processing,
policy selection, external-OCR permission, original-query permission and historical
complete/recompute preview/confirmation. The shared-host adapter now uses the
existing configuration registry, policy graph, processing executor and image
receipt proofs. It does not mount a legacy image host. The asynchronous
`processing.perceptionSettings()` port remains the contract for Ask's independent
original-query gate. Endpoint/processor/profile metadata has a single authority
in the selected file-policy/M04 resource. See the
[image/media responsibility decision](../adr-scoped-image-and-managed-media.md).

Generated real HTTP regressions cover:

| Journey | Source |
| --- | --- |
| Independent image admission while file automatic is off; disabled admission; enabling retains the old applied profile; new images use the changed profile; provider revision retains completed receipts until explicit recompute; account concurrency and query disclosure updates retain active work; external OCR permission blocks before physical issuance; complete reuses accepted products; recompute is explicit; restart does not replay completed work. | `multiuser-perception-history.test.ts` |
| Source/date bounds, inclusive/exclusive times, foreign/consumed/restarted preview tokens and fixed watermark; durable scheduling across the 200-item page boundary. | `multiuser-perception-history.test.ts` |
| Actual held OCR/understanding/derived stages at 3 and 8 per owner/kind, equal concurrent B work, hot lowering and subsequent release; physical HTTP OCR and pixel-reading model calls reach 8 each while B retains its own slot, hot 8→3→8 and cancellation with a late response. Nine generated local listeners provide independent physical OCR capacity; the fixture explicitly raises the existing instance model gates rather than bypassing them. | `multiuser-perception-history.test.ts` |
| Cross-pool exact parent/child capacity units, two real SQLite connections, unchanged default pool limits, shared physical resource exclusion, hot lowering and late cancellation commit rejection. | `multiuser-execution-core.test.ts` |
| Administrator-only install/cancel/import, role mutex across two installer hosts, range resume after cancellation/restart, pinned checksum failure and recovery, local bundles without network downloads, no restart-triggered downloads. | `multiuser-managed-media.test.ts` |
| Installed weights versus authenticated worker readiness; model-missing OCR automatically resumes its genuine old processing intent; actual selected OCR/ASR calls receive the fixed worker credential; another account cannot read the result. | `multiuser-managed-media.test.ts` |
| Existing supervisor starts before weights, observes later installation, restarts a stopped worker and stops children with the parent. | Targeted `workers start before model files` case in `scripts/media-workers.test.mjs` |

The fixture generates tiny pinned archives, valid PNG/WAV inputs and authenticated
HTTP processors. It downloads no real models and captures no personal screens.
The actual supervisor test uses generated worker programs; it does not establish
real Python dependency or model inference readiness. Full affected checks,
Android JVM/emulator execution and combined Config/Ask client checks remain
pending the driver window. Real weights, physical devices and live models remain
unperformed. The existing FILE-07 and old deleted-head data boundary above remain.

## Desktop consumer regressions after the driver gate

The required driver gate at `8217a0fb` stopped on three Desktop failures; its
earlier passing steps do not establish acceptance for a later candidate.

The exact snapshot failure was a FILE-06 producer regression. Upload publication
stored manifest-derived path/size metadata, but recovery compared the earlier
unprojected item. Publication and recovery now share that canonical projection.
The real Desktop scanner/spool recovery and the existing server HTTP recovery
test cover the repair; changed path, title, time, hash and size remain rejected.

The two screenshot cases assumed that file `automatic:false` or the collector's
immutable `ocr.disabled` flag disabled central images. The comparison baseline's
independent image settings default to enabled. The revised default/named-source
fixtures therefore await real automatic OCR for A, retain both owners' image
preferences, and assert that equal-ID B has no completed OCR, product or text
from A while its raw intake remains disabled. B's current unconfigured work may
still be pending or already retired when read; that timing is not an isolation
failure. No B preference is switched off to satisfy the fixture.

The Desktop transport dependency series `1417e395`, `d77fa9c4`, `5744d6a8` and
`73c11152` was inspected. Ordinary upload-session expiry/retry and its error type
declaration do not fix the snapshot metadata mismatch. This repair imports no
hunk from that series and adds no Config API change. A fresh full driver gate
is still required before a PR or joint acceptance.

Focused repair-tree validation passed: the complete Desktop multi-user file
(36 tests), six server regression files (49 tests, including all seven historical
Perception cases), server TypeScript no-emit and diff checks. The affected plan
contains 22 checks and was dry-run only here. These generated fixtures do not
establish native-client, emulator, physical-device or live-model acceptance.

## FILES-STATIC-01 capacity repair

The static review correctly identified that account admission alone could not
raise the fixed OCR/analysis pools above 2 or image-stage/pipeline pools above 4.
Generated production-upload tests at 3 and 8 held stages reproduced that failure.
The M05 partition adapter removes those accidental ceilings while retaining the
original owner/kind setting and actual physical gates. Waiting/admitted counts
are not the throughput assertion: fixtures hold actual stage callbacks or HTTP
processor/model responses after pixel inspection, then check successful
publication and owner isolation after release. Real model weights are unused.

The Memory dynamic-resource continuation port is a separate fixed dependency.
Both owners agreed that static-peer eligibility in its `resourceTurn` must use
the same `capacityAvailable` predicate as tick/claim, with Files' capacity/unit
implementation replacing Memory's default implementation. Its running dynamic
continuation does not reacquire task capacity. Partition × dynamic continuation
competition across processes/restart is **UNRUN** until the driver tests the
fixed combined candidate; neither branch's narrow results establish that gate.

The final capacity repair source passed 10 Perception tests, 31 M05/handler/queue/
lane tests, 21 Files/managed-media/snapshot/catalog consumers and 36 Desktop
multi-user tests (98 total), plus server no-emit, scope/import and bilingual
checks. This retains the e799 snapshot/OCR fixture repair and the 8217 historical
progress privacy scenarios. The new full 22-check plan remains driver-owned and
unperformed on this candidate; older failed/partial gates are not combined.
