# Main and multi-user integration regression

Run started 2026-10-17 and continued 2026-10-18 (Asia/Shanghai).
Status: awaiting the joint integration candidate. The final affected-component
gate, complete local-Codex acceptance, merge to `main` and new release are pending.

The owner requested merging `codex/mote-multiuser-integration` into `main`,
resolving conflicts, completing related acceptance work and repeating the full
regression with three parallel agents. The source inputs were main
`2c2627621e2598332ae8169845bc7343be7ed63e` and integration
`b26e797b5427fd089fa4fc4fa8b0cc45909f24af`.
The owner later requested waiting for the task “核查对话中的遗留问题”
(`01a14a43-6ce6-7730-8d3b-8cb9fb7ffa79`) to finish, then integrating both sets
of changes into `main` and publishing a new version together. Earlier source
snapshots and partial checks below are not a receipt for that joint delivery.

## Result and responsibilities

The merge keeps the production scoped composition, storage epoch 5 and wire 2.
The existing single-owner composition remains an explicitly imported algorithm
fixture. Eleven textual conflicts were resolved, and main's historical evidence
lifecycle and provider revision fixes were ported into the actual scoped
production consumers. See the [integration decision](../adr-multiuser-main-integration.md).

Historical answers retain their original prose and citations after ordinary
evidence changes, with a stale notice. Explicit evidence deletion retracts
dependent prose and research products, including inherited-only dialogue and
persisted workspace checkpoints. Source recreation cannot restore erased
answers. Retained host receipts do not grant model, tool or original access.

Regression exposed and fixed exponential duplication of identical inherited
proofs, summary/CAS retirement on disposable cache withdrawal, public CLI
readiness against the scoped health endpoint, and Desktop's missing historical
status notices. Web also corrects the existing avatar's long-username overflow
and prioritizes the deleted-without-result history notice. Exact tuple
deduplication keeps distinct revisions and receipts.
All confirmed product failures have durable regression scenarios. Test transport
and assertion errors are recorded separately from product failures.

## Source provenance and verification

The earlier frozen central checkpoint C3 is `6b4305bff5c7723562b88990395c6d87759cea95`, tree
`4399f1ad15a5874f02bd8036de48220791171594`. Native and browser evidence records
the actual production inputs, generated fixture overlays and compiled artifacts
used by each process. Full-regression checkpoint F,
`b60ce1054ef74641ade0ee4e891ef40ee61e55f6`, tree
`6f63fc73196801e08011399aeaa17bbeded3e3b7`, adds only two test-fixture corrections
and the separately verified Desktop notice consumer. Central, shared, agent,
diagnostics, root scripts and dependency inputs are identical between these two
commits. F's failed full attempt is recorded below; the later repairs are
incorporated into the later J check of all three consumers. Committing
already checked bytes and documentation does not imply that earlier runs used
the later commit identifier.

Earlier source candidate J is `8be07ac9c1a01534b60f72d6694c994a17ed0324`, tree
`04e01b0d99d2b365de303a45d7914cc8ff04f92c`. It preserves F, the Work repair G,
the independent Web test H `5dd501af05664f678cf92e2255ea9bd4717199c6`, native
fixture/instrumentation correction I `3058b9018708103805f01a1787e4ae475a375d2c`,
and schema-boundary repair L `81146d55b93944d6e5443ac44f5a7ca06b05c4c1` as
ancestors. Both original main/integration inputs are also verified ancestors.
Only documentation was uncommitted during J's affected check; its production,
test, dependency and tooling inputs were frozen. J's check was later interrupted
at the owner's pause request and was not a successful full gate.

After integrating L, the root independently compared the complete installer
body (ignoring erased local TypeScript type syntax): both bodies have SHA256
`ce2bb2544e775923bd17db357df5c64e40ecd7bcb3a78e8053bcf425996a7a5c`.
The owner-enumeration SELECT, installation call position and savepoint are
unchanged. The new table inventory contains exactly six added surfaces; neither
checker nor its exception list changed. L passed 22 private-SQL/architecture
tests, Server typecheck and 16 real history/Work tests (no skips/cancellations).
The 12-turn proof case took 56.962 seconds and the Work HTTP journey 6.866 seconds.
These are source-specific L results. K subsequently removed the unsupported
legacy-history backfill and owner-enumeration helper under the MVP decision;
the current receipt-based history path remains, and missing receipts fail closed.

