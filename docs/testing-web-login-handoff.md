# Web ticket evidence handoff regression

The R3 source investigation confirmed separate startup paths: a fresh document
exchanges its ticket before App initializes its evidence state; an already
mounted App handles hashchange, clears the old private state, and must explicitly
restore the authenticated route. Original A no-detail snapshots and manual-reload
recovery remain distinct evidence. The corrected Client lifecycle establishes
that A used same-document navigation while B's fresh document succeeded first
try. No reload is an accepted user step.

`apps/web/test/login-evidence-handoff-browser.cjs` is a prepared hidden-browser
regression through built production main, the existing real scoped generated
host, Cookie ticket exchange, AuthSelf and the owner context reader. It does not
configure or call a model. Temporary accounts and records have the same public
capture ID with distinct A/B content. It does not inspect R3 credentials, live
storage, running processes or personal screenshots. The test runner never prints
evaluated ticket URLs, credentials or auth response bodies.

| Transition | Required observation |
| --- | --- |
| Fresh document with A ticket + typed context | Initial detail opens A original without reload; ticket disappears. |
| Existing A document, same-page A ticket | Old private UI disappears while exchange is held; initial authenticated detail returns automatically in that same document. |
| Held A exchange, newer B ticket | A cannot publish; same-ID detail contains only authenticated B content. |
| Held exchange, navigate elsewhere | After the real old authentication chain settles and React commits, the exact current route remains signed-out with no private detail. |
| Held exchange, away then return to identical cleaned hash | The monotonic navigation intent still retires the older attempt; terminal-state checks cannot be hidden by starting another auth. |
| Held exchange, synthetic external StorageEvent | The storage-event consumer retires the old attempt through its terminal state; this does not claim real cross-tab Cookie or Web Locks ordering. |
| Held A ticket, manual B login | The original public login form completes B authentication without restoring A evidence. |
| Well-formed nonexistent ticket | Old private UI stays absent; consumed nonce stays absent; existing login entry remains available. |
| Replay of the previously consumed real ticket | Replay cannot adopt a connection or evidence after its real auth chain settles. |

All newly prepared scenarios are **UNRUN**. Source inspection and `git diff
--check` do not establish RED/GREEN. After the driver assigns resources, prepare
isolated dependencies under one matching Node ABI. This browser is outside the
`npm test` `test/*.test.ts` glob and must be explicitly scheduled. With
`MOTE_WEB_FIXTURE_EXPECTED_HEAD` set to the frozen candidate, prepare and run:

```sh
node apps/web/test/prepare-login-evidence-handoff.cjs
node_modules/.bin/electron apps/web/test/login-evidence-handoff-browser.cjs
```

The runner resolves Node on PATH, or accepts `MOTE_WEB_FIXTURE_NODE`. Set
`MOTE_WEB_FIXTURE_EXPECTED_HEAD` to the exact candidate and
`MOTE_WEB_HANDOFF_OUTPUT` to an evidence directory. The result distinguishes its
actual Web/scoped-host proof from the still separate original Desktop/IAB R3
reacceptance. Before any PR update, run the exact candidate's `check:affected`
plan and the existing login-handoff, Web-auth and typed-route tests under the
driver's resource window. No frozen PR or live physical source is modified by
preparing this follow-up.


## Test barrier follow-up to d6adec8f (prepared, UNRUN)

The 150 ms post-release waits were removed: a release acknowledgement does not
prove the browser consumed the response. A test-only pre-document observer calls
native `navigator.locks.request` with its original arguments and returns the
identical original Promise. It only attaches a terminal observer for the existing
local authentication lock. After that actual Promise settles, a MessageChannel
task drains the original authentication/publication reactions; a passive React
DevTools commit observer requires no pending root lanes or callback. Only then
do negative cases inspect the exact route, `data-session="signed-out"` (rather
than merely absence of ready), and absence of private detail. No replacement auth,
reload or longer sleep is a settlement barrier. Environments without local Web
Locks or observable React commits fail the bounded fixture instead of passing.
The observer reads no credential value and changes no production fence or blob.

