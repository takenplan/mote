# Mote plugin extension benchmark: frozen experiment plan

Status: **specification frozen before Iterator results**. This document contains requirements and source-derived hypotheses, not test results.

- Method: user-supplied “Mote 插件扩展能力评估：实验方案 v1”.
- Repository baseline: `2c78ca8d52a7d17fae20962cf68d09a717ffc73a`.
- Freeze date: 2026-10-19.
- Planned rounds: five.
- Machine-readable matrix and independent fixtures: [cases.json](cases.json).
- Case Designer owns only this plan and the case specification. The designer inspected public baseline documents and source, and did not inspect Iterator or Optimizer implementations.
- No live model calls, personal data, real screenshots, production calendar writes, main-branch merges, deployment or outbound messages are part of this experiment. Root may commit round candidates and open the authorized reviewable PR.

## 1. What the benchmark measures

**Capability** asks whether an independently authored extension completes the required journey through supported public boundaries with no core business-source changes. **Friction** records how much work discovering, configuring and using those boundaries took. These are separate outputs.

The unit of a full-case success is an entire E01–E12 requirement family. A smaller runtime probe may demonstrate one useful capability without passing its parent case. For example, publishing a financial Material through a source worker proves source publication; it does not also prove automatic insight generation, Memory integration or a functioning custom UI.

All model outputs are deterministic synthetic responses. Normal package resolution/verification, worker loading, Cordis registration, authentication, host callbacks, task scheduling, authorization, persistence, publication, reads and disposal must still execute. A model fixture can establish routing and lifecycle correctness; it cannot establish semantic quality, recognition accuracy, inference latency, power consumption or production provider compatibility.

## 2. Current product boundary and evidence precedence

The authoritative shipped server entry is [apps/server/src/index.ts](../../../apps/server/src/index.ts), which calls [scope/app.ts](../../../apps/server/src/scope/app.ts) `buildScopedApp`. The older owner-wide app and legacy source registry examples are useful public documentation, but success in that alternate composition is not success in the shipped scoped runtime.

Evidence precedence is:

1. Actual product-entry execution on the frozen candidate.
2. Current entry-point composition and consumed public contracts.
3. Current behavior documentation.
4. Historical design documents and old validation records.

Historical PASS statements are never imported into this experiment.

### Public source-derived hypotheses at the frozen baseline

| Boundary | Baseline evidence | Consequence for case design |
| --- | --- | --- |
| Scoped package/instance lifecycle | `scope/plugin-routes.ts`, `scope/plugins.ts`, `scope/plugin-contract.ts` | Fixed package installation, per-user check/enable/snapshot/invoke, real worker RPC and task publication are practical primary probes. |
| Source extension | `scope/app.ts` binds `receiveCaptures`, `receiveSourceItems`, `readOriginal`, `pageOriginals`, `publishMaterial` | E01 must use this real bounded binder; an old `MOTE_BACKEND_PLUGINS` example alone is insufficient. |
| Processing extension | `scope/processing.ts` registers `processor` and provides `stageExtraction` / `processOriginal` | E08/E12 can probe real original-to-artifact publication. Transcript staging alone is not image understanding or diarization. |
| Descriptor vs domain support | `scope/plugins.ts` reports unsupported capabilities as `scoped_domain_unavailable` | A `model` or `ui` enum/manifest entry is not proof of an executable model or UI adapter. |
| Memory providers | `scope/memory-providers.ts` uses `domainProvider` and `WorkerMemoryProvider` | E07 must exercise the actual Memory binding and read authority, not generic worker history RPC alone. |
| Harness plugins | `packages/agent/src/index.ts:createRuntimePatch` inserts fixed attachment, skill and Mote context plugins; `plugin.mjs` guards tools | E04 needs an actual supported external loading/admission path. Rewriting an upstream plugin into Mote RPC does not satisfy “unchanged native plugin”. |
| UI presentation | `packages/shared/src/ui-presentation.ts`, `apps/web/src/presentation.tsx` | Web trusted bundle assembly is distinct from server-worker UI installation. Exact identities and DOM state retention are testable. |
| Pre-upload local inference | `docs/central-perception.md` explicitly removes local VLM, review URL and `VisualReviewProvider`; `docs/local-inference.md` is historical | E03-device is separate from Central local-model routing. Do not claim it passed because a Central request used localhost. |
| Custom scheduling | `scope/ask-automation.ts` has fixed `working` / `insights` policies | Existing built-in automation is not automatically an extension-owned durable trigger. E06 must prove the contributed behavior enters the normal scheduler. |

