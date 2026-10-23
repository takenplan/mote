# Small modules and early integration

Use this guide for multiple owners. Single-module fixes need no coordination document or extra reviewer role.

Agree on the user-visible result, shared interface, file ownership and one minimal real journey. Connect that journey before implementation grows. Each owner changes a bounded module, runs focused checks and reports changed files, results and concrete gaps. Keep that owner for related repairs.

Prefer GPT-6.1 Sol subagents. Parallelize independent modules, not duplicate implementations. Do not install dependencies or rebuild shared output concurrently. Coordinate expensive checks so several suites do not compete for the same CPU or emulator.

The integration owner combines modules incrementally and freezes the candidate after planned changes converge. Inspect `check:affected --dry-run`, complete its plan once and verify the affected assembled journey. After repairs rerun invalidated checks, not successful unchanged checks for a new timestamp.

Use Git, PR descriptions, CI and ignored logs as evidence. Handoff the goal, decisions, revision, relevant result and next action. Do not maintain duplicate manifests, receipt tables or per-edit progress documents.

High-risk decisions follow [risk-based review](testing.md#risk-based-review). Report unavailable environments honestly; fixtures do not establish physical-device or live-provider behavior.
