# Finite M07 manual integration and human audit contract

This is a server-only consumer freeze. It reuses the existing M07 journals,
M02 canonical evidence and M04/M05 execution authority. It does not implement
the unfinished range/raw selection journey, a new provider/runtime or complete
automatic-source recipe settings. Context/model/plugin capabilities do not gain
access to retained human audit bodies.

## Selected current Memory integration

`POST /api/memory-integrations` takes this strict body:

```json
{
  "operationId": "generated-UUID",
  "recipe": { "id": "installed-integration-id", "version": "installed-version" },
  "inputs": [{ "id": "selected-memory-UUID", "version": 1, "fingerprint": "64-lowercase-hex" }]
}
```

Choose an available exact recipe from `GET /api/memory/recipes`'s `integrations`.
One to 50 unique current published, valid, unsuperseded Memory-layer cards are
accepted. These are Memory IDs, not raw capture/evidence/Material IDs. The owner
service resolves and rechecks their canonical dependencies and complete pins,
including after model lease hydration inside admission. Changed pin or unavailable recipe 409; foreign or no-longer-readable canonical
card 404. No owner field, model endpoint or execution grant is submitted.

The response is the existing M07 job receipt. `id` equals operationId; persisted
input advertises `phase:integrate` and `automatic:false` while present. Normal
`GET /api/memory/jobs/:id` and M07 pause/resume/retry/cancel controls apply. Store
the explicit body before POST and use the same ID/body after ACK loss. Reading
an existing receipt never readmits; a 404 allows only an explicit same-body
retry. Changed input under an existing ID 409. Zero new Memories can be successful.
Personal/Coding inputs retain separate existing batch domains. Opening or
integrating a card does not change global profile/defaults/automatic settings.

## Filtered stale owner audit

`GET /api/memory/audit?kind=stale` retains its prior unfiltered page/cursor shape.
Explicit original Memory filters use the same literal M07/source predicates
before LIMIT: query, layer, tier, after, before, deviceId, includeHistory and
asOf. Booleans are literal true/false URL values. Existing compatible source,
project and identity predicates in Memory's filter schema also remain validated.
`kind` is the audit category and is not an episodic/semantic Memory filter.
Malformed or contradictory filters 400. Filtered cursors are opaque and bind
complete query/deployment/owner; changed-query or foreign cursor 400. Old
unfiltered cursors are not converted into filtered authority.

Each item is `{id,version,kind:stale,usableAsMemory:false}`. Open the exact
retained body via `GET /api/memory/audit/:id?version=N`, which rechecks canonical
retention/provider/body proof. Cross-owner 404; missing/deleted canonical evidence
is not reconstructed. The as-of/history controls preserve original validity and
supersession intervals. A newer explicit owner correction depends on its saved
statement, not automatically on the replaced older model conclusion.

The audit path admits no model or task, exposes no body through current Memory
or context capabilities, and never feeds retained bodies to query/plugin tools.
The existing proposed-job audit remains separate and does not silently ignore
these stale-Memory filters. Clients retire cursor and selected body on filter or
credential changes; a late A result must not publish in B's page.

## Explicit range or one original

`GET /api/memory/selection` accepts `after`, `before` and `deviceId`, or a
single `captureId` (not both). Optional `recipes` is the JSON array of exact
installed recipe references from `/api/memory/recipes`. The range uses raw
context time and complete existing opaque browser pages, not Material update
time or the first visible page. The read returns:

```ts
{
  status: 'ready' | 'waiting' | 'empty',
  recipes: Array<{id: string, version: string}>,
  captureCount: number,
  materialRevisions: Record<string, string>,
  evidencePins: Array<{id: string, hash: string}>
}
```

It projects existing canonical Material evidence in one repository transaction,
without admitting a task/model or granting additional tool access. Each selected
normalized block must have complete original membership inside the chosen raw
scope. Mixed blocks cannot be guessed into a narrower scope. Each selected
recipe must have canonical evidence covering the complete chosen originals;
unready canonical dependencies produce `waiting`, never a silently partial
success. An empty raw scope produces `empty`.

Submit an explicit ready result to the existing `POST /api/memory/jobs` using
`operationId`, `materialIds: Object.keys(materialRevisions)`, the complete
`materialRevisions`, `evidencePins`, exact `recipes`, and the existing optional
M04 `modelReference`/`modelOverride`. Do not send raw capture IDs as normalized
Memory evidence IDs. Selected-pin requests are extraction-only. The service
filters every recipe plan to those exact normalized IDs and validates their
hashes, canonical revisions and authority again after awaited lease hydration,
inside admission before writing any job/child. Foreign, changed, incomplete or
unsupported pins are rejected; existing whole-Material admission is unchanged.

The original Web range/raw buttons persist only command identity and exact
ID/hash/model references before POST. They use the same operation/body after
lost ACK or React remount, including when a shell poll advances a rolling time
window. Explicit user changes to range, recipes, model or source are a new
selection. The retained metadata contains no original/Memory body, secret or
execution grant. A retired page cannot send a private POST after its selection
preflight completes. Existing M07 job controls/publication and per-recipe
independent exact bindings remain authoritative; defaults and automatic settings
are not changed by a manual run.
