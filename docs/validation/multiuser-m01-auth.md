# M01 account authentication validation

Date: 2026-10-15. Implementation: `f67b117fe02dda4211363a772286907a9167b06e`.
Predecessor: M00 `5031b754915d3fbba0dbe0c050b6d103a02966ef` (#126).
Target: `codex/mote-multiuser-integration` only. This record validates M01;
complete multi-user archive/client operation requires the remaining modules.

## Delivered production entry points

The real `src/index.ts` → `scope/app.ts` composition now installs the persisted
account verifier and account/session/credential routes. It restores username and
password login, current account discovery, Web Cookie sessions, logout, password
change, administrator account creation/list/disable/reset, personal device/client
and MCP credential issuance/inventory/revocation, and ticket/PKCE handoffs.
The local stdin administrator initializer is a built production entry, with no
HTTP bootstrap, default owner, old token fallback or automatically assigned user.
The [M01 contract](../design/multiuser-auth.md) documents the exact endpoints,
password-attempt policy, operator trust boundary and downstream interfaces.

Unfinished archive domains, ingress, MCP tools, model workers and client account
UI remain closed. Account administration and authenticated identity are working
production capabilities, not a foundation-only deny shell. M02 supplies its own
production `registerPrivateData(runtime, storage.db)` registration; integration
must retain that call and its error/lifecycle adapters alongside M01 authentication.

## Journey and security acceptance

On the final implementation, after rebuilding server output:

```sh
MOTE_AUTH_PROCESS_ENTRY="$PWD/apps/server/dist/index.js" node --import tsx --test \
  apps/server/test/multiuser-auth-process.test.ts \
  apps/server/test/multiuser-auth.test.ts \
  apps/server/test/login-handoffs.test.ts \
  apps/server/test/scope-foundation.test.ts \
  apps/server/test/scope-architecture.test.ts
```

**29 passed; zero failed, skipped or cancelled.** All accounts/passwords, source
IDs, device IDs, vaults and HTTP listeners were synthetic and isolated. The default
sandbox's loopback `EPERM` was resolved by the supported test permission; no test
was skipped, and no real deployment, data, identity or external model was used.

- Administrator creation, duplicate username/second initialization refusal,
  case normalization and stable UUIDs through password changes/rotation/restart.
  Persisted rows contain salted password hashes and token/CSRF hashes, not the
  generated passwords or bearer credentials.
- Normal accounts cannot administer the instance. Administrator credentials cannot
  select another user's private context or access/revoke their personal credentials.
  Missing, old, forged, copied, foreign and revoked identities are rejected.
- Web responses omit bearer secrets and set `__Host-` Secure/HttpOnly/Strict
  cookies. Reload discovers CSRF; missing/bad CSRF, cross-site Origin/fetch-site,
  Cookie+Bearer ambiguity, Web-token-as-Bearer and old-A-tab/new-B-cookie requests
  are refused. Public authentication rejects non-JSON requests.
- Logout, expiry, individual revocation, password change, administrator reset and
  disable/re-enable enforce current state; old credentials never revive. Another
  account remains unaffected. A second SQLite connection revokes already issued
  host contexts. The last administrator cannot be disabled.
- A/B use the same device and source IDs without exchanging identity. Restricted
  MCP credentials cannot enter normal user/admin routes or issue client sessions;
  their current-state fence rejects use after revocation. Actual MCP tools await M11.
- Reversed approvals, another account's approval attempt, wrong verifier, one-use
  exchange, acknowledgement and revoked parent tickets retain the initiating
  account. Browser sessions derived from native tickets inherit parent revocation.
- Delayed account-bound requests cannot publish or commit after disable. Disabling
  while password hashing runs prevents credential issuance and late password
  changes. Web logout preserves durable account-level authorization; M05 owns
  durable task admission/publication.
- Persisted password-attempt limits survive a new verifier instance and expire at
  the declared window. Repeated authenticated business reads remain available.
- A binary private route works with client credentials and still enforces Web
  Cookie/CSRF. This guards the M03 content-type seam against the review regression.
- A fresh compiled `dist/index.js` process initializes only generated storage,
  logs in, creates a user, rejects non-admin management, stops/restarts, restores
  stable sessions, disables the user, logs out, and rejects the revoked token.
- M00 write admission still rejects unsupported/old vaults without changing their
  files, permissions or directory bytes. Scope inventory/import checks still pass.

## Independent review

The independent reviewer identified one P2: a global JSON gate would have rejected
future binary private uploads. It was narrowed to public authentication routes,
with binary-client and Cookie/CSRF regressions. Self-revocation response exceptions
were also narrowed to the actual current credential/account; revoking another
credential still checks the caller before response publication, with a disable
race regression. The reviewer retested the corrected
implementation and reviewed exact final implementation
`f67b117fe02dda4211363a772286907a9167b06e`, reporting **no unresolved P0/P1/P2**.
Independent runs: authentication/handoffs/architecture 18/18, then final incremental
authentication 12/12, all without skips. The reviewer did not repeat the loopback
smoke; the main execution ran the compiled process check above.

## M02 integration notes

The two module branches intentionally share only the following composition seams;
this module does not merge M02 or move the integration branch:

- Preserve `storage.db`, M01 `Accounts` construction and `registerAuthentication`,
  and M02's single `registerPrivateData(runtime, storage.db)` call before readiness.
  Pass the full runtime, including `accounts`, so Cookie/CSRF checks remain active.
- Preserve M01 Cookie/session/CSRF resolver and authenticated response fence;
  M02 continues to use unchanged `registerUserRoute` and host `UserContext`.
- Preserve optional `lifecycleAuthority`, M02 `services.assertSubject` checks and
  the `PrivateDataError` mapping alongside AuthError/ConnectionError/ZodError.
- Merge both scope inventory entries and both sets of expected schema tables;
  rerun the inventory rather than dropping either module's declarations.
- Update health/connection capability metadata to reflect M02's restored private
  data domain. M01 alone correctly reports archive/ingress/MCP tools unavailable.
- Client/device credentials have the user's normal private capabilities under the
  adopted unified-client contract. MCP credentials cannot authenticate those
  routes; M11 must explicitly mount its restricted adapter before tools can run.

## Affected checks and delivery

The required command passed on the frozen final implementation (exit 0):

```sh
JAVA_HOME=/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home \
ANDROID_HOME=<redacted-personal-path> \
npm run check:affected -- --base origin/codex/mote-multiuser-integration
```

The first invocation passed TypeScript/components/root checks but could not find
Java at the Android step. The full command was rerun after the final code changes
with the installed JDK/SDK selected for that process only. No test was removed,
relaxed or broadly skipped, and no user environment or Actions setting changed.

| Check | Final result |
| --- | --- |
| Translation, library builds, all workspace and script TypeScript checks | Passed |
| Desktop | 456 passed |
| Server | 1950 passed, 1 existing conditional skip |
| Web | 469 passed |
| Agent | 316 passed, 1 existing conditional skip |
| Diagnostics / shared | 5 / 190 passed |
| Root release/media/security/profile/proxy regressions / client | 81 / 4 passed |
| Central runner fixture | Passed |
| Android JVM | 329 passed in 70 suites, zero skips |
| `npm run build:central` | Passed; existing Web chunk-size warning |
| Final compiled-process/authentication/scope acceptance | 29 passed, zero skips |

The two existing skips are the explicit macOS sandbox opt-in and installed-Codex
fixture opt-in. Old single-owner tests remain regression evidence, not proof of
new domain isolation. The M01 production acceptance is the explicit 29-case run.

Repository readback reports `Checks` and `Component checks` as
`disabled_manually`; neither was enabled. No CI pass is claimed. The Draft PR,
final remote delivery commit and exact-head CI readback are reported together in
the execution handoff. The final evidence commit contains documentation only;
the tested/reviewed implementation remains the exact SHA recorded above.

Not run: real model/provider calls, real external writes, real deployment or
migration, Web renderer account UI, native application UI/emulator/physical-device
account journeys, complete M01+M02 joint acceptance or M16 backup/restore. No true
user password was set, no real credential permission was expanded, no PR was
merged, and neither `main` nor the integration branch was modified here.
