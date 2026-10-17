# Main + multiuser Web integration — 2026-10-17

**PASS:** the six-state appearance matrix, ten account-lifecycle check groups,
the seven original multiuser browser groups and the added historical-answer
journey. All accepted executions used hidden real Web renderers, generated
accounts/data/providers and the production scoped application. Password login,
secure Cookie sessions, original UI controls, HTTP admissions, storage,
authorization, task execution and lifecycle retirement were real.

This is Web/server evidence. Required component gates, Desktop, Android,
independent review and target-branch delivery are recorded by their respective
integration lanes. No physical device, live model, personal capture or real
central configuration was used here. [Machine receipts](main-multiuser-web-integration-2026-10-17.json)
retain the exact source, commands, fixture hashes, observations and cleanup.

## Source and accepted executions

Web/server production source is C3
`6b4305bff5c7723562b88990395c6d87759cea95`, recorded tree
`4399f1ad15a5874f02bd8036de48220791171594`. It combines main
`2c2627621e2598332ae8169845bc7343be7ed63e` and multiuser integration
`b26e797b5427fd089fa4fc4fa8b0cc45909f24af` through the integration candidate.
See the [integration decision](../adr-multiuser-main-integration.md).

Two test-only working-tree changes were frozen before the accepted runs:

| Input | SHA256 |
| --- | --- |
| Integrated renderer runner | `1a864ab114cc3be9d112580ca184acb73614e5193344164456355dd160cef33c` |
| Real wire-2 history fixture | `3027bab57604bc8b05921086f3370e6914e555e16f7ffe7773103d24ae9aa0b7` |
| Appearance renderer runner | `434b78f61d297fa4ae35d91817d492bbdafbeb84b253618409c30c00225b3842` |
| Account renderer runner | `06495ba05944763cb516543e2292ac0789e2c0e056c86fbfbb950ac3a6588c53` |

A fresh `npm run build --workspace @mote/web` on C2
`669f210baae0b464f8719f204b4c3f16ec7cb3ec` exited **0**. C2→C3 changed only
server historical-erasure SQL and its regression test; Web/shared/build inputs
were unchanged. The accepted built index SHA256 is
`1e2161bd0bca8ce498106a2829241039ead8bac491279d2690c9b84387135c7f`.

The final seven groups and history ran concurrently in separate isolated
processes, using the same final runner hash. Both exited **0**, including their
HEAD and production/build manifest guards. Every recorded host start/ready
manifest agrees with the final manifest
`2352672582f0cdf3c3d690f6a366eb89dd199e82e4150b6bc8e764c821e27f62`.
The manifest covers Web, server, shared and agent runtime inputs; independent
Desktop changes are outside this Web input set. A later test/docs commit does
not turn earlier partial executions into final passes.

| Execution | Result | Log |
| --- | --- | --- |
| Appearance, six preference/OS pairs | Exit 0 | `/tmp/mote-integration-theme-C3.log` |
| Account lifecycle, ten stored check groups | Exit 0 | `/tmp/mote-integration-account-C3.log` |
| Final integrated Models→Operations, seven groups | Exit 0 | `/tmp/mote-integration-browser-C3-first7-final.log` |
| Final integrated History, independent fresh host | Exit 0 | `/tmp/mote-integration-browser-C3-history-r3.log` |

## Actual journeys

| Group | Verified original entry and lifecycle |
| --- | --- |
| Appearance | All Light/Dark/Auto × OS-light/dark pairs; module held before application execution under production CSP; actual canvas/background/meta color on first paint; reload and live media changes; actual unsaved Login dialog and Notes field identity, focus and selection; cross-tab changes; A→B session change retires the private draft while retaining the device preference; phone overflow and increased-contrast roles; zero model/query calls. |
| Accounts | Real secure HttpOnly Cookie login; same-ID A/B notes; A draft survives reload and same-owner credential rotation; account change clears the private tree and fences a held successful A body; a stale visible approval cannot borrow B's Cookie even after the old tab loses its storage notification; actual submission reaches only B's Ingress/SQLite; failed login, credential revocation and account disable leave no private old tree; administrator sees account metadata without A/B content. |
| Models | Original saved catalog consumes both pages; real saved-profile probe sends three generated requests with no private archive input; copy with credentials/headers/extra body retains their flags and unchecked copy omits them; A has three profiles and B one; held A catalog retires before B's positive catalog and cannot refill B after release. |
| File/voice settings | Original Save stores 42 minutes and a source override for A. A subsequent successful Save of 43 is held across an independent B login; B remains at 120 with no inherited override before and after release. An actual A-authorized read confirms the committed 43 belongs to A. |
| Memory | Full Library supporting-reference reader and reload; selected integration reaches a real committed terminal with legitimate zero new memories; explicit personal-memory v5 range extraction produces one; original raw record→full evidence dialog→source-selected extraction completes; B opens its own supporting context without A's body. |
| Agent | Startup preview invokes no provider; original trace setting and five actual Ask runs per owner; retained-event next-page controls reach the actual material-read body, two pages per owner; no other-owner marker appears; held A response is retired across B login and cannot enter B's UI or history. |
| Images | Original A OCR and derived result; recompute cancellation; actual 95-byte PNG download and digest; same-ID B runs its own pixels-only recipe without A's OCR. |
| Files | Original 48-byte WAV download/transcript; actual delete admission with all successful ACKs dropped; reload preserves the same pending operation despite parent404 and replay reaches the real deletion terminal; B's same-ID transcript/download remain positive; a held old-generation DELETE receives 409 after replacement and cannot remove the new original. |
| Operations/KEEP | Original public operation detail maps its declared step to the real task; original failed-step retries succeed on the same A/B task IDs; A cancellation records a real 200 and cancelled state while B starts in its independent queue; A/B each retain one unknown external result; B's rendered settings have no administrator index controls. Index rebuild is really admitted behind a shared resource lock, all ACKs are dropped, reload preserves intent, local clear causes zero task/index mutations and leaves the original waiting receipt unchanged, the admitted job then succeeds, and a new explicit operation succeeds with a different ID. |
| History | Actual scoped Ask latest20 + older1 of 21 turns; complete raw DTO answer and complete rendered prose both match, with a real citation button and excerpt; A and B citation clicks follow the declared `context:capture:` route and show their authorized original context. Ordinary revision retains historical prose/citations with the explicit notice and retires the copied older page; stale reload remains stale. A genuine successful older-page response is held and inspected before source deletion. Deletion shows the explicit notice without a result, never a failed-answer/retry card; the held request is cancelled and cannot restore old prose. New older-page read and reload remain erased; B's same-ID one-turn history and citation reader remain current and positive. |

