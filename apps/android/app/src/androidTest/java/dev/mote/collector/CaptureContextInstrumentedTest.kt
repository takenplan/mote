package dev.mote.collector

import android.os.Build
import android.os.SystemClock
import android.view.View
import android.view.ViewGroup
import android.widget.EditText
import androidx.test.core.app.ActivityScenario
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith
import java.io.File

@RunWith(AndroidJUnit4::class)
class CaptureContextInstrumentedTest {
    private val instrumentation get() = InstrumentationRegistry.getInstrumentation()
    private val context get() = instrumentation.targetContext
    private fun views(view: View): List<View> = listOf(view) + if (view is ViewGroup) (0 until view.childCount).flatMap { views(view.getChildAt(it)) } else emptyList()
    private fun overlays() = android.view.inspector.WindowInspector.getGlobalWindowViews().filter { root -> root.isShown && views(root).any { it.tag?.toString()?.startsWith("capture-context:") == true } }
    private fun waitUntil(message: String, check: () -> Boolean) {
        val end = SystemClock.elapsedRealtime() + 15000
        while (SystemClock.elapsedRealtime() < end) { if (check()) return; Thread.sleep(30) }
        fail(message)
    }
    @Test fun fourLocalDescriptionsKeepDraftsAndRequireFirstTargetConsent() {
        org.junit.Assume.assumeTrue(InstrumentationRegistry.getArguments().getString("uiFinalFixture") == "true")
        require(context.packageName == "dev.mote.collector.dev" && Build.FINGERPRINT.contains("emu64a"))
        val settings = Settings(context); require(!settings.enabled && !settings.hasPendingData())
        val storeFile = File(context.noBackupFilesDir, "capture-context/contexts.enc")
        require(!storeFile.exists()) { "This fixture requires its own empty capture-context store" }
        val preferences = context.getSharedPreferences("mote", android.content.Context.MODE_PRIVATE)
        val original = preferences.all.toMap()
        try {
            settings.save(settings.read().copy(server = "", token = "", syncMode = "manual", syncPaused = true), confirmCentralEndpoint = true)
            MoteI18n.select(context, "zh-CN"); MoteAppearance.select(context, AppearancePreference.LIGHT)
            val store = context.captureContexts(); val device = settings.deviceId
            ActivityScenario.launch(MainActivity::class.java).awaitMainUi().use { scenario ->
                scenario.onActivity { CaptureContextDialog(it).show() }
                waitUntil("Four independent source fields must load") { var ready = false; scenario.onActivity { ready = overlays().singleOrNull()?.let { views(it).filterIsInstance<EditText>().count { field -> field.isEnabled } == 4 } ?: false }; ready }
                scenario.onActivity {
                    for (channel in CaptureContextChannel.entries) views(overlays().single()).filterIsInstance<EditText>().single { field -> field.tag == "capture-context:${channel.wire}" }
                        .setText("Generated ${channel.wire} owner background")
                }
                waitUntil("Drafts must persist without becoming a send request") { CaptureContextChannel.entries.all { store.entry("", device, it).draft == "Generated ${it.wire} owner background" } }
                assertTrue(store.pending("", device).isEmpty()); assertEquals(0, context.queue().depth())
                scenario.onActivity { overlays().single().findViewById<View>(android.R.id.button2).performClick(); CaptureContextDialog(it).show() }
                waitUntil("Reopening retains unsubmitted drafts") { var ready = false; scenario.onActivity { ready = overlays().singleOrNull()?.let { views(it).filterIsInstance<EditText>().count { field -> field.isEnabled && field.text.startsWith("Generated") } == 4 } ?: false }; ready }
                scenario.onActivity { overlays().single().findViewById<View>(android.R.id.button1).performClick() }
                waitUntil("Explicit save leaves four source updates pending without a connection") { store.pending("", device).size == 4 }
                waitUntil("Save result must finish rendering before capture") { var ready = false; scenario.onActivity { ready = overlays().singleOrNull()?.findViewById<View>(android.R.id.button1)?.isEnabled == true }; ready }
                instrumentation.waitForIdleSync()
                scenario.onActivity { activity -> GeneratedWindowRendering.save(activity, File(context.filesDir, "ui-final-context").apply { mkdirs() }, "capture-context-local", overlays()) }
                scenario.onActivity { overlays().single().findViewById<View>(android.R.id.button2).performClick() }
            }
            val target = "https://generated-context.example"
            assertThrows(ConnectionFailure::class.java) { ConnectionGuard.change(context, target) { error("Unbound descriptions require explicit bindLocal") } }
            ConnectionGuard.change(context, target, bindLocal = true) {
                settings.save(settings.read().copy(server = target, token = "generated-owner-context-token-1234567890", syncMode = "manual", syncPaused = true), confirmCentralEndpoint = true)
            }
            assertEquals(target, settings.dataOrigin())
            store.bindLocal(target, device)
            assertEquals(4, store.pending(target, device).size)
            assertTrue(store.pending("https://other.example", device).isEmpty())
            assertThrows(ConnectionFailure::class.java) { ConnectionGuard.change(context, "https://other.example", bindLocal = true) { error("Already bound descriptions cannot move to another node") } }
            assertEquals(0, context.queue().depth()); assertFalse(settings.enabled)
        } finally {
            check(!storeFile.exists() || storeFile.delete())
            val edit = preferences.edit().clear()
            original.forEach { (key, value) -> when (value) {
                is String -> edit.putString(key, value); is Boolean -> edit.putBoolean(key, value); is Int -> edit.putInt(key, value); is Long -> edit.putLong(key, value); is Float -> edit.putFloat(key, value)
                else -> error("Unexpected generated settings type")
            } }
            check(edit.commit())
        }
    }