Fresh J Server compilation and scope/import checks exited 0. The root then ran
the actual public profile CLI against J's compiled Server: 1/1 passed in
5.686 seconds, including four real cold starts before account initialization.
J's `check:affected -- --base origin/main` ran with all other regression hosts,
renderers and emulators stopped. It was interrupted with exit 130 when the owner
requested a pause. The Server summary recorded 2,906 tests: 2,876 passed, one
failed, 27 cancelled and two conditionally skipped. The cancellation count is
part of the interrupted attempt, not passing evidence. Its real failed-child
retry case again exceeded the original 20-second completion poll (21.209 s
including setup), with the run still `running`. This failure was investigated
and repaired after resuming; it is not dismissed as an interrupted-only result.

| Additional actual runtime verification | Result |
| --- | --- |
| Independent scoped history regression | C3: 15/15 passed; real generated model-tool turns, owner-bound inheritance, cache withdrawal, restore, raw SQLite deletion/reopen, measured metadata and workspace erasure. L's later 16-case rerun is recorded above. |
| Independent security/recovery regression | C3: 14 files, 109/109 cases passed, zero skipped/cancelled. |
| Compiled HTTP, compiled attachment→personal export | C3: 3/3 and 1/1 passed. |
| Public scoped profile CLI | C3: 1/1 passed, including four actual cold starts before account initialization and foreign-port/PID refusal; the root repeated that public command successfully. J's fresh compiled-Server rerun also passed 1/1 in 5.686 seconds. |
| Fresh container recovery | C3: four actual runs passed: instance restart/recovery, file-generation recovery, policy recovery and Hindsight canonical PostgreSQL recovery. |
| Web | Six preference/OS appearance pairs, ten account-lifecycle groups and eight integrated functional groups passed, including actual history paging and citation readers. The final seven groups and history used separate isolated processes with the same frozen runner hash and successful source guards. |
| Desktop | The public `test:ui` entry passed after the final notice correction, including actual current→stale→deleted saved history, account/theme/queue/draft recovery and six cold plus six new-process appearance checks. |
| Android | Full non-live C2 matrix passed 80/80, 77 unique methods plus three variants. Primary history has seven GREEN executions and two expected old-helper RED controls; the additional Light→Dark account variant passed. Actual process death, paging/recreation, retained Work navigation, deletion and account replacement were exercised. C2→C3 changes only central workspace-erasure SQL and its test; Android production inputs are unchanged. |
| Additional retained algorithm checks | Privacy gateway 22 generated checks and explicitly legacy E2E/media E2E commands exited 0. Legacy composition checks are not presented as wire-2 production acceptance. |

Detailed Web journeys, source guards, generated confirmation handling and
test-only assertion corrections are in the
[Web report](main-multiuser-web-integration-2026-10-17.md). The
[independent security and recovery report](main-multiuser-security-regression-2026-10-17.md)
records exact runtime/image provenance, recovery journeys and resource cleanup.
The [client report](main-multiuser-client-integration-2026-10-17.md) binds Android
and Desktop executions to their actual source/APK bytes. The additional
[Web Work navigation report](main-multiuser-web-work-history-2026-10-18.md)
verifies the original Work link through stale history, deletion and B's positive
control; expired citation reads remain explicitly refused under the existing
current-evidence policy.

