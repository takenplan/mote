# Joint validation decisions and provenance

This is a preparation decision log, not a new product ADR. Governing decisions
remain the [original multi-user ADR](../adr-multiuser-scope.md), original domain
ADRs, [module contract](multiuser-modules.md) and PR135
[public mechanisms](multiuser-public-contracts.md). Executable scope and evidence
are in the [joint acceptance matrix](../validation/multiuser-joint-validation.md).

| Decision | Basis | Impact / verification |
| --- | --- | --- |
| KEEP shared SQLite, services, one executor | Original ADR and PR135; explicit handoff | No per-user runtime/database, new coordinator or general authorization framework. Existing real production fixtures are reused. |
| KEEP original user outcomes through new scoped entry points | AGENTS supersession protocol; module contract and domain parity ledgers | Route changes are allowed, capability removal is not silently accepted. Missing Imports/Files/Memory/connector/settings/client behavior stays a blocker. |
| CHANGE integration location only | User forbids remote main/integration changes and touching the original dirty workspace | Compose exact freezes in own `codex/mote-multiuser-joint-validation`; remote branches remain6272. No deployment or CI enablement. |
| KEEP separate evidence provenance | PR135 requires exact version/entry/exit and real lifecycle ordering | M16 execution at107 is historical shared evidence; new independent probes/final candidate results get their own receipts. Documentation-only deliveries do not trigger redundant full gates. |
| KEEP native recovery and Docker recovery as distinct requirements | Original backup/recovery capability, M16 explicit limits and source guard | Native compiled/package pass does not close epoch5 Docker refusal or actual Hindsight volume recovery. Source guard and daemon availability are independently checked; no silent exclusion. |
| EXCEPTION legacy algorithm fixtures only | Original ADR's explicit test-only boundary | Useful characterization; cannot substitute for scope, final production composition, renderer/native/worker or restored package proof. |
| REMOVE completion inference from checkpoint or test totals | Explicit handoff and AGENTS | M13/M14/M15 remain WIP; final gate waits for all freezes and retained capabilities. All named final rows initially pending. |
| UNKNOWN actual platform/provider/deployment behavior | Explicit no real I/O/system-permission constraints and existing validation limits | No system permission change/live provider write. Unrun physical/device/permission/Docker tests stay explicit; authorization is not inferred from fixture results. |
| CHANGE Files adaptation inside M06 only | Original recording, correction and confirmed-speaker ADRs; actual old HTTP consumers | M03 originals, M06 artifacts/publications and M05 remain authoritative. A small owner-bound annotation journal retains raw evidence and confirmation provenance; no second FileStore, scheduler or model execution path. Exact-A/B, tar, M16 merge/delete/backup/restore are narrow candidate probes. |
| KEEP archive evidence distinct from current execution evidence | Actual older personal archive merge failed after a legitimate speaker/Material update; M07 retained-history requirement | Reuse the canonical Material projection in a restore-only method. Validate retained identity/body/hash, keep live readers/admission current-only, reject old pinned execution, and verify fresh current owner execution remains possible. |
| UNKNOWN canonical QR pairing equivalence | M13/M15 report old invitation redemption consumers but no frozen scoped equivalent | Existing M01 PKCE approval/poll/ACK is evidence for that flow only. Do not invent a QR payload, restore an owner alias, or count username login/MCP authorization QR as device pairing equivalence. Resolve against M01's original contract/ADR. |

No new domain policy, semantic heuristic, quota, automatic migration, data reset,
shared secret exposure or user-facing approval step is proposed here. Technical
choices reuse the current tools and tests. If closing a retained capability needs
an architectural change, provide the parent a concrete minimal proposal and its
effect before treating it as accepted scope.

## Later explicit model/data regression constraint

User amendment `Sentinel_90402956f4b881918763a8a61d350969` authorizes real-model
regression through this computer’s signed-in Codex “GPE 6.1 sol”; the parent
interprets the intended name as GPT-6.1 sol. Verify actual availability and its
exact interface before running; do not substitute a model/provider, add secrets,
or restart the coding session to satisfy a regression-model choice. Deterministic
generated transport tests retain their role in account/fence/retry assertions.
This supersedes the initial prohibition on all real-model checks only for that
explicit local-model regression scope; real calendar/mail writes remain excluded.

Prefer generated fixtures. If necessary, local Central content may be read only
and copied outside the repository for isolated tests. Its original contents and
all derived materials (including prompts, responses, summaries, embeddings,
screenshots, archives, logs and fixtures) are forbidden in Git operations, PR
content, shared logs/attachments and cross-thread messages. Check staged diffs
and every new file before publishing; do not rely only on ignore rules. If an
accidental Git inclusion is found, stop push and report to the parent, preserving
history until directed. Joint has not read local Central private content and its
current fixtures are entirely generated. J14 now has M15 owner-reported generated Native Ask evidence on exact local
`gpt-6.1-sol`; final composed execution and the privacy audit remain pending.


## Shared Imports restoration inside existing domains

KEEP: original upload/part/commit and inline request bodies, stable same-input
source identity, private preview and explicit review gate, real format workers,
trusted pinned Python pack sandbox, original dedup/retention, and one M05 executor.
CHANGE: route the old outcome through M03 archived originals plus M06's private
journal, with M04 model leases and current-account task grants. M03's host-only
expanded-original retention is absent from user/plugin facades; no current task
context is minted from stored JSON. Capture receipt, attribution/link/checkpoint
and no-model child admission share one SQLite commit for a fresh publication.
REMOVE: the single-owner ImportJobs/Store composition from production scoped
routes. Its review rule is extracted unchanged into a pure helper; legacy fixtures
continue to exercise their own old algorithms.
EXCEPTION: deterministic plain decoding, known media intake and fixed source packs
need no language-model lease. Semantic mapping uses only authorized job originals
through the read-only reader; bounded host preview fragments reuse the existing
host-control transport and task checkpoint without publishing domain products.
UNKNOWN: image profile/attachment equivalence, full partial-recovery/unknown-result
and Memory recipe progress, deletion reclamation and remaining Files controls are
still acceptance blockers. No success is inferred from a partial route adapter.
