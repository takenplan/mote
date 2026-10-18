# Lifecycle parity validation

Module: LIFE-L01–L06. Integration base:
`2c78ca8d52a7d17fae20962cf68d09a717ffc73a`. Independent worktree:
`/Users/utopiafar/.codex/worktrees/parity-lifecycle/mote`; branch:
`codex/parity-lifecycle-20261018`. The [parity ADR](../adr-lifecycle-parity.md)
records the owner decisions and supersession boundary. This file is an implementation ledger; a Draft PR and affected-check result
are still pending.

All accounts, content, screenshots/image bytes, model replies and connector
replies used here are generated. Tests open disposable vaults, generated local
HTTP providers and loopback listeners. No personal vault, actual user screenshot,
live model, production deployment or physical device is used.

| Area | Real entry / state transitions covered |
| --- | --- |
| L01 retention | Production ready/start, hourly registered callback, logout, close/restart, strict final context observation, zero retention, actual file revision versus generic `kind: file`, transitive Material/Memory/Ask withdrawal. See [maintenance matrix](parity-lifecycle-maintenance.md). |
| L02 capacity | Two owners share the existing ceiling; 507 rolls back the complete synchronous intake before ACK; durable duplicate ACK remains available; delete/restart admits the same pending input. Original/staging admission, promotion, owner hash isolation, snapshot eviction/rehydration and saved/effective restart settings have focused coverage. |
| L03 consistency | Real Memory export/preflight awaits while A or B writes through HTTP; A dependency changes conflict, B changes and excluded A task progress do not. Personal import validation and final publication use the same witnesses. |
| L04 full export | One actual HTTP response includes retained originals, exact bytes/ETag/length, repeated requests and restart; no central content rows. Real socket disconnect and backpressured erasure fence later publication. Web one-action save/account switch and Android download staging are explicit consumers. |
| Delete journal | Capture deletion/retention reject ordinary replay and same-vault portable resurrection. Another owner's equal ID, genuinely new IDs, direct source removal and explicit file allow-again retain their own positive paths. Final Imports deletion journals its removed captures; sibling imports preserve shared data. |
| L05 physical cleanup | Startup/hourly reuse original ingress/import upload cleanup. Pins, active work and durable unknown processing block only the affected owner's physical cleanup, including across restart. |
| L06 continuing policy | Real two-user HTTP configuration, stopped archive/restore, no authority before password login, fresh per-owner future tasks, actual plugin check, repeated login/restart idempotence, B paused/disabled policy, real future Actions/model and connector timer dispatch without old pending evidence or old task retries. |

## Executed focused evidence

Logs for this working candidate are under `/tmp/mote-lifecycle-evidence/`. They
are local development evidence, not the immutable final-candidate affected gate.

| Log | Actually executed result |
| --- | --- |
| `export-import-current.log` | 27 passed: lifecycle, Activity and portable import with retired export routes rejected. |
| `portable-final.log` | 16 passed: direct delivery, actual Memory await consistency, erasure/expiry and owner-qualified journal behavior. |
| `web-final.log` | 13 passed, including nested import-parser cases; actual Web components over production HTTP injection, using `TSX_TSCONFIG_PATH=apps/web/tsconfig.json`. |
| `maintenance-capacity-final.log` | 19 passed: startup/hourly maintenance, generic upload cleanup/restore and capacity, including eviction/rehydration and expired metadata import. |
| `capacity-imports-current.log` | 26 passed, 1 existing optional Python Source Pack test skipped. Includes actual final Imports delete-journal rejection. |
| `policy-backup-final.log` | 46 passed, including nested corruption cases: stopped instance/profile entry, actual Mem0 SDK canonical-body restore, named policy merge and authority retirement. The Docker case checks packaged file projection; it does not run a daemon. |
| `future-final.log` | 1 passed in about 62 seconds: real password login, pending B password reset, restored future grants, actual watch/model and connector timer dispatch, repeated login/restart and no old task retries. |
| `typecheck-final.log`, `scripts-typecheck-final.log` | Server/Web and root script TypeScript checks passed. The script check initially needed the local diagnostics library build; it passed after that prerequisite. |
| `scope-final.log` | Scope inventory and production import boundary passed. |
| `i18n-final.log` | 8,642 bilingual entries and TS/Kotlin call sites passed. |

The commands use this worktree's installed dependencies. `npm ci --ignore-scripts
--no-audit --no-fund` left the lockfile unchanged; `better-sqlite3` was rebuilt
locally. Both Server and Mem0 resolution probes executed an in-memory database
query from this worktree. No shared dependency tree was adopted.

Earlier development failures remain in the logs. Initial route assertions used
404/500 while the existing scoped deny/error handler returns 503; they now
assert that actual boundary. A simulated recovery clock expired active leases;
the final fixture uses real time and a configured generated local model, and
checks the actual future request body rather than raw IDs that differ from the
production evidence projection. Import lifecycle-fence cases now remove a
source instead of bypassing the newly authoritative capture-delete journal;
separate cases assert that journal rejection. Missing imported sources retain
the existing disabled state and require explicit owner enablement for reads.
The consumer matrix exposed startup cleanup deleting a completed unconfirmed
original solely because restore advanced its account epoch. Completed originals
now retain the existing deadline; unfinished old-epoch transport is retired.
The backup/restore consumer is the durable regression. The expired-metadata
capacity case waits for actual input consumers to settle before requesting a
stable snapshot; it does not suppress legitimate `archive_changed` conflicts.

The earlier 11-file consumer run passed 129 of 133 tests. Its four failures were
the cleanup defect above and superseded delete/restore policy expectations;
the relevant files subsequently pass in the final logs above. That initial run
is not reported as a passing final gate. Focused logs overlap and their counts
must not be summed as a distinct-test total.

## Required final and separate checks

Before opening the Draft PR, freeze the candidate and run the driver-selected
`npm run check:affected -- --base <integration-base> --head <candidate>` plan.
The shared check queue owns that execution; a dry-run is not a passing gate.
Android JVM/build/instrumentation, emitted desktop integration, container/native
provider recovery, physical-device and live-model results must each be reported
as actually run or UNRUN. Headless execution is mandatory unless foreground
interaction is explicitly authorized. Earlier M16 Docker/native evidence is
historical and does not validate this new candidate.

Known coordination boundaries: Files owns `ig_file_heads`/portable file-head
anchors; LIFE owns actual file-revision retention identity. Desktop owns its
upload-expiry recovery branch; LIFE changes ingress final capacity admission and
successful part cleanup. Actions' canonical discovery cursor and Extensions'
asynchronous capability-check changes require composed review of the shared
methods. The coordinator handles an asynchronous check task only after actual
successful completion and current checked state.
