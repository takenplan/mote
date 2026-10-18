# Scoped archive maintenance parity

The LIFE-L01/L05 change restores the production maintenance journey from baseline
`2c2627621e2598332ae8169845bc7343be7ed63e` on the current scoped host. All inputs,
accounts, model responses and original bytes in these tests are generated.

| Disposition | Behavior and boundary |
| --- | --- |
| KEEP | Original strict `context_end` cutoff, zero meaning indefinite retention, actual file-revision exclusion, destructive derived withdrawal, fixed original references and physical pins. |
| CHANGE | The same maintenance operation binds each current database account and epoch instead of using one global owner; startup and hourly scheduling require no logged-in session. File-revision identity is canonical instead of depending on an upload receipt. |
| REMOVE | Accepted but unused retention configuration, implicit requirement to invoke manual GC, and ordinary queue replays recreating a capture explicitly deleted or expired by retention. |
| EXCEPTION | File forgetting owns its existing blocked/generation/allow-again decision. Source removal retains its existing incarnation behavior. An unresolved local or external activity prevents physical cleanup without preventing another owner’s cleanup. |
| UNKNOWN | Actual production-scale cost, hour-long wall-clock operation, live-provider outcomes and physical device behavior are separate checks. The hourly fixture invokes the exact registered callback through a generated scheduler. |

`apps/server/test/multiuser-archive-maintenance.test.ts` exercises production
startup, shutdown, restart and HTTP intake with temporary SQLite storage. A real
loopback listener is used for retention and GC entry journeys; generated Memory
and Ask providers use the ordinary production hosts and model adapters.

| Journey | Required result |
| --- | --- |
| Old context received now; explicit authored time differs from receipt time | Retention follows source content time, not the new receipt. |
| State series begins before cutoff and ends after it | Preserve the series using its last actual observation. |
| Strict equality and zero policy | An event at the exact cutoff remains; zero preserves old originals and saved dialogue across restart. |
| File manifest versus generic source item with `kind: file` | Preserve only the real file revision; deleting expired transport metadata does not remove its exclusion. |
| Logout, restart, old batch and new batch with the same deleted ID | Host retention still runs; both ordinary replay forms return 410. Another owner’s equal ID and a new exact event ID stay usable. |
| Expired capture with transitive Material, published Memory and saved Ask history | Withdraw the readable derivatives and search entries; clear the saved answer and trace. |
| Active workspace beyond its metadata expiry; current pin; unresolved activity across restart | Retain protected bytes, defer only the affected owner and do not infer a stopped external action. |
| Actual media request returns an ambiguous 503; original pin expires and capture is deleted | Keep the durable processing hold across restart without replay. A purpose-bound observation of physical settlement permits GC, while another owner's staging cleanup remains operational. |
| Expired ordinary upload and unlinked generic completed import | Startup or hourly collector removes staging and unreferenced bytes through the existing cleanup rules. |
| Hourly callback and close | Register the original one-hour period; invoke the shared collector; dispose scheduling before teardown. |

Focused command:

```sh
node --import tsx --test --test-concurrency=1 apps/server/test/multiuser-archive-maintenance.test.ts
```

Consumer coverage includes the existing source-incarnation, pin/GC and account
erasure fixtures. Module and integration owners record exact candidate hashes,
command exits and evidence paths in the delivery receipt. No personal vault,
personal screenshot, live model, physical device or deployed service is used.
