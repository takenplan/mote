# Unified user journeys: implementation record

Status at checkpoint 50: implementation-complete; full local affected qualification passed. Standalone generated E2E and delivery follow this checkpoint. See the final PR and retained delivery record for their later outcomes.

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
| Configuration → automation → worker/status | GPT-6.1 Sol, extra-high reasoning | Configuration and automation consumers passed, including original five-case Insight/working lifecycle file; complete affected qualification passed; standalone E2E follows |
| Intake → evidence → Memory/Ask | GPT-6.1 Sol, extra-high reasoning | Memory publication, raw-source projection and original Ask consumers passed; complete affected qualification passed; standalone E2E follows |
| Capture → receipt → queue | GPT-6.1 Sol, high reasoning | Implementation-complete; 70 new/focused + 12 selected existing tests passed; actual Central consumer and complete affected qualification passed |
| Configuration → admitted file processing | GPT-6.1 Sol, high reasoning | Host/lifetime 19, settings/portable consumers and pending-Memory image/history consumers passed; complete affected qualification passed; standalone E2E follows |
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

41. The first frozen full affected invocation stopped before the Server groups:
    `2026-10-22T20-15-00-859Z-ae49fbdc-5557-4f3a-a861-419ea356e79a`.
    Preflight/build checks completed, but Desktop's existing native-host fixture
    compiled Desktop during its suite, changing previously absent/stale `dist`
    inputs. The driver correctly invalidated Desktop evidence and stopped with
    `check_inputs_changed`; later groups are **UNRUN**. Cleanup was confirmed.
    Desktop diagnostics also exposed one strict mock-argument mismatch: an existing
    storage failure log includes sanitized `{detail: 'Error'}` metadata. Root
    prospectively approved the exact three-argument assertion, retaining corrupt
    image inputs, both positions, no-network, queue, attempt and deadline checks.
    No production code or input guard changed. After explicit Desktop compilation,
    the two targeted cases passed with matching before/after task identities;
    the other 60 cases in that file were intentionally not selected. A resumed
    full affected invocation will reuse only eligible original passed-task receipts.


42. The resumed frozen affected run on `ddbe596e17a619df8c893464b070646e0827fae6`
    completed with **FAILED** status and confirmed cleanup:
    `2026-10-22T20-23-50-786Z-daf415e7-69cb-43d8-a889-4ca0076c8140`.
    Every guarded input remained stable. Desktop **685/685**, Shared,
    Diagnostics, release/root/backup/client/Central-runner checks and Android
    unit checks passed. Agent and script typecheck were **REUSED** from their
    eligible original receipts. Server groups 1, 5 and 10 passed; the other
    Server groups and Web failed, with **80 Server and 1 Web reported failing
    cases**. These counts describe test outcomes, not distinct production bugs.
    The required 1,000-original background import and 400-day Memory workloads
    passed without reducing scale or changing deadlines.

    Reviewed production repairs address stale account-epoch configuration cache
    eligibility, contradictory processing deletion authority, lightweight typed
    time projection, decoder dispositions, Memory-owned missing-model progress,
    and redacted raw screen content promotion through formal Materials. The
    privacy correction retains typed UI selected text and metadata-only activity,
    and blocks existing unsafe evidence as well as future organizer production.
    Reviewed fixture corrections preserve complete journeys while replacing old
    count-window assumptions, global cross-domain call counts and observation
    gates placed after their task has already retired. Explicitly deleted import
    requests must remain tombstoned; unseen private preview history must still
    restore through real portable import and require fresh owner confirmation.

    Unknown account-deletion/retention settlement and selected model-target
    failures remain diagnostic work. Exact failed cases, prospective approvals,
    unchanged-input hashes and staged drafts are recorded in the local work log.
    Root resumed module-only validation first; consumer corrections and diagnostic
    fixtures remain held until the relevant module proof. No final E2E, PR or Dev
    artifact is claimed by this checkpoint.

