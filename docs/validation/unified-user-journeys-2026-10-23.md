# Unified user journeys: implementation record

Status: implementation-complete with the named focused/consumer evidence below; final candidate qualification and delivery remain pending.

## Baseline and authorization

- Owner accepted architecture and authorized ADR, vertical refactoring, late E2E,
  PR and new Dev builds on 2026-10-23. Engineering details delegated.
- Source baseline: `81a73c0ec81af876d6eeef71451b75cd51684b34` (`origin/main`, fetched).
- Isolated branch: `codex/unified-user-journeys`; managed worktree used because
  original `codex/task-execution-policy` checkout has extensive unrelated changes.
- Original checkout and running user profiles are not implementation targets.
- Detailed local work records/logs: `/tmp/mote-unified-work-20261023/`; important
  decisions/results are summarized here before delivery.

## Work allocation and validation gates

| Work | Owner/model | Current state |
| --- | --- | --- |
| ADR, contracts, integration, operation authorization | Primary agent | Operation authority and real configuration seam: 5/5 passed; current import consumer passed in stable selected run |
| Configuration → automation → worker/status | GPT-6.1 Sol, extra-high reasoning | Configuration and automation consumers passed, including original five-case Insight/working lifecycle file; final qualification pending |
| Intake → evidence → Memory/Ask | GPT-6.1 Sol, extra-high reasoning | Memory publication, raw-source projection and original Ask consumers passed; final qualification pending |
| Capture → receipt → queue | GPT-6.1 Sol, high reasoning | Implementation-complete; 70 new/focused + 12 selected existing tests passed; production integration pending |
| Configuration → admitted file processing | GPT-6.1 Sol, high reasoning | Host/lifetime 19, settings/portable consumers and pending-Memory image/history consumers passed; final qualification pending |
| Independent architecture review | GPT-6.1 Sol, high reasoning | Prospective plans approved; changed-path and final three-delta source reviews passed; execution qualification remains separate |
| Release/validation inventory | GPT-6 Luna, high reasoning | Read-only plan completed; Dev is SHA-based artifact, separate from tagged Prod release |

## Progress

1. Fetched main, preserved original dirty checkout, created attached worktree and
   branch. Installed worktree dependencies with `npm ci --ignore-scripts`; success.
   Existing dependency audit reports vulnerabilities; no unrelated dependency
   upgrades were performed.
2. Recorded architecture, explicit journey contracts, supersession and staged
   validation in ADR and testing document before implementation batches.
3. Read the newer clean-main development protocol and obtained independent
   prospective approvals for configuration, evidence, transport and operation
   plans. An incomplete ConfigService draft preceded discovery of the new rule;
   it is not represented as prospectively approved. Subsequent batches used the
   approved plans. Connector task snapshot version 2 has its own delta approval.
4. First focused configuration driver stopped in environment preflight: native
   better-sqlite3 had not been built after `npm ci --ignore-scripts`. Rebuilt
   better-sqlite3, esbuild and Electron; subsequent preflight/builds passed.
   Host Node is 26.11.1 (ABI 147); this is not CI Node 24 parity evidence.
5. Early configuration coordination/task rollback seam: 3/3 passed. Evidence
   projection + actual PrivateData/Ask seam: 4/4 passed. Memory intake/repository
   seam: 5/5 passed. Decoder/intake selected modules: 6/6 passed. Repeated and
   overlapping runs are not added into a unique total.
6. Desktop completed typed pause/conflict handling and per-subrequest durable ACK
   settlement. Latest focused five-file run: 70/70 passed; four selected existing
   consumer files: 12/12 passed. Desktop typecheck passed. Generated fixtures and
   mocked HTTP only, no actual capture or physical-device evidence.
7. Operation authority initially passed 3/3. Independent review found the accepted
   operation could wait on failed session initialization. Fixed using explicit
   readiness and an independent schema-only reader. Two real Configurations
   seams prove retained watcher/subject, zero effects, no existing-file mutation,
   pending initialization plus logout, and uncached export. Latest 5/5 passed.
