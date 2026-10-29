package dev.mote.collector

import android.app.Activity
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.Canvas
import android.os.Build
import android.os.SystemClock
import android.view.View
import android.view.ViewGroup
import android.view.WindowManager
import android.view.inspector.WindowInspector
import android.widget.Button
import android.widget.CheckBox
import android.widget.EditText
import android.widget.Spinner
import android.widget.TextView
import androidx.test.core.app.ActivityScenario
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import org.junit.Assert.*
import org.junit.Assume.assumeTrue
import org.junit.Test
import org.junit.runner.RunWith
import java.io.File
import java.util.concurrent.atomic.AtomicReference

/** Only the explicitly selected task emulator; generated data never leaves the device. */
@RunWith(AndroidJUnit4::class)
class SecondaryScreensInstrumentedTest {
    private val instrumentation get() = InstrumentationRegistry.getInstrumentation()
    private val context get() = instrumentation.targetContext
    private fun <T> main(block: () -> T): T {
        val result = AtomicReference<Result<T>>(); instrumentation.runOnMainSync { result.set(runCatching(block)) }
        return result.get().getOrThrow()
    }
    private fun views(view: View): List<View> = listOf(view) + if (view is ViewGroup) (0 until view.childCount).flatMap { views(view.getChildAt(it)) } else emptyList()
    private fun visible(): List<View> = WindowInspector.getGlobalWindowViews().filter { it.isShown && it.hasWindowFocus() }.flatMap(::views).filter { it.isShown }
    private fun until(label: String, check: () -> Boolean) {
        val deadline = SystemClock.elapsedRealtime() + 15000
        while (SystemClock.elapsedRealtime() < deadline) { if (check()) return; Thread.sleep(50) }
        fail(label)
    }
    private fun clickTag(tag: String) {
        until(tag) { main { visible().any { it.tag == tag && it.isEnabled } } }
        main { visible().single { it.tag == tag }.apply { requestRectangleOnScreen(android.graphics.Rect(0, 0, width, height), true); assertTrue(performClick()) } }
    }
    private fun clickText(text: String) {
        until(text) { main { visible().any { it is Button && it.text.toString() == text && it.isEnabled } } }
        main { (visible().single { it is Button && it.text.toString() == text && it.isEnabled }).performClick() }
    }
    private fun clickDialogPositive() {
        until("dialog positive") { main { visible().any { it.id == android.R.id.button1 && it.isEnabled } } }
        main { visible().single { it.id == android.R.id.button1 && it.isEnabled }.performClick() }
    }
    private fun fixture(block: () -> Unit) {
        assumeTrue(InstrumentationRegistry.getArguments().getString("secondaryUiFixture") == "true")
        require(context.packageName == "dev.mote.collector.dev" && Build.FINGERPRINT.contains("emu64a"))
        val settings = Settings(context); val previous = settings.read(); val language = MoteI18n.preference()
        require(!settings.enabled && !ProjectionService.running && !CaptureAccessibilityService.connected)
        require(context.queue().inventory().pending == 0)
        // Optional recovery of the exact generated fixture left by an interrupted source test.
        InstrumentationRegistry.getArguments().getString("secondaryCleanupSourceId")?.let { id ->
            context.localSources().sources().firstOrNull { it.id == id }?.let { source ->
                require(source.name == "Generated original settings" && source.uri == "content://generated/task-file.txt" && !source.enabled)
                context.localSources().remove(id); context.fileArchives().remove(id)
            }
        }
        val originalSources = context.localSources().sources().map { it.id }.toSet()
        try {
            MoteI18n.select(context, "zh-CN")
            settings.save(previous.copy(server = "", token = "", syncPaused = true), confirmCentralEndpoint = true)
            block()
        } finally {
            context.localSources().sources().filterNot { it.id in originalSources }.forEach { context.localSources().remove(it.id); context.fileArchives().remove(it.id) }
            settings.save(previous, confirmCentralEndpoint = true)
            MoteI18n.select(context, language)
        }
    }
    private fun screenshot(activity: Activity, name: String) {
        assertTrue(activity.window.attributes.flags and WindowManager.LayoutParams.FLAG_SECURE != 0)
        val root = activity.window.decorView
        val bitmap = Bitmap.createBitmap(root.width, root.height, Bitmap.Config.ARGB_8888)
        root.draw(Canvas(bitmap))
        val directory = File(context.filesDir, "generated-secondary-ui").apply { mkdirs() }
        File(directory, "$name.png").outputStream().use { bitmap.compress(Bitmap.CompressFormat.PNG, 100, it) }
        bitmap.recycle()
    }