43. After the reviewed production repairs, the module ladder completed with
    stable inputs and confirmed cleanup. Authority and processing deletion
    checks passed **17/17** (`2026-10-22T21-22-14-785Z-39628b7f-4217-4aef-af50-4524a35ce840`).
    Evidence projection, typed metadata and privacy checks passed **14/15**;
    the sole failure was a newly added fixture using noncanonical Material IDs
    before reaching its projection assertion. Correcting those IDs retained
    explicit hidden-before-visible ordering and the transitive before-LIMIT
    assertions. The next module run passed **13/13**, covering both SQL privacy
    cases, four document-ingestion cases and seven Memory progress cases
    (`2026-10-22T21-29-37-897Z-f068a9c4-d1d8-4aae-a8a0-981d516fad66`).
    The previous evidence receipt is
    `2026-10-22T21-23-30-744Z-69fb9873-76cb-4bdd-bc9f-0a249eac05cd`.
    Server compilation also passed. Named user-entry consumers and diagnostic
    fixtures are the next stage; these module results do not supersede the
    incomplete full-candidate qualification.

44. Named consumer checks now confirm the epoch and privacy repairs through
    actual HTTP ingress, Memory extraction/review, Ask history/followups and
    real portable/stopped archive paths: **18/18** passed with stable inputs and
    cleanup (`2026-10-22T21-34-26-903Z-b8dcc825-14c5-43bb-9de9-9ff8fb6a9d7c`).
    Seven unchanged typed-evidence consumer files passed **57/58**
    (`2026-10-22T21-36-33-345Z-e68124f6-8150-46de-9003-790574cf3e19`);
    the daily-event case progressed past its original model error and exposed
    a later event-count assertion, still under investigation.

    Processing diagnostic consumers passed **6/9**
    (`2026-10-22T21-31-57-110Z-3669b60f-9732-498d-adfc-dd98ac9aa0d0`).
    Actual traces establish that the old recheck retires during real dependency
    refresh while its linked current replacement succeeds, and that unknown
    physical work blocks the current handoff before admitting a child. The
    third failure is a confirmed cleanup defect: an empty configuration-authority
    ledger was blocked by an independent unresolved external-effect fact after
    local physical cleanup. The bounded repair preserves that external fact and
    every nonempty-ledger fence; module proof precedes consumer reruns.

    Actions recovery/device/kind/lifecycle consumers passed **13/14**
    (`2026-10-22T21-32-48-600Z-ddbf7a79-176d-4234-b516-7ceedf4a48fa`).
    The remaining account-deletion fixture retries while a genuine independent
    read callback is still active. The approved correction observes that exact
    callback's cleanup before the existing single administrator retry, sharing
    the original final deadline. It preserves deletion during in-flight work,
    late unpublished native ACK, explicit administrator retry and all A/B erasure
    checks; it adds no automatic lifecycle continuation. All four receipts above
    have confirmed cleanup and stable guarded inputs. Remaining diagnostics,
    full qualification, final E2E and delivery are still pending.

45. The empty-configuration cleanup repair passed its expanded host module
    **11/11** (`2026-10-22T21-39-07-573Z-dfaea213-bcd3-4aa7-b824-ed873669e1b3`)
    and the next queued/incarnation/archive/Actions-lifecycle consumer group
    **12/12** (`2026-10-22T21-39-48-446Z-22617484-fc49-4234-b5f1-4fff67193e46`).
    Server compilation passed after the source correction. Daily-event HTTP
    validation passed **2/2** with the original seven positive inputs and an
    additional redacted-screen negative, preserving local-day recall, independent
    review, raw-read denial and restart replay checks
    (`2026-10-22T21-41-05-995Z-e96587d2-3834-4b09-a06f-2297a3db0b4f`).

    Actions fences/source metadata passed **18/18**
    (`2026-10-22T21-41-34-790Z-43e19dac-02f0-4cc3-a8f9-9299e0b2bf15`);
    legacy/context/Activity Memory cohorts passed **10/10**
    (`2026-10-22T21-42-38-062Z-b78c65f3-a945-425c-ba92-ec9435ea6fab`);
    Actions semantic/catalog and connector consumers passed **26/26**
    (`2026-10-22T21-46-58-020Z-51da8a80-94b1-4e5f-ab7d-7412f27c79aa`).
    The latter retain native issuance, real usage/physical bindings, cancellation,
    independent source revocation and encrypted current-format restart history.

    Processing consumers passed **26/31**, including all seven Ask authorization
    and twelve held/shared-change fence cases
    (`2026-10-22T21-45-04-334Z-13de4f07-7846-4cda-9f40-01472e68ffcf`).
    Five remaining failures use obsolete control/applied-state observations;
    approved exact target-to-handoff-to-replacement tests are landed for their
    twelve-case follow-up. The archive case now explicitly waits for the accepted
    asynchronous application instead of reading an immediately applied policy.

    Memory/MCP diagnostics passed **20/23**
    (`2026-10-22T21-43-33-948Z-6eac2b7c-ea89-4afb-b202-977e3256f24b`).
    The retained failures establish separate automatic/manual image jobs, six
    separately admitted Coding jobs instead of a queued cohort, and a generated
    MCP model incorrectly reporting context-only keys as extraction targets.
    Approved corrections retain the exact intended job/phase/pixel, clock and
    authorization assertions; their focused reruns remain pending. All receipts
    in this checkpoint have stable guarded inputs and confirmed cleanup. This
    remains staged integration evidence, not final qualification or delivery.

