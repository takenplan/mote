# M14 Desktop capability ledger

## Resumed native Actions boundary

The parent supplied the fixed, delivered PR140/PR141 composition
`10748005a5d007695ecc9401d0d57dc9dea94919` (PR141 docs head `eec967c6`).
M12/M16 have ended and are not messaged or awakened. An attempted M12 coordination
message was rejected before sending; that communication is no longer required
and is not retried or indirectly forwarded. This increment reads the delivered
fixed code and [Actions contract](multiuser-actions.md), not the earlier refused
handoff. Web `aed42550` and Android `9e824c00` are tested consumer checkpoints,
not claims that their remaining original capabilities are complete.

| Disposition | Existing capability | Required current behavior |
| --- | --- | --- |
| KEEP | `CalendarActions` serial queue, attempting-before-write ledger, exact operation marker, create/update/cancel and unknown-outcome reconciliation | Preserve the original execution algorithm and confirmed native identity. Characterization: `/tmp/m14-calendar-characterization.log/.exit`, seven tests, exit 0. |
| CHANGE | `nativeCalendarActions` actual HTTP/storage adapter | Consume M01 Wire2 and fixed M12 claims/receipts with stable account-owned state and current connection fences. Fake CalendarActionIO tests alone do not prove the real factory. |
| KEEP | Central fixed review, OwnerQuestions, explicit device grants and current target registration | The existing Web Actions page owns proposal/review/approval. Native delivery never invents approval or retargets an old operation to a new account. |
| CHANGE | Current Mac browser entry versus historical embedded-window bridge | Keep the current Chrome/default-browser account handoff. Restore explicit native target connection and approved delivery in the existing Desktop calendar/source area, with Web review remaining separate; do not introduce a new primary navigation or silently turn read-only source sync into write consent. |
| KEEP | Native permissions and original externally issued work | Use generated native-I/O substitutes for acceptance; no real permission prompt or calendar write. Logout/switch retires old admission and preserves the original ledger and external fact. |

