# Profile first, immutable release tags second

Date: 2026-10-18. Status: accepted by the owner for implementation.

## Decision and responsibility

One main branch and independent Central / Desktop / Android versions remain.
Profiles select environment defaults and local credential storage. Git tags
identify immutable production release snapshots; GitHub prerelease status
expresses maturity and never enables debugging by itself.

Dev branch builds use an Actions artifact named by component and full commit
SHA, with `build-info.json`; they do not create tags or Releases. Beta tags use
`<component>-vX.Y.Z-beta.N`, stable tags use `<component>-vX.Y.Z`. Both build the
Prod installation identity and run required component checks before publishing
one installer/source archive. Published releases cannot be overwritten. Failed
drafts may be retried. Test remains an isolated fixture environment.

Dev enables structured debug diagnostics and client developer tools by default.
Explicit diagnostic choices, size rotation and support-package filtering remain.
Production multiuser instance logs never gain content traces: each person's
detailed Agent trace still requires that person's opt-in and authority.

Dev builds and the Desktop dev runtime Profile do not call Mote's OS credential
storage. Desktop uses private 0600 JSON configuration and pairing checkpoints;
Android uses app-private atomic JSON preference values for tokens and a private
JSON AES key for its existing authenticated content encryption.
Prod keeps Electron safeStorage / Android Keystore. Desktop session-only tokens
are not persisted and logout clears its durable token. Android retains its
existing process-bound session and signed-out authorization gates; this decision
does not change that platform's token-retention semantics. Files are
profile/account scoped, excluded from support exports and never bundled or
committed.

Central already owns secrets in private YAML, SQLite and files and gains no
second JSON configuration source. Lark CLI, DingTalk CLI and other third-party
components retain their own credential management. Build-time signing secrets
are separate from runtime user credentials and retain their existing identity.

There is no automatic encrypted-to-plain conversion or Keychain read for Dev.
Conflicting Desktop fields/checkpoints are rejected without modifying the old
files; preserve the old directory before creating a fresh Dev profile. In a Prod
Desktop build, keep the explicit name dev: move the retired dev directory out
of the way after backing it up, then initialize a new empty dev directory.
A custom dev-* name does not select Dev semantics. Android uses a
new Dev file-credential marker and rejects retired encrypted Dev state; preserve
the old installation/data before an explicit Dev-only storage reset. Current
Prod formats and application data are not migrated or reset by this decision.

## Supersession check

| Disposition | Responsibility and reviewed assumptions |
| --- | --- |
| KEEP | npm Monorepo, component versions/tags, Central server/web lockstep, Android signing identity and monotonic versionCode, profile/account isolation, permissions, data formats, manual installs, rotation, support redaction, model/tool authorization. |
| CHANGE | Tag builds now use Prod; suffix selects Beta/stable Release status. Dev artifacts use commit identity. Dev debug defaults and client file credentials replace universal system-encrypted credentials. Dev download links point to Actions. |
| REMOVE | All-tag DEV prereleases, forced DEV app identities for production tags, Dev Keychain/Keystore calls, treating every Profile as debug-off, Dev links that point at the Prod Release page. |
| EXCEPTION | Third-party CLI credential stores, Central canonical private files, explicit diagnostic opt-outs, personal trace opt-in, Test Keystore fixtures, CI signing keys and ad-hoc Mac distribution remain distinct. No signed online-update manifest or registry image is enabled. |
| UNKNOWN | GitHub runner execution and signing/notarization availability; branch access to the protected release Environment; real Prod Keychain prompts, physical devices, long-running usage and live-model behavior require separate evidence. |

Reviewed surfaces include release/version/package/publish tooling and fixtures,
all three release workflows, Desktop configuration/pairing/account lifecycle,
Android build variants/settings/private files/update entry, Central configuration
defaults/projections and scoped traces, local startup fixtures, translations,
development/deployment/update and client documentation. Read-only query tools,
prompts and captured-content interpretation do not change.

The repository's protected `release` Environment currently allows component
tags. A trusted development branch must be explicitly allowed before branch
Dev jobs that need its signing secrets can run. This PR does not change that
external access policy or publish/deploy any product.

Operational rules are in [releasing](releasing.md); durable regression journeys
are in [profile release validation](testing-profile-release.md). This supersedes
the all-DEV publication policy in the former release documentation and the
universal client system-credential-storage assumption, while retaining the
[unified configuration decision](adr-unified-configuration.md).