46. Subsequent exact consumers established additional staged evidence. The MCP
    target-coverage helper passed **3/3**, and its real SDK representative passed
    **3/3** inside the 14/15 boundary-consumer run
    (`2026-10-22T21-51-20-848Z-953d2f46-b664-4600-92f9-1494feb9419d`).
    Coding preparation then passed all twelve cases, including the original
    six-call cohort contract, within the 25/27 Memory/policy run
    (`2026-10-22T21-54-49-166Z-68f7573a-3873-49e2-bf60-fa0a0546122a`).

    A diagnostic-only 15/17 follow-up preserved every acceptance assertion and
    deadline (`2026-10-22T22-00-58-819Z-b8a02f74-6f2b-4a01-afd0-d9a18c55952e`).
    It confirmed two product defects: an image-backed published Memory was
    excluded because the shared projection expected an asset block in a
    text-only OCR Material; and an explicit, consented full retry canceled the
    pending configuration handoff but reused the old applied policy. Independent
    prospective reviews approved exact host image-anchor projection parity and
    atomic adoption of the current pending target during full retry. Both retain
    existing privacy, source, physical execution and unknown-outcome fences.
    Their new finite seams and complete consumer reruns remain pending here.

    Real Memory process recovery passed **5/5**, covering admission, independent
    review with SIGKILL/SIGTERM, feedback and owner-reply interruptions
    (`2026-10-22T22-02-44-801Z-f8ec7e71-f70b-4928-bd5f-10f647cb82c3`).
    The sixth, independent MCP process case failed because its generated model
    still emitted context-only keys as target coverage. Actual request and
    validation traces proved this separately; the reviewed correction reuses the
    qualified target-key helper without changing UUID/candidate selection,
    process lifecycle, deadlines or restart/no-replay assertions.

    The next import, import-to-Memory progress, lifecycle, review and named image
    recipe consumers passed **54 cases**, with one existing opt-in pinned Python
    Source Pack case skipped (`2026-10-22T22-04-53-403Z-f628d86b-f1c4-4b3b-b877-a569334fbb80`).
    These include stopped backup, unseen-history restore, durable publication
    checkpoints, missing-model resumption of the same receipt, account erasure,
    independent B data and actual original-image retention. All receipts in this
    checkpoint have stable guarded inputs and confirmed cleanup. No final
    candidate qualification, browser E2E, PR or Dev delivery is claimed yet.

47. The final boundary repairs passed their finite checks before consumer
    qualification. Explicit full retry passed its exact transaction seam **1/1**
    (`2026-10-22T22-10-22-693Z-52996c78-5784-4140-81bc-d28890327a9a`): a generated
    late SQL failure after admission rolled back binding, confirmation and task
    state; the same operation subsequently used the new provider once, remained
    idempotent and preserved the old unknown call and independent B data. Initial
    fixture syntax and expected-error-shape failures were corrected without
    changing acceptance. A trigger observer proves the injected late boundary
    was reached rather than accepting an unrelated generic failure.

    Exact image-anchor projection passed **3/3**
    (`2026-10-22T22-15-50-531Z-8cd1c18f-bd00-4bcb-9099-b2eb4f5feffd`), covering
    shared SQL/JS/page/vector source and time selection, partial named-artifact
    readiness, empty image interpretation, canonical text identity, missing image
    relations, owner isolation and direct/transitive privacy withdrawal. Initial
    fixture construction errors used invalid canonical Material IDs and omitted
    required evidence metadata; the correction retained every positive and
    negative assertion. An independent source review found the four image/retry
    source deltas consistent with their prospective approvals. Server compilation
    passed after these changes.

    The original real-entry consumers then passed **21/21**
    (`2026-10-22T22-16-41-306Z-bdb3888d-8ef0-4cff-aeea-193ad3af0f83`): independent
    automatic/manual image extraction and review retain all sixteen requests'
    owner/job/phase attribution, eight independent pixel-read proofs and published
    Memory visibility; explicit policy retry uses
    the accepted new plan while preserving unknown/physical fences; actual MCP
    listener/SDK work reaches SIGKILL/restart, credential revocation and exact
    no-model-replay assertions. The physical lifecycle consumer retains the
    still-held-call refusal through relogin and disable/enable. All receipts have
    stable guarded inputs and confirmed cleanup. These named journeys are
    integration-verified; the frozen candidate still requires the complete
    affected plan and final generated UI/recovery E2E before PR and Dev delivery.

