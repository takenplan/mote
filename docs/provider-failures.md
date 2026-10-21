# Provider failures and host retry

[Task recovery and task-type execution budgets](adr-task-recovery-and-execution-budgets.md)
defines resource waiting, model correction, safe execution retries and unknown
outcomes. Each [task registration](task-execution-policies.md) owns its policy;
confirmed resource contention does not exhaust a processing-failure budget.

Provider error bodies are never used to decide recovery. `ProviderFailure` carries host-selected categories and codes derived from HTTP status: authentication/endpoint/redirect failures need configuration, rate limits and temporary server/network failures may retry, and invalid requests or unsupported sizes/formats are permanent for that input. Retry-After accepts bounded integer seconds or an HTTP date, capped at seven days.

Direct file/image processors cancel error bodies before parsing and pass this structured failure to the shared executor. The engine persists the reason and next eligible time. A blocked service does not consume additional attempts merely because the executor is ticked, and unrelated operations keep running.

Query and import Harness sessions report only status and Retry-After over a private loopback channel to the host. The channel is authenticated, bounded and not registered as a model tool; it accepts no endpoint, body or credential fields. The runtime cancels the provider error body and returns a fixed non-retryable SDK response after reporting it, so the host decides subsequent retry. Explicitly aborted requests retain the existing cancellation/deadline path. Codex App Server v2 errors use only `codexErrorInfo` discriminants and their structured HTTP status. Quota exhaustion waits for account repair; rate limiting and network/server failures receive bounded recovery; authentication is actionable. Unknown variants remain generic failures; free-form SDK messages are not inspected. The installed CLI schema is generated with `codex app-server generate-ts`; the official protocol reference is https://learn.chatgpt.com/docs/app-server.

Current M05 tasks default to two eligible automatic retries after the initial
execution, with resource waiting separate from the count. Issued read-query
unknowns can replay only after exact full local cleanup, under current authority
and the same finite budget. Policy permission never settles the old result or
fees, nor fabricates owner consent. Unsupported effects keep their original
reconciliation contract.

Memory preserves the provider failure through its extraction/review boundary. Authentication waits finish the caller's observation cleanly and can resume after configuration repair. Failed Memory batches retain a provider retry deadline; a premature manual retry cannot bypass it. Scheduled extraction propagates that deadline to lifecycle backoff, including after restart. Actual usage and cost are recorded in the usage ledger; there is no shared token or money reservation service.

Owner API responses use fixed localized explanations and recovery metadata. Provider authentication failures return 502 rather than invalidating the owner's Mote login; explicit retry delays also appear in Retry-After. Diagnostic exports never include provider response text.

Feedback planning retries only typed transient rate-limit, network, unavailable
or timeout failures within the current three-attempt default. Unclassified
provider or program exceptions stop immediately; classified issued-read unknowns
use the exact-cleanup policy above. Its terminal failure is preserved
through the coordinator, batch and Activity views; it does not become a request
for owner context. Recovery corrects the exact historical failed/no-unit/no-real-
question wait without issuing another model call. True context stops, owner
questions, cancellation and stale work retain their distinct states. See the
[decision and compatibility boundary](adr-memory-evidence-delivery-and-failure-state.md).

Validation uses generated content only: real Harness against synthetic local HTTP services checks 401/429/503 under both OpenAI Completions and DeepSeek transports, plus an import failure, with exactly one outbound model request per case. Shared tests validate date/delay bounds; executor tests verify attempts, persistence and independent work; Memory tests verify actionable waits, repaired credentials, zero premature retries/checkpoints and restarted lifecycle deferral. No additional live model or personal data was used.

Reported upstream cooldown is shared across feature queues. `ProviderAdmission` persists only a digest of protocol/provider/endpoint/credentials plus a fixed failure code and expiry. HTTP 429 retains its bounded default cooldown when the provider omits Retry-After. Other recognized transient failures share a cooldown only when the upstream response supplies Retry-After; a single timeout, network failure or unavailable response without that signal stays with the failing task's existing retry policy and does not block other models. Different credentials or endpoints remain independent. Both the Agent queue and the later Harness admission recheck the deadline, preventing requests that were queued before a reported limit from bypassing it. Longer concurrent cooldowns win; a late success cannot clear another request's limit. Expired entries are removed when new shared failures are recorded. The owner execution-settings response reports only the number of cooling services and the earliest retry time.

This covers language-model calls used by chat, Memory, insights, file analysis and import. Direct ASR/image workers share persistent busy cooldowns and managed physical-worker resource admission. Model runs share keyed fair concurrency gates. Rate limits and host cooldown waits do not consume failed-processing attempts. Each task declares its finite actual-failure budget; there is no default elapsed recovery window. Explicit task-specific windows remain supported, including across restart. The additional tests cover separate database connections, reconstruction, queued admission, credential isolation, late success, input errors and the actual owner query route. Host admission failures retain their typed reason through the query/import adapters.

Codex cumulative thread token samples replace earlier samples, including repair turns. Duplicate samples do not add cost twice. Cache/reasoning fields remain unknown when omitted. The adapter does not invent a count of underlying requests: the UI labels that count unavailable while retaining complete/partial cumulative token accounting. Generated protocol tests include quota state, repaired output, duplicate samples, private-message rejection, and the installed Codex binary talking to a local synthetic Responses endpoint.