These are hypotheses and contract observations. An observed missing extension path is **FAIL** with reason **NO_EXTENSION_POINT**, established by a reproducible attempt or concrete public-path rejection. **BLOCKED** is reserved for external environment prerequisites. No unexecuted source observation is entered as an executed PASS or FAIL.

## 3. Frozen case matrix and practical primary scope

All required behaviors and variation classes are public in [cases.json](cases.json). Only the concrete held-out values and ordering may be withheld from the Iterator.

| Case | Full required outcome | Practical runtime probe | Material limitations to report |
| --- | --- | --- | --- |
| E01 Financial insight | Three generated sources, exact dedup/refund totals, traceable monthly insight, normal query/UI, authorization and disable/history behavior | Real scoped source worker intake and Material publication; exact arithmetic/readback; processor publication when used | Source-only success is PARTIAL for full insight/Memory/UI. |
| E02 UI style | Theme + layout activate and dispose while preserving drafts, focus, navigation and domain work | Shared presentation contract plus real Web DOM interaction in a trusted bundle | Headless DOM is distinct from an actual browser; Mac/Android native layouts require builds and device validation. |
| E03 Sensitive local models | Central restricted routing **and** client pre-upload local review boundaries | Central mock local profile, actual model transport and forbidden-destination ledger | Central routing cannot satisfy pre-upload device filtering; no recognition-quality claim. |
| E04 Native Harness plugin | A byte-identical, pinned third-party-style Harness package loads through supported startup and its admitted read-only tool executes | Actual Harness session plus deterministic provider tool-call script | Package metadata, Cordis alone or a rewritten adapter do not satisfy native compatibility. |
| E05 Calendar automation | Model proposal, exact evidence, explicit confirmation, one calendar effect, recovery and revocation | Real Central action/confirmation/delivery protocol with synthetic executor | Synthetic receipt is not an OS calendar write. Native calendar requirement remains unverified without a native target. |
| E06 Periodic insight | Extension-owned periodic/event policy uses durable host admission, exact scope, pause/stop/restart and no unauthorized backfill | Existing scheduler/API plus plugin callback only if publicly supported | A private timer, direct core call or built-in insight policy without the extension is insufficient. |
| E07 Memory replacement | Independent repository/retrieval becomes real body authority after verified migration; rollback, missing body and deletion remain correct | Real installed worker and Memory binding/put/read/query/export path | Worker health or `search` echo is insufficient; hosted Mem0/Hindsight are separate optional integrations. |
| E08 Image provider | Captured and uploaded synthetic images reach the selected provider and real named artifacts with exact lineage | Scoped processor / configured media provider and original-to-artifact pipeline | Text-only staged output is a processing subprobe; real OCR/VLM quality is out of scope. |
| E09 New material UI | New material card/detail/panel/action in normal Library, exact dependency handling, generic historical fallback | Trusted WebFeatureHost bundle over real scoped Material APIs | Server `ui` descriptor does not install browser code; no screenshot-only pass. |
| E10 Composition/upgrade | Two plugins coexist; admitted work keeps exact version; disable/stop/restart/uninstall preserve the required boundaries | Real scoped worker source + processor, pause/stop, stale callbacks, restart and retained package references | Plugin definition upgrade is distinct from a new host binary; both are reported. |
| E11 Multiuser | Identical plugin/instance/source IDs remain isolated across users, snapshots, events, model resources and restarts | Real Accounts/authentication, A/B sessions, source workers and task/event/history reads | Administrator status must not become a private-data selector. No malicious-code sandbox claim. |
| E12 Audio capability | Custom ASR/diarization output persists with exact times/anonymous speakers and partial failure recovery | Generated WAV + deterministic media service or processor through real pipeline | Synthetic audio and model responses do not prove ASR accuracy or real speaker identity. |

### Required primary probe set

The mandatory practical core for every round is `P01_SOURCE`, `P02_PROCESSOR`, `P10_LIFECYCLE`, `P11_ISOLATION`, plus reproducible boundary probes `P04_HARNESS` and `P06_TRIGGER`. This is deliberately a **probe-level** result set and must not be presented as six passed full cases.

