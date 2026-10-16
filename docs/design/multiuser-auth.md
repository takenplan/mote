# M01 account authentication contract

M01 restores account administration, password login, authenticated identity,
server-side Web sessions, client credentials, credential inventory/revocation,
and the existing ticket/PKCE handoffs through the production scoped builder.
It depends on M00 `5031b754915d3fbba0dbe0c050b6d103a02966ef`. Private archive
operations remain closed until their owning module registers its scoped domain.
This is a backend contract; M13–M15 implement the account UI and native clients.

## Identity and storage

`scope/accounts.ts` owns `auth_accounts`, `auth_credentials`, and `auth_attempts`
in the admitted epoch-5 `mote.sqlite`. No old token/configuration/connection file
is imported, no default owner is created, and no existing vault is migrated.
Account UUIDs survive password changes, resets, disable/re-enable, credential
rotation and process restart. Usernames are case-insensitive normalized ASCII
identifiers of 3–64 characters. Passwords are 12–1024 characters, at most 1024
UTF-8 bytes, salted independently and hashed using scrypt (N=32768, r=8, p=1,
64-byte result). Credentials and CSRF secrets are represented by SHA-256 hashes.
They are never returned in account/connection inventories.

`UserContextAuthority` remains the host authority. `Accounts.verify/isCurrent`
consult persisted credential and account state on admission and again at response
publication. Administrative status is verified from the current account, not
accepted from request data. Account creation is the only HTTP operation that
chooses another account's username/initial role; it does not issue that account's
login credential. Account management returns metadata only. Administrators cannot
list, revoke or obtain another user's client/MCP credentials through private
connection APIs, nor select another user's archive through a data API.

Disable/re-enable, password change and administrator reset advance the account's
`authorization_epoch` and revoke all its credentials in one immediate SQLite
transaction. Re-enabling never revives old credentials. The last enabled
administrator cannot be disabled. A reset intentionally lets a trusted
administrator set a replacement password; it is not a promise of protection from
the deployment operator. The operator and trusted installed code can access
server plaintext; no end-to-end encryption or malicious-operator protection is
claimed.

## Initial administrator

A local operator initializes an empty admitted vault using the built CLI:

```sh
npm run build:central
npm run auth:initialize-admin
```

Set `MOTE_CONFIG_FILE` to the intended new, isolated instance configuration. Supply
one JSON object on standard input with `username` and `password`, using a secret
manager or another protected input mechanism. Do not put a password in arguments,
URLs, shell history, committed files or logs. The CLI prints only the new stable
deployment/user IDs, issues no credential and refuses a second initialization.
There is no unauthenticated HTTP bootstrap or open registration endpoint. The
normal server starts without creating an administrator or reusable owner token.
This implementation's tests use generated temporary configurations and passwords;
no real deployment account was initialized.

## HTTP and Web sessions

Every authenticated call and public authentication/handoff request requires
`X-Mote-Protocol-Version: 2`. `POST /api/auth/login` takes username, password,
`mode` (`web` by default, or `client`) and `durationMs` (0, 1, 7 or 30 days).
A Web login returns identity, credential ID, expiry and CSRF secret. It sets the
`__Host-mote-session` cookie with `Secure; HttpOnly; SameSite=Strict; Path=/`,
without Domain. The bearer token is not returned to Web JavaScript. Mode `client`
returns a user-bound bearer token for native clients. Web use requires HTTPS
(with browser-specific localhost development exceptions); loopback process/API
checks are reported separately from browser validation.

Duration 0 sets a one-day server expiry in both modes and a session cookie only
in Web mode. Other durations set an explicit server expiry and Web cookie
Max-Age. These are finite server sessions; M14/M15 still need to implement the
additional native process-lifetime restriction. Logout revokes that credential,
not other independent logins or already authorized Central background tasks.

`GET /api/auth/self` discovers the current stable identity/session and Web CSRF
secret after a page reload. `GET /api/connections/self` also permits session
discovery. All other Cookie-authenticated requests require
`X-Mote-Session-Id` to match the current credential. Mutations also require
`X-Mote-CSRF`. An old tab retaining A's binding cannot act using B's replacement
cookie. Cookie and Authorization supplied together are refused; Web credentials
are not accepted as ordinary bearer credentials. `Origin` and browser fetch-site
checks apply to API mutations. Public login/exchange/poll endpoints require JSON
to prevent login-CSRF; private domain routes define their own content types.

| Endpoint | Authority and effect |
| --- | --- |
| `POST /api/auth/login` | Password; Web cookie or personal client credential. |
| `GET /api/auth/self` | Current account/session metadata only. |
| `POST /api/auth/logout` | Revoke current credential; expire cookie. |
| `POST /api/auth/password` | Current password plus new password; revoke every account credential. |
| `GET/POST /api/admin/accounts` | Administrator; list account metadata/create invited account. |
| `PATCH /api/admin/accounts/:id` | Administrator; `{disabled}`; epoch/revocation transaction. |
| `POST /api/admin/accounts/:id/password` | Administrator; replacement password and account-wide revocation. |
| `GET /api/connections`, `DELETE /api/connections/:id` | Own credentials only; unknown and another user's IDs return the same 404. |
| `GET /api/connections/self` | Current identity, protocol and honest delivered capability flags. |
| `POST /api/login/session` | Own device-bound client credential; device ID is metadata, never account authority. |
| `POST /api/connections/mcp` | Own read or source-limited write credential; no client/admin authority. |

