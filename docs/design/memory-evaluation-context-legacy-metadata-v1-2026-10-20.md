# Evaluation metadata for legitimate uncontracted recipes

Date: 2026-10-20. Status: proposed, implementation not started. Delta ID: `memory-evaluation-context-legacy-metadata-v1`.

Parent approved plan `memory-evaluation-context-restoration-v2`, SHA-256 `4e85b9497a90dd95e3efe741baceeb025b3896bcf8f0432db4fffa0f60e08bef`; subsequent approved feedback delta `7031685fff490f38f2eebf75cb065309cc7dcefab113292620443f9bb598a096`. Exact source base and HEAD `bcff7bab6109a7c99acde3decb5712a072e1b045`. Runtime tracked diff SHA-256 (`git diff -- apps/server/src packages/agent/src`) `0bb8c5271ea356cc5b02e6421e32e77a2542550331c0a0704f1efa8f092f61ac`; untracked `scope/memory-evaluation-context.ts` SHA-256 `2143a0a20ed7716e6e507df0684df1b218d3afa560b483dac5bbb9e5a423ddf9`. Sole source/test owner remains memory_adr_audit; complete-check driver root.

## Reachable omission

Independent implementation review I1 identified a remaining U1 omission. Current `MemoryStrategies` legitimately installs personal recipes @2/@3/@4 and custom definitions with no `workContract`. New jobs may explicitly select these through the same HTTP request/settings route, including automatic mixed-intake packages. This is not an old task or storage migration.

`scope/memory.ts:256` constructs `memoryWork.members` only for a selected binding with `workContract`. The new private evaluation map is complete and top-level now correctly uses the first target, but later targets' evaluation clocks do not reach the actual model envelope for these legitimate bindings. Source dates remain different. `scope/memory-coding.ts` similarly has no selectedWork when the caller lacks that work contract. The shared single-user pipeline already supports member clocks for authorized packages (`memory-pipeline.ts:986`), but copying its coverage program would change today's scoped legacy output contract.

## Bounded change

KEEP the exact selected recipe, extraction/review text and versions, candidate limits, response mode, existing legacy output/coverage acceptance and review behavior. In particular, retain `memory-review.ts:45–47`'s existing empty legacy draft shortcut; do not force an empty legacy result into a new coverage review. Range-evaluation jobs keep their approved `memoryWork` shape and mandatory independent coverage review unchanged. Native draft semantics, tools, source/catalog fences, body grants, batching, clock selection and private task schema remain unchanged.

CHANGE only the host-owned time metadata carried with an uncontracted selected recipe:

- Add `taskContext.memoryEvaluation` for an extraction selected binding without `workContract`: `{members,contextMembers,instruction}`. Its vectors contain only exact target/context ranges already passed to that call, their host-frozen `evaluationTime`, separate source `contextTime`, source/Material identity and attribution. They contain no host key, fingerprint, completion state, memory IDs, coverage, capacity, authorized body catalog or tool capability. Derive them from the same validated `data.members(input)` and source-safe private snapshot as range jobs.
- A short shared internal helper in `memory-work-contract.ts` projects that descriptive metadata and states that each range's evaluationTime interprets relative time, source contextTime remains observation metadata, and another member/call time must not replace it. It must not request coverage, raise a quota, ask for owner confirmation or alter policy. Keep the existing legacy `memoryWorkInstruction` output text/branch behavior unchanged except extracting its already-approved time-role sentence into a helper if useful.
- Keep this field outside `memoryWork`, so Agent compaction/alias restoration, `reviewMemory` work-package detection and `prepareScopedCoding` coverage validation do not accidentally upgrade legacy output requirements. Shared query serialization already retains arbitrary task-context fields. Add focused serialization assertions; no public QueryInput/client schema or Agent runtime change is needed.
- Coding preparation narrows the copied `memoryEvaluation.members/contextMembers` to its own exact scope before the understanding call. Top-level understanding now remains the first scope target clock through the already-approved port. This metadata is descriptive and cannot add body reads. Existing selectedWork and range coverage validation stay as before.
- Include this metadata in `codingGenerationContract` alongside the already-approved private evaluation map/skill/work/model/policy identity, so exact reuse/publication checks cannot ignore a changed serialized evaluation vector. Do not rewrite old preparations or successful query receipts.

REMOVE no supported recipe or task path. EXCEPTION none. UNKNOWN none about this reachable path; stop if implementation requires promoting a no-workContract binding, changing a legacy output/coverage rule, adding body grants or editing an old task.

## Minimum ownership and validation

Only existing owned runtime paths: `apps/server/src/memory-work-contract.ts`, `scope/memory.ts`, `scope/memory-coding.ts`; focused tests and existing generated fixture. No Skill, shared public schema, route, permission, scheduler, table or client implementation changes.

1. Real HTTP ingress of two fresh originals at distinct semantic clocks, delayed real M06 processing, automatic minChanges=2 under legal selected no-workContract recipes. Assert the same package size and final extraction/review serialized envelopes contain both distinct range clocks and correct top-level first-target now. Return valid **legacy memories only**, without coverage/capacity, to prove no output upgrade. Also retain a legacy empty result test with its existing review behavior.
2. Real two Coding-session ingest/organizer/automatic job under a no-workContract recipe. Understanding gets only its own session's time vector and first-target now, with no semantic Skill; ordinary extraction and nonempty independent review retain neutral `memory-strategy` and unchanged legacy output. Source time stays separate. Assert actual provider HTTP calls, durable preparation identity, restart no replay and no extra body grant. Reuse mismatch unit test adds a changed metadata vector case.
3. Existing range-evaluation, feedback compatibility, owner, integration, compaction and receipt consumers remain required, but unchanged suites need not be mirrored. All records/providers are generated locally; no paid model, personal data, device, dependency installation or complete-check run.

Approval binds this file's exact bytes/hash, source base/head and the unchanged legacy-contract assumptions. This closes a remaining approved U1 consumer omission; it does not introduce a new product policy.
