# Wire compatibility

Central, Desktop and Android have independent product release versions. A product
version describes the installed build; it does not prove API compatibility or
authorize a feature. The shared wire contract is declared in [contract.json](contract.json)
and implemented by `@mote/shared/protocol` and Android `ProtocolCompatibility`.
Current products support the inclusive range `{ "min": 2, "max": 2 }`.

`GET /api/health` returns `{ok,mode,protocol,storageEpoch,authentication,privateCapabilities}`
without authentication. Current mode is `multiuser-auth`, storage epoch is 5,
and authentication is `username-password`. `privateCapabilities` describes the
installed service composition; it does not authorize private access. This
response has no product `version` field.

Native connection checks send `X-Mote-Protocol-Version: 2` to authenticated
`GET /api/connections/self`. The response is `{account,credential,protocol,capabilities}`;
the range is top-level, not `node.protocol`. Account identity includes deployment,
user and credential identity; the credential carries kind, expiry and optional
device binding. The header does not bypass authentication or select a different
ingestion behavior.

Clients require integer bounds, `min <= max`, and range overlap. Missing,
malformed, or non-overlapping metadata fails the connection check before applying
a credential. Pre-handshake nodes are retired by this MVP upgrade. Product
versions are never compared across Central, Desktop and Android to decide API
compatibility.

The current authenticated self response reports `authentication`, `ingest`,
`ingressVersion` and `archiveRead`; its production values are `true`, `true`, 3
and `false`, respectively. Actual route authorization and device binding still
apply. The static contract's capability-name list does not define the
self-response DTO. Collector Ingress 3 separately enforces
`X-Mote-Ingress-Version: 3` and durable ACK validation; the Wire handshake does not
replace those guards. Server and its bundled Web console remain one release unit
and retain their build consistency check.

Storage epochs and release tags are independent of the wire range. Current
production uses Central epoch 5, Desktop/Android local format 4 and portable
archive 3. Unsupported stored formats fail explicitly without rewriting their
files. The [scope decision](../docs/adr-multiuser-scope.md) and
[multiuser integration](../docs/adr-multiuser-main-integration.md) supersede the
old single-owner MVP baseline; current local formats are enforced by Desktop
`storage-format.ts` and Android `LocalDataFormat.kt`.
Future wire changes must update the supported range and generated fixtures, and
validate all consumers.

The fixture cases in [fixtures/compatibility.json](fixtures/compatibility.json)
are consumed by shared TypeScript, Desktop connection and Android JVM tests.
They contain generated values only. Physical-device and live-model checks are
separate validations.
