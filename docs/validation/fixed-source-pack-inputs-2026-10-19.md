# Fixed Source Pack complete inputs

The scoped importer must preserve the original explicitly selected fixed pack's
complete supplied analysis inputs. Generic imports still separate host media from
text mapping. This restores the original responsibility; it adds no parser,
compatibility path, processing default or automatic recording-backup ASR.

| Journey | Regression entry |
| --- | --- |
| Configured SHA-pinned pack receives loose parent text, genuine 48-byte WAV and Finder metadata; private preview accounts for all originals exactly once; confirm publishes one parent with a real retained audio attachment. | `multiuser-fixed-source-pack-inputs.test.ts` |
| Same inputs inside a real ZIP; pack also sees the original ZIP; container disposition is counted once and audio is not independently submitted by the host. | `multiuser-fixed-source-pack-inputs.test.ts` |
| Pack marks a referenced attachment excluded, or owner cancels its private preview. No confirmation/publication/ASR is allowed; original private bytes remain. | `multiuser-fixed-source-pack-inputs.test.ts` |
| Public parent attachment processing starts actual generated ASR. Source retirement and a fresh public import recreate the retained parent while old ASR ignores abort; enabled and disabled replacement bindings get current grants, cannot replay before physical settlement, reject the late retired response, and preserve owner B. | `multiuser-fixed-source-pack-attachment.test.ts` |
| A bare 503 leaves unknown physical work. Replacement attachment preparation, enable and retry without confirmation cannot acknowledge it; explicit current-owner confirmation is required. | `multiuser-fixed-source-pack-attachment.test.ts` |
| Generic no-pack mixed media, configured pack pin changes, import preview/confirm/cancel/retry/restore and manifest privacy retain their existing contracts. | Whole `multiuser-import-jobs.test.ts`; `python-source-pack-executor.test.ts`; `import-manifest-worker.test.ts`; `memex-source-pack.test.ts`; `multiuser-file-attachments.test.ts` |

The new fixture uses the actual configured Python executor and OS sandbox,
existing upload/prepare/preview/confirm routes, host manifest normalizer, retained
archive links and public attachment processing. Its generated fixed-format parser
is a test mechanism, not a claim that a bundled or deployed WAV pack exists.
It does not seed database relations or call an internal attachment service.

On macOS, the new tests require `MOTE_TEST_PYTHON_OS_SANDBOX=1`, matching the
existing configured-pack integration check. Without that flag they are skipped,
which is not validation success. Run them with single test concurrency and the
existing 120-second per-test bound after the candidate's own normal dependency
installation and library build. Record skipped, cancelled and failed cases.

The source-incarnation journey intentionally deletes/recreates the source. It
does not bypass permanent explicit capture-deletion tombstones in the later
Lifecycle composition. Whole candidate PR checks, actual combined consumers and
independent review remain separate requirements. Native/UI/physical devices,
deployed provider behavior and live-model checks are not established by these
generated backend fixtures. Actual run receipts belong in the delivery evidence.
