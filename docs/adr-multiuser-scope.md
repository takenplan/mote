# ADR: Multi-user scope and host contracts

Status: adopted for the multi-user implementation, 2026-10-15. M00 establishes
the foundation; the remaining modules are planned, not delivered by this ADR.

## Decision and provenance

Mote will support a small number of invited users on one self-hosted deployment,
using usernames and passwords. Each account has one private archive. SQLite,
services, installed code and a single execution engine are shared; private
authorization, configuration, credentials, data and running work are not.

The owner explicitly requested same-deployment multi-user support, username and
password login, an MVP without compatibility adapters, and strong extensibility
and plugin support. The discussion
`<internal-task>` (internal discussion reference redacted)
then recommended the coherent choices below. That discussion contains no
subsequent user message approving each choice individually. The later M00
implementation request authorizes adopting that recommendation as the project
basis; this ADR records that adoption, not an invented earlier item-by-item vote.
The [module plan](design/multiuser-modules.md) records implementation boundaries,
dependencies and acceptance requirements.

During M00 implementation the owner explicitly confirmed the temporary shutdown
of unfinished private production capabilities and the limits of old algorithm
fixtures. The old composition may be imported only by tests; production startup
or configuration must not select it or expose a test-mode authorization bypass.
Each later module must identify the real production capabilities it restores and
their acceptance checks. Final joint testing must exercise the complete real
composition, not this foundation-only shell.

| Decision area | Adopted MVP boundary |
| --- | --- |
| Accounts | Administrators create, disable and reset invited accounts; no public registration, email recovery or commercial billing. |
| Ownership | One account owns one private archive, including sources, originals, Material, Memory, conversations and connector authorization. No team sharing or multiple spaces per account. |
| Privacy | Instance administration manages accounts, deployment and resources. It does not grant an API for impersonating a user or browsing private data. The deployment operator can access server plaintext; there is no end-to-end encryption promise. |
| Clients | One active account and Central node per client. Logout/switch pauses collection and upload, retains the old queue and binds it to its original stable deployment/account identity. Relogin to that account may resume it. A new account explicitly starts its own collection. Web logout does not cancel already authorized Central work. |
| Models | Administrators publish shared model references; users may configure personal model connections. Shared secrets remain private, and a user cannot combine them with an arbitrary endpoint. Preserve accounting, pause, cancellation and explicit failure without silent fallback. Do not add daily cost quotas. |
| Extensions | Administrators install trusted package releases; users independently configure and enable instances. Host-provided capabilities carry the user boundary. Ordinary upload, sync and processing remain target capabilities; Central shell and arbitrary host-path import are initially administrator-only. Trusted plugin workers are not a malicious-code sandbox. |
| Storage and recovery | Shared SQLite and one execution engine preserve transactional authorization and publication. First release supports whole-instance backup/restore and explicitly scoped personal export; it does not promise restoring one user to a historical point without affecting others. |

## M00 executable boundary

The production server entry point uses
[`scope/app.ts`](../apps/server/src/scope/app.ts) and `buildScopedApp`. M00 offers
health and a deny fallback. It does not mount the old private routes or start the
old private workers. Missing identity, forged identity and unfinished private
capabilities fail closed. There is no default user, `owner` token fallback or
automatic assignment of old data to a new account.

The old single-owner composition is located only in
`apps/server/test/fixtures/legacy-app.ts`, outside the production build. Existing
algorithm fixtures import it explicitly. The production `src/app.ts` publicly
exports the scoped builder (`buildApp` aliases `buildScopedApp`); neither startup
nor configuration can select the old builder. There is no test-mode permission
bypass. Old fixture results do not establish multi-user isolation, and the old
builder cannot open an epoch-5 vault. Intermediate module branches retain the deny
boundary until each capability has its own isolation tests and explicit
production registration.

The host contracts are:

- [`scope/context.ts`](../apps/server/src/scope/context.ts):
  `UserContextAuthority.authenticate(credential)` invokes a trusted verifier and
  issues an immutable `UserContext`. Client-supplied IDs and structural lookalikes
  do not establish identity. The authority asserts host provenance and current
  validity; a context from another host or revoked authority is rejected.
- [`scope/services.ts`](../apps/server/src/scope/services.ts): instance services
  are distinct from `ScopedServices.forUser(context)`. A user service cannot be
  obtained without an accepted host context. Registration declares service scope;
  private operations do not reach a global service through a missing-context
  fallback.
- `registerUserRoute` is the explicit private HTTP entry point. Authentication
  precedes the handler, and the handler receives the host context. A user ID in a
  request body, route parameter, model tool argument or background payload cannot
  replace that context. M01 supplies production credential verification; it does
  not bypass this boundary.
- [`scope/lifecycle.ts`](../apps/server/src/scope/lifecycle.ts): each registered
  private domain supplies `exportUser`, `deleteUser` and `restoreUser`. M16
  orchestrates these domain contracts; M00 does not implement their domain data
  transformations or declare a complete personal archive format. A separate
  host-verified `LifecycleContext` binds deployment, account, domain, operation
  and purpose. `forLifecycle` exposes only that lifecycle action, permitting
  cleanup after account disable without restoring private service access. M16
  supplies durable grant validation and reconciliation.
- The scope inventory and architecture check classify private tables, APIs,
  tasks, directories and extensions. Existing single-user surfaces are explicitly
  quarantined. A declaration alone does not authorize mounting legacy behavior.
  New surfaces need a declared owner module and scope before acceptance.

