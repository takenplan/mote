# M15 Android delivery

Status: Draft delivery authorized with one shared-server readiness test unresolved. Tested candidate `cac7421396a078aaaf22f2b7176d229bd29b16ed`; own feature `codex/mote-multiuser-m15-android`, base `codex/mote-multiuser-integration` at `6272a9b51ec92cc4c32e2ff1a1eeb4fa38b142ed`. Remote head and Draft PR metadata are recorded in the final handoff after verification.

Android now assigns queues, originals, drafts, caches, source state, cursors and background work to normalized origin, deployment and user. Token rotation retains that ownership. Account changes retire old private pages and collection, preserve encrypted old-owner state and require explicit new-owner collection. Uploads check current identity before private I/O and validate complete Ingress3 receipts. The shared SQLite/services/executor architecture remains.

## Existing capabilities

| Capability | Delivered consumer and evidence |
| --- | --- |
| Screenshot/UI, notifications, audio, notes and local privacy | Original capture and queue engines retained. Generated native collection/drain/late callback and permission-refusal journeys are in the ledger. Physical phones and vendor background behavior remain unrun. |
| Offline queue, original files, WorkManager | Actual offline A→B→SIGKILL/restart→B isolation→A queue/draft recovery, without clearing data between death and restoration. Current SourceUploadWorker same-ID/spool/context/access-refusal and snapshot durable recovery each execute against real scoped backends on emulator-5562. |
| Native private pages | Existing Ask/Insight, Memory/plugin, notes/Library, Activity, connections/MCP/QR and Actions use their scoped contracts with captured client, page owner and generation guards. Canonical citation reads reject raw UUID fallback. Direct private browsing follows the existing M01 credential capabilities. |
| Files and generic Imports | Original correction, speakers, playback, original download/export, cancel/retry/delete, private multipart preview and explicit confirm retained. Immutable operation bodies survive lost ACK. Original scalar and graph processing settings use M04 CAS. |
| Models | Original copy with/without credentials, configured connection probe, full directory and explicit feature defaults retained; shared credentials stay opaque. Actual generated tool/citation and physical fake-Codex RPC tests cover owner retirement and B positive behavior. |
| Recording connectors | Original range, vendor transcript, failed audio retry and playback retained. Collection pause/disconnect preserve accepted history; explicit source withdrawal remains a read fence. Real synthetic provider and original native tests cover both boundaries. |
| Personal export/import and administration | Whole-response staging verifies identity, receipt and transport integrity before opening selected output; portable downloads also verify exact hash/bytes/MIME/ETag. Import remains bound to the same original deployment/user. Administrative diagnostics retain the existing metadata-only scope. |

The detailed original-capability mapping, source provenance and exact journey methods are in [the matrix](multiuser-android-final-matrix.md) and [execution ledger](multiuser-android.md). Obsolete per-user runtimes, global bearer assumptions and raw UUID citation fallback are removed as part of the protocol migration; their user-facing functions use the declared scoped entries.

## Verification

Final required command: `npm run check:affected -- --base origin/codex/mote-multiuser-integration`.

**Actual result: EXIT1**, naturally completed after1895.59s on unchanged candidate `cac7421396a078aaaf22f2b7176d229bd29b16ed`. Receipts: `/tmp/m15-required-final-node26-ackfixture.{log,exit,result.json,coordinator.json}`. The parent subsequently authorized publishing the completed UI scope as a Draft with remaining red items disclosed.

| Stage | Actual result |
| --- | --- |
| All workspace/root types and i18n | 0 |
| Desktop | 587/587,62files,0 |
| Server | 2814pass,1fail,2existing skips,0cancel,2817total |
| Web | 518/518,0skip,0 |
| Agent | 317pass,1existing opt-in skip,0 |
| Shared / Diagnostics | 192/192 and5/5,0 |
| Root follow-on tooling / client / runner | Not reached inside the failed required command. Independent original commands pass81/81,5/5 and0 on064a, with unchanged relevant code. |
| Android JVM | Not reached inside the failed required command. Independent actual c06 run passes358/358,75XML,0failure/error/skip,61.35s. Android production, tests and backend fixture/runtime are unchanged in the final candidate. |
| Server build | Independent c06 build0; production runtime unchanged. |

The sole red item is `apps/server/test/multiuser-memory.test.ts:510`: the raw screenshot daily OCR/pixel test's unchanged25s shared readiness window ends while OCR has succeeded, analysis/derivatives remain running and Memory waits on `memory_image_products_pending`. Final recipe/body assertions are not reached. The same production source passed that case15.35s in the previous full c06 run; that pass does not waive this failure. Exact cause remains unconfirmed. No budget, count, assertion or skip was changed for it. Shared M06/M07 readiness and final union acceptance remain open.

The old c06 physical-ACK failure is resolved as a fixture premise correction: the corrected trusted-owner ACK case passes4.093s in this full run. The old required EXIT1 and diagnostic variants remain separate. No production retry guard was relaxed. Independent current native SourceWorker/snapshotWorker evidence supplements the unchanged-code JVM evidence; no repeated expensive stage is represented as fresh execution.

Current native representatives on the final candidate: actual SourceWorker and snapshotWorker each1/1/backend0 under installed Node26. Their production Kotlin is byte-identical to the earlier five-case8ba native composition. Only the server recording adapter changed since8ba; its original native pause case has durable RED→GREEN,1/1 actual7.22s,including source withdrawal/B, plus both real provider neighbors2/2,no skip42.72s. The earlier queue SIGKILL proof is retained with its exact source and unchanged-code evidence, rather than described as freshly repeated.

The physical-ACK fixture migration preserves generic stale-parent retry409, uses the existing authenticated host-only acknowledgement, and asserts no child/parent revival or fabricated physical completion. Original new-operation physical rejection, B positive and late settlement remain. Full unknown/late-ACK file4/4,no skip13.77s and independent bounded review are recorded. This is trusted replacement/physical-guard coverage; valid blocked-parent HTTP retry positives stay separate.

Root and actual Mem0-resolved database constructors plus natural-allocation cleanup pass with Node26.11.1 and the original locked better-sqlite3 12.10.0 ABI147 binary. The separate local rebuilt ABI137/Node24 cleanup abort is retained as an exact environment limitation; no dependency/version/lockfile or peer installation changed.

## Remaining boundaries

Declared common processing503/b7 and the minimal recording949/ab776 freezes are the consumed boundaries. Installed custom image recipes, shared/component startup observation and the eventual common processing union remain producer-owned joint work. Native graph editing/CAS is verified; configuration save alone is not evidence of those later execution contracts. The old Android baseline had no Web-only test-local/imageProfileId/preview-reprocess widgets.

Physical phones, real personal-calendar writes, actual system grants/vendor background behavior, public HTTPS and real-provider/model quality are unrun. Docker epoch5/Hindsight whole-instance recovery and the final same-SHA cross-client eight journeys remain joint acceptance work. Main/integration, deployment and disabled CI remain unchanged.

Engineering decisions retained in the ledger: stable origin/deployment/user ownership; preserve old encrypted state with explicit adoption; scoped protocol migration while retaining original engines; staged output publication; conservative stale-parent rejection in the physical guard test; locally verified Node26/native ABI selection. No user input or system approval is pending.
