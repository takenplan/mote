# Single-owner recovery inventory

This is the disposition of the 29 first-parent changes between
`2c2627621e2598332ae8169845bc7343be7ed63e` and
`7142fdce1d2ec488410051e4f224655ac3beac95`. The owner accepted the recovery on
2026-10-23 and chose a fresh-data MVP. The decision is recorded in
[the single-owner ADR](adr-single-owner-mvp.md). Historical PRs identify the
requirements being examined; their test results do not qualify this branch.

`52110244c848001aeae56cf525188a266aa3f01d` is a real reverse commit. Its tree equals
the target exactly, and all original commits remain ancestors. Later commits
restore independent behavior against that single-owner implementation. No old
database, account, queue or wire-format migration is part of this work.

## Requirement disposition

| Historical change | Disposition in the recovery |
| --- | --- |
| #162, multiuser integration and its constituent branches | Remove account hosts, account administration and scoped duplicate implementations. Keep one instance/owner with multiple devices and read-only Agent clients. Restore the independent Dev credential/Profile and release behavior explicitly; owner clients and restricted collector/MCP credentials remain separate capabilities. |
| #163, failure and recovery messages | Restore safe shared HTTP failure classification and Web, Desktop and Android consumers. Authentication failure, insufficient permission, transport failure and unavailable services retain distinct actions. Provider bodies and arbitrary exception messages are not UI copy. |
| #167, integration including #166 | Preserve single-owner configuration, evidence and publication responsibilities. Restore queued model authority and honest image/native model usage. Media request outcome recovery is tracked separately below because a conservative unknown-outcome guard alone does not implement it. |
| #184, parity integration | Preserve the complete baseline owner journeys, current evidence/source-context checks, real intake and native clients. Port independent missing behavior; do not port account-regression fixes to absent scoped classes. |
| #183, plugin extension experiment | Restore host capability discovery and worker cancellation/late-result protection. Existing registries already compose contributions by identity. The five-round benchmark was an experiment, not five delivered end-user extensions; do not claim those examples or a new generic worker ABI are restored. |
| #186, check reuse | Replace the later receipt machinery with the accepted focused-check workflow. Reuse unchanged passing evidence after a fix; rerun invalidated checks. |
| #187, full input and local reimport | Preserve complete validated task input. The baseline already retains explicit current-format reimport and deletion semantics; inspect actual single-owner consumers instead of copying scoped import projections. |
| #188, import progress cache | The changed scoped projection is absent. Keep the baseline import-progress implementation; do not add an account cache to reproduce the optimization. |
| #192, Memory publication issued guard | Keep the existing single-owner publication journal and unknown external-effect reconciliation. Durable extraction/review recovery must not remove that guard or turn an unknown publication into an automatic replay. |
| #189, Server test parallelism | Keep the simple four-file-concurrency Server command and existing assertions/lifecycle scale. Do not restore the later 16-group/receipt driver. |
| #193, final check timing | Incorporated in the new testing guide: focused module checks, early real integration, one affected candidate check after convergence. |
| #194, independent queue progress | Preserve independent recording acquisition and Memory windows. Generated real recording tests exercise continued intake while Memory is held and typed transient recovery without resetting completed siblings. |
| #201, performance integration | Restore Web composer isolation, Desktop catalog/packed-upload improvements, Android non-packed batching and batched Operations dependency reads. The baseline already has the reverse source-head index and one checksum per Web upload part. |
| #203, Memory evaluation context | The baseline already freezes evaluation/context time and carries neutral procedure instructions. Keep those contracts; no account evaluation clock is needed. |
| #202, current-state documentation | Replace descriptions that assume accounts with the recovered architecture and this inventory. Historical validation documents remain historical evidence. |
| #204, performance/Memory functional work | Preserve the existing single-owner proof, cancellation, publication and native-provider paths. Optimizations targeting scoped joined-authority queries have no corresponding query to replace here. Restore independently applicable model admission and client/Operations work explicitly. |
| Known release issues / frozen publication commit | Historical release bookkeeping does not qualify the recovered source. No frozen-source publication bypass, release tag or automatic deployment is part of recovery. |
| #206, development efficiency docs | Superseded by the owner's chosen initial lightweight workflow, short AGENTS files, module commands and on-demand test guidance. |
| #208, visual Memory review feedback | Restore the distinction between a covering visual citation and extra detail references in instructions/repair feedback. Keep the original acceptance rules and real pixel-read requirement. |
| #209, bounded task retries | Restore initial attempt plus at most two eligible automatic retries; waiting is not failure, unknown outcomes are not safe replay, and only an explicit owner retry resets failed work. Extraction and review receive separate durable phase recovery as described below. |
| #210, structured diagnostics | Restore fixed, bounded client/Web events and Agent bridge readiness. Keep existing Server request diagnostics. Do not restore arbitrary exception text, raw API paths, content, tokens or dynamic detail strings into ordinary logs. |
| #211, later release test efficiency | Superseded by the initial workflow selected by the owner. No generated receipt manifest or 16-bucket validation engine is required. |
| #212, Android picker recreation | Restore process-retained pending invitation input and configuration/session stamps. Saved Android state contains no bearer invitation. |
| #213, unified user journeys | The single-owner ADR is authoritative for responsibility and authentication. Keep config publication, source attribution, historical answers, deletion, partial acknowledgements and producer/consumer lifetimes where the baseline already implements them. New phase recovery and authority fixes are checked through those real boundaries. |
| #214, scan and connection UI | Restore normal/inverted QR decoding, dark-on-white QR generation, visible pairing failures, explicit confirmation and owner-client wording. Real scanner-child/parent-recreation instrumentation verifies the returned result. |
| #216, late performance and diagnostics fixes | Scoped Activity SQL/projection repairs do not apply to the baseline's existing page-before-hydration query. Restore applicable event-loop yielding, bounded execution observations and media outcome reconciliation. |
| #215, connector ID HTML pattern | The affected account connector form is absent. Do not add that form solely to port its pattern correction. |
| #217, Dev account bootstrap diagnostics | Account bootstrap is removed. The recovered single-owner server has no first-account creation step or failure path to instrument. |
| #218, Dev startup/source identity | Restore exact source revision and dirty-state reporting for startup. Do not restore account-configuration consumers. |

## Remaining convergence work

The inventory is being closed alongside implementation. These rows must be
updated with actual results before claiming the assembled candidate is verified.

| Work | Current boundary |
| --- | --- |
| Memory extraction/review phase recovery | Implementation and focused durability validation in progress. Each phase must retain complete private output, independent retry budget, restart reuse and deletion/cancellation fences; publication keeps its existing separate journal. |
| Media execution facts | Bounded plan/review in progress. A known remote completion after response loss must be reconciled by authenticated request identity; absence of a receipt must remain unknown. |
| Execution timing and final input/yield deltas | Implementing observation-only mapping to the existing single-owner executor and pump. Diagnostics may not decide authority or create another timer. |
| Assembled candidate | Final affected checks, actual startup/restart journey and current PR CI follow convergence. Native fixture evidence, physical-device checks and live models are reported separately. |

## Deliberate scope boundaries

- Multiple devices and multiple evidence subjects do not require multiple users.
  Source context, provenance, revocation and deletion still apply.
- Trusted source/processor modules remain available through their existing
  startup configuration. The Memory worker advertises only its actual methods;
  a generic source/processor download-to-worker lifecycle is a separate design.
- MVP data may be replaced, but normal restart, cancellation, current-format
  backup/restore and unknown-effect recovery remain useful current behavior.
- Tests use generated evidence. No live personal screenshots or model calls
  establish the automated fixture results recorded for this recovery.
