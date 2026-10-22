# Unified user-journey validation

The [ADR](adr-unified-user-journeys.md) is the behavioral contract. Tests that
encode superseded behavior must be changed deliberately, not treated as authority.
Use generated fixtures and background execution. Do not collect personal screens,
call real providers/models, show windows or change the user's running profiles.

## Required order

1. **Module:** deterministic identity/range/configuration transitions and failure
   classification, plus host authorization guards. Run only selected test files.
2. **Small seam:** two or a few real collaborating modules, deterministic provider
   doubles, explicit barriers for concurrent saves and revocation. Establish the
   first successful interaction early, before expanding the chain.
3. **Consumers:** selected current production routes, client adapters and lifecycle
   startup/restart tests, after local contracts pass. A hand-assembled internal
   path alone cannot establish production wiring.
4. **Final qualification:** `npm run check:affected` for changed components and
   consumers; relevant generated E2E and background UI/native fixtures. Only now
   broaden to multi-module/end-to-end runs. Record any unperformed checks.
5. **Delivery:** PR contains the validated commit; Dev workflow runs that exact
   revision; inspect run results and component artifacts. Build success is not
   device/live-model validation. No production deployment is implied.

## Journey/state matrix

| Chain | High-risk assertions |
| --- | --- |
| Configure → intent → run | Generic/dedicated entry parity; concurrent stale saves conflict; ordinary interval/timezone change schedules successors; rollback doesn't revoke; restart retains intent; B is unaffected by A. |
| Enable → model prerequisite → resume | Owner enable creates policy; disable stops future admissions; immediate stop revokes; defaults/files grant nothing; missing Memory/Chat dependency is visible; restore configuration permits legitimate new work. |
| Disable → drain → explicit enable | Pending and running Memory intake retains its original receipt; earlier producers cannot create fresh intake after resume; consolidation freezes its eligible members at cutoff. A lost built-in Ask grant requires fresh future-only owner intent, with no old-window replay and no precommit abort on rollback. |
| Configure → unfinished file processing | Final publication sees every domain snapshot; only affected originals receive a bounded handoff from prior intent. Unrelated originals keep their target, task and physical call. Rapid edits, rollback, logout, source withdrawal, cleanup and unknown external effects preserve their distinct outcomes. |
| Intake → Memory | Ready target enters; same object after disabled/paused history or policy edit still advances; old history not replayed; unready/revoked input remains fenced; independent review preserved. |
| Evidence → Ask/MCP | Mixed-day member selection; planned calendar time; processed file source filter; precise reads agree with candidates/pagination; owner/source revocation after selection still blocks disclosure. |
| Delete → new import | Explicit new request succeeds; same request deduplicates; old queue and old archive cannot revive deletion; B's identical bytes are independent; unsupported encodings have clear outcomes. |
| Capture → ACK → durable queue | Paused registration/upload retains pending; resume/restart retries; actual conflict blocks only that item; successful split ACK survives later failure; A→B→A ownership remains stable. |
| Accepted import → logout/cancel | Logout doesn't cancel bounded accepted work; epoch change/cancel does; failed publication rolls back; cross-user receipt inaccessible; restart semantics reported accurately. |
| Shared understanding → separate consumers | Exact contract permits reuse; differing model/input/policy does not; current authorization rechecked on hit; Memory review, Actions approval and Ask citations remain independent. |

Prefer risk-based pairs, while preserving the explicitly high-risk combinations
above (e.g. pause + revision + restart). Record command, code revision, scope,
result and failures. Passing a characterization probe means the old failure was
observed, not fixed; regression assertions must express the new contract.

## Final current-entry selection

`npm run test:e2e` currently imports the legacy test builder. If executed, record
it as retained algorithm/history coverage only; it cannot qualify this refactor's
current production assembly. The final qualification must also use current host
fixtures and hidden browser entry points, selected after module/seam repairs:

