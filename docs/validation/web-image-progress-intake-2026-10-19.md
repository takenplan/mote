# Web image progress intake regression

The required gate on File `286194a3` failed three Web image-progress tests:
the expected historical label already showed OCR progress, recreated input had
waiting jobs instead of none, and the first explicit recompute observed two OCR
calls instead of one. The gate remains failed: 16 steps passed, Web had
598 passed / 3 failed, and the later five steps were unrun.

All three failures reproduce on the unchanged input. The independent image
contract uses `perception.enabled` and `perception.understandingEnabled`;
`processing.automatic:false` does not suppress image intake, and the file
understanding flag does not select OCR-only image processing. A read-only
diagnostic before the old explicit recompute observed OCR=1, language=1,
OCR succeeded, understanding failed, image automatic=true and file
automatic=false. Recompute correctly issued the second physical attempt.
This is an obsolete consumer precondition, not proof of automatic replay.

Manual retry fixtures now use existing product operations: disable image
processing, accept the real image intake, observe its blocked coordinator,
cancel it using its current proof, then enable image processing. Cancellation
keeps that admitted intent retired and sends no transport. A subsequent UI
complete/recompute is a fresh explicit intent. The integration view therefore
shows an admitted cancelled job rather than a never-admitted historical image.
The existing unit view also checks that a genuinely unscheduled DTO retains
the historical label.

The checkpoint test keeps image processing enabled and consumes the one real
automatic intake as its first attempt. Exact transport assertions remain:
OCR=1 / language=1 after the failed understanding attempt; complete retains
OCR=1 and reaches language=3; all-success complete is a no-op; recompute reaches
OCR=2 / language=5. The other integration journeys retain their original OCR
counts, lost-ACK operation/task identity, same-ID A/B scope, original proof
rejection, unknown confirmation checkbox, cancellation, late publication fences,
restart, outer FileDetail refresh, pagination and revoked-source cache assertions.

No application source, defaults, privacy/authorization scope, retry policy,
timeout, wire/storage version or dependency changes are needed. The consumer
uses real HTTP routes and generated OCR/model responses with headless JSDOM.

Combined core `2044b446` has additional lifecycle prerequisites and two more
held-read tests. Its first-three failures share these old fixture assumptions;
the held-read failures stop before their intended boundary and do not establish
a leak or a passing safety check. Porting must preserve that core's capture
tombstone and source-incarnation assertions; replacing its whole test file
with the earlier File variant would discard those tests. Exact combined-source
revalidation remains separate.

External Q001-R3 evidence records original RED, the pre-recompute counters,
focused consumers, final source identity and supported dry-run plans. The
test/document-only delta can be proposed for component-baseline review, but
does not itself approve reuse of a failed full-gate receipt or turn its five
unrun steps into passes. Earlier Files873, File374, File286 and combined-core
failures retain their exact original outcomes.
