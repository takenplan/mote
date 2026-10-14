# DEV log retention regression journeys

All input is generated in temporary directories. No private profile, personal
capture, live model, real DEV deployment or physical device is used.

| Journey/state transition | Durable regression |
| --- | --- |
| Fresh DEV/test profile → CLI config → native server startup | Profile fixtures assert omitted YAML `diagnostics.maxBytes` resolves to 100 MiB and test remains 2 MiB; authenticated diagnostics reports the writer limit. |
| Explicit numeric 2/custom YAML capacity → read/config → deliberate migration → repeated migration → restart | CLI fixtures preserve explicit settings until migration, keep file/event counts, unrelated fields and secret references; increment the canonical revision, enforce 0600, and verify idempotence; profile fixtures exercise the actual startup path. |
| New capacity/default → target release without capability → startup/adoption/upgrade/rollback | Generated legacy-release fixtures reject incompatible selections before configuration writes, shutdown or archive restore; older YAML-aware targets support compatible explicit capacities, while env-only targets reject even small capacities. |
| Compose globals → startup subcommand → incompatible target | Dispatch fixtures cover value-taking, equals-form and attached short options; startup preflight still rejects before generated configuration is written. |
| Explicit capacity or omitted YAML setting → server config/supervisor | Config fixtures cover DEV minimum/maximum, explicit 2, YAML authority over ambient environment, other profile ceilings and invalid values before vault creation; supervisor fixtures test >8 MiB retention and the 100 MiB boundary. |
| Mixed ordinary/trace records → >8 MiB retained file → reopen → raw/page/range reads | Diagnostics fixtures ensure large files and complete records survive, page ordering/filtering and safe trace exclusion remain correct. |
| Size boundary/UTC midnight → rotation → oldest expiry | Generated diagnostics and sparse supervisor capacity fixtures check file count, per-file bounds, total family bounds and restart/day transitions. |
| Oversized ordinary/trace input → serialization | Ordinary 20 KiB and trace 8 MiB/file limits remain independently bounded, with explicit truncation markers. |
| Partial tail, malformed lines, competing writer, stale lock, disabled/silent state, disk failure | Existing diagnostics and supervisor regressions remain part of affected checks. |

Required checks are `npm run check:affected`, `node scripts/test-central-runner.mjs`
(included in component checks), and `npm run test:profiles`. The scope selector
may conservatively include other consumers because shared operating scripts and
root configuration changed; that is validation scope, not a multi-client release.
Live-model, physical-device, container and deployed DEV verification are separate
and must be reported only if actually performed.
