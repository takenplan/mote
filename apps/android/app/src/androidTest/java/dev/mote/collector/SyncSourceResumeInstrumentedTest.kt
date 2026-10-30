package dev.mote.collector

import android.os.Build
import android.widget.TextView
import androidx.test.core.app.ActivityScenario
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import androidx.work.WorkManager
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith
import java.util.concurrent.TimeUnit

/** Dedicated generated Dev emulator only; no real source, capture, or model is used. */
@RunWith(AndroidJUnit4::class)
class SyncSourceResumeInstrumentedTest {
    @Test fun pendingSourceErrorRemainsVisibleAfterActualPauseAndResume() {
        val context = InstrumentationRegistry.getInstrumentation().targetContext
        require(context.packageName == "dev.mote.collector.dev" && Build.FINGERPRINT.contains("emu64a"))
        val deadline = android.os.SystemClock.elapsedRealtime() + 30_000
        while (QueueStorage.recovering || ConnectionGuard.changing() || ConnectionGuard.processing.get() > 0) {
            check(android.os.SystemClock.elapsedRealtime() < deadline) { "Generated fixture did not become idle" }; Thread.sleep(50)
        }
        val settings = Settings(context)
        require(!settings.enabled && context.queue().depth() == 0 && context.localSources().sources().isEmpty())
        val prefs = context.getSharedPreferences("mote", 0); val original = prefs.all.toMap()
        val originalLanguage = MoteI18n.preference()
        val manager = WorkManager.getInstance(context)
        val names = listOf("mote-upload", "mote-upload-timer", "mote-upload-recovery", "mote-heartbeat", "mote-heartbeat-now", "mote-source-upload", "mote-source-scan", "mote-source-periodic")
        fun cancel() = names.forEach { manager.cancelUniqueWork(it).result.get(10, TimeUnit.SECONDS) }
        val source = LocalSource(name = "Generated pending source", kind = "local-files", uri = "content://fixture/document/root", retention = "snapshot")
        try {
            cancel(); MoteI18n.select(context, "zh-CN")
            val configured = settings.read().copy(server = "http://127.0.0.1:47843", token = "generated-android-node-token-1234567890", debugHttp = true,
                authSignedOut = false, authExpiresAt = 0, authProcess = "", syncPaused = false, syncMode = "batch", wifiOnly = false, syncIntervalMinutes = 1440)
            settings.save(configured, confirmCentralEndpoint = true)
            val store = context.localSources(); store.save(source); store.status(source.id, "permission")
            assertTrue(store.pendingSync().pendingUpdates > 0)
            settings.syncStatus("error", "Generated source permission error")
            SendPauseControl.set(context, true); assertTrue(settings.read().syncPaused)
            SendPauseControl.set(context, false); assertFalse(settings.read().syncPaused)
            assertEquals("waiting", settings.syncState())
            ActivityScenario.launch(SyncQueueActivity::class.java).use { scenario ->
                val renderDeadline = android.os.SystemClock.elapsedRealtime() + 30_000
                var rendered = ""
                while (!rendered.contains("来源同步需要处理") || !rendered.contains("等待约定同步时间")) {
                    scenario.onActivity { activity -> rendered = activity.window.decorView.findViewWithTag<TextView>("sync-send-status")?.text.toString() }
                    check(android.os.SystemClock.elapsedRealtime() < renderDeadline) { "Source failure and waiting state were not both visible: $rendered" }
                    Thread.sleep(50)
                }
                assertEquals(1, SyncHealth.sourceAttentionCount(context)); assertFalse(settings.enabled)
            }
        } finally {
            cancel(); context.localSources().remove(source.id); SyncSchedule.invalidate(); MoteI18n.select(context, originalLanguage)
            val edit = prefs.edit().clear()
            original.forEach { (key, value) -> when (value) {
                is String -> edit.putString(key, value); is Boolean -> edit.putBoolean(key, value)
                is Int -> edit.putInt(key, value); is Long -> edit.putLong(key, value); is Float -> edit.putFloat(key, value)
            } }
            check(edit.commit())
        }
    }
}
