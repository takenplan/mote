# Local original-decoder failure settlement — 2026-10-18

This narrow regression addresses audit F13: a returned deterministic recording
decode rejection left an issued physical-call receipt and `mp_activity=unknown`,
blocking safe processing-domain deletion/restoration. It adds no old-version
migration or historical-task repair.

## Source and result

Runtime runs used base `ea66efa643bc955feddbba8412de16036f7dd00c` with a test
overlay. GREEN also overlaid the `processing.ts` fix. Those final source/test
bytes were subsequently committed as
`722f40e2791a1474bac3afce7cdbac8c2f549a45`, tree
`d83f8ccd6ed972ee12a1e0fe637fb99b9718186d`; the runtime runs did **not** execute
under that later commit identity. From `apps/server`:

```sh
node --import tsx --test --test-concurrency=1 --test-timeout=120000 test/multiuser-local-processing-failure.test.ts
```

| Run | Actual result |
| --- | --- |
| RED, before the fix | 1 pass, 1 failure, no skips; 4.794 s. The returned recording format failure left `externalUnresolved=1` instead of 0. The HTTP unknown-call contrast passed. |
| Final GREEN | 2 passes, no failures or skips; 4.528 s. The physical receipt settles while the decoder task remains failed; data recovery succeeds and genuine HTTP uncertainty stays fenced. |
| Server typecheck, reported by the coordinating agent | Exit 0 for these final source/test bytes, using `tsc -p tsconfig.json --noEmit`. This is separate from the runtime runs. |

No processing timeout, test timeout or retry budget was increased.

## Entry points and boundaries

Case 1 creates a fresh disposable production `buildApp` composition. Account
login, connector installation/configuration/sync and task reads use real Fastify
routes through `app.inject`: no TCP listener or new OS process. A generated
DingTalk transport returns retained unsupported paragraph JSON for A and valid
transcript text for B; independent media acquisition is unavailable in this
fixture. The actual automatic original decoder rejects A's format. Its exact
physical receipt settles, its task remains failed, and processing activity clears.
Raw bytes stay readable and B cannot read A's original.

Processing-domain export, delete and two idempotent restores use the formal
owner-bound services lifecycle ports. They are not public REST recovery calls
or whole-instance backup/restore. Restored format and original bytes are checked,
the failed task gains no authority, and B's publications remain unchanged.

Case 2 uses an actual loopback HTTP ASR listener. A bare 503 leaves A's issued/
unknown fact unresolved while B succeeds. A fresh operation and unconfirmed
retry return 409; B's attempt to confirm A's task returns 404. Closing and
rebuilding the production host against the same disposable directory preserves
uncertainty without replay; this is a host rebuild, not an OS-process crash.
Explicit owner `confirmUnknown` permits a new successful ASR attempt while the
original physical journal stays unchanged and an exact confirmation is appended.

The fix requires the exact host `connectorOriginalProcessors` object and its
matching canonical `processor:<id>` original format. Only returned permanent
`recording_transcript_format_unsupported` or `recording_timeline_invalid`
failures qualify. This test executes the former through DingTalk; it does not
independently exercise the Feishu timeline case. Neither `localOnly` nor the
general `ExecutionFailure` class establishes completion. ProviderFailure/network
handling, unknown facts, authorization fences and explicit retry confirmation
remain intact. Physical settlement does not mark the task successful.

## Fixture corrections and hashes

Two unsuccessful fixture attempts are not product-pass receipts. The initial
attempt used unsupported `backupAudio:false` and expected file retry to change
the old physical journal from `issued` to `unknown`. These were corrected to the
current mandatory-backup selection and the invariant that confirmation does not
rewrite that fact; the corrected pre-fix RED then reached F13. The first post-fix
attempt passed settlement assertions but supplied a string to `assert.match`.
Correcting it to a regular expression produced final GREEN. These preparation
attempts were not retained as separate log files.

SHA-256 identifies the final files and retained local logs, not release assets.
RED used the test draft before the `assert.match` correction, so the final test
hash is not presented as the RED test-file hash.

| Artifact | SHA-256 |
| --- | --- |
| RED `processing.ts` at `ea66efa6` | `31f293de099b29ce5b22ff3e57107aa22911ae82d036547772e8c287ae17ab30` |
| Final `apps/server/src/scope/processing.ts` | `570150aef90e394d2b95bb5245353e490982d0d47dbdabe7a992cb538a4a5a77` |
| Final `apps/server/test/multiuser-local-processing-failure.test.ts` | `788569207ebbe8a1038a02a64211b84e098e71e34b3fa93942d2fe0c9b77e602` |
| `/tmp/mote-local-processing-failure-red.log` | `6b69daff588db0280105794ad9e5a707a0dbca6e17bdbba294842da302a8787e` |
| `/tmp/mote-local-processing-failure-green.log` | `ead2f38c47570d018f5535bb89ab058965a367e13bc15cc2137b8e7388c72518` |
| `/tmp/mote-main-multiuser-local-decoder-types-20261018.log` | `d92fa527b2cf6e7a734a389df70ded049e13fde5d094ded997bb6d7bd18c61e9` |

All accounts, content and provider responses are generated. No live model,
supplier account, personal screenshot, physical device or deployed release was
used. No application build or additional runtime check was run for this report.
The combined affected-component gate, local-Codex acceptance, main merge and
release verification remain pending in the [aggregate report](main-multiuser-integration-2026-10-17.md).
