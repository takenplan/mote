# M15 Android capability and acceptance ledger

Production parent: `98d76945e091d7234217ebcf532ebeff3350937c` (M11 final including M01/M03).
Independent workspace: task-19/mote; feature `codex/mote-multiuser-m15-android`.
No M12 handoff is consumed. M13/M14 work in progress is not accepted dependency evidence.

| Decision | Existing capability and real chain | Required account adaptation / evidence |
| --- | --- | --- |
| KEEP | Accessibility/UI-page/MediaProjection screenshots → CapturePipeline/staging → DurableQueue → UploadWorker | Preserve privacy masks, OCR gate, image dedupe, metadata, timestamps and original bytes. Freeze collector configuration/owner before asynchronous capture; pause on account switch. |
| KEEP | Notifications/device events/audio → MediaCollectionService → queue | Preserve per-app rules, intervals, permissions and metadata. Never carry A observations to B. |
| KEEP | QuickNotes/NoteDraftStore → queue → UploadWorker | Draft and prepared immutable ID belong to account; safe retry after death, separate B draft. |
| KEEP | SourceScanWorker/SourceProviders → LocalSourceStore; FileSources → FileArchiveQueue encrypted spool → SourceUploadWorker/FileUpload | Preserve calendar and selected files/folders, original/snapshot/reference, one-time/continuous scans, original bytes, late ACK and retry. Owner-specific cursor, configuration, registration and spool. |
| KEEP | SyncSchedule/Heartbeat/Recovery/WorkManager | Preserve manual/timer/batch/network/charging conditions, cancellation/backoff, reconciliation and retention. Worker intent carries original owner; old worker cannot adopt B. |
| KEEP | QueueStorage/QueueLocationStore, local browse, dedupe, export/import and diagnostics | Existing queue engine and encryption remain; account namespace precedes directory selection. Cross-owner archive restore must reject; retain A files. |
| KEEP | CentralContent/CentralScreens/CentralClient native navigation, Ask, Library, configuration, plugins, administration, file/note drafts, media | One account shared with collection, immutable client/generation fences, scoped cache/drafts; username/password and browser handoff use M01. Per-domain wire adaptation recorded separately; M12 remains pending. |
| CHANGE | URL dataOrigin / token-hash source target; owner token login / invite | Stable normalized origin + server-verified deploymentId/userId; credential rotation retains owner; different deployment at same URL is different owner. Wire 2, Ingress 3. |
| CHANGE | Local storage format 3 without stable account binding | Format 4 rejects old marker/config before writes; no auto-migration, deletion or inferred owner. Anonymous local collection remains explicitly local until user confirms binding. |
| REMOVE | Treating HTTP success or legacy v2 receipt as sufficient ACK; same URL as owner | New account-bound complete M03 receipt must match owner/source/batch/capture set. |
| EXCEPTION | Shared device settings, update artifacts, bundled OCR models and encryption key | Non-private installation resources remain shared; content/cursors/drafts are account-scoped. |
| UNKNOWN | Real phone/vendor background behavior, live providers/models; M12-dependent action contract | Not exercised with real data; report independently. |

## Evidence

Initial RED tests and subsequent actual worker/backend acceptance are recorded with exact SHA, command, exit and logs as they run. Dependency M11's Android329 is not M15 acceptance.
