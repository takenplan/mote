# ADR: Android capture preferences belong to the signed-in account

Status: adopted by the owner, 2026-10-18.

## Decision

Capture scope, application and UI-page rules, exclusions, masks, upload review,
sampling, image quality, OCR, image deduplication, capture switches, synchronization
preferences and uploaded-copy retention are personal device-side preferences.
The capture preview acknowledgement belongs to the same account. Switching A → B
→ A restores each account's values, while running collection remains stopped until
the existing explicit start path authorizes it.

The preference namespace uses the verified deployment ID and account ID. A
credential rotation or verified URL change does not create another preference
owner. The connection still binds and verifies its origin; this decision does not
change queue, source, draft, receipt or external-calendar ownership contracts.

| Personal preference group | Fields |
| --- | --- |
| Scope and privacy | UI-page mode/rules, per-application rules, exclusions, masks, upload-review enabled/text/failure action, metadata and screen/media/notification/device-event switches |
| Capture processing | Interval, image quality/size, capture charging/battery conditions, OCR mode/application overrides, image deduplication mode |
| Sending and local retention | Pause, Wi-Fi, manual/automatic mode, interval, batch size, packed transport, JSONL window, sending charging/battery conditions, uploaded-copy retention days |
| Preview | Whether this account accepted the existing capture preview |

OS and SAF permissions, hardware, device ID/name, queue location and capacity,
debug HTTP, diagnostics, update settings and appearance remain device-level.
An OS permission does not create a source in another account or authorize its
processing. Existing source selection and calendar connection are still separate
explicit account actions.

Settings keeps the selected account identity, device metadata and its updated
personal preference snapshot in one atomic SharedPreferences commit. This retains
the existing compare-and-save and rollback boundary. A late A settings or preview
callback cannot write B's snapshot. The media consumer observes changes to the
personal snapshot as configuration changes.

## First snapshot and historical values

When no snapshot exists for the verified deployment/account, use the established
`CollectorConfig` defaults, stop running collection, and leave that account's
preview unconfirmed. The original start/preview flow applies. Historical global
privacy values and the global preview flag remain on disk but are neither read as
personal policy, assigned to an inferred writer, copied to a new account, nor
deleted. There is no migration, compatibility reader, historical replay or storage
version change.

## Supersession

- KEEP: existing privacy algorithms, defaults, UI controls, explicit start, OS
  permissions, settings CAS/rollback, stable verified identity and current storage.
- CHANGE: the privacy/capture domain remains on-device but its saved values and
  preview acknowledgement belong to an account.
- REMOVE: cross-account inheritance from the last global settings writer and
  acceptance of a stale preview callback.
- EXCEPTION: non-private installation resources, diagnostics, appearance and OS
  permission state remain shared on the device.
- UNKNOWN: physical-device/OEM lifecycle and permission behavior require separate
  validation; generated emulator checks do not establish those outcomes.

This narrows the device-local privacy/capture exception in
[unified configuration](adr-unified-configuration.md#decision-and-user-journey) and supersedes the
unqualified shared-settings interpretation in the historical
[Android implementation ledger](validation/multiuser-android.md). That ledger
retains its original validation history. Current regression evidence belongs to
[the parity validation record](validation/parity-android-20261018.md).