The generated cancellation page supplies `true` only for the exact known browser
confirmation text; an unknown prompt fails. The original button, current-session
POST, 200 receipt and actual task state are checked. This validates the browser
confirmation boundary and does not claim a native system-dialog interaction.
“Retry” above means the original failed-task `retry-step` control, not a separate
invented recheck endpoint.

## Corrections and retained failed evidence

The combined page exposed a real long-username overflow: at 1360px the Models
document measured 1361px. Applying the existing avatar's three containment
properties reduced it to the normal 1345px content width with its 15px vertical
scrollbar. The minimal committed fix clips/ellipsizes that existing control and
retains the complete username in its title and accessible name. Strict viewport
assertions were kept; no 1px tolerance was added. The deleted-without-result
Conversations branch also has a durable regression and the real history journey
above.

The server lane independently reproduced repeated historical proof growth and
an omitted delegation-workspace erase field through real model-tool runs. C3
retains complete-JSON exact proof deduplication and clears the workspace with
the other already-erased run fields. This Web receipt verifies their relevant
consumer states; it does not replace the server's privacy/SQL regression.

Test-only corrections retain the original assertions: select the actual Library
record class; wait for the evidence dialog's declared action before branching;
page to an actual recorded tool-result body instead of finding a tool name in a
system schema; and map operation/step IDs through real public detail responses.
The fixture also sends a JSON Content-Type only when it actually sends a body.
The earlier empty-body DELETE was correctly rejected by Fastify and is not a
production deletion failure.

Two citation expectation errors are preserved separately. Initial C2/old-C3
runs incorrectly compared the raw `[UUID]` wire marker with rendered text,
although the existing Markdown renderer displays a Source button. The first
follow-up then expected a raw `capture:` route while the existing ScopedAsk
entry explicitly wraps it as `context:capture:`. Its actual context body was
already correct. The final test checks the full raw DTO, full visible prose,
exact declared route and actual authorized reader content. Logs are
`/tmp/mote-integration-browser-C2.log`,
`/tmp/mote-integration-browser-C3.log` and
`/tmp/mote-integration-browser-C3-r2.log`; none is counted as a final passing run.

Final history setup generated 22 actual runs in **200.355 seconds** under
parallel regression load. Its generated-only total setup bound is 22 × the
existing 30-second per-run guard, **660 seconds**; the per-run guard and UI
assertion deadlines are unchanged. The earlier generic 60-second total setup
bound was insufficient even after the production proof correction. The initial
PID83007 preparation exited by SIGTERM before its then-late signal handler was
registered. After verifying that exact PID absent, its unique PID-prefixed
generated directory was removed. Its failed cleanup remains recorded in
`/tmp/mote-web-history-setup-timeout-cleanup.json` and is not relabelled as a
natural-exit pass.

## Resource closure and repeat commands

The accepted executions closed **ten generated host processes naturally**:
eight integrated hosts, one account host and the appearance host whose shutdown
exit is asserted by its runner. Independent readback confirms the nine recorded
host PIDs absent and all **15 recorded loopback ports** closed. All hidden
windows and owned generated browser/host data were closed/removed. Generated
Light/phone-dark, Models, policy, Memory, image, history and administrator
screenshots were inspected for the retained hierarchy and layout.

After installing matching dependencies and building the workspace libraries,
select the installed Node runtime compatible with the fixture dependencies:

```sh
export MOTE_WEB_FIXTURE_NODE=/opt/homebrew/bin/node
export MOTE_WEB_FIXTURE_EXPECTED_HEAD=6b4305bff5c7723562b88990395c6d87759cea95
npm run build --workspace @mote/web
node_modules/.bin/electron scripts/test-appearance-ui.cjs
node_modules/.bin/electron apps/web/test/multiuser-browser.cjs
node_modules/.bin/electron apps/web/test/multiuser-integrated-browser.cjs models policy memories agent images files operations
node_modules/.bin/electron apps/web/test/multiuser-integrated-browser.cjs history
```

The last two commands may run concurrently with their isolated hosts; their
individual group receipts and stdout identify the actual selected groups.
Use the exact frozen checkout and test hashes above when reproducing this
receipt. Required broader gates remain governed by the
[affected-component protocol](../development.md#pr-check-scope).