48. Complete affected run 03 on `df56c19302b31bb06a64f7e92ce7fafe6b499c00`
    finished all 38 tasks with stable guarded inputs and confirmed cleanup
    (`2026-10-22T22-19-43-085Z-2acabd19-e820-4db6-80f3-65c3f100805c`). It failed
    scope preflight and seven Server cases across five groups; this candidate is
    **not qualified**. The remaining Server groups, Desktop, Web, builds and
    release/root/backup/client/startup checks passed. Agent, script typecheck,
    Diagnostics and shared tests were explicitly reused from eligible original
    receipts. Android's Gradle check succeeded with all 25 tasks up-to-date;
    these were cached unit outputs, not newly executed device checks.

    Original module owners investigated the failures read-only during the run.
    After independent prospective approval and formal driver completion, eight
    checker/fixture files changed; application source bytes did not change:

    - Declare only the two reviewed callers of the shared supplied-record privacy
      predicate, and reject runtime imports added to that exact stateless helper.
      This closes both scope preflight and its architecture regression case.
    - Keep canonical image discovery and synthetic image discovery as separate
      positives. The latter requires a host descriptor; a prefix alone cannot
      issue image authority. Missing and mismatched descriptors remain negatives.
    - Hold only A's independently admitted Material organizer in the finite retry
      transaction test. Keep all thirteen table snapshots strict, real queued
      task admission, late SQL failure, B progress, explicit new-plan retry,
      idempotence and the unchanged unknown-call journal.
    - Let the five exact real ingress organizers finish before measuring manual
      Todo side effects. Preserve the original global count assertion, add full
      task-identity comparison and absence of relevant processing artifacts,
      and retain all HTTP/CAS/privacy/restart assertions. The failed run did not
      record the four extra historical task IDs, so their exact identities remain
      unknown; no production Todo defect is claimed from that count alone.
    - Correct three content-producing raw-screen fixture inputs to be permitted
      screenshots. Typed selected UI remains a redacted positive. Preserve the
      full backfill, two-owner OCR/pixel readiness, failed-OCR explicit retry,
      recipe/call counts and original 20/25-second deadlines. Add a same-entry
      redacted backfill negative that retains the original and receipt journal
      while producing no Material or Memory work; current-host privacy negatives
      remain unchanged.

49. The repaired scope preflight passed. The first five-file finite gate passed
    **19/19** (`2026-10-22T22-57-51-836Z-84f09d92-1dbd-4b26-aff4-7157858a6898`):
    architecture, image projection and real image-anchor seam, backfill/privacy,
    and strict retry rollback. The next three-file consumer gate passed **30/30**
    (`2026-10-22T22-58-21-111Z-e7b07ac3-4304-421f-ad1e-e68356fc252e`), including
    all original Memory 02/03 cases and all ten Todo evidence cases. The Todo
    positive reached its real restart; both screenshot cases reached their actual
    prerequisite, retry, consumption and no-replay assertions. Both receipts have
    stable inputs and confirmed cleanup. Existing input scale and deadlines were
    retained. These checks close the observed local failures; the checker change
    conservatively invalidates broader receipts under the unchanged driver, so
    complete candidate qualification remains required before final E2E and delivery.