8. Combined selected production-consumer checkpoint (not E2E): 10/13 passed.
   Configuration 3/5 passed; two connector fixture requests rejected before the
   tested path (invalid operation identifier). Evidence 2/3 passed; actual Memory
   consumer exposed a context-evidence restriction requiring investigation.
   Both failures remain recorded and owned; no assertions were weakened.
   Receipt: `2026-10-22T18-02-36-519Z-eab729ae-b3cd-4a91-97cb-2908f49b074c.json`.
9. Web automation intent helper: 3/3 passed; Web typecheck passed. Diagnostics now
   links to the existing instance settings instead of claiming editing is absent.
   No browser interaction validation has run yet.

10. Expanded evidence module/seam checks: 13/13 passed, including nested Material
    source/time lineage, calendar windows, assets, trusted UI lexical/vector/read
    parity and current source/privacy fences. Decoder/intake selected checks:
    9/9 passed, including serialized receipt restart and missing/broadened target
    rejection. These runs overlap prior suites; counts are not cumulative.
11. Six-file selected current-entry checkpoint observed 36/39 pass, 3 failures,
    but the driver correctly invalidated the candidate because a final test/docs
    write overlapped its start before the start notice reached that owner. No
    candidate-pass claim or receipt reuse is made. Fixture repairs concern actual
    external issued state and the last-administrator protection; Memory observation
    requires checking the actual completed control-task versus intake state.
    Receipt: `2026-10-22T18-19-45-248Z-d7c3877d-1111-4052-92db-b69c8a743328.json`.
    Future runs start only after every writer's explicit stable acknowledgment.
12. Review found processing/perception file reload has the same configuring-session
    lifetime defect. A separate bounded prospective plan is being prepared by the
    Sol High transport owner after its Desktop handoff. Existing processing recheck
    authority will not be broadened casually; unknown physical effects and completed
    outputs must remain protected. This chain is not yet implemented or verified.
13. Live release inventory: both general GitHub check workflows are disabled;
    component release workflows are active. The `release` Environment only allows
    component/version tags, which prevents branch Desktop Dev packaging. No policy
    was changed. Central Dev has no such environment gate; Desktop local Dev
    packaging is available. Final artifact route/result remains pending.
14. Stable six-file current-entry checkpoint: **40/40 passed**, exit 0, no skipped
    or cancelled cases and no input drift. Configuration 6, coordination 5,
    operation authority 5, Memory observations 2, portable import 15, unified
    evidence 7 (including two strategy subcases). Exact log:
    `selected-consumers-03.log`; receipt:
    `2026-10-22T18-28-08-862Z-084b09c0-3ef3-4f2c-bf4c-9d39ee611dab.json`.
    The prior Memory observation failure was a real missing-model classification
    defect: automatic intake now reports `waiting/memory_model_required`, preserves
    its receipt and resumes the same task after model configuration. The consumer
    test controls the advertised retry time; it does not relax its success criteria.
15. Primary independently approved the processing lifetime plan before its product
    edits: SHA-256 `f4b5beaa3a4575d9d988694fdfdf73163438a158005530cc12d1ede69cc4cba1`,
    baseline above plus nine verified source hashes. Configuration publication may
    derive a fixed handoff only from genuine unfinished original intent, with
    account/source/incarnation, current receipt, physical cleanup and unknown-effect
    fences. It cannot create owner permission from YAML or replay completed work.
    Implementation and focused qualification remain pending.

16. Processing authority and configuration seams stabilized: **13/13 passed**
    (five fixed task-host cases, seven coordination cases, one actual Ask enable
    transaction case), valid receipt
    `2026-10-22T18-40-22-778Z-e7aea0c5-ecbb-4407-aef1-5a30ef6b0cac.json`.
    Two earlier focused attempts retained the same strict input-identity failure;
    canonicalizing the actual input before both persisted representations fixed it.
    No identity assertion was relaxed. Per-original processing relevance delta
    `b9c790db30b9636836cf7187a3b932a6f91d1fd96c8ab4e8d5379b41259c551e`
    was prospectively approved before domain wiring, so unrelated configuration
    edits cannot cancel or invalidate another original's work.