Run `P02_WEB`, `P03_CENTRAL`, `P05_ACTION`, `P07_MEMORY`, `P08_IMAGE`, `P09_LIBRARY_UI`, and `P12_AUDIO` where the environment and allocated round support them. A missing architecture path is a capability failure after a concrete attempt; unavailable browser/native tooling is BLOCKED with an environment reason; an unattempted journey is NOT RUN.

Every round report still includes all E01–E12 full-case rows. Unexecuted portions remain visible.

## 4. Hard gates

Each gate is reported independently with evidence identifiers.

| Gate | PASS requirement |
| --- | --- |
| G1 Functional completeness | All mandatory journeys and independent expected outcomes for the declared unit pass. Partial implementation cannot pass the full case. |
| G2 Core zero intrusion | Iterator changes no pre-existing core business source, model bridge, schema, scheduler, authorization code or existing tests. Supported assembly/config edits are counted separately and reviewed. |
| G3 Authorization/privacy | Real current-user, source, model, snapshot and publication checks hold before and after asynchronous work. No forbidden content, credentials or provider destination appears in the relevant observations. |
| G4 Lifecycle | Required install, check, enable, pause/disable, stop/cancel, restart, retained history and applicable upgrade/uninstall transitions behave correctly. |
| G5 Regression | The candidate runs the affected existing checks and relevant consumers with no new failures. Prior failures and environment blockers are separately recorded. |
| G6 Real execution | Actual installed plugin bytes execute; host callbacks and intended durable results can be independently observed through ordinary reads. Registration, task success, emitted prose or screenshots alone do not pass. |

**Status rules**

- **PASS**: all required assertions of the declared unit have direct evidence.
- **PARTIAL**: some required outcomes execute correctly, but the whole required journey is incomplete. A partial source probe does not silently remove the automatic-insight requirement.
- **FAIL**: a valid attempt exposes a wrong outcome, authority breach, core intrusion, late publication, or a demonstrably missing supported extension path.
- **BLOCKED**: external prerequisite prevents a valid attempt, such as an unavailable browser/native toolchain or missing package dependency. Record the exact prerequisite; do not reclassify a missing product API as an environment blocker.
- **NOT RUN**: no valid attempt was made. Never convert this to PASS.

A failed hard gate prevents a full-case PASS. A functional success with a core patch remains capability FAIL for that Iterator trial; the patch may separately motivate a later Optimizer baseline.

## 5. Independent oracle and hidden variations

Expected values originate in the case specification, never in plugin implementation output. The Evaluator independently constructs expected records and compares persisted/public results to them.

For E01, generated evidence has 20 bank CSV observations, 15 notification observations and 8 email observations: 43 total. It represents 23 unique transactions, four nontransaction noise observations and 16 repeated observations. September contains 19 charges and two refunds. The exact oracle is **89,335 cents gross charges − 6,000 cents refunds = 83,335 cents net spending**. August and October purchases are excluded. Amounts are integers; source identity plus explicit transaction identity determines duplicates, not title similarity.

