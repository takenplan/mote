# ADR: Restore plugin and MCP journeys through account-bound ports

Status: accepted, 2026-10-18, under the owner's explicit parity instruction.

The multi-user host must retain the original configuration → actual capability
check → enable journey, disable → unreferenced uninstall journey, and MCP target
draft → discover → select → import journey. Account isolation changes authority
and resource ownership; it does not require users to persist a remote connection
before discovery, or require an MCP client to retain a process-local session.

The shared package catalog remains administrator-managed. Uninstall retires the
requesting administrator's disabled, unreferenced instances through the existing
configuration authority. Enabled instances, other users' declarations, and all
retained execution/history snapshots still protect the shared package. An
uninstall command must pass its original revision checks before retirement.

A plugin check validates its exact runtime declaration and invokes the trusted
domain's real provider probe. Memory providers use their existing recovery,
health and durable capability canaries in a separate owner/configuration-bound
probe directory. A declared component is not evidence of a ready provider.
Checks report actual capability state, issues and observed status; a failed
check cannot enable the configuration. Generation, account, configuration and
model authorization still fence asynchronous probes and their publication.

Capability checks use the existing M05 external-call ledger and checkpoints.
The attempt ID, fixed package and creation time are durable before provider IO;
the capability owner registers issuance after local configuration/credential
validation and before dispatch. Generic canary namespace, body and operation IDs
derive from that attempt. Native provider journals remain in its retained probe
directory. An interrupted issued attempt without a completed result remains
unknown. A new check, explicit task retry or a removed/recreated declaration
cannot replace that fact with a fresh probe or ready state. Unresolved attempts
also retain their package and prevent plugin deletion from erasing their local
evidence while reporting complete.

A result becomes recoverable only after verification and local provider/worker
cleanup have joined. Its checkpoint precedes the final external acknowledgement.
Recovery can acknowledge and publish that exact completed result without another
provider call. It cannot infer an outcome for an unfinished attempt. Generic
canary cleanup requiring reconciliation remains unknown; closing a transport is
never evidence that a remote effect rolled back. Unknown remote effects without
completed proof remain retained; automatic supplier-specific reconciliation is
not added by this repair. No new engine, user step or compatibility path is used.

MCP inbound accepts the original standalone POST through a fresh SDK transport.
Initialized SDK clients can continue to retain a credential-bound session.
A supplied session ID must belong to that exact credential; stale or foreign IDs
remain 404. Both forms use the same read/write registration, source scopes and
publication checks. An ephemeral transport is closed after its HTTP response,
and disconnects abort its handlers. Restart does not require reinitialization
for a standalone request; sessions remain process-local.

MCP outbound accepts either a saved owned connection ID or a request-owned
`{url, token?}` target. Both bind the same importer to the current account and
selected existing source. Discovery creates no source or saved configuration.
The Web flow creates its source only after the user selects resources and asks
to import, just as before. Request-owned credentials are not persisted or
exported. The empty internal connection ID identifies one-time membership/status
receipts and cannot be selected as a configured connection. Source epochs,
account credentials, cancellation, network policy, immutable intake and complete
resource membership continue to fence every publication.

Reference imports page the remote resource directory for names and MIME types,
with the original fallback only when metadata is absent. They never read resource
bodies. Templates discovery tolerates only the SDK's `MethodNotFound` result for
the optional template list; other remote failures still fail discovery. A real
resource-only service built with the pinned official SDK verifies this behavior.

## Supersession

| Disposition | Contract |
| --- | --- |
| KEEP | Fixed releases, trusted worker boundary, configuration CAS, actual provider canaries, model leases, account/source fences and retained reader protection. |
| CHANGE | M09 check becomes actual domain capability verification with truthful feedback; M11 sessions and saved outbound connections are optional client choices. |
| REMOVE | Permanent disabled-own-instance uninstall pin; describe-only verification; mandatory initialization/session and saved connection/source before discovery; fixed reference title/MIME. |
| EXCEPTION | Other users' instances and all real retained snapshots continue to protect shared packages. Trusted plugin code is not an OS sandbox. A supplied stale session ID still fails. |
| UNKNOWN | Real third-party provider/model behavior, physical clients and deployment until separately run. Generated SDK/provider fixtures do not prove those checks. |
| CHANGE | Interrupted checks retain one M05-issued attempt instead of opening a fresh random canary after lease recovery. |
| REMOVE | Treating a control task's single-attempt budget or retained random directory as an unknown-effect recovery fence. |
| EXCEPTION | A completed post-cleanup result may finish publication after restart; this reuses proof and performs no provider IO. |

This supersedes the mandatory session and connection prerequisites in the
[M11 design](design/multiuser-mcp.md) and describe-only check interpretation in
[M09](design/multiuser-plugins.md), while retaining the
[multi-user scope](adr-multiuser-scope.md) and
[shared business flow](adr-shared-business-flows.md) decisions. Validation is
recorded in [the parity ledger](validation/parity-extensions-20261018.md).