Earlier C/C2 gates were intentionally interrupted after further product fixes.
The first C3 full gate also exposed the existing 120-second thousand-original
Memory pressure-test deadline under simultaneous broad suites. It was stopped
with exit 130 after that failure. The duplicate fixture-delta gate was stopped
with exit 130 to release resources. These are retained failed/interrupted
attempts, never final passing evidence. The final gate uses the original test
budgets and four-file server concurrency with one broad driver.
The same thousand-original/125-reviewed-job case passed in 50.529 seconds in
that F attempt, without changing its 120-second deadline, input count or
coverage assertions.
The F Server attempt finished with 3,000 tests: 2,995 passed, three failed and
two conditionally skipped. The real failed-child retry journey hit its original
20-second completion poll (21.340 seconds including setup): the actual diagnostic
is `Ask timeout` with status `running`; after `delegation_retry`, its last events
show child `validating` and then parent `starting`. No terminal evidence/conversation error
was reported. The two other failures are architecture checks: newly added schema
installation/owner enumeration must remain in the existing schema boundary, and
the history/retirement tables need their exact inventory declarations. These
were corrected by L without broadening the SQL checker's exceptions. J's later
attempt was interrupted as recorded above. F's other workspaces naturally passed: Desktop 589,
Web 583, Agent 318 with one conditional skip, Shared 195, Diagnostics five.
Its nonzero workspace result prevented the subsequent root-script checks and
Android Gradle command from running. The failed F attempt is not counted as a
successful full regression.

The Android Work journey then found another production seam: after an ordinary
revision the conversation retained all 21 turns, but the completed Work detail
lost its archived-answer action because it depended on a strict current run
result. This differs from main's existing saved-conversation navigation contract.
An isolated follow-up, `2333ed61677e15957d6fd97c0cdd760bfbf47dcc`, adds only
canonical retained-turn navigation metadata and a fallback for that top-level
action. It does not relax current run/artifact/model reads or branch artifacts.
A real HTTP journey failed before the change and passed afterward, including
restart, source pause/resume, account disable/relogin, deletion and same-ID B
controls. It is separate from the earlier native Work attempts, which failed
before reaching their notice assertion and are not expected-control passes.

## Later candidates and outstanding joint validation

K is `53446e69c00ab5a64707fdd9f28f65f4532e7ce2`, tree
`07f25cd1650e1e77fe4dff7bdd7216e95587932d`. It removes the legacy-history
backfill and public legacy test aliases under the owner's MVP decision, keeps
missing retained-history receipts unavailable, avoids unused display-status
work during retained-root checks, and reuses compiled fixed validation queries.
Each authorization decision and database row is still read afresh. The original
retry test and its 20-second poll remain unchanged. The isolated K case passed
1/1 in 9.623 s, observing 17 generated-provider requests and six actual Harness
fragments. Preparation count fell by 99.0013%, while 1,133,474 fresh `get` calls
remained. The [retry performance report](main-multiuser-retry-performance-2026-10-18.md)
records both J diagnostics, their observation limits, K's combined changes,
source/artifact hashes and cleanup. These are generated transport results, not
live-model acceptance or a full K regression.

P is `fba648f15f30890a7610d27946ba4fc24c5d8ea5`, tree
`78ab498bca3d00f90de37cd907ed5aac52c9281b`. It adds first-run local development
profile initialization with `admin` / `admin`; this is development bootstrap
behavior, not production account initialization. P's consolidated targeted run
covered 18 files and 222 tests in 295.692 s: 221 passed, one failed, no skips or
cancellations. The original retry case passed in 9.567 s; the selected identity,
model-revocation, isolation, history, Work, private-SQL and architecture cases
also passed. Missing historical receipts remained unavailable across restart
and reads rather than being reconstructed or granting artifact access.

The sole P failure was the development-launcher fixture: its assertion expected
`firstAttempt.code` to be nonzero, but received zero. That run is retained as
failed. The development-server lane subsequently investigated and repaired the
fixture without changing P's production code. Its source-bound narrow rerun
naturally passed 1/1 in 13.627 s, verifying real compiled-Server startup,
first-run development accounts, client/Web authentication, strong-password
rules, restart preservation and refusal/cleanup paths. The
[development-server report](main-multiuser-dev-server-2026-10-18.md) records the
macOS path and Web-session fixture corrections, exact source/fixture hashes,
dirty release-metadata provenance and the generated npm-command limitation.
P's original targeted run remains failed; this narrow result does not establish
complete validation of P or the later joint candidate.