Categories are explicit fixture fields or deterministic mocked model extraction output. The plugin may perform arithmetic and identity deduplication, but must not replace semantic extraction or insight interpretation with merchant keyword rules. The public normalization wire may represent the same fixture as \`occurredOn: YYYY-MM-DD\`, nonnegative \`amountMinor\`, \`kind: payment | refund\`, and \`evidenceId\` bound to the actual original reference. The Evaluator maps signed \`amountCents\` and UTC \`postedAt\` into that schema; this serialization does not change the oracle or require categories in the normalized ledger.

A hidden variation can rename IDs/merchants, permute arrival order, split batches, change bounded cent amounts, shift valid timestamps across the declared month boundary, vary duplicate counts, delay model output, or revoke a source at a stated lifecycle point. It cannot introduce a new currency-conversion policy, fuzzy duplicate requirement, recurrence model or other undeclared product requirement.

Before the Iterator starts, the Evaluator selects and records a seed and stores its commitment with the run manifest. The raw held-out fixture stays Evaluator-only until final evaluation. The same frozen seed/value family is used for comparable rounds, with separate unused variants reserved for the final round. If a hidden failure is disclosed for repair, a fresh value variant of the same already-public behavior is used for final scoring.

### Model fixture rules

1. Script transport-level protocol replies for the intended model boundary; record every request and its selected profile/model.
2. A semantic extraction script is keyed to generated fixture content or its exact hash, and returns declared structured facts. It is not an implementation in the plugin.
3. The mock must not publish Materials, write Memory, create tasks, manufacture plugin callbacks or inject a final database state.
4. Inspect actual model inputs and tool results as well as the final reply. A canned correct summary cannot hide wrong plugin aggregation.
5. Invalid output, delayed output and explicit failure variants use the same contract and host lifecycle.
6. A real model call anywhere fails the execution protocol for that trial. Live-model and physical-device rows remain NOT RUN unless a later explicit instruction authorizes another experiment.
7. Synthetic reported tokens are labelled fixture telemetry; they are not real model tokens or development token cost.

## 6. Evaluator calibration before round 1

Calibration is necessary to show that the evaluator rejects convincing false positives. All specimens are synthetic and use isolated temporary vaults.

| Calibration | Specimen | Expected evaluator decision |
| --- | --- | --- |
| C01 Real positive | Fixed generated worker release actually reads admitted inputs, publishes a Material through the source binder, and produces correct owner-visible body/lineage | Functional and real-execution gates PASS for the source probe. |
| C02 Registry-only fake | Same manifest/component names; check and task return a plausible summary but no intended host write | G6 FAIL and G1 FAIL, even if inventory is verified and task status says success. |
| C03 Hardcoded-answer fake | Returns the visible E01 amount without consuming changed hidden inputs | Hidden oracle FAIL. |
| C04 Core intrusion | A synthetic candidate diff or isolated-copy patch changes existing app/bridge code to force the same correct result | G2 FAIL; successful functional behavior must not override it. Never edit the frozen checkout to make this specimen. |
| C05 Cross-user fake | Worker attempts a B-owned original or snapshot with A's invocation | No B body/metadata/result/event is disclosed; authority gate rejects the specimen if it leaks. |
| C06 Late-result fake | Hold an invocation, stop/revoke/cancel it, then let the worker attempt a publish | No stale publication; evaluator catches any late write. |

The calibration report records actual commands, specimen hashes, expected verdicts and observed verdicts. C01–C04 are mandatory before any aggregate metric is trusted. C05–C06 are mandatory before authorization/lifecycle PASS is reported. A calibration implementation may use an existing checked-in test as a reference, but the new evaluator must run its own specimens. No expected verdict is counted as an observed result.

## 7. Five rounds and role isolation

| Round | Frozen candidate | Purpose and constraints |
| --- | --- | --- |
| R01 | Original baseline commit | Establish runtime/boundary failures and friction. No Optimizer source changes. |
| R02 | Documentation/examples/tooling-only candidate | Repeat identical primary cases with a fresh Iterator. Attribute discovery/configuration effects separately; runtime source and contracts remain identical to R01. |
| R03 | First generic interface candidate | Optimizer addresses independently observed cross-case gaps. A fresh Iterator starts from requirements and public candidate docs. |
| R04 | Generic lifecycle/composition candidate | Resolve remaining evidenced problems; rerun all primary probes and affected regressions with fresh plugin work. |
| R05 | Final frozen candidate + held-out values | Fresh Iterator and independent Evaluator repeat the primary set and all feasible expanded cases; verify improvements generalize to undisclosed values. |

Each trial has one initial delivery and at most two Evaluator feedback/repair cycles. Record pass@1 and final verdict separately. A round is not itself an independent statistical replicate of the same candidate: baselines differ. Five rounds do not justify a confidence interval or claims of model-run reliability.

If evidence does not justify a new generic source change, retain the prior candidate and document that choice. Do not invent an optimization just to fill a round. Candidate identity is the actual commit plus full tracked/untracked patch hash when work is uncommitted. A later source edit invalidates earlier final-candidate regression evidence.

**Role separation**

- Case Designer: public behavior, independent fixtures, expected results, matrix and gates.
- Iterator: external plugin files and supported deployment/bundle assembly only; no core source or existing-test changes.
- Evaluator: independent black-box execution, read-only durable-state inspection, trace review, core-diff audit, costs and calibrated verdicts.
- Optimizer: generic host contracts/lifecycle/SDK/docs after the baseline report; does not implement the case-specific plugin.

A fresh Iterator may read the candidate's public docs/source and frozen case requirements. It must not receive another Iterator's plugin, repair transcript or solution. The Evaluator may read submitted code for intrusion/security assessment but never derives its oracle from it.

## 8. Valid execution and evidence collection

A valid primary production run instantiates `buildScopedApp` without the verifier-only option, creates actual test accounts and credentials through supported authentication, and exercises the real scoped services. The verifier-only composition disables the production task/plugin host and cannot be used to prove it works.

Fastify injection with the production composition is labelled **production-composition HTTP**. A subprocess listening on loopback through the shipped entry is labelled **actual process HTTP**. Startup/restart claims require actual process termination and reopening the same isolated vault; disposing one object in the same process is only an in-process lifecycle result.

Only model services and remote-service transport dependencies may be deterministic fixtures. A fixture release transport may return a generated pinned manifest/ZIP, but the normal archive digest check, extraction boundary, package catalog and worker process must execute. Do not seed internal plugin instance, task, Material, artifact or Memory tables to claim public installation/publication success. Read-only SQL inspection is allowed as a secondary oracle.

For every run preserve:

- Baseline/candidate/plugin/spec/fixture hashes; runtime and dependency versions.
- Declared full case and exact subprobe IDs, scope and required gates.
- Public request/response observations, excluding reusable credentials.
- Plugin callback evidence, model request ledger, task and publication identities.
- Pre/post public state and, where useful, read-only durable-state assertions.
- Startup/shutdown/restart observations and disposal/late-result evidence.
- Core diff and supported assembly diff classified separately.
- Existing check commands with exit codes and logs.
- Actual environment blockers and all NOT RUN dimensions.

Use generated identifiers and synthetic data only. No credentials enter source control or the report.

## 9. Capability and friction reporting

### Capability

Report a case-by-gate matrix and a separate probe-by-gate matrix. Report both full-case NISR and probe NISR only when denominators are nonzero, with explicit numerator/denominator.

`NISR = valid trials with complete required outcome and zero core intrusion / all valid attempted trials of the same declared unit`.

Valid architectural failures remain in the denominator. External-environment BLOCKED and NOT RUN trials are excluded but their counts and coverage are prominently reported. PARTIAL is never a full-case success. Do not pool subprobes with full cases or claim a 12-case percentage from six narrow probes.

### Friction

Record, independently and with observation provenance:

- Elapsed wall time to first independent success and final delivery.
- Interface discovery/configuration time when actually timestamped.
- Model/tool development tokens only when available from trustworthy telemetry; otherwise null/unknown.
- Plugin business LOC, adapter/glue LOC, manifest/config LOC, documentation LOC.
- Core files/lines changed, private API references and supported assembly steps.
- Initial failures, repair cycles and distinct discovery/contract/tooling errors.
- Workaround infrastructure duplicated: scheduler, store, authorization, model routing.
- Whether the plugin survives a host candidate upgrade unchanged.

Do not estimate missing token cost, fabricate a timing breakdown, or compare LOC across unrelated case complexity. Cost-per-success is comparable only for the same case and fixed experiment conditions. A docs-only improvement is a friction result unless independent capability evidence demonstrates a change in outcome.

## 10. Native/device and quality coverage ledger

Every final report includes separate rows for:

- Central production-composition HTTP and actual-process HTTP.
- Shared contracts, headless DOM and actual browser interactions.
- Mac native build, native renderer, capture permissions and real calendar effects.
- Android compile/unit tests, emulator interaction, background lifecycle and physical device.
- Synthetic OCR/ASR/VLM/LLM protocol execution.
- Real provider compatibility and live model semantic quality.
- Native memory/CPU/power/performance.

Unexecuted rows say NOT RUN. No emulator/toolchain is assumed available. Missing physical hardware is an environment limitation, while absence of a supported pre-upload extension hook is an architecture limitation. Native build/bundle distribution effort is counted separately from a core business change. The frozen protocol prohibits live inference, so this experiment cannot certify model quality.

## 11. Documentation review and freezing

The Case Designer will validate JSON parsing, unique case/probe/gate identities, internal references and the E01 arithmetic independently. This is documentation/specification work; no application build or existing test edits are needed for these two files.

After handoff, acceptance behavior, full-case boundaries and denominators remain fixed. Correcting a typo is recorded as a spec revision; changing required behavior starts a new comparable experiment and cannot retroactively improve a verdict.

