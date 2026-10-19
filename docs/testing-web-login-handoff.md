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
