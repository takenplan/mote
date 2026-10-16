# M13 Web account and management migration

Base: M08 `58944f00837c89bc1d302ecd7be7a568db4abe44`, including M07
`cd7a306cce0f6cd5fec3c9e91e6dee0761352115` and the public contract PR135.
M11 and M12 are still in progress; final composition and checks are separate gates.

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
