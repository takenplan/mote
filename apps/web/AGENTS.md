# Central web

- Reuse owner navigation, settings, terminology and components.
- Focused command (module directory unless noted): `node --import tsx --test test/api.test.ts`. Select an existing affected file/class.
- Use generated content and hidden browser fixtures. `npm test` uses the full glob. Preserve affected loading, failure, draft, navigation-return and stale-response behavior.
- Types for TypeScript modules: `npm run typecheck -w @mote/web`. Coordinate shared builds; do not rebuild shared output concurrently.
- Translate new `moteText` keys and synchronize Android English strings.
- Work in small modules, check changed behavior, and connect the real consumer early. The integration owner completes final affected checks after convergence.
- See [testing](../../docs/testing.md). Separate fixture, physical-device and live-model evidence.
