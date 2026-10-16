# M14 Desktop capability ledger

Discovery and characterization parent: M08 `58944f00837c89bc1d302ecd7be7a568db4abe44`.
This is the implementation ledger, not a completion claim. Dependency M13 is
still being developed; M12's paused handoff is not consumed here.

| Decision | Existing capability / production entry | Intended M14 behavior / evidence |
| --- | --- | --- |
| KEEP | `Collector.start/capture`, app collection rules, masks, local OCR, upload review, battery/lock/idle policy, notification/UI page collection, deduplication and state series | Retain the existing capture pipeline and durable stage/input journals. Generated native I/O fixtures characterize privacy and lifecycle. No real personal capture. |
| KEEP | `DurableQueue`, retry/backoff, batch slices, per-item ACK, queue limits, original blobs, custom storage relocation | Reuse the same queue and storage implementation separately for each stable account. An old request settles only its original queue. No destructive reset or queue adoption. |
| KEEP | `NoteDraftStore`, prepared submission before enqueue, idempotent retry and text/mood validation | Preserve authored and prepared drafts in their original account directory. Old renderer submissions must fail after account retirement. |
| KEEP | `LocalSourceManager`, file/calendar/Coding adapters, watcher, source policy, fair upload slices, original spool, checkpoints and snapshot recovery | Keep scan/queue algorithms, local authorization and configured privacy filters. Source membership and cursors belong to the account; reconnecting A resumes A. B must explicitly connect sources. |
| KEEP | `SyncHistory`, capture/content browser, local and central original reading, Ask presentation, central browser navigation | Preserve the existing information architecture and history/content functions. Account-specific storage and response fences replace URL/device-only identity. Private browser navigation uses the authorized account handoff. |
| CHANGE | Original Work Activity aggregate, record progress, branch results and exact source/Material links | Read existing M05–M08 receipts through an owner-bound SQLite projection; filter relationships and state before paging. Preserve original-record deduplication, pending intake, unbatched corrections, owner questions and branch artifact links. Task steps are never labeled records. Current artifact grants are rechecked separately from historical completion. M16 export/delete metadata is now consumed through its real owner/admin receipts; M16 import and M12 await their owning contracts. |
| CHANGE | Immutable received OCR flags could remain pending after central work finished | Read only declared `extraction:ready` with exact capture membership for successful text; observe exact original work receipts for failed or stale central stages. Other summaries and image understanding do not replace OCR. |
| KEEP | diagnostics/support/export, queue backup import/export, updater, profiles, safeStorage and single-instance lifecycle | Keep existing entry points and encrypted credential storage; queue archives declare and validate stable owner, and native exports capture their account store before dialogs. Public update downloads remain instance-local. No production deployment or permissions changes. |
| CHANGE | `connectionBinding` and `sourceConnectionBinding` use token hashes; same-origin reauthorization can rebind data | Use server-confirmed origin/deployment/user. Token rotation never changes owner. Different users or deployments never share queues, drafts, source configuration, credentials, history or action ledger. |
| CHANGE | legacy `/api/captures`, `/api/sources` and file-sync v2 transport | Consume M01 protocol 2 and actual M03 Ingress 3, validating owner/source/batch and exact ACK identity before deleting queued bytes. Retain existing queue scheduling and original spool. |
| CHANGE | logout/expiry and settings suspension can resume previous capture intent | Logout/account change retires old capture and upload admission, waits for in-flight work, preserves old data and stops capture. New B capture requires explicit start. Same-account privacy edits preserve existing running intent. |
| CHANGE | local storage version 3 does not establish account ownership | New version rejects old unbound personal storage before any mutation. Existing files remain byte-for-byte intact; no automatic reset, migration or guessed owner. |
| REMOVE | global owner token as Desktop identity, origin-only and credential-hash ownership, implicit same-origin adoption | No compatibility fallback to the old owner identity or old production routes. Algorithms may retain characterized legacy protocol fixtures, which do not prove new production isolation. |
| EXCEPTION | M12 native calendar execution/approval contract | Existing native capability is retained; its multiuser consumption and final acceptance wait for the explicitly approved dependency handoff. No duplicate external write implementation. |
| EXCEPTION | Final shared consumer composition and native permissions | M11 final98d76945 is composed. M13 tested3300db21 and M15 tested5a0dd911 are actual consumer combination checkpoints, not their final acceptance. Actual generated Desktop main/preload/renderer has been exercised separately; real system permissions, personal capture and live providers remain unrun. M12's denied handoff remains unconsumed. M16 owns portable3 and instance lifecycle; its later contract is not silently substituted by the local queue backup. |

## Required journeys

Use generated accounts/data and real production queues, ConfigStore, sources and
backend application. Cover offline A → B → restart → A, equal IDs/bytes, credential
rotation, server/deployment change, failed login, pending capture logout, late ACK,
retry and process death. Assert complete queue bytes and B's unchanged state.
Freeze RED and GREEN commits, commands, exits and logs in the validation record.

No real calendar, mail, model, screenshot or personal library is accessed. M13's
denied hidden Electron action is not repeated. Independent Desktop UI/native
validation, if needed, requires its own exact supported execution and evidence.

## Resumed lifecycle consumer increment

The M16 dependency composition is frozen at `ec6d12c6`; its previously passed
checks are dependency evidence, not acceptance of the new M14 consumption.

| Decision | Existing capability | This increment |
| --- | --- | --- |
| KEEP | Desktop Activity cards, filters, paging and central account handoff | Retain the existing UI and original operation identity across navigation. |
| CHANGE | Personal portable export progress and saved result | Project the real M16 owner/current-epoch journal with semantic progress. Only the live owner receipt can advertise a completed archive; download still revalidates the exact bytes through M16. |
| CHANGE | Account deletion status | Current administrators may see the existing deletion receipt's metadata and incomplete/unknown state. This never grants private account data or an export download. |
| KEEP | Local queue/support archives and stopped instance backup | Preserve these separate existing workflows. A stopped CLI backup is not an online Activity task. |
| CHANGE | Personal portable import | Consume M16's original-deployment/original-account merge and deduplication receipt in Activity. Preserve semantic progress, cancellation before commit, and preserved-domain exclusions; completion has no download artifact. The engine and Vault controls remain owned by M16 and the shared central page. |
| OPEN | Raw archive album, sessions, image/thumbnail/OCR filtering | M13 owns the shared original-page projection. Native consumers wait for its actual stable contract. |
| EXCEPTION | M12 consumption | The denied cross-thread handoff remains unconsumed pending explicit authorization. |
