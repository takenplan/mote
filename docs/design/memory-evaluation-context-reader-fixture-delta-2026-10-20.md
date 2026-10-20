# Memory reader fixture: current private context correction

Date: 2026-10-20. This records a local fixture construction correction within the approved evaluation-context schema; it is not a new architecture/product decision or a completed check. Pending independent confirmation of this exact bounded delta before editing the test.

- Original runtime base: `bcff7bab6109a7c99acde3decb5712a072e1b045`; current frozen head: `936b5c232fd5b8a2a9349e68851b5283916f7d06`.
- Sole editable source/test path: `apps/server/test/scoped-memory-reader-batch.test.ts`; current file SHA-256 `2c8461ee1457035b334edf5f753a6aac6b82752aad1678f7890e4b47f8affb6d`.
- Root's completed third gate had 17 failures in this file at fixture schema parsing (`:15`), because manually constructed current task input lacks required `evaluationContext`. The original read authorization, ordering, SQL-count and publication assertions were not reached. No runtime failure is established by these setup failures. The separate recording timing failure remains under root investigation and is not part of this delta.

Exact correction by the sole Memory implementation owner:

1. Give this existing generated fixture one explicit fixed semantic clock, independent of source dates or wall time. Add `evaluationContext` to its current `scopedMemoryTaskSchema.parse` input, mapping all five existing required/read evidence pins to that fixed clock. Preserve the two required inputs, three optional read inputs, five Material pins and the original exact read ranges.
2. In the existing unknown-required-evidence negative case (`:76`), retain its new unknown UUID and original hash injection, but replace the corresponding old tail ID in the evaluation map with that same unknown UUID and the same frozen fixture clock. Remove only that displaced map ID. The map must describe the actual required-plus-read catalog so the unchanged `not_found` assertion reaches the original evidence guard rather than failing earlier on map completeness.

KEEP every original assertion, input count/scale, SQL mapping/version read counting, repeated-call lifetime, duplicates/optional ordering, exception identity, source/revision/dependency mutations, live account withdrawal, foreign-owner denial and final no-partial-publication checks. No runtime/schema/helper/host-fixture change; no source-time or current-time fallback; no old task rewrite; no timeout or success-criteria relaxation. The size-two/size-five variants retain the existing read catalog, so its five-entry map remains complete without changing those scenarios.

After independent confirmation, edit only that test file and run the complete file once with `node --import tsx --test --test-concurrency=1 apps/server/test/scoped-memory-reader-batch.test.ts`, record exact results and cleanup, and inspect any newly reached failure on its own merits. Do not rerun a complete suite or gate; root remains the complete-check driver. No parallel test process, paid model, personal data, dependency change, commit or push.
