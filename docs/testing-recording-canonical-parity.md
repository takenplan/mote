# Scoped recording canonical input and backup regression

The production scoped connector continues to execute the shared
[`RecordingFlow`](../apps/server/src/connectors/recording-flow.ts). The
[recording outcomes ADR](adr-recording-outcomes-runtime.md) and
[shared-flow ADR](adr-shared-business-flows.md) retain the original whole-recording
context, independent backups and owner authority. This correction addresses
CONN-C04 and CONN-C06, with the recording source default from CONN-C05.

## Supersession

| Disposition | Contract |
| --- | --- |
| KEEP | Provider account checks, complete raw export, exact paragraph/time/speaker locators, metadata revisions, independent audio backup, existing Memory extraction and independent review, source/privacy/unknown-result fences. |
| KEEP | Original durable discover/metadata/transcript/media pools and fixed concurrency 2/2/2/1, five actual transient failures per phase, and discovery-independent retry of admitted stages. These values are literal original behavior at `2c2627621e2598332ae8169845bc7343be7ed63e`, `recordings.ts` lines 57–58; they were not user-configurable defaults. |
| CHANGE | One retained export head is decoded by the existing fixed local provider processor into one canonical transcript Material. Its blocks retain segment coordinates into that same export. |
| CHANGE | The scoped adapter admits each shared-flow successor as its own M05 task and projects real task state; a saved enabled selection returns its single background-sync identity before acquisition finishes. |
| REMOVE | Parallel `:segment:N` SourceItem producers for speech already present in the full export; selection-epoch changes forcing a second download of an available confirmed audio archive. |
| REMOVE | The long scoped sync task executing all pages/stages serially, and custom waiting receipts without an independently runnable durable phase. No second executor or parallel legacy host is introduced. |
| REMOVE | The scoped adapter's reset-only empty retry updated a private checkpoint without scheduling its work. Original `RecordingConnector.retry()` calls the executor's retry directly; both empty retry and `{resume:true}` now retry the real M05 phases. |
| EXCEPTION | Empty exports retain their original without speech blocks. Unsupported exports retain their original and explicit decoder failure. A different vendor account gets a different source and cannot reuse the previous account's media. |
| EXCEPTION | This is current-version production behavior, with no startup migration, former-segment sweep, historical model replay, deployment or grant restoration. |
| UNKNOWN | Real vendor download behavior, physical recorder lifecycle and model semantic quality require separate validation. |

The account-bound host confirms media reuse against the exact current
source head and its available retained original. An old successful work receipt
is insufficient. Selection windows and the background-sync preference remain
authorization and scheduling inputs; changing them does not erase a confirmed
archive fact. Backup intake remains archive-only and does not request ASR.

The existing recording recipe requires `extracted-text`. M06 declares that
artifact for complete, nonempty text extraction, alongside its existing
`extraction` receipt and with the same exact block IDs. Empty or unsupported
exports do not claim that dependency or admit a new semantic Memory intake. The
recipe's extraction/review definition and fingerprint remain unchanged.

## Generated production journeys

[`multiuser-recording-revision-parity.test.ts`](../apps/server/test/multiuser-recording-revision-parity.test.ts)
uses the actual application builder, connector package installation, owner HTTP
routes, M05 execution, generated fixed-command vendor transport, M03 original
storage, M06 processing, M07 intake and restart. Two accounts share the same
vendor identity and recording ID. It does not read personal data or call a real
supplier/model.

| Journey | Required observation |
| --- | --- |
| Three-paragraph recording → ordinary sync → Files/Material/Memory | One export SourceItem and one semantic Material; three exact speech blocks with paragraph locators; raw JSON downloadable through the same original; one intake with the recording extraction/review binding. |
| Title or corpus date correction with unchanged vendor bytes | New canonical head and metadata; old original retained; exact replay deduplicates; A→B→A advances rather than restoring an obsolete head. |
| Three paragraphs → one/empty/unsupported → restart | Removed speech disappears from current Material/search/Memory inputs; retained originals and stale Ask history remain owner-readable. Empty and unsupported outcomes remain distinct. |
| Automatic Memory intake → empty/unsupported correction | The retained export creates no new semantic intake; the other owner's current recording and intake remain unchanged. |
| Confirmed backup → background preference change → range change → restart | Existing audio capture remains playable and media-download count stays unchanged. The other account's archive and calls remain unchanged. |
| Actual vendor-account change with the same recording ID/bytes | New account source archives its own audio; the earlier account's archive fact is not reused. |
| Files forget → restart → changed selection → sync | The existing exact file-forget decision rejects transcript/media acquisition before the provider read; equal IDs in the other account continue normally. |
| Owner audio revision → admitted provider download → Files forget before completion | The one already-issued download may finish physically, but its late result cannot publish a new archive or revive the forgotten source head. |
| Ordinary revision → retained Ask and fresh Ask | Saved answer/citations become stale without privacy deletion; fresh evidence omits withdrawn speech. |

