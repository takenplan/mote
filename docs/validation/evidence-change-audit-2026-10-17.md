# Evidence change audit — 2026-10-17

Scope: main `6272a9b51ec92cc4c32e2ff1a1eeb4fa38b142ed`. This is independent of
`codex/mote-multiuser-integration`. No Central database, personal source records,
conversation contents, credentials or derived private data were used as fixtures.

## Decisions and their provenance

The referenced discussion was read with the supported local Codex `read_thread`
API: six turns, no remaining pagination. Its repository was on the same main
commit. The original user asked
to pause implementation and discuss principles. A later, separate instruction
authorized this audit, fixes, tests and feature PRs. Uncommitted work in the original
thread's checkout has not been adopted or changed.

The user explicitly stated:

- Compare change at the lowest processed evidence visible to the model. Upstream
  transport changes alone must not invalidate Memory when that evidence is unchanged.
- Pagination changes must not cause Memory to be rewritten.
- Ordinary evidence invalidation must preserve historical conversations and show
  a notice instead of clearing the previous answer.
- Exact text equality is an acceptable first step. Model-based semantic equivalence
  is a longer-term direction, not a requirement to run a model on every update.

The earlier assistant proposed finer dependency propagation, separate current-fact
and historical-context treatment in follow-ups, and versioned correction history.
These are design proposals, not individually confirmed user decisions. Existing
attribution, privacy, authorization, immutable-version and paid historical-work ADRs
continue to apply. In particular, real speaker, attribution, time, title, location,
access and content changes must not be dismissed as transport noise.

## Executable checklist

For each module, start with a generated regression through its actual intake:

1. Fix one logical source identity and its evidence/context, then vary only the
   relevant transport fields. Re-sync and restart. Assert unchanged capture and
   evidence identities, no supersede event, and no extra downstream work.
2. Change one evidence field at a time: body, speaker, effective time, title,
   location, attribution or asset content. Assert a new immutable version and
   rejection of stale work under the current lineage rules.
3. Exercise A → B → A. Do not resurrect historical versions or silently retarget
   old citations to new text.
4. Distinguish ordinary supersession from explicit privacy deletion/revocation.
   Preserve existing privacy cleanup and late-result rejection.
5. For historical-answer changes, cover reading old answers and citations,
   follow-up reference resolution, current-fact revalidation, summary/restart,
   and later privacy deletion through the production HTTP path.
6. For Memory/cache changes, cover rebuild with equal output, actual correction,
   deletion, parent/child invalidation, restart and late commits. Do not turn a
   cache miss into permanent memory loss or a new historical processing grant.
7. Record RED, minimal GREEN, affected-component checks, and separate fixture,
   device and real-model evidence. Obtain an independent review before merge.

## Module findings and suggested ownership

P1 means user-visible history/data loss. P2 means unnecessary invalidation or a
boundary that needs a dedicated regression before its implementation is changed.
The entries below are code findings; only the Lark module is reproduced and fixed
in this PR. They are not claims that every connector failed on real accounts.

| Module | Finding at main | Priority / next action | Overlap |
| --- | --- | --- | --- |
| Historical Ask answers | `evidence-store.ts`, `invalidateConversationAnswers`, replaces result prose/citations for ordinary invalidation as well as deletion. | P1. Split version-status handling from privacy clearing; validate all clients and follow-ups. | Multiuser M07/M08/M11 cumulative PRs #136–#138; original paused checkout also has WIP. Coordinate owner first. |
| Context artifact → Memory | `evidence-archive.ts`, `artifact_memory_invalidation`, deletes Memory when a context artifact is removed; capture JSON update and group changes remove artifacts. | P1. Separate rebuild/revalidation from explicit deletion; trace descendant and checkpoint behavior. | #136–#138. Coordinate Memory owner. |
| Raw capture → Memory | `memory.ts`, `memory_evidence_edited`, treats every JSON change as stale evidence. | P2. Define a complete evidence projection; do not weaken attribution/privacy fingerprints. | #136–#138. |
| Source versions | `sources.ts`, `commitBatch`, invalidates the previous capture as soon as a new head is accepted. | P2. Audit each adapter's normalized input before broad changes to this shared boundary. | Source/connector migration #134 and downstream cumulative PRs. |
| Lark documents | `lark-documents.ts`, `documentRevision`, includes supplier revision counter even when exported Markdown/context are unchanged. | P2. Fixed here: ignore only that counter in equality; retain the immutable revision's original metadata. Snapshot and original-file intake covered. | #134, #136–#138. Small isolated main fix to port after integration. |
| Google Calendar | `google.ts`, `semantic`, includes `modifiedAt` and provider timestamps. Material projection exposes source modified time. | P2 investigation. Split content and provider-state evidence before excluding timestamps; created/planned times remain meaningful. | #134, #136–#138. |
| Gmail | `gmail.ts`, `gmailItems`, includes labels in document metadata/version. | P2 investigation. Labels are meaningful current mail state; distinguish body from state rather than erase labels. | #134, #136–#138. |
| Recordings and local files | `files.ts` hashes archived input before processing equivalence; desktop `source-sync.ts` includes file metadata. | P2. Reproduce pagination/container-only changes, preserve raw versions separately from derived evidence. | Paused original-thread WIP; M06 #133 and M14 #139 related file paths. |
| Formal Material blocks | `materials.ts` includes whole-material context in evidence identity. | P2 investigation. Title/source/attribution may affect interpretation; test unchanged blocks and true context changes separately. | #128 and cumulative downstream PRs. |
| Image/file reprocessing | `image-processing.ts` and file artifact identities can invalidate at capture scope. | P2. Compare complete artifact payload/context, protect citations and original access, reject late results. | M06 #133, Memory #136. |
| Source descriptions/attribution | `source-context.ts` and Material declarations are versioned exact text/context. | KEEP strict equality for now. Meaningful context changes must revoke old semantic results under accepted ADRs. Model equivalence is future work. | Source/context consumer migration. |

PR #143 (appearance, main), #142 (container acceptance, integration), and #144
(QR pairing, integration) do not change `lark-documents.ts`. Open-PR file lists
include stacked cumulative changes; overlap is not proof of duplicate ownership.
No multiuser WIP was included, merged or deployed. Recommended base for independent
fixes is main; integration owners should port the isolated commits after review.

## Lark supersession and validation

- KEEP: stable account/document identity, scope and authorization fences, immutable
  source versions, complete Markdown bytes, title/URI/document context, body hash
  for original-file documents, A → B → A behavior, deletion and paid-work rules.
- CHANGE: supplier `originalMetadata.revisionId` alone no longer creates a new
  evidence revision when all other compared fields are identical.
- REMOVE: equating supplier revision advancement with exported content change.
- EXCEPTION: preserve the original revision's entire document metadata on an equal
  replay. Reusing an ID while substituting the new supplier counter would violate
  SourceStore's immutable-content hash and cause a 409. New content records the
  newly observed supplier counter. This does not create a second transport archive.
- UNKNOWN: real-provider behavior, model quality, and broader history/Memory fixes
  are not proved by these generated fixtures.

Regression evidence and check results are recorded with the PR. The generated
storage regression first failed on a counter-only change, then passed after the
minimal comparison fix. Production connector tests cover small snapshots and large
original-file documents, connector restart, duplicate ACKs, complete changed bytes
and genuine corrections. Separate storage restart tests cover immutable history and
absence of supersede events. No live model, real account, deployment or merge is
part of this change.
