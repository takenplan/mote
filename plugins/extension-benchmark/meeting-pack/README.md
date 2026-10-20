# ROUND3 independent meeting pack

This trial targets frozen host candidate `2879214` relative to original baseline
`2c78ca8`. The external implementation has two source components:

| Component ID | Explicit structured input | Output |
| --- | --- | --- |
| `meeting.notes.summary` | Meeting titles, decisions with declared owners, and integer-cent commitments | One traceable per-source Material with decision text and commitment total |
| `meeting.references.summary` | Reference titles and explicitly declared facts with optional integer-cent values | One traceable per-source Material with reference text and fact-value total |

The plugin reads and renders structured fields. It performs no semantic
classification or live model calls. The generated fixture text, values, and
expected results live in the test, outside the installed ZIP. This validates the
extension boundary and deterministic facts, without claiming model quality.

## Result

**Independent composition: FAIL.** The manifest declares notes then references;
the implementation independently composes references then notes. Both sides use
the same two IDs, versions, surfaces, and capabilities. The real package installs,
but `POST /api/plugin-instances/independent-order/check` returns HTTP **409** with
`{"error":"conflict"}`. No core repair or private adapter was attempted.

**Same-order control: PASS.** A separately labeled release changes only manifest
version/order and uses byte-identical JavaScript and ZIP bytes. It completes
install, check, enable, snapshot admission, task invocation, and persistent
Material readback for both components and both authenticated users.

The retained `trial.json` records the original 409 on candidate `2879214`.
After the Round 4 host repair, the integrated test requires HTTP 200 by default,
enables that independently composed instance, invokes both component IDs, and
checks their independently read Material bodies. Set
`MOTE_MEETING_REQUIRE_COMPOSITION=0` only when reproducing the original rejection
on the older candidate. The original same-order control runs in either mode.
`MOTE_MEETING_REPORT=/tmp/meeting-run.json` writes a separate run receipt;
normal tests never overwrite the frozen trial or release files. Set
`MOTE_BENCHMARK_CANDIDATE` to the actual tested commit when emitting a receipt.

## What was exercised

All product interactions use actual loopback HTTP and normal protocol headers.
The only transport substitution serves generated fixed GitHub release bytes;
package digest checking, ZIP expansion, Accounts, scoped adapters, real worker
subprocesses, task admission, publication, and persistence execute normally.

- Query `GET /api/plugins/host-capabilities` before any installation. It returns
  `createMotePlugin` and `createMemoryProvider`, with only `source` and `processor`
  registered for generic invocation. The other listed capabilities explicitly
  return `scoped_domain_unavailable`.
- Resolve/install real ZIPs through administrator APIs, poll installation through
  HTTP, and configure/check/enable current-user instances.
- Invoke each distinct source component through fixed snapshots and poll actual
  durable task results. Assert the plugin worker PID differs from the test PID.
- Traverse original pagination with page size 2 and three generated meeting
  originals. Recover original bytes using the documented JSON Buffer shape.
- Read `/api/materials`, `/api/materials/:id/read`, and
  `/api/materials/:id/members`; compare expected text and exact independent
  integer-cent totals. Every retained original is represented by a capture member
  with an original reference and checksum locator.
- Use colliding source, instance, external-item, batch, and Material identities
  under users A and B. Read A again after B writes to verify its contents remain
  A-owned. Reject A's access to B's snapshot with HTTP 404.
- Attempt an ungranted source through a real worker; the task becomes `blocked`.
- Disable A and observe new snapshot admission return HTTP 409; stop A and reject
  its old snapshot invocation. B's existing snapshot continues to publish after
  both operations.

## Capability discovery value and unavailable paths

The capability endpoint provided useful pre-install information without a
package, instance, check, or worker. It immediately established that source work
had an admitted generic path and that generic engine/model invocation was absent.
It does not establish successful business execution or an external scheduler
contract; those still require their own executable tests.

The unchanged generated `apply(ctx)` module was included in a ZIP with a manifest
but was not rewritten as `createMotePlugin`. Installation succeeded; instance
check returned HTTP **502**, `{"error":"execution_unavailable"}`. Together with
the public authoring contract and absent generic engine registration, this is a
concrete native ABI availability failure. An actual native Harness-session
checksum tool and the full E04 lifecycle remain **NOT RUN**.

An authenticated attempt to register an extension through
`POST /api/plugin-triggers` returned HTTP **503**,
`{"error":"scope_unavailable"}`. The public authoring contract does not advertise
a generic durable scheduling hook. This is an unavailable extension-path probe;
no built-in scheduler or plugin-owned timer is substituted for the requested
external policy. Full E06 scheduling, restart, and semantic behavior remain
**NOT RUN**.

## Reproduction

From the frozen worktree, with existing built libraries and dependencies:

```sh
/opt/codex/runtimes/codex-primary-runtime/dependencies/node/bin/node --import tsx --test apps/server/test/extension-benchmark-meeting.test.ts
```

On a candidate expected to support independent composition:

```sh
MOTE_MEETING_REQUIRE_COMPOSITION=1 /opt/codex/runtimes/codex-primary-runtime/dependencies/node/bin/node --import tsx --test apps/server/test/extension-benchmark-meeting.test.ts
```

Real local workers were executed with the required sandbox escalation. No npm
installation, build, production edit, adapter registration, full check suite,
commit, or PR was performed. Plugin imports are only bundled relative modules
and `node:crypto`; private/core plugin imports are **zero**. The test imports only
the normal production composition root in addition to standard test/ZIP tools.

## Timing and scope

The first successful same-order publication was independently observed through
HTTP at **2026-10-19T18:56:33.236Z**, 4,978 ms after that test's start. This is the
readback observation time, not the exact publication commit time. Total
investigation/development elapsed was not reliably recorded and is `null`.
`trial.json` retains this first observation and the final run's ordered HTTP
operations, runtime observation time, capability discovery, and gate outcomes.

Source business behavior, ordinary disable/stop admission, and the stated
current-user isolation checks passed in the control. Independent list-order
composition failed. Cancellation, delayed late publication, actual process
restart, upgrades, uninstall, Memory, UI, live models, physical devices, and
broad regression gates were not executed. This is a focused probe and does not
satisfy any full benchmark case by itself.