17. Memory disable/drain and common source presentation delta
    `db9126692dd8690f58e980e20e0a7793e99039ba2aa74d743ac4b409cce57e52`
    was prospectively approved against eleven matching source hashes. Implementation
    is underway; the passed earlier checkpoint does not qualify this new delta.
    Ask fresh-enable delta
    `6de4555c4c96ef8f75a75116e27d26747bf478071a286f53d984292c4c1a24c7`
    passed its actual transaction seam; independent readback requested an additional
    mismatched-coordinator-link guard before closure.
18. Added assertions to existing hidden browser fixtures without changing their
    production entry points, deadlines or prior assertions. Both scripts passed
    JavaScript syntax checks only; actual browser/E2E execution remains deliberately
    deferred. Local links in the three new ADR/testing/validation documents resolve.

19. Next stable six-file checkpoint: **37/37 passed**, exit 0, no skipped
    cases or input drift. Coordination 8, Ask re-enable 1, operation authority 6,
    evidence projection/intake seams 16 and actual Memory disable/consolidation
    consumers 6. Receipt:
    `2026-10-22T18-48-20-090Z-f51026da-dc9b-47e8-948c-bb6165ab5a80.json`;
    log `configuration-memory-seams-01.log`.
    This includes the new no-file/no-directory operation export regression and
    same-owner mismatched Ask coordinator protection. Earlier receipts remain
    historical evidence; totals overlap and must not be added together.
20. Independent configuration-owner review of the operation default-read delta
    required skipping bootstrap directory creation as well as initial-file persist.
    Approved amended plan
    `f2877da6d3df0bdba37b3bb996966d2dcf73d1810ffd7e2af7b583aa0d725298`
    before root implementation. Normal runtime initialization still persists its
    initial document; the private ephemeral operation reader creates neither user
    directory nor YAML. The new sixth operation case passed in checkpoint 19.
    Configuration resource rollback now follows actual apply order; a failing
    ordering regression passed after the correction, preserving published reverse
    rollback order and all-sibling cleanup.

21. Existing Actions and connector consumer checkpoint ran 17 cases with stable
    inputs: 14 passed, 3 Actions fixture failures. Connector polling (9) and
    Actions admission (3) passed. The new immediate Memory path exposed fixture
    barriers/counts that included unrelated model calls; scope them to the actual
    calendar stage and exact native operation without weakening assertions.
    Receipt: `2026-10-22T18-52-54-512Z-b9d12079-ce48-4bac-87ff-b5e2c99d768e`.
22. The corrected Actions replay file passed 4/5. Ordinary disable/timezone drain
    and unknown native issuance preservation passed. The remaining negative retry
    fixture did not actually hold host physical cleanup after cancellation; real
    model transport honored abort. A bounded exact callback cleanup barrier is
    under repair, retaining physical-active, retry-409, journal immutability and
    same-unit recovery assertions. This is not a passing consumer checkpoint.
    Receipt: `2026-10-22T18-57-32-956Z-672a64ea-c94c-4d72-a10d-6e5b1a3c65ed`.
23. Final focused evidence proof passed **29/29** across four selected files with
    stable inputs and confirmed cleanup. It includes actual nonempty independently
    reviewed Memory publication after ordinary disable/pause, all three cutoff
    flags, exact frozen consolidation membership, model-prerequisite recovery on
    the same admitted task, source projection, import and source-withdrawal fences.
    Receipt: `2026-10-22T18-59-28-968Z-dfe8203b-b281-4fda-9d75-fa5287227168`.
    The evidence owner handed off; final candidate validation remains pending.
24. The first processing host/domain checkpoint passed **7/10**: rollback proved
    atomic restoration and zero local abort, but shared ancestry convergence,
    watched YAML after logout and per-original policy fixtures need investigation.
    Keep these failures visible before widening tests. Additional new-handoff
    image, physical cleanup/unknown, restart and lifecycle cases remain pending.
    Independent Sol High review of final deltas is now running read-only.
    Receipt: `2026-10-22T19-01-08-793Z-d1d71176-d6f5-406f-af37-62084f58c08e`.

