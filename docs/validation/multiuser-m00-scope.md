# M00 scope foundation validation

Date: 2026-10-15. Base: `6272a9b51ec92cc4c32e2ff1a1eeb4fa38b142ed`.
Target: `codex/mote-multiuser-integration`. This validates M00 only; private
production capabilities remain unavailable until their owner modules register
scoped implementations. It does not establish complete multi-user operation.

## Foundation acceptance

`node --import tsx --test apps/server/test/scope-foundation.test.ts apps/server/test/scope-architecture.test.ts apps/server/test/startup.test.ts`
passed **14 tests, zero failures and zero skips**, including an independent
reviewer run on the final foundation implementation. All inputs, credentials and
vaults were generated; successful process startup bound a temporary loopback
port. No running deployment or real user data was used.

- Host provenance rejects missing, forged, copied, foreign and revoked contexts.
  Immutable A/B contexts retain their own private services. Admin A cannot select
  B through headers, bodies, query identity selectors or lifecycle archives.
- Private HTTP requires wire 2: missing, older and future versions are rejected.
  Missing domain implementations return an explicit unavailable result; old owner
  tokens cannot authenticate. The actual production process exposes health and
  rejects private requests without mounting the legacy composition.
- A revoked identity cannot publish a late HTTP response. A separate host grant
  permits only its declared user/domain/operation/purpose lifecycle action after
  account disable; it cannot obtain ordinary private services. Deleting A leaves
  the generated B value unchanged.
- Epoch-4, live generated WAL, unknown, malformed and inconsistent epoch-5 vaults
  are rejected before mutation. Snapshots include file names, bytes and directory
  and file modes; an invalid deployment ID is rejected before permission repair.
  The actual startup path reports `unsupported_vault` before token/PID/config
  writes, rather than passing because configuration parsing failed first.
- Undeclared table/API/task/directory/extension boundaries fail the architecture
  check. It covers `registerUserRoute`, the public builder, transitive imports
  (including `.mjs`) and explicit rejection of importing the old fixture.

The first sandboxed run could not bind loopback (`EPERM`). It was rerun with the
supported local test permission and passed; no test was skipped or relaxed.

## Existing regressions and affected checks

The old single-owner composition moved to
`apps/server/test/fixtures/legacy-app.ts`. Existing algorithm tests and fixture
scripts explicitly import it; their assertions still run. The fixture is outside
production compilation. Its inferred dependencies were made an explicit
`FeatureServices` type, checked against the fixture composition. There is no
configuration switch, environment switch or test-mode permission bypass in the
production builder.

These old checks prove algorithm regression only. They do not prove user
isolation, credential binding, new ingress/archive support or complete production
composition. The complete acceptance path is the module matrix and final joint
run through `src/index.ts` / `src/app.ts` / `scope/app.ts` with actual scoped
services enabled.

The required affected command is:

```sh
npm run check:affected -- --base origin/codex/mote-multiuser-integration
```

The first sandboxed invocation was interrupted after loopback permission failures.
The supported-permission invocation selects full TypeScript integration and Android
JVM tests because fixture consumers and root scripts changed. Its final result is
**passed** with temporary `JAVA_HOME` pointing to the installed JDK 21 and
`ANDROID_HOME` pointing to the installed SDK. No repository Actions settings or
user environment settings were changed.

| Check | Result |
| --- | --- |
| Translation, library builds, all workspace and script TypeScript checks | Passed |
| Desktop | 456 passed |
| Server | 1937 passed, 1 existing conditional skip |
| Web | 469 passed |
| Agent | 316 passed, 1 existing conditional skip |
| Diagnostics / shared | 5 / 190 passed |
| Root release/media/security/profile/proxy regressions / client | 81 / 4 passed |
| Central runner fixture | Passed |
| Android JVM | 329 passed in 70 suites, zero skips |
| Central and Web production builds | Passed; existing Web bundle-size warning |

The two existing skips require explicit OS-sandbox / installed-Codex opt-in. No
new skip was added. The initial full run exposed workspace-relative subprocess
paths and old startup expectations; paths now use the module URL, and startup
tests initialize epoch 5 and assert denied private access while retaining PID
recovery/exclusivity assertions. An additional plain-Node fixture-loader smoke
check found an unsupported loader-registration API; it now uses `tsx/esm/api`
and has a regression. The final full server run includes that new test.

A fresh compiled `apps/server/dist/index.js` process also returned health 200 and
private request 401 and created no old access token. All generated processes and
temporary directories were cleaned up.

## Independent review and remaining responsibilities

The independent reviewer found a lifecycle authorization gap after account disable,
incomplete route/import inventory coverage, and a malformed deployment-ID
write-admission gap. All were fixed with negative regressions and independently
retested. Final review reported no unresolved P0/P1/P2 findings.

M01 provides trusted credential verification and account administration; M02 adds
private repositories and index constraints; M04/M05 adapt configuration and durable
work authorization. Each subsequent module restores only its tested production
capabilities and implements its lifecycle hooks. A web session context is not a
substitute for a durable task grant: logout must not revoke already authorized
background work. M16 supplies durable lifecycle authorization, reconciliation and
whole-instance backup/restore. The [17-module matrix](../design/multiuser-modules.md)
defines every module's restoration and acceptance responsibilities.

Not run: real models, real external providers, native client UI/emulator/device
journeys, container deployment or restore of a real vault. Those are downstream
module or final joint checks, not M00 evidence. A generated fixture never establishes
real-provider isolation or a malicious-plugin sandbox.
