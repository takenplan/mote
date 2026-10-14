# Query leases and explicit Memory activation

Date: 2026-10-14. These are generated, headless regressions for the
[simplification decision](../adr-ask-evidence-quality-and-simple-context.md).
Original text, model responses, credentials and vaults are synthetic. HTTP model
responses come from a private loopback fixture; no live model, real recording,
personal screenshot or production write is part of these tests.

## Failures and current responsibilities

A wide conversation could retain complete private lineage but fail on its next
turn: repeated synchronous body reads for permission checks delayed the existing
execution lease timer, producing `interrupted` retries before useful model work.
Dependencies now resolve through one complete recursive set traversal. Permission
checks use current metadata and reuse Material/file metadata only within one
synchronous validation. Asynchronous preparation inspects every dependency in
scheduling chunks and yields to timers and intake. Chunking never clips the
authorized set. External requests and publication retain fresh synchronous
authorization, version and deletion fences. The 30-second lease and 10-second
renewal period are unchanged.

Startup recovery also previously called `run()` for a newly created manual
Memory job, making its ephemeral active flag satisfy the admission guard even
though the owner had not started it. Explicit running now persists
`activationRequired=false`; recovery selects only activated detached work.
Creation alone leaves a manual task dormant. Pause, cancellation, deletion,
current input/model/recipe validation and unknown external-outcome reconciliation
still apply. MVP historical jobs may be explicitly rerun; activation is not
inferred from old attempt counts or missing fields.

A restricted Memory bridge could also load an original, then send that loaded
seed after the original was deleted. Invalidating its batch prevented later
publication but did not revoke its still-running execution lease before the
first model request. Model admission and transport now revalidate the frozen
canonical evidence fingerprints, current named Formal output selections and
Memory exposure policy. Reuse lasts only for one synchronous guard. Trusted
custom model adapters receive the same host admission and transport hooks. The
fence covers seeds and actually delivered context originals; an unused future
context grant does not retire an independent target. HTTP checks each SDK
request. Codex checks each `turn/start`; its internal provider requests are not
individually exposed to the central host.

## Required journeys and executed evidence

| Journey | Observed outcome | Regression |
| --- | --- | --- |
| Existing conversation with 8,193 exact private dependencies → formal HTTP continuation → provider waits 31 seconds | Complete result; all dependencies retained; normal lease renewal; one execution attempt and one provider start. Private dependencies do not enter model evidence. | `query-large-lineage-http.test.ts` |
| Delete an original during asynchronous validation | HTTP 409, zero provider starts. Scheduling yields do not preserve stale permission. | `query-large-lineage-http.test.ts` |
| Delete an original while the provider is processing | HTTP 409, one provider start, no successful result from the revoked context. | `query-large-lineage-http.test.ts` |
| Create-only manual task → close/reopen | No extraction or review; activation remains required. Explicit run then performs one extraction and one independent review. | `memory-activation-http.test.ts` |
| Explicit start → interrupted shutdown → reopen | Persisted activation survives; the unfinished task recovers under its original grant and completes its checkpoint. | `memory-activation-http.test.ts` |
| Activated work → cancel or delete its original → reopen | No new model start; previous activation does not override cancellation or deletion. | `memory-activation-http.test.ts` |
| Cross-source graph/file-link/Memory/Material ancestry containing a cycle | Every ancestor retained, duplicates removed, traversal terminates. The lightweight fallback remains covered separately. | `conversation-lineage.test.ts` |
| Metadata authorization compared with original-body authorization | Same decisions for raw Coding prohibition, Material revision visibility/redaction, Coding append/full rebuild/retirement, source tombstones and file attachment ancestry. | `evidence-exposure.test.ts`, `file-model-access.test.ts` |
| 240 short exact targets → extraction/review; correction during review; 150-target saved draft → reopen | Complete target delivery without count subdivision; correction fences publication/checkpoints; restart reuses the valid extraction draft and runs independent review. | `memory-range-evaluation.test.ts` |
| Formal Memory API with 270 paragraphs across two Materials → three concurrent drains | One initial batch, one extraction, one independent review, 270 completed range checkpoints; an unselected Material receives no read grant. | `memory-range-evaluation.test.ts` |
| Delivered Memory seed → original deletion, owner declaration correction or named Formal output revision change | Zero first provider starts through both actual HTTP and generated Codex adapters; the unchanged control sends the supplied generated original. Revocation keeps a typed terminal cause. | `memory-model-transport-authorization.test.ts` |
| HTTP model session admitted → original deleted before the SDK sends its request | The transport authorization callback still rejects; zero provider starts. | `memory-model-transport-authorization.test.ts` |
| First HTTP request → successful context-only original read → deletion before SDK continuation | Exactly one provider start; the next request is rejected, without publication or a completed checkpoint. | `memory-model-transport-authorization.test.ts` |
| 4,097 frozen anchors, including context-only evidence, checked twice across an owner correction | Every anchor and exact Formal selection remains fenced; one canonical read and one output selection per pin within a guard; the next guard sees the correction. Raw Coding prohibition, explicit raw permissions and attachment-parent deletion remain enforced. | `memory-model-transport-authorization.test.ts` |

Targeted executions on this date passed: three large-query HTTP cases, four
activation/restart cases, six lineage cases, ten exposure cases and two file-model
access cases. The wide-target, correction, draft-restart and formal 270-paragraph
Memory regressions passed separately. Server typecheck and diff whitespace checks
passed at the corresponding code state.

The eleven generated Memory transport cases passed separately, including both
adapters and the actual HTTP tool-continuation boundary. Existing unused-context
correction/deletion cases still pass. The Codex fixtures count generated
`turn/start` messages, not live internal provider calls.

Example targeted entry points:

```sh
node --import tsx --test --test-timeout=120000 apps/server/test/query-large-lineage-http.test.ts apps/server/test/memory-activation-http.test.ts
node --import tsx --test --test-timeout=120000 apps/server/test/conversation-lineage.test.ts apps/server/test/evidence-exposure.test.ts apps/server/test/file-model-access.test.ts
```

These checks prove generated transport, state transitions and authorization
behavior. They do not establish live semantic quality, real recording coverage,
provider cost/latency distributions or physical-device behavior. The final
affected-component check and verified target commit/release are reported
separately; passing these fixtures does not confirm deployment.
