# Plugin and MCP parity validation, 2026-10-18

Base: `2c78ca8d52a7d17fae20962cf68d09a717ffc73a`.
Branch: `codex/parity-extensions-20261018`.
Worktree: `/Users/utopiafar/.codex/worktrees/parity-extensions-20261018/mote`.
This ledger records implementation work; it is not independent acceptance or an
integration/main delivery claim. The [ADR](../adr-extension-journey-parity.md)
records KEEP/CHANGE/REMOVE/EXCEPTION/UNKNOWN and superseded assumptions.

## Journey mapping

| Audit item | Actual production entry and regression |
| --- | --- |
| EXT-E01 | Plugin HTTP disable → direct administrator uninstall; disabled own unreferenced instances retire through ConfigService. Enabled/foreign declarations and actual own/foreign retained snapshots still protect the shared package. |
| EXT-E02 | `multiuser-plugin-capability.test.ts`: real Mem0 check against generated loopback embedding HTTP A200/B500 before any binding, plus a worker lying about health; restart preserves the result without another call. Durable `plugin.check` validates registration then actual owner-bound provider recovery/canaries. Capability/issue/observed feedback precedes enablement. Generated workers implement real immutable replay/restart behavior rather than only advertising health. |
| EXT-E03 | `multiuser-mcp-one-shot.test.ts`: reference import pages remote `resources/list`, keeps page-two name/MIME, falls back only for absent metadata, and records **zero** resource-body reads. Held metadata cannot publish after account/source revocation. |
| EXT-ES01 | `multiuser-mcp-stateless.test.ts`: original no-initialize/no-session POST read/write/resource calls, A/B identical IDs, optional SDK sessions, restart, credential/account/source epochs and held provider/disconnect fences. Existing actual process test adds raw calls before/after SIGKILL. |
| EXT-ES02 | `multiuser-mcp-one-shot.test.ts` and Web `multiuser-mcp-one-shot-renderer.test.ts`: original draft target → discovery with no configuration/source writes → select → source creation/import. Both one-time and saved targets call the same scoped importer; configuration/raw YAML/export contain no one-time credentials. A/B, retry, restart, shrinking membership and late results are exercised. |
| EXT-EC01 | `multiuser-mcp-optional-discovery.test.ts`: official SDK 1.30.0 low-level `Server` with `resources: {}` and resource-list/read handlers, no templates handler, over actual Streamable HTTP. SDK `McpError(-32601)` does not discard usable resource/tool catalogs. A real `InternalError` remains a redacted 502. |

