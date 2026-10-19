# Plugin extension benchmark: independent baseline evaluation

## Candidate and scope

- Frozen production candidate: `2c78ca8d52a7d17fae20962cf68d09a717ffc73a`.
- Evaluation date: 2026-10-19 UTC. Runtime: Node `v24.19.0` on Linux.
- Evaluator focus: E02 presentation, E03 Central versus edge privacy/model boundaries, E04 native DSH plugins, and E10/E11 lifecycle and owner isolation.
- The evaluator changed no production source and made no commit. The integration branch retains its [reproducible probe](../../../apps/server/test/fixtures/extension-baseline-probe.mts) and [original outcome receipt](baseline-probe-results.json). The archived probe only changes repository-relative imports and optional report output from the originally executed harness; its negative assertions are unchanged. Raw log names below identify the original local evaluation session.
- Read-only baseline documentation refers to the frozen Git objects. Documentation changes made concurrently by the optimizer are excluded from these baseline conclusions.

This is a capability audit with focused execution evidence. It is not a completed set of independent implementations for E02–E04. Full-case NISR, pass@1, token cost, and cost per successful extension are **NOT MEASURED** here. Successful assertions about a lower-level contract do not make a complete extension case pass.

Severity in this report: **S1** blocks a required extension journey; **S2** limits distribution, discoverability, diagnostics, or validation coverage; **S3** is minor documentation friction. No S0 security failure was established by these probes.

## Principal findings

| Finding | Observed result | Classification |
| --- | --- | --- |
| The current process accepts the old executable-module configuration without loading the modules | A real `src/index.ts` process parsed one `plugins.backendModules` and one `plugins.fileProcessorModules` entry, returned healthy `multiuser-auth`, had an empty installed package catalog, and never executed a top-level marker in the generated module | **FAIL, S1** for that advertised installation path. Stale documentation is a separate friction problem; documentation cannot make the ignored loader execute |
| Current generic worker registration and actual domain availability are separate | A compatible generated ZIP installed, its factory ran during check, and the instance became checked/enabled. `generated.model`, `generated.card`, and `generated.memory` remained `unsupported`; invoking each over real HTTP returned `503 {"error":"execution_unavailable"}` | **FAIL, S1** for generic model/UI invocation through this path. This does not reject Memory's separate domain-provider route |
| Native DSH `apply(ctx)` and Mote worker factories are different ABIs | A generated native-shape `apply(ctx)` module packaged in a valid Mote ZIP installed, but its real worker initialization failed: check returned HTTP 502 and the instance remained unchecked | **FAIL, S1** at the native-plugin loading gate. A real third-party distribution and its dependencies were **NOT RUN** |
| Trusted presentation replacement is implemented and consumed | Shared, Web, and desktop tests exercised role changes, renderer replacement, draft/focus/selection preservation, fallback, and disposal | **PASS** for the tested contracts; **PARTIAL** for E02's whole cross-platform extension journey |
| Explicit Central local model configuration has a working execution path | Named loopback OCR service routing passed. A separate real production-process Ask test used DSH and a loopback mock language model, recovered process death, preserved fixed A/B model snapshots, and rejected cross-user artifact access | **PASS** for these routing/recovery contracts; **PARTIAL** for E03-Central as an end-to-end privacy extension |
| Edge upload review is an owner-configured literal rule gate | Desktop tests passed literal matching and persisted quarantine behavior. Android source implements the same literal-rule shape. No local semantic-model provider or plugin decision callback is exposed by that gate | **FAIL, S1** for model-driven edge preupload extension through the examined public interfaces. Native execution is **NOT RUN** |
| Source worker lifecycle and owner scopes work in the actual composition | Nine source tests passed real worker calls, original bytes, source restrictions, pause, stop, grant withdrawal, deletion, account disable, and restart with a second user continuing | **PASS** for that tested host-mediated source contract; E10/E11 remain **PARTIAL** overall |

## Runtime boundary map

### Production versus older assemblies

[`apps/server/src/index.ts`](../../../apps/server/src/index.ts) calls `buildScopedApp`. [`apps/server/src/app.ts`](../../../apps/server/src/app.ts) re-exports that function as `buildApp`, so current tests importing `buildApp` can exercise the correct composition. The name alone is insufficient: their options and post-construction registrations must also be inspected.

[`community-plugin.test.ts`](../../../apps/server/test/community-plugin.test.ts) constructs `Store`, `ProcessingRuntime`, and `FileProcessorRuntime` directly. Its external text-normalization example can demonstrate those components' contracts, but it does not establish that the current process installs that module through deployment configuration. This evaluator did not count it as production-extension acceptance.

