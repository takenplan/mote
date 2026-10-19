# M07 first-run fixture corrections

This is a test-only child of frozen M07
`66a576fd09653ae5c30df0b35dcbc0475edd882d`. Production, shared contracts,
M05, Ask, backup schema, dependency locks and the shared upload helper retain
their exact parent blobs. The correction is not a production repair or a
qualified GREEN result.

## Actual parent execution

Driver's first own-worktree run at 66 performed normal installation, Node26
ABI147 SQLite prerequisite, Shared/Agent builds, Server semantic build and scope
check successfully. The complete three-file test run exited1: **81 tests,
76 passed, 5 failed, zero skipped/cancelled**, Node147.856s / subprocess148.642s.
All five failures are in the new M07 incarnation file. The complete existing
processing file (68 tests) and new backup/portable file (3 top-level plus five
nested cases) passed. Those are parent results, not re-executed child results.

The authoritative receipt is `review.json`, SHA256
`42a743cd618e61e563821cfb0a9e5d67060d55635aabe37fd3ca9305cf5bbc2c`,
in `m07-66-own-first-whole-20261019` under the driver's parity-integration
artifacts. stdout SHA256 is
`e581cbace328036f0204e74b1a45cc1a2e52b4b4b023af885d799c957123e5ab`;
stderr was empty. Original logs and failures remain unchanged.

## First failures and bounded corrections

| Case | Actual first failure | Classification / correction |
| --- | --- | --- |
| Supplementary current-epoch M05 admission | Owner-wide physical journal count was1, expected0, at old line32 | Invalid measurement scope. M06 local extraction also records physical I/O. Retain exact settled baseline facts, require explicit M07 physical-call count0 and all model receipts/usage empty, and assert the entire baseline unchanged after admission, duplicate and restart. |
| Source recreation seam | Duplicate upload part0 PUT returned409 at old line44 | Test transport reuse. The shared helper uses externalId as fixed batchId and writes a part after reopening a committed upload. A new local redelivery helper changes only transport batch identity; same source/external ID/revision/title/path/MIME/bytes/hash are retained, and duplicate flag, capture ID and original ref are required. |
| Complete reset/exact-revision republication | processing.pipeline became stale, code grant_revoked, extraction checkpoint retained | Public journey remains unresolved. Keep original revision and all-consumer success assertions. A known separate Ask dependency is source evidence, not a recovered causal runtime stack. No fix or bypass here. |
| Held ASR, current epoch | Duplicate part0 PUT returned409 at old line66 | Same transport fixture defect. Use the identical local redelivery correction; preserve held-response, B, late publication and physical-call assertions. |
| Held ASR, reset | Initial replacement upload commit returned401 invalid_identity at old line65 | Public journey remains unresolved. Initial replacement path is unchanged. Do not infer an actual internal Ask stack or weaken any listener/grant/revision guard. |

The first metric failure occurred after the fresh grant, duplicate task and old
history assertions; restart assertions were not reached. Source-token/await
checks preceded its duplicate PUT failure, but final duplicate/B assertions were
not reached. The held current-epoch failure preceded the release/current-output
checks. Test teardown releasing a barrier is not proof that those checks passed.

## Contract evidence and limits

`ProcessingHost.extract` calls `io` for processor operation extract. For local
extract it supplies no media model request; `io` still calls `run.external.begin`.
M05's task_external_calls records issuance/settlement, independently of model
lease/usage accounting. Thus a nonzero global physical journal is not evidence
of paid replay. The parent's failure output did not preserve the one row's
kind/model receipt: its actual attribution remains unobserved. The corrected
fixture explicitly checks/emits the baseline kind and receipt/usage counts on
the next authorized run rather than claiming that source inference is measured.

`Ingress.beginUpload` returns an existing committed receipt for a repeated batch.
`uploadPart` correctly refuses a row with receipt. A fresh transport batch is
allowed to deliver the identical canonical revision; `commitUpload` and
`PrivateData.receiveSourceItems` retain current-head and fingerprint checks.
The shared helper and product retransmission behavior are unchanged.

This deterministic seam still does not prove successful paid-checkpoint recovery.
The retained whole M07 process/unknown-outcome regressions remain the appropriate
separate evidence. The child keeps before/after exact physical history checks,
empty model receipts/usage and persisted successful task attempts, without
claiming that zero newly observed model work replaces those process journeys.

## Validation boundary and next resource request

This child was source-inspected and formatting-checked only. No dependency
installation, build, syntax/import/typecheck, scope checker, test, database
fixture, listener, model, native/UI/device check, image C or old-job retry ran.
No peak resource was acquired. No production failure was silently patched.

After driver authorizes a suitable own-runtime window, run **only the two
corrected seams** from this file first (names beginning `M07 host admission`
and `M07 source retirement`), retaining raw outputs and exact child/runtime
binding. Do not mechanically repeat the parent's passing processing68 or entire
backup file. The three public cases remain outstanding until one complete run
on the final qualified Ask+M07 frozen composition, with all subscribers enabled.
No skip/filter of a consumer or weakened canonical revision can substitute.
Any new failure must be reported before another repair/retry.