50. Final affected qualification completed at **2026-10-22 23:40:56 UTC** on
    `e14451065d89c75d3934a921e05215177f8e60ce`: **38/38 driver tasks passed**,
    exit 0, all guarded inputs stable and cleanup confirmed. Receipt:
    `2026-10-22T23-01-12-866Z-ef3982d5-aadb-46b7-b3f6-20d6fea831b7`.
    All tasks executed through the driver; none were reported `REUSED`. Coverage
    includes all sixteen Server groups (625 files), Agent, Desktop, Diagnostics,
    Shared, Web (**649/649**), builds/typechecks, i18n, scope/release contracts,
    release/root/backup/client/Central runner checks and Android unit check.
    Android Gradle reported all 25 actionable tasks `UP-TO-DATE`; this is a
    successful check of existing outputs, not newly executed device/unit cases.
    Full log and the original receipt are retained with the work record.

    The subsequent documentation-only checkpoint clarifies exact current-entry
    commands, distinguishes the two same-named portable-import tests, and records
    this result. It changes no application, test, dependency or build inputs.
    Standalone hidden browser and compiled attachment/export qualification follow
    this checkpoint on the frozen final documented candidate. Record their exact
    commit, outputs and cleanup in the final PR and retained delivery record; do
    not reinterpret this affected receipt as browser or release evidence.

51. Standalone current-entry qualification on `fcfee2e8dd4fca061556d2b6426f9aa4167da35e`
    exposed two fixture-state gaps. The initial configuration browser run saw a
    stale Memory revision after a real Usage price update; a controlled two-case
    real-host/Web regression now proves conflict, draft preservation, no implicit
    grant, explicit reload/reconfirmation and B isolation, alongside a current
    clean-snapshot success. These and the existing configuration UI cases passed
    **15/15**. Browser readiness now requires the current clean revision before
    the next edit, including returning from dedicated Actions, and a real saved
    notice after each save. Original assertions and deadlines remain. The repaired
    complete configuration browser journey passed; no product auto-rebase,
    permission default or conflict policy was introduced. Exact GET/DOM ordering
    in the two historical browser failures was not captured and remains unknown.

    The original image fixture disabled file automatic processing but left image
    intake enabled. The first manual operation encountered `file_processing_active`;
    visible generated text did not establish a successful manual acknowledgement.
    Preparation now uses the real image setting, upload, blocked coordinator,
    current-proof cancellation and re-enable. A finite setup/cleanup check proved
    three cancelled seeds, no resurrection and zero OCR/pixel work. The repaired
    image browser journey then passed real manual completion, PNG download,
    recompute/cancel, physical settlement and equal-ID B isolation. It records
    exact task identities and pending-operation acknowledgement; original actions,
    input scale and deadlines remain. This was not a lost-acknowledgement fixture.

    Across the initial two integrated attempts the other seven groups passed;
    the compiled attachment → processing → Material asset → personal export
    entry passed **1/1**. All initial source/build manifests were unchanged and
    actual cleanup completed. These results and each failure are retained in the
    work record. The four test/fixture corrections require renewed qualification:
    complete exact-head E2E and the unchanged affected driver's eligible reuse or
    rerun decisions remain pending. The root fixture input receives no exemption.

52. Current-entry E2E on `10c8f236975422828d2f866efb2ebd43c4c1d661`
    passed the complete configuration browser, all eight integrated browser
    groups, and the compiled attachment → processing → Material asset → personal
    export entry (**1/1**). All generated fixtures ran headlessly and cleaned up.
    The 5,241 tracked/source/build file hashes were unchanged before and after
    these journeys and after the subsequent affected run.

    The subsequent affected run completed at **2026-10-23 00:43:13 UTC** with
    **37/38 tasks passed**, stable guarded inputs and confirmed cleanup. Receipt:
    `2026-10-23T00-03-57-805Z-50761923-deda-4e04-85d5-767b10d135f0`.
    Web passed **651/651** and Desktop passed. All sixteen Server groups ran;
    group 6 alone failed one Actions restart case: the shared provider HTTP
    request count was 22 rather than 21 after restart and wake. The later
    disabled-input stage had not run. Android again reported 25 up-to-date tasks.
    This failed candidate is retained as evidence, not reported as qualified.