The original `LoginHandoffs` implementation supplies 60-second single-use tickets,
10-minute PKCE requests, verifier-only polling/acknowledgement and revocation
checks. The production adapter captures the authenticated account, with no mutable
current-user global. The first approver binds a request to that account, including
concurrent approvals; another account cannot replace it. Ticket exchange issues
an HttpOnly Web session capped by, and linked to, its parent credential's expiry
and revocation. A completed native approval produces an independent personal
credential; a subsequent browser logout does not log out that native client.
Both ticket/request maps are restart-local and each is capped at 512 entries.
The old connection fixture continues to use the same handoff class with its
legacy adapter, outside production.

### Explicit native central browser login

The original native Central login and its browser approval promise access to all
Central features. A collector's device-bound credential deliberately cannot open
those private pages. `POST /api/login/requests` therefore accepts optional
`purpose: "device" | "central"`, defaulting to `device`. This preserves existing
device pairing and the exact-device ingress/actions restriction; the private
HTTP resolver and device credential minting restrictions do not change.

An explicitly requested `central` login uses the existing personal client grant,
with no device-bound credential metadata, exactly as native username/password
client login. The immutable request detail includes `purpose: "central"` before
approval. Browser consent displays full Central access only for that purpose;
default device requests identify a collection-device connection. The approval
keeps its original Api and request ID, cannot reuse the previous request's device
description, and retires old buttons before replacement details resolve. Only a
current full account session can approve; a device credential cannot upgrade
itself. PKCE verifier, first-approver account binding, expiry, independent native
credential, one-use ACK, revocation and no owner-selector rules are unchanged.

This supersedes the assumption that every native browser handoff is a collector
device grant. KEEP the existing explicit full-client browser login intent and
consent, and KEEP device isolation. CHANGE only the purpose carried by the native
Central login and its grant publication. No new user step, default full access,
alternate provider, QR invitation or device-private API exemption is introduced.
The separate QR pairing contract is owned by the parent's forthcoming finite
common task; it is not awaiting a user decision here. Pairing and physical-device
acceptance remain open. Exact tests and native execution status live in
[the Android ledger](../validation/multiuser-android.md).

## Authentication protection

Password verification reserves attempts before asynchronous scrypt, preventing
parallel attempts from bypassing the count. Each normalized username permits five
attempts per 15-minute window; each remote address permits twenty. Account
login success clears that username's counter. Successful current-password
verification during password change does not clear it; address counts are not
cleared by either success. Attempt state is persisted and expired
windows are removed on the next attempt. Unknown accounts use the same expensive
hash operation and generic invalid-login result; disabled accounts do not reveal
their status at login. At most four concurrent password verifications run per
process; excess returns 429. These controls cover login and current-password
verification only. Private reads, uploads, model calls and general business APIs
have no new request or daily cost quota.

## Downstream seams

- `scope/storage.ts` returns the same `DatabaseSync` as `storage.db`. M02 owns its
  own private schema and registrar. Neither module replaces the shared executor.
- `requestContext(request, authority, accounts?)` is the exported HTTP resolver;
  `registerUserRoute(runtime, route)` preserves the M00 signature and supplies the
  original host-issued context. Identity selectors in headers/query/body fail.
- Each scoped repository checks `authority.assert(context)` before synchronous
  publication in its SQLite transaction. The route wrapper checks again before
  publishing a response. A delayed request never rereads a global browser user.
- M05 uses trusted `Accounts.assertAccountEnabled(userId, authorizationEpoch)`
  against its persisted host-owned grant; it must not persist a Web context or
  use Web logout as task cancellation. An epoch from a client is not a grant.
- M11 consumes `Accounts.mcpAuthorization(token)`: immutable user identity,
  write/source restriction and a current-state fence. MCP credentials cannot
  authenticate `UserContextAuthority` client routes. M11 must resolve source IDs
  through the account-scoped repository before making any actual data tool live.
  M01 issues credentials but does not restore MCP tool execution or ingress.
- `buildScopedApp` preserves optional `lifecycleAuthority` for the M00 lifecycle
  wrapper. M16 supplies actual durable lifecycle grants and orchestration.
  An injected trusted verifier is retained for M00/M02 host fixtures; it cannot be
  selected by production configuration and does not mount password/Cookie APIs.

Supersession: KEEP M00 provenance, per-domain registration, ticket/PKCE/revocation
and durable-work separation. CHANGE owner-wide credentials to stable personal
identity, finite server sessions, Cookie/CSRF and separate account control plane.
REMOVE old-token login, implicit/default-owner lookup and full-client MCP access.
EXCEPTION authentication-only attempt protection and trusted operator plaintext.
UNKNOWN browser/native UI, live models, real providers and deployment behavior
until their respective modules are implemented and verified.

## Central-generated device QR invitations

The old invitation journey now has a production account-bound producer. Its
[QR contract](multiuser-qr-pairing.md) freezes v2 invitations, creation consent,
fixed device purpose, original-account PKCE claim, M01 poll/ACK, cancellation and
same-device reauthorization. This supersedes the old owner invitation semantics
in `connections.md` and `web-login-and-pairing.md`; `purpose:central` remains the
separate native browser-login capability. Web and Android consumers retain their
own acceptance responsibility.
