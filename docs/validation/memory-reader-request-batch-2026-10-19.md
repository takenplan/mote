# Scoped Memory reader request validation

## Regression scenario

A generated automatic extraction window contains 25 current text Materials.
The 24th intake remains pending without a job; the 25th admits one automatic
job. Its model transport is replaced at the factory boundary with a deferred
nonmodel agent, while the real task reader and context bridge remain active.
Compare ordinary file/usage HTTP requests during that deferred wait with the
same requests sent alongside one bridge evidence request for all 25 originals.

On the original `3efdec1b48b37a6c8a0405dacc1d3b4bb2bd22ab` implementation,
the measured reader request made 26 full-input validations and 650 full-pin
visits, occupied a synchronous span for about 2.29 seconds, and delayed the
same-run HTTP requests by about 2.30 seconds. The deferred-wait HTTP baseline
was about 7–8 milliseconds. This fixture identified repeated synchronous work;
it did not reproduce or establish the cause of a separate 10-second timeout.
Wall times are observations, not performance guarantees.

## Required boundaries

The task reader keeps its grant/job assertion and whole-request ID authorization.
An ordered synchronous data read shares only a successful full-input validation
inside that call. Each selected original still passes its current Material,
image, fingerprint and required-output checks. The existing public `readInputs`
API independently validates each call.

The ordered read preserves requested order and duplicates. A required failure
propagates its original exception; an invalid optional original is skipped
individually. Failed full-input validation is not cached as success. An empty
ordered sequence adds no extra validation.

After an await, change the last required Material's owner context through its
normal context update path, then request only the unchanged first original.
The new reader call must reject the stale full-batch grant. Validation never
survives another call, await, agent session, job or account.

## Automated coverage

The generated scoped tests in
[`scoped-memory-reader-batch.test.ts`](../../apps/server/test/scoped-memory-reader-batch.test.ts)
cover:

| Transition | Required result |
| --- | --- |
| Mixed required/optional sequence, repeated IDs | Exact order and multiplicity; invalid optional hash or Material skipped individually |
| Successful call → await → unrequested required tail changes | Next read of first original rejects with the original conflict |
| Full validation fails on an optional entry → required entry | Validation runs again and the required failure propagates |
| Equal Material business IDs under another account | No borrowed owner authority or evidence |
| Independent public `readInputs` calls | Each remains fresh; its existing deduplication contract remains |

The real automatic-window/bridge measurement additionally checks the 24→25
intake transition, actual validator counts, parent-process HTTP deadlines,
heartbeat overlap, cancellation and closure of the generated Host and workers.
The before/after comparison uses identical input byte hashes without increasing
the fixture size or retrying until a timing threshold passes.

Existing scoped authorization, catalog, image-proof and visual-delivery tests
remain consumers. Fixture checks do not establish physical-device or live-model
acceptance. Normal shipping still requires the same-profile Memory→Ask journey,
negative isolation/cancellation cases and the existing visual proof strength;
the integration driver reports those checks separately.

## Image-read full guard callbacks

The separate image path keeps its full task-current assertion before creating
its internal data reader, before each original chunk, in every image-output
permission callback and after awaiting the final image result. The source
capability is consumed synchronously into local buffers. Its nested callbacks
check current selected evidence and source membership; the internal SQL
readers retain account authority, closed-state and owner binding. They do not
re-enter the full task guard for each synchronous original SQL or file check.
Original hash/MIME, source, attachment, file ownership and checksum checks
remain. No validation result is cached across metadata or crop awaits.

A single existing scoped 2×2 generated-image fixture on `93faf97b` observed
185 full job-guard calls for each image read. An extractor read performed 185
full-input validations; the independent reviewer performed 370 because the
existing draft also requires fresh receipt validation. This confirms repeated
work in that path; it does not establish that an earlier production timeout
actually executed `read_image`.

The `scoped image currentness rejects ...` cases in
[`multiuser-memory.test.ts`](../../apps/server/test/multiuser-memory.test.ts)
cover an initially changed unrequested Material pin, a pin changed while the
real image metadata await is held, and cancellation during that same await.
The initial failure propagates its original exception before image output.
After the await, the original permission callback still rejects the image
with `image_unavailable`; no pixels or Memory can be published. The existing
A/B equal-byte image case continues to require each account's own original
and independent extraction/reviewer pixel delivery.

A same-scale independent-review measurement on `7c359b5c` used 31 unique
inputs, 39 read/range entries (eight repeated IDs), 25 unique Material pins
and intake rows, and a 31-member catalog over 24 Materials. Its own validated
52,001-byte draft contained 13 candidates, 29 citations, 31 read ranges and
two image receipts. One instrumented reviewer crop performed 37 full job
checks, including 30 nested Ingress callbacks, 74 full-input validations,
37 catalog checks and 37 draft receipt checks. Synchronous exclusive work
accounted for about 6.45 seconds of its 6.47-second wall time; Sharp metadata
and crop promise waits were about 10 milliseconds each. Inclusive subtree
times overlap and must not be summed. Instrumentation overhead was not
separately calibrated; the generated 4×4 pixels do not represent an actual
large-image decode benchmark.

The successor keeps the seven existing explicit whole-task boundaries,
including fresh draft receipt validation. A single same-scale comparison
checks the complete synchronous prefix and image-read wall time, both real
awaits, returned byte/view hashes and natural review/prepared settlement.
The expected lower guard count alone is not a performance pass. Its fresh
fixture journal and nonmodel bridge do not validate ordinary automatic
startup, the production SDK, a physical device or a live model.

The `scoped image review crop currentness rejects ...` cases additionally
let extraction produce a real image proof and durable draft, then hold the
independent reviewer's real Sharp crop await. Changing an unrequested tail
Material, cancelling the job or retiring its source must each reject late
review pixels with `image_unavailable` and prevent Memory publication. These
checks complement the original metadata-await and A/B isolation scenarios.

## Ask consumption and workspace boundaries

The Ask consumer separates its logical run/request/conversation/schedule fence
from complete retained-history, evidence, Material and Memory-card proof. Existing
`current` callers still require history. A full proof checks that history once at
its explicit boundary; selected Memory checks do not inject the same history
through every private SQL statement. All SQL keeps current owner, authorization
epoch and host-closure checks.

Memory `readPin`, `read`, `readVersion`, `page` and `bindRead` invoke caller
currentness explicitly at logical entry and disclosure boundaries. Descriptor,
provider, body and search suspensions check fresh selected/caller/provider proof
on success and error; the caller also checks at its own await continuation.
The complete page catalog is still checked after all awaited reads, so an earlier
entry cannot survive retirement during a later read. No successful authorization
is cached across an await.

Ask passes logical currentness to its Ingress workspace, with full proof before
and after the model/workspace/directory suspensions, working preparation, model
authorization, tool disclosure, result handling and publication. The generic
Ingress and SQL implementations are unchanged.

[`ask-memory-proof-boundaries.test.ts`](../../apps/server/test/ask-memory-proof-boundaries.test.ts)
holds the normal working preparation inside a live workspace after two opening
cards have been pinned. Source retirement, Material pin changes, deletion of the other pinned card,
account epoch change, conversation deletion and foreground request cancellation
must settle without an Ask model request or answer artifact. Existing actual
provider page, historical Memory, owner/isolation and canonical source-span
regressions remain consumers. Instrumented same-shape measurements are reported
separately from fixture correctness, physical devices and live-model acceptance.
