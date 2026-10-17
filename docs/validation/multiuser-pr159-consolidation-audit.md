# PR159 consolidation audit: no closing performed

This is a read-only source/test/design inventory, not permission to close PRs now. The final actual Web acceptance is incomplete. The parent will explicitly release any closing only after the remaining validation and gaps are handled. This lane used shell/GitHub API only; it did not connect to Chrome, claim a session, or run browser actions.

Tested product candidate: `8ad99089ead559d6656a269fdca7ccb884953c07`, tree `fcb3bce1524932978ad7133377aaa56136a3dcc1`. Immutable manifest SHA256: `3295223d9a2cf7e8abf4cea86e2a125328491a024ad3e3c2363e4d4cc07dc08a`. Publication head at the start of this audit: `2bc7e3f19cbde9c825057122850d8a23f386da90`; later audit commits are documentation only. All34 heads were fetched and matched the GitHub API snapshot. The base is `6272a9b51ec92cc4c32e2ff1a1eeb4fa38b142ed`.

## Decision

- 24 multiuser PRs have source/test/design coverage sufficient to be replacement candidates after final acceptance. This does not mark their historical gates green or authorize closing now.
- Four PRs (150,153,154,156) need durable-test or receipt/document reconciliation before a blanket replacement claim. Their already-selected production fixes are not proposed for duplicate merging.
- Five independent PRs (143,145,146,147,148) must remain open and outside consolidation.
- PR159 remains the single final Draft review target. No PR was closed, commented on, merged, retargeted or deleted by this audit; no branch was deleted and CI settings were not changed.

## Per-PR mapping

`A` means the exact PR head is an ancestor of C2 and every changed path remains present. `P` means selected/adapted patches and resulting files were checked; it does not imply branch ancestry. Counts are exact/evolved/absent Git blobs across the whole PR diff, including inherited modules. Evolved files were not mechanically declared semantically equal. Full40-character heads, source/test/design examples, path counts, absent paths and patch matches are in [the machine mapping](multiuser-pr159-consolidation-audit.json).

