# Configuration parity: usage journeys

Scope: CONFIG-C03 against the pre-multiuser usage journey. The authenticated
host retains ownership of account identity, and the existing usage reducer owns
date grouping, attribution, cost completeness and aggregate math.

| Disposition | Behavior |
| --- | --- |
| KEEP | Inclusive date/timezone ranges; exact intersected filters; full-range facets/totals; Agent/module/Skill/model/provider groups; group and day drilldown; detail pagination; unknown quantities/costs; failed known consumption; original usage and price editor UI. |
| CHANGE | Select only the current account's issued, actually executed receipts before applying the shared reducer. Price saves use the current account's ConfigService transaction. Web price defaults resolve the account's selected chat model. |
| REMOVE | The Web receipt-only replacement for the original usage page; ignored statistics query parameters. |
| EXCEPTION | Current no-query receipt consumers retain their existing account-scoped response; the usage page always sends the full dated, paginated query. Internal lifecycle export still reads all owned observations. |
| UNKNOWN | Physical clients, real providers/billing and native Codex usage facts are not established by these generated fixtures. |

Durable regressions:

- `apps/server/test/multiuser-usage-summary.test.ts` starts measurements through
  actual authenticated model leases, backdates only generated observations, and
  exercises production HTTP routing with 45 issued receipts, an unissued
  receipt, a confirmed nonexecuted receipt and a second account. It checks a
  Shanghai/UTC midnight boundary, each grouping and exact drilldown, intersected
  filters, facets independent of narrowed filters, pages covering all details,
  known failure costs, unknown fee preservation, account isolation, price
  snapshots and invalid/forged requests.
- `apps/web/test/multiuser-usage.test.ts` renders the original registered usage
  page in a hidden DOM and sends real Cookie/CSRF Api requests to the production
  scoped host. It exercises pages, module drilldown, selected-model price
  defaults, saving a private price and switching accounts. This is a headless
  component/HTTP journey, not an Electron browser or physical-client result.
- The existing `apps/server/test/usage.test.ts` and
  `apps/web/test/usage.test.ts` continue to cover reducer metrics and presentation
  of unknown usage and explicit attribution.

Commands use each workspace's TypeScript/JSX configuration:

```sh
# workdir: apps/server
node --import tsx --test --test-concurrency=1 test/multiuser-usage-summary.test.ts test/usage.test.ts
# workdir: apps/web
node --import tsx --test test/multiuser-usage.test.ts test/usage.test.ts
```

The module's coordinated integration record supplies the frozen candidate SHA,
actual exit statuses, evidence paths, affected checks and any separate hidden
browser results. No real personal content, credentials, screenshot or live model
request is used by the fixtures above.
