# Desktop v2 device invitation consumption

This increment composes delivered M14 `cd46f25a` with only the native purpose
contract from `9ef22bb6` and QR producer freeze `6a84ec6a`. It does not compose
the independent theme PR or later Joint processing/Files work. The source main
and integration baseline is `6272a9b5`; all work stays on a separate feature.

The [producer contract](multiuser-qr-pairing.md) fixes account, deployment,
origin, device purpose, expiry and optional original device at generation. The
existing Desktop connection page keeps native paste/JSON/QR import and origin
confirmation. Generation is the original approval; scanning opens no additional
browser approval. The local v2 parser deliberately does not alter the shared v1
parser still imported by retired server algorithm fixtures and older consumers.
Desktop has no v1 fallback.

`DesktopPairing` uses the existing `SecretStorage` and atomic file/fsync pattern.
It retains a single encrypted M01 recovery checkpoint in the profile root:
invitation, fixed device metadata, verifier, starting connection fingerprint,
request ID/deadline and grant when received. The fingerprint binds the original
credential/account/device, and is never an account authority. No queue or second
credential inventory is created. Checkpoints stay outside support exports.

The order is persist PKCE → redeem → persist ID → poll → persist grant → fresh
self → ACK → fresh self → existing `commitConnection`. Grant identity/purpose
must match the invitation; fresh self matches `account.credentialId`, stable
account/deployment/origin, device and expiry, with required protocol/capabilities.
Self does not expose a purpose field. Current main settings, document/account
generation and login generation are checked after network and before publication.
Changing account retires old documents before private stores change, preserving
M14's original queue, draft, source and calendar algorithms.

Recovery is explicit. It uses the original claim after a lost response and the
saved grant after a lost ACK. ACK `410 login_expired` can represent a lost
restart-local receipt; it is accepted for recovery only when fresh self still
confirms the exact independent credential. Other 400/410 errors and revocation
cannot publish. No successful ACK is claimed for that 410. A failed final local
publication retains recovery; after an installed grant, cleanup can retry without
adopting another account. Expired/malformed prior checkpoints cannot prevent a
new explicitly confirmed invitation from replacing them.

| Disposition | Decision |
| --- | --- |
| KEEP | Central invitation-generation consent, native connection navigation, origin confirmation, local QR, explicit original-device reauthorization, M01 PKCE/poll/self/ACK, OS encrypted storage and M14 account-owned queues. |
| CHANGE | v2 subject-aware parsing and durable pre-POST PKCE replace one-shot redemption; exact fresh self precedes local account publication. Same URL does not establish same account or instance. |
| REMOVE | Desktop v1/owner invitation consumption and confirmation that first signs out then opens a second browser approval. No device grant is promoted to private Central authority. |
| EXCEPTION | Generated external-I/O substitutes prove product ordering without personal capture, calendars, credentials or live model calls. Trusted operators retain server plaintext access under the multi-user ADR. |
| UNKNOWN | Real Keychain, physical QR/Swift Vision, system permissions, public HTTPS, deployed lifecycle and live models require separate evidence. Full affected and native build are distinct from bounded fixture results. |

The [validation record](../validation/multiuser-desktop-pairing.md) distinguishes
actual failures, performed checks, remaining limits and final delivered SHA.