- [apps/server/test/multiuser-portable-import.test.ts](../apps/server/test/multiuser-portable-import.test.ts):
  real accepted import/logout, cancel, account disable, restart, same-vault deletion
  and all-domain rollback. [apps/web/test/multiuser-portable-import.test.ts](../apps/web/test/multiuser-portable-import.test.ts)
  is a separate same-named test: the Vault import UI in JSDOM uses the real host,
  generated archives/sessions and lost-ACK handling. Record both exact paths.
- [Desktop source-account retry](../apps/desktop/test/source-account-retry.test.ts):
  actual Central ingress with durable source queue, receipt identity, pause, retry,
  restart and A/B isolation.
- [Configuration browser](../apps/web/test/parity-configuration-browser.cjs):
  actual built Web/current host, generated accounts/provider responses and hidden renderer;
  visible working-policy enable/disable, dedicated/generic Actions parity and
  account isolation.
  Evidence is under `.mote/parity-configuration-browser/`: `result.json`, generated
  UI screenshots, or `failure.json`.
- [Integrated browser](../apps/web/test/multiuser-integrated-browser.cjs): actual
  current-entry journeys with generated external responses and hidden renderers,
  including diagnostics navigation to the existing administrator settings.
  With no group arguments it runs `models policy memories agent images files operations history`;
  explicit group names select only those journeys and must be recorded. Evidence
  is under `.mote/multiuser-integrated-browser/`: `result.json`, `result-<group>.json`,
  `source-<hash>.json` manifests and generated screenshots/failure images.
- [Attachment-to-personal-export regression](../scripts/validation/final-e2e-attachment-personal-export.test.ts):
  actual attachment intake/text processing and portable export against the compiled
  current host, when affected Material asset eligibility is qualified. The required
  `MOTE_FINAL_RECOVERY_WORKSPACE` is the absolute compiled workspace root; the test
  imports its `apps/server/dist/app.js` and reports `compiledWorkspace`/`synthetic`
  in Node test output. Retain that output as evidence.

Run the standalone entries below from the repository root with matching installed
Node/dependencies and candidate library builds (`npm run build:libs`). Browser
entries use TypeScript host fixtures and require installed Electron/current
`apps/web/dist/index.html` (`npm run build -w @mote/web`); the attachment entry needs
compiled Server (`npm run build -w @mote/server`). Reuse matching affected-plan
builds; do not rebuild during the freeze. Both browser scripts load
`scripts/fixture-background.cjs`; leave UI opt-in and integrated discovery/CSS
probes unset. Screenshots contain generated fixture UI, not personal screens.

```sh
set -e
unset MOTE_TEST_SHOW_UI MOTE_WEB_FIXTURE_DISCOVERY MOTE_WEB_FIXTURE_CSS_PROBE
CANDIDATE=$(git rev-parse HEAD)
FIXTURE_NODE=$(command -v node)
MOTE_WEB_FIXTURE_NODE="$FIXTURE_NODE" ./node_modules/.bin/electron apps/web/test/parity-configuration-browser.cjs
test "$(git rev-parse HEAD)" = "$CANDIDATE"
MOTE_WEB_FIXTURE_NODE="$FIXTURE_NODE" MOTE_WEB_FIXTURE_EXPECTED_HEAD="$CANDIDATE" ./node_modules/.bin/electron apps/web/test/multiuser-integrated-browser.cjs
MOTE_FINAL_RECOVERY_WORKSPACE="$PWD" "$FIXTURE_NODE" --import tsx --test scripts/validation/final-e2e-attachment-personal-export.test.ts
```

`MOTE_WEB_FIXTURE_NODE` selects the Node executable for both scripts' generated
hosts (required by integrated; parity also has a PATH fallback). The integrated
script's optional `MOTE_WEB_FIXTURE_EXPECTED_HEAD` enables its existing candidate
and source/dist freeze assertions; parity relies on the surrounding HEAD check.
Keep exact selected paths/groups, commands, candidate/runner/build hashes, results
and cleanup evidence in the validation record. Do not activate the user's browser
or running Mote profile.
