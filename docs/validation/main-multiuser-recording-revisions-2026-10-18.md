# Scoped recording revision regression

Run date: 2026-10-18 (Asia/Shanghai).
Status: the final narrow generated-fixture run passed 6/6. Integration with the
related shared-recording-flow changes, the final affected-component gate and
complete local-Codex acceptance remain pending in the
[main integration report](main-multiuser-integration-2026-10-17.md).

## Actual source and execution

| Receipt | Actual inputs | Natural result |
| --- | --- | --- |
| Original diagnostic | Q `30938d94fa4cee8aabf8099ae97f55cc062869ea`, tree `58678c272d85f54baed880e6803c9d62f07aca8e`, plus the new uncommitted five-case test | Exit 1; 0/5 passed, five failed, no skips/cancellations; 10.305 s |
| Final narrow regression | `831eb6d1bef5eb11d19d62b6f9447faacade6af4`, tree `d0f1d60843271375ede43ccf99eea2a37e8d999c`, plus exactly the three file overlays below | Exit 0; 6/6 passed, no skips/cancellations; 31.548 s |

The original test overlay had SHA256
`51dfc7bff7dd6e75e94bd8420f77f2821e450e3a6b46c959eb45283755a19601`.
Its diagnostic disabled automatic processing and asserted current source-head
identities; it did not prove the downstream Material or Memory behavior.

The final run used Node `v26.11.1` and the actual scoped production composition,
accounts, connector installation, loopback HTTP entry points, generated vendor
transport, original-byte storage, automatic processing and restart. Understanding,
summaries, semantic turns and automatic Memory extraction were disabled. A
separate generated Messages provider exercised actual Ask/tool/history turns.
No build, typecheck or broad gate ran in this lane.

Final command:

```sh
node --import tsx --test --test-concurrency=4 --test-timeout=120000 apps/server/test/multiuser-recording-revision-parity.test.ts
```

The original diagnostic used file concurrency one and the same 120,000 ms Node
timeout. The later test adds downstream processing and history assertions;
the two durations are not a performance comparison.

| Final overlay file | SHA256 |
| --- | --- |
| `apps/server/src/scope/connector-recordings.ts` | `3b04e3bc357520400a31f38a76dc3475c1e258ccbe16a687d89755329831d120` |
| `apps/server/src/scope/recording-revisions.ts` | `fd410bb187bbf657fb200fd6e5342a46602abdc17a8fe62244e763aec494ae21` |
| `apps/server/test/multiuser-recording-revision-parity.test.ts` | `977bf301214c96c90e19fdefda235bfd446b6ca0c053fd7d2f08699b080f54f6` |

These exact three file hashes were subsequently read back from commit
`4bd7f5cb7cf107d0a801142ccd2956535527e423`, tree
`0f33c6a2fbfebb2bce228385709d9d324433b56a`. This records the committed bytes;
the execution baseline remains `831eb6d1bef5eb11d19d62b6f9447faacade6af4`
with the listed overlays. The run is not retroactively attributed to `4bd7f5c`
or to the earlier test-only commit `86f678ee`.

## Original failures and corrected acceptance

The title-only and corpus-time-only cases used identical transcript bytes.
Both host tasks completed, but their results reported one failed recording
checkpoint with `recording_transcript_failed`; the export retained its old
revision and metadata. Source inspection identified revision reuse based only
on the byte hash and MIME, despite changed stable SourceItem fields. The
sanitized task receipt did not expose HTTP 409, so that conflict mechanism is
a source-based diagnosis rather than an observed network response.

In the three-to-one, empty and unsupported cases, all three segment identities
remained current after a real host restart. Empty and unsupported export flags
were correctly reported; unsupported decoding remained failed. Archive sources
correctly redacted public `SourceItem.text`. No raw-text HTTP disclosure was
observed or claimed.

The original assertion required the withdrawn segment head IDs to disappear.
That is not the final business contract: deleting heads would invalidate retained
historical capture roots, while deletion revisions or material retirement would
invoke privacy erasure. The final tests instead require withdrawn speech to
leave current Material reads, query candidates and Memory inputs, while retained
originals and ordinary stale dialogue remain available to their owner.

Two earlier preparation attempts are retained separately:

- `mote-recording-revision-parity-Q-red-20261018.log` failed during setup because
  `backupAudio:false` violated the existing `literal(true)` selection schema.
  It is not product RED evidence.
- `mote-recording-revision-parity-Q-contract-20261018.log` reproduced the
  metadata failure, but its segment-text assertions incorrectly ignored archive
  redaction. Those assertions were corrected before the primary diagnostic.

## Repair and final verified behavior

The [recording revision helper](../../apps/server/src/scope/recording-revisions.ts)
compares the complete schema-normalized SourceItem, excluding only observation
time and revision. Original byte hashes remain part of the stable metadata.
Exact replays reuse the existing revision; changed semantics include the prior
revision when deriving the next one, including metadata A→B→A transitions.

For superseded segments, the adapter publishes empty, non-deleted current
snapshots through the existing owner-bound source host. It preserves heads,
capture history and originals. Existing head replacement hides the old Material
and its dependents; deterministic `source.original` processing produces no text
blocks for an empty replacement. No SQL, ConversationHistory or privacy-delete
implementation was changed. Current segments are collected before mutations,
with publication batches limited to 500 and the existing authorization/provider
fences retained. Unsupported exports are archived and withdraw old parsed
speech, then retain their explicit unsupported failure.

The [final six-case test](../../apps/server/test/multiuser-recording-revision-parity.test.ts)
verified:

- Title/time corrections publish new owned revisions with byte-identical retained
  originals; exact replays are no-ops and returning to the original metadata
  advances the current head.
- Three-to-one, empty and unsupported replacements remove superseded speech
  from actual current Material reads and lexical query candidates. Old Material
  Memory preflight is rejected; empty current Materials have no evidence IDs.
- Historical original bytes remain owner-readable after restart. A generated
  Ask keeps its exact saved result and citations with `evidenceStale:true`,
  without `evidenceDeleted`; a fresh Ask receives no withdrawn current speech.
- A and B share the same generated vendor identity and recording ID without
  cross-account changes. Successful media capture IDs remain unchanged and
  transcript/metadata revisions do not increase media-download counts.

These tests cover ordinary revisions, not a new explicit privacy-deletion
scenario. Existing privacy erasure and no-revival checks remain required in the
joint regression. A separate read-only review found no confirmed regression in
the helper or adapter integration; it did not run another test process.

## Receipts, cleanup and limits

Receipts and logs are local evidence under `/tmp`; they are not committed vendor
exports, tokens or model responses.

| Evidence | SHA256 |
| --- | --- |
| `mote-recording-revision-parity-Q-receipt-20261018.json` | `d7345f6798370d88d35a8280e6fb876f80e4bb04f9a25d82dc85c17dbbb02a43` |
| Primary RED: `mote-recording-revision-parity-Q-final-red-20261018.log` | `94c233cf2d39ecabf914daf795b7e385d6306df9fea5383abf10bfc6a7a2f7e7` |
| Setup error: `mote-recording-revision-parity-Q-red-20261018.log` | `8ba8da185a351b744b1fba19be257263836042913af0ed746eb54818899a1237` |
| Assertion preparation error: `mote-recording-revision-parity-Q-contract-20261018.log` | `161cd84e1b583662e19bae9fd2e49c799637abbb7dc3c455c1982452a6f57455` |
| Final GREEN: `mote-recording-revision-parity-Q-fix-20261018.log` | `a471dd686610ef3880804c9a9a784103c9316fce127bb48fca2d29bc9c527793` |
| Final receipt: `mote-recording-revision-parity-Q-fix-receipt-20261018.json` | `3cf047ba6417b4256e4046c555996bfa2d4695c818bab91f010df33d028f6598` |

Fixture cleanup hooks completed without failures: hosts closed, generated
private directories were removed and the generated provider closed its
connections/listener. No matching test process remained at readback. No
unrelated resources were removed.

All accounts, transcript text, audio bytes and provider/model responses were
generated. No physical recorder or real vendor account was exercised. No ASR
endpoint was configured; this lane does not establish suppression of automatic
ASR task admission. The separate shared-recording-flow/backup-disposition work
must be integrated and revalidated. Generated Ask transport is not local-Codex
live-model acceptance or evidence of semantic quality. The final joint gate,
complete local-Codex acceptance, `main` merge and release remain pending.