This follows [multi-user Clients/Ownership](../adr-multiuser-scope.md#decision-and-provenance),
[native domain commands and progress](../adr-client-action-first.md#content-and-progress),
[existing calendar journey](../calendar-actions.md) and the documented current
[Desktop browser entry](../desktop.md). The small native connection/delivery
controls are a reversible restoration of those commands; they grant no Central
approval authority and do not alter the existing source permission statement.
No ordinary user decision or approval is pending in M14.

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
| CHANGE | Original Work Activity aggregate, record progress, branch results and exact source/Material links | Read existing M05–M08 receipts through an owner-bound SQLite projection; filter relationships and state before paging. Preserve original-record deduplication, pending intake, unbatched corrections, owner questions and branch artifact links. Task steps are never labeled records. Current artifact grants are rechecked separately from historical completion. M16 export/import/delete metadata is consumed through its real owner/admin receipts; M12 awaits its authorized handoff. |
| CHANGE | Immutable received OCR flags could remain pending after central work finished | Read only declared `extraction:ready` with exact capture membership for successful text; observe exact original work receipts for failed or stale central stages. Other summaries and image understanding do not replace OCR. |
| KEEP | diagnostics/support/export, queue backup import/export, updater, profiles, safeStorage and single-instance lifecycle | Keep existing entry points and encrypted credential storage; queue archives declare and validate stable owner, and native exports capture their account store before dialogs. Public update downloads remain instance-local. No production deployment or permissions changes. |
| CHANGE | `connectionBinding` and `sourceConnectionBinding` use token hashes; same-origin reauthorization can rebind data | Use server-confirmed origin/deployment/user. Token rotation never changes owner. Different users or deployments never share queues, drafts, source configuration, credentials, history or action ledger. |
| CHANGE | legacy `/api/captures`, `/api/sources` and file-sync v2 transport | Consume M01 protocol 2 and actual M03 Ingress 3, validating owner/source/batch and exact ACK identity before deleting queued bytes. Retain existing queue scheduling and original spool. |
| CHANGE | logout/expiry and settings suspension can resume previous capture intent | Logout/account change retires old capture and upload admission, waits for in-flight work, preserves old data and stops capture. New B capture requires explicit start. Same-account privacy edits preserve existing running intent. |
| CHANGE | local storage version 3 does not establish account ownership | New version rejects old unbound personal storage before any mutation. Existing files remain byte-for-byte intact; no automatic reset, migration or guessed owner. |
| REMOVE | global owner token as Desktop identity, origin-only and credential-hash ownership, implicit same-origin adoption | No compatibility fallback to the old owner identity or old production routes. Algorithms may retain characterized legacy protocol fixtures, which do not prove new production isolation. |
| EXCEPTION | M12 native calendar execution/approval contract | Existing native capability is retained; its multiuser consumption and final acceptance wait for the explicitly approved dependency handoff. No duplicate external write implementation. |
| EXCEPTION | Final shared consumer composition and native permissions | M11 final98d76945 is composed. M13 tested f1e059e4 plus Vault07f54ac3 and M15 tested c81ca46f are actual consumer checkpoints, not their final acceptance. M16 import89ddc973 and restart fix1fd1189e are composed and exercised through real Activity/main/preload. Actual generated Desktop main/preload/renderer has been exercised separately; real system permissions, personal capture and live providers remain unrun. M12's denied handoff remains unconsumed. Portable3 and instance lifecycle remain M16-owned and are distinct from local queue backup. |

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

## Resumed decision ledger

These are reversible implementation choices within the adopted design, not new
product policy. Ordinary choices were not presented to the user. The parent
owns any future conflict with the original discussion or ADR direction.

| Problem | Decision and reason | Impact / reversibility | Verification and design basis |
| --- | --- | --- | --- |
| Credential rotation and a reused URL cannot identify a private owner. | Keep stable origin/deployment/user ownership; confirm the current deployment before each private request. Reuse existing account confirmation and captured-client fences. | Extra identity reads, no owner migration, token retention or new runtime. The request admission adapter is reversible; relaxing ownership is not an approved option. | Actual same-URL deployment replacement 3 RED → 3 GREEN. [Multi-user ADR: Clients and Supersession](../adr-multiuser-scope.md#supersession), [public contracts: authorization and read proofs](multiuser-public-contracts.md). |
| Old account-unbound local files cannot establish ownership. | Reject unsupported local format before writes and retain existing bytes. Do not adopt, reset or delete user data. | A separate current-format account directory is required; no compatibility reader. | Actual queue/config startup and unchanged-file tests. [Multi-user ADR: New baseline and write admission](../adr-multiuser-scope.md#new-baseline-and-write-admission), [MVP baseline: Supersession](../adr-mvp-baseline.md#supersession). |
| Export/import/delete progress must not become a second task engine or expose another account. | Project the durable M16 journal through its live owner/epoch or administrator metadata receipt. Use semantic progress; preserved domains are excluded, import has no artifact. | Read-only Activity composition, no private BLOB/grant access or new scheduling. M16 remains the import/backup engine owner; no personal point-in-time recovery promise. | Actual lifecycle Activity 6/6, composed import/Activity 20/20, real main/preload export and import handoff. [Multi-user ADR: Storage and recovery](../adr-multiuser-scope.md#decision-and-provenance), [client ADR: Content and progress](../adr-client-action-first.md#content-and-progress). Same-account merge/dedup is the parent's later explicitly approved M16 scope. |
| Immutable intake OCR cannot reflect current central extraction; source names are not receipt identity. | Archive previews consume M13's exact raw projection. Detail/original lookup uses actual owned source inventory and exact M03 capture/source descriptors; never assume an internal field is exposed or guess the source from a device ID. | Additional read-only source metadata traversal for captures without provenance; existing local/session algorithms and immutable intake remain. No new route, grant or classification rule. | List RED → GREEN; explicit/default source 2/2 GREEN includes original image, before/after real M06 and B same-ID isolation. [Client ADR: Content and progress](../adr-client-action-first.md#content-and-progress), [Central file evidence ADR](../adr-central-file-evidence.md), [scoped raw reader contract](multiuser-capture-browser.md). |
| Canonical Ask evidence may have no raw capture; temporary originals can span processing stages. | Preserve the explicitly declared M08 context reader, without error-driven raw/context fallback. Reuse M03/M06 exact pins/recovery and existing source queue; an ordinary retry does not renew released authority. | Existing Ask navigation and original recovery remain; no second reader authority or endpoint processing runtime. | Actual main/preload and native citation click, M08 A200/B404/raw404; snapshot OCR/image-stage RED/GREEN and real queue recovery. [System refactor ADR](../adr-system-refactor.md), [task recovery ADR: Failure handling](../adr-task-recovery-and-execution-budgets.md#failure-handling-contract), [public contracts](multiuser-public-contracts.md). |

At the parent's pause checkpoint there is no pending user question or approval in
M14. The M12 handoff is still unconsumed; its authorization is being handled by
the parent in that original conversation. Physical permissions and live private
data tests are unrun, not an outstanding request for the user to approve them.
