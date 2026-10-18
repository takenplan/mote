# Recording connection authorization — 2026-10-18

Scope: current multiuser Feishu/DingTalk recording connections, fixed CLI deployment,
and the existing Feishu document/calendar CLI consumer. No historical data or
credential repair, account migration, compatibility path, live provider login,
real personal content, personal screenshot capture or live model request was
performed.

## Version and executable evidence

The official npm Registry `latest` metadata was read on 2026-10-18:

| Package | Fixed version | npm publication (UTC) | Official source |
| --- | --- | --- | --- |
| `@larksuite/cli` | 1.0.98 | 2026-10-13 17:47:55 | [Release](https://github.com/larksuite/cli/releases/tag/v1.0.98), [Registry](https://registry.npmjs.org/@larksuite%2fcli/1.0.98) |
| `dingtalk-workspace-cli` | 1.0.64 | 2026-10-14 03:54:45 | [Release](https://github.com/DingTalk-Real-AI/dingtalk-workspace-cli/releases/tag/v1.0.64), [Registry](https://registry.npmjs.org/dingtalk-workspace-cli/1.0.64) |

Archive SHA256 values in `cli-runtime.mjs` come from Lark's official npm package
`checksums.txt` and DWS's official release asset digests. macOS arm64 archives were
downloaded into a temporary isolated directory, verified, and executed only for
version and `--help`. No npm postinstall, skills installation, global software
update, provider account/status query or login ran.

`node --import tsx scripts/test-connector-cli-contracts.ts /absolute/prepared/runtime`
passed all 22 current fixed argv/help contracts. Each relevant login, configuration,
document, calendar, directory, wiki and recording command ends in `--help`.
DWS's actual version is `v1.0.64`; version checking normalizes that current wire
value. Lark's document fetch now uses its current default implementation rather
than the hidden historical `--api-version` compatibility flag.

## Automated journeys actually run

- Deployment fixture: 7/7 tests. Fixed hash verification, network failure, corrupt
  download, concurrent preparation, offline reuse, missing read-only destinations,
  non-root Docker directory traversal, actual native `mote connectors-prepare`
  release selection and credential-free environment, execute-bit loss, and
  symlinked version directories. No download occurs in these fixture tests.
- Server targeted suite: 87/87 tests, including both new authorization journeys,
  fixed-command child-process isolation/cancellation, Lark documents, and existing
  scoped connectors and their M06 consumers. Actual HTTP task admission, encrypted
  operation payloads, owner/instance fences, cancel, expiry, replacement account,
  fresh authorization, no automatic collection and restart were exercised using
  generated provider transports.
- Web targeted suite: 16/16 tests. The original connection settings and real
  scoped HTTP APIs run under JSDOM, covering both providers, application-secret
  clearing, absence of secrets/device codes from recovery storage, task/URL
  isolation, refresh, cancellation, expiry, reauthorization, account replacement,
  and existing lost-ACK/selection/sync recovery behavior.
- TypeScript server/web typechecks, root script typecheck, and synchronized
  English/Android catalog validation passed. Full affected checks are recorded
  by the parent change's validation record.

The DWS regression is transport-specific: its complete URL is printed before a
manual-code URL. Split stderr chunks now preserve the first complete URL's exact
opaque bytes instead of replacing it with the later base URL.

## Hidden Chromium QA

After building the real Web bundle, run:

```sh
node_modules/.bin/electron scripts/test-connector-authorization-browser.cjs
```

The fixture uses `fixture-background.cjs`, `show:false`, no focus or external
browser launch, a generated account, real application routes and injected vendor
transport. Both providers pass the original connection-detail flow: Feishu app
configuration, authorization link and dynamically imported local QR, page reload
recovering the same task/link, cancellation removing the old link, and a fresh
successful authorization revealing the existing scope form. Requested desktop
width 1360 and mobile width 390 have no horizontal overflow; the QR is inside the
mobile viewport. Screenshots were inspected visually. Local generated artifacts
are `.mote/connector-authorization/{feishu,dingtalk}-recordings-{desktop,mobile}.png`
and `result.json`; they contain no real account content and are not source files.

## Explicit remaining manual checks

The owner must complete real platform browser/scan authorization, organization
CLI enablement and any organization-managed permission approval, then perform
one selected recording sync and audio backup for each provider. This report does
not claim live permission, download, token refresh, vendor timing or real content
validation. New document/calendar consumer commands passed offline contracts and
fixtures; no new live tenant document/calendar validation occurred.

The parent change also built the production `linux/arm64` Docker image and ran
both fixed CLIs as UID 1000 with networking disabled. Production entrypoint,
health, bundled Web, generated-account login and same-volume restart passed;
see the parent [validation record](scoped-processing-reliability-2026-10-18.md).
Linux amd64 archives remain pinned but were not executed here. Windows remains
explicitly unsupported by the scoped native credential backend. Missing dependencies remain visible in
connection checks; operators prepare the selected deployment, with no global
executable or credential fallback.
