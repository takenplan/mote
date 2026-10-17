# Web Work → retained conversation history

Date: 2026-10-18 (Asia/Shanghai). Status: the generated adjacent UI journey passed.
This supplements the [original eight-group Web report](main-multiuser-web-integration-2026-10-17.md);
its original C3/F source attribution remains unchanged.

## Source and execution

The real run used production G `2333ed61677e15957d6fd97c0cdd760bfbf47dcc`
in `/tmp/mote-main-multiuser-security-20261017`, with a single new, frozen
[hidden UI runner](../../apps/web/test/multiuser-work-history-browser.cjs).
H `5dd501af05664f678cf92e2255ea9bd4717199c6` subsequently committed only that
198-line test file; it changes no production or fixture bytes.

| Input | SHA-256 |
| --- | --- |
| New adjacent runner | `1ca9584f0a3d0914e0690d62e2656324ea382a0aad22775ff266c7ef800023c6` |
| Unchanged original eight-group runner | `1a864ab114cc3be9d112580ca184acb73614e5193344164456355dd160cef33c` |
| Unchanged real wire-2 history fixture | `3027bab57604bc8b05921086f3370e6914e555e16f7ffe7773103d24ae9aa0b7` |
| Production sources and built assets, start/ready/end | `0bfc74a7fc7a3a4c854b221022b678d0ab6cf7de215c75c74b1e58b1242ca9a6` |
| Production Web index | `1e2161bd0bca8ce498106a2829241039ead8bac491279d2690c9b84387135c7f` |

The manifest covers server source, Web source/public/dist, and Shared/Agent
source/dist. Source HEAD, runner, fixture and original-runner guards all passed.
The production Web assets match the original accepted Web build.

```sh
MOTE_WEB_FIXTURE_NODE=/opt/homebrew/bin/node \
MOTE_WEB_FIXTURE_EXPECTED_HEAD=2333ed61677e15957d6fd97c0cdd760bfbf47dcc \
node_modules/.bin/electron apps/web/test/multiuser-work-history-browser.cjs
```

The actual command ran at G with the exact test bytes later committed in H.
The final process exited naturally with **0**, session `48933`, log
`/tmp/mote-web-work-history-G.log`. Generated preparation took **141.233 seconds**
for 22 actual Ask runs (A21/B1). The existing 660-second generated preparation
limit and each real run's 30-second limit remained unchanged; UI waits retained
their 30-second limits. Windows stayed hidden and could not acquire focus.

## Observed original user journeys

| State | Actual UI and HTTP result |
| --- | --- |
| Current A | Real Cookie login → Activity → Recently completed → original Work card → Results → actual saved `href` click. The same canonical conversation opens with latest20 and the real older page completes21 turns. Complete DTO/rendered prose and citations match; the inline citation reaches the declared `context:capture:` reader and its real POST returns200 with the authorized body. |
| Ordinary revision | The fixture publishes an actual new Material revision. Work remains completed with the saved historical link and no promoted current evidence. Repeating the original Work link click opens the same21-turn history; the complete latest saved result/citation DTO matches its pre-revision value, all21 explicit historical-version notices appear, and full latest/older prose and citation controls remain. A fresh document reload preserves the stale history. |
| Stale citation boundary | Clicking that retained original locator issues the real context-reader POST and returns404. The original unavailable notice appears and no obsolete original body is disclosed. This preserves the existing strict-current read boundary; it does not grant historical original-read authority. |
| Source deletion | The fixture performs the actual owner HTTP DELETE. Work polling removes the saved link and the actual Work DTO has no artifacts. Opening the direct history shows the complete deletion notice, latest20 plus older21 records without result, old prose or citation controls, and no failed-answer/retry card. A full reload stays erased. |
| B positive | The existing avatar opens the account page; its original Switch account button performs real B Cookie login. A's old page retires. B's actual Work list/card/Results/`href` opens B's one-turn current conversation under the same conversation ID. Full B prose/citations and actual original reader POST200 remain positive; A prose never appears. Navigation, revision and erasure issue no model replay. |

This uses the production Work and Ask pages, owner authentication, actual Harness,
HTTP persistence and lifecycle transitions. It does not assemble an internal UI
view or substitute synthetic saved answers. The generated provider supplies the
external model responses. No production policy or source changed for this test.

The stale negative follows the [history ADR](../adr-evidence-history-retention.md):
retaining a citation locator does not make its obsolete original current.
`ContextReferenceDetail` uses `/api/context/read`; `AskEvidence.evidence` resolves
the saved Material revision and `material` keeps the current-revision check.
The test never switches to a raw endpoint to bypass that check.

## Earlier attempts and cleanup

Two earlier test-only failures remain recorded and are not product RED results:

1. Runner `b0c6da99…` incorrectly expected a stale locator to authorize current
   original reading. Current Work/history and original reader had passed; the
   real stale reader correctly refused the obsolete revision. The corrected
   runner explicitly asserts404, unavailable notice and no old body. Original
   log/receipt/screenshot: `/tmp/mote-web-work-history-G-attempt1.*`.
2. Runner `d3a311b1…` passed current, stale, deletion and reload, then omitted
   the existing Switch account button after the avatar opened the account page.
   The test helper now follows that actual two-step route. Original log/receipt/
   screenshot: `/tmp/mote-web-work-history-G-attempt2.*`. Its host exited0 and
   its windows, profile, process and three ports were removed.

The final generated host PID `29902` exited naturally0. Its private data directory
and browser profile were removed, all windows were destroyed, and ports 57209,
57222 and 57223 were closed. An independent post-run audit found all nine owned
runner/Electron/host PIDs and all nine ports across the three attempts absent.
The initial attempt has a separate cleanup audit; it is not relabelled as a pass.
Three final generated screenshots (stale history, deleted Work link and B
positive) were individually inspected and their hashes are in the receipt.

The [machine receipt](main-multiuser-web-work-history-2026-10-18.json) preserves
the exact final source/test hashes, results, earlier failures and cleanup audit.
The final raw receipt is `/tmp/mote-web-work-history-G-final.json`.

This report covers the additional generated hidden Web journey. Live models,
physical devices and personal captures were not used. Required repository-wide
gates, native checks and target-branch delivery are reported separately in the
[main integration report](main-multiuser-integration-2026-10-17.md).
