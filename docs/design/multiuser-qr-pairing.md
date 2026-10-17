# Account-bound QR device invitations

This freezes the production producer for the original Central-generated device
invitation journey. It extends M01 `LoginHandoffs` and `Accounts`, using the same
SQLite credentials, host authority, PKCE, approval, polling and ACK. It does not
mount the retired owner `Connections` service or add an authentication executor.
The source base is Joint `f6ac6cd1` (stable `c45fdb4a`), plus the M15
`edfba1fcfb18d2b9b69967fe1eaab57d4b319a34` and
`a648da5a5b38e202a6b1628af4a3614d8797c92a` deltas. Their explicit `central`
login purpose remains separate from this fixed `device` invitation.

## Journey and ownership

Keep Central's existing Devices entry, explicit Generate invitation, locally
rendered QR, copy/paste/JSON, origin confirmation, cancel, individual credential
revocation and explicit original-device selection for reauthorization. Generation
is the existing user's explicit consent to a new device. Scanning does not add a
second trip to a browser approval page. The server captures the current host
account, deployment, origin, invitation label and optional original device ID at
creation. The scanner cannot replace those values. Claiming fixes one device,
platform, name and PKCE challenge, then invokes the same M01 approval implementation
with that original consent. No bearer credential exists merely from generation.

M13 owns Web rendering and retirement of stale page operations. M15 owns Android
scan/paste/JSON, pending PKCE storage, identity verification and account-generation
fences. This producer does not change their consumers. The separate Desktop v2 consumer restores native JSON/URI/QR import, durable
PKCE recovery and exact fresh-self publication; see its
[design and supersession](multiuser-desktop-pairing.md) and
[executed acceptance](../validation/multiuser-desktop-pairing.md). This producer's
evidence alone does not establish consumer acceptance.

## Frozen HTTP contract

Every call sends `X-Mote-Protocol-Version: 2`. Public mutations require JSON and
reject cross-site origins, just like M01 login. Authenticated Web mutations use the
existing Cookie/session-ID/CSRF protections. No owner aliases or v1 downgrade are
supported.

1. `POST /api/connections/invitations`, authenticated full account session:
   `{serverUrl,label,deviceId?,durationMs?}`. Origin validation is the existing
   `connectionServerUrl` HTTPS/loopback rule. Duration uses M01's 0/1/7/30-day
   choices and defaults to 30 days; 0 has M01's one-day server maximum. `purpose`
   is not accepted as input. Response is `{invitation,uri}`:

   ```json
   {"format":"mote.connection","version":2,"deploymentId":"<host ID>","userId":"<account ID>","serverUrl":"https://mote.example.com","purpose":"device","code":"<43 base64url characters>","expiresAt":"<UTC ISO time>","deviceId":"<optional explicitly selected device>"}
   ```

   URI is `mote://connect?data=<base64url UTF-8 JSON of invitation>`. Invitation
   fields are exact, `deviceId` is omitted for a new device. Expiry is ten minutes
   from creation; redemption never extends it. Render QR locally. The code is a
   short-lived capability: do not log or send it to a third-party QR service.

2. After parsing v2 and explicitly confirming its origin, the scanner creates a
   32-byte random base64url verifier (43 characters), retains it with the immutable
   invitation and device metadata, and sends public
   `POST /api/connections/redeem`:

   ```json
   {"code":"<invitation code>","expected":{"deploymentId":"<invitation ID>","userId":"<invitation account>","serverUrl":"https://mote.example.com","purpose":"device"},"deviceId":"<local device ID>","deviceName":"<local name>","platform":"android","challenge":"<SHA-256 lowercase hex of verifier>"}
   ```

   Platforms are M01's android/macos/windows/linux/other. `expected` is a comparison
   to the host-captured subject, never an identity selector. Response is
   `{id,expiresAt}`: a normal M01 request ID and numeric millisecond deadline.
   There is no bearer token in this response. Same claim retries, including
   concurrent requests, return the same ID and mint one credential. Changed
   device/name/platform/challenge returns 409; subject or bound-device mismatch
   returns 403. Invalid/expired/cancelled/ACKed code returns 410.