The scoped recording revision lane subsequently repaired metadata-only revision
conflicts and withdrew superseded speech through empty current snapshots while
retaining historical originals and stale answers. Its final narrow run passed
6/6 in 31.548 s on `831eb6d1bef5eb11d19d62b6f9447faacade6af4` plus three exact
file overlays; those bytes were later committed as
`4bd7f5cb7cf107d0a801142ccd2956535527e423`. The
[recording revision report](main-multiuser-recording-revisions-2026-10-18.md)
separates Q's original five-case RED, preparation/assertion errors and the final
consumer/history assertions. It records A/B controls, original-byte retention,
media reuse and the automatic-ASR admission limitation. Integration with the
related recording-flow work and final joint checks remain pending.

The local original-decoder F13 correction subsequently passed its independent
two-case regression (2/2, no skips; 4.528 s) on `ea66efa6` plus exact source/test
overlays, later committed as `722f40e2791a1474bac3afce7cdbac8c2f549a45`.
The [decoder settlement report](main-multiuser-local-decoder-failure-2026-10-18.md)
records the pre-fix RED, fixture corrections and hashes. It distinguishes
Fastify route injection and owner-bound module lifecycle ports from the actual
loopback HTTP ASR contrast and host-rebuild restart. This narrow result does
not establish the final combined gate or live-model acceptance.

| Retained local log | SHA256 |
| --- | --- |
| Interrupted J: `mote-main-multiuser-check-affected-final-J.log` | `c4571f7ccf99f68d4939a00a7ac55ac67682b78e93da126bee79487f69ee7acf` |
| Targeted P: `mote-main-multiuser-consolidated-focused-P-20261018.log` | `cbba1a3f1ecf6b595c6ac42271ab25d2c3aa58dd1c7f0cb02089f39e695520f7` |

The final joint source has not yet been frozen. Its complete local-Codex
acceptance, affected-component gate, GitHub merge readback and release-version
verification remain pending while the related task finishes. No earlier passing
fixture, native or container lane establishes those later outcomes.

## Current MVP gaps

The [business-flow audit](../audits/business-flow-parity-2026-10-18.md) records
current capability gaps separately from the owner's exclusion of old-version
migration and compatibility. In particular, these findings remain open:

- F02: the first receipt for a model lease does not establish complete accounting
  for failure/retry, yield/resume or interrupted fragments; Agent/module/skill
  attribution is incomplete. Totals are not a complete consumed-work ledger.
- F03: the scoped host does not enforce configured `retentionDays` or
  `maxStorageBytes`. Explicit original GC and snapshot expiry do not implement
  retention-date cleanup or the configured archive admission ceiling.
- F04: current original/Material candidate retrieval is scoped FTS/literal search.
  A scoped embedding/vector producer and hybrid ranking are not implemented;
  models still choose tools and interpret the evidence actually retrieved.

The recording tail/empty/unsupported revision fix addresses F10's stale current
projection subcase. The retained-history/equality integration addresses F12,
and known in-process decoder settlement addresses F13, within their receipts
above. These corrections do not close all 13 findings. F10's canonical recording
product/Memory model and F11's documented restore-only reauthorization decision
remain separate questions; the audit records other outstanding capabilities and
their individual scope. This report does not treat a passing regression gate as
implementation of those missing features or approval of a replacement policy.

## GitHub acceptance reconciliation

An independent read-only refresh at 2026-10-17 16:18:49 UTC found the same
main/integration input SHAs. PRs #143, #145, #146, #147, #148, #159 and #160
were all merged; none had unchecked Markdown acceptance items. PR #159's ten
current acceptance items were checked. Older pending notes are explicitly
superseded by dated acceptance at the top of those PRs. Open PR and issue
lists were empty. Delivery of this new main integration requires a separate
merged-PR readback, both input commits as ancestors and a main tree matching
the final reviewed documentation commit.

## Boundaries

All automated captures, documents, images, audio, accounts and providers are
generated fixtures. Browser and native UI checks use hidden windows or headless
emulators. No real personal screenshots were collected. Physical devices and
operating-system permission dialogs were not validated. Live-model checks need
separate source-bound receipts; complete acceptance using the local Codex server
for the final joint candidate remains pending. The Hindsight recovery check is a
storage and restart check with zero model calls, not a semantic quality evaluation.

The repository's Checks and Component checks workflows were manually disabled
before this work and remain disabled. Local checks and actual runtime exits are
reported separately from GitHub CI. Existing unrelated containers and volumes
are outside the test cleanup scope.