The EC01 observation is narrower than a conformance certification of every
third-party implementation. The pinned high-level `McpServer` registers an empty
templates handler for static resources; the official low-level `Server` supports
independent method registration and returns `-32601` for the missing handler.
Official [Resources](https://modelcontextprotocol.io/specification/2025-11-25/server/resources)
and [Lifecycle](https://modelcontextprotocol.io/specification/2025-11-25/basic/lifecycle)
documentation was consulted. Errors other than `MethodNotFound` remain failures.

## Environment and evidence

Independent `npm ci --ignore-scripts`, then `npm rebuild better-sqlite3`,
`npm run build:libs` and `npm rebuild electron` completed. No lockfile changes or
shared node_modules/dist symlinks. Runtime: Node **26.11.1**, ABI **147**. The
Server's actual `mem0ai` resolver selects this worktree's native SQLite; a real
in-memory query succeeds. Full selected-environment preflight succeeds with
`JAVA_HOME=/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home` and
`ANDROID_HOME=/Users/utopiafar/Library/Android/sdk`. Nothing opened a visible UI.

External generated evidence directory:
`/Users/utopiafar/.codex/visualizations/2026/10/18/01a14e8f-79dc-70b3-8d6c-608e696cb79d/extensions-validation`.
The final frozen-candidate receipt and required affected gate will be recorded
below before the Draft PR is created. Preliminary working-tree tests are not
transferred to a different candidate without rerunning affected validation.

Preliminary focused checks (base plus the corresponding working edits):

| Command | Result and evidence |
| --- | --- |
| `node --import tsx --test --test-concurrency=1 --test-timeout=120000 apps/server/test/multiuser-mcp-optional-discovery.test.ts` | 2/2, exit 0; `production-regression.log`. |
| Same runner, `apps/server/test/multiuser-mcp-one-shot.test.ts` | 9/9, exit 0; `one-shot.log`. |
| Same runner, `apps/server/test/multiuser-mcp-stateless.test.ts` | 6/6, exit 0; `mote-parity-inbound-stateless-final2.log`. |
| Same runner, original SDK subset (exact command in external `inbound-sdk-command.txt`) | 9/9, exit 0; `mote-parity-inbound-sdk-final.log`. |
| `TSX_TSCONFIG_PATH=apps/web/tsconfig.json node --import tsx --test --test-concurrency=1 --test-timeout=120000 apps/web/test/multiuser-mcp-one-shot-renderer.test.ts apps/web/test/multiuser-mcp-renderer.test.ts apps/web/test/multiuser-mcp-import.test.ts` | 3/3, exit 0; `mote-extensions-web-focused.log`. |
| Same Server runner, `apps/server/test/multiuser-mcp-process.test.ts` | 1/1, exit 0, source entry with actual child process/SIGKILL; `mote-extensions-mcp-process-source.log`. |

Failed attempts: the initial Web runner omitted the Web tsconfig and
failed before JSX rendering (`React is not defined`); corrected invocation is
shown above. An intermediate stateless suite had three generated provider setup
failures (retained in `mote-parity-inbound-stateless-final.log`) while the true
capability probe was being connected; the corrected
worker fixture and final full six-case rerun passed. Neither failed attempt is
represented as a successful runtime journey.

The Android scoped inventory also forwards the actual observed/issues projection,
including pending-check actions, instead of replacing it with unknown/empty.
Its JVM validation is part of the queued affected gate; no Gradle check is claimed
from source inspection. New text keeps English and Android catalogs synchronized.

Real models, Docker/provider accounts, physical clients/devices, foreground UI,
real personal screenshots/data, historical reprocessing and deployment are
**UNRUN**. All resource/model/provider content in automated checks is generated.

## Frozen candidate and required gate

Final focused commands use the same Node runtime and generated data:

```sh
node --import tsx --test --test-concurrency=1 --test-timeout=120000 apps/server/test/multiuser-mcp-one-shot.test.ts apps/server/test/multiuser-mcp-optional-discovery.test.ts apps/server/test/multiuser-mcp-stateless.test.ts apps/server/test/multiuser-mcp-process.test.ts
TSX_TSCONFIG_PATH=apps/web/tsconfig.json node --import tsx --test --test-concurrency=1 --test-timeout=120000 apps/web/test/multiuser-mcp-one-shot-renderer.test.ts apps/web/test/multiuser-mcp-renderer.test.ts apps/web/test/multiuser-mcp-import.test.ts apps/web/test/plugin-center.test.ts
node --import tsx --test --test-concurrency=1 --test-timeout=120000 apps/server/test/multiuser-plugins.test.ts apps/server/test/multiuser-plugin-capability.test.ts apps/server/test/multiuser-plugin-ingress.test.ts apps/server/test/multiuser-web-plugins.test.ts
node --import tsx --test --test-concurrency=1 --test-timeout=120000 apps/server/test/multiuser-plugins-process.test.ts apps/server/test/multiuser-memory-outcome-process.test.ts
```

MCP **18/18**, Web **13/13**, exit 0, are recorded in
`mote-extensions-{mcp,web}-focused-final.log`. The final plugin/process counts and
candidate SHA are included in the external `frozen-candidate.json` receipt.
Shared build, Server/Web typechecks and bilingual catalog check pass. Markdown
links, fenced code blocks and `git diff --check` were reviewed. The outbound/UI
code received an independent read-only peer review with no actionable finding;
this is not independent module acceptance.

The complete required plan is **all six TypeScript workspaces plus Android**,
because the scoped plugin projection and its bilingual catalog are shared
contracts. It includes the actual consumers, root integration and native JVM
checks. The driver's first full run at `d347b4647aa0c66a42bc3f7adf5129466b16aa16`
**failed** at `scope-contracts`; its remaining 19 steps were **UNRUN**. The new
candidate requires a fresh complete run in **Q003**. A dry-run is a plan, not a
passing gate, and no earlier passing phase is combined into a new gate result.
The exact clean SHA, full selection/check list, commands, hashes and logs are in
the external receipt. No Draft PR or push is performed before the required gate
passes.

Integration seam: Configuration C02's effective Hindsight `codex` path must be
applied to both the normal provider constructor and the restored probe constructor
in `scope/memory-providers.ts`. No unverified branch is copied into this candidate.
Files continues to own the local reference catalog projection; Web owns Home
extension slots. Lifecycle future-intent restoration is separately coordinated;
this module does not renew old grants, sessions or snapshots.

## Scope/backup contract repair after the failed full gate

The original driver receipt is
`/Users/utopiafar/Documents/Projects/mote/.git/mote-check-receipts/2026-10-18T11-20-11-879Z-3453c407-c670-4bb0-82f1-75b7e887084a.json`;
the log is `/tmp/mote-parity-extensions-driver-d347b464.log`. Environment and
i18n passed, scope registration failed, and the rest of that run did not execute.
The five reported gaps were two private directory registrations, the check table,
the durable check task and the exact canary import edge.

The repair registers only those four surfaces and the single owning-host import.
It additionally constrains the canary helper's runtime imports to crypto and its
two pure Memory contracts. Negative fixtures reject use by another scoped host,
legacy Store imports and direct file/SQLite imports. The real canary still runs
through the same bounded provider ports; no legacy production host is installed.

Schema/lifecycle review also found the check table absent from stopped-backup
admission. Its exact seven columns now participate in existing owner validation.
Generated archive mutations missing the table/column or introducing an unknown
owner are rejected before target publication. A real native Mem0 backup/restore
continues to retain canonical bodies while withholding prior plugin authority.
Production HTTP negatives reject A submitting B's same-instance check identity;
plugin export excludes operational check receipts and A's deletion preserves B's
receipt. No restoration policy or provider runtime is changed in this repair.

The initial scope command exited 1; the new negative-test pair also failed before
the guard/schema repair (missing authorized import and missing backup rejection).
After repair the scope command exits 0, **12/12** architecture/canary checks and
**4/4** selected real lifecycle/backup checks pass, exit 0. Exact commands:

```sh
node scripts/check-scope-contracts.mjs
node --import tsx --test --test-concurrency=1 --test-timeout=120000 apps/server/test/scope-architecture.test.ts apps/server/test/memory-provider-probe.test.ts
node --import tsx --test --test-concurrency=1 --test-timeout=120000 --test-name-pattern='M09 instance export|saved native provider checks|completed real conversation|native Mem0 instance backup' apps/server/test/multiuser-plugins.test.ts apps/server/test/multiuser-plugin-capability.test.ts apps/server/test/multiuser-instance-backup.test.ts
```

The clean scope-repair candidate `d4683421`, RED/GREEN logs, original failed
receipt, targeted results and complete dry-run are recorded under external
evidence `extensions-validation/scope-repair/`. The driver's subsequent full
run and its consumer failures are recorded below; the earlier failure is kept.

## Consumer contract repair after the second full gate

The driver ran the complete plan on clean `d4683421faf2ce22be8d42c25eb385fa8a0b6aa1`.
Its receipt is
`/Users/utopiafar/Documents/Projects/mote/.git/mote-check-receipts/2026-10-18T12-26-42-641Z-6820aa4c-5f2e-4e23-b507-9d4b6ac79c2f.json`,
with input identity
`dea19c9c911eb733c1f09be43ad70e2780a72f4cbd26359dc23a498a57a7ee04`.
Fourteen steps passed; Server failed with 3,087 passing, 62 failing and two
skipped tests; the last seven steps, including Android, were **UNRUN**.
The failed full log is `/tmp/mote-parity-extensions-driver-d4683421.log`.

The connector failures exposed a production consumer mismatch: M09's check
returned its durable task admission, while connector enable assumed verification
had finished. M04 correctly refused the unverified configuration. The internal
check now awaits the exact fenced task; the HTTP route continues to return an
immediate checking receipt. No verification guard or provider canary is removed.
Connector enable also retains the caller's original configuration revision after
waiting. A held post-verification boundary reproduces the former concurrent-pause
overwrite (200 instead of 409); the repaired path rejects the stale enable and
preserves the pause while B remains usable.

Two independent test assumptions were obsolete. The Web MCP test invoked the
removed mandatory preparation helper; it now exercises optional saved targets
through real Ingress/configuration APIs, retaining source ownership, secret
redaction, CAS and session-change assertions. The existing one-shot renderer
and discovery tests continue to require discovery with zero source/config writes.
The legacy import fixture now awaits each actual route-launched prepare/commit
promise instead of assuming completion within 100 × 10 ms. Only the qualified
test-wait hunk from Memory commit `1c9be37b5e46e706bcf9715ea00cce052b3e9810`
is adapted; no Memory parent or business change is copied. All Ask attribution,
citations and correction fences remain in the original journey.

The first focused connector-consumer run passed 66 of 67 tests. The sole failure
was its old empty-task assertion: enable now leaves one completed `plugin.check`.
The test still requires all invalid operations to reject before admission and
never reflect/persist secrets; it additionally identifies the completed check
and compares the entire task ledger before and after the invalid requests.
The corrected case and concurrent-pause regression pass together. New internal
check regressions cover completed verification before enable and declaration
changes during a held real probe. The original Gmail 503, internal admission-only
result and removed MCP helper are preserved as RED evidence.

Exact candidate SHA, file hashes, commands, final focused results, failed full
receipt and fresh affected dry-run are recorded under external evidence
`extensions-validation/consumer-repair/`. The new full affected/native run remains
for the driver, and prior full passing phases cannot be reused. No push or PR is
made before that complete gate passes. Real models/providers, physical devices,
foreground UI and deployment remain **UNRUN**.
