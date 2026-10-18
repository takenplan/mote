# Native Memory namespace lifecycle regression

The File374 required gate failed at the first A Hindsight search with
`503 memory_provider_unavailable`. Repeating the unchanged production journey
with an external diagnostic wrapper reproduced the same assertion and exposed
`ENOENT` renaming `provider-control.json.pending` in read-bank projection.

Normal calls serialized only within a cached Entry. Background native cleanup
evicted that Entry, closed its engine and opened a temporary lifecycle engine.
A foreground call could then open another Entry in the same directory before
the lifecycle engine closed. Their independent state writers raced on the same
control file; using different temporary filenames would still permit lost state.

The regression retains the real HTTP host, M03 publication, actual Hindsight
engine, independent model review, exact private read banks, A/B checks and real
host restarts. A generated native HTTP barrier holds A's staging-bank deletion
while querying both owners. The old implementation starts A's read bank during
cleanup (RED). The repair waits until A's lifecycle handle closes while B still
returns its own memory (GREEN). Original final assertions remain, including
literal recovery after model revocation and unchanged native volume identity.

| Disposition | Contract |
| --- | --- |
| KEEP | Exact namespaces, immutable bodies, M04 leases and usage, independent review, source/grant rechecks, purpose-limited cleanup, unknown receipts and owner isolation. |
| CHANGE | Native serialization survives cache eviction and spans maintenance open through close. Initialization failures release the turn; repeated close releases it once. Shutdown drains admitted native turns. |
| REMOVE | The assumption that evicting an Entry releases its native directory while a maintenance engine still uses it. |
| EXCEPTION | Worker-plugin calls keep their existing behavior. This is host lifecycle coordination, without a new product concurrency limit, storage/wire version, migration, user step or distributed completion claim. |
| UNKNOWN | Fresh required gate on the final candidate, combined-source validation, real native service/model, physical devices and deployment remain separate checks. |

External Q001-R2 evidence binds the original required failure, the unchanged
journey reproduction, controlled RED/GREEN, final source hashes and consumer
results. Focused checks do not replace the failed File374 gate or the earlier
Files873 failure.
