# Development-server first-run regression

Run date: 2026-10-18 (Asia/Shanghai).
Status: the corrected development-launcher case naturally passed **1/1**, with
zero failures, skips or cancellations. This is a narrow generated-data check;
the joint candidate's complete regression, live Codex acceptance and delivery
remain recorded separately in the
[main integration report](main-multiuser-integration-2026-10-17.md).

## Source and execution

The actual launcher, account service and development initializer came from P,
`fba648f15f30890a7610d27946ba4fc24c5d8ea5`, tree
`78ab498bca3d00f90de37cd907ed5aac52c9281b`. The final corrected
[fixture](../../scripts/release/dev-server.test.mjs) has SHA256
`93dc7b4f7c84cefbe1584fea919552da07b831e87f0460d175fee56ff7ffd0b5`.
The debugging follow-up changed that fixture only; it changed no production
code, timeout or password policy.

The passing execution used P with this fixture overlay and the root's already
dirty release metadata: Desktop `0.0.88`, Android `0.0.89` / versionCode `100`.
It was not a pristine P checkout. Commit
`30938d94fa4cee8aabf8099ae97f55cc062869ea`, tree
`58678c272d85f54baed880e6803c9d62f07aca8e`, subsequently records those exact
fixture and release-metadata changes. The passing run is not relabeled as an
execution at that later commit, nor as a complete validation of it.

| Production input, byte-identical to P | SHA256 |
| --- | --- |
| `scripts/dev-server.mjs` | `8d3c92b851572263cf7572e2ff605ab98e74fe014dbc5cd2c5ee6f6181e2ac04` |
| `apps/server/src/scope/accounts.ts` | `1c7d32b3c839a47b766c7e6db7ec2a426995b25cd892e60c10404c20da61d475` |
| `apps/server/src/scope/initialize-development.ts` | `a48ffa54295eff63f88e096851709fd2a50fae1f148aad44f22fa477fff9bd62` |

Command, using Node `v26.11.1`:

```sh
node --test scripts/release/dev-server.test.mjs
```

The final command naturally exited **0**. The single case took **13.491512 s**;
the complete command took **13.626686 s**. The existing 180-second case timeout
was unchanged. No other test suite, live model or emulator ran alongside it.

## Failed attempts and fixture corrections

P's consolidated targeted run had 222 tests: 221 passed and one failed, with
zero skips or cancellations, in 295.692431 s. Its sole failure was this fixture's
first-start assertion: `firstAttempt.code` was zero rather than nonzero. The
original P run remains failed; later narrow success does not turn it into a
passing complete suite.

The first isolated diagnostic reproduced the same failure, naturally exiting
1. Its captured launcher output was empty. A separate generated path probe
showed the cause: macOS returns a temporary directory below `/var`, while Node
canonicalizes the module URL below `/private/var`. The copied launcher's existing
direct-entry guard compared the uncanonicalized `argv` path with that module
URL, found them unequal and did not execute the CLI. The generated npm shim had
not been reached. The fixture now creates its owned checkout below
`realpath(tmpdir())`, so it invokes the unchanged production entry correctly.

That correction reached real account and Web HTTP behavior. The next isolated
attempt naturally exited 1 because its Web logout omitted the current protocol's
`X-Mote-Session-Id`; the server correctly returned **409**. The fixture now sends
the discovered session's `credentialId` together with its cookie and CSRF token.
The production session fence was not relaxed.

The npm shim's JSONL construction was also made explicit, and the fixture now
checks that the actual launcher invoked the generated `npm ci` command. The
initial default development port may already belong to the user's service, so
the fixture verifies build-failure propagation again on its own random port.
No occupied user service is stopped. This avoids treating a port refusal as
proof that an npm failure propagated.

| Retained local log | Natural result | SHA256 |
| --- | --- | --- |
| `mote-main-multiuser-consolidated-focused-P-20261018.log` | Exit 1; 221/222 passed | `cbba1a3f1ecf6b595c6ac42271ab25d2c3aa58dd1c7f0cb02089f39e695520f7` |
| `mote-main-multiuser-devserver-diagnosis-P-20261018.log` | Exit 1; direct-entry fixture mismatch | `69e05fa5b3664c35ed5a19f56e6df6c6868f31791ba5d6302912490321a2eba6` |
| `mote-main-multiuser-devserver-canonical-P-20261018.log` | Exit 1; missing Web session header | `04d8530b89d3591b62c3a2d5c42e656e668ec0e5a947817c8b5d7a130fa2fa87` |
| `mote-main-multiuser-devserver-green-P-20261018.log` | Exit 0; 1/1 passed | `227ad58fc8cea76256c5222704706f6006c0456afc780a51b3b7a2af66fe42fe` |

All logs remain under the local system temporary directory. They contain
generated fixtures; tokens, private configuration and real personal content are
not copied into this report.

## Actually verified behavior

The fixture compiles the current Server into an owned temporary checkout and
copies the actual launcher and profile module verbatim. It launches real Node
subprocesses and exercises the current Wire-2 listener over HTTP. Its assertions
cover:

- The public CLI creates a missing development profile. A deliberate failed
  build leaves the account database absent; successful startup then creates
  exactly one hashed `admin` / `admin` administrator in an empty vault.
- Actual client login and Web-cookie login work. Web login does not return a
  bearer token; discovery returns the administrator identity and CSRF token,
  and logout succeeds with the exact current session binding.
- Ordinary account creation, password change and administrator reset each
  reject the short password with **400**. Changing the development password to
  a valid replacement preserves account identity and hash across restart; the
  old password fails and the replacement succeeds.
- An existing account database with a different administrator name remains
  byte-equivalent at the account-row level; startup neither adds `admin` nor
  resets credentials.
- An occupied unmanaged listener, failed build, active PID and unsupported
  nonempty vault are refused without creating or replacing account data.
  The unsupported-vault sentinel and active PID file remain intact.
- The initializer rejects prod, unknown runtime, non-loopback host, Docker and
  the production port before creating the selected vault.
- Normal SIGTERM shutdown removes the generated process record and Server PID
  file. Every launched CLI is tracked for cleanup, including failure paths.

## Limits and cleanup

The npm command is an explicit generated shim: `npm ci` and workspace build
commands do not install dependencies or rebuild bundles in this fixture.
Server code is really compiled once with TypeScript before launcher execution;
the fixture verifies its launcher consumption and account lifecycle. It does
not prove a fresh dependency installation, a Web bundle build, browser form
interaction, media-worker startup, physical-device behavior or live-model
quality. The unchanged Web login form was separately inspected and has no
12-character minimum; that inspection is not claimed as a browser execution.

All test accounts, profiles, configuration and data are generated. Media-worker
tokens are empty for the successful generated profiles, and no model request is
made. After the passing command and its awaited cleanup, an independent readback
found **zero** processes using the generated launcher checkout prefix and
**zero** remaining owned launcher temporary directories. No user profile,
unrelated listener, dependency directory or private archive was cleaned up.
`git diff --check` also exited 0. Complete joint-candidate and GitHub/release
validation remain separate requirements.
