package dev.mote.collector

import android.content.Context
import android.os.Build
import android.os.CancellationSignal
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import androidx.work.ExistingWorkPolicy
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkInfo
import androidx.work.WorkManager
import androidx.work.workDataOf
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith
import java.time.Instant
import java.util.UUID
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit

/** Runs the real SourceScanWorker with one generated, controllably blocked adapter. */
@RunWith(AndroidJUnit4::class)
class SyncSourceScanPauseInstrumentedTest {
    @Test fun pausingDuringScanKeepsTheResultAndDoesNotRetryTheCompletedScan() {
        val context = InstrumentationRegistry.getInstrumentation().targetContext
        require(context.packageName == "dev.mote.collector.dev" && Build.FINGERPRINT.contains("emu64a"))
        val readyDeadline = android.os.SystemClock.elapsedRealtime() + 30_000
        while (QueueStorage.recovering || ConnectionGuard.changing() || ConnectionGuard.processing.get() > 0) {
            check(android.os.SystemClock.elapsedRealtime() < readyDeadline); Thread.sleep(50)
        }
        val settings = Settings(context)
        require(!settings.enabled && context.queue().depth() == 0 && context.localSources().sources().isEmpty())
        val prefs = context.getSharedPreferences("mote", 0); val original = prefs.all.toMap()
        val manager = WorkManager.getInstance(context)
        val names = listOf("mote-upload", "mote-upload-timer", "mote-upload-recovery", "mote-heartbeat", "mote-heartbeat-now", "mote-source-upload", "mote-source-scan")
        fun cancel() = names.forEach { manager.cancelUniqueWork(it).result.get(10, TimeUnit.SECONDS) }
        val started = CountDownLatch(1); val release = CountDownLatch(1)
        val testKind = "generated.scan" + UUID.randomUUID().toString().replace("-", "").take(12)
        SourceAdapters.default.register(object : SourceAdapter {
            override val kind = testKind
            override val version = 1
            override val queueKind = SourceQueueKind.INDEXED
            override fun validateConfiguration(source: LocalSource) = Unit
            override fun available(context: Context, source: LocalSource) = true
            override fun lastScan(context: Context, source: LocalSource) = ""
            override fun scan(context: Context, source: LocalSource, cancellation: CancellationSignal): SourceEmission {
                started.countDown(); check(release.await(20, TimeUnit.SECONDS))
                val now = Instant.now().toString()
                val item = JSONObject().put("externalId", "generated:one").put("observedAt", now).put("title", "Generated item")
                    .put("text", "Generated content").put("kind", "file").put("layer", "snapshot")
                return SourceEmission.Indexed(SourceScan(listOf(item), true, now))
            }
        })
        val source = LocalSource(name = "Generated slow source", kind = testKind)
        try {
            cancel()
            val config = settings.read().copy(server = "http://127.0.0.1:47843", token = "generated-android-node-token-1234567890", debugHttp = true,
                authSignedOut = false, authExpiresAt = 0, authProcess = "", syncPaused = false, syncMode = "manual", wifiOnly = false)
            settings.save(config, confirmCentralEndpoint = true); settings.syncRequestRejected(false)
            context.localSources().save(source)
            val request = OneTimeWorkRequestBuilder<SourceScanWorker>().setInputData(workDataOf("manual" to true, "syncExplicit" to true, "sourceId" to source.id)).build()
            manager.enqueueUniqueWork("mote-source-scan", ExistingWorkPolicy.REPLACE, request).result.get(10, TimeUnit.SECONDS)
            assertTrue(started.await(15, TimeUnit.SECONDS))
            SendPauseControl.set(context, true); assertTrue(settings.read().syncPaused)
            release.countDown()
            val deadline = android.os.SystemClock.elapsedRealtime() + 20_000
            var state: WorkInfo.State? = null
            while (state != WorkInfo.State.SUCCEEDED && android.os.SystemClock.elapsedRealtime() < deadline) {
                state = manager.getWorkInfoById(request.id).get(10, TimeUnit.SECONDS)?.state; Thread.sleep(50)
            }
            assertEquals(WorkInfo.State.SUCCEEDED, state)
            assertEquals(1, context.localSources().pendingSync().count)
            assertFalse(settings.syncRequestRejected()); assertTrue(settings.read().syncPaused)
        } finally {
            release.countDown(); cancel(); context.localSources().remove(source.id); SyncSchedule.invalidate()
            val edit = prefs.edit().clear()
            original.forEach { (key, value) -> when (value) {
                is String -> edit.putString(key, value); is Boolean -> edit.putBoolean(key, value)
                is Int -> edit.putInt(key, value); is Long -> edit.putLong(key, value); is Float -> edit.putFloat(key, value)
            } }
            check(edit.commit())
        }
    }
}
