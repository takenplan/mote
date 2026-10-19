# Scoped Memory review and Ask source parity

These journeys restore the original single-owner business flow through the
current account-scoped ports. They do not change image proof, recipes,
current storage, authorization, or external unknown handling.

## Bounded independent review repair

Extraction stores one validated draft. If independent review passes ordinary
output validation but fails the retained visual proof check, the original
pipeline permits one repair of that same draft. The reviewer receives the
original host repair instruction and complete member-coverage requirement.
Each review call uses the existing frozen model lease, usage accounting and
its own image-delivery receipts. A second semantic failure terminates with
its original error. Transport/unknown failures do not become semantic repairs.
Grant, account epoch, task cancellation and all input pins remain current
before and after every attempt; revocation between attempts prevents another
model call. Nothing resumes a failed or unknown old job.

The `scoped review restores bounded post-review repair: ...` cases in
[multiuser-memory.test.ts](../../apps/server/test/multiuser-memory.test.ts)
exercise a real scoped execution: first post-review image-proof failure then
successful repair; two failures reaching the limit; cancellation, an
unrequested tail change or account epoch revocation between attempts; and
an external-unknown error propagating unchanged. They verify extraction is
not repeated and the accepted reviewer has a new run and pixel receipt.

## Bounded Memory originals in Ask

Both the public bound reader and the executing Ask reader return references,
host-verified source spans and partial coverage for an exact Memory request
with `includeEvidence`. The original maximum is three source spans and 2,000
characters each. Current canonical hash, quote, offset and length must match;
stored quotes alone never authorize citation. Scoped source visibility,
history, privacy, account authority and final proof fences remain in force.
Image selectors continue to require independent `read_image` proof.

The Memory-source cases in
[multiuser-ask.test.ts](../../apps/server/test/multiuser-ask.test.ts) use the
real bridge to check citable source delivery, long and multiple-reference
partial coverage, explicit historical Memory access, source revision and
retirement, and A/B isolation. An executed Ask call must cite the bounded
original actually delivered by `memories`, while the public consumer uses
the same projection without borrowing the executing run's pin state. The public HTTP preview
retains the original boundary projection: only the selected source substring
is returned in each record, with offset reset to zero. Internal readers and
the bridge retain full records and their real offsets.

Generated fixture and loopback provider results are separate from a normal
SDK/live-model journey. Full affected consumer checks and actual model
acceptance belong to the integration driver. The earlier failed/unknown
runs and their zero saved cards remain unchanged evidence.
