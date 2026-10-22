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

- `multiuser-portable-import.test.ts`: real accepted import/logout, cancel, account
  disable, restart, same-vault deletion and all-domain rollback.
- Desktop `source-account-retry.test.ts`: actual Central ingress with durable
  source queue, receipt identity, pause, retry, restart and A/B isolation.
- Web `parity-configuration-browser.cjs` and selected
  `multiuser-integrated-browser.cjs` journeys: actual current production host plus
  built Web, generated accounts/model responses and hidden browser. Added controls
  cover visible working-policy enable/disable, dedicated/generic Actions parity,
  account isolation and diagnostics navigation to existing administrator settings.
- Compiled current-host attachment-to-personal-export regression when affected
  Material asset eligibility is qualified.

Keep exact selected names, command, source identity and results in the validation
record. Starting an Electron fixture requires the repository background fixture
entry; do not activate the user's browser or running Mote profile.
