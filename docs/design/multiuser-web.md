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
| Formal detail / citation / attribution | `/materials/:id`, revisions/read/members/context; optional descriptor/source-view/index retry | M02 exact same material read/revision/members/context; M08 canonical context | Core routes available. Source-view/presentation/index-retry do not exist in589 scoped host: optional presentation must use established generic body fallback, retry must not claim unavailable index work. Explicit Memory material-source anchor support needs M07/M08 coordination. |
| Raw records / evidence / albums / sessions / image OCR | `/capture-browser*`, image/ocr; capture delete | M02 `/captures`, `/captures/:id`, delete; M03 original tickets/content; M08 segments | OPEN: text/current capture consumer can adapt; before-LIMIT source/app/privacy/OCR filters, albums/sessions grouping, original image/thumbnail/OCR projection are genuine missing scoped adapters (M02/M03/M06). Do not silently drop filters or reconstruct canonical refs. |
| Sources metadata/history/context | `/sources`, `/source-items`, history/context | M02 same owned endpoints | Available normal metadata contracts; actual renderer compatibility pending. |
| External source settings / OAuth / recording connector | `/connectors/status`, vendor paths, old sync/delete | M10 `/connectors` per-instance config/revision, `/start`, `/sync`, `/disconnect`, `/operations` | OPEN M13 consumer adaptation to fixed per-user connection IDs + CAS; vendor-specific response/view compatibility requires M10 domain contract. No alias may infer another account. |
| External MCP discovery/import | `/connectors/mcp/discover`, `/import` | M11 strict discover/import, user mcpConnections domain | M11 final composed; owned preparation/CAS and same-ID draft retirement pass real backend/component tests. IAB connection/source save passed. Actual renderer discovery/import success remains OPEN; contract `/tmp/mote-m11-web-contract.md`. |
| Web reference import | PUT `/sources/:id/items` | M03 explicit device/source registration + POST ingress items/batch receipt | Implemented5b042c4b; actual M03 metadata/retry/history/A-B tests and IAB save/switch passed. Identity-corrupted actual ACK RED51101a26 → strict c1b6f159 GREEN; no URI is fetched. |
| Notes and chat attachments | `/sources`, `/file-sync/v1/uploads`, parts/commit | M03 ingress devices/sources/uploads/parts/commit with actual file revision/receipt | Implemented b64afe07 transport adapter using original chunk algorithm, exact user/deployment/source/batch/hash/byte receipt validation. Actual HTTP byte read/retry/isolation and old upload characterization pass; renderer attachment increment pending. Text notes already actual Ingress3. |
| Imports / confirmation / local upload queue | `/imports*`, `/import-uploads*`, `/import-source-packs` | M03 ingress upload + M06 `/processing`, originals/artifacts/derivations, M05 operations | OPEN. Old ImportJob/instruction/confirmation/resume response shape is absent. Need M06 read/command contract mapping before thin adapter; do not invent confirmation policy or mount old ImportManager. |
| Files / audio / review / speakers / export | `/files*`, `/archived-files*` | M03 original content + M06 typed processing artifacts | OPEN genuine missing read/review/export projections (M06). No fake empty file list or dropped review actions. |
| Processing/activity | `/processing` workflow list, `/work-activity`, `/operations` | M05 actual `/operations`; M06 processing configuration/submission | Operation component reused; old workflow WorkActivity aggregate and processing-list shape remain OPEN, not interchangeable contracts. |
| Ask/conversations/query progress | `/conversations*`, `/query-runs*`, `/query`, work activity | M08 same conversation/run routes with strict Ask input; canonical evidence reader | Existing consumer largely same; removed per-request global model override per M04. Actual IAB+real M08/Harness+generated SSE I/O/material tools/conversation/citation/refresh passed. A held provider→B positive→releaseA passed. Per-request model controls and WorkActivity projection remain OPEN. |
| Insights/history/report | `/insights`, `/insight-runs`, `/skills`, artifacts | M08 actual insight routes/artifacts; fixed shared skill engine | Actual `/skills` uses bundled catalog; actual missing run scope RED06564f97→3529e18b. IAB report iframe/text/citation/history refresh passed. Per-request model controls remain OPEN. |
| Memory list/correction/delete | `/memories*`, `/memory-jobs*` | M07 memories same; `/memory/jobs*`, `/memory/recipes`, `/memory` view | OPEN M13 rename/shape adaptation with M07 schema; use real provider facade, no raw store body. |
| Memory settings/recipes/bindings/integration | `/memory-settings`, `/memory-recipe-settings`, `/memory-spaces*`, `/memory-recipes` | M04 memory domain, M07 `/memory` control, binding prepare/activate/cancel, M09 plugin snapshots | OPEN older per-source recipe/budget/settings response shapes need M07 mapping; never restore active authority from local cached draft. |
| Plugins / personal instances / admin package install | `/plugins`, instances, resolve/install/uninstall | M09 same package and instance endpoints but strict expectedRevision/user snapshots; administrator package mutation | OPEN response/CAS and admin entry compatibility; current personal model editor must not hand global profile IDs to user instances. |
| Agent inspector / startup/context trace | `/agent-view/*`, `/context/*` | M08 scoped catalog/read/search/retrieve/bundle/status; startup/runs/events availability must be checked | OPEN actual consumer audit; missing trace/startup projections need M08 contract, not synthetic runs. |
| Todos / calendar action approvals | `/todos*`, `/actions*`, `/devices`, native calendar bridge | M12 final scoped Todos/Actions + M03 device metadata | OPEN M12 implementation and final exact SHA. Must test an already-open review through A->B/revoke/disable and original target/hash/epoch fences. |
| Storage/encryption/backup/index | `/content-storage*`, `/vault*`, `/storage-statistics`, backup/restore | No equivalent scoped management surface in589 | OPEN genuine backend capability gap, owner M02/M03 + final integration scope. Admin identity does not grant private backup access. |
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