    @Test fun generatedSecondaryPagesKeepSecureWindowAndExposeCurrentState() = fixture {
        val pages = listOf(
            SourcesActivity::class.java to "sources", FileTaskActivity::class.java to "file-import",
            SyncQueueActivity::class.java to "sync", SyncRecoveryActivity::class.java to "recovery",
            BackupActivity::class.java to "backup", StorageActivity::class.java to "storage",
            StorageStatisticsActivity::class.java to "statistics", UploadHistorySettingsActivity::class.java to "history-retention"
        )
        for ((type, name) in pages) {
            ActivityScenario.launch<Activity>(Intent(context, type)).use { scenario ->
                until("$name ready") { main { visible().filterIsInstance<TextView>().none { it.text.toString().startsWith("正在读取") } } }
                instrumentation.waitForIdleSync()
                scenario.onActivity { activity -> screenshot(activity, name) }
                assertFalse(Settings(context).enabled)
            }
        }
    }

    @Test fun calendarDescriptionCancellationSaveAndSourceRemovalUseRealStore() = fixture {
        val source = LocalSource(name = "Generated calendar", kind = "local-calendar", calendarId = 991991, enabled = false)
        context.localSources().save(source)
        val permission = context.checkSelfPermission(android.Manifest.permission.READ_CALENDAR)
        ActivityScenario.launch<SourcesActivity>(Intent(context, SourcesActivity::class.java).putExtra("sourceId", source.id)).use {
            until("description field") { main { visible().any { it.tag == "calendar-description" } } }
            main { (visible().single { it.tag == "calendar-description" } as EditText).setText("Generated cancelled description") }
            clickText(MoteI18n.text("取消"))
            assertEquals("", context.localSources().sources().single { it.id == source.id }.description)
        }
        ActivityScenario.launch<SourcesActivity>(Intent(context, SourcesActivity::class.java).putExtra("sourceId", source.id)).use {
            until("description field") { main { visible().any { it.tag == "calendar-description" } } }
            main { (visible().single { it.tag == "calendar-description" } as EditText).setText("Generated calendar context, separate from events") }
            clickText(MoteI18n.text("保存来源设置"))
            until("description persisted") { context.localSources().sources().single { it.id == source.id }.description == "Generated calendar context, separate from events" }
            val saved = context.localSources().sources().single { it.id == source.id }
            assertTrue(saved.contextDirty); assertEquals(source.calendarId, saved.calendarId)
            assertFalse(saved.enabled); assertEquals(source.daysBefore, saved.daysBefore); assertEquals(source.daysAfter, saved.daysAfter)
        }
        ActivityScenario.launch<SourcesActivity>(Intent(context, SourcesActivity::class.java).putExtra("detailSourceId", source.id)).use { scenario ->
            clickTag("source-remove")
            clickText(MoteI18n.text("取消"))
            assertTrue(context.localSources().sources().any { it.id == source.id })
            scenario.onActivity { screenshot(it, "calendar-source-detail") }
            clickTag("source-remove"); clickDialogPositive()
            until("source removed") { context.localSources().sources().none { it.id == source.id } }
        }
        assertEquals(permission, context.checkSelfPermission(android.Manifest.permission.READ_CALENDAR))
        assertEquals(0, context.queue().inventory().pending)
    }

