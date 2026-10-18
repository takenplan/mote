# Configuration parity: model credentials, drafts and snapshots

Scope: CONFIG-C01, C02, C04, C05 and C06. Shared resources keep their fixed transport
authorization and private profiles keep account-qualified credentials. The
existing ConfigService remains the only configuration transaction and store.

| Disposition | Behavior |
| --- | --- |
| KEEP | Explicit reuse/replace/clear after provider, protocol or endpoint changes; draft directory and synthetic probe before save; feature-specific personal model choice; immutable admitted settings and prices. |
| CHANGE | Retain only the same account/profile's credential markers. Shared generations measure transport authorization, while request tuning applies to new admission. |
| REMOVE | Silent old-secret reuse at a new target, personal save-before-test, per-feature connection duplication and whole-settings equality as a shared lease fence. |
| EXCEPTION | Shared references accept no personal draft or caller model override. Target/credential changes, resource deletion and uncertain restart history still fence shared access. Personal nonempty key replacement retains its existing live/recovery semantics. |
| UNKNOWN | Physical devices, real Provider credentials/billing and external credential validity. No real personal data or live model is used. |

`apps/server/test/multiuser-configuration-parity.test.ts` starts the real scoped
application and uses generated accounts, private settings and a loopback provider.
Its production API journeys cover:

- Provider/protocol/base URL changes crossed with API key/header/body retention,
  through PUT, PATCH and the batch-view service port. Each rejects without an
  explicit reuse decision; replacement, clear and explicit reuse succeed.
  Administrator deployment defaults are included: omitting provider, protocol
  or base URL cannot change a retained credential target without confirmation.
  The guard and domain schema share the same deployment-input normalizer.
- Unsaved personal directory discovery and the full generated search/evidence/
  citation connection probe, followed by unchanged revision and active model;
  changed-target inspection sends no request before confirmation. New draft IDs
  inherit no credentials, same-ID accounts retain only their own key, and shared
  draft injection fails.
- One personal connection with distinct chat/Memory model IDs, durable restart
  restoration of both, and rejection of shared model overrides.
- A real TaskExecution Ask held at the generated provider: shared model, token,
  reasoning and timeout tuning preserves its original-model completion, while a
  new admission gets the changed model. The old snapshot also restores after a
  real application restart. Clearing the shared key during a second actual Ask
  prevents late completion and makes its old lease unavailable.

Focused command (repository workspace root):

```sh
node --import tsx --test --test-concurrency=1 --test-timeout=120000 apps/server/test/multiuser-configuration-parity.test.ts
```

Neighbor checks cover existing shared resource generations, model copy and
saved-reference inspection, personal credential retirement, effective settings,
per-account configuration and durable snapshots. The coordinated integration
record supplies the frozen candidate SHA, actual command exit status, evidence
paths, required affected checks and hidden Web results. Fixture success does not
claim physical-device or live-model validation.

## Codex consumer entry points

`apps/server/test/multiuser-configuration-codex-consumers.test.ts` configures a
generated executable and login home through the administrator API, restarts the
real scoped host to activate restart-only options, and then exercises:

- A and B built-in Memory jobs through original Material admission, extraction,
  independent review and publication. Each account records separate native
  extraction/review receipts, with no fallback to the HTTP fixture connection.
- Original-file upload and raw extraction, manual summary derivation, terms
  review proposal and explicit owner acceptance, followed by archived-file
  upload, model import preview, explicit confirmation and imported publication.

The mock executable records every RPC with its actual executable path and the
real path of the isolated runtime's login file. Assertions require all consumers
to resolve the configured generated login home and configured executable. The
mock returns the actual Codex usage events and schema-shaped domain outputs;
the domain hosts, independent-review boundary, task execution and ledger remain
production code. These are native subprocess fixture checks, not a real Codex
binary, personal login or live-model result.

```sh
node --import tsx --test --test-concurrency=1 --test-timeout=120000 apps/server/test/multiuser-configuration-codex-consumers.test.ts
```
