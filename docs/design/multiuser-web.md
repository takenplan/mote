# M13 Web account and management migration

Base: M08 `58944f00837c89bc1d302ecd7be7a568db4abe44`, including M07
`cd7a306cce0f6cd5fec3c9e91e6dee0761352115` and the public contract PR135.
Final M11 PR138 `98d76945e091d7234217ebcf532ebeff3350937c` is composed.
M12 is paused and its contract handoff remains denied pending explicit user
authorization. Final M13 composition and checks are separate gates.

## Capability ledger before implementation

| Disposition | Existing capability and entry | M13 responsibility / acceptance |
| --- | --- | --- |
| KEEP | `main.tsx`, feature registry, workspace/sidebar/settings navigation and presentation packs | Reuse page locations, components and visual hierarchy. No product navigation redesign. |
| CHANGE | `LoginDialog`, `session.ts`, ticket handoff; owner-token browser login | Username/password and M01 HttpOnly Cookie session, protocol 2, CSRF, immutable credential ID. Reload discovers current identity before rendering private content. |
| REMOVE | Browser owner-token prompt, token persistence, local lifetime pretending to extend a server grant | Retired credentials never silently become an account; only server session expiry controls validity. |
| KEEP / CHANGE | `createApi`, ResourceCache generation, per-Api resources | Recreate on account/session/deployment change; guard before sending, after awaits and before publishing. Old tab carries original session ID and cannot borrow a replacement Cookie. |
| KEEP / CHANGE | ImportQueue, OperationFeed, evidence/client/action dialogs and component drafts | Account transition disposes private trees, pending admission and subscriptions. Already admitted server work survives logout. Held callbacks retain original Api. |
| CHANGE | Notes local outbox and draft; origin-only namespace in `features/notes.tsx` | Stable origin + deployment + user namespace. A survives A re-login but never appears or submits in B. Legacy unbound local drafts are not adopted. |
| CHANGE | Settings entry, existing configuration registry/CAS and user model references | Personal settings use M04 user domains; shared resources and account administration require administrator authority. No private owner selector. |
| KEEP / CHANGE | Connections inventory, MCP issuance and client approval | Consume M01/M11 actual contracts; credentials and generated secrets remain within the current account tree. |
| EXCEPTION | Legacy bearer Api fixtures / native handoffs | Bearer transport remains explicit for algorithm/consumer fixtures; the Web login/restoration path only adopts validated Cookie sessions. Native clients remain M14/M15. |
| UNKNOWN | Browser lifecycle, revocation/disable, slow replies, concurrent auth/submit, open approval dialog | Must close with generated data in a hidden actual renderer plus actual production backend. M11/M12 final remote heads and independent review remain required. |

## Validation obligations

New migration regressions retain RED parent/test/fix evidence. Characterization
retains old normal caching, navigation, settings CAS, pending work and draft behavior.
Use equal A/B business IDs, actual Accounts/SQLite/shared services/single executor;
only external I/O may be synthetic. Cover A→B, reload, same-account credential
rotation, stale tab, delayed body/response, logout versus submit, failed login,
open approval, account disable and credential revocation. Explicitly separate
emitted renderer/backend integration from JSDOM/unit fixtures. Final validation
uses `npm run check:affected -- --base origin/codex/mote-multiuser-integration`,
related builds, same composed dependency SHA, independent review and remote PR
head/base verification. No merge, deployment, CI enablement or real private data.

## Original Web consumer compatibility audit (in progress)

This is a required acceptance ledger. A safe session does not prove domain
compatibility. Status **OPEN** means not accepted, not removed from the product.
Existing navigation and page components remain the intended consumer. The
scoped host has no legacy runtime/store mounted. Audit is against the actual M08
589 composition; M11/M12 final integration will update it.

