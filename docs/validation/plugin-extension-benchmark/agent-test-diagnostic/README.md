# Existing agent mock HTTP decoder failure

The two failing DeepSeek agent tests in the frozen candidate’s affected check are caused by the existing test provider decoding each incoming HTTP Buffer independently. The product supplies complete original bytes. A bounded comparison reproduced the defect on original baseline `2c78ca8d52a7d17fae20962cf68d09a717ffc73a`. **The formal affected check remains failed**; this diagnosis does not resolve or reclassify the separate R5 SQLite corruptions.

## Checks and exact inputs

The original `check:affected` run on candidate `fe15cbd5e7aba9b53e3d664f7470a85107428013`, against base `2c78ca8d52a7d17fae20962cf68d09a717ffc73a`, reported **328 agent tests: 325 passed, 2 failed, 1 skipped**. Its run ID is `c25e50ef-b6b6-49a5-a340-076f0cefc227`; its input identity is `4e288d2d82c8214790c72ea59c73f1bc7ca5a8a64abf7762efd4cef14e33373f`. The complete-check driver reports the remaining supplemental stages separately.

```sh
npm run check:affected -- --base 2c78ca8d52a7d17fae20962cf68d09a717ffc73a --head HEAD
```

Exactly one focused invocation per input then ran the two named DeepSeek tests. Both used the unchanged test file plus the same pass-through byte observer. All model-facing requests were local generated mocks; there were **zero live model calls** and no production or test edits.

| Input | Focused result | Observed request Buffers |
| --- | --- | --- |
| Candidate `fe15cbd5e7aba9b53e3d664f7470a85107428013` | 0 passed, 2 failed; 1.972 seconds | Both requests split into `[64968, 42995]` bytes. Independent decoding corrupts one emoji. |
| Original baseline `2c78ca8d52a7d17fae20962cf68d09a717ffc73a` | 1 passed, 1 failed; 3.540 seconds | Delivery splits into `[32227, 65536, 10200]` bytes at ASCII and passes. Capacity splits into `[64968, 42995]` bytes inside the same emoji and fails. |

The historical focused command, executed once in each recorded worktree, was:

```sh
node --import /workspace/scratch/8d97506698dc/agent-test-diagnostic/chunk-observer.mjs \
  --test --test-reporter=tap \
  '--test-name-pattern=^deepseek (delivers|preserves)' \
  packages/agent/test/internal-input.test.mjs
```

The observer and full generated-output logs remain historical scratch diagnostics; those absolute paths are provenance, not files claimed to ship with this archive. The [machine receipt](diagnosis-results.json) retains commands, candidate/base identities, observer hash, byte boundaries and exact-equality outcomes without request bodies or credentials.

## Direct byte evidence

The mock server in [internal-input.test.mjs](../../../../packages/agent/test/internal-input.test.mjs) uses `let raw=''; for await (const part of req) raw += part;` before parsing JSON. Each Buffer-to-string conversion independently decodes UTF-8. For each 107,963-byte failing request, the boundary separates the emoji bytes `f0 | 9f 8c b1`. The fixture creates four U+FFFD replacement characters in original 2, whose length becomes 3,197 instead of 3,195 UTF-16 code units.

For all four observed requests, concatenating the unchanged incoming bytes and decoding them once yields all three expected originals exactly, with zero replacement characters. The request field remains the complete 24,619-character question. The original range oracle detects corruption introduced by fixture decoding. This identifies the mechanism directly; unchanged source alone would not establish the cause.

Agent/shared sources, tests, manifests, lockfile and the response fixture are identical between base and candidate. The freshly built baseline and frozen candidate compiled outputs match across all 53 agent files and 147 shared files. The machine receipt records matching aggregate hashes and dependency resolution paths. Both use Node 24.19.0, TypeScript 5.9.3 and DeepSeek packages 0.2.0-rc.2.

## Interpretation and remaining work

This is a pre-existing test-provider decoder defect whose outcome depends on HTTP Buffer boundaries. The observed failures do not show model-input truncation introduced by the plugin changes. They also do not establish that the baseline is clean, that live-model behavior works, or that the separate SQLite failure has been explained.

A separate repair can accumulate the incoming Buffer objects and decode `Buffer.concat(chunks)` once, retaining the complete-original assertions. No repair or amended-test run was made here, preserving the frozen candidate. The observer may perturb chunk timing; the original complete check independently contains the same replacement-character symptom. No failure-frequency estimate or broad retry was attempted.
