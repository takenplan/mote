package dev.mote.collector

import android.app.Activity
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.os.Build
import android.os.SystemClock
import android.view.View
import android.view.ViewGroup
import android.view.WindowManager
import android.view.inspector.WindowInspector
import android.widget.*
import androidx.test.core.app.ActivityScenario
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import androidx.work.WorkManager
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Assume.assumeTrue
import org.junit.Test
import org.junit.runner.RunWith
import java.io.ByteArrayOutputStream
import java.io.File
import java.time.Instant
import java.util.UUID
import java.util.concurrent.atomic.AtomicReference

/** Real local stores, codec and worker; generated records only, no capture, update install or network. */
@RunWith(AndroidJUnit4::class)
class MaintenanceScreensInstrumentedTest {
    private val instrumentation get() = InstrumentationRegistry.getInstrumentation()
    private val context get() = instrumentation.targetContext
    private fun <T> main(block: () -> T): T {
        val result = AtomicReference<Result<T>>(); instrumentation.runOnMainSync { result.set(runCatching(block)) }
        return result.get().getOrThrow()
    }
    private fun views(view: View): List<View> = listOf(view) + if (view is ViewGroup) (0 until view.childCount).flatMap { views(view.getChildAt(it)) } else emptyList()
    private fun visible() = WindowInspector.getGlobalWindowViews().filter { it.isShown && it.hasWindowFocus() }.flatMap(::views).filter { it.isShown }
    private fun until(label: String, check: () -> Boolean) {
        val end = SystemClock.elapsedRealtime() + 30_000
        while (SystemClock.elapsedRealtime() < end) { if (check()) return; Thread.sleep(50) }
        fail(label)
    }
    private fun has(value: String) = main { visible().filterIsInstance<TextView>().any { it.text.toString().contains(value) } }
    private fun click(value: String) {
        until(value) { main { visible().filterIsInstance<TextView>().any { it.text.toString() == value && it.isEnabled && it.isClickable } } }
        main { visible().filterIsInstance<TextView>().first { it.text.toString() == value && it.isEnabled && it.isClickable }.apply { requestRectangleOnScreen(android.graphics.Rect(0, 0, width, height), true); performClick() } }
    }
    private fun tag(value: String) {
        until(value) { main { visible().any { it.tag == value && it.isEnabled } } }
        main { visible().first { it.tag == value }.apply { requestRectangleOnScreen(android.graphics.Rect(0, 0, width, height), true); performClick() } }
    }
    private fun capture(name: String) {
        instrumentation.waitForIdleSync(); Thread.sleep(80)
        main {
            val root = WindowInspector.getGlobalWindowViews().last { it.isShown && it.hasWindowFocus() }
            val image = Bitmap.createBitmap(root.width, root.height, Bitmap.Config.ARGB_8888); root.draw(Canvas(image))
            File(context.filesDir, "generated-maintenance-ui").apply { mkdirs() }.resolve("$name.png").outputStream().use { image.compress(Bitmap.CompressFormat.PNG, 100, it) }; image.recycle()
        }
    }
    private fun fixture(block: () -> Unit) {
        assumeTrue(InstrumentationRegistry.getArguments().getString("maintenanceUiFixture") == "true")
        require(context.packageName == "dev.mote.collector.dev" && Build.FINGERPRINT.contains("emu64a"))
        val settings = Settings(context); val before = settings.read(); val language = MoteI18n.preference()
        require(!settings.enabled && !CaptureAccessibilityService.connected && !ProjectionService.running)
        try { settings.save(before.copy(server = "", token = "", syncPaused = true), confirmCentralEndpoint = true); MoteI18n.select(context, "zh-CN"); block() }
        finally { settings.save(before, confirmCentralEndpoint = true); MoteI18n.select(context, language) }
    }
    private fun png(color: Int): ByteArray {
        val bitmap = Bitmap.createBitmap(160, 240, Bitmap.Config.ARGB_8888).apply { eraseColor(color) }
        return try { ByteArrayOutputStream().also { bitmap.compress(Bitmap.CompressFormat.PNG, 100, it) }.toByteArray() } finally { bitmap.recycle() }
    }

    @Test fun editedPreviewRequiresValidExplicitRefreshAndSurvivesRecreationWithoutSaving() = fixture {
        val config = Settings(context).read()
        ActivityScenario.launch(CompressionPreviewActivity::class.java).use { scenario ->
            fun ready() = main { visible().filterIsInstance<Button>().any { it.text == "将参数带回采集设置" && it.isEnabled } }
            until("initial preview") { ready() }
            scenario.onActivity { activity ->
                assertTrue(activity.window.attributes.flags and WindowManager.LayoutParams.FLAG_SECURE != 0)
                views(activity.window.decorView).filterIsInstance<EditText>().single().setText("39")
            }
            assertFalse(ready()); click("更新预览")
            scenario.onActivity { assertNotNull(views(it.window.decorView).filterIsInstance<EditText>().single().error) }
            assertFalse(ready()); scenario.recreate()
            until("draft restored") { main { visible().filterIsInstance<EditText>().any { it.text.toString() == "39" } } }
            assertFalse(ready())
            scenario.onActivity { views(it.window.decorView).filterIsInstance<EditText>().single().setText("82") }
            assertFalse(ready()); click("更新预览"); until("refreshed preview") { ready() }
            assertEquals(config, Settings(context).read()); capture("compression-preview")
            main { visible().filterIsInstance<ImageView>().single { it.contentDescription == "压缩结果" }.performClick() }
            until("zoom") { main { visible().any { it is BulkDedupeImageView && it.drawable != null } } }
            capture("compression-zoom"); click("关闭")
        }
        assertEquals(config, Settings(context).read())
    }

