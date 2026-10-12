# Import disposition preflight validation

Date: 2026-10-13 (Asia/Shanghai).

The owner reported a Central import failing with “Evidence paths must be marked
parsed in the file disposition list.” The model helper previously checked the
record schema and supplied paths but did not check the disposition file. A
generated reproduction returned `valid: true` from the helper and that error
from the independent host validator.

## Implemented behavior

- The helper and host use shared record/disposition schemas, path accounting and
  reference/status validation. Preflight requires both generated manifests.
- Evidence requires `parsed`; attachments require `parsed` or `attachment`.
  Missing, duplicate and unknown disposition paths fail preflight.
- Conflicting references report the physical JSONL line, reference field, actual
  and expected statuses, and workspace-relative path. Blank lines count toward
  the displayed line number.
- Central still verifies original bytes independently and rejects a conflicting
  preparation before publishing any preview or inserting records. Archived
  originals remain available for explicit retry.
- No automatic model retry was added. Existing host warning/manual-review
  behavior for older parsers without dispositions remains unchanged. Attempt
  artifacts still receive their existing cleanup.

## Generated checks

Final `npm run check:affected -- --base HEAD` passed on the complete code change:
at that run, `HEAD` was the `origin/main` baseline `a57e87b`.

| Group | Passed | Skipped | Failed |
| --- | ---: | ---: | ---: |
| Shared | 178 | 0 | 0 |
| Agent | 271 | 1 | 0 |
| Server | 1,532 | 1 | 0 |
| Web | 339 | 0 | 0 |
| Release tooling | 37 | 0 | 0 |
| Total | 2,357 | 2 | 0 |

The gate also passed translation checks, Central builds/typechecks and the
Central runner fixture. Conditional tests for the installed Codex synthetic
Responses fixture and the macOS sandbox were skipped; they are not claimed as
performed validation.

[Helper regressions](../../apps/server/test/import-runtime.test.ts) compare
helper and host behavior across contradictory evidence, invalid attachments,
missing/duplicate/unknown inputs, combined evidence, empty manifests and CRLF
line numbering. They execute the helper through the independent Node CLI and
check both success and failure exit codes.

[Import regressions](../../apps/server/test/imports.test.ts) verify that a later
conflicting record cannot partially publish, no automatic retry occurs, original
bytes remain readable, and an explicit retry can preview and confirm corrected
records without reuploading originals.

## Owner-authorized live case

The local DEV Central was restarted from this worktree's patched 0.0.89 build.
Its process record identifies this worktree as the running checkout, and the
shared validation module and parser template match the checked source bytes.
The original failed job was retried through its authenticated HTTP retry route,
with its instructions and manual-preview processing mode preserved. This check
used the owner's archived files with explicit authorization, not generated test
data. Personal content, filenames, tokens and job identifiers are omitted here.

- Live provider: Codex, model `gpt-6.1-sol`; model analysis completed normally.
- About 191 seconds to `awaiting_confirmation`; the reported disposition error
  did not recur.
- All 179 archived originals retained identical IDs, hashes and byte sizes.
- Preview: 631 text records plus 14 pending media originals, 645 total.
- File dispositions: 72 parsed, 2 containers, 91 excluded, 14 processing,
  0 unsupported; all 179 originals accounted for.
- All 631 text identities are unique. Their evidence references cover 72 parsed
  files, with zero evidence or attachment disposition conflicts.
- Two model-authored caveats concerning image references and attribution remain
  for owner review. They are not independently established semantic findings.
- Zero records were committed and no captures were created by the preview.
  Confirmation, media processing and downstream Memory were not exercised.

This validates the original failure point through the real import entry route.
It does not establish semantic accuracy or completeness of every extracted
record, browser UI behavior, physical-device behavior, or a published release.
