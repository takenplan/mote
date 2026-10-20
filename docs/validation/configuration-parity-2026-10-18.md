# Configuration journey parity validation — 2026-10-18

> 2026-10-20 delivery follow-up: this record keeps its original candidate, commands, results and UNRUN scope. Related source is now in main through the integration and later fixes; Draft/pending/under-validation statements below describe their recorded stage. Current module heads, named per-item evidence and remaining qualification are reconciled in [Project progress](../project-progress.md). This note neither changes an old FAIL into PASS nor treats functional gates as complete native/model/deployment acceptance.

Baseline: `2c78ca8d52a7d17fae20962cf68d09a717ffc73a`. Pre-multi-user journey
reference: `2c2627621e2598332ae8169845bc7343be7ed63e`. The
[decision](../adr-configuration-journey-parity.md) records KEEP / CHANGE / REMOVE /
EXCEPTION / UNKNOWN and the retained authority boundaries.

All test data, credentials, login files, provider responses and CLI executables
are generated. Tests use isolated temporary stores and loopback listeners. No
personal screenshots, personal credentials, real supplier calls, deployment,
format migration or historical reprocessing are part of these checks.

## Regression journeys

| Item | Generated production journey |
| --- | --- |
| CONFIG-C01 | Save credentials, edit each target field, retain each credential component, reject before network/save; explicit reuse, replacement and clear alternatives; personal A/B same-ID isolation; shared fixed references. |
| CONFIG-C02 | Configure executable/home through instance configuration, restart real host, catalog and synthetic probe, same-ID A/B Ask, working-memory compaction, restart and continuation; generated CLI verifies the exact auth file target. Hindsight adapter receives the same effective host options. |
| CONFIG-C03 | Account-qualified dates across timezone boundaries; exact filters, groups/facets, invariant totals, drilldown, detail pagination, personal price edit and frozen prices; unknown costs remain unknown. Original Usage renderer consumes the real cookie API. |
| CONFIG-C04 | Unsaved personal draft/new profile catalog and synthetic probe; assert saved revision and effective configuration unchanged, then save. Shared draft override remains rejected. |
| CONFIG-C05 | Ordinary shared model/budget/reasoning/deadline changes preserve admitted live and durable settings; true authorization changes/removal fence prior leases; account withdrawal and unrelated B remain separate. |
| CONFIG-C06 | One personal connection selects distinct models per feature, persists and restarts; shared model override rejected; referenced deletion guard and unreferenced cancel/confirm controls. |
| CONFIG-C07 | Files owner restores actual analysis/review/import entry attribution and validates real per-account receipts; integrated acceptance requires that module dependency. No keyword attribution. |
| Dedicated controls | Original categories, provider presets, advanced credentials, reasoning/budgets/timeouts/local switch/Codex speed, module selection and existing private domain controls; saved/effective feedback and unsaved draft handling. |

## Execution evidence

Implementation-time targeted checks use Node `v26.11.1`, ABI `147`, npm
`11.20.0`. Each worktree has independent `npm ci --prefer-offline --no-audit
--no-fund` dependencies with the committed lockfile. Server and Mem0 both
resolve the worktree's `better-sqlite3/lib/index.js`; opening an in-memory
database, executing `select 1`, and closing succeeds under that runtime.

Final candidate, exact commands, exit codes and evidence paths are recorded with
the module PR once code is frozen. A dry-run plan does not count as a passed
`check:affected` gate. Focused checks and fixture authoring runs do not establish
cross-module integration acceptance.

## Focused author checks before the coordinated gate

- Server model contracts and generated Codex consumers: 57 tests passed in the
  focused suite recorded in `configuration-backend/normalized-target-codex-consumers.log`.
  This includes the extra deployment-default credential regression, real held
  Ask tuning/withdrawal, Memory extraction/review and file/import native adapters.
- Generated Codex catalog/probe, A/B Ask, compaction/restart and Hindsight host
  option binding: 2 tests passed; `configuration-evidence/codex-runtime.log`.
- Usage production API/reducer: 7 tests passed; original Usage renderer with
  real cookie API: 3 tests passed. Exact commands and input hashes are in
  `configuration-evidence/usage-narrow-result.json`.
- Web typecheck, 18 focused UI tests, Web build, rebuilt hidden production browser,
  i18n (8,641 messages) and diff checks passed. The generated browser covers
  personal draft directory/probe/save, target credential consent, independent
  feature models, deletion protection, dated usage/filter/drilldown/pagination/
  prices and A-to-B account switching. Its result and source hashes are in
  `.mote/parity-configuration-browser/focused-ui-result.json` and `result.json`.
- Scope inventory/import-boundary preflight passed after registering the private
  price route and the shared pure usage helpers.

These author checks precede the mandatory coordinated `check:affected` gate.
Android model consumers and regression source are documented in the
[native record](configuration-native-parity-2026-10-18.md); their JVM/emulator
checks remain unrun pending the driver slot.

## Cross-module dependencies

Files owns C07's real attribution entrances and FILE-PERCEPTION's private image
policy, history preview/confirm and actual managed OCR/ASR runtime. Ask owns
optional embedding selection and `allowQueryImages` consumption. LIFE owns the
administrator storage-settings producer. Configuration's consumers now use the inspected Files, LIFE and Ask production
contracts. Shared media health is read-only for ordinary accounts; explicit
installation/cancellation uses administrator endpoints. Images retain the full
revision-bearing settings, derived service metadata, exact history states and
opaque preview/confirmation tokens. Native controls use the same APIs.

The [resource consumer handoff](configuration-resources-parity-2026-10-18.md)
records exact inspected producer SHAs, the M04 metadata seam, permission matrix,
real startup/browser/native commands and evidence requirements. These producer
commits are not merged into the independent Configuration branch. Combined-tree
startup, hidden resource-browser and native checks remain **UNRUN**, pending the
coordinated driver window. Existing `79bf9610` model/Usage browser evidence does
not establish acceptance of the subsequent resource consumers.

## Unperformed checks

Real Codex login/model calls, real providers and bills, physical macOS/Android
clients, actual external credential revocation and deployed runtime behavior
are unrun. No claim of those checks follows from the generated CLI/HTTP or hidden
renderer fixtures. C07's actual entrance changes are owned by the Files module;
its frozen dependency and combined acceptance must be reported with integration.
