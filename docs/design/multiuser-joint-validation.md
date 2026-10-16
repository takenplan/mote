# Joint validation decisions and provenance

This is a preparation decision log, not a new product ADR. Governing decisions
remain the [original multi-user ADR](../adr-multiuser-scope.md), original domain
ADRs, [module contract](multiuser-modules.md) and PR135
[public mechanisms](multiuser-public-contracts.md). Executable scope and evidence
are in the [joint acceptance matrix](../validation/multiuser-joint-validation.md).

| Decision | Basis | Impact / verification |
| --- | --- | --- |
| KEEP shared SQLite, services, one executor | Original ADR and PR135; explicit handoff | No per-user runtime/database, new coordinator or general authorization framework. Existing real production fixtures are reused. |
| KEEP original user outcomes through new scoped entry points | AGENTS supersession protocol; module contract and domain parity ledgers | Route changes are allowed, capability removal is not silently accepted. Missing Imports/Files/Memory/connector/settings/client behavior stays a blocker. |
| CHANGE integration location only | User forbids remote main/integration changes and touching the original dirty workspace | Compose exact freezes in own `codex/mote-multiuser-joint-validation`; remote branches remain6272. No deployment or CI enablement. |
| KEEP separate evidence provenance | PR135 requires exact version/entry/exit and real lifecycle ordering | M16 execution at107 is historical shared evidence; new independent probes/final candidate results get their own receipts. Documentation-only deliveries do not trigger redundant full gates. |
| KEEP native recovery and Docker recovery as distinct requirements | Original backup/recovery capability, M16 explicit limits and source guard | Native compiled/package pass does not close epoch5 Docker refusal or actual Hindsight volume recovery. Source guard and daemon availability are independently checked; no silent exclusion. |
| EXCEPTION legacy algorithm fixtures only | Original ADR's explicit test-only boundary | Useful characterization; cannot substitute for scope, final production composition, renderer/native/worker or restored package proof. |
| REMOVE completion inference from checkpoint or test totals | Explicit handoff and AGENTS | M13/M14/M15 remain WIP; final gate waits for all freezes and retained capabilities. All named final rows initially pending. |
| UNKNOWN actual platform/provider/deployment behavior | Explicit no real I/O/system-permission constraints and existing validation limits | No system permission change/live provider write. Unrun physical/device/permission/Docker tests stay explicit; authorization is not inferred from fixture results. |

No new domain policy, semantic heuristic, quota, automatic migration, data reset,
shared secret exposure or user-facing approval step is proposed here. Technical
choices reuse the current tools and tests. If closing a retained capability needs
an architectural change, provide the parent a concrete minimal proposal and its
effect before treating it as accepted scope.
