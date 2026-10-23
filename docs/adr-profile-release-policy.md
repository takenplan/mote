# ADR: Profile credential storage and immutable releases

Accepted by the owner, restored for the single-owner MVP on 2026-10-23.

Profiles select runtime defaults and Mote-owned credential storage. A Dev build or the exact Desktop runtime profile `dev` uses private local files, without constructing or querying the OS credential adapter. Other profiles use production protection; Android's existing `default` build label means Prod. An arbitrary `dev-*` name does not select Dev semantics.

Desktop stores its Dev token in atomic 0600 JSON within a 0700 profile directory. Prod retains Electron safeStorage and rejects unavailable protection without plaintext fallback. Session-only and signed-out tokens are never persisted. Logout preserves the pending source/queue binding, clears local authorization first, and attempts remote revocation with the captured prior credential even if Central is offline.

Android Dev stores its token as a private JSON preference value and an AES key in an app-private JSON file. Existing drafts, grants and action ledgers remain authenticated and encrypted. Prod keeps Keystore. Android's existing process-bound session and signed-out authorization gates, including token-retention behavior, remain unchanged. Missing/corrupt keys and incompatible Dev formats fail without replacement, conversion or OS fallback. Fresh MVP profiles need no migration.

Central retains its canonical private YAML, database and files. Third-party CLIs keep their credential management. Secrets stay out of source control and support exports.

One main branch and independent component versions remain. Release tags identify immutable snapshots; prerelease maturity does not itself select Dev storage. The historical #164 release packaging/artifact policy is being restored as a separate batch; this credential change does not claim that those packaging changes are complete or that any release has been published.

R2 received independent **APPROVE** against restored source `52110244`, with an explicit Desktop logout amendment and preservation of the pre-logout source binding. Focused generated tests cover backend selection, persistence, logout/reload/reauthorization, pending source identity, private-key reuse and invalid-state rejection. Desktop builds and both Android Kotlin variants compiled. Physical devices, system permission prompts and live models were not exercised.

This replaces universal OS storage for Dev and account-scoped client assumptions. See [single-owner MVP](adr-single-owner-mvp.md), [testing](testing.md) and [releasing](releasing.md).
