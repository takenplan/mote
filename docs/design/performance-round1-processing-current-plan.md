# Processing current-input facts: bounded round 1 follow-up

This document records the prospective external plan and independent approval used for this follow-up; it is not a retrospective claim that completed implementation was approved beforehand. The external plan was approved at 2026-10-20 23:15 UTC, before fixture preparation and product implementation.

The reviewed combined source base is `dccfe7b74a444e53b934954fc1f39fd1b052ab87`, containing the proposed #201, #203 and #202 composition. The later frozen owner base `68375944ac56f630c78df0a1c5618dd5cbb70fee` adds only the separately approved proof-observer test correction; all 18 product/document source anchors in the plan remained identical. Plan SHA-256: `66f8297b46f308eba4357515697af1c91d20b389254c787711e2c2a171fa288c`. Independent reviewer `/root/recording_remediation/recording_review`, Sol High, explicitly **APPROVE**d that exact plan; review SHA-256: `396d8e6488b6f90e153bda1909c3676b5c05088b9d5c42745cdc4dbe27092006`.

## Journey and decision boundaries

Original HTTP capture/document-attachment admission creates the real Processing task hierarchy. Existing engine validation invokes `Processing.current` at its original checkpoints. The original state and perception checks precede control, policy binding, attachment and original-generation checks, followed by the original model, intent, parent and plugin checks. Execution, physical provider calls, cancellation, retry, publication and restart keep their original entry points and ordering.

| Class | Decision |
| --- | --- |
| KEEP | Every outer validation/checkpoint; state lazy initialization; perception and early returns; raw native values and JavaScript missing/Number/String/truthiness/strict comparison rules |
| KEEP | Both original attachment queries and their full visibility predicate at the original JavaScript position; late account/model/parent/intent/plugin validation; all writes and existing caller transactions |
| KEEP | Same-owner active archive read sets execute the exact original suffix, selected row shapes, order, short-circuit subsets and captured read witnesses |
| CHANGE | Outside that archive scope, combine only control, policy-binding and generation facts into one fresh owner-bound seed/LEFT JOIN statement, with independent presence flags |
| CHANGE | These three facts share one statement snapshot at the old control-read position. Generation SQL is read before attachment SQL, while its missing/Number comparison stays after attachment validation |
| REMOVE | Two native reads per successful eligible current callback; no authority predicate, validation boundary or required write is removed |
| EXCEPTION | Generated fixtures, isolated profiles and loopback providers; no personal captures or live models |
| UNKNOWN | Stable wall/CPU benefit, production latency and the exact cause of the earlier full-load failures |

The original checkpoint already used several independent reads; neither implementation promises an atomic whole-current snapshot or return-time latest facts. A commit completed before the projection must be seen unless the caller already owns an older transaction snapshot. An overlapping writer may linearize on either side of that fresh projection. Existing subsequent callbacks, awaits, issuance and publication checks must still reject already-invalid input. Results are never cached or carried across checkpoints.

No new transaction, SQL coercion, schema/index, journal/WAL mode, FULL/fsync/ACK change, capacity limit, scheduler/timer/worker change, silent fallback, retention rule, authorization policy or round 2 implementation is included. Extra early reads on an old nonarchive false path remain pure reads inside the original catch-to-false boundary.

## Owners and representation

Only `scope/processing.ts`, `scope/ingress-file-forget.ts` and `scope/archive-read-set.ts` change product code. Processing composes the facts; Ingress exports its exact original generation query; the archive module exposes only a pure ambient same-owner boolean. Attachment, PrivateSql, Accounts, TaskAuthorization, TaskExecution and Engine sources remain outside this follow-up.

The generation helper retains its original literal query for the unchanged static owner-binding check. Its exported query text is identical and is interpolated into Processing's fixed owner-bound template. Both representations and all three original-ID bindings were compared exactly; the checker and its success criteria are unchanged. No reusable rows, authorization capability or archive scope escape through the new internal boolean.

## Validation allocation

The same frozen real-composition fixture, SHA-256 `8de13ecec4730c372dc92579876674da8ef67a73e26c61a3c190d32ff7f21a66`, is used on baseline and candidate. It enters through buildApp, authenticated A/B HTTP admission, registered tasks, public input-authority checks, physically held provider/model children and real final publication. Generated SQL mutations control negative states; they are not replacement product paths or a copied implementation oracle.

A prospective lifecycle coverage correction was independently approved before changing that fixture, review SHA-256 `7bcadd962218ec85c862769156047f816e29e852b5902db9771b2997dc2d32e9`. It removes an unsupported raw database close during a live pinned graph. Original A/B physical completion remains required before real application drain/close/rebuild; fresh A/B captures, tasks, model holds, independent writer checks and successful publication are then required after restart. The two unchanged native cache lifecycle consumers separately retain low-level close/reopen coverage. Earlier failed fixtures and their raw results remain historical, not passes.

Safety covers native missing/NULL/scalar/error behavior, ownership, attachment visibility, forget/allow-again/reimport incarnations, writer overlap, existing transactions and archive witness invalidation. Plain timing and native counting each retain 100 public calls in five blocks of 20. All observations remain; inconclusive timing is reported as such without repeat-until-improvement or discarded blocks. Native errors, safety/count failures or unconfirmed cleanup stop the batch.

The six original attachment/incarnation/portable/intake/native-scalar consumers and Server build remain required. Root alone owns the original default-six OCR/Recording/host-cleanup cohort and final affected check, hidden Web/Desktop entries and release identity checks. Focused evidence is not driver-proven task reuse, full-load acceptance, merge approval or a delivered fix. See the [validation record](../validation/performance-round1-integration-2026-10-20.md) and [integration PR](https://github.com/utopiafar/mote/pull/201) for actual outcomes.