The [module plan](design/multiuser-modules.md#domain-lifecycle-contract) defines
what subsequent domain implementations must guarantee. Missing implementations
block the corresponding capability instead of reporting a successful empty
export, successful deletion or successful restore.

## New baseline and write admission

| Contract | Multi-user baseline | M00 responsibility | Later implementation |
| --- | --- | --- | --- |
| Central storage | Epoch **5**, in `scope_meta.epoch` and SQLite `user_version` | Accept a new empty vault; reject an old or inconsistent format before mutation. | M02 and later domains install their new scoped structures. |
| Wire | **2** | Declare the new authenticated scope baseline and reject old private access. | M01 and client modules implement authenticated journeys and consumers. |
| Collector Ingress | **3** | Reserve the new ownership contract; do not accept Ingress 2 as if it carried an account. | M03 implements the new ingress and receipt behavior. |
| Portable archive | **3** | Reserve the new ownership/export contract; do not label the old archive reader/writer as version 3. | M16 implements and validates scoped import/export. |
| Desktop local storage | **3** for now | No automatic queue conversion or reassignment. Old account-unbound queues cannot be opened for upload through the new service. | M14 decides and implements its account-bound format and startup gate. |
| Android local storage | **3** for now | Same account-unbound queue restriction. | M15 decides and implements its account-bound format and startup gate. |

These are independent contracts, not product versions. Changing a constant does
not establish the implementation or validation of the associated client, ingress
or archive journey. M00's disabled capabilities must not be advertised as working
version-3 ingress or portable archive support.

Admission checks precede schema installation, journal/WAL creation, directory
creation, configuration normalization, background startup and any other write to
an existing unsupported vault. Failure preserves its files and directory bytes;
it neither migrates nor resets it. Use a separate new empty directory for this
baseline. The operator may retain and handle old backups with their matching
binary, but M00 does not operate on an existing deployment or real user data.

## Supersession

| Disposition | Decision and affected assumptions |
| --- | --- |
| KEEP | Immutable originals, stable receipts, exact source/version and dependency identity, privacy grants, read-only query evidence tools, deletion and retention remain domain guarantees. |
| KEEP | Reuse ConfigService validation/revisions and prepare/publish/rollback, ExecutionEngine leases/checkpoints/cancel/commit fences, client queue recovery, Cordis registration/lifecycle and the existing plugin capability contracts. |
| KEEP | Memory retains one publication coordinator per private space, independent review, exact pinned provider versions, explicit external-result uncertainty and no SQL-text fallback for a missing external authority. |
| KEEP | No keyword-based semantic routing, no silent model fallback and no new daily business-operation budget. Generated fixtures remain the automatic-test source. |
| CHANGE | Single-owner global service access becomes explicitly registered instance or user access. Durable private work and every private lookup carry host-established user identity. Shared IDs, FTS candidates, caches, locators, namespaces and unique keys must respect that boundary. |
| CHANGE | Instance administration and private archive authorization are separate. Being an administrator does not grant cross-user private data access through ordinary or management APIs. |
| CHANGE | One private YAML/configuration assumption splits into instance and user ownership through ConfigService in M04; do not introduce a second settings framework. |
| CHANGE | Queue identity must include stable deployment and account identity, rather than URL alone or a rotating credential hash. M14/M15 own the eventual local storage baseline changes. |
| CHANGE | Central epoch 4, wire 1, Ingress 2 and portable archive 2 are superseded for the new multi-user production path by the baseline above. Current client local format 3 is not silently bumped by M00. |
| REMOVE | Global owner credentials as ordinary user authentication; implicit/default owner selection, accepting client-chosen owner IDs, old-data ownership backfills, dual writes and automatic old-format migration. |
| REMOVE | Production mounting of unfinished single-owner private routes, timers or background resumers while their isolation is incomplete. Their failure tests cannot be made green by broad skips or a fake default context. |
| EXCEPTION | The isolated old builder is test-only, explicitly imported from `test/fixtures/legacy-app.ts`, excluded from the production build and fenced from epoch-5 storage. Its green tests are not new-baseline acceptance evidence; no production selection or test-mode authorization bypass is allowed. |
| EXCEPTION | Trusted deployment operators and trusted installed plugin code can reach server plaintext. Capability registration is an application isolation mechanism, not OS-level sandboxing or protection against a malicious operator. |
| EXCEPTION | M01 may introduce password-attempt protection for login. This is a narrow authentication policy change and must not reinstate general HTTP, model-call or daily cost quotas. Its exact behavior and tests belong to M01. |
| EXCEPTION | Whole-instance backup/restore remains the initial recovery unit. Domain-level export/restore interfaces enable future composition but do not promise per-user point-in-time recovery. |
| UNKNOWN | Actual device behavior, real providers/models, external physical erasure and deployment/CI availability require separate evidence. M00 fixture tests do not prove them. |
| UNKNOWN | M14/M15's final account-bound local format, and M16's portable archive payload and personal export coverage, remain downstream implementation decisions within this boundary. |

This supersedes the single-owner production assumptions in the
[MVP baseline](adr-mvp-baseline.md), [client login](client-login-unification.md),
[configuration ownership](configuration-ownership.md),
[execution engine](execution-engine.md) and
[plugin center](plugin-center.md) only to the extent listed above. Those pages
still describe the delivered pre-multi-user domain behavior until their owner
modules replace it; they do not authorize bypassing M00's production gate.
Historical validation records retain their original baseline and results.
