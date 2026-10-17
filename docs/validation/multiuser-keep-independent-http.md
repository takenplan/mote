# Independent acceptance of the three KEEP controls

No production defect was reproduced in the bounded candidate. Eight additional
synthetic real-HTTP regressions pass, and the existing asynchronous administrator
revocation/CAS/restart case passes independently. This is finite module evidence
for final C composition, not acceptance of the final eight journeys.

Reviewed source is exactly M13 prerequisite
`4ac9604a290701b731cbbb7b5d1775b8af13d782` through candidate
`aad77a8cf401eb4e9066e4640fd60b2d3e988d57`:

- Tests: `00a90298a273d1c9169712f00cdf93c92341c96f`.
- Producer: `9314fefff7ddae1173b445e97918503260c39fac`.
- Runtime/Web: `db321f6457774b1609a76dd5e611c95f6973e8a5`.

Only declared differences and their relevant host/context, configuration,
execution and ingress seams were inspected. The implementation owner's checkout
was not changed, and undeclared WIP was not selected. Initial scope/prerequisite
notifications were delivered to implementation thread
`01a148ca-3475-77df-91ff-593b94f14020` and final E2E thread
`01a1475f-d672-7415-ac03-5c0f3db9a03d`.

## Risk assessment and evidence

| Boundary and relevant source | Additional real-path evidence |
| --- | --- |
| Instance writes: `scope/instance-controls.ts:25`, `:32`, `scope/management.ts:20`; shared ConfigService revision and final administrator guard | Concurrent execution/diagnostic writes with one revision produce exactly one 200 and one 409. A/B ordinary writes, personal configuration aliases, owner selectors, host paths and private trace enablement cannot change the instance revision. Restart preserves the committed revision. The selected existing case also proves actual diagnostic-sink changes, persisted limits and revocation during real asynchronous preparation. |
| Physical limits: `scope/instance-controls.ts:17`, `scope/task-execution.ts:166` | Actual `/api/memory/jobs` runs for A/B reach the external synthetic model HTTP server. Raising memory, Agent and model limits one at a time moves the same admitted tasks through each gate. Both jobs complete with real extraction/review/publication. Actual `/api/query-runs` then demonstrates interactive 1→2 while background gate occupancy remains zero, and both Ask runs complete. A separate M05 HTTP case proves cancellation while waiting issues no physical handler. |
| Shared text maintenance: `scope/index-maintenance.ts:15`, `:20`, `:26`, `scope/private-data-schema.ts:85` | A queued administrator loses only its administrator flag, without an epoch change; work becomes terminal without rebuilding. Restoring the synthetic flag and repeating the same operation returns the original terminal task. A fresh operation succeeds. A disabled B owner is excluded from rebuilt FTS while A remains positively searchable, B is absent from A search, restart and duplicate preserve one journal row, and administrator status contains no fixture content/source identity. |
| Files selection and ownership: `scope/file-export.ts:25`, `:31`, `:40`, `:51`, `:54`, `file-export-tar.ts:17` | A/B archive-ID collision, declaration without archive link, literal attachment MIME differing from parent MIME, current/history retained attachment flags and exact bytes, source-head replacement during held export, forbidden path/owner selectors, and TAR checksum/regular-member/name/completion validation. |
| Authorization after output begins: `scope/file-export.ts:41`, `file-export-tar.ts:28` | The real compressed HTTP stream emits its first block, then A is disabled through account HTTP. Download fails, no second compressed block is emitted, and B still downloads its exact original. The barrier is at HTTP output; original readers, TAR, gzip and authorization execute unchanged. |

The new test is
[`multiuser-keep-independent-http.test.ts`](../../apps/server/test/multiuser-keep-independent-http.test.ts).
It reuses the declared KEEP account fixture. Product endpoints use real loopback
HTTP, not Fastify injection. The synthetic external model fixture substitutes
only provider I/O; M04/M05/Memory/Ask and publication remain real.

Two adversarial state arrangements are explicit: disposable SQLite changes the
synthetic administrator flag because no role-change HTTP API exists, and rekeys
B's synthetic archive row after actual A/B uploads to force an equal archive ID.
Those do not claim HTTP role editing or client-selected archive IDs. Material
and attachment-link setup uses the real host-bound ingress API, as existing
module fixtures do; the exercised control, maintenance and export routes use
HTTP. No authorization implementation is replaced.

## Environment and retained results

Independent checkout: `2026-10-17/task-17/mote`, branch
`codex/mote-keep-independent-http`. Node 26.11.1 / ABI 147. Root and mem0
resolution each create, write, read and close a real SQLite database. All four
workspace module realpaths point into this checkout. Dependencies are local
copies and libraries were built in this checkout. Every server uses its own
temporary generated database and random loopback port. Tests close their own
servers/workers and remove their disposable data.

Only hand-authored synthetic A/B records, byte buffers, model replies and keys
are used. No local Central private data or derivative was read, copied, committed,
uploaded or published. No deployment, CI, real account permission, credential or
configuration was changed.

Logs are retained beside this checkout in `task-17`:

- `keep-independent-preflight.log`: Node, two SQLite smoke paths and module identity.
- `keep-independent-http-release.log`: final eight-test run on delivered source,
  **8/8, EXIT0, 16782.645375 ms, zero skips/cancellations**.
- `keep-independent-owner-await.log`: selected existing asynchronous guard case,
  **1/1, EXIT0, 1741.209333 ms**.
- `keep-independent-types-own-fixture.log`: strict TypeScript check, **EXIT0**.

Reproduce the additional cases from the repository root with Node 26:

```sh
node --import tsx --test --test-concurrency=1 --test-timeout=120000 apps/server/test/multiuser-keep-independent-http.test.ts
node_modules/.bin/tsc --noEmit --strict --module NodeNext --moduleResolution NodeNext --target ES2023 --esModuleInterop --skipLibCheck apps/server/test/multiuser-keep-independent-http.test.ts
```

The first sandbox run failed at `listen EPERM` before any HTTP case executed;
it is not product RED. The permitted first run was 5/7: its two failures were
incorrect fixture expectations (demotion is 403; upload ID is not archive ID).
They were corrected and both reran 2/2. A later compile found existing errors in
the reused Memory fixture; the final test instead owns a minimal provider fixture
and compiles strictly. Intermediate logs remain retained with their original
outcomes. No production repair was requested on the basis of those failures.

No full affected gate was repeated and no PR was published by this acceptance
task. The owner's gate remains a separate result. The local test/report commit
can be cherry-picked after the exact candidate into final C; its SHA is recorded
in `/tmp/mote-keep-independent-acceptance.md`.

Unperformed here: final eight-journey union, native/physical devices, live model
semantics, and browser-managed download completion. Maintenance is scoped
`pd_fts` text, and split export covers originals/declared attachments. Typed
image products and portable3 are separate contracts; final C still needs the
separately declared PR151 image chain. There is no remaining execution blocker
for this finite acceptance.
