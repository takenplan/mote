# Source development startup recovery

Date: 2026-10-23. Stage: **integration-verified** for the source launcher,
authenticated configuration/connector consumers and orderly shutdown described
below. Complete affected-candidate checks remain pending.

## Scope and independent plan approval

The owner explicitly requested stopping the background Dev service and
discarding all local source changes in the original project directory. The
directory was reset to `origin/main` at
`4aa572d10365b525186ac14f3f5fdf7826f2d0f0`, then cleaned with `git clean -fd`.
The 1,214 previously modified/deleted/untracked paths were replaced or removed;
the resulting source checkout was clean. Ignored private profiles, account
storage, backups and installed releases were retained. No configuration field
was removed to accommodate the retired source composition.

Plan `dev-server-source-startup-repair-v1`, SHA-256
`d2c7eb9acbd16e955869ca34d8aea3746748ffe49acf78253459e1486390ff69`,
received independent **APPROVE** from `startup_plan_review` using
**gpt-6.1-sol / medium**, before these product-code changes. Approval is bound
to the exact base above, branch `codex/dev-server-startup-repair`, one
implementation/integration owner and the following scope:

- KEEP: source versus installed-release responsibilities, dependency/build/
  bootstrap/health/shutdown ordering, strict schemas, account/password/privacy
  settings and every existing launcher assertion and timeout.
- CHANGE: an advisory source-commit/clean-or-modified launch snapshot; additive
  source-identity fixtures and authenticated configuration/connector assertions
  on first boot and restart; development guidance.
- REMOVE: ambiguity about the built source revision and the launcher regression's
  health-only gap for lazy account configuration loading.
- EXCEPTION: the owner authorized the directory reset and actual private Dev
  startup verification, reported separately from generated fixtures.
- UNKNOWN: full affected-candidate and GitHub checks are separate obligations;
  source archives or failed Git probes report unknown identity and still start.

The banner emits only validated hexadecimal commits, fixed states and fixed
prose. Git probes use the sanitized build environment, optional Git locks disabled,
ignored stderr, bounded output and short timeouts. They do not expose branch or
file names, impose dirty-checkout restrictions, rewrite configuration, or certify
that source files remain unchanged after the launch snapshot.

## Executed focused checks

Environment: macOS arm64, Node 26.11.1, npm 11.20.0.

| Check | Result |
| --- | --- |
| `node --test scripts/release/dev-server.test.mjs` | 2/2 passed in approximately 14.75 seconds; identity fixture approximately 0.11 seconds and the complete launcher case approximately 14.52 seconds. |
| Driver-backed `startup.test.ts` + `config.test.ts` | All 26 tests passed; environment and shared/agent builds passed. Functional test task approximately 17.70 seconds; no budget overruns. |
| Driver receipt | Run `b2b85b84-043e-4b34-9ec6-1068e1fff697`; no reused evidence. The working input was subsequently committed as `358a2a8b90ad061fd92a7ee442b11e22e4a7af41`. |
| Syntax and whitespace | `node --check` for both changed JavaScript modules and `git diff --check` passed. |
| Full affected dry-run | Inspected; the root/release script paths conservatively select all workspaces and Android (38 tasks). That full plan was not executed for this focused delivery. |

Generated Git fixtures cover clean, tracked-modified, untracked-modified, unborn
HEAD, absent Git executable and a source archive inside a parent repository.
The complete existing real launcher case retains its actual compiled Server and
all original authentication, password, restart, port/build rejection, profile,
PID, storage and cleanup assertions. Its already-built npm substitutions remain
unchanged. New authenticated `/api/connectors` and `/api/configuration` requests
must return 200 on first boot and after restart; the perception configuration
must load with external-image and query-image permissions disabled. A successful
health response alone no longer satisfies that regression.

## Separate actual source-entry verification

After reset, the original directory's unmodified `dev-server.mjs` installed the
changed dependencies and built libraries, Server and Web successfully. This
confirmed the old directory composition caused the earlier schema mismatch.
The real authenticated Lark connection page loaded without `config_invalid`.

The committed implementation at
`358a2a8b90ad061fd92a7ee442b11e22e4a7af41` was then run again through the exact
`node scripts/dev-server.mjs` entry in that directory. The log identified
`358a2a8b90ad (clean)`, reused unchanged dependencies, rebuilt all normal
components, preserved accounts, reached Mote 0.0.91 readiness on port 47842 and
reported media runtime ready. The managed process was verified to use this
source directory; `/api/health` returned 200. Reloading the existing authenticated
Lark browser tab loaded the connector inventory and enabled New connection.
Only accessibility text was read; no screenshots, provider authorization,
connection creation or sync were performed.

Ctrl+C stopped both actual source runs successfully. After the final run, the
managed process, listener, process marker and server PID file were absent. The
private instance YAML's hash remained unchanged. The background installed
service was not restarted. Physical-device and live-model behavior were not
validated. This report was added after the named source commit; product source
and test inputs were unchanged by this documentation-only addition.
