package dev.mote.collector

import android.os.Build
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import androidx.work.ExistingWorkPolicy
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkInfo
import androidx.work.WorkManager
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith
import java.util.concurrent.TimeUnit

/** Requires the dedicated generated Dev emulator; never opens capture or makes a model call. */
@RunWith(AndroidJUnit4::class)
class SyncScheduleStaleInstrumentedTest {
    @Test fun staleStartupCannotCancelCurrentWorkAndExplicitRequestsReportFailure() {
        val instrumentation = InstrumentationRegistry.getInstrumentation()
        val context = instrumentation.targetContext
        require(context.packageName == "dev.mote.collector.dev" && Build.FINGERPRINT.contains("emu64a"))
        val readyDeadline = android.os.SystemClock.elapsedRealtime() + 30_000
        while (QueueStorage.recovering || ConnectionGuard.changing() || ConnectionGuard.processing.get() > 0) {
            check(android.os.SystemClock.elapsedRealtime() < readyDeadline) { "Generated fixture did not become idle" }
            Thread.sleep(50)
        }
        val settings = Settings(context)
        require(!settings.enabled && context.queue().depth() == 0 && context.localSources().sources().isEmpty())
        val prefs = context.getSharedPreferences("mote", 0); val original = prefs.all.toMap()
        val manager = WorkManager.getInstance(context)
        val names = listOf("mote-upload", "mote-upload-timer", "mote-upload-recovery", "mote-heartbeat", "mote-heartbeat-now", "mote-source-upload")
        fun cancel() = names.forEach { manager.cancelUniqueWork(it).result.get(10, TimeUnit.SECONDS) }
        try {
            cancel()
            val old = settings.read().copy(server = "", token = "", syncPaused = false, syncMode = "batch", wifiOnly = false)
            settings.save(old, confirmCentralEndpoint = true)
            val current = old.copy(server = "http://127.0.0.1:47843", token = "generated-android-node-token-1234567890", debugHttp = true,
                authSignedOut = false, authExpiresAt = 0, authProcess = "")
            settings.save(current, confirmCentralEndpoint = true)
            val marker = OneTimeWorkRequestBuilder<UploadWorker>().setInitialDelay(1, TimeUnit.HOURS).build()
            manager.enqueueUniqueWork("mote-upload-timer", ExistingWorkPolicy.REPLACE, marker).result.get(10, TimeUnit.SECONDS)
            settings.syncStatus("waiting", "Generated current task")

            // The old snapshot is deliberately delivered only after the new timer exists.
            SyncSchedule.schedule(context, old)
            assertEquals(WorkInfo.State.ENQUEUED, manager.getWorkInfoById(marker.id).get(10, TimeUnit.SECONDS)?.state)
            assertEquals("Generated current task", settings.uploadStatus())
            assertTrue(runCatching { SyncSchedule.schedule(context, old, explicit = true) }.exceptionOrNull() is SettingsChangedFailure)
            assertEquals(WorkInfo.State.ENQUEUED, manager.getWorkInfoById(marker.id).get(10, TimeUnit.SECONDS)?.state)

            settings.syncStatus("error", "Generated retained error")
            instrumentation.runOnMainSync { SyncSchedule.schedule(context, old, explicit = true) }
            val deadline = android.os.SystemClock.elapsedRealtime() + 15_000
            while (!settings.uploadStatus().contains(MoteI18n.text("配置已发生变化，请刷新后重试。"))) {
                check(android.os.SystemClock.elapsedRealtime() < deadline) { "Explicit stale request did not report its rejection" }
                Thread.sleep(50)
            }
            assertTrue(settings.uploadStatus().contains("Generated retained error"))
            assertEquals(WorkInfo.State.ENQUEUED, manager.getWorkInfoById(marker.id).get(10, TimeUnit.SECONDS)?.state)
        } finally {
            cancel(); SyncSchedule.invalidate()
            val edit = prefs.edit().clear()
            original.forEach { (key, value) -> when (value) {
                is String -> edit.putString(key, value); is Boolean -> edit.putBoolean(key, value)
                is Int -> edit.putInt(key, value); is Long -> edit.putLong(key, value); is Float -> edit.putFloat(key, value)
            } }
            check(edit.commit())
        }
    }
}
