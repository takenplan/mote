# Exact-C2 recovery driver source archive

These are text snapshots from the independently executed C2 recovery lane. Their original names and SHA256 values are in `index.json`; `.source` is only an archival suffix. One later path/provenance adaptation is explicitly recorded for `prepare-compiled-http-driver.mjs`: it now reads the retained original HTTP test from the supplied repository checkout instead of another task's directory. The original executed C2 hash remains in the index. The tested original product source is `8ad99089ead559d6656a269fdca7ccb884953c07`, not the later test/document publication head. The actual immutable C2 recovery receipt SHA256 is `f6061ef593fbe773f2afc2ebc12d6b2097326fe6e27eaa39e7f003020326f452`.

No runtime data, database, archive, captured image, credentials or model answers are included. All examples inside driver source are generated fixtures. Do not reuse an existing run's directories, ports, volumes, containers or `active-run.json`.

To repeat, check out the exact recorded execution SHA in an owned clean directory, verify its matching consumption manifest and tracked-file hashes, install the locked dependencies there, and fresh-build libraries/Server/Web with one matching Node ABI. The original full-C2 receipt belongs to8ad. The self-contained HTTP preparer and restored original suites require the test/document successor `0cfe78d6afd7143ed3e5be855925928eb23f76a9`, whose production inputs match8ad; that successor has its own manifest and receipts in [the source completion record](../multiuser-recovery-source-completion.md). An8ad checkout alone does not contain the restored HTTP test body. Never mix a later checkout with the old manifest or relabel a prior execution.

Copy the archived files to a new owned staging directory while restoring the original names. The TypeScript entry `final-c2-complete-recovery.ts` and its relative helper imports are controlled by explicit `MOTE_FINAL_RECOVERY_*` variables. It validates the exact checkout, source manifest, fresh build receipt and image artifact identity before runtime import. `preflight.mjs` independently checks root and actual Mem0 native constructors and workspace module identity.

The small orchestration wrappers are historical source: they contain the original `/tmp/mote-final-recovery7-prep/active-run.json` staging path and C2-specific dependency image identity. Do not run them against that original path. Use a unique owned control/staging path and record any path-only adaptation and new runner hashes for the new run, or invoke the test directly with the explicit environment below. A new run must fresh-build its image and build receipt using the recorded `build-final-image.mjs` input/lock checks; never relabel the original image as a new source image.

The direct test uses these explicit inputs:

- `MOTE_FINAL_RECOVERY_WORKSPACE`: clean, fresh-compiled exact-C2 checkout with owned dependencies.
- `MOTE_FINAL_RECOVERY_CANDIDATE`: exact 40-character C2 SHA.
- `MOTE_FINAL_RECOVERY_MANIFEST` and `MOTE_FINAL_RECOVERY_MANIFEST_SHA256`: immutable source consumption proof.
- `MOTE_FINAL_RECOVERY_EVIDENCE_DIRECTORY`: new owned directory containing `mote-final-recovery7-` and no other run's files.
- `MOTE_FINAL_RECOVERY_BUILD_RECEIPT`: new receipt including candidate, lockHash, artifactSha256 and inputPaths.
- `MOTE_CONTAINER_VALIDATION_IMAGE`: freshly built verified image for that exact source. Local pinned dependency images must already be present; the driver does not substitute arbitrary images.
- Optional `MOTE_FINAL_RECOVERY_HTTP_RECEIPT`: the new compiled-HTTP receipt, with its matching immutable host driver hash.

Run with the checkout's own Node and `--import <checkout>/node_modules/tsx/dist/loader.mjs --test --test-reporter=tap <staging>/final-c2-complete-recovery.ts`, from that checkout. Scrub inherited `MOTE_*` and external credential variables before supplying only the explicit generated-data inputs, as the captured orchestration source does. This is an opt-in Docker/PG/Hindsight validation, not an automatic unit test.

For the compiled HTTP subset, restore `prepare-compiled-http-driver.mjs`, `compiled-http-host.mjs` and `final-recovery-support.ts` into the owned staging directory, then run `node --import <checkout>/node_modules/tsx/dist/loader.mjs <staging>/prepare-compiled-http-driver.mjs <checkout> <owned-output> <candidate> <manifest> <manifest-sha256>`. The output directory must use `mote-final-recovery7-<UUID>` as checked by the script. It reads `apps/server/test/multiuser-recovery-http-seams.test.ts` from that exact checkout and replaces only its child-host path. Execute the emitted `compiled-recovery-http.test.ts` with the same loader and `--test`. Neither a task-7 checkout nor its working files is required. Record the new preparation/driver/host hashes and actual result; do not relabel the old C2 receipt.

`generation-history-settled.ts` is the actual final C2 helper. The earlier `generation-history.ts` is retained for provenance: its original race assumption was too strong when an external call remained issued/unknown. Do not replace explicit unknown-result consent with automatic settlement to make a fixture green.

Cleanup is limited to resources labelled with the new run UUID. The original C2 lane verified all 24 recorded containers and 12 volumes absent; a repeat must independently verify its own cleanup and preserve all failed attempts.