    @Test fun diagnosticPairReadZoomAndClearDoNotChangeCaptureQueue() = fixture {
        val settings = Settings(context); val before = settings.read()
        val store = context.imageDedupeDiagnostics(); require(store.list().isEmpty())
        val inventory = context.queue().inventory()
        settings.save(before.copy(imageDedupeDiagnosticsEnabled = true))
        try {
            ActivityScenario.launch(ImageDedupeDiagnosticsActivity::class.java).use {
                until("empty diagnostics") { has("暂无对比诊断记录") }; capture("diagnostics-empty")
                val pixels = png(Color.LTGRAY)
                val features = BulkDedupeRules.features(pixels, ScreenshotDedupeHelper.Mode.EXACT)
                val metadata = ImageDedupeDiagnosticsDetails.metadata(ScreenshotDedupeHelper.Mode.EXACT,
                    ScreenshotDedupeHelper.compareFeatures(features, features, ScreenshotDedupeHelper.Mode.EXACT),
                    UUID.randomUUID().toString(), Instant.now().minusSeconds(2).toString(), UUID.randomUUID().toString(), Instant.now().toString(),
                    "fixture.maintenance", 160, 240, ScreenshotDedupeHelper.sampleSizeForMode(160, 240, ScreenshotDedupeHelper.Mode.EXACT).width, ScreenshotDedupeHelper.sampleSizeForMode(160, 240, ScreenshotDedupeHelper.Mode.EXACT).height)
                val id = requireNotNull(store.record(metadata, pixels, pixels))
                click("刷新诊断"); until("diagnostic pair") { has("当前图与最近保留图") }; capture("diagnostics-list")
                tag("dedupe:$id"); until("decoded pair") { main { visible().filterIsInstance<ImageView>().count { it.drawable != null } == 2 } }
                capture("diagnostics-pair")
                main { visible().filterIsInstance<ImageView>().first().performClick() }
                until("diagnostic zoom") { main { visible().any { it is BulkDedupeImageView && it.drawable != null } } }
                click("关闭"); tag("dedupe-measurements"); assertTrue(has("不是模型置信度")); click("关闭")
                click("清空诊断副本"); until("diagnostics cleared") { store.list().isEmpty() && has("暂无对比诊断记录") }
                assertEquals(inventory, context.queue().inventory())
            }
        } finally { store.clear() }
    }

    @Test fun logFailureScopeUsesRealLevelsAndPreservesRawTextAcrossRecreation() = fixture {
        val runtime = SupportEvents.runtime(context)
        val fixtureId = UUID.randomUUID().toString()
        runtime.event(EventStage.UPLOAD, EventCode.OK, elapsedMs = 120, httpStatus = 200, sourceId = fixtureId)
        runtime.event(EventStage.UPLOAD, EventCode.TIMEOUT, elapsedMs = 1100, sourceId = fixtureId)
        runtime.event(EventStage.UPLOAD, EventCode.WAIT_NETWORK, sourceId = fixtureId)
        ActivityScenario.launch(LogViewerActivity::class.java).use { scenario ->
            until("logs read") { has(fixtureId) }; capture("logs-all")
            scenario.onActivity { activity -> views(activity.window.decorView).filterIsInstance<Spinner>().single { it.contentDescription == "日志范围" }.setSelection(1) }
            until("failure scope") { main { visible().filterIsInstance<TextView>().any { it.text.contains("TIMEOUT") } } }
            assertFalse(main { visible().filterIsInstance<TextView>().any { it.text.contains("WAIT_NETWORK") } })
            assertFalse(main { visible().filterIsInstance<TextView>().any { it.text.contains("httpStatus=200") } })
            capture("logs-failed"); scenario.recreate()
            until("failure scope restored") { main { visible().filterIsInstance<Spinner>().singleOrNull { it.contentDescription == "日志范围" }?.selectedItemPosition == 1 && visible().filterIsInstance<TextView>().any { it.text.contains("TIMEOUT") } } }
            tag("raw-log-options")
            scenario.onActivity { activity ->
                val text = views(activity.window.decorView).filterIsInstance<EditText>().single().text.toString()
                assertTrue(text.contains(fixtureId)); assertTrue(text.contains("TIMEOUT")); assertFalse(text.contains("WAIT_NETWORK"))
            }
        }
        assertTrue(runtime.readRaw().contains("WAIT_NETWORK")); assertTrue(runtime.readRaw().contains(fixtureId))
    }

