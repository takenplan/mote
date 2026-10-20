# Worktree module identity in the delegation HTTP test

The supplemental server suite marked the existing test **“declared bounds compile for both adapters and invalid arguments survive the real HTTP bridge with corrective errors”** as failed on frozen candidate `fe15cbd5e7aba9b53e3d664f7470a85107428013`. A narrow read-only diagnosis identifies a worktree dependency-link artifact: the test loads two separate copies of the same error class. **The original supplemental failure remains recorded.**

## Direct identity evidence

[The test](../../../../apps/server/test/delegation-proposal-lifecycle.test.ts) imports `startBridge` through the relative candidate path `../../../packages/agent/dist/bridge.js`. Both the test and [DelegationRuntime](../../../../apps/server/src/delegation-runtime.ts) import `ContextToolError` through the package name `@mote/agent`. Because this frozen worktree shares the main checkout’s `node_modules`, that package name resolves to the main checkout.

| Observation | Result |
| --- | --- |
| Package-name error module | `mote/packages/agent/dist/tool-errors.js` |
| Relative bridge error module | `mote-final-check/packages/agent/dist/tool-errors.js` |
| SHA-256 of either error module | `7b5b33c6432bbc320cb1faf6cc3d0743a24bb44c880959ce8f2fc0d0514a422e` |
| Constructor equality | `false` |
| Package-name error is an instance of the package-name constructor | `true` |
| The same error is an instance of the bridge’s constructor | `false` |

[The bridge](../../../../packages/agent/src/bridge.ts) keeps the host’s typed error when `error instanceof ContextToolError`; otherwise it creates a generic `context_tool_failed` error. Equal file contents do not make constructors loaded from distinct module URLs identical. The direct probe therefore explains why the test’s cross-worktree error cannot retain its expected `invalid_delegation_arguments` code through that catch. The root driver retains the authoritative original suite failure details.

## One controlled focused invocation

A process-local module resolver mapped `@mote/agent`, `@mote/shared`, and their declared package exports to the **same frozen candidate dist files**. It changed no source, test, compiled file, dependency directory, symlink, or active suite process. The exact existing test then reported **1 passed, 0 failed, 0 skipped**, in 1.072 seconds. The resolver also recorded that both constructor equality and the cross-import `instanceof` check became `true`.

The historical command was:

```sh
node --import tsx \
  --import /workspace/scratch/8d97506698dc/agent-test-diagnostic/candidate-package-resolver.mjs \
  --test --test-reporter=tap \
  '--test-name-pattern=^declared bounds compile for both adapters' \
  apps/server/test/delegation-proposal-lifecycle.test.ts
```

The [machine receipt](worktree-module-identity.json) records exact URLs, hashes, command, timing, source identity and resolver targets. The historical scratch loader and full logs are not claimed to be included in this archive. The test still exercises the actual loopback HTTP bridge, all three invalid argument cases and both valid calls. No live model request was made.

## Scope of the conclusion

This controlled result identifies the worktree module-identity problem for this specific supplemental failure. The relevant test, delegation implementation, bridge and error source are unchanged from base `2c78ca8d52a7d17fae20962cf68d09a717ffc73a`; no separate baseline test was run for this finding. It does not establish that the entire baseline or candidate passes, replace the original failed check, verify a live model, or explain the R5 SQLite corruptions.

A complete check should load workspace packages and direct relative imports from a single checkout so that typed errors have one module identity. The active broad check and shared dependency links were preserved during this diagnosis. No additional test rerun was performed.