    @Test fun backupOptionsAndHistoryDraftSurviveRecreationWithoutChangingRecords() = fixture {
        val before = context.queue().inventory()
        ActivityScenario.launch(BackupActivity::class.java).use { scenario ->
            clickTag("backup-config-tab")
            assertFalse(main { visible().filterIsInstance<CheckBox>().any() })
            clickTag("backup-export-options")
            main { visible().filterIsInstance<CheckBox>().single().isChecked = true }
            scenario.recreate()
            until("config tab restored") { main { visible().any { it.tag == "backup-config-tab" && it.isSelected } } }
            assertTrue(main { visible().filterIsInstance<CheckBox>().single().isChecked })
            scenario.onActivity { screenshot(it, "backup-config") }
            clickTag("backup-records-tab")
            assertFalse(main { visible().filterIsInstance<CheckBox>().any() })
            clickTag("backup-scope")
            assertTrue(main { visible().filterIsInstance<TextView>().any { it.text.toString().contains("ZIP 为明文") } })
        }
        val retention = UploadHistoryRetention.read(context)
        try {
            ActivityScenario.launch(UploadHistorySettingsActivity::class.java).use { scenario ->
                until("retention ready") { main { visible().any { it.tag == "history-retention-save" && it.isEnabled } } }
                main { (visible().single { it.tag == "history-retention-choice" } as Spinner).setSelection(2) }
                scenario.recreate()
                until("retention draft restored") { main { (visible().singleOrNull { it.tag == "history-retention-choice" } as? Spinner)?.selectedItemPosition == 2 } }
                clickTag("history-retention-save")
                until("retention saved") { UploadHistoryRetention.read(context) == 90 }
            }
        } finally { UploadHistoryRetention.save(context, retention) }
        assertEquals(before, context.queue().inventory())
    }

    @Test fun stalePauseButtonKeepsSourcePausedAfterBackgroundChange() = fixture {
        val source = LocalSource(name = "Generated stale pause", kind = "local-calendar", calendarId = 991992, enabled = true)
        context.localSources().save(source)
        ActivityScenario.launch<SourcesActivity>(Intent(context, SourcesActivity::class.java).putExtra("detailSourceId", source.id)).use {
            until("pause button") { main { visible().any { it.tag == "source-toggle" } } }
            main {
                val pause = visible().single { it.tag == "source-toggle" } as Button
                assertEquals(MoteI18n.text("暂停这个来源"), pause.text.toString())
                context.localSources().setEnabled(source.id, false)
                pause.performClick()
            }
            until("pause completed") { main { visible().filterIsInstance<TextView>().any { it.text.toString().contains(MoteI18n.text("操作已完成；同步进度会自动刷新")) } } }
            assertFalse(context.localSources().sources().single { it.id == source.id }.enabled)
        }
    }

    @Test fun backupDoesNotOpenAnotherPickerWhileAWriteIsRunning() = fixture {
        val release = java.util.concurrent.CountDownLatch(1)
        val completed = java.util.concurrent.CountDownLatch(1)
        ActivityScenario.launch(BackupActivity::class.java).use { scenario ->
            try {
                scenario.onActivity { activity ->
                    val getTask = BackupActivity::class.java.getDeclaredMethod("getTask").apply { isAccessible = true }
                    val task = getTask.invoke(activity) as UiTask
                    assertTrue(task.start("Generated blocked write", {}, { check(release.await(15, java.util.concurrent.TimeUnit.SECONDS)) }, { completed.countDown() }))
                    views(activity.window.decorView).single { it.tag == "backup-restore-records" }.performClick()
                    views(activity.window.decorView).single { it.tag == "backup-export-records" }.performClick()
                    val pending = BackupActivity::class.java.getDeclaredField("pendingPicker").apply { isAccessible = true }
                    assertEquals(0, pending.getInt(activity))
                    assertTrue(task.busy)
                }
            } finally { release.countDown() }
            assertTrue(completed.await(15, java.util.concurrent.TimeUnit.SECONDS))
        }
    }

    @Test fun sendPauseChangesOnlySendingAndDisconnectedSendStaysUnavailable() = fixture {
        val settings = Settings(context); val before = context.queue().inventory()
        ActivityScenario.launch(SyncQueueActivity::class.java).use { scenario ->
            until("send controls") { main { visible().any { it.tag == "sync-send-pause" } } }
            assertFalse(main { visible().single { it.tag == "sync-send-now" }.isEnabled })
            clickTag("sync-send-pause")
            until("send resumed") { !settings.read().syncPaused }
            assertFalse(settings.enabled)
            assertFalse(main { visible().single { it.tag == "sync-send-now" }.isEnabled })
            clickTag("sync-send-pause")
            until("send paused") { settings.read().syncPaused }
            scenario.onActivity { screenshot(it, "sync-send-paused") }
            clickTag("sync-history-tab")
            scenario.recreate()
            until("history tab restored") { main { visible().any { it.tag == "sync-history-tab" && it.isSelected } } }
        }
        assertEquals(before, context.queue().inventory()); assertFalse(settings.enabled)
    }
}