    @Test fun devUpdateEntryKeepsInstalledVersionAndRequestsOnlyTheBuildPage() = fixture {
        val before = Settings(context).read()
        val sessions = context.packageManager.packageInstaller.mySessions.map { it.sessionId }.toSet()
        val monitor = object : android.app.Instrumentation.ActivityMonitor() {
            var target: String? = null
            override fun onStartActivity(intent: Intent): android.app.Instrumentation.ActivityResult? = if (intent.action == Intent.ACTION_VIEW) {
                target = intent.dataString; android.app.Instrumentation.ActivityResult(Activity.RESULT_CANCELED, null)
            } else null
        }
        instrumentation.addMonitor(monitor)
        try {
            ActivityScenario.launch(AppUpdatesActivity::class.java).use { scenario ->
                until("DEV build card") { has("DEV 构建手动安装") }; assertTrue(has(BuildConfig.VERSION_NAME)); capture("updates-dev")
                click("打开构建页面"); until("browser request") { monitor.target != null }
                assertEquals("https://github.com/utopiafar/mote/actions/workflows/release-android.yml", monitor.target)
                scenario.recreate(); until("DEV card restored") { has("DEV 构建手动安装") }
            }
        } finally { instrumentation.removeMonitor(monitor) }
        assertEquals(before, Settings(context).read()); assertEquals(sessions, context.packageManager.packageInstaller.mySessions.map { it.sessionId }.toSet())
    }

    @Test fun bulkScanCompareCancelMoveAndRestoreUseRealWorkerAndPreserveReference() = fixture {
        val settings = Settings(context); val config = settings.read(); require(config.server.isBlank())
        val queue = context.queue(); val store = BulkDedupeStore(context); val pending = store.quarantine()
        require(queue.depth() == 0 && pending.depth() == 0)
        val manager = WorkManager.getInstance(context)
        require(manager.getWorkInfosForUniqueWork(BulkDedupeWorker.NAME).get().none { !it.state.isFinished })
        val priorReport = store.read("report"); val priorPlan = store.read("plan")
        val ids = List(3) { UUID.randomUUID().toString() }
        settings.save(config.copy(syncMode = "manual", imageDedupeMode = "exact"))
        try {
            ids.forEachIndexed { index, id ->
                queue.enqueue(JSONObject().put("id", id).put("source", "screen").put("capturedAt", "2026-10-29T01:0${index}:00Z")
                    .put("appId", "fixture.maintenance").put("appName", "Generated maintenance fixture")
                    .put("privacy", JSONObject().put("excluded", false)).put("ocr", JSONObject().put("status", "disabled")), png(if (index == 2) Color.BLACK else Color.WHITE), 64L * 1024 * 1024)
            }
            ActivityScenario.launch(BulkDedupeActivity::class.java).use { scenario ->
                until("bulk idle") { has("就绪") || has("扫描结果") || has("尚无完整扫描结果") }
                click("扫描本机图片")
                until("real scan") { store.read("report").optBoolean("complete") && store.read("report").optJSONArray("pairs")?.length() == 1 }
                until("result UI") { has("候选 1 张") && main { visible().filterIsInstance<ImageView>().count { it.drawable != null } == 2 } }
                capture("bulk-results"); click("预览图片与保留图")
                until("bulk decoded pair") { main { visible().filterIsInstance<BulkDedupeImageView>().count { it.drawable != null } == 2 } }
                capture("bulk-compare"); click("关闭")
                scenario.onActivity { views(it.window.decorView).filterIsInstance<CheckBox>().single().isChecked = true }
                click("删除候选副本"); until("delete confirmation") { has("确认永久删除本机记录及图片？") }; capture("bulk-delete-confirm"); click("取消")
                assertNotNull(queue.capture(ids[0])); assertNotNull(queue.capture(ids[1]))
                click("移入待决定区"); click("确认")
                until("candidate quarantined") { pending.dedupeRow(ids[1]) != null && queue.dedupeRow(ids[1]) == null }
                until("move finished") { manager.getWorkInfosForUniqueWork(BulkDedupeWorker.NAME).get().all { it.state.isFinished } }
                click("待决定区"); until("pending UI") { has("待决定区 · 1 条") }; capture("bulk-pending")
                scenario.recreate(); until("pending view restored") { has("待决定区 · 1 条") }
                scenario.onActivity { views(it.window.decorView).filterIsInstance<CheckBox>().single().isChecked = true }
                click("恢复所选"); click("确认")
                until("candidate restored") { queue.dedupeRow(ids[1]) != null && pending.dedupeRow(ids[1]) == null }
                assertNotNull(queue.image(ids[0])); assertNotNull(queue.image(ids[2])); assertEquals(3, queue.depth())
            }
        } finally {
            manager.cancelUniqueWork(BulkDedupeWorker.NAME).result.get()
            until("worker stopped") { manager.getWorkInfosForUniqueWork(BulkDedupeWorker.NAME).get().all { it.state.isFinished } }
            listOf(queue, pending).forEach { target -> ids.forEach { id -> target.dedupeRow(id)?.let { target.resolveDedupe(id, it.getString("blob"), null, null, null) } } }
            store.write("report", priorReport); store.write("plan", priorPlan)
        }
    }
}
