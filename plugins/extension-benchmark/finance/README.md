# E01 finance extension: independent round 1

Frozen host: `2c78ca8d52a7d17fae20962cf68d09a717ffc73a`.

This external worker exercises the current `buildScopedApp` production composition, the same composition called by `apps/server/src/index.ts`. It imports no private host API and modifies no core source. The test uses actual authentication, package integrity checks, installation, worker processes, scoped task execution, original reads, Material publication, persistence and public reads. HTTP is exercised through Fastify injection; this is not an actual listening-process or browser test.

## Result and boundary

The finance **source/Material probe is implementable** with zero core edits when the semantic model boundary is replaced by the explicitly requested deterministic fixture. The **full E01 requirement remains PARTIAL**: default host model access and an external automatic finance trigger are unavailable through the discovered current public worker path. No Memory publication or custom UI is claimed.

The worker has two modes:

- Default configuration calls the bounded host `model` capability after reading source evidence. Current source and processor adapters provide no such callback. A declared `model` component is reported as `unsupported` with `scoped_domain_unavailable`, and its invocation returns HTTP 503. Calling `model` from the executing source worker blocks the real task with `plugin_operation_requires_attention`.
- `configuration: {semanticFixture: true}` is a generated-data-only experiment mode. The semantic script is keyed by exact generated original text and returns transaction observations with the original refs received from the host. It makes no network request, computes no monthly total, publishes no Material and writes no host state. The external plugin performs all arithmetic, exact-ID deduplication, refund accounting and evidence validation, and calls the real `publishMaterial` API. This mode does not establish host model routing, model authorization, model metering or semantic quality.

The historical local `backendPluginModules` path is also reproduced separately: a module-import sentinel is never created by the current production composition. The old `moteContextProcessors` / `moteMaterialConsumers` documentation therefore cannot be used as evidence that the shipped scoped application loads that extension.

## Generated inputs and oracle

The independent Case Designer's public `finance-visible-v1` data in [cases.json](../../../docs/validation/plugin-extension-benchmark/cases.json) supplies all 43 observations: 20 CSV row documents, 15 payment notices and 8 billing emails. Each observation is a separate original. Four observations are nontransaction noise; 39 transaction observations represent 23 unique transactions and 16 duplicate mentions. All payments total USD 1,005.68 and refunds total USD 60.00.

| Accounting month | Expected net consumption |
| --- | ---: |
| August 2026 | USD 12.34 |
| September 2026 | USD 833.35 |
| October 2026 | USD 99.99 |
| Total | USD 945.68 |

Refunds count in their recorded refund month. September charges total USD 893.35 and its two refunds total USD 60.00. The August and October transactions exercise month boundaries. The original CSV and cross-source duplicate mentions remain in the lineage.

Each refund also retains its supplied `refundOf` original charge identity in the deduplicated and persisted ledger. The plugin resolves that identity against the complete authorized transaction set, before grouping by month or publishing. Missing/noncharge targets and contradictory duplicate refund links are rejected. A refund and its original charge may be in different accounting months.

`case-input.mjs` copies only the Case Designer's canonical transaction rows and observation mapping, without its aggregate expected values. `oracle.mjs` is a literal self-test oracle that is **not bundled in the plugin ZIP**. Its totals are independently checkable from the public transaction rows. An independent Evaluator should calculate its own oracle and replace the semantic script with corresponding exact-input replies for any held-out variation; it must not feed the aggregate answer to the plugin.

## Run

From the repository root with Node 24 and built workspace dependencies:

```sh
node --import tsx --test apps/server/test/extension-benchmark-finance.test.ts
```

The normal test command asserts the observed baseline limitations as well as the successful partial finance path. A green test run therefore means the baseline report is reproduced; it does not turn E01 into a full PASS.

To demand full E01 extension reachability and reproduce the intentional architectural failure:

```sh
MOTE_FINANCE_REQUIRE_COMPLETE=1 node --import tsx --test apps/server/test/extension-benchmark-finance.test.ts
```

To retain a credential-free execution report:

```sh
MOTE_FINANCE_REPORT=/tmp/mote-finance-r1.json node --import tsx --test apps/server/test/extension-benchmark-finance.test.ts
```

The environment used for this trial required worker-capable execution permission; a sandbox that prevents child-process stdin/stdout cannot validate the worker path.

## Public installation sequence

The generated release transport supplies a fixed manifest and ZIP in place of GitHub bytes. It is the only replaced remote-service boundary; normal ZIP digest validation, extraction, package catalog installation and worker startup execute. No live GitHub publication is claimed or required by the test.

1. An administrator resolves and installs the generated fixed release through `/api/plugins/resolve` and `/api/plugins/install`.
2. The owner creates three archive sources through `/api/ingress/sources` and sends generated originals through the existing `/items` route.
3. The owner creates an instance with source/model grants and the exact source IDs, checks it, enables it and obtains a task snapshot.
4. The source component reads the granted originals and emits an owner-scoped evidence-read receipt. An explicit analyze invocation uses the selected semantic mode and publishes the monthly Materials.
5. Results are read through `/api/materials/:id`, `/read` and `/members`. Foreign-owner reads fail. Disabling refuses fresh snapshot admission while originals and completed insight Materials remain readable. Source-grant withdrawal invalidates the old snapshot.

The worker supports only bounded explicit invocation. No private scheduler, automatic scan, extra database, authorization service, key-copying or model fetch is introduced.

## Coverage

The automated probe verifies installation/check/enable, actual worker execution, all 43 originals, exact month totals, 23 unique transactions, duplicate lineage, refund accounting and persisted original-charge links, host-validated Material parents, public body readback, owner isolation, ungranted-source rejection, fresh admission refusal after disable, preserved historical Materials and receipt invalidation after source-grant withdrawal. Focused E01.3 cases cover cross-month links, input ordering, duplicate evidence, missing targets and conflicting links.

Not run: an actual Central listening process, a custom automatic trigger, restart, upgrade, uninstall, in-flight cancellation, Memory publication, browser rendering, native devices, live GitHub download and live model inference. These remain explicit full-case gaps and cannot be inferred from the source probe.