25. The Actions replay file now passed **5/5** with stable inputs. The generated
    uncooperative cleanup fixture wraps the exact active model callback, retains
    real Harness execution and waits for its actual physical receipt to become
    quiescent. All retry-409, immutable journal and same-unit recovery assertions
    remain, alongside ordinary-disable drain and unknown native-call preservation.
    Receipt: `2026-10-22T19-03-57-896Z-81f7eb98-69da-4e4a-b266-5171fed8f9eb`.
26. Correcting processing fixture controls (valid timeout value, supported named
    file policy and a real unavailable admission gate) produced **10/10 PASS**.
    This establishes watched reload after logout, relevant per-original updates,
    atomic rollback and shared ancestry convergence at that checkpoint.
    Receipt: `2026-10-22T19-06-16-475Z-463b5e78-258a-47e8-82c5-be1dbf417a85`.
27. Independent final-delta review identified four additional cases: stale target
    facts after a newer manual processing admission; obsolete task authority
    blocking a current configuration save; duplicate version reservations across
    frozen Memory windows; and public Ask policies colliding with reserved built-in
    IDs. Each has a bounded repair and regression. Root owns Ask identity; the
    original evidence and processing owners retain their chains. The review and
    prospective approvals are recorded outside Git in the working audit directory.
28. The corrected three-file Ask/Memory baseline ran **5/7 PASS**, with both Memory
    failures expected and now reaching the actual duplicate-admission assertions.
    All four Ask cases passed, including public reserved-ID rejection before writes,
    exact persisted definition checks, custom scope/timezone preservation, failed
    publication rollback with zero local abort, and existing fresh-policy recovery.
    Receipt: `2026-10-22T19-17-45-530Z-16eb770a-abe4-4f0f-8b82-37d691b956fe`.
    The preceding run failed three Ask fixture controls and one ordering assertion;
    those controls were corrected without reducing behavior or coverage. Memory
    reservation repair was approved before product edits; this baseline is not a
    passing combined checkpoint.
29. The expanded processing host/domain gate passed **17/17** with stable inputs.
    It covers an issued configuration descendant surviving unrelated policy edits,
    waiting for actual physical cleanup, retaining unknown-call fences, manual
    supersession and return to prior desired settings, image-plan preservation
    versus explicit policy rebinding, and independent handling of revoked grants
    and old account epochs. Receipt:
    `2026-10-22T19-18-36-832Z-d0048b65-7a0e-4dd4-a9ea-277cee768287`.
    Current backup inventory and pending-restart checks remain pending. The four
    new processing tables must be required by stopped-backup validation; a missing
    authority journal cannot silently become an empty table at startup.

30. The Memory reservation module passed **6/6** after the prospective repair,
    preserving due-time admission, exact continuation ownership and atomic conflict
    rejection. The combined two-file module gate passed **29/30**; the backup
    installer-catalog fixture lacked its real PrivateData/Ingress prerequisites.
    All 22 missing-table/column rejection subcases and the positive utility case
    passed. This is a fixture repair in progress, not a passing backup checkpoint.
    Receipt: `2026-10-22T19-26-24-260Z-a8272d74-3435-412e-91ed-d02fad7e44f4`;
    stable inputs and cleanup confirmed. The actual two-window publication consumer
    remains pending. Two raw SQL callback reads found by the scope checker are
    being moved behind the already-approved opaque domain subject and PrivateSql
    boundary; no checker exception is being introduced.

31. Backup prerequisites were corrected without changing assertions. The two-file
    module checkpoint passed **26/26**: backup catalog/utility 24 and guarded
    Actions/Ask wakeups 2. Receipt:
    `2026-10-22T19-31-09-884Z-80f323ce-9801-4830-982d-3ee7b21e253b`.
    The scope inventory and production SQL boundary checker also passed without
    new exceptions. Wakeups use the registered account guard and require the exact
    task kind, owner, policy identity, generation and current authority.