The canonical-input case enables ordinary automatic Memory intake with its
existing pending batch window so that receipt identity can be inspected without
model execution. The other revision cases disable automatic Memory extraction;
their generated Ask provider verifies transport and history, not model quality.
The separate
[`multiuser-recording-backup-processing.test.ts`](../apps/server/test/multiuser-recording-backup-processing.test.ts)
checks archive-only backup intake and explicit owner processing.

The late-download fixture first uses the ordinary production ingress upload
routes to publish a generated owner audio revision under the same audio identity.
Even copied provider metadata cannot grant the host-only backup format, so it
cannot satisfy the connector's confirmed-archive reuse check. It then holds the generated provider
media response while the current file is forgotten through Files. Automatic
processing is disabled before that ordinary upload to avoid unrelated ASR. The
test changes no private database state and does not interpret a transcript-file
forget decision as permission to forget a separate audio identity.

[`recording-source-default.test.ts`](../apps/server/test/recording-source-default.test.ts)
also checks the adapter's interrupted new-source initialization: a failed default
callback leaves a durable intent, restart followed directly by select/sync
completes it before intake, and subsequent established-source connections do not
reset the owner's choices. This isolated host-port regression supplements the
full scoped production canonical-input test.

Run the focused suite headlessly:

```sh
node --import tsx --test --test-concurrency=1 --test-timeout=120000 apps/server/test/multiuser-recording-revision-parity.test.ts
```

Execution receipts, exact candidate and affected-component checks are reported
in the module validation record. This scenario specification does not itself
claim those checks have run or passed.

## Review regressions F01–F05

`multiuser-recording-phase-parity.test.ts` enters actual saved selections and
M05 admission. Generated transport barriers hold non-abort-compliant account,
discovery or audio reads while owner actions continue. It covers:

- F01: forget the exact current audio head during account preflight; releasing
  the preflight must issue no media command. The equal recording in B succeeds.
  Real CLI runner tests separately reject authority after asynchronous version
  and isolated-home preparation, immediately before physical child spawn.
- F04: accepted transcript retries run at M05 `availableAt` with background
  discovery off, after restart, and while a later automatic discovery is held
  or permanently failed. The same phase task retains its actual attempt budget.
- F05: hold R1 media while same-page R2 and next-page R3 complete their canonical
  transcripts and processing consumers. The media pool stays serial, and a
  concurrent explicit sync cannot finish before reused metadata's real children.
- Saved selection ACK recovery preserves its single sync identity and does not
  repeat cancellation. Cancelling a sync fences late child publication while
  future polling and B remain independently authorized.
- An older slow media completion cannot rewind a later discovery cursor. A new
  scan can reuse the vendor's opaque page token; cursor-cycle detection belongs
  to that scan and time window, not the lifetime of the saved selection.

`multiuser-recording-save.test.ts` drives the actual original Web form with
`enabled=true` while discovery is physically held. The saved form is editable,
can close/reopen, and can save disabled before the old provider returns. It
submits no redundant `/sync`. Recovery, independent phase presentation, explicit
retry, paging, account replacement and archive tests wait for real asynchronous
state transitions rather than treating admission as completed acquisition.

Android's `firstEnabledNativeSaveStartsExactlyOnceWithAutomaticDiscoveryOffAndOn`
uses fresh connected instances with no preselection or fixture sync. It edits and
saves the original range form for each automatic-discovery preference, verifies
actual archived phases and one discovery call, and verifies no separate native
`/sync` request. The existing restart/phase/paging/owner-retirement instrumented
journey remains. Kotlin compilation and execution require the native slot; test
source or generated HTTP-fixture smoke alone is not native validation.

`multiuser-recording-process-parity.test.ts` starts an independent production
application-composition HTTP process with generated transport, kills it with
SIGKILL and starts a second process against the same current-version vault. A
pending retry retains its task ID/budget; completed A stages and B do not replay,
and recovery performs no new discovery with `autoSync=false`. This covers actual
process death, not the `index.ts` PID lock or CLI installer entry point.
The generated child clock stays before the pending retry during setup and is
advanced past its real persisted `availableAt` at the second process start;
this avoids racing setup duration against a short real-time retry delay.

`multiuser-recording-recipe-parity.test.ts` exercises canonical publication,
automatic intake and the frozen recording recipe's actual extraction and
independent review tasks through generated model HTTP responses. Both requests
receive the complete owned text and recording corpus policy. A fully assessed
empty selection completes review successfully; fixture responses do not establish
live-model semantic quality.
