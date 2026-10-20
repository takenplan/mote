# ADR: Incremental check evidence

Date: 2026-10-20. Status: revised implementation for review.

## Decision

The local check driver keeps one frozen runtime plan and the existing cross-worktree
lock. A later candidate may explicitly reuse a passed task's original evidence when
the driver proves that the task's inputs are unchanged. A repository SHA identifies the
candidate's provenance; it is not itself every task's dependency.

`--reuse <receipt-path>` reads a schema-v2 receipt from the same host and working
directory. Cleanup must be confirmed. The source task must have actually passed
with exit code zero and stable inputs before and after execution. A different later
task's failure does not erase that evidence. Interrupted, blocked or locked runs
cannot supply reusable evidence. An input-change abort may preserve unchanged
passed tasks for the next run; changed tasks remain invalidated.

Task identity includes its definition and arguments, source and transitive
dependencies, tests, fixture/configuration inputs, installed dependencies and
execution environment. Unknown input ownership remains conservative. Ordinary
documentation and PR metadata do not change runtime identity; executable scope
inventories, prompts and configuration do. Reviewed top-level workspace test files
select their complete owning suite; helpers and fixtures retain consumer coverage,
including known cases where another component reads a test file.

Reused evidence has a distinct `REUSED` status and retains its original receipt and
task identity. It never claims execution against the new SHA and cannot become a
new original for another reuse. Environment checks, builds and the Android Gradle
command run each time. Detected task-input instability remains invalidated even
if the original content returns before finalization. This
is evidence reuse, without a build-artifact or command-output cache.

Complete checks start after planned edits converge and focused checks reach the
required high-risk states. A passing result that never reached its required state
does not cover that state. Within an established design, implementation and fixture
control corrections need a recorded delta and focused validation. Changes to
assertions, timeouts, success criteria or entry points require an explicit review
of coverage impact. Responsibility, authorization, safety and external-contract
changes retain design review.

## Supersession check

| Disposition | Responsibility and reviewed assumptions |
| --- | --- |
| KEEP | Generated fixtures, consumer checks, runtime-input freeze, one driver and lock, failure history, privacy, separate journey/device/model evidence and truthful completion claims. |
| CHANGE | Reuse is decided per task by complete input identity and original provenance; known test and validation-script ownership narrows suite selection. |
| REMOVE | Whole-run SHA/content identity as the only reuse boundary, the blanket ban on cross-run PASS reuse, and unrelated documentation invalidating runtime evidence. |
| EXCEPTION | Builds and environment checks rerun; unknown ownership, shared helpers, fixtures, protocol, root configuration and lockfiles keep conservative scope. Runtime edits still abort the current frozen plan. |
| UNKNOWN | Undeclared external inputs, timing-dependent state and device/model conditions cannot be proved by local source hashes; those checks need fresh evidence. Savings must be measured on real plans rather than inferred from a historical run. |

Reviewed surfaces are `AGENTS.md`, the development guide, selector, task planner,
driver, input identity, their generated Git/child-process regressions and CI's
shared selection boundary. Historical validation records remain unchanged. Product
authorization, retention, prompts and runtime behavior do not change.

## Basis and limits

[Gradle's cache documentation](https://docs.gradle.org/current/userguide/build_cache.html)
requires complete task inputs and outputs: missing inputs can yield incorrect hits,
while excess inputs waste reuse. Its
[cache concepts](https://docs.gradle.org/current/userguide/build_cache_concepts.html)
separate stable inputs, repeatable outputs and unsuitable tasks. Mote applies that
input discipline to validation receipts and reruns builds because it does not
restore artifacts.

[Turborepo's task caching](https://turborepo.dev/docs/crafting-your-repository/caching)
uses task fingerprints and dependency/configuration inputs; its
[environment guidance](https://turborepo.dev/docs/crafting-your-repository/using-environment-variables)
explains why behavior-changing environment values must affect identity. These are
design references, without introducing either tool or a remote cache.

The current closure is intentionally broader than individual test imports: it
includes the owning workspace's complete tests and transitive product inputs.
Reuse is local to the original host/directory and relies on declared inputs plus
installed-tree/tool metadata. The reviewed Vite/Vitest `.vite` and `.vite-temp`
output caches are excluded; consumed workspace `dist/` bytes remain inputs.
Unmodeled external overrides, such as inherited `MOTE_*` or Node preload settings,
disable automatic reuse. Unmodeled external state requires rerunning the
check. Manually recorded, physical-device, live-model and state-specific journey
results are outside automatic reuse. Operational requirements are in the
[development guide](development.md#pr-check-scope).

The execution environment removes the caller's `CODEX_TOOL_CALL_ID` before both
hashing and spawning tasks. This invocation trace identifier otherwise causes a
miss on every separate tool call. Other inherited values remain inputs; ignoring
a variable only in the hash would leave an untracked input visible to tests.