    @Test fun anOpenDescriptionEditorCannotWriteAfterConnectionChanges() {
        org.junit.Assume.assumeTrue(InstrumentationRegistry.getArguments().getString("uiFinalFixture") == "true")
        require(context.packageName == "dev.mote.collector.dev" && Build.FINGERPRINT.contains("emu64a"))
        val settings = Settings(context); require(!settings.enabled && !settings.hasPendingData())
        val storeFile = File(context.noBackupFilesDir, "capture-context/contexts.enc")
        require(!storeFile.exists()) { "This fixture requires its own empty capture-context store" }
        val preferences = context.getSharedPreferences("mote", android.content.Context.MODE_PRIVATE)
        val original = preferences.all.toMap()
        try {
            settings.save(settings.read().copy(server = "", token = "", syncMode = "manual", syncPaused = true), confirmCentralEndpoint = true)
            val device = settings.deviceId
            ActivityScenario.launch(MainActivity::class.java).awaitMainUi().use { scenario ->
                scenario.onActivity { CaptureContextDialog(it).show() }
                waitUntil("The old editor must have finished loading") { var ready = false; scenario.onActivity { ready = overlays().singleOrNull()?.let { views(it).filterIsInstance<EditText>().all { field -> field.isEnabled } } == true }; ready }
                val target = "https://generated-switched-context.example"
                ConnectionGuard.change(context, target) {
                    settings.save(settings.read().copy(server = target, token = "generated-switched-owner-token-1234567890", syncMode = "manual", syncPaused = true), confirmCentralEndpoint = true)
                }
                scenario.onActivity {
                    views(overlays().single()).filterIsInstance<EditText>().first().setText("Generated late old-node edit")
                    overlays().single().findViewById<View>(android.R.id.button1).performClick()
                }
                waitUntil("A stale editor must be disabled instead of accepting an old-node write") { var disabled = false; scenario.onActivity { disabled = overlays().singleOrNull()?.let { root -> views(root).filterIsInstance<EditText>().all { !it.isEnabled } && !root.findViewById<View>(android.R.id.button1).isEnabled } == true }; disabled }
                CaptureContextChannel.entries.forEach { channel ->
                    assertEquals("", context.captureContexts().entry("", device, channel).draft)
                    assertEquals("", context.captureContexts().entry(target, device, channel).draft)
                }
                assertFalse(context.captureContexts().hasPendingConnectionWork())
                scenario.onActivity { overlays().single().findViewById<View>(android.R.id.button2).performClick() }
            }
        } finally {
            check(!storeFile.exists() || storeFile.delete())
            val edit = preferences.edit().clear()
            original.forEach { (key, value) -> when (value) {
                is String -> edit.putString(key, value); is Boolean -> edit.putBoolean(key, value); is Int -> edit.putInt(key, value); is Long -> edit.putLong(key, value); is Float -> edit.putFloat(key, value)
                else -> error("Unexpected generated settings type")
            } }
            check(edit.commit())
        }
    }
}
