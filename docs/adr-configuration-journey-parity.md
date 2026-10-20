# ADR: Preserve configuration and usage journeys under account scope

Status: accepted, 2026-10-18. The owner requires the pre-multi-user operations,
steps and behavior to remain, with only login and necessary resource isolation
added. This refines the [shared-flow decision](adr-shared-business-flows.md) and
[M04 configuration contract](design/multiuser-configuration.md).

## Decision

Personal model editing follows draft → catalog / connection test → save and
apply. Draft inspection binds the caller, personal profile ID and configuration
revision. It may inspect a new unsaved profile. It uses a synthetic reader and
never publishes the draft, changes effective settings or borrows another user's
credentials. Saved shared references remain complete administrator-owned
connections; caller-supplied shared transport, credentials or model overrides
are rejected.

A retained API key, custom header object or extra request body may be reused at
a changed provider, protocol or base URL only after explicit confirmation. The
same domain rule applies before a draft catalog request, connection test or
redacted configuration save. Replacing or clearing the affected credential is
an alternative to confirmation. Shared keys never become personal draft data.
Private operator file changes retain their existing literal credential semantics
and do not interpret browser redaction markers as secrets.

Each personal feature selection can retain an optional model ID independently
of its connection. Switching connections clears the prior feature override in
the editor. Shared references do not accept overrides. Removing a referenced
personal connection is unavailable in the dedicated editor; removal of an
unreferenced connection requires the existing explicit confirmation.

Configured Codex executable and login home are host runtime dependencies.
Catalog, probe, task execution, working-memory compaction and the Hindsight
adapter use the same effective instance settings. These fields keep their
restart contract. There is no per-user executable input or fallback to a second
business runtime.

Shared resource generations represent transport authorization: provider,
protocol, endpoint, credentials and explicit local unauthenticated access.
Changes to the selected model, output budget, reasoning or deadlines affect new
admission without globally revoking admitted model leases. Ask retains its
frozen runtime and price, including recovery after restart. Memory and Files
retain their original domain-specific related-configuration fingerprints and
publication checks; this does not weaken those domain contracts. Resource removal or changes to transport authorization
fence prior snapshots. Account disable/reset/delete and personal credential
withdrawal keep their existing immediate fences; normal logout alone does not
cancel admitted work. Ordinary edits do not mint new authorization for old tasks.

Usage uses the existing summary calculation with account-qualified inputs.
Date and timezone boundaries, exact attribution/model/status filters, groups,
facets, drilldown and detail pagination retain the original contract. Prices
remain personal and are frozen at admission; missing price or metering stays
unknown. The existing no-query receipt read used by current scoped consumers
remains available; the Usage page always requests a dated, paginated summary.
The page restores the existing price editor rather than requiring JSON edits.
Business entrances supply attribution explicitly: file analysis and review use
`file-analysis` / `files` / no primary Skill; import mapping uses
`document-import` / `imports` / `document-import`. This is not content inference.

## Supersession check

| Disposition | Responsibility and affected assumptions |
| --- | --- |
| KEEP | ConfigService CAS, private YAML ownership, prepare/publish/rollback, saved/effective distinction, secret redaction and synthetic connection probes. |
| KEEP | Original dedicated controls, categories, credential decisions, per-feature personal model selection and full Usage page. |
| KEEP | Account and true resource withdrawal fences, cancellation, late-result rejection, unknown external outcomes and no automatic historical work. |
| CHANGE | Personal draft inspection resolves only its own same-ID saved credentials under the pinned revision; shared inspection remains a fixed authorized resource. |
| CHANGE | Shared generation tracks authorization separately from ordinary next-request tuning; durable leases retain the admitted snapshot. |
| CHANGE | The common query host and Hindsight adapter receive effective host Codex options, matching discovery and probe. |
| CHANGE | The original usage reducer receives only the authenticated account's receipts and prices; business entrances retain their original attribution. |
| REMOVE | Forced save-before-test/catalog, silent retained credentials at a changed target, forced personal connection copies for different feature models, and whole-history receipt lists as the Usage UI. |
| REMOVE | Full-settings equality as a blanket shared snapshot withdrawal rule; generic JSON as the only editor for previously dedicated settings. |
| EXCEPTION | Shared credentials, endpoint and model are administrator-owned; no arbitrary shared transport combination or shared-to-personal secret inheritance is restored. |
| EXCEPTION | Current no-query receipt consumers retain their account-scoped read. This is not an old wire/storage migration path. |
| UNKNOWN | Real provider billing, physical clients, operator login resources and externally revoked credentials require separate checks. Generated fixtures do not establish those outcomes. |

The [validation record](validation/configuration-parity-2026-10-18.md) records
production API and hidden Web evidence separately from live checks. This work
does not deploy, migrate old formats or reprocess real personal data.


## Resource consumer continuation

KEEP: the original Images and File/Voice settings categories, named native
controls, private content encryption, explicit historical confirmation and
operator-owned installation/storage policy. CHANGE: all accounts read the
Files producer's safe instance model status; only administrators receive install
and cancel controls. Image settings preserve derived service fields and reference
a file-policy profile instead of editing endpoint or credentials. Historical
results display actual M05 states; public progress contains only queued counts.
REMOVE: hidden scoped media cards, editable derived endpoint fields, treating all
unfinished history states as active scheduling, and stale preview confirmation
after draft/range changes. EXCEPTION: installed model files do not imply worker
readiness or authorize processing, select models, or confirm history. Storage
keeps separate saved and effective values until its existing restart boundary.
UNKNOWN: combined production startup/browser and native execution require the
coordinated driver window; generated contract tests alone do not prove them.

The exact producer seams and validation commands are in the
[resource consumer handoff](validation/configuration-resources-parity-2026-10-18.md).
