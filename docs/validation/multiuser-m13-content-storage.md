# Original scoped storage acceptance

This is a finite M13 increment, not final Web or joint acceptance. The original
two endpoints each returned503 in the real scoped host; durable RED0a17fa98
(`/tmp/m13-content-storage-valid-red2.log/.exit`,2fail0skip) preserves that gap.
All bytes, users, configuration and backup directories here are generated.
No real personal data, key, permission or model is used.

## Implemented behavior and boundary

See [the contract](../design/multiuser-content-storage.md). Existing ContentStorage
and StorageStatistics components retain their original controls. A personal M04
policy drives the original AES256GCM/current-format implementation, with existing
M03 workers and checksummed objects/parts. Conversion uses existing deterministic
M05 work, durable same-operation admission, exact cancellation, real counters and
current authority. Keys remain private managed files; portable export contains
original plaintext only. Stopped backup verifies encrypted parts and rejects a
missing key before creating the restore target. No legacy Store, new table,
private scheduler, online restore or per-user shared-index estimate is added.

## Actual verification

- Current real-host source5/5, no skip/cancel/failure,11.052s, EXIT0:
  `/tmp/m13-storage-current-source.log/.exit`. Plain and encrypted uploads, PNG
  intake, generic upload parts, whole M04 CAS, same-operation retry, mixed reads
  after restart, current policy, actual progress, exact cancellation, physically
  held M03 work plus withdrawal, damaged AES retention/key preservation, explicit
  new retry, device403, B task404, portable bytes without key, physical totals/B
  independence, and stopped restore/key corruption rejection all run.
- Original renderer and legacy configuration neighbors12/12, no skips,5.993s,
  EXIT0: `/tmp/m13-storage-current-ui.log/.exit`. Uses real createApi, Web login,
  scoped HTTP, M03/M04/M05 and original components under StrictMode. Exercises
  actual encryption, committed ACK loss, React remount, exact cancel, new command,
  held A response/detached controls under B, B positive, and malformed successful
  physical statistics followed by a real successful refresh.
- Earlier direct compatibility set45/45, no skips,96.480s, EXIT0:
  `/tmp/m13-storage-neighbors1.log/.exit` (new source, original cipher/storage,
  real ingress and configuration). The final owner-SQL/factory-publication fence
  is followed by the current source5/UI12 repeat above; no old result is presented
  as a new full gate.
- Current Server/Web noEmit EXIT0:
  `/tmp/m13-storage-current-types.log/.exit`. Scope inventory and production
  boundary EXIT0: `/tmp/m13-storage-scope2.log/.exit`.

The initial test helper used the wrong issued-client identity property; that
setup error was corrected before the two actual503 REDs. One cancellation
fixture initially raced a completed tiny task; the final case holds a genuine
M03 workspace before the exact cancel. Two renderer attempts observed statistics
before its real load; only fixture observation was fixed, with product assertions
retained. These are not relabeled product failures.

## Remaining evidence

Fresh Server/Web build EXIT0 (`/tmp/m13-storage-final-build.log/.exit`),
i18n8487 and final scope EXIT0 are complete. New source/renderer test files also
pass strict standalone noEmit with a minimal external JSDOM DOM declaration; the
first run exposed inherited Fastify payload and local fixture Response/connection
DOM typings, corrected without changing runtime assertions.

Actual allowed IAB original login → storage → enable encrypted writes → real
M03 generated upload → disable future writes → explicit decrypt completed2/2,
converted1/skipped1/failed0. Filesystem bytes independently prove AES removal
and exact31-byte original plaintext. The original space link displays A5 files,
1902 bytes. Real switch-account → B original storage is idle/plain by default,
without A receipt; B space displays2 files,1741 bytes. Proof:
`/tmp/m13-storage-iab-proof.json`; generated screenshots were captured in the
IAB tool result. The temporary tab was closed. Initial sandbox listen EPERM was
resolved by standard approval of the same generated loopback Node fixture; no
hidden Web Electron or alternative browser path was invoked.

Bounded independent review and final same-candidate affected gates remain
separate, pending steps.
Shared SQLite/index/capacity, model/external-volume space, legacy separate export
modes and runtime instance editing are not provided by this finite contract.