The explicit preparation entry runs normal `npm run build:central`, clearing
only this checkout's four ignored shared/Agent/Server/Web output directories.
It requires clean frozen source before and after the build and records head,
tree, tracked-source digest, all four artifact manifests and Node runtime/ABI.
The browser verifies that binding before and after execution, and requires its
scoped-host Node runtime to match. `MOTE_WEB_HANDOFF_BUILD_RECEIPT` selects the
receipt path (default `.mote/evidence-handoff-build.json`). Dependencies and native
SQLite preparation remain separate driver allocations; neither observer nor
browser installs or rebuilds anything. The existing scoped fixture executes
candidate-bound TypeScript server source; building Server is not a claim of
executing its dist entry.

The same-cleaned-hash route ABA, original manual login and actual ticket replay
are now explicit prepared cases. Authentication A→B→A replacement, controlled
expiry, actual second-tab Cookie mutation/storage delivery/Web Locks ordering,
and original Desktop/IAB reacceptance remain **UNKNOWN / UNRUN**. Neither d6's
finite static review nor this child preparation is a runtime PASS.


## First 473 runtime outcomes and finite test preparation (UNRUN child)

The first exact nine-check run at 47390050 ended naturally with Web 615 cases:
613 passed and two failed, without skips/cancellations. Shared tests and release
integration were UNRUN. Those failures remain failures; this preparation does
not rerun or reclassify them as passed.

- The portable-import UI test requested export immediately after Ingress. Source
  inspection confirms Ingress admits asynchronous `memory.materials` and
  `ask.index-admit` work, Material publication admits further index work, and
  export rechecks exact owner-qualified data and execution metadata. The
  5c89e95f fixture observed the exporting owner's complete task pages until its
  Material task succeeded and all admitted tasks were terminal, before that
  owner's single export. That global terminal precondition was too broad for a
  legitimate future Memory window; the next section supersedes it. It does not retry `archive_changed`, disable work or weaken import
  lost-ACK, account-switch or cancellation assertions. The exact witness that
  changed in the original failed run remains UNKNOWN; a failure after this
  legitimate completed-fixture precondition still requires domain investigation.
- The recording UI test observed 24 files in the API while its retained first
  UI page could still contain 20 of an earlier 23-file set. Source uses independent
  polling and keyset cursors; cardinality alone does not identify the cursor's
  collection. The new barrier observes the UI resource's exact final ordered IDs
  and cursor, then flushes its React commit before clicking Next. Both the real
  final API page and the UI must still contain four remaining items, using that
  exact cursor. Previous-page, source/owner cursor scope, restart, pause, stop,
  disconnect, archive preservation and original-detail assertions remain.

The separate first explicit source-bound browser run completed its normal
Central build, then produced no browser business result or recorded JS phase.
Root's bounded stop released only its proven owned descendants. Its corrected
classification is `BOUNDED_BROWSER_HANG_NO_BUSINESS_RESULT`, not a natural case
failure or a main behavior result. The controller's original signal-exit record
and corrected review remain separate evidence.

The unbounded pre-first-load CDP sequence is a source-level hang candidate, not
an established runtime cause. This child initializes a neutral `about:blank`
frame before CDP; the ticket URL is still the first product document, with no
product reload or added user step. First-window creation, neutral frame, CDP
attach/enable/observer installation and product load now have bounded stages
using the existing 25-second fixture deadline. Progress contains fixed stage
enums and booleans only; failure metadata includes no URL, ticket, arbitrary DOM
or credential. No running first-run window or process was inspected or changed
by this preparation. All new setup/barriers, syntax/import/build checks and
runtime cases remain UNRUN pending the driver's finite delta review and slot.


## Causal fixture follow-up to 5c89e95f (prepared, UNRUN)

The driver's first 5c89e95f focused run completed both whole test files with 14
cases: 13 passed and the portable-import case failed at its new task precondition.
The recording journey passed. Material and index tasks had succeeded, while a
legal `memory.intake` task remained waiting with zero attempts, a future
`availableAt`, and `memory_window_pending` / `executionStarted: false`. The
precondition must not require this window to execute. This child still reads all
owner task pages and requires successful Material and index admission; the only
nonterminal exception is that exact unstarted future-window state. Every other
unclassified writer still prevents export. The single real export, its
`archive_changed` assertion, window policy, consumers and time budgets remain.
A later 409 still requires domain-owner investigation; this preparation neither
retries export nor establishes that its underlying race is fixed.

