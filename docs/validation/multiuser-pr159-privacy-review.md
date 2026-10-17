# PR159 bounded privacy review — closing paused

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

## Unresolved public copies and inherited defaults

Tip redaction does not remove earlier public commits, commit messages, cached views or the other temporary PR heads. No force-push, history rewrite, remote branch deletion or credential operation was performed. The three inherited opt-in scripts still contain personal default locators:

- `scripts/test-composed-image-context.ts` (external generated fixture input; an environment override already exists).
- `scripts/test-heldout-memory-replay-stage.ts` (external stage-manifest default).
- `scripts/test-heldout-memory-replay.ts` (held-out input-root default).

Only their source was reviewed; their target directories and contents were not accessed and the scripts were not executed. A separate reviewed code change could require explicit environment/CLI inputs and eliminate personal defaults, with focused checks. It is outside this documentation-only cleanup. Any historical removal or repository-support request requires a separate decision and authorization; this lane will not rewrite history.

All 28 temporary PR closes and closing comments remain paused. PR159 stays Draft; PR143 and PR145–148 remain independent. The parent will combine this bounded review with the independent audit and decide further cleanup and closing. The incomplete real-Web work remains an unchecked [PR TODO list](multiuser-final-joint-e2e.md#deferred-web-acceptance-todos).