32. Processing host/lifetime checks passed **19/19**. The two additional cases
    exercise pending handoff restart, rapid watched reload after logout, source
    retirement and account disable/re-enable without reviving old authority.
    Receipt: `2026-10-22T19-33-46-518Z-50d9ae26-f211-4b60-8463-5bd6a8eee06a`.
    Independent review approved two existing consumer synchronization waits for
    actual replacement admission under the new durable handoff. Their original
    deadlines and positive/negative assertions remain unchanged; execution pending.
33. Further Memory inspection found a valid continuation could lose ancestor
    ownership when a revoked/version-changed member shrank its pending cohort.
    The new ten-case module baseline reproduced this: **9/10 PASS**, one expected
    failure (two admissions instead of three), with malformed/reordered/widened
    scope negatives passing. Receipt:
    `2026-10-22T19-35-39-173Z-baeed1c8-6633-4520-a57a-7996f16c26a2`.
    Root prospectively approved the bounded ordered exact-pin subset correction,
    retaining the full original remainder's deterministic child identity and all
    account, metadata, currentness and transaction fences. Correction and actual
    multi-window publication consumer qualification remain pending.

34. The corrected reservation module passed **10/10** with stable inputs and
    confirmed cleanup. Legal scope shrink retains the valid grandchild; reordered,
    widened, duplicated, unrelated and malformed ancestry remains rejected.
    Receipt: `2026-10-22T19-38-02-789Z-d57ec5ef-3e78-4aa1-9db6-f6098565bef8`.
    Independent Sol High changed-path review found no remaining source blocker
    in the repaired reservation, processing, Ask identity, guarded wakeup and
    backup inventory changes. This is source review, not final qualification:
    named actual consumers, nonempty processing portable lifecycle, stopped CLI
    restore, affected checks, generated E2E and Dev artifacts remain pending.

35. The seven-file named production-consumer gate completed **51 cases: 47 passed,
    3 failed and 1 timed out/cancelled**, with stable inputs and confirmed cleanup.
    Receipt: `2026-10-22T19-41-23-613Z-7648dff0-02f6-44d4-8838-72c13a022651`.
    All 13 Memory integration cases passed, including natural overlapping windows,
    a held independent reviewer, exact continuation, stop and restart. Processing
    settings-change 3 and nonempty portable lifecycle 1 also passed. The latter
    proves targets/handoffs are omitted from portable authority, purged through
    actual domain hooks, and cannot revive through metadata restore; B is unchanged.
    Failures are assigned to their original owners: raw note search loses a trusted
    ingress source binding; mixed Material span presentation disagrees with an
    existing assertion; a periodic Insight case times out; and one image history
    case has an empty jobs projection. Diagnosis precedes any assertion or source
    change. Full affected checks and E2E have not started.

36. Separate diagnosis retained the original consumer entry points, assertions and
    deadlines. Perception completed **5/6 PASS** (receipt
    `2026-10-22T19-48-03-592Z-7a05587f-8f0f-45a1-85d8-e80cd4476026`):
    a reserved Memory job identity was mistaken for an admitted job, causing valid
    image details to return 404 while intake waited for a model. Ask completed
    **4 PASS, 1 timeout/cancelled** (receipt
    `2026-10-22T19-51-14-601Z-7ff7bf01-fcfc-45cf-8d8f-b3bfddd120a3`).
    Read-only diagnostics disproved the extra-policy hypothesis: the three intended
    policies had no candidates because policy kind `insights` leaked into the
    evidence-kind filter. No assertion or timeout was relaxed.
37. Root independently approved three bounded corrections before implementation:
    trusted raw source bindings shared by SQL/JS/member projection; Memory-owned
    intake progress consumed by images; and explicit time/device range arguments
    at the two Ask automation call sites. Source review found no remaining blocker
    after separating host-only fields from presentation, denying missing stored
    bindings, and preserving nonpending receipt state. This is source conformity,
    not an execution qualification claim.
