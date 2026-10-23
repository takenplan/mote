# Scoped media failed-fact recovery

Date: 2026-10-23. Status: integration-verified for generated recovery and local deployment readback; not merge-ready.

Scope: future scoped local OCR/ASR reconciliation and processing attempts. The
[task recovery decision](../adr-task-recovery-and-execution-budgets.md),
[execution policies](../task-execution-policies.md) and
[unified user journeys](../adr-unified-user-journeys.md) retain the authorization,
physical cleanup, finite retry and publication contracts.

## Defect and intended behavior

A metadata-only worker facts GET could start a charged logical attempt and mark
it executed through the model execution wrapper. An existing open attempt may be
reused across polls; this does not mean every GET spent another attempt. After
an exact failed worker fact settled its transport issuance, the next admission
could misread settlement `succeeded` as a successful execution whose result body
was missing. The combination could exhaust attempts without issuing another
media request.

Only trusted OCR/ASR registrations observe fixed worker facts before a new
processing attempt. The authenticated, exact-request/scope GET uses the genuine
frozen model lease and current grant/input checks, remains bounded and
abort-controlled, and drains through local work cleanup. It does not create a
charged attempt, executed flag, model-attempt snapshot or usage. It does not
manufacture physical execution or cleanup receipts. General model/plugin
reconciliation keeps its existing behavior.

A strictly parsed stored terminal `failed` fact must have supported authenticated
worker provenance, the exact same-owner/task/issuance row and a matching request
and stage, and the same frozen model snapshot as the current lease. Worker incarnation and valid acceptance/completion times must be
present; a terminal fact need not belong to the current worker incarnation.
This proof establishes
processing failure, rather than a lost successful body. The next eligible actual
processing attempt revalidates authority, input, model and physical capacity;
failed facts remain durable, with no accepted result or owner replay confirmation
invented. There are still at most three charged attempts per round. This task
budget is separate from provider-internal requests or fees.

A succeeded fact without a retained accepted body remains protected by
`processor_result_unavailable`. Missing, malformed, unsupported, mismatched or
unknown facts cannot authorize a new request. Worker health, elapsed time and
execution lease expiry do not prove original physical cleanup. The change does
not replay historical work, reset counters or rounds, revive terminal tasks,
backfill receipts or call owner retry/unknown-confirmation paths automatically.
The existing cap may stop a third actual failure before another reconciliation;
no extra attempt or terminal revival is introduced.

## Required generated regression

Use an isolated private profile, production `buildApp`, ordinary authenticated
processing ingress and a deterministic loopback HTTP worker with generated input.
Count media POST identities, facts GETs, charged sessions, executed flags, model
snapshots and usage separately. A generated worker is not live ASR quality or a
physical-device check.

| Journey | Required assertions | Status |
| --- | --- | --- |
| Issued request disconnects; running facts repeat and survive restart | One original POST; GET-only observation adds no charge, executed flag, snapshot or usage; no publication or duplicate live request. | PASS |
| Exact running fact becomes failed, then a new attempt succeeds | Old failed fact and issuance remain; no fabricated confirmation; two actual charged attempts and correct same-owner parent/artifact. | PASS |
| Two actual failures, then third succeeds; separately all three fail | Three charged attempts, distinct actual request identities, no fourth attempt or counter/round reset; existing terminal/unknown protection remains. | PASS |
| Stored failed fact survives restart | Exact supported proof permits only otherwise eligible work; malformed, missing, unsupported, wrong-request or wrong-stage proof cannot waive lost-result protection. | PASS, including 13 invalid proof variants |
| Account, source, grant or model authority changes while a facts GET is pending | No settlement, publication or new execution after revocation; abort and shutdown await local cleanup; original physical cleanup remains distinct. | PASS: cancel, source, account, model and close |
| Worker succeeds but its accepted result body is unavailable | No inferred publication or automatic new POST across restart; explicit owner retry keeps existing bounded-round/unknown checks. | PASS in retained queue regressions |
| Existing shared listener, busy/cooldown and account isolation | Known-not-started waiting retains zero failed-processing attempts; independent listeners advance; no foreign receipts/artifacts; other handlers retain accounting. | PASS in retained queue regressions; non-media handlers unchanged |

## Validation evidence

The approved base is `d8b40f3a75c30f9e0ea860f824516d07d08279f6`;
the implemented and deployed candidate is `d2b09b7e5d9cb88cd2d734e6f8db6f2b40a25bf7`.
The Server TypeScript build passed. The driver command
`npm run check:affected -- --test-file apps/server/test/multiuser-media-queue.test.ts --test-file apps/server/test/multiuser-media-failed-fact-recovery.test.ts`
passed 17/17 tests with no skips in 21.68 seconds. Environment, shared and agent
build prerequisites passed; the driver confirmed cleanup and recorded receipt
`2026-10-23T05-01-08-270Z-ecba8cad-5bc0-434a-a96c-74b1c6522837`.
Both input files were frozen before execution, and their source hashes match the
committed release. The independent Central release built successfully and was
activated through the normal Dev upgrade command, without forced termination.

Formal local health, authenticated self, media model state, four fixed historical
tasks and two original processing statuses passed after deployment. A consistent
before/after metadata comparison retained task states, attempts `[3,2,2,2]`,
round 1, charged sessions, exact issuance/fact/snapshot and physical cleanup
records, model attempts, owner confirmations and zero complete artifacts. No
historical Retry request or model invocation was made by this verification.
The private operator receipts are `asr-repair-live-verification.json` and
`asr-repair-before.json` / `asr-repair-after.json`.

The newly started OCR worker also processed one generated PNG with exact text
and a new-incarnation succeeded fact. The formal OCR, ASR and speaker states
reported ready. ASR readiness is not a new audio inference or quality result.
No full workspace suite, physical device or live ASR quality check was run;
background Memory processing and the two protected historical audio failures
remain outside a claim of complete processing. This evidence does not establish
merge readiness or a Main-branch deployment.

Future deployment verification must again read the exact release and perform
bounded formal health/media/task readback. Keep historical terminal states,
attempt counts/rounds and protected success-without-body work unchanged; do not
issue historical Retry requests or replay captured recordings as verification.
Report read-only deployment checks separately from generated fixture results
and any separately authorized live-model check.
