# Android

- Kotlin owns capture permissions, lifecycle and durable transport. Use current-format single-owner state.
- Focused command (module directory unless noted): `apps/android/gradlew -p apps/android --no-daemon :app:testDebugUnitTest --tests 'actual.package.TestClass'`. Select an existing affected file/class.
- Run from root with the actual class. Verify JDK/SDK and matching variant. Dev does not use Keystore; Prod does. Emulator work uses dedicated generated data with -no-window -no-audio. Activity recreation and partial ACK need coverage when affected.
- Translate new `moteText` keys and synchronize Android English strings.
- Work in small modules, check changed behavior, and connect the real consumer early. The integration owner completes final affected checks after convergence.
- See [testing](../../docs/testing.md). Separate fixture, physical-device and live-model evidence.