38. The first three-file finite gate completed **13 cases: 12 PASS, 1 FAIL** with
    stable inputs and confirmed cleanup. Receipt:
    `2026-10-22T20-04-54-226Z-fc36b33b-2acc-4045-a82f-f3b3833f6cec`.
    The real Ask observation regression and all six Memory progress cases passed.
    The new raw-source seam passed lexical, snapshot and exact-read checks before
    its vector assertion failed: its generated embedding used a dummy anchor hash
    instead of the actual immutable capture fingerprint. The fixture pin is being
    corrected; the vector guard and expected result remain unchanged. The image
    seam and the three previously failing consumer files remain pending.

39. The corrected evidence seam and generated image-to-Memory observation seam
    passed **7/7** with stable inputs and confirmed cleanup. Receipt:
    `2026-10-22T20-07-28-030Z-056a294e-eded-458f-b349-5a4141cced4a`.
    Raw lexical/vector/snapshot/exact reads agree on the trusted binding; missing
    binding, later privacy/source withdrawal and internal-field leakage are denied.
    The actual image/perception routes retain completed OCR while displaying
    `memory_model_required`, with no new task or model call and no B disclosure.
    The three previously failing consumer files are the next gate.

40. The exact three previously failing consumer files passed **23/23** with
    stable inputs and confirmed cleanup. Receipt:
    `2026-10-22T20-09-50-313Z-b9508c4c-d6f4-4ed0-bca9-48686cbe4926`.
    Ask03 has 12 cases, the original Ask lifecycle file has 5, and Perception
    history has 6. The Insight case took 64.66 seconds, preserving its natural
    61-second wait, original 120-second ceiling and all final outcomes. The typed
    Material case now distinguishes single-member spans from a true mixed-member
    block and checks unchanged canonical JSON/fingerprints. All planned bounded
    repairs are implementation-complete; root now owns one frozen final affected
    plan and the named current-entry E2E checks before PR and Dev delivery.

## Audit issue coverage ledger

This ledger tracks the original audit scope; implementation is not a final
qualification claim. See the checkpoint evidence above and pending stages below.

| Issues | Shared implementation | Current evidence / gap |
| --- | --- | --- |
| R01–R04 | Configuration CAS, intent coordination, connector task snapshots and visible automation controls | Module checks and selected real configuration consumers passed; remaining existing consumer and browser checks pending |
| R05 | Stage-specific Actions prerequisites and explicit waiting status | Module/selected consumer checks passed; broader Actions consumer qualification pending |
| R06–R07 | New-target Memory authorization, separate history and immediate ready intake | Module and actual intake/observation plus disable/drain consumers passed; final review and remaining consumer qualification pending |
| R08–R10 | Shared source, typed time, lineage and eligible evidence projection | Module, actual reader and Memory consumers passed, including common source presentation across devices; final qualification pending |
| R11–R12 | Import incarnation, tombstones, deterministic decoding and explicit unsupported outcome | Decoder/identity checks and current portable consumers passed; final compiled import journey pending |
| R13–R14 | Shared Desktop outcomes and per-subrequest durable receipt delivery | Focused mock-HTTP checks passed; actual Central consumer pending |
| R15 | Accepted import operation authority | Module, real configuration seam and actual portable import/logout consumers passed |
| R16 | Diagnostics links to existing instance settings | Source correction complete; browser interaction pending |

The audit's unmeasured capacity/export and cross-domain reuse risks are not
represented as proven failures or resolved performance work. Matching-contract
reuse remains permitted; this phase introduces no universal semantic cache.
Legacy builder retirement remains a separate scenario-transfer task, as the ADR
states. Neither legacy tests nor passing fixture checks establish live-model or
physical-device behavior.

## Validation / remaining work

Final affected checks, current-entry generated E2E, PR, Dev workflows and artifact
inspection remain pending. Physical-device and
live-model checks are not performed and must not be inferred from fixture tests.
