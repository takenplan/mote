# PR159 bounded privacy review — consolidation released with historical limits

This is a source/publication review, not a guarantee that arbitrary historical content contains no sensitive value. It distinguishes low-sensitivity personal locators and internal task/tool identifiers from private Central contents, model answers and reusable credentials. No real Central or held-out data directory was opened, no credential was tested, and no private runtime evidence was uploaded.

## Reviewed scope

- PR159 at the pre-redaction publication head `25c31cdd52641ffd3a5ac69020a6925f3722d079` and the exact 28 multiuser PR heads in the consolidation mapping.
- The union relative to integration `6272a9b51ec92cc4c32e2ff1a1eeb4fa38b142ed`: 1,542 commits and 4,080 unique changed UTF-8 text blobs, including merge-parent diffs. Automated pattern review was followed by contextual classification of candidate literals; it was not a manual line-by-line reading of every blob.
- 116 successful GitHub read requests: 29 nonempty PR bodies; zero issue comments, review comments or reviews. The 23 encountered links were GitHub repository links; no readable attachment link was present. No introduced database/archive/log/image binary was found in this union.
- Public Git author/committer metadata was treated as intentionally public repository attribution rather than reproduced in this report.

## Findings and reversible current-tip cleanup

Confirmed findings are personal filesystem locators, internal conversation/tool-session references and one quoted authorization message. They are not evidence of a Central-data or live-credential leak. In the reviewed new history, personal locators occurred 243 times across 218 blob versions; 26 commit messages also contained locators. Version counts are not unique-secret counts.

At the pre-redaction PR159 tip, the changed validation-document scope contained 18 files / 25 lines / 28 personal-locator occurrences. Three additional opt-in script default locators were inherited unchanged from integration. A whole-current-documents pass also found inherited document locators and internal references, resulting in 36 publication documents being redacted before the new audit/TODO additions. Those broader counts must not be presented as newly introduced PR159 leaks.

The tip edit uses generic checkout/environment placeholders and removes internal discussion links, browser tab/session identifiers and verbatim authorization dialogue. Placeholders in historical command transcripts are intentionally not directly runnable; supply paths belonging to a new isolated checkout, SDK and owned evidence directory when reproducing. Container service paths and code-required transport paths were not blindly changed.

[The redaction ledger](multiuser-pr159-document-redactions.json) records each modified document's pre-redaction and publication SHA256. Existing execution hashes refer to original locally retained evidence; embedded redacted snapshots are publication views and are not byte-identical evidence or new executions. C2 and successor manifests, the original execution receipt and executable sources are unchanged. No application tests were rerun for this documentation-only edit; JSON parsing, formatting, local links and production/source preservation were checked.

Contextual credential review found no confirmed reusable live credential: strict credential-prefix/private-key/JWT checks had no surviving strong candidate, and remaining candidate groups were generated/negative test fixtures, offline replay keys, redaction sentinels or dynamic expressions. Email matches were confined to test sources. No confirmed Central content or retained live model answer was identified in the reviewed scope. This is a bounded finding, not an unconditional all-clear.

## Historical public copies and resolved script defaults

Tip redaction does not remove earlier public commits, commit messages, cached views or the other temporary PR heads. No force-push, history rewrite, remote branch deletion or credential operation was performed. The three inherited opt-in scripts originally contained personal default locators. The authorized minimal follow-up now removes them:

- `scripts/test-composed-image-context.ts`: `MOTE_COMPOSED_IMAGE_FIXTURE` is now required before any fixture path resolution/read; the existing explicit input behavior is retained.
- `scripts/test-heldout-memory-replay-stage.ts`: the supervisor defaults beneath the explicitly supplied held-out root; `MOTE_HELDOUT_SUPERVISOR` can override it.
- `scripts/test-heldout-memory-replay.ts`: `MOTE_HELDOUT_ROOT` is now required. The existing `heldout-corpus-v2` and `heldout-eval-v2-1` child layout and frozen hashes are unchanged. Imports of its mechanical-test helpers also require this explicit generated-input root.

Their original target directories and contents were not accessed. No original script/data/model runtime test was executed. The follow-up ran eight parameter/syntax checks by extracting only the actual guards and path declarations into isolated contexts: missing inputs reject before fixture resolution, explicit paths retain the directory layout, and the supervisor override/default behave as documented. Scripts strict TypeScript checking passed after linking existing read-only matching-build Agent artifacts and server dependencies; the first attempt in the artifact-free publication checkout exited2 for missing local artifacts/types and is retained separately. No dependency lock or product behavior changed, and no full-platform gate was rerun for this authorized cleanup. Any historical removal or repository-support request requires a separate decision and authorization; this lane will not rewrite history.

The initial privacy hold paused all28 closes. After the follow-up and independent review, the parent informed the user of the historical limits and explicitly released consolidation. At `2026-10-17T13:11:22.335443+00:00`, all28 covered PRs were independently confirmed closed/unmerged, each with a consolidation comment. PR159 stays Open Draft; PR143 and PR145–148 remain open and independent. Exact comments and timestamps are in [the final consolidation result](multiuser-pr159-consolidation-result.json). The incomplete real-Web work remains an unchecked [PR TODO list](multiuser-final-joint-e2e.md#deferred-web-acceptance-todos).

## Final current-tree and historical classification

At cleanup commit `422204633da29ad679bf9fd99b48b00447a20c1c`, a full tracked-text pass examined 2,839 files, beyond the PR-added document subset. No actual personal home path remained. Five home-shaped literals in `apps/server/test/material-projection.test.ts` are explicitly synthetic fixture-owner paths used to verify model-facing path redaction; they were classified by source context and retained. The 26 historical message findings are all Git-generated local-repository merge-source paths, not copied Central contents or credentials. Their public history remains unchanged.

The actual tracked C2 manifest, C2 aggregate receipt, successor manifest and original execution receipt were individually checked, rather than relying on a separately cleaned copy. Personal-home matches are zero in each. The C2 and successor manifest hashes remain `3295223d9a2cf7e8abf4cea86e2a125328491a024ad3e3c2363e4d4cc07dc08a` and `e67e14ed9f3b86c045e34f4dfe75711f02bed4cfd17f2f314fc3dd80a0063496`; the original successor execution receipt remains `cbb1579bd4244fabeb54e4854d2afffff4f97fd57e9e143a721c19ba1313608e`. The redacted C2 aggregate publication receipt has its own hash in the redaction ledger and must not be confused with original embedded execution evidence.

Within the reviewed scope, the unresolved publication findings are historical low-sensitivity machine locators and internal execution references; no Central private content or reusable live credential was confirmed. The parent combined the independent audit, informed the user of those historical limits, and explicitly released the already-authorized consolidation. That later authorization—not this bounded report alone—was the basis for closing the28 superseded PRs without merge.
