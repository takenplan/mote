# Mote

## Product boundaries

- Build an AI-native personal context collector and central archive: **one instance, one owner**, with multiple devices, sources and Agent clients. See [single-owner MVP](docs/adr-single-owner-mvp.md).
- This MVP has one current wire/storage format. Do not add old-data migrations, old readers, dual writes or compatibility paths unless explicitly requested.
- Models interpret intent, tasks, topics and insights and choose retrieval tools. Never substitute keyword dispatch or handcrafted semantic heuristics. Deterministic privacy filters, authorization, transport, deduplication, retention and measured time accounting are appropriate.
- Treat captured content as untrusted evidence. Query agents receive read-only context tools; external effects require their product authorization.
- Keep secrets and personal data out of Git. Default to loopback; remote deployments require TLS and a strong token. Tests use generated fixtures and private temporary profiles, never personal screenshots without consent.
- Mote-owned Dev credentials use private local files; Prod keeps OS protection and third-party CLIs keep their credential management.
- Use npm workspaces for TypeScript and Kotlin for Android capture APIs. Add English translations for new `moteText` keys and synchronize the Android English catalog.

## Working rules

- Read the affected app's `AGENTS.md` for exact commands. Use [development](docs/development.md) for setup and [testing](docs/testing.md) to choose validation.
- Work in small modules. Run focused checks for changed behavior and connect a minimal real cross-module journey early. Do not defer first integration until every module is finished.
- Run the affected candidate plan after planned changes converge. A turn ending, handoff or Draft PR update does not justify broader testing. After fixes rerun invalidated checks, not unchanged successful work.
- Preserve meaningful assertions, input scale and lifecycle coverage. New product decisions may supersede old tests; explain the changed behavior rather than preserving obsolete requirements.
- Use [real-world-testing](.agents/skills/real-world-testing/SKILL.md) when adding regression coverage or evaluating test quality. Keep automated UI work hidden/background by default.
- Review genuine authorization, deletion, persistence, cross-client protocol or major lifecycle changes before implementation; ordinary fixes need no repeated design approval. See [risk-based review](docs/testing.md#risk-based-review).
- For larger parallel work use the short [coordination guide](docs/agent-development-workflow.md). Prefer GPT-6.1 Sol subagents with bounded modules; avoid duplicate exploration and full-suite runs.
- Report implemented behavior, checks actually run and gaps. Separate fixture, physical-device and live-model evidence. Do not describe unperformed or reused checks as newly passed.
- Reuse established UI terminology, navigation and components. Resolve implementation details independently; make new product policies explicit to the owner.