The current configuration parser still reads and validates `plugins.backendModules` and `plugins.fileProcessorModules` in [`config.ts`](../../../apps/server/src/config.ts). `buildScopedApp` does not consume these two module lists. The negative process probe is stronger than a search result: its module contains a top-level file write, so the marker would be created even before any plugin callback or ABI-specific code ran. The process started, authenticated, served HTTP, and shut down normally without that marker.

This distinction matters to the docs-only round. Directing authors to the actual worker path can reduce failed attempts. It cannot restore the old module-loader capability or let a worker install arbitrary trusted host adapters.

### Public install and use sequence

The live administrative path is resolve a fixed GitHub release, verify its manifest/archive, install the package, configure an owned instance, check exact runtime registration, enable, admit a snapshot, and invoke a permitted component. The concrete contracts are [`plugin-release.ts`](../../../apps/server/src/plugin-release.ts), [`scope/plugin-routes.ts`](../../../apps/server/src/scope/plugin-routes.ts), [`scope/plugin-contract.ts`](../../../apps/server/src/scope/plugin-contract.ts), and [`scope/plugins.ts`](../../../apps/server/src/scope/plugins.ts).

The generic release has `runtime: "worker"`, a relative entry, SHA-256-pinned ZIP, declared capabilities/components, and bundled dependencies. The installer does not run npm or shell installation scripts. [`plugin-worker.mjs`](../../../apps/server/src/plugin-worker.mjs) imports the entry and selects `createMotePlugin` or `createMemoryProvider`. A native DSH `apply` export is not one of those factories.

Ordinary users configure already installed packages. Runtime source methods are bounded by a host-fixed source grant. A `PluginDomainAdapter` is trusted host registration; it is not a method available to the installed worker. Components cannot create their missing host authority just by declaring `model`, `ui`, or `repository`.

The independent probe used the existing generated-release transport to supply exact, local release metadata and ZIP bytes. The real public HTTP control routes, manifest parsing, archive validation, persisted package install, instance state, worker subprocess, and failure responses all executed. **Public GitHub networking and third-party release provenance were not exercised.** The transport substitution is disclosed and prevents these tests being called a complete external-distribution journey.

### Native DSH loading

[`packages/agent/src/index.ts`](../../../packages/agent/src/index.ts) writes Mote's frozen built-in bridge plugin into each agent runtime and constructs a fixed DSH patch. It loads bundled attachment/skill/context plugins; it exposes no deployment setting that forwards arbitrary native DSH plugin packages into this composition. The import agent similarly chooses its own fixed plugin set.

The generated `apply(ctx)` probe isolates the ABI gate without requiring a network-installed community package. It is a negative compatibility control, not proof that a particular community package or its services were attempted. Even after adding a valid Mote manifest around that native module, initialization fails before tool registration or invocation. E04 cannot pass “unchanged native plugin install and use” on this public worker path.

## Case assessments

### E02: theme tokens and layout implementation

The shared [`UiPresentationHost`](../../../packages/shared/src/ui-presentation.ts) supports exact identity/version registration, atomic activation, disposal, and built-in fallback. The live Web entry imports `PresentationSurface`; its [`presentation.tsx`](../../../apps/web/src/presentation.tsx) keeps business content in a stable portal container. The desktop [`presentation.ts`](../../../apps/desktop/src/presentation.ts) owns a resource scope for trusted renderers and restores host nodes on renderer failures.

Executed evidence:

- Shared: 4/4 tests, including native generated-asset consistency, atomic activation, complete token/navigation validation, and removal fallback.
- Web: 1/1 actual React/JSDOM replacement test. It retained the textarea node, unsaved value, focus, selection, and URL hash; theme changes did not remount the draft lifecycle.
- Desktop: 6/6 presentation tests using the real collector HTML and presentation implementation in JSDOM. These covered replacement, duplicate-listener avoidance, partial setup failure, throwing cleanup, update failure, and dispose failure.

The frozen [`UI presentation ADR`](../../../docs/adr-ui-presentation-packs.md) explicitly defines trusted platform bundles. New native renderer code requires a build. [`NativeUiPacks.kt`](../../../apps/android/app/src/main/java/dev/mote/collector/NativeUiPacks.kt) permits only bundled code registration and rejects unsupported native layout preferences. An Android rebuild is an expected platform distribution cost under this contract, and should be counted separately from changing host business logic.

