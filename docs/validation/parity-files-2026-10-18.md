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
| FILE-06 | Native relative path and reference document path → case-insensitive literal directory query under owner filters and pagination. | `multiuser-file-catalog-parity.test.ts` |
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
complete/recompute preview/confirmation. That full adapter and managed media
health/administrator installation are still **OPEN**. A small account configuration
and asynchronous `processing.perceptionSettings()` port is prepared for Ask's
original-query gate. It uses the existing private Configurations registry, schema
and YAML; it does not duplicate endpoint or profile authority. Its focused generic
configuration HTTP/host-port test is `multiuser-perception-configuration-port.test.ts`.
This narrow port does not establish that the image controls or history workflow
have been restored.
