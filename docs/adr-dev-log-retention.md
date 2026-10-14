# DEV diagnostic log retention

Date: 2026-10-14. Status: accepted within the authorized DEV capacity change.

Detailed Agent traces share the structured central log with ordinary diagnostics.
The previous DEV defaults, 2 MiB per file and three files, can retain only a short
window under trace traffic even when there are no dropped events or disk failures.
This prevents later investigation of failures during longer development sessions.

DEV now defaults to 100 MiB per file and three files. Only DEV accepts explicit
capacities up to 100 MiB; other profiles retain their 2 MiB default and 8 MiB
maximum. The server, profile CLI and native supervisor use one configuration
resolver. Each log family has its own bounded retention: structured logs and
native supervisor logs can each occupy 300 MiB by default. Size and UTC-day
rotation still remove the oldest file; no fixed retention duration is promised.

The [unified configuration ADR](adr-unified-configuration.md) supersedes this
change's original env/`auto` representation: new YAML profiles omit
`diagnostics.maxBytes` to select the profile default. Explicit numeric bytes
remain overrides, including a deliberately converted legacy 2 MiB value. Legacy
metadata cannot prove whether that value was a customization. The deliberate
`log-retention --defaults --profile dev` command removes only this capacity
field through the canonical atomic YAML writer and increments its revision,
without changing file/event counts, unrelated fields or credentials. It reports
before/after capacity and requires a later normal restart. Repeated adoption and
configuration inspection do not mutate the file. Old env-only profiles require
explicit offline YAML preparation under the unified configuration decision.

Startup, adoption and deployment switches preflight target YAML support;
capacities above 8 MiB additionally require the expanded resolver. Upgrade or
rollback rejects an incompatible target before stopping or restoring anything.
An env-only target cannot consume this configuration even with a small limit.
For YAML-aware targets without expansion, owners deliberately select an explicit
`diagnostics.maxBytes` in the 0.1–8 MiB range. There is no automatic downgrade or
format conversion. A smaller writer can discard oversized old logs, so retained
diagnostic files need preservation before such a downgrade when still needed.

The former absolute trace-record ceiling of 8 MiB is now independent of retention
capacity, still capped by a smaller configured file. Raising DEV files from 2 to
100 MiB permits records between 2 and 8 MiB that previously needed a truncation
summary. This is an explicit consequence; records cannot grow to 100 MiB.
Ordinary 20 KiB serialization, trace string/collection/depth limits, memory entry
limits, queue limits and model disclosure/transport authorization remain intact.
Startup, pagination and safe range exports traverse lines rather than split
whole retained files, and safe range exports exclude trace bodies before
accumulating events. Full raw downloads remain bounded by the selected file.

| Category | Supersession check |
| --- | --- |
| KEEP | UTC/size rotation, filenames, owner authentication, locks, 0600/0700 modes, safe support filtering, malformed raw text, memory/queue limits and nonfatal diagnostic failures. |
| CHANGE | DEV file capacity/YAML omission default representation, explicit numeric opt-in, common configuration resolver and traversal of larger files. |
| REMOVE | Env/auto authority under the unified configuration decision, universal 8 MiB internal/supervisor clamp and documentation describing all defaults as 6 MiB total. |
| EXCEPTION | Other profiles retain existing capacity policy; explicit numbers remain stable; older YAML-aware releases require an explicit compatible setting before rollback; env-only targets are rejected; native supervisor and Docker stdout retain their own privacy and rotation behavior. |
| UNKNOWN | Historical customization intent and how many hours a future workload can retain. |

The reviewed surface includes profile initialization/loading, exec/native/Docker
launch environments, server startup/configuration projection, diagnostics
rotation/reload/raw/page/range readers, Web selectors and API file indices,
support filtering, environment examples and operating documentation. No query
agent tools, prompts, Memory processing or client navigation changes are needed.
Regression journeys are recorded in [log retention validation](testing-dev-log-retention.md).