There is no owner-facing theme-pack distribution or selection policy introduced by these contracts. A server `ui` component cannot install React, HTML, or Android renderer code. These are product boundaries to report, rather than evidence of a broken theme registry.

**Result: PARTIAL.** The tested platform contracts work. A newly authored external pack, a trusted Web build consuming that pack, an actual headless browser interaction run with it, Android native interaction, physical-device behavior, and cross-platform distribution were **NOT RUN** in this evaluator's baseline. JSDOM tests and generated Android assets do not fill those gaps.

### E03-Central: sensitive processing with self-hosted models

The current model settings allow a custom supported protocol/base URL. Explicit unauthenticated local access is restricted to loopback; the model belongs to the Central host or its container. [`scope/model-resources.ts`](../../../apps/server/src/scope/model-resources.ts) preserves exact personal/shared references and fixed resource generations. This supports useful configuration without installing a new model-provider plugin.

The named-image-service test sent generated image bytes over actual HTTP to each owner's own loopback mock OCR endpoint, checked the resulting indexed text, and asserted exactly the intended A/B endpoint and credential pair. It had no global OCR selection to fall back to.

The production Ask test ran the real `index.ts` entrypoint, HTTP authentication/intake/query APIs, DSH processes, SQLite, generated originals, and loopback mock Anthropic-message responses. It killed the server during admitted child work, restarted it, completed both users' queries, and checked fixed model snapshots, usage receipts, non-replay of successful children, and cross-user result isolation. Models were mocked; the surrounding transport, runtime, tools, storage, and recovery were real.

These successes do not prove that a plugin classifies arbitrary sensitive content before all other consumers, redacts it correctly, or enforces a universal egress policy. The public generic `model` worker capability lacks a production adapter. A trusted worker making its own unrestricted fetch call would not demonstrate use of the host's model authorization and usage contracts.

**Result: PARTIAL.** Explicit Central local endpoint execution is verified. A full model-driven privacy policy extension, fault handling that proves no sensitive fallback to a cloud endpoint, and all ingestion/consumer variants remain **NOT RUN**. No live model quality claim is made.

### E03-edge: local model before collector upload

[`apps/desktop/src/upload-gate.ts`](../../../apps/desktop/src/upload-gate.ts) accepts `enabled`, an explicit literal `blockedText` list, and `failureAction`. It obtains OCR text through a fixed recognition call, checks literal inclusion, then allows, drops, or holds. [`UploadGate.kt`](../../../apps/android/app/src/main/java/dev/mote/collector/UploadGate.kt) has the same contract. Current collector call sites invoke these gates directly.

The five desktop gate/queue tests passed: no OCR when rules are absent or disabled, literal matching, configured failure action, validation bounds, and quarantine surviving retry/restart until explicit owner review. This is good evidence for the existing deterministic privacy feature. It supplies no model provider, asynchronous semantic decision callback, or installed plugin identity to the gate.

**Result: FAIL, S1 for the requested no-core-change semantic edge extension at this boundary.** A new native implementation could be developed, but the baseline does not expose the required installable model interception contract. Android execution, a Mac native helper, actual capture/upload, and physical devices were **NOT RUN**; no personal captures were used.

### E10: composition, version changes, stop, restart, and uninstall

The nine production source tests are the strongest direct evidence because they use the unmodified source binder. Their real workers called receive/read/page/publish functions and exercised denied cross-source calls, pause-drain, stop, grant narrowing, plugin deletion, ingress deletion, account disable, and restart. A second user continued to use its independent instance and original bytes.

The 21 general plugin tests also passed. They cover version-pinned configuration/history, uninstall references, probe directory isolation, generation changes, stop/reinstall, physical worker shutdown, result fencing, callback completion, recovery, and data relocation. Their fixture registers extra repository/retrieval/UI adapters after app construction; several individual tests add a model adapter. Their success is evidence for the host's lifecycle machinery with supplied adapters, not full availability of those adapters in the ordinary app.

The extra real-process Ask test passed process-death recovery and retained model snapshots. This is host recovery evidence for a built-in task family, not a demonstration of a third-party plugin's arbitrary upgrade migration.

Source inspection also finds that the baseline [`WorkerPluginRuntime.call`](../../../apps/server/src/plugin-runtime.ts) checks `AbortSignal` before and after an RPC but does not send a per-call cancellation message. The child creates an abort controller for each call and aborts controllers when its input closes. Stop/generation retirement can close a worker, but passing a signal alone is not a cooperative per-call cancellation protocol. The root evaluator is independently probing that issue; this report does not reuse its unseen output as an executed result.