| Page / existing consumer | Old endpoint(s) | Actual scoped public capability | Minimal adaptation / status |
| --- | --- | --- | --- |
| Login/current account/native browser handoff | owner bearer, `/login/exchange` bearer | M01 `/auth/login`, `/auth/self`, Cookie exchange, session binding/CSRF | Implemented; actual IAB + backend positive/negative chains. |
| Personal settings / shared models | `/configuration`, `/model-settings*`, global settings | M04 user configuration/CAS, `/models`, administrator models | Implemented personal reference/profile editing and masked-secret preservation; characterization + actual backend; complete settings UI parity remains OPEN. |
| Account administration | no multiuser page | M01 `/admin/accounts` metadata/create/disable/reset | Implemented at existing Settings entry; actual UI read pending. |
| Credentials / MCP | `/connections`, old MCP issue | M01/M11 credentials, strict MCP issue/revoke | PersonalConnections consumes actual contract; final M11 head composed; renderer issue/revoke pending. |
| Registered devices / Today / usage | `/devices`, global `/status`, old usage view | M03 `/ingress/devices`; M02 `/data/statistics`; M04 `/usage` | Scoped summaries implemented. Old heartbeat health/storage diagnostics details are not supplied by these metadata APIs; OPEN domain gaps below. |
| Feature gate / discovery / renderer packs | `/features` | Real registered scoped Fastify routes; existing FeatureRegistry contract | Implemented eda455ee: actual onRoute → existing FeatureRegistry; backend positive/negative gate. Actual IAB page gating passed; never advertise missing routes or providers. |
| Library formal list / filters / pagination | `/library/catalog`, `/library/descriptor` | M02 `/materials` + `/sources`, scoped cursor and exact pinned material read | Implemented eda455ee thin catalog: existing PrivateData canonical page/cursor and own source-count projection; no scoped presentation pack is claimed. Original LibraryBrowse consumer remains; actual IAB A/B canonical/source increment passed. |
| Formal detail / citation / attribution | `/materials/:id`, revisions/read/members/context; optional descriptor/source-view/index retry | M02 exact same material read/revision/members/context; M08 canonical context | Core routes available. Source-view/presentation/index-retry do not exist in589 scoped host: optional presentation must use established generic body fallback, retry must not claim unavailable index work. Explicit Memory Material links and manual selection consume M07 canonical preflight and pin the selected revision again at admission; returned evidence remains under the declared context reader. |
| Raw records / evidence / albums / sessions / image OCR | `/capture-browser*`, image/ocr; capture delete | M02 `/captures`, `/captures/:id`, delete; M03 original tickets/content; M08 segments | OPEN: text/current capture consumer can adapt; before-LIMIT source/app/privacy/OCR filters, albums/sessions grouping, original image/thumbnail/OCR projection are genuine missing scoped adapters (M02/M03/M06). Do not silently drop filters or reconstruct canonical refs. |
| Sources metadata/history/context | `/sources`, `/source-items`, history/context | M02 same owned endpoints | Available normal metadata contracts; actual renderer compatibility pending. |
| External source settings / OAuth / recording connector | `/connectors/status`, vendor paths, old sync/delete | M10 `/connectors` per-instance config/revision, `/start`, `/sync`, `/disconnect`, `/operations` | OPEN M13 consumer adaptation to fixed per-user connection IDs + CAS; vendor-specific response/view compatibility requires M10 domain contract. No alias may infer another account. |
| External MCP discovery/import | `/connectors/mcp/discover`, `/import` | M11 strict discover/import, user mcpConnections domain | M11 final composed; owned preparation/CAS and same-ID draft retirement pass real backend/component tests. IAB connection/source save passed. Actual renderer discovery/import success remains OPEN; contract `/tmp/mote-m11-web-contract.md`. |
| Web reference import | PUT `/sources/:id/items` | M03 explicit device/source registration + POST ingress items/batch receipt | Implemented5b042c4b; actual M03 metadata/retry/history/A-B tests and IAB save/switch passed. Identity-corrupted actual ACK RED51101a26 → strict c1b6f159 GREEN; no URI is fetched. |
| Notes and chat attachments | `/sources`, `/file-sync/v1/uploads`, parts/commit | M03 ingress devices/sources/uploads/parts/commit with actual file revision/receipt | Implemented b64afe07 transport adapter using original chunk algorithm, exact user/deployment/source/batch/hash/byte receipt validation. Actual HTTP byte read/retry/isolation and old upload characterization pass; renderer attachment increment pending. Text notes already actual Ingress3. |
| Imports / confirmation / local upload queue | `/imports*`, `/import-uploads*`, `/import-source-packs` | M03 ingress upload + M06 `/processing`, originals/artifacts/derivations, M05 operations | OPEN. Old ImportJob/instruction/confirmation/resume response shape is absent. Need M06 read/command contract mapping before thin adapter; do not invent confirmation policy or mount old ImportManager. |
| Files / audio / review / speakers / export | `/files*`, `/archived-files*` | M03 original content + M06 typed processing artifacts | OPEN genuine missing read/review/export projections (M06). No fake empty file list or dropped review actions. |
| Processing/activity | `/processing` workflow list, `/work-activity`, `/operations` | M05 actual `/operations`; M06 processing configuration/submission | Operation component reused; old workflow WorkActivity aggregate and processing-list shape remain OPEN, not interchangeable contracts. |
| Ask/conversations/query progress | `/conversations*`, `/query-runs*`, `/query`, work activity | M08 same conversation/run routes with strict Ask input; canonical evidence reader | Existing consumer largely same; per-request selection uses M15 db88 owned modelReference and personal model ID override through M04. Actual IAB+real M08/Harness+generated SSE I/O/material tools/conversation/citation/refresh passed. A held provider→B positive→releaseA passed. Original model controls restored cde70676/705d with same-ID account retirement RED/GREEN; provider-model post-read during one IAB run remains unverified. WorkActivity projection remains OPEN. |
| Insights/history/report | `/insights`, `/insight-runs`, `/skills`, artifacts | M08 actual insight routes/artifacts; fixed shared skill engine | Actual `/skills` uses bundled catalog; actual missing run scope RED06564f97→3529e18b. IAB report iframe/text/citation/history refresh passed. Original preset control restored through the same owned-reference seam; bounded M14 review9659..705d found no confirmed P0/P1/P2. |
| Memory list/correction/delete | `/memories*`, `/memory-jobs*` | M07 memories same; `/memory/jobs*`, `/memory/recipes`, `/memory` view | Published list, actual M07 job history/receipts and direct/nested context evidence readers adapted and validated with real M07 publication. Original valid owner correction now uses operationId + correction and follows its committed task to the new published version. Canonical Material manual selection retains recipes, owned request model and operation ID through publication; owner stale review now uses the existing M07 audit-only page/read and retained evidence, with no active Memory/context/model publication; audit time/search/category parity and manual range/raw selection remain OPEN; use real provider facade, no raw store body. |
| Memory settings/recipes/bindings/integration | `/memory-settings`, `/memory-recipe-settings`, `/memory-spaces*`, `/memory-recipes` | M04 memory domain, M07 `/memory` control, binding prepare/activate/cancel, M09 plugin snapshots | Original plugin-page M07 pause/resume/stop and prepare/read/activate/cancel mapped to actual receipts; durable preparation discovery is read-only and owner-bound. Recipe catalog and persisted job batch/task progress are adapted; manual selections, settings, integration and unavailable legacy input-plan projections remain OPEN; never restore authority from a local draft. |
| Plugins / personal instances / admin package install | `/plugins`, instances, resolve/install/uninstall | M09 same package and instance endpoints but strict expectedRevision/user snapshots; administrator package mutation | Owned M09 editor metadata, explicit masked-reference preservation under CAS, personal/shared reference choices, explicit capability/source/history grants and separate administrator catalog revision implemented ff91/71a2. Actual original React page + actual M09/M07 isolation/edit/reload/activation chain passes; Actual IAB administrator preview/install/uninstall/reinstall and A masked edit/check/enable/disable passed; nonempty Memory-provider migration remains OPEN. |
| Agent inspector / startup/context trace | `/agent-view/*`, `/context/*` | M08 scoped catalog/read/search/retrieve/bundle/status; startup/runs/events availability must be checked | OPEN actual consumer audit; missing trace/startup projections need M08 contract, not synthetic runs. |
| Todos / calendar action approvals | `/todos*`, `/actions*`, `/devices`, native calendar bridge | M12 final scoped Todos/Actions + M03 device metadata | OPEN M12 implementation and final exact SHA. Must test an already-open review through A->B/revoke/disable and original target/hash/epoch fences. |
| Storage/encryption/backup/index | `/content-storage*`, `/vault*`, `/storage-statistics`, backup/restore | No equivalent scoped management surface in589 | M16 owned portable3 receipt/list/cancel/retry and verified download are consumed in the original Vault; the original route no longer requires global status. Admin account deletion uses durable metadata receipts and original operation ID, including refresh/retry and self-session retirement. Personal import, separate metadata/data modes, encryption/index/statistics and instance diagnostics remain OPEN scoped contracts. Instance backup/restore is M16 offline CLI; administrator authority never grants private export access. |
| Diagnostics/runtime/update/deployment settings | `/diagnostics*`, `/runtime*`, `/updates*`, global status | Explicit instance management needed; not in589 scoped routes | OPEN backend capability gap, final integration/instance administration; never relabel as personal or expose paths/secrets. |

