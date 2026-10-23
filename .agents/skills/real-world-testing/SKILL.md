---
name: real-world-testing
description: Design Mote regression tests from concrete user failures and review coverage when fixing bugs, adding tests or changing lifecycle behavior.
---

# Mote regression coverage

Name the user failure the test prevents. Prefer real domain objects or public entrypoints; use generated evidence and mock only external services or unavailable platform boundaries.

Reproduce a regression before its fix when practical. Preserve meaningful outcomes, required data scale and cleanup assertions. Avoid existence checks, mock echoes, implementation mirrors and duplicated adapter scenarios.

Exercise timing where it matters: cancellation during work, late results, restart, partial upload acknowledgement, withdrawal or deletion. Control that state explicitly rather than hoping repeated runs exercise it.

Product decisions can supersede old assertions. Explain the old/new behavior and remove obsolete tests in the same change. Do not weaken valid assertions, timeouts or tested entrypoints merely to turn failure green; coverage reductions need independent review.

Use module `AGENTS.md` and [testing guidance](../../../docs/testing.md) for exact commands. Batch coherent edits, use focused feedback and reuse unchanged successful results. Connect a real cross-module path early; reserve the complete affected plan for the converged candidate.

Report fixture, physical-device and live-model results separately. Keep verbose output in ignored logs, preserving command exit status.
