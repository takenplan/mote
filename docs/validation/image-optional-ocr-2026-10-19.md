# Scoped optional OCR and complete image evidence

The local candidate starts at `528cf54e9e32b8c3ce0e3d0e9e58353ef5499e67`.
This restores the original image dependency and full OCR seed behavior through
existing M03/M04/M05/M06 ports. It introduces no public scheduler, schema,
permission, compatibility format or supplier integration.

| Disposition | Behavior |
| --- | --- |
| KEEP | Default successful OCR publication followed by automatic derivatives; current original/source/plan/account/task fences; exact material and dependency identity; required dependencies; verified pixel reads; explicit complete/recompute; independent OCR failure receipts. |
| CHANGE | The scoped host applies the same pure dependency permission rule as the original image host. An omitted optional product must be justified by the current root's durable child checkpoint and a trusted blocked/failed/cancelled task whose subtree has no unresolved external call. |
| REMOVE | Mandatory OCR success before optional image understanding; the added silent 12,000-character OCR seed slice. |
| EXCEPTION | Generated PNGs, local simulated HTTP suppliers and declared in-process fixture stages exercise the real intake/task/recipe/publication entry points. The cancelled-stage fixture makes no external request. |
| UNKNOWN | Physical devices, real OCR/model suppliers, OCR/vision quality, deployment and release behavior are not validated by these fixtures. |

`multiuser-processing-optional-ocr.test.ts` covers:

- Default and custom recipes with text, empty, failed and blocked OCR; actual
  generated-provider `read_image` calls; independent missing extraction state;
  default `image` and custom `image:understanding` output identity.
- Restart without replay; completion of failed OCR that subsequently succeeds
  while accepted interpretation IDs and model call counts remain unchanged.
  The accepted interpretation retains its original absent-optional input receipt.
  Root/File status retains the original OCR failure and code; image progress
  reports the failed OCR independently of running/successful understanding.
- Actual managed-model local-bundle installation resumes the original unfinished
  intent through `processing.recheck`, publishes genuine OCR once, and retains
  the already accepted vision without another model call, for both recipes.
  If readiness changes before the fallback OCR stage runs, the original default
  root still publishes OCR exactly once. The pre-admission OCR wrapper remains
  visibly blocked while its independent understanding phase is running.
- Required OCR rejection; default/custom unresolved physical calls and refused
  unconfirmed retry; root cancellation and source withdrawal before a late OCR
  response, including restart without new model work.
- A trusted cancelled OCR stage permits its optional pixel consumer. In a mixed
  graph the required consumer remains blocked, while the optional output is
  independently published. Root cancellation remains a separate absolute fence.
- Complete long OCR, including non-ASCII and surrogate-pair characters, appears
  exactly once in untrusted task context with its true range. The trusted task
  question contains no captured OCR.

The related existing suites are `image-processing.test.ts`,
`multiuser-processing.test.ts` and `multiuser-processing-image-recipe.test.ts`.
They cover original image behavior, independent scoped accounts, publication,
physical settlement, lifecycle fences, source attribution, snapshots, named
recipes, partial completion and existing language-agent consumers.

Validation is headless and uses this worktree's own installed dependencies and
build outputs. No real personal screenshots or external model suppliers are used.
The final check results and remaining integration gates are recorded in the
owner handoff; module checks do not establish that the change is in a target
release or replace the integration driver's affected-component gate.
