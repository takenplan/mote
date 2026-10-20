# ADR: Preserve the Actions discovery journey across account isolation

Status: accepted, 2026-10-18. The owner requires the pre-isolation business
steps and input range to remain, with account-bound resources and authority.
This supersedes the raw-only replacement in the M12 capability ledger in
[the Actions design](design/multiuser-actions.md).

## Decision

Actions retains complete segment understanding followed by a separate calendar
relationship pass. `exact-segments.ts` shares the archive's deterministic
partition, exact-text representatives and completeness calculation.
`semantic-products.ts` shares the original unified prompt, product schema and
exact quote parser. The legacy processor and account-bound producer call those
same domain contracts; production does not construct a legacy Store.

The scoped adapter selects only the current user's authorized originals. A
complete segment uses the original memory-model feature to produce independent
events, Memory candidates and action cues; Memory candidates still pass the
shared admission validator. Actions consumes the cues independently of Memory
publication. A nonempty cue set supplies all its exact original spans to the
chat-model calendar relationship pass. Empty cues consume the product without
requiring a chat model. Product ID and revision checkpoints commit with the
proposals, merges and successful input unit.

This is conditional reuse of a complete bounded segment. It is not a new
requirement for every input. The old direct-original branch remains for long
originals, incomplete segments, structured V2 field pages and processed file
chunks. Existing multi-original formal Material input remains reachable.
Trusted Coding sources, Coding provenance and their derived Material closure
stay outside automatic calendar discovery, as in the old archive flow; Coding
conversation understanding continues to emit `actionCues:[]`. Ordinary text
containing code is not classified or filtered by its words.

The original boundaries are mechanical: screen/non-V2 UI observations share
device, source, app, window and a five-minute bucket; authored records keep
their own identity. The archive partitions at 100 observations and 12,000
distinct text characters and rejects groups above 1,000 members. Oversized
originals remain incomplete and directly pageable. These existing boundaries
are not intent classifiers or new processing quotas.

Discovery progress and successful business-unit identity belong to the user's
Actions history. Enable/disable generations and watcher IDs fence unfinished
work; changing them or the timezone does not create a new identity for an
already successful unit. An interrupted model task retains its existing task
and explicit retry path. Issued/unknown external operations are never replaced
with a newly authorized replay.

The relationship pass computes a complete batch against one comparison
snapshot. It defers merges and new proposals until validation has completed,
prefers an explicit same-batch change over a duplicate merge, protects originals
with approved/executing/uncertain child operations, and removes only exactly
equal new proposals. The model still decides semantic `sameAs` relationships.

Source display names and update timestamps do not change Actions authority.
Source disablement, deletion/recreation, retention, owner declarations and
source-context changes still invalidate dependent approvals. Source/capture
deletion synchronously erases cached semantic products and proposal quotes.
Late native receipts may settle their exact issued fact without publishing
through revoked authority.

Manual Todos use their own evidence authorization. They may reference an
existing owned canonical capture even when it is a screenshot, reference,
archive, or has a formal Material replacement. This grants no body retrieval,
model processing or calendar mutation. Current ownership, privacy, source
authorization, deletion/current-head checks, idempotency and CAS still apply.
Ask's query-visible reader is unchanged.

## Supersession

| Disposition | Contract |
| --- | --- |
| KEEP | Complete segment → unified products → calendar relationship pass → human approval → native delivery/reconciliation; direct-original branches; original prompts and exact quote validation. |
| KEEP | Account/device/target isolation, read-only extraction tools, immutable review payloads, native issuance and unknown-result protections. |
| CHANGE | Bind the shared archive partition and product contracts to scoped originals, model snapshots, tasks, SQL and checkpoints. Persist discovery cursors independently of watch authorization. |
| CHANGE | Restore batch computation, active-child protection, exact proposal deduplication and display-only source updates. Restore manual Todo original-ID inputs. |
| REMOVE | Raw-only replacement of complete semantic inputs; generation/timezone in successful unit identity; immediate per-item merges; source display edits revoking approvals; Ask visibility as Todo authorization. |
| EXCEPTION | Login and necessary identity/resource fences remain. Coding understanding stays a separate producer with empty action cues. Current wire/storage only; no migration, historical repair or real-data replay is added. |
| UNKNOWN | Real-model interpretation quality, real calendar providers, physical-device behavior and deployment remain separate validation. Raw discovery still uses the pre-existing capture rowid cursor; its deletion/reuse edge is recorded for follow-up. |

Generated journey evidence and commands are in
[the validation record](validation/parity-actions-2026-10-18.md).
