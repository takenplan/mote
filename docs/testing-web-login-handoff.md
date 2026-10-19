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
| Held exchange, navigate elsewhere | Late success adopts neither connection nor old evidence; current navigation remains. |
| Held exchange, external authentication change | Late success cannot restore retired private state. |
| Invalid/expired ticket | Old private UI stays absent; consumed nonce stays absent; existing login entry remains available. |

All newly prepared scenarios are **UNRUN**. Source inspection and `git diff
--check` do not establish RED/GREEN. After the driver assigns resources, prepare
isolated dependencies under one matching Node ABI, build Central, and run:

```sh
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
