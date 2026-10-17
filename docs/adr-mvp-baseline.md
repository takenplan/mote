# ADR: Single MVP baseline without upgrade adapters

Status: Accepted, 2026-10-09. Owner approved the cleanup, validation, PR and merge.

Mote uses one current implementation and persisted format. There is no installed-version transition period, old reader, dual write or startup migration. The single-owner baseline established by this ADR uses Central epoch **4** (`backend_epoch` and SQLite `user_version`), Desktop/Android local format **3**, wire **1**, collector Ingress **2** and portable archive **2**. These are independent contracts, not product versions.

The [multi-user scope decision](adr-multiuser-scope.md) supersedes the production baseline for the M00 workstream: Central epoch **5**, wire **2**, Ingress **3** and portable archive **3**. M00 establishes write admission and the host scope contracts; Ingress 3 and portable archive 3 remain reserved until M03 and M16 implement them. Unfinished private capabilities fail closed. Desktop and Android remain local format **3** until M14/M15 implement their account-bound baselines; old account-unbound queues cannot be opened for upload through the new service. The old single-owner composition is explicitly imported only from `apps/server/test/fixtures/legacy-app.ts`, excluded from the production build and fenced from epoch 5. Production startup/configuration cannot select it, and no test-mode authorization bypass exists. See the [module plan](design/multiuser-modules.md) for delivery and acceptance boundaries.

A populated Central vault from another epoch is rejected before schema installation. Existing data is retained. Start with a new empty directory, or stop the service, preserve a backup and explicitly reset the selected vault. This change does not reset any user's directory. The single-owner baseline supports its same-epoch backup/restore and current-format portable import; their multi-user replacements remain M16 work.

## Supersession

| Disposition | Decision |
| --- | --- |
| KEEP | Stable receipt identities, source versions, immutable originals, read-only evidence tools, privacy grants, deletion and retention |
| KEEP | Current leases, interruption recovery, cancellation, provider Retry-After, checkpoints, configuration fingerprints and usage/price accounting |
| CHANGE | Fresh startup installs the final schema, image OCR default and intake/index triggers before inputs arrive; removed configuration fields are rejected |
| REMOVE | Daily-budget retirement/revival, image-policy migration and historical image-input reconstruction, snapshot receipt repair, Activity/dependency backfills |
| REMOVE | Old automatic-Memory-off cutover, ignored source Memory boolean, pre-upgrade waits on unhanded proposal units |
| REMOVE | Closure-based QueryRuns facade/fallback, endpoint file-interpretation queues, dormant Qwen workspace, launchers, manifests and download/setup scripts |
| REMOVE | Retired Android local file interpretation workers and fake processing APIs/journal fields; native lightweight-index settings. Desktop rejects removed `indexMode` configuration before opening source queues, preserving old files; Android retains its existing generic unknown-key parsing without a legacy field reader. |
| REMOVE | Empty Memory selection fallback, built-in personal/Coding v1 recipe/review registrations, old source-item/authored organizer version recognition, transcript@1, audio-dialogue@1 and align@1; current transcript@2 serves all media |
| REMOVE | Old blob-directory creation, statistics and GC paths; current originals use `files/objects` |
| EXCEPTION | User-requested current-format queue relocation, historical recompute and image backfill are current features |
| EXCEPTION | Central `.plain`/`.aes` mixed storage and encryption-policy changes are current supported states, not version compatibility |
| EXCEPTION | Protocol/capability validation, provider/plugin contracts and signature/install checks continue to enforce current boundaries |
| UNKNOWN | Physical-device and live-model behavior requires separate validation; fixture checks do not establish either |

This supersedes upgrade instructions in the 2026-10-04 compatibility audit, the budget retirement section in `processing-throughput.md`, and the pre-upgrade wait repair in the proposal lifecycle decision/validation documents. Those dated records retain their historical evidence. Current operation is described by [architecture](architecture.md), [source pipelines](source-pipelines.md), [deployment](deployment.md) and the [cleanup audit](audits/mvp-baseline-cleanup-2026-10-09.md).

The [archive admission and client cleanup decision](adr-archive-admission-cleanup.md)
completes the endpoint-processing removal. Already scheduled workers from the
retired local parser are not an upgrade exception. Current source upload workers,
pending manifests and byte/ACK recovery remain supported.

The [Central file evidence decision](adr-central-file-evidence.md) removes the
remaining device read-request queue and unused Desktop local read chain. Current
Central retained-text expansion and excerpt dependency links remain supported.

Question requests use DelegatedQueryRuns and the durable delegation journal. No callback closure can substitute for a missing journal. Completed plans and model children resume through their existing identities; an invalid proposal wait is not synthesized or repaired. A current product-owned proposal must be handed to its product before execution can be awaited.

The original continuous-new-input Memory rule and `extraction.enabled:true`-only behavior have been superseded by the implemented [plugin center and memory replacement decision](adr-plugin-center-memory-replacement.md). Ordinary pause stops new automatic admission while previously authorized work drains; immediate stop revokes unfinished automatic publication, and resume does not backfill the paused gap. Source configuration still has no retired `memory` boolean. Separate processing lanes and integration/insight/working controls retain their meanings; privacy withdrawal and missing authorization still prevent model work.

Plugin phase-one controls and pinned adapters are implemented; supported behavior is described in [Plugin center](plugin-center.md), with actual checks tracked separately in the [validation ledger](design/plugin-center-phase-one-validation-2026-10-12.md). The [phase-one plan](design/plugin-center-phase-one-2026-10-12.md) records its original breakdown, not an unimplemented replacement for the current system. Neither this correction nor the multi-user work reinstates retired epoch adapters, source Memory booleans or empty-recipe fallbacks. Plugin user isolation is subsequent M07/M09 work, not implied by the existing single-owner implementation.