53. A prospectively reviewed diagnostic-only change preserved all five original
    Actions cases, 58 assertions and existing deadlines. The exact-file driver
    passed **5/5** with stable inputs and cleanup
    (`2026-10-23T00-43-33-962Z-46b33752-fb79-42f9-83ca-1ae88ecfe0ba`).
    It reached the relevant unfinished-work state: the 21-call baseline included
    15 Memory requests, one running Memory batch and another waiting batch.
    Restart resumed the same Memory task and lease; its next five actual requests
    happened after the original count assertion. Completed Actions jobs, task
    attempts and usage stayed unchanged throughout the recorded stages.

    That diagnostic PASS did not close the failure. It demonstrated a shared
    provider measurement precondition defect. The exact 22nd request in the
    historical failed run was not captured and remains unknown. No production
    Actions replay defect or universal absence of replay is claimed from this
    observation. The next correction controls the independent Memory execution
    state explicitly while preserving its real admission, authority and later
    execution; it does not filter the original global request count.

54. The reviewed one-file state control passed all **5/5** original cases at
    **2026-10-23 01:03:15 UTC**, with stable guarded inputs and confirmed cleanup.
    Receipt: `2026-10-23T01-02-35-353Z-b6f4bfe5-5252-460b-bac0-113d0fc0ab27`.
    All original 58 assertions, waits and deadlines remain; the other four cases
    are byte-identical. Only the existing Memory model-pool admission is held in
    this test, preserving real material intake, task grants and model snapshots.

    The mandatory witness showed two actual Memory batches waiting at zero
    attempts across restart, then a third admitted batch for the later input.
    The original global provider count stayed at six through the negative phases
    and rose to nine only for the new Actions input. Restoring the original pool
    then executed those exact three Memory tasks: 45 additional HTTP requests
    matched their actual usage, with nine settled issuances and nine quiescent
    physical calls. The unchanged Actions-only responder naturally produced
    `agent_host_validation` failures after three attempts per batch; this is
    execution/cleanup evidence, not successful Memory extraction. Completed
    Actions, B history and the full request privacy assertions stayed intact.

    Hash comparison against the final E2E manifest found only this Server test
    changed; all application sources, browser fixtures and built outputs were
    identical. Existing E2E evidence remains attached to its original tested
    revision. The complete affected driver must now rerun invalidated checks and
    may reuse eligible original passed-task receipts; no check classification,
    timeout or acceptance criterion was relaxed.

## Audit issue coverage ledger

This ledger tracks the original audit scope after checkpoint 54. Complete current-entry
E2E passed at checkpoint 52; the final one-test state correction passed at
checkpoint 54 and requires renewed affected qualification. See the timestamped
checkpoints and final PR/delivery record.

| Issues | Shared implementation | Current evidence / gap |
| --- | --- | --- |
| R01–R04 | Configuration CAS, intent coordination, connector task snapshots and visible automation controls | Module and complete affected consumers passed; complete standalone browser controls passed at checkpoint 52 |
| R05 | Stage-specific Actions prerequisites and explicit waiting status | Module and complete affected Actions consumers passed |
| R06–R07 | New-target Memory authorization, separate history and immediate ready intake | Module, intake/observation, independent review, disable/drain and complete affected consumers passed |
| R08–R10 | Shared source, typed time, lineage and eligible evidence projection | Module, current readers, Memory and complete affected consumers passed; shared source presentation preserved |
| R11–R12 | Import incarnation, tombstones, deterministic decoding and explicit unsupported outcome | Decoder/identity and current Server/Web portable consumers passed; compiled attachment/export entry passed at checkpoint 52 |
| R13–R14 | Shared Desktop outcomes and per-subrequest durable receipt delivery | Focused transport and complete Desktop suite passed, including actual Central source-account retry |
| R15 | Accepted import operation authority | Module, real configuration seam and actual portable import/logout consumers passed |
| R16 | Diagnostics links to existing instance settings | Source correction and complete Web suite passed; standalone browser evidence passed at checkpoint 52 |

The audit's unmeasured capacity/export and cross-domain reuse risks are not
represented as proven failures or resolved performance work. Matching-contract
reuse remains permitted; this phase introduces no universal semantic cache.
Legacy builder retirement remains a separate scenario-transfer task, as the ADR
states. Neither legacy tests nor passing fixture checks establish live-model or
physical-device behavior.

## Validation / remaining work

At checkpoint 54, complete generated E2E and the final finite repair have passed.
Renewed affected qualification, PR, Dev packaging and artifact inspection remain.
Their final status belongs to the exact-head PR and retained delivery record under `artifacts/unified-user-journeys-2026-10-23/`. Physical-device and
live-model checks are not performed and must not be inferred from fixture tests.