The separate source-bound 5c89e95f browser run exited naturally after 28.941 s.
Its ten setup stages completed through `product-document-loaded`; no result was
produced. Its first evidence-visible and authentication-settled operations were
not separately recorded, so the failed business phase remains UNKNOWN. This
child records `first-owner-evidence-visible` and `first-authentication-settled`
separately. Bounded failure snapshots contain session/actor/modal/marker/ref
comparison booleans, observer support/settled/drained/React-idle booleans and
fixed auth-outcome enums. HTTP diagnostics include only fixed endpoint enums and
status codes, capped at the latest 60 entries. Diagnostics issue no new auth,
route mutation or reload, and persist no URL, ticket, token, credential, DOM
text, reference value or arbitrary exception. Each diagnostic channel has a
one-second bound; business deadlines are unchanged.

Source inspection confirms a distinct fixture assumption: a raw ingress UUID is
not a public canonical citation after formal Material publication. The current
reader rejects raw evidence shadowed by a formal object; canonical identity
includes owner, Material revision and block. This child resolves its generated
single-note fixture through the real public Material catalog, Material read and
context read before minting a ticket. It keeps the identical raw public UUID in
A and B, checks its separate owner text through the raw public API, uses each
owner's genuine typed canonical citation for positive dialogs, and checks the
exact same A canonical citation under authenticated B returns context-read 404
without private text. Canonical A/B IDs correctly differ under the current
contract; no fake canonical IDs or internal database writes are introduced.
This is a source-confirmed contract correction, not a proven attribution of the
previous unclassified first business failure. Retention, formal processing,
production reader behavior and the real auth settlement observer are unchanged.

Only test/fixture/documentation files differ from 5c89e95f. All production blobs
remain identical to d6adec8f. This new child's installs, syntax/import checks,
application builds, focused tests, affected checks and explicit browser run are
**UNRUN**. The dry-run plan is scheduling evidence only. Original Desktop/IAB,
physical-device, live-model, expiry, true cross-tab and auth A→B→A checks retain
their separate UNKNOWN / UNRUN status. No frozen PR or live source was updated.


## Public locator contract follow-up to 43a64d01 (prepared, UNRUN child)

The driver's first 43a64d01 run completed isolated install/native preparation
and normal source-bound build. The whole Vault file passed 12 cases, including
real import, lost ACK, account B and cancelled picker behavior. Its separate
browser exited naturally before any window or ticket, at
`public-evidence-targets-ready`; only catalog 200 and Material-read 200 were
recorded. The failed helper assertion value was not recorded. These outcomes
remain distinct from a browser main/auth result.

The authored organizer currently creates a body text block and a metadata text
block. The public Material reader returns canonical `originalRefs` for all
records, plus `spans` (including member IDs and page ranges) and `sourceSpans`
(including canonical records). Therefore the previous one-ref assertion is not
part of that public contract. This child traverses complete catalog and Material
text pages. It binds a target only when the public span names the known generated
raw member, its text equals the known generated body, and its public sourceSpan
record matches that block, timestamp and a typed returned citation. Exactly one
such target is required; unrelated metadata refs are neither guessed nor chosen.
A/B retain the same raw UUID, current owner readback and the exact A citation's
B rejection. This corrects a source-confirmed contract assumption; it does not
retroactively identify the unrecorded assertion that failed at 43a64d01.

Locator progress contains fixed stage enums, structure counts and boolean
checks only. No citation, URI, body, URL, credential or assertion text is emitted.
The shared fixture locator now uses actual loopback public HTTP with the original
generated account credentials. The explicit `login-evidence-locator-smoke.cjs`
forks the same fresh port-0 host and invokes the locator once, then requests host
closure and records natural exit/profile cleanup. It writes only safe stages and
source identity, has no Electron or model calls, and cannot establish browser or
Desktop/IAB acceptance. It requires a clean exact head and external output:

```sh
MOTE_WEB_FIXTURE_EXPECTED_HEAD=<frozen-head> MOTE_WEB_LOCATOR_OUTPUT=<external-dir> node apps/web/test/login-evidence-locator-smoke.cjs
```

The already-passed 43 Vault source and 5c recording source are unchanged, as are
all d6 production blobs and other auth/route/settlement scenarios. This child's
runtime statuses are recorded externally after freezing; preparation alone is
UNRUN. A first smoke failure is retained without automatic repair or rerun.