**Result: PARTIAL.** Tested owner/version/publication fences pass. A complete new-plugin upgrade journey, in-flight per-call cancellation, compatibility across changed base versions, and external unknown-write reconciliation for the new plugin remain outside this report's completed acceptance.

### E11: owner isolation

The source tests used equal instance IDs, equal source IDs, equal external input IDs, and distinct private contents for A and B. They validated exact original bytes, source restrictions, no foreign result publication, revocation affecting only A, and restart preserving the scopes. The Ask process test checked cross-user artifact refusal and model traffic excluding the other user's private source content.

The worker is explicitly trusted executable host code. Process-separated storage directories and bounded RPC prevent accidental host-mediated context mixing; they do not form a malicious-code filesystem/network sandbox. This report establishes no adversarial worker isolation or permission enforcement beyond the examined host API paths.

**Result: PARTIAL overall; PASS for the executed host-mediated owner/source isolation journeys.** Two independent new plugins, their own persistent data model, all permission combinations, and malicious-code containment were not accepted as passing by this audit.

## Executed checks and reproduction

All commands ran from the frozen repository root unless otherwise stated, using the runtime Node bin directory on `PATH`. No complete repository check suite was launched by this evaluator.

| Command or probe | Result | Raw log |
| --- | --- | --- |
| `node --import tsx --test --test-reporter=tap --test-isolation=none --test-timeout=120000 apps/server/test/multiuser-plugin-ingress.test.ts` | PASS 9/9, about 19.6 s | `evaluator-r1/scoped-ingress-retry.tap` |
| Same Node flags, `apps/server/test/multiuser-plugins.test.ts` | PASS 21/21, about 29.7 s | `evaluator-r1/scoped-plugins-retry.tap` |
| `node --test --test-reporter=tap --test-isolation=none packages/shared/test/ui-presentation.test.mjs` | PASS 4/4 | `evaluator-r1/shared-presentation-retry.tap` |
| `node --import tsx --test --test-reporter=tap --test-isolation=none apps/web/test/presentation.test.ts` | PASS 1/1 | `evaluator-r1/web-presentation.tap` |
| From `apps/desktop`: `../../node_modules/.bin/vitest run --maxWorkers=1 --testTimeout=15000 test/presentation.test.ts test/upload-gate.test.ts` | PASS 11/11 | `evaluator-r1/desktop-presentation.log` |
| Named test `an explicit named image profile leases only its complete owned service without a global OCR fallback` in `multiuser-processing-policy-page.test.ts` | PASS 1/1 | `evaluator-r1/central-local-model.tap` |
| Node test flags above, `apps/server/test/multiuser-ask-process.test.ts` | PASS 1/1, about 53.1 s | `evaluator-r1/ask-production-process.tap` |
| `node --import tsx apps/server/test/fixtures/extension-baseline-probe.mts` (archived portable entry) | Three negative capability controls reproduced as expected; target capability outcomes are FAIL | Original `evaluator-r1/probes.log`; retained [receipt](baseline-probe-results.json) |

The final selected test runs contain **48 passing tests**. This is a focused regression count, not 48 successful extension trials or a full no-regression certification.

Initial sandbox runs failed because child-process execution returned `EPERM`; the Node process-isolated reporter collapsed several failures to a file-level message. The shared asset test exposed the specific `spawnSync ... EPERM`. Authorized local process escalation and explicit TAP/nonisolated runs resolved this environment blocker without changing production code. Those initial attempts are **BLOCKED (environment)**, not architecture failures. The standalone evaluator harness initially needed its extension changed from `.ts` to `.mts` so its top-level await was compiled as ESM; this was a harness correction, not a Mote fix.

## Optimizer implications

The docs-only round should explain current versus old assembly, publish the exact worker manifest/factory/RPC sequence, distinguish declared/checked/domain-available states, give scoped source/processor examples, and clearly identify trusted-build presentation distribution. It should also state that current user-visible plugin check verifies registration and does not install missing domain adapters.

A capability round is needed to make ignored module configuration executable or reject it explicitly, provide any chosen missing host-domain bindings, load supported native DSH plugins with explicit service/tool admission, or add an edge model decision interface. These are design choices with authorization and lifecycle consequences; they cannot be credited as documentation fixes.

The strongest cross-case lifecycle candidate is an explicit per-invocation cancellation contract with durable publication fences retained. Successful worker termination must stay distinct from proof that a remote mutation was rolled back. A later evaluator should rerun independent plugin journeys on the new base, retain negative controls that declare unsupported capabilities, and report any remaining native/external-distribution limitations explicitly.
