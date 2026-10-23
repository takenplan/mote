# Desktop

- Own local permissions/privacy, durable uploads and the full owner client. Local folders belong to this device.
- Focused command (module directory unless noted): `npm run test -w @mote/desktop -- test/config.test.ts`. Select an existing affected file/class.
- Run this command from root. Dev must not call safeStorage; Prod retains OS protection. UI fixtures load scripts/fixture-background.cjs before Electron/product imports and use isolated generated profiles. Build native helpers only when affected.
- Types for TypeScript modules: `npm run typecheck -w @mote/desktop`. Coordinate shared builds; do not rebuild shared output concurrently.
- Translate new `moteText` keys and synchronize Android English strings.
- Work in small modules, check changed behavior, and connect the real consumer early. The integration owner completes final affected checks after convergence.
- See [testing](../../docs/testing.md). Separate fixture, physical-device and live-model evidence.
