# Android native central UI

Android central content uses Kotlin and Android Views. The retired WebView wrapper and its session/draft protocol are not the current entry point. `CentralContent` is shared by central deep links and MainActivity's Ask tab. Ask stays inside the existing window and primary navigation; switching tabs retains the conversation and draft, pauses hidden polling and resumes on return. After central detail history is exhausted, Back returns to Library / 内容. Rotation restores the selected tab and persisted draft. The default navigation is [Library, Ask, Sources and Activity](client-navigation.md).

## Current account and device boundaries

`CentralAccess` and `CentralSession` serve native private pages, backup export, foreground calendar actions and remote record browsing. Access is bound to the verified origin, deployment and account, with a session generation that rejects stale responses and picker results. Private pages use a full account login. Background capture and synchronization use the configured credential with ingress authority. A restricted device credential cannot be promoted into private archive or management access. Pairing and fresh-self checks follow [the connection contract](connections.md).

Login offers application lifetime or 1/7/30 days. Application-lifetime credentials remain process-bound. Prod / Test durable credentials use Keystore SecretBox; Dev tokens use private JSON and its SecretBox uses a private JSON AES key. Private drafts and ledgers remain authenticated and encrypted. Logout prevents automatic reuse of configured credentials; expiry, logout and account changes invalidate old clients without allowing a late response to sign out a newer session. Requests do not redirect credentials to another origin. Connector-specific errors do not sign out the account session.

Ask drafts, run admissions, notes/outbox, import staging and ambiguous insight admissions use verified account storage, not an origin-only owner bucket. Stable request IDs and receipts survive ambiguous responses so retries reuse the original operation. Query runs remain on Central when the Activity closes and can be revisited from history. Switching accounts preserves each account's private state and cannot publish a result into another account.

## Native surfaces

Native pages cover everyday reading and Ask, evidence and file views, sources and connections, processing and model settings, usage, archive operations, preferences and help. Management controls remain subject to the server's actual administrator capability; a native screen does not grant permission. Views render selectable literal evidence and model text, never HTML, scripts or content-driven actions. Forms use native controls and explicit JSON editors for structured policy fields. External OAuth and GitHub feedback use the system browser; Android document pickers handle uploads/exports and MediaPlayer handles audio.

Current account-isolation and lifecycle evidence is recorded in [Android parity validation](validation/parity-android-20261018.md) and the [multiuser matrix](validation/multiuser-parity-restoration-matrix.md). These receipts do not establish physical-device capture, external-account OAuth or live-model validation.

## Historical native conversion fixture

The original native-conversion fixture described 26 central pages and used `scripts/android-central-fixture.ts` with `NativeCentralInstrumentedTest` on a dedicated emulator. It checked the then-current owner identity, native settings, invitation contracts, literal evidence, drafts and activity statistics with generated evidence and a deterministic query agent. The owner-session assertions and loopback owner fixture are historical; they do not validate the current account/device boundary or provide a production bootstrap recipe. Current source and multiuser receipts above determine the accepted path. No fixture, emulator, device or model check was rerun for this documentation cleanup.
