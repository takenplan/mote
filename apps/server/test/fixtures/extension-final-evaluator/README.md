# Published Round 5 independent evaluator

The original evaluator for the first frozen `final-pack` submission against Mote candidate `88fb30af6cc70d369625f4b1350e78f01e207650` is preserved in immutable [archive commit `74da386f`](https://github.com/utopiafar/mote/tree/74da386f33adde6521d5dd3435bf9643da89f495/apps/server/test/fixtures/extension-final-evaluator). The financial inputs and expected values were committed by hash at **2026-10-19 19:12:32 UTC**, before the Round 5 Iterator was assigned. The Iterator froze its package at **19:31:32 UTC**.

This checkout contains current-host public regression orchestration. It follows durable asynchronous plugin-check receipts before enabling instances, and verifies failed native factory probes through the actual terminal task and unchecked instance. Financial oracles, seeds, submitted plugin bytes and historical reports/receipts retain their original identity. These runs are not unchanged frozen reruns or fresh hidden trials. Historical evaluator code-hash receipts describe the original archive commit, not the evolved orchestration in this checkout.

## Run from a clean checkout

Install the repository's declared dependencies and build the shared/agent dependencies as required by the normal server development instructions. Use a Node version supported by the repository. Then, from the repository root:

```sh
node --import tsx --test --test-concurrency=1 apps/server/test/extension-benchmark-final-evaluator.test.ts
```

The thin test entry exposes three separate tests, each with its own generated temporary directory and child process. The phases can also be executed individually:

```sh
node --import tsx apps/server/test/fixtures/extension-final-evaluator/run.mjs calibration
node --import tsx apps/server/test/fixtures/extension-final-evaluator/run.mjs boundaries
node --import tsx apps/server/test/fixtures/extension-final-evaluator/run.mjs final
```

Each command reports its output directory. It writes generated releases, synthetic vaults, redacted HTTP observations, semantic request/reply records, process observations and a phase receipt there. It does not update tracked fixtures or reports. These tests require permission to start real child processes and bind loopback HTTP ports.

`R5_OUTPUT_DIR` selects an output directory. `R5_CANDIDATE` selects another checkout. The default candidate path is derived from this file's location, and the default output path is a new operating-system temporary directory. There is no dependency on the original scratch checkout.

The runner always enforces the submitted package's complete frozen file hash map. It also compares the 521 source/package-manifest hashes in `frozen-production-sha256.json` and records all differences. Normal CI runs continue against changed host code and retain the financial, lineage, isolation and lifecycle assertions; check admission and completed verification are now asserted separately.

New phase receipts label `regressionMode: "current-host"`. Their `verification.actualCandidate` records the actual Git commit and whether the checkout is dirty; `verification.orchestration` records the executed harness file hashes. The legacy `verification.candidateCommit` field remains the original frozen production candidate, and `originalArchiveCommit` identifies the immutable original evaluator. A dirty checkout is explicitly reported and must be bound to the driver's exact input receipt for a final acceptance claim.

`R5_REQUIRE_FROZEN_SOURCE=1` still rejects differing or missing frozen production files. It does not establish historical harness identity. To reproduce the original source and orchestration, check out `74da386f33adde6521d5dd3435bf9643da89f495` and run its original entry with strict mode. No frozen hashes are rewritten to accept the current host; passing current regressions does not erase original failures or satisfy previously unexecuted benchmark requirements.

## What executes and what is substituted

`http-runtime.mjs` starts the shipped `apps/server/src/index.ts` server, initializes actual Accounts, logs in over HTTP, installs verified generated release ZIPs, and uses public APIs for configuration, snapshots, tasks, ingestion and reads. Real workers, Original storage, Material publication, Transcript staging and lifecycle authority execute normally. The harness performs an actual process termination and starts another process over the same vault.

`release-preload.mjs` substitutes generated GitHub release transport responses. The host still performs release resolution, digest verification, archive extraction and package installation. Unmatched non-loopback `fetch` requests are rejected and recorded. This is a transport fixture, not a simulated host.

The only replacement inside the submitted finance package is its explicitly replaceable `semantic-mock.mjs`. `semantic-service.mjs` receives the actual authorized `originalRef`, `sourceId` and exact UTF-8 Original text. It verifies that text against the independently serialized, admitted SourceItem and its host-returned hash, and returns per-observation extraction facts from the sealed fixture. It never supplies aggregates, final ledger bodies, Material IDs or task results. The submitted source code performs pagination, deduplication, refund linkage, month filtering, arithmetic and publication. The normal processor performs real Transcript staging.

`finance-oracle.mjs` derives comparisons from the sealed transaction and observation records. It checks cents, month membership, refund references, full identity sets, deduplication evidence refs, all input hashes/capture refs and real Material member lineage. Complete source consumption is independently checked; `pagesBySource` remains plugin-reported telemetry rather than a host RPC trace.

## Calibration and scoring

The calibration phase actually installs and executes positive publication, plausible-success/no-publication, hardcoded-visible-answer, foreign-owner and late-publication specimens. The core-intrusion specimen is an executed synthetic diff audit and never changes the host checkout. An additional text Transcript check and separate-process restart verify the calibration harness.

The boundaries phase makes actual public loading/admission attempts. The unchanged native `apply(ctx)` package is admitted for a durable check, whose actual task must become blocked while the instance remains unchecked. The extension-owned automation policy is still rejected at HTTP admission. Thus the regression test can pass while the corresponding benchmark capabilities remain **FAIL / NO_EXTENSION_POINT**. No native tool or extension scheduler callback is claimed to have executed.

The final phase exercises the frozen finance/source and text/processor submission, owner isolation, exact package versions, restart, disable, grant revocation, stop and cancellation where the run reaches those steps. A `RUN_COMPLETION` record is required before crediting the complete bounded sequence. A failed or interrupted run does not earn later steps merely because they exist in the script.

The first task observation after an actual SIGKILL and restart has a local 50-second budget: the existing maximum 30-second executor lease plus the ordinary 20-second task observation. Every other ordinary task observation remains 20 seconds, and the existing child/test limits remain unchanged. The explicit `confirmUnknown` retry, exactly-one Material/revision/replay checks and owner fences still apply. The restart record includes public task states and evaluator observation times before termination and after startup, the bounded wait elapsed time and final state. The public task DTO does not expose a lease; these fields do not invent one. A run that observes completed work before SIGKILL does not prove recovery of work with a still-valid lease. No publication gate, loader/IPC interception, production hook or plugin modification is used.

The current-host check at clean source `8d9740c7375816300045614557b812f851419288` exposed the previous 20-second observer's shorter budget. Its final phase failed at `2026-10-20T01:40:21.238Z` with task timeout `3c3da2a74f2c10b958722a27149eee7f423b0109e7c435423fde52c27fc4e268`: 628 public task GETs from `01:40:01.148Z` through `01:40:21.130Z` returned HTTP 200, `running`, attempt 1. A read-only copy of the stopped synthetic vault retained that task's lease through `01:40:30.064Z`, 8.934 seconds after the last GET; SQLite `quick_check` was `ok`. Existing execution code reclaims running work only after lease expiry. The earlier 34.857-second focused PASS observed `succeeded` on its first post-start task GET; that does not establish the order of SIGKILL and result commit, or prove that it exercised a still-valid lease. Neither run is rewritten as evidence of unobserved post-expiry recovery.

The associated combined check receipt `2026-10-20T01-35-20-830Z-ffc99684-c4c8-448b-9835-9a0ee31c1a24.json` records a deliberate interruption, exit 130 and confirmed cleanup: 14 preliminary stages passed, the Server stage was interrupted and eight later stages were unrun. Its actual R5 failure remains recorded separately. Later current-host passes do not replace this receipt or change the original experiment's failures and unknowns.

The frozen full-case and probe assertion lists remain authoritative. Source ledger publication does not establish the complete financial insight/query/UI journey. Text Transcript staging does not establish the image-provider case. Referenced uninstall rejection does not establish history after successful package removal. The foreign event-cursor substitution, both-users-held/revoke/restart combination, and model-resource export/restore branches are not covered by this evaluator. Browser/native/device/live-model coverage remains **NOT RUN**.

## Provenance and earlier interruptions

`seed-commitment.json`, `private-seed.hex` and `private-held-oracles.json` are the original frozen bytes, now published. The names preserve their historical provenance and do not indicate current secrecy. Only `final-initial` was used for the initial submission; the two repair reserves were never supplied to the Iterator. `freeze_oracle.py` preserves the original generator source and its committed hash. It is archival provenance, not the replay entry; it contains its original paths and creates a new random commitment if run.

The associated Round 5 report preserves two evaluator setup/scope mistakes and two actual fresh-vault SQLite failures. The evaluator corrected new-configuration ordering to `desired:false → check → enable`. It also corrected its disable oracle to permit only the ordinary processed Material of the deliberately ingested new capture, while checking that every earlier Material ID/revision remains unchanged and no extension extraction runs. Neither correction changed plugin bytes or expected financial values. The observed database crashes remain host failures with an unresolved cause; a later passing replay does not erase them.