3. `POST /api/login/poll` with `{id,verifier}` returns M01's
   `{ready:true,token,credentialId,scope:"client",deploymentId,userId,serverUrl,expiresAt,purpose:"device",deviceId}`.
   Only the matching verifier can poll or ACK. A repeated poll before ACK returns
   the same grant. A QR claim is already approved by the creation consent; its
   owner is fixed before any ordinary `/approve` call. Another account cannot
   inspect or reapprove its request. The optional bound original device must
   match the scanner's local device ID before any credential is issued.

4. Verify `GET /api/connections/self` using that token and protocol 2, without
   following redirects or sending the token to a different origin. Compare
   `self.account.{deploymentId,userId,credentialId}` to the invitation and grant,
   `self.credential.deviceId` to the local device, and protocol/capabilities to
   the actual native requirements. `self.credential.id` does not exist. Save only
   under the verified stable account/deployment and current client generation.
   This credential supports device ingress/actions/self/logout; private archive,
   administration, ticket, other credentials and login approval remain denied.

5. After safely preserving the verified connection/pending recovery state,
   `POST /api/login/ack` uses `{id,verifier}` and returns `{acknowledged:true}`.
   Duplicate ACK succeeds until the original pairing deadline, without returning
   or retaining its token. Poll and redeem after ACK return 410. A late old ACK
   cannot consume a new request; wrong verifier, cancellation, expiry and
   revocation before the first ACK cannot create a successful receipt.

6. `POST /api/connections/invitations/revoke`, authenticated original account,
   `{code}` returns `{revoked:true}` idempotently during the live invitation.
   Unknown and another account's codes return the same 404. Cancellation wins
   before ACK: pending/in-flight publication is fenced and a created unACKed
   credential is revoked. ACK wins first: cancellation leaves the established
   credential intact; use `DELETE /api/connections/:credentialId` to revoke it.

Creation-session revocation before first publication rejects the claim. Once the
grant commits it is independent of browser logout, as with existing M01 native
approval; account disable/reset and explicit credential revocation still apply.
Same-claim retry after that logout can recover its existing request. Pairing
expiry/restart discards transient recovery state, not an already issued independent
credential. Restart-local invitations/requests use M01's bounded 512-entry maps;
no tokens or invitations are persisted in a second credential store.

A new-device invitation rejects device IDs known in this account's credentials,
Ingress devices or sources (`409 device_already_registered`). Select the original
device explicitly to reauthorize it. At final live publication, replacement
revokes this account's previous device credentials transactionally; failure
preserves them. The same ID in B is unrelated. Cancel after successful replacement
does not revive old credentials. Queue ownership and collection permissions remain
native-client responsibilities; pairing never enables collection by itself.

## Supersession and limits

- KEEP: original invitation UI journey, local QR, origin confirmation, ten-minute
  transient invitation, explicit original-device choice, label and revoke behavior.
- CHANGE: wire invitation v1 becomes v2 with fixed host account/deployment/device
  purpose. Claim uses PKCE and M01 poll/ACK recovery. Credentials have the M01
  finite lifetime and device capability boundary, rather than old owner access.
- REMOVE: root/owner token fallback, v1 compatibility, unrestricted owner grant,
  one-shot redemption losing its only token response, and unauthenticated old
  redemption payloads. No `/invitations/redeem` alternate route is introduced.
- EXCEPTION: trusted operators can see server plaintext, as in the multi-user ADR.
- UNKNOWN: Web/Android consumer acceptance, Desktop v2 import, physical camera,
  public HTTPS and real deployment behavior need their owners' separate evidence.

See [producer validation](../validation/multiuser-qr-pairing.md) for executed tests.
