# Published Round 5 independent evaluator

This is the archived evaluator for the first frozen `final-pack` submission against Mote candidate `88fb30af6cc70d369625f4b1350e78f01e207650`. The financial inputs and expected values were committed by hash at **2026-10-19 19:12:32 UTC**, before the Round 5 Iterator was assigned. The Iterator froze its package at **19:31:32 UTC**. These inputs are now public regression fixtures; later runs are not fresh hidden trials.

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

The runner always enforces the submitted package's complete frozen file hash map. It also compares the 521 source/package-manifest hashes in `frozen-production-sha256.json` and records all differences. Normal CI runs continue against changed host code and execute the same behavioral assertions. For strict reproduction of the frozen source identity, set `R5_REQUIRE_FROZEN_SOURCE=1`; any differing or missing source file then rejects the run. A later Git commit that changes only documentation or tests can retain the same checked production bytes. A regression against changed production code does not count as the original trial. This mode switch changes only source-identity enforcement, not the plugin hash checks, independent oracle, host behavior or benchmark gates.

## What executes and what is substituted

`http-runtime.mjs` starts the shipped `apps/server/src/index.ts` server, initializes actual Accounts, logs in over HTTP, installs verified generated release ZIPs, and uses public APIs for configuration, snapshots, tasks, ingestion and reads. Real workers, Original storage, Material publication, Transcript staging and lifecycle authority execute normally. The harness performs an actual process termination and starts another process over the same vault.

`release-preload.mjs` substitutes generated GitHub release transport responses. The host still performs release resolution, digest verification, archive extraction and package installation. Unmatched non-loopback `fetch` requests are rejected and recorded. This is a transport fixture, not a simulated host.

The only replacement inside the submitted finance package is its explicitly replaceable `semantic-mock.mjs`. `semantic-service.mjs` receives the actual authorized `originalRef`, `sourceId` and exact UTF-8 Original text. It verifies that text against the independently serialized, admitted SourceItem and its host-returned hash, and returns per-observation extraction facts from the sealed fixture. It never supplies aggregates, final ledger bodies, Material IDs or task results. The submitted source code performs pagination, deduplication, refund linkage, month filtering, arithmetic and publication. The normal processor performs real Transcript staging.

`finance-oracle.mjs` derives comparisons from the sealed transaction and observation records. It checks cents, month membership, refund references, full identity sets, deduplication evidence refs, all input hashes/capture refs and real Material member lineage. Complete source consumption is independently checked; `pagesBySource` remains plugin-reported telemetry rather than a host RPC trace.

## Calibration and scoring

The calibration phase actually installs and executes positive publication, plausible-success/no-publication, hardcoded-visible-answer, foreign-owner and late-publication specimens. The core-intrusion specimen is an executed synthetic diff audit and never changes the host checkout. An additional text Transcript check and separate-process restart verify the calibration harness.

The boundaries phase makes actual public loading/admission attempts. HTTP rejection of the unchanged native `apply(ctx)` package and of an extension-owned automation policy is an expected test observation. Thus the regression test can pass while the corresponding benchmark capabilities remain **FAIL / NO_EXTENSION_POINT**. No native tool or extension scheduler callback is claimed to have executed.

The final phase exercises the frozen finance/source and text/processor submission, owner isolation, exact package versions, restart, disable, grant revocation, stop and cancellation where the run reaches those steps. A `RUN_COMPLETION` record is required before crediting the complete bounded sequence. A failed or interrupted run does not earn later steps merely because they exist in the script.

The frozen full-case and probe assertion lists remain authoritative. Source ledger publication does not establish the complete financial insight/query/UI journey. Text Transcript staging does not establish the image-provider case. Referenced uninstall rejection does not establish history after successful package removal. The foreign event-cursor substitution, both-users-held/revoke/restart combination, and model-resource export/restore branches are not covered by this evaluator. Browser/native/device/live-model coverage remains **NOT RUN**.

## Provenance and earlier interruptions

`seed-commitment.json`, `private-seed.hex` and `private-held-oracles.json` are the original frozen bytes, now published. The names preserve their historical provenance and do not indicate current secrecy. Only `final-initial` was used for the initial submission; the two repair reserves were never supplied to the Iterator. `freeze_oracle.py` preserves the original generator source and its committed hash. It is archival provenance, not the replay entry; it contains its original paths and creates a new random commitment if run.

The associated Round 5 report preserves two evaluator setup/scope mistakes and two actual fresh-vault SQLite failures. The evaluator corrected new-configuration ordering to `desired:false → check → enable`. It also corrected its disable oracle to permit only the ordinary processed Material of the deliberately ingested new capture, while checking that every earlier Material ID/revision remains unchanged and no extension extraction runs. Neither correction changed plugin bytes or expected financial values. The observed database crashes remain host failures with an unresolved cause; a later passing replay does not erase them.