| PR | Actual diff scope | Frozen head | Evidence | Recommendation |
| --- | --- | --- | --- | --- |
| [126](https://github.com/utopiafar/mote/pull/126) | M00 scope foundation | `5031b754915d` | A; 203/16/0 | Eligible after final acceptance; no close now |
| [127](https://github.com/utopiafar/mote/pull/127) | M01 accounts/auth/admin | `443726d2a95e` | A; 209/25/0 | Eligible after final acceptance; no close now |
| [128](https://github.com/utopiafar/mote/pull/128) | M02 private repositories/indexes | `8ecccb8ecf00` | P; 209/21/0 | Eligible after final acceptance; no close now |
| [129](https://github.com/utopiafar/mote/pull/129) | M04 configuration/models/snapshots/usage | `bc5323e1b5ee` | P; 223/33/0 | Eligible after final acceptance; no close now |
| [130](https://github.com/utopiafar/mote/pull/130) | M05 execution/Operations/scheduler | `7f72e9040872` | A; 248/38/0 | Eligible after final acceptance; no close now |
| [131](https://github.com/utopiafar/mote/pull/131) | M03 originals/Ingress | `b1f6700a7e68` | P; 251/46/0 | Eligible after final acceptance; no close now |
| [132](https://github.com/utopiafar/mote/pull/132) | M09 scoped plugins | `cdc5c34c36fc` | A; 269/51/0 | Eligible after final acceptance; no close now |
| [133](https://github.com/utopiafar/mote/pull/133) | M06 OCR/ASR/derived files | `470516b7ed4a` | A; 283/56/0 | Eligible after final acceptance; no close now |
| [134](https://github.com/utopiafar/mote/pull/134) | M10 connectors/provider intake | `7572b573b034` | A; 303/59/0 | Eligible after final acceptance; no close now |
| [135](https://github.com/utopiafar/mote/pull/135) | Public isolation/validation contracts | `094b69d0c4d6` | A; 305/59/0 | Eligible after final acceptance; no close now |
| [136](https://github.com/utopiafar/mote/pull/136) | M07 Memory | `cd7a306cce0f` | A; 354/69/0 | Eligible after final acceptance; no close now |
| [137](https://github.com/utopiafar/mote/pull/137) | M08 Ask/chat/Insight | `58944f00837c` | A; 378/77/0 | Eligible after final acceptance; no close now |
| [138](https://github.com/utopiafar/mote/pull/138) | M11 MCP inbound/outbound | `98d76945e091` | A; 404/74/0 | Eligible after final acceptance; no close now |
| [139](https://github.com/utopiafar/mote/pull/139) | M14 Desktop account capture | `cd46f25a030b` | A; 649/119/0 | Eligible after final acceptance; no close now |
| [140](https://github.com/utopiafar/mote/pull/140) | M12 Actions/todos/calendar | `a50d1c886477` | A; 622/124/0 | Eligible after final acceptance; no close now |
| [141](https://github.com/utopiafar/mote/pull/141) | M16 lifecycle/portable recovery | `eec967c66304` | A; 621/125/0 | Eligible after final acceptance; no close now |
| [142](https://github.com/utopiafar/mote/pull/142) | Container/Hindsight epoch-5 validation | `723cc0b794fc` | A; 630/123/0 | Eligible after final acceptance; no close now |
| [143](https://github.com/utopiafar/mote/pull/143) | Light/Dark/Auto appearance | `ce0c7e211ad1` | Independent actual diff | Keep independent; never close in this cleanup |
| [144](https://github.com/utopiafar/mote/pull/144) | M01 account-bound QR pairing | `48547e8f04a4` | A; 682/120/0 | Eligible after final acceptance; no close now |
| [145](https://github.com/utopiafar/mote/pull/145) | Main: Lark evidence revision stability | `abf61f1b993b` | Independent actual diff | Keep independent; never close in this cleanup |
| [146](https://github.com/utopiafar/mote/pull/146) | Main: historical conversation/evidence retention | `2435f44e76e4` | Independent actual diff | Keep independent; never close in this cleanup |
| [147](https://github.com/utopiafar/mote/pull/147) | Main: Gmail provider-counter stability | `9dc47305f639` | Independent actual diff | Keep independent; never close in this cleanup |
| [148](https://github.com/utopiafar/mote/pull/148) | Main: Memory/cache retention | `d966759d18d0` | Independent actual diff | Keep independent; never close in this cleanup |
| [149](https://github.com/utopiafar/mote/pull/149) | Desktop v2 PKCE durable recovery | `f319513a0502` | A; 677/106/0 | Eligible after final acceptance; no close now |
| [150](https://github.com/utopiafar/mote/pull/150) | Personal applied-policy archive/recovery | `67b992f32016` | P; 715/118/9 | Hold: reconcile gap below |
| [151](https://github.com/utopiafar/mote/pull/151) | Named/typed image progress and export | `98b1ea52c446` | P; 827/92/0 | Eligible after final acceptance; no close now |
| [152](https://github.com/utopiafar/mote/pull/152) | Original recording consumers | `144852fe7df7` | A; 794/108/0 | Eligible after final acceptance; no close now |
| [153](https://github.com/utopiafar/mote/pull/153) | Scoped Ask evidence/admission waiting | `f67f6980cdab` | P; 717/116/10 | Hold: reconcile gap below |
| [154](https://github.com/utopiafar/mote/pull/154) | Ask/processing await authorization tests | `6010cfa97c87` | P; 1/1/0 | Hold: reconcile gap below |
| [155](https://github.com/utopiafar/mote/pull/155) | M15 Android account lifecycle | `f1452b9876cc` | A; 810/77/0 | Eligible after final acceptance; no close now |
| [156](https://github.com/utopiafar/mote/pull/156) | M13 Web/compiled private SQL lifecycle | `b2802a8dbe0a` | P; 888/75/1 | Hold: reconcile gap below |
| [157](https://github.com/utopiafar/mote/pull/157) | Joint scoped processing/typed graph/ACK contracts | `8084ef359fa0` | A; 793/92/0 | Eligible after final acceptance; no close now |
| [158](https://github.com/utopiafar/mote/pull/158) | KEEP admin limits/lexical maintenance/split exports | `1d33119b00eb` | P; 888/77/0 | Eligible after final acceptance; no close now |
| [159](https://github.com/utopiafar/mote/pull/159) | Sole final multiuser review target | `2bc7e3f19cbd` | Final publication target | Keep sole final Draft target |

## Actual selected-patch checks

- M02 PR128: original `1323c7e1`/`d8aaef97` map to `12c1b44f`/`e77faca9`. Range diffs retain private repositories, their original tests and `multiuser-private-data.md`; changes combine M01 auth/runtime/error registration and replace obsolete foundation-only table/mode assertions.
- M04 PR129 is related multiuser configuration work despite its broader configuration-center vocabulary: per-user ConfigService, shared model resource references, durable encrypted snapshots, generation/revocation fences and usage. It also adapts existing `config-service.ts`, `model-settings.ts`, usage helpers and `adr-unified-configuration.md`; these are dependencies of the scoped feature, not an unrelated refactor. `a5e91664`/`e76f1fe6` map to `c4e4e8bc`/`463d5299`; the range differences compose existing M02/M05 runtime and table assertions. Named snapshot tests and configuration design are retained.
- M03 PR131: `fffe1d12` maps to `c21062a1`; original staging cleanup `14858e86` has a stable-patch equivalent. The integrated form retains M04/M05/M09 registrations and inventory while adding the original M03 source/test/design; it is not missing originals because the standalone branch has a different runtime base.
- Image PR151: all changed paths exist;24 of34 unique commits have exact stable-patch matches. The other functional adaptations map to `341e3efd`, `553517c1`, `0880412c`, and `a7c44e28`; range diffs preserve FJ retry/pin behavior, newer Files review/recording composition and catalog context. All image projection/recipe tests remain. This is source coverage, not the currently unrun final browser Files journey.
- Ask PR153: all seven explicitly declared module source/test patches have stable-patch equivalents in C2. Final `ask-schema.ts` and `multiuser-ask-read-races.test.ts` match its head exactly; `ask.ts` additionally has later original Memory-opening/Agent-trace integration. Missing inherited recovery files and its report are listed below.
- Web PR156 remote head is now `b2802a8dbe0a21ffe2af8d26a2fbdeaa8b2c1a2e`, newer than manifest FW `b5989f75`. Its new `a2f299c8` is the same narrow Statement lifecycle fix already selected as `acbfd7f1`/`f1be61ee`; the lifecycle/preparation tests are present and exact. C2 intentionally retains KEEP `changeToken` alongside the prepared cache. Do not replay the same fix or replace the union with the PR156 file wholesale.
- KEEP PR158 is multiuser scope, not unrelated settings work. Instance limit/control routes, private management, shared lexical `pd_fts` maintenance, owner split TAR/current-history exports, UI and contract are retained. Core `instance-controls.ts`, `index-maintenance.ts`, `file-export.ts`, `file-export-tar.ts` and UI files are exact. `db321f64` differs in catalog insertion context; independent `496cae8d` and `e8962fb8` tests are included. Later task recheck authority and Statement lifecycle additions must remain.

## Gaps that must be reconciled before blanket closing

### PR150 recovery source reproducibility; inherited by PR153

Production `apps/server/src/scope/processing-policy-archive.ts`, `apps/server/test/multiuser-policy-personal-archive.test.ts` and `docs/design/multiuser-policy-personal-archive.md` are byte-identical to PR150. Its dangling-parent rejection and preflight name are also selected. No new missing production fix was found. However, these paths from PR150 are absent in C2 and the audited PR159 publication:

- `apps/server/test/fixtures/policy-native-recovery.ts`
- `apps/server/test/fixtures/recovery-http-host.ts`
- `apps/server/test/multiuser-recovery-http-seams.test.ts`
- `apps/server/test/multiuser-recovery-policy-lifecycle.test.ts`
- `apps/server/test/multiuser-recovery-portable-file.test.ts`
- `docs/validation/multiuser-policy-personal-archive.md`
- `docs/validation/multiuser-recovery-lifecycle-seams.md`
- `scripts/validation/recovery-file-generation-container.ts`
- `scripts/validation/recovery-policy-container.ts`

Seven are test/fixture/runner sources and two are validation reports. The three test files cover actual issued-HTTP SIGKILL/unknown consent, same-account plan/erasure/relogin/disable boundaries and current incarnation/ticket/delete-intent recovery. These cannot be counted as a full original suite included in PR159. The new C2 complete-recovery driver and its passing receipts exercise overlapping boundaries but do not automatically substitute every old assertion.

Concrete self-contained-source gap: `docs/validation/final-c2-recovery-sources/prepare-compiled-http-driver.mjs.source:14` reads `/Users/utopiafar/Documents/Codex/2026-10-17/task-7/mote/apps/server/test/multiuser-recovery-http-seams.test.ts`. That input test body is not in PR159. The snapshot README permits path-only adaptation but does not supply the missing body. Recommend retaining the exact prerequisite test source/fixtures (or a reviewed self-contained successor and explicit mapping), updating repeat instructions to owned checkout paths, and running the affected test list on the resulting candidate. This audit does not import tests or rerun recovery.

PR153 inherits those nine absent paths from PR150. Its own `docs/validation/ask-actions-wait-closure.md` is additionally absent. Preserve the exact seven-commit manifest, historical full-gate failures, independent52-case release receipt and source fingerprints via a durable document or explicit immutable link. Do not whole-merge PR153 to obtain that report and accidentally overwrite newer union contracts.

### PR154 publication receipt

The authorization test body is exact. `docs/validation/ask-processing-authorization-seam.md` in C2 retains an older ending that says no Draft was opened while checks were RED. The current PR154 document adds the actual authorized test-only publication and precise missing consumer/type/i18n prerequisite attribution. That historical addition is absent in C2. Reconcile the report or link to its exact head `6010cfa9`; preserve original RED attribution and do not imply that its publication branch was the tested runtime. No test/source change is proposed.

### PR156 newer documentation

`docs/validation/multiuser-m13-statement-lifecycle.md` is absent. Later `70fc1888` updates in the Coding/current-composition/KEEP matrix documentation are also older in C2. Retain or explicitly link the exact lifecycle-fix consumption and final KEEP-gate receipt before closing PR156. The production lifecycle fix and exact tests are already selected, so this is a traceability/document gap, not a second runtime bug.

## Independent PRs to retain

- PR143 actually changes appearance stores/tokens, selectors, native Android themes/splash, Desktop/Web appearance bootstraps, appearance tests and the cross-platform appearance ADR. It is explicitly excluded; no theme selection or closing is part of multiuser consolidation.
- PR145 changes main-based Lark revision/evidence stability, its dedicated regression and audit.
- PR146 changes main-based conversation lineage/history retention, evidence reader/store, related Web/Agent contracts, dedicated tests and the evidence-history ADR.
- PR147 changes main-based Gmail provider-counter evidence stability and provider regressions.
- PR148 changes main-based derived-cache/Memory retention and its dedicated test/ADR. These are independent principle reviews, not superseded merely because scoped implementations have similar filenames. Their absent tests/ADRs are expected exclusions, not multiuser omissions to import blindly.

## Safe close sequence after a later explicit release

1. Finish actual Web journeys and resolve the stated gaps without rewriting historical source/results. If production or executable-test inputs change, freeze a successor manifest and rerun affected consumers; documentation-only reconciliation needs documentation review.
2. Refresh every open PR head and target before any close. A moved head invalidates this row until its new delta is checked. Confirm the final PR contains all necessary code, tests and design as one independent review.
3. Wait for the parent's explicit post-acceptance release. Close only mapped, fully covered multiuser PRs as superseded by159; retain branches and commit history. Do not merge them one by one, merge main/integration, delete branches or enable CI.
4. Use a short factual closing note linking PR159, the exact consumed head/mapping and final accepted candidate/receipt. Explain that the module is consolidated and that historical failed gates remain attached to their original SHA. PR143/145-148 remain open; PR159 remains the review target.

No closing note was posted in this preparation. Current status remains `AUDIT_ONLY_NOT_AUTHORIZED_TO_CLOSE`.
