package dev.mote.collector

import android.app.Activity
import android.content.Intent
import android.os.Build
import android.os.SystemClock
import android.view.View
import android.view.ViewGroup
import android.view.WindowManager
import android.widget.Button
import android.widget.TextView
import androidx.test.core.app.ActivityScenario
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import org.junit.Assert.*
import org.junit.Assume.assumeTrue
import org.junit.Test
import org.junit.runner.RunWith
import java.io.File

/** Full native maintenance surfaces, with generated-only storage on the dedicated emulator. */
@RunWith(AndroidJUnit4::class)
class UiRolloutInstrumentedTest {
    private val instrumentation get() = InstrumentationRegistry.getInstrumentation()
    private val context get() = instrumentation.targetContext
    private fun views(root: View): List<View> = buildList {
        add(root); if (root is ViewGroup) repeat(root.childCount) { addAll(views(root.getChildAt(it))) }
    }
    private fun labels(activity: Activity) = views(activity.window.decorView).filterIsInstance<TextView>().filter { it.isShown }.map { it.text.toString() }
    private fun ready(activity: Activity) = GeneratedWindowRendering.hasNoPendingLabels(activity.window.decorView) && labels(activity).none {
        it in listOf("正在读取日志…", "正在生成压缩预览…", "正在读取存储位置…", "正在读取本机设置…",
            "正在读取已保存连接…", "正在读取本机统计…").map { key -> MoteI18n.text(key) }
    }

    @Test fun generatedMaintenancePagesKeepTitlesScopeAndCompleteNativeControls() {
        val args = InstrumentationRegistry.getArguments()
        assumeTrue("Explicit generated-only rollout fixture required", args.getString("uiIterationFixture") == "true")
        require(context.packageName == "dev.mote.collector.dev" && Build.FINGERPRINT.contains("/emu64a:"))
        val variant = args.getString("uiIterationVariant", "default")!!
        MoteI18n.select(context, if (variant.contains("english")) "en" else "zh-CN")
        val settings = Settings(context)
        settings.enabled = false
        settings.save(settings.read().copy(server = "", token = "", debugHttp = false, syncMode = "manual"), confirmCentralEndpoint = true)
        val directory = File(context.filesDir, "ui-iterations/round-rollout" + if (variant == "default") "" else "/$variant").apply { mkdirs() }

        fun render(name: String, titleKey: String, intent: Intent, extraReady: (Activity) -> Boolean = { true }) {
            ActivityScenario.launch<Activity>(intent).use { scenario ->
                val deadline = SystemClock.elapsedRealtime() + 20_000
                var complete = false
                while (!complete && SystemClock.elapsedRealtime() < deadline) {
                    scenario.onActivity { activity -> complete = ready(activity) && extraReady(activity) && labels(activity).contains(MoteI18n.text(titleKey)) }
                    if (!complete) Thread.sleep(50)
                }
                assertTrue("Actual $name content must finish loading before drawing", complete)
                instrumentation.waitForIdleSync(); Thread.sleep(100)
                scenario.onActivity { activity ->
                    val root = activity.window.decorView
                    val palette = activity.obtainStyledAttributes(intArrayOf(android.R.attr.colorAccent))
                    try { assertEquals("Native controls inherit the shared blue accent", MoteUi.accent, palette.getColor(0, 0)) } finally { palette.recycle() }
                    assertTrue(activity.window.attributes.flags and WindowManager.LayoutParams.FLAG_SECURE != 0)
                    assertFalse("Maintenance pages do not begin unrelated records", views(root).any { it.isShown && it.contentDescription == MoteI18n.text("添加内容") })
                    val title = views(root).filterIsInstance<TextView>().single { it.isShown && it.tag?.toString() in setOf("local-page-title", "detail-title") }
                    assertEquals(MoteI18n.text(titleKey), title.text.toString())
                    val bounds = android.graphics.Rect()
                    assertTrue(title.getGlobalVisibleRect(bounds)); assertEquals(title.width, bounds.width()); assertEquals(title.height, bounds.height())
                    for (button in views(root).filterIsInstance<Button>().filter { it.isShown }) {
                        if (button.getGlobalVisibleRect(bounds)) assertTrue("$name action must fit horizontally: ${button.text}", bounds.width() == button.width)
                    }
                    GeneratedWindowRendering.save(activity, directory, name)
                    File(directory, "$name.txt").writeText(labels(activity).joinToString("\n"))
                    assertFalse("Drawing maintenance never starts capture", settings.enabled)
                }
            }
        }
        for ((page, title) in listOf("PERMISSIONS" to "权限与后台运行", "ABOUT" to "关于与更新", "DEVELOPER" to "开发者选项",
            "DIAGNOSTICS" to "诊断与支持", "CAPTURE" to "采集与存储", "PROCESSING" to "图像质量与去重", "STORAGE" to "本机存储")) {
            val scene = when (page) { "PROCESSING" -> "processing"; "STORAGE" -> "storage-settings"; else -> page.lowercase() }
            render("rollout-$scene", title, Intent(context, MainActivity::class.java).putExtra("page", page))
        }
        for ((activity, scene, title) in listOf(
            Triple(AppUpdatesActivity::class.java, "updates", "应用更新"), Triple(BackupActivity::class.java, "backup", "导入与导出"),
            Triple(SyncQueueActivity::class.java, "queue", "待上传队列"), Triple(SyncRecoveryActivity::class.java, "recovery", "同步与恢复"),
            Triple(StorageActivity::class.java, "storage-location", "图片保存位置"), Triple(StorageStatisticsActivity::class.java, "statistics", "统计中心"),
            Triple(ActivityStatsActivity::class.java, "activity-statistics", "采集与存储详情"), Triple(LogViewerActivity::class.java, "logs", "日志中心"),
            Triple(ImageDedupeDiagnosticsActivity::class.java, "dedupe", "图片去重诊断"), Triple(CompressionPreviewActivity::class.java, "compression", "图片压缩预览"),
            Triple(BulkDedupeActivity::class.java, "bulk-dedupe", "本机图片批量去重"), Triple(CalendarActionsActivity::class.java, "calendar", "日程建议"), Triple(ConnectionActivity::class.java, "pairing", "连接中央节点"))) {
            render("rollout-$scene", title, Intent(context, activity)) { a ->
                when (scene) {
                    "queue" -> labels(a).contains(MoteI18n.text("暂无待上传记录"))
                    "statistics" -> labels(a).contains(MoteI18n.text("按文件类型"))
                    "compression" -> views(a.window.decorView).filterIsInstance<Button>().any { it.text.toString() == MoteI18n.text("将参数带回采集设置") && it.isEnabled }
                    else -> true
                }
            }
        }
        // The host verifies both AVD camera backends from config.ini before this explicit grant.
        require(args.getString("uiRolloutCameraBackend") == "emulated")
        assertEquals(android.content.pm.PackageManager.PERMISSION_GRANTED, context.checkSelfPermission(android.Manifest.permission.CAMERA))
        render("rollout-scanner", "扫描连接二维码", Intent(context, ConnectionScanActivity::class.java)) { activity ->
            val preview = views(activity.window.decorView).filterIsInstance<com.journeyapps.barcodescanner.DecoratedBarcodeView>().singleOrNull()
            val bounds = android.graphics.Rect()
            preview != null && preview.isLaidOut && preview.width >= activity.moteDp(160) && preview.height >= activity.moteDp(160) &&
                preview.getGlobalVisibleRect(bounds) && bounds.width() == preview.width && bounds.height() == preview.height
        }
    }
}