No OPEN row is counted as M13 complete or silently deleted. Thin adapters must
have real backend tests and representative renderer journeys. Missing domain
semantics need owning-module follow-up; this audit is not evidence that the old
single-owner production behavior was defective.


Increment after independent freeze22: 47ee1679 RED -> eda455ee metadata/library;
5162526f RED -> b64afe07 attachment transport; 029fba7c RED -> 5438b1ce
newer-auth intent fence for delayed ticket exchange. This last RED is a new
migration adoption race contract, not a claim of an old-system production bug.
M11 reviewed589..22 only; all these increments still need independent review.
No existing Web consumer directly reads getReader/SSE; raw Response body-method
consumers are fenced. Direct stream adoption is not counted tested or supported
by that body-method proof.

## Bounded closure checkpoint9659

See the finite closeout list in [M13 validation](../validation/multiuser-m13-web.md).
M14 independently reviewed22..5e and c1b6/3529. Its ACK identity P2 gained
real M03 transport-corruption RED→GREEN and was re-reviewed closed. No new
confirmed P0/P1/P2 in that bounded increment; no independent test rerun is claimed.
Public reader-only freeze c6b092eda5404dde2f99ea601e2f3ef13c55d386 sits above
final M11 plus M14 source CAS; M14/M15 can compose it without Web/native/M12 code.
It is not whole-module acceptance.

## Increment after9659

M15 db88 per-request model lease seam is composed as7f2fe173. Original Ask and
Insight controls were restored; same-ID A→B component selection REDa39db8c0
→705d0207 GREEN5/5. M14 bounded review9659..705d has no confirmed P0/P1/P2.
One actual IAB alternate-model query completed and archived, but transport loss
prevented provider model/default post-state reads. A readonly recovery confirmed
the rendered archived answer and clean705d; HTTP host was no longer listening.
No query was blindly replayed and the missing post-state proof is not counted.

M16 owns personal export/instance backup/restore/delete lifecycle. Existing
`features/storage.tsx` still selects `ContentStorage` and `Vault`. Entries are
GET `/export`, GET `/export-bundle?mode=metadata|data`, POST `/import`,
POST `/index/retry`, GET/PUT `/content-storage`, POST `/content-storage/decrypt`
and its `/cancel`. They remain explicit dependencies; M13 creates no second
backup implementation. M14 collector snapshot recovery is a separate capability.
