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
its internal data reader, at each existing explicit assertion, for scoped
original reads, and in every image-output permission callback. Its internal
SQL reader retains account authority, closed-state and owner binding without
re-entering that full task guard for every SQL statement. No validation result
is cached across the image metadata or crop awaits.

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
