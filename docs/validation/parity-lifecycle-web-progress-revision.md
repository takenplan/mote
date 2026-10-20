# LIFE Web image-progress fixture revision

The full affected run on `6cbd1721d5da482340699d09779db6b20150b30f`
(run `d0cc65c1-fa60-4319-ae1e-f0e7b04aeaf2`) passed 16 steps, including
Server 3,168 pass/two skip, then failed Web with 600 pass/one fail. Its remaining
five steps were unrun. The failed receipt, original log and input identity remain
historical evidence; this revision does not relabel that full run as passing.

The failure was the raw-screen image-progress fixture, before its actual unknown
result/restart/UI-confirmation assertions. It explicitly deleted a capture and
then expected replay of that same owned ID to return 200. The production journal
correctly returned `410 capture_deleted`. The same obsolete precondition also
appeared after the final UI retry. The fixture now uses actual source retirement
and registration for both legal same-ID, same-image/content incarnations.
Original proof rejection, unknown-result persistence across restart, no automatic
replay, disabled retry until the owner checks the existing confirmation, real
OCR publication and B isolation assertions remain.

Two additional mounted-React/product-HTTP journeys retain the deletion boundary
and exercise a held progress response plus an actual held OCR request. Capture
deletion rejects same-ID replay with 410, hides progress, rejects old controls and
prevents the late OCR from publishing. Source retirement permits the identical
capture ID/image/content with a new proof, rejects old controls, ignores the old
held read and late OCR, and admits current processing. B uses its equal public ID
and independently configured generated worker throughout. A and B cannot be
expected to run concurrently on one local worker: its existing physical capacity
is shared across accounts. The fixture uses two listeners without changing that
production scheduling policy. Read-only observation of actual activity/artifact
rows verifies settlement and nonpublication; admission and rendering use the real
HTTP and React entries.

| Disposition | Boundary |
| --- | --- |
| KEEP | Explicit capture journal 410, owner qualification, exact image proofs, held-read generations, late-result withdrawal, physical settlement, unknown-result confirmation and original progress controls. |
| CHANGE | Replace two impossible delete/replay preconditions with actual legal source incarnations; add direct journal and asynchronous progress regressions. |
| REMOVE | The fixture assumption that explicit deletion permits same-ID resurrection. No production behavior is removed. |
| EXCEPTION | Source retirement and Files forget/allow-again keep their existing distinct contracts. Independent worker listeners avoid conflating account isolation with shared physical capacity. |
| UNKNOWN | The selected remaining gate obligations, real UI/device/Codex model acceptance and exact subsequent composition require their own evidence. |

Only Web test and validation documentation files change relative to 6cbd1721.
The frozen handoff verifies every non-test/documentation tracked byte and the
production path diff. PM explicitly allowed the real same-SHA Server pass above
to serve as a component baseline when this production-zero condition holds.
That reuse is limited to the unchanged component; it is not a new complete gate.
The driver still owns the original failed Web obligation, strong consumers,
`release-integration`, `root-tests`, `client-tests`, `central-runner`,
`android-unit`, and any obligations selected for the final PR input.

Focused RED/GREEN logs, source hashes, full-PR and incremental dry-run selections,
production-zero proof and the original immutable failed input are bound in the
external revision manifest. They use generated content, loopback providers,
JSDOM and mounted actual React components against the real backend. No browser
window, real personal screenshot, physical device, emulator, actual model,
installation, full gate, deployment or merge was run by this revision owner.
